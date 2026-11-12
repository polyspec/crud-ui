use crate::binding::{bind_buttons, bind_ordered};
use crate::history::{
    can_redo, can_undo, empty_history, record_change, redo_change, undo_change, History,
    HistoryResult,
};
use crate::template::member_ordered_template;
use crate::template::{data_only, repeats};
use crate::util::{segments, value_at};
use crate::view::{
    initial_view, rekey_row_view, remove_row_view, set_all_expanded_view, toggle_row_view,
    ViewState,
};
use crate::{BindOptions, FieldTemplate, FormError, FormResult, FormTemplate};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

/// Format a nonnegative sequence containing at most 13 decimal digits.
pub fn sequence_row_key(sequence: &str) -> FormResult<String> {
    if sequence.is_empty() || sequence.len() > 13 || !sequence.bytes().all(|c| c.is_ascii_digit()) {
        return Err(FormError::input(
            "A sequence must contain 1–13 decimal digits",
        ));
    }
    Ok(format!("__{sequence:0>13}__"))
}

/// Generate a random 13-character hexadecimal row key using the OS random source.
pub fn create_row_key() -> FormResult<String> {
    let mut bytes = [0u8; 7];
    getrandom::fill(&mut bytes)
        .map_err(|e| FormError::input(format!("Unable to generate a row key: {e}")))?;
    let digits = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    Ok(format!("__{}__", &digits[..13]))
}

fn check_key(key: &str) -> FormResult<()> {
    if key.is_empty()
        || !key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        || key.bytes().all(|b| b.is_ascii_digit())
        || ["__proto__", "prototype", "constructor"].contains(&key)
    {
        return Err(FormError::input(format!(
            "Invalid row key: {key}; use sequenceRowKey for numeric ids"
        )));
    }
    Ok(())
}

fn checked_segments(path: &str) -> FormResult<Vec<String>> {
    let parts = segments(path);
    if parts.is_empty()
        || parts
            .iter()
            .any(|s| ["__proto__", "prototype", "constructor"].contains(&s.as_str()))
    {
        return Err(FormError::input(format!("Invalid form path: {path}")));
    }
    Ok(parts)
}

/// The row path `{collection}.{key}` of a row.
fn row_path(collection: &[String], key: &str) -> String {
    collection
        .iter()
        .map(String::as_str)
        .chain([key])
        .collect::<Vec<_>>()
        .join(".")
}

fn put_at(data: &Value, path: &[String], value: Value) -> Value {
    let mut object = data.as_object().cloned().unwrap_or_default();
    let head = &path[0];
    let next = if path.len() == 1 {
        value
    } else {
        put_at(object.get(head).unwrap_or(&Value::Null), &path[1..], value)
    };
    object.insert(head.clone(), next);
    object.into()
}

fn fresh_key(used: &Map<String, Value>) -> FormResult<String> {
    for _ in 0..100 {
        let key = create_row_key()?;
        if !used.contains_key(&key) {
            return Ok(key);
        }
    }
    Err(FormError::input("Unable to generate an unused row key"))
}

/// The key of the one initial row that missing repeated data creates (CUEC-002).
const INITIAL_ROW_KEY: &str = "__0000000000000__";

fn normalize_row(
    field: &FieldTemplate,
    value: Option<&Value>,
    path: &str,
    fresh: bool,
) -> FormResult<Value> {
    if field.spec.get("type").is_some_and(|t| t == "group") {
        normalize_fields(&field.children, value, path, fresh)
    } else {
        Ok(value
            .or_else(|| field.spec.get("default"))
            .cloned()
            .unwrap_or(json!("")))
    }
}

/// Normalize record data; `path` is the full data path, empty at the root.
/// `fresh` is set for a row that an operation creates: its missing repeated data gets a fresh key, where the record
/// normalization gives the initial row `__0000000000000__`, as the TypeScript and Python references do.
fn normalize_fields(
    fields: &[FieldTemplate],
    value: Option<&Value>,
    path: &str,
    fresh: bool,
) -> FormResult<Value> {
    let mut data = match value {
        None => Map::new(),
        Some(Value::Object(map)) => map.clone(),
        _ if path.is_empty() => return Err(FormError::input("Form data must be an object")),
        _ => {
            return Err(FormError::input(format!(
                "Group data must be an object: {path}"
            )))
        }
    };
    for field in fields {
        let raw = data.get(&field.name);
        let field_path = if path.is_empty() {
            field.name.clone()
        } else {
            format!("{path}.{}", field.name)
        };
        if repeats(field) {
            let mut rows = Map::new();
            match raw {
                // A data-only collection has no row without data.
                None if data_only(field) => {}
                None => {
                    let key = if fresh {
                        fresh_key(&rows)?
                    } else {
                        INITIAL_ROW_KEY.to_owned()
                    };
                    let row = normalize_row(field, None, &format!("{field_path}.{key}"), fresh)?;
                    rows.insert(key, row);
                }
                Some(Value::Object(map)) => {
                    for (key, value) in map {
                        check_key(key)?;
                        let row = normalize_row(
                            field,
                            Some(value),
                            &format!("{field_path}.{key}"),
                            fresh,
                        )?;
                        rows.insert(key.clone(), row);
                    }
                }
                _ => {
                    return Err(FormError::input(format!(
                        "Repeated data must be a keyed object: {field_path}"
                    )))
                }
            }
            data.insert(field.name.clone(), rows.into());
        } else if field.spec.get("type").is_some_and(|t| t == "group") {
            let group = normalize_fields(&field.children, raw, &field_path, fresh)?;
            data.insert(field.name.clone(), group);
        } else if raw.is_none() {
            if let Some(default) = field.spec.get("default") {
                data.insert(field.name.clone(), default.clone());
            }
        }
    }
    Ok(data.into())
}

fn copy_row_value(field: &FieldTemplate, value: &Value) -> FormResult<Value> {
    if field.spec.get("type").is_none_or(|t| t != "group") {
        return Ok(value.clone());
    }
    let mut row = value.as_object().cloned().unwrap_or_default();
    for child in &field.children {
        let Some(raw) = row.get(&child.name).filter(|v| v.is_object()) else {
            continue;
        };
        if repeats(child) {
            let mut used = raw.as_object().unwrap().clone();
            let mut copied = Map::new();
            for value in raw.as_object().unwrap().values() {
                let key = fresh_key(&used)?;
                used.insert(key.clone(), Value::Null);
                copied.insert(key, copy_row_value(child, value)?);
            }
            row.insert(child.name.clone(), copied.into());
        } else if child.spec.get("type").is_some_and(|t| t == "group") {
            let copied = copy_row_value(child, raw)?;
            row.insert(child.name.clone(), copied);
        }
    }
    Ok(row.into())
}

/// Values, identity and insertion position for an added or copied row.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRowOptions {
    /// Supplied row key; omitted to generate a new key.
    pub key: Option<String>,
    /// Existing row after which insertion occurs; omitted to append.
    pub after_key: Option<String>,
    /// Initial value; omitted to apply field defaults.
    #[serde(
        default,
        deserialize_with = "present_value",
        skip_serializing_if = "Option::is_none"
    )]
    pub value: Option<Value>,
}

fn present_value<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<Value>, D::Error> {
    Value::deserialize(deserializer).map(Some)
}

/// The state of a form instance that a renderer reads after each operation (CURP-029).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormSnapshot {
    /// Evaluated fields for the current data and view.
    pub fields: Vec<Value>,
    /// Evaluated form buttons for the current data.
    pub buttons: Vec<Value>,
    /// Number of successful data updates (CURT-067).
    pub revision: u64,
    /// Whether `undo` can restore an earlier record (CURT-061).
    pub can_undo: bool,
    /// Whether `redo` can reapply a reverted change (CURT-061).
    pub can_redo: bool,
}

/// An independent editable form instance using a compiled structure.
#[derive(Clone)]
pub struct Form {
    template: FormTemplate,
    data: Value,
    fields: Vec<Value>,
    buttons: Vec<Value>,
    options: BindOptions,
    revision: u64,
    view: ViewState,
    history: History<Value>,
}

impl Form {
    /// Create an instance, prepare default data and evaluate fields.
    pub fn new(template: FormTemplate, data: &Value, options: BindOptions) -> FormResult<Self> {
        // The template specification is kept in member order; the data keeps its own order.
        let template = member_ordered_template(&template);
        let data = normalize_fields(&template.fields, Some(data), "", false)?;
        let fields = bind_ordered(&template, &data, &options)?;
        let buttons = bind_buttons(&template, &data, &options)?;
        Ok(Self {
            template,
            data,
            fields,
            buttons,
            options,
            revision: 0,
            view: initial_view(),
            history: empty_history(),
        })
    }

    /// Content and interface language of the instance, defaulting to Korean.
    pub(crate) fn language(&self) -> &str {
        self.options.language.as_str().unwrap_or("ko")
    }

    /// Return the shared structure without instance values.
    pub fn template(&self) -> &FormTemplate {
        &self.template
    }

    /// Return the current field models.
    pub fn fields(&self) -> &[Value] {
        &self.fields
    }

    /// Number of successful instance updates.
    pub fn revision(&self) -> u64 {
        self.revision
    }

    /// The evaluated form buttons for the current data.
    pub fn buttons(&self) -> &[Value] {
        &self.buttons
    }

    /// The root description of the template translated for the instance language; empty text
    /// when the root declares none.
    pub fn description(&self) -> String {
        crate::util::translate(self.template.description.as_ref(), self.language())
    }

    /// The fields, the buttons, the revision and the history state of the instance (CURP-029).
    /// A renderer reads it after each operation that succeeded; the instance keeps no listener.
    pub fn snapshot(&self) -> FormSnapshot {
        FormSnapshot {
            fields: self.fields.clone(),
            buttons: self.buttons.clone(),
            revision: self.revision,
            can_undo: self.can_undo(),
            can_redo: self.can_redo(),
        }
    }

    /// Return detached submission data.
    pub fn get_data(&self) -> Value {
        self.data.clone()
    }

    /// Replace record data, restart the history and reevaluate the form atomically.
    pub fn set_data(&mut self, data: &Value) -> FormResult<()> {
        self.commit_view(
            normalize_fields(&self.template.fields, Some(data), "", false)?,
            initial_view(),
            empty_history(),
        )
    }

    /// Return a detached value relative to the data root, or `None` when the data holds no value at
    /// `path` (CURT-093); a member whose value is null gives `Some(Value::Null)`.
    pub fn get_value(&self, path: &str) -> FormResult<Option<Value>> {
        checked_segments(path)?;
        Ok(value_at(&self.data, path).cloned())
    }

    /// Update one data path and reevaluate the form atomically.
    pub fn set_value(&mut self, path: &str, value: Value) -> FormResult<()> {
        let segments = checked_segments(path)?;
        let data = put_at(&self.data, &segments, value);
        self.commit(
            normalize_fields(&self.template.fields, Some(&data), "", false)?,
            Some(&segments.join(".")),
        )
    }

    /// Restore the record before the last data change; the reverted record can be redone (CURT-011).
    pub fn undo(&mut self) -> FormResult<()> {
        let result = undo_change(&self.history, self.data.clone())?;
        self.restore(result)
    }

    /// Reapply the most recently undone data change (CURT-012).
    pub fn redo(&mut self) -> FormResult<()> {
        let result = redo_change(&self.history, self.data.clone())?;
        self.restore(result)
    }

    /// Whether `undo` can restore an earlier record (CURT-061).
    pub fn can_undo(&self) -> bool {
        can_undo(&self.history)
    }

    /// Whether `redo` can reapply a reverted change (CURT-061).
    pub fn can_redo(&self) -> bool {
        can_redo(&self.history)
    }

    /// Replace the record and the history of an undo or a redo and keep the view; the revision advances.
    fn restore(&mut self, result: HistoryResult<Value>) -> FormResult<()> {
        let fields = bind_ordered(
            &self.template,
            &result.value,
            &self.bind_options(&self.view),
        )?;
        let buttons = bind_buttons(&self.template, &result.value, &self.options)?;
        self.history = result.history;
        self.data = result.value;
        self.fields = fields;
        self.buttons = buttons;
        self.revision += 1;
        Ok(())
    }

    /// The options of the form with the collapsed rows of a view.
    fn bind_options(&self, view: &ViewState) -> BindOptions {
        let mut options = self.options.clone();
        options.collapsed = view
            .collapsed
            .iter()
            .cloned()
            .map(Value::String)
            .collect::<Vec<_>>()
            .into();
        options
    }

    /// Replace the record and keep the view; `path` is the path of a value edit, if the change is one.
    /// A failure leaves the record, the view and the history unchanged.
    fn commit(&mut self, data: Value, path: Option<&str>) -> FormResult<()> {
        let view = self.view.clone();
        let history = self.recorded(path);
        self.commit_view(data, view, history)
    }

    /// The history after a change of the record: the record before the change is kept (CURT-063).
    fn recorded(&self, path: Option<&str>) -> History<Value> {
        record_change(&self.history, self.data.clone(), path)
    }

    /// Replace the record, the view and the history together.
    fn commit_view(
        &mut self,
        data: Value,
        view: ViewState,
        history: History<Value>,
    ) -> FormResult<()> {
        let fields = bind_ordered(&self.template, &data, &self.bind_options(&view))?;
        let buttons = bind_buttons(&self.template, &data, &self.options)?;
        self.data = data;
        self.fields = fields;
        self.buttons = buttons;
        self.view = view;
        self.history = history;
        self.revision += 1;
        Ok(())
    }

    /// Expand a collapsed row or collapse an expanded one; the record and the revision do not change.
    pub fn toggle_row(&mut self, path: &str, key: &str) -> FormResult<()> {
        let (_, rows) = self.collection(path)?;
        if !rows.contains_key(key) {
            return Err(FormError::input(format!("Unknown row: {key}")));
        }
        let segments = checked_segments(path)?;
        self.refresh_view(toggle_row_view(&self.view, &row_path(&segments, key)))
    }

    /// Expand every row, or collapse every collapsible row; the record and the revision do not change.
    pub fn set_all_expanded(&mut self, expanded: bool) -> FormResult<()> {
        self.refresh_view(set_all_expanded_view(&self.fields, expanded))
    }

    fn refresh_view(&mut self, view: ViewState) -> FormResult<()> {
        self.fields = bind_ordered(&self.template, &self.data, &self.bind_options(&view))?;
        self.view = view;
        Ok(())
    }

    /// A collection whose rows the form may add, copy, remove, move or rekey.
    fn editable_collection(&self, path: &str) -> FormResult<(&FieldTemplate, &Map<String, Value>)> {
        let found = self.collection(path)?;
        if data_only(found.0) {
            return Err(FormError::input(format!(
                "Rows of {path} come only from data"
            )));
        }
        Ok(found)
    }

    fn collection(&self, path: &str) -> FormResult<(&FieldTemplate, &Map<String, Value>)> {
        let parts = checked_segments(path)?;
        let mut fields = &self.template.fields;
        let mut selected = None;
        let mut i = 0;
        while i < parts.len() {
            let field = fields
                .iter()
                .find(|f| f.name == parts[i])
                .ok_or_else(|| FormError::input(format!("Unknown collection: {path}")))?;
            if i + 1 == parts.len() {
                selected = Some(field);
                break;
            }
            if repeats(field) {
                i += 1;
            }
            fields = &field.children;
            i += 1;
        }
        let field = selected
            .filter(|f| repeats(f))
            .ok_or_else(|| FormError::input(format!("Not a keyed collection: {path}")))?;
        let rows = value_at(&self.data, path)
            .and_then(Value::as_object)
            .ok_or_else(|| FormError::input(format!("Not a keyed collection: {path}")))?;
        Ok((field, rows))
    }

    /// Insert a row with supplied data or field defaults.
    pub fn add_row(&mut self, path: &str, options: AddRowOptions) -> FormResult<String> {
        let (field, rows) = self.editable_collection(path)?;
        if field
            .spec
            .get("multiple")
            .and_then(|v| v.get("max"))
            .and_then(Value::as_f64)
            .is_some_and(|max| rows.len() as f64 >= max)
        {
            return Err(FormError::input(format!(
                "Maximum row count reached: {path}"
            )));
        }
        let key = match options.key {
            Some(key) => key,
            None => fresh_key(rows)?,
        };
        check_key(&key)?;
        if rows.contains_key(&key) {
            return Err(FormError::input(format!("Row key already exists: {key}")));
        }
        let mut entries = rows
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect::<Vec<_>>();
        let at = match &options.after_key {
            None => entries.len(),
            Some(after) => {
                entries
                    .iter()
                    .position(|(k, _)| k == after)
                    .ok_or_else(|| FormError::input(format!("Unknown row: {after}")))?
                    + 1
            }
        };
        let row_path = format!("{}.{key}", checked_segments(path)?.join("."));
        entries.insert(
            at,
            (
                key.clone(),
                normalize_row(field, options.value.as_ref(), &row_path, true)?,
            ),
        );
        self.commit(
            put_at(
                &self.data,
                &checked_segments(path)?,
                Value::Object(entries.into_iter().collect()),
            ),
            None,
        )?;
        Ok(key)
    }

    /// Copy current values and generate new identities for nested repeated rows.
    pub fn copy_row(
        &mut self,
        path: &str,
        key: &str,
        mut options: AddRowOptions,
    ) -> FormResult<String> {
        let (field, rows) = self.editable_collection(path)?;
        let value = rows
            .get(key)
            .ok_or_else(|| FormError::input(format!("Unknown row: {key}")))?;
        options.value = Some(copy_row_value(field, value)?);
        if options.after_key.is_none() {
            options.after_key = Some(key.into());
        }
        self.add_row(path, options)
    }

    /// Remove a row while enforcing the minimum count.
    pub fn remove_row(&mut self, path: &str, key: &str) -> FormResult<()> {
        let (field, rows) = self.editable_collection(path)?;
        if !rows.contains_key(key) {
            return Err(FormError::input(format!("Unknown row: {key}")));
        }
        if field
            .spec
            .get("multiple")
            .and_then(|v| v.get("min"))
            .and_then(Value::as_f64)
            .is_some_and(|min| rows.len() as f64 <= min)
        {
            return Err(FormError::input(format!(
                "Minimum row count reached: {path}"
            )));
        }
        let mut rows = rows.clone();
        rows.shift_remove(key);
        let segments = checked_segments(path)?;
        let view = remove_row_view(&self.view, &row_path(&segments, key));
        let history = self.recorded(None);
        self.commit_view(put_at(&self.data, &segments, rows.into()), view, history)
    }

    /// Move a row without changing its identity or values; `index` is the position after the move, and a position
    /// outside the rows fails.
    pub fn move_row(&mut self, path: &str, key: &str, index: i64) -> FormResult<()> {
        let (_, rows) = self.editable_collection(path)?;
        let mut entries = rows
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect::<Vec<_>>();
        let from = entries
            .iter()
            .position(|(k, _)| k == key)
            .ok_or_else(|| FormError::input(format!("Unknown row: {key}")))?;
        if index < 0 || index >= entries.len() as i64 {
            return Err(FormError::input(format!("Invalid row position: {index}")));
        }
        let to = index as usize;
        if from == to {
            return Ok(());
        }
        let row = entries.remove(from);
        entries.insert(to, row);
        self.commit(
            put_at(
                &self.data,
                &checked_segments(path)?,
                Value::Object(entries.into_iter().collect()),
            ),
            None,
        )
    }

    /// Apply a saved sequence key to one row and update its descendant paths.
    pub fn rekey_row(&mut self, path: &str, old_key: &str, new_key: &str) -> FormResult<()> {
        let (_, rows) = self.editable_collection(path)?;
        check_key(new_key)?;
        if !rows.contains_key(old_key) {
            return Err(FormError::input(format!("Unknown row: {old_key}")));
        }
        if old_key == new_key {
            return Ok(());
        }
        if rows.contains_key(new_key) {
            return Err(FormError::input(format!(
                "Row key already exists: {new_key}"
            )));
        }
        let rows = rows
            .iter()
            .map(|(k, v)| {
                (
                    if k == old_key {
                        new_key.to_owned()
                    } else {
                        k.clone()
                    },
                    v.clone(),
                )
            })
            .collect::<Map<_, _>>();
        let segments = checked_segments(path)?;
        let view = rekey_row_view(
            &self.view,
            &row_path(&segments, old_key),
            &row_path(&segments, new_key),
        );
        let history = self.recorded(None);
        self.commit_view(put_at(&self.data, &segments, rows.into()), view, history)
    }
}
