//! The public boundary of the generator for the bindings (CURP-030): JSON values cross it as
//! polyspec-json values. A value that enters is checked by the input text rules of its argument and
//! read with its members in order and its numbers as ECMAScript doubles; a value that leaves is
//! written with its members in order and its numbers as `Number::toString` writes their doubles.
//! Every operation here runs the operation of the same name of the crate.

use binding_core::{Failure, OrderedMap};
use polyspec_crud_ui_validator::boundary::{
    input, output, specification, FileLoader, LoaderBridge, FILES_WITH_LOADER_MESSAGE,
};
use polyspec_crud_ui_validator::{FormInputError, ValidateError};
use polyspec_json::Value as JsonValue;
use serde_json::{Map, Value};

use crate::{
    ActionResult, ActionTarget, FormError, FormResult, FormTemplate, History, HistoryResult,
    ViewState,
};

/// A failure of the boundary of the validator as a failure of the generator.
fn failure(error: ValidateError) -> FormError {
    error.into()
}

/// `files` given with a loader are refused (CURP-031).
fn no_files(files: &OrderedMap<JsonValue>) -> FormResult<()> {
    if files.is_empty() {
        Ok(())
    } else {
        Err(FormError::input(FILES_WITH_LOADER_MESSAGE))
    }
}

/// A failure of a value that leaves the boundary.
fn left(error: FormInputError) -> FormError {
    FormError::input(error.message)
}

/// A value that enters as the argument `name`.
fn enter(name: &str, value: &JsonValue) -> FormResult<Value> {
    input(name, value).map_err(failure)
}

/// A specification that enters.
fn enter_spec(value: &JsonValue) -> FormResult<Value> {
    specification(value).map_err(failure)
}

/// A list of values that enters as the argument `name`, item by item.
fn enter_list(name: &str, values: &[JsonValue]) -> FormResult<Vec<Value>> {
    values
        .iter()
        .enumerate()
        .map(|(index, value)| enter(&format!("{name}.{index}"), value))
        .collect()
}

/// The composition files that enter as `options.files`, in their order (CUIT-023).
fn enter_files(files: &OrderedMap<JsonValue>) -> FormResult<Map<String, Value>> {
    polyspec_crud_ui_validator::boundary::files(files).map_err(failure)
}

/// A value that leaves.
fn leave(value: &Value) -> FormResult<JsonValue> {
    output(value).map_err(left)
}

/// A list of values that leaves.
fn leave_list(values: &[Value]) -> FormResult<Vec<JsonValue>> {
    values.iter().map(leave).collect()
}

/// The base path of relative references that an operation takes when its options leave it out (binding U-2).
pub const DEFAULT_BASEPATH: &str = "";

/// The content language of a list or a detail whose options leave it out (CUMK-070, binding U-2).
pub const DEFAULT_LANGUAGE: &str = "ko";

/// The text of an option, or `default` when the options leave it out (binding U-2).
fn or_default(value: Option<&String>, default: &str) -> String {
    match value {
        Some(text) => text.clone(),
        None => default.to_owned(),
    }
}

/// The options of [`compile_form`].
#[derive(Debug, Clone, Default)]
pub struct CompileOptions {
    /// The composition files by name.
    pub files: OrderedMap<JsonValue>,
    /// The base path of relative references; none is [`DEFAULT_BASEPATH`].
    pub basepath: Option<String>,
    /// The root prefix of input names.
    pub key_prefix: Option<String>,
}

/// The binding options (CUMK-070); an absent option uses its default.
#[derive(Debug, Clone, Default)]
pub struct BindOptions {
    /// The prefix of element ids (CURT-094).
    pub id_prefix: Option<String>,
    /// The content and interface language.
    pub language: Option<String>,
    /// The root prefix of input names.
    pub key_prefix: Option<String>,
    /// `throw` or `marker` for a field type that binding does not support.
    pub unsupported: Option<String>,
    /// The row paths rendered collapsed (CURT-069).
    pub collapsed: Vec<String>,
}

impl BindOptions {
    /// The options of the crate.
    fn core(&self) -> crate::BindOptions {
        let text = |value: &Option<String>| match value {
            Some(text) => Value::String(text.clone()),
            None => Value::Null,
        };
        crate::BindOptions {
            id_prefix: text(&self.id_prefix),
            language: text(&self.language),
            key_prefix: text(&self.key_prefix),
            unsupported: text(&self.unsupported),
            collapsed: Value::Array(self.collapsed.iter().cloned().map(Value::String).collect()),
        }
    }
}

/// The options of the list and detail operations.
#[derive(Debug, Clone, Default)]
pub struct ListOptions {
    /// The composition files by name.
    pub files: OrderedMap<JsonValue>,
    /// The base path of relative references; none is [`DEFAULT_BASEPATH`].
    pub basepath: Option<String>,
    /// The content language; none is [`DEFAULT_LANGUAGE`].
    pub language: Option<String>,
    /// The list-level data of column visibility; none is no data.
    pub data: Option<JsonValue>,
    /// The current page.
    pub page: Option<u64>,
    /// The total number of rows.
    pub total: Option<u64>,
}

impl ListOptions {
    /// The options of the crate that read the files of `bridge` (CURP-031).
    fn loaded<'a>(&self, bridge: &'a LoaderBridge<'_>) -> FormResult<crate::ListOptions<'a>> {
        no_files(&self.files)?;
        let mut options: crate::ListOptions<'a> = self.core()?;
        options.loader = Some(bridge);
        Ok(options)
    }

    /// The options of the crate.
    fn core(&self) -> FormResult<crate::ListOptions<'static>> {
        let number = |value: Option<u64>| match value {
            Some(number) => Value::from(number),
            None => Value::Null,
        };
        Ok(crate::ListOptions {
            files: enter_files(&self.files)?,
            loader: None,
            basepath: or_default(self.basepath.as_ref(), DEFAULT_BASEPATH),
            language: or_default(self.language.as_ref(), DEFAULT_LANGUAGE),
            data: match &self.data {
                Some(data) => enter("options.data", data)?,
                None => Value::Null,
            },
            page: number(self.page),
            total: number(self.total),
            ..crate::ListOptions::default()
        })
    }
}

/// [`crate::compile_form`] at the boundary.
pub fn compile_form(spec: &JsonValue, options: &CompileOptions) -> FormResult<FormTemplate> {
    let spec = enter_spec(spec)?;
    let options = crate::CompileOptions {
        files: enter_files(&options.files)?,
        loader: None,
        basepath: or_default(options.basepath.as_ref(), DEFAULT_BASEPATH),
        key_prefix: options.key_prefix.clone(),
    };
    crate::compile_form(&spec, &options)
}

/// [`compile_form`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the compilation as a kind, or the failure of the loader.
pub fn compile_form_with_loader(
    spec: &JsonValue,
    loader: &mut dyn FileLoader,
    options: &CompileOptions,
) -> Result<FormTemplate, Failure<FormError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        no_files(&options.files)?;
        let spec = enter_spec(spec)?;
        let options = crate::CompileOptions {
            files: Map::new(),
            loader: Some(&bridge),
            basepath: or_default(options.basepath.as_ref(), DEFAULT_BASEPATH),
            key_prefix: options.key_prefix.clone(),
        };
        crate::compile_form(&spec, &options)
    })();
    bridge.settle(result)
}

/// A compiled template read from a value that crossed JSON (CURT-092).
pub fn template_from_json(value: &JsonValue) -> FormResult<FormTemplate> {
    FormTemplate::from_json(&enter("template", value)?)
}

/// [`crate::bind_form`] at the boundary.
pub fn bind_form(
    template: &FormTemplate,
    data: &JsonValue,
    options: &BindOptions,
) -> FormResult<Vec<JsonValue>> {
    leave_list(&crate::bind_form(
        template,
        &enter("data", data)?,
        &options.core(),
    )?)
}

/// [`crate::bind_buttons`] at the boundary.
pub fn bind_buttons(
    template: &FormTemplate,
    data: &JsonValue,
    options: &BindOptions,
) -> FormResult<Vec<JsonValue>> {
    leave_list(&crate::bind_buttons(
        template,
        &enter("data", data)?,
        &options.core(),
    )?)
}

/// [`crate::form_buttons_html`] at the boundary.
pub fn form_buttons_html(buttons: &JsonValue) -> FormResult<String> {
    crate::form_buttons_html(&enter("buttons", buttons)?)
}

/// [`crate::render_form`] at the boundary.
pub fn render_form(form: &Form, options: Option<&JsonValue>) -> FormResult<String> {
    let options = match options {
        Some(options) => Some(enter("options", options)?),
        None => None,
    };
    crate::render_form(&form.form, options.as_ref())
}

/// [`crate::render_form_view`] at the boundary.
pub fn render_form_view(
    template: &FormTemplate,
    data: &JsonValue,
    render: Option<&JsonValue>,
    options: &BindOptions,
) -> FormResult<String> {
    let render = match render {
        Some(render) => Some(enter("render", render)?),
        None => None,
    };
    crate::render_form_view(
        template,
        &enter("data", data)?,
        render.as_ref(),
        &options.core(),
    )
}

/// [`crate::build_list`] at the boundary.
pub fn build_list(
    spec: &JsonValue,
    rows: &[JsonValue],
    options: &ListOptions,
) -> FormResult<JsonValue> {
    let spec = enter_spec(spec)?;
    leave(&crate::build_list(
        &spec,
        &enter_list("rows", rows)?,
        &options.core()?,
    )?)
}

/// [`crate::render_list`] at the boundary.
pub fn render_list(
    spec: &JsonValue,
    rows: &[JsonValue],
    options: &ListOptions,
) -> FormResult<String> {
    let spec = enter_spec(spec)?;
    crate::render_list(&spec, &enter_list("rows", rows)?, &options.core()?)
}

/// [`crate::build_detail`] at the boundary.
pub fn build_detail(
    spec: &JsonValue,
    record: &JsonValue,
    options: &ListOptions,
) -> FormResult<JsonValue> {
    let spec = enter_spec(spec)?;
    leave(&crate::build_detail(
        &spec,
        &enter("record", record)?,
        &options.core()?,
    )?)
}

/// [`crate::render_detail`] at the boundary.
pub fn render_detail(
    spec: &JsonValue,
    record: &JsonValue,
    options: &ListOptions,
) -> FormResult<String> {
    let spec = enter_spec(spec)?;
    crate::render_detail(&spec, &enter("record", record)?, &options.core()?)
}

/// [`build_list`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the operation as a kind, or the failure of the loader.
pub fn build_list_with_loader(
    spec: &JsonValue,
    rows: &[JsonValue],
    loader: &mut dyn FileLoader,
    options: &ListOptions,
) -> Result<JsonValue, Failure<FormError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let options = options.loaded(&bridge)?;
        let spec = enter_spec(spec)?;
        leave(&crate::build_list(
            &spec,
            &enter_list("rows", rows)?,
            &options,
        )?)
    })();
    bridge.settle(result)
}

/// [`render_list`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the operation as a kind, or the failure of the loader.
pub fn render_list_with_loader(
    spec: &JsonValue,
    rows: &[JsonValue],
    loader: &mut dyn FileLoader,
    options: &ListOptions,
) -> Result<String, Failure<FormError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let options = options.loaded(&bridge)?;
        let spec = enter_spec(spec)?;
        crate::render_list(&spec, &enter_list("rows", rows)?, &options)
    })();
    bridge.settle(result)
}

/// [`build_detail`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the operation as a kind, or the failure of the loader.
pub fn build_detail_with_loader(
    spec: &JsonValue,
    record: &JsonValue,
    loader: &mut dyn FileLoader,
    options: &ListOptions,
) -> Result<JsonValue, Failure<FormError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let options = options.loaded(&bridge)?;
        let spec = enter_spec(spec)?;
        leave(&crate::build_detail(
            &spec,
            &enter("record", record)?,
            &options,
        )?)
    })();
    bridge.settle(result)
}

/// [`render_detail`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the operation as a kind, or the failure of the loader.
pub fn render_detail_with_loader(
    spec: &JsonValue,
    record: &JsonValue,
    loader: &mut dyn FileLoader,
    options: &ListOptions,
) -> Result<String, Failure<FormError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let options = options.loaded(&bridge)?;
        let spec = enter_spec(spec)?;
        crate::render_detail(&spec, &enter("record", record)?, &options)
    })();
    bridge.settle(result)
}

/// [`crate::build_outline`] at the boundary.
pub fn build_outline(nodes: &[JsonValue]) -> FormResult<Vec<JsonValue>> {
    leave_list(&crate::build_outline(&enter_list("nodes", nodes)?))
}

/// [`crate::collapsible_rows`] at the boundary.
pub fn collapsible_rows(nodes: &[JsonValue]) -> FormResult<Vec<String>> {
    Ok(crate::collapsible_rows(&enter_list("nodes", nodes)?))
}

/// [`crate::set_all_expanded_view`] at the boundary.
pub fn set_all_expanded_view(nodes: &[JsonValue], expanded: bool) -> FormResult<ViewState> {
    Ok(crate::set_all_expanded_view(
        &enter_list("nodes", nodes)?,
        expanded,
    ))
}

/// [`crate::render_outline_view`] at the boundary.
pub fn render_outline_view(
    fields: &[JsonValue],
    can_undo: bool,
    can_redo: bool,
    language: &str,
) -> FormResult<String> {
    crate::render_outline_view(&enter_list("fields", fields)?, can_undo, can_redo, language)
}

/// [`crate::render_data_panel`] at the boundary.
pub fn render_data_panel(data: &JsonValue, language: &str) -> FormResult<String> {
    crate::render_data_panel(&enter("data", data)?, language)
}

/// [`crate::render_outline`] at the boundary.
pub fn render_outline(form: &Form) -> FormResult<String> {
    crate::render_outline(&form.form)
}

/// [`crate::render_data`] at the boundary.
pub fn render_data(form: &Form) -> FormResult<String> {
    crate::render_data(&form.form)
}

/// The undo history of records that crossed the boundary (CURT-076).
pub type BoundaryHistory = History<JsonValue>;

/// The history and the record of an undo or a redo at the boundary.
pub type BoundaryHistoryResult = HistoryResult<JsonValue>;

/// The empty history of records that crossed the boundary (CURT-076).
pub fn empty_history() -> History<JsonValue> {
    crate::empty_history()
}

/// [`crate::record_change`] at the boundary; the records are kept as they crossed it.
pub fn record_change(
    history: &History<JsonValue>,
    previous: JsonValue,
    path: Option<&str>,
) -> History<JsonValue> {
    crate::record_change(history, previous, path)
}

/// [`crate::undo_change`] at the boundary.
pub fn undo_change(
    history: &History<JsonValue>,
    current: JsonValue,
) -> FormResult<HistoryResult<JsonValue>> {
    crate::undo_change(history, current)
}

/// [`crate::redo_change`] at the boundary.
pub fn redo_change(
    history: &History<JsonValue>,
    current: JsonValue,
) -> FormResult<HistoryResult<JsonValue>> {
    crate::redo_change(history, current)
}

/// The values and the position of an added row at the boundary.
#[derive(Debug, Clone, Default)]
pub struct AddRowOptions {
    /// The key of the row; none generates one.
    pub key: Option<String>,
    /// The row after which the new row is inserted; none appends it.
    pub after_key: Option<String>,
    /// The value of the row; none takes the field defaults.
    pub value: Option<JsonValue>,
}

/// The state of a form instance at the boundary (CURP-029).
#[derive(Debug, Clone)]
pub struct FormSnapshot {
    /// Evaluated fields.
    pub fields: Vec<JsonValue>,
    /// Evaluated form buttons.
    pub buttons: Vec<JsonValue>,
    /// Number of successful data updates.
    pub revision: u64,
    /// Whether undo can restore a record.
    pub can_undo: bool,
    /// Whether redo can reapply a record.
    pub can_redo: bool,
}

/// A form instance at the boundary.
#[derive(Clone)]
pub struct Form {
    form: crate::Form,
}

impl Form {
    /// [`crate::Form::new`] at the boundary.
    pub fn new(
        template: &FormTemplate,
        data: &JsonValue,
        options: &BindOptions,
    ) -> FormResult<Self> {
        Ok(Self {
            form: crate::Form::new(template.clone(), &enter("data", data)?, options.core())?,
        })
    }

    /// The compiled template.
    pub fn template(&self) -> &FormTemplate {
        self.form.template()
    }

    /// The evaluated fields.
    pub fn fields(&self) -> FormResult<Vec<JsonValue>> {
        leave_list(self.form.fields())
    }

    /// The evaluated form buttons.
    pub fn buttons(&self) -> FormResult<Vec<JsonValue>> {
        leave_list(self.form.buttons())
    }

    /// The translated root description.
    pub fn description(&self) -> String {
        self.form.description()
    }

    /// The revision.
    pub fn revision(&self) -> u64 {
        self.form.revision()
    }

    /// The snapshot of the instance (CURP-029).
    pub fn snapshot(&self) -> FormResult<FormSnapshot> {
        let snapshot = self.form.snapshot();
        Ok(FormSnapshot {
            fields: leave_list(&snapshot.fields)?,
            buttons: leave_list(&snapshot.buttons)?,
            revision: snapshot.revision,
            can_undo: snapshot.can_undo,
            can_redo: snapshot.can_redo,
        })
    }

    /// The submission data.
    pub fn get_data(&self) -> FormResult<JsonValue> {
        leave(&self.form.get_data())
    }

    /// The value at a data path, or none (CURT-093).
    pub fn get_value(&self, path: &str) -> FormResult<Option<JsonValue>> {
        match self.form.get_value(path)? {
            Some(value) => Ok(Some(leave(&value)?)),
            None => Ok(None),
        }
    }

    /// Replace the data.
    pub fn set_data(&mut self, data: &JsonValue) -> FormResult<()> {
        self.form.set_data(&enter("data", data)?)
    }

    /// Set the value at a data path.
    pub fn set_value(&mut self, path: &str, value: &JsonValue) -> FormResult<()> {
        self.form.set_value(path, enter("value", value)?)
    }

    /// Add a row (CURT-004).
    pub fn add_row(&mut self, path: &str, options: &AddRowOptions) -> FormResult<String> {
        let value = match &options.value {
            Some(value) => Some(enter("options.value", value)?),
            None => None,
        };
        self.form.add_row(
            path,
            crate::AddRowOptions {
                key: options.key.clone(),
                after_key: options.after_key.clone(),
                value,
            },
        )
    }

    /// Copy a row (CURT-005).
    pub fn copy_row(
        &mut self,
        path: &str,
        key: &str,
        options: crate::CopyRowOptions,
    ) -> FormResult<String> {
        self.form.copy_row(path, key, options)
    }

    /// Remove a row.
    pub fn remove_row(&mut self, path: &str, key: &str) -> FormResult<()> {
        self.form.remove_row(path, key)
    }

    /// Move a row.
    pub fn move_row(&mut self, path: &str, key: &str, index: i64) -> FormResult<()> {
        self.form.move_row(path, key, index)
    }

    /// Change a row key.
    pub fn rekey_row(&mut self, path: &str, old_key: &str, new_key: &str) -> FormResult<()> {
        self.form.rekey_row(path, old_key, new_key)
    }

    /// Expand or collapse a row.
    pub fn toggle_row(&mut self, path: &str, key: &str) -> FormResult<()> {
        self.form.toggle_row(path, key)
    }

    /// Expand or collapse every row.
    pub fn set_all_expanded(&mut self, expanded: bool) -> FormResult<()> {
        self.form.set_all_expanded(expanded)
    }

    /// Undo the last data change.
    pub fn undo(&mut self) -> FormResult<()> {
        self.form.undo()
    }

    /// Redo the last undone change.
    pub fn redo(&mut self) -> FormResult<()> {
        self.form.redo()
    }

    /// Whether undo has a record.
    pub fn can_undo(&self) -> bool {
        self.form.can_undo()
    }

    /// Whether redo has a record.
    pub fn can_redo(&self) -> bool {
        self.form.can_redo()
    }
}

/// [`crate::run_action`] at the boundary.
pub fn run_action(form: &mut Form, target: &ActionTarget) -> FormResult<Option<ActionResult>> {
    crate::run_action(&mut form.form, target)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(text: &str) -> JsonValue {
        polyspec_json::parse(text.as_bytes(), &polyspec_json::ParseOptions::default()).unwrap()
    }

    /// A loader of one file, which fails when `fail` is set.
    struct OneFile {
        fail: bool,
    }

    impl FileLoader for OneFile {
        fn normalize(
            &mut self,
            path: &str,
            basepath: &str,
        ) -> Result<String, Failure<ValidateError>> {
            Ok(format!("{basepath}/{path}"))
        }

        fn load(&mut self, key: &str) -> Result<JsonValue, Failure<ValidateError>> {
            if self.fail {
                return Err(Failure::Callback(format!("no {key}").into()));
            }
            if key.ends_with("Columns.yml") {
                return Ok(json(
                    r#"{"properties":{"name":{"field":"name","label":"Name"}}}"#,
                ));
            }
            Ok(json(r#"{"properties":{"name":{"type":"text"}}}"#))
        }
    }

    /// U-2 of binding: an option that the options leave out is the constant that the interface contract names in
    /// `default_core`, so a list without a language is the list in `ko` and a form without a base path is the form
    /// with the empty one.
    #[test]
    fn a_left_out_option_is_its_default_constant() {
        assert_eq!(DEFAULT_BASEPATH, "");
        assert_eq!(DEFAULT_LANGUAGE, "ko");
        let list =
            json(r#"{"columns":{"name":{"field":"name","label":{"ko":"이름","en":"Name"}}}}"#);
        let rows = [json(r#"{"name":"x"}"#)];
        let explicit = ListOptions {
            basepath: Some(DEFAULT_BASEPATH.to_owned()),
            language: Some(DEFAULT_LANGUAGE.to_owned()),
            ..ListOptions::default()
        };
        let left_out = render_list(&list, &rows, &ListOptions::default()).unwrap();
        assert_eq!(left_out, render_list(&list, &rows, &explicit).unwrap());
        assert!(left_out.contains("이름"));
        let english = ListOptions {
            language: Some("en".to_owned()),
            ..ListOptions::default()
        };
        assert!(render_list(&list, &rows, &english)
            .unwrap()
            .contains("Name"));
        let spec = json(r#"{"type":"group","properties":{"name":{"type":"text"}}}"#);
        let explicit = CompileOptions {
            basepath: Some(DEFAULT_BASEPATH.to_owned()),
            ..CompileOptions::default()
        };
        assert_eq!(
            serde_json::to_string(&compile_form(&spec, &CompileOptions::default()).unwrap())
                .unwrap(),
            serde_json::to_string(&compile_form(&spec, &explicit).unwrap()).unwrap()
        );
    }

    /// CURP-031: the operations with a loader read its files, refuse `files` beside it and return
    /// its failure unchanged.
    #[test]
    fn a_loader_gives_the_files_of_the_operations() {
        let spec = json(r#"{"type":"group","properties":{"$ref":"Base.yml"}}"#);
        let files = json(r#"{"Base.yml":{"properties":{"name":{"type":"text"}}}}"#);
        let mut options = CompileOptions::default();
        let loaded =
            compile_form_with_loader(&spec, &mut OneFile { fail: false }, &options).unwrap();
        let mut named = OrderedMap::new();
        for (name, file) in files.members().unwrap().iter() {
            named.insert(name.string_value().unwrap(), file.clone());
        }
        options.files = named;
        let declared = compile_form(&spec, &options).unwrap();
        assert_eq!(
            serde_json::to_string(&loaded).unwrap(),
            serde_json::to_string(&declared).unwrap()
        );
        let Err(Failure::Kind(error)) =
            compile_form_with_loader(&spec, &mut OneFile { fail: false }, &options)
        else {
            panic!("files with a loader");
        };
        assert_eq!(error.message, FILES_WITH_LOADER_MESSAGE);
        let Err(Failure::Callback(error)) = compile_form_with_loader(
            &spec,
            &mut OneFile { fail: true },
            &CompileOptions::default(),
        ) else {
            panic!("the loader failed");
        };
        assert_eq!(error.to_string(), "no /Base.yml");
        let list = json(r#"{"columns":{"$ref":"Columns.yml"}}"#);
        let html = render_list_with_loader(
            &list,
            &[json(r#"{"name":"x"}"#)],
            &mut OneFile { fail: false },
            &ListOptions::default(),
        )
        .unwrap();
        assert!(html.contains("Name"));
        let detail = json(r#"{"fields":{"$ref":"Columns.yml"}}"#);
        let built = build_detail_with_loader(
            &detail,
            &json(r#"{"name":"x"}"#),
            &mut OneFile { fail: false },
            &ListOptions::default(),
        )
        .unwrap();
        assert!(built.raw().contains("Name"));
        let Err(Failure::Callback(_)) = render_detail_with_loader(
            &detail,
            &json("{}"),
            &mut OneFile { fail: true },
            &ListOptions::default(),
        ) else {
            panic!("the loader failed");
        };
    }

    /// CURP-032, CURP-033: a file that the loader reports as missing is the failure of the operation, whose code
    /// `FormError::code` gives.
    #[test]
    fn a_missing_file_of_a_loader_is_the_failure_of_the_operation() {
        use crate::FormErrorCode;
        use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};
        struct Missing;
        impl FileLoader for Missing {
            fn normalize(
                &mut self,
                path: &str,
                _basepath: &str,
            ) -> Result<String, Failure<ValidateError>> {
                Ok(path.to_owned())
            }

            fn load(&mut self, _key: &str) -> Result<JsonValue, Failure<ValidateError>> {
                Err(Failure::Kind(ValidateError::Load(
                    ComposeLoadError::with_trace(
                        ComposeErrorCode::RefFileNotFound,
                        "the text of the loader",
                        Vec::new(),
                    ),
                )))
            }
        }
        let spec = json(r#"{"type":"group","properties":{"$ref":"Base.yml"}}"#);
        let Err(Failure::Kind(error)) =
            compile_form_with_loader(&spec, &mut Missing, &CompileOptions::default())
        else {
            panic!("the file is missing");
        };
        assert!(matches!(
            error.code(),
            FormErrorCode::Compose(ComposeErrorCode::RefFileNotFound)
        ));
        assert_eq!(error.message, "$ref file not found: Base.yml");
        assert_eq!(error.trace, ["Base.yml"]);
        assert_eq!(binding_core::Kinds::kind(&error), "ref_file_not_found");
    }

    /// CURP-030: the boundary renders the instance that the crate renders, and data leaves with its
    /// members in order and its numbers as ECMAScript doubles.
    #[test]
    fn the_boundary_runs_the_operations_of_the_crate() {
        let spec = r#"{"type":"group","properties":{"b":{"type":"text"},"a":{"type":"number"}}}"#;
        let data = r#"{"b":"x","a":9007199254740993}"#;
        let template = compile_form(&json(spec), &CompileOptions::default()).unwrap();
        let form = Form::new(&template, &json(data), &BindOptions::default()).unwrap();
        let core_template = crate::compile_form(
            &serde_json::from_str(spec).unwrap(),
            &crate::CompileOptions::default(),
        )
        .unwrap();
        let core_form = crate::Form::new(
            core_template,
            &serde_json::from_str(data).unwrap(),
            crate::BindOptions::default(),
        )
        .unwrap();
        assert_eq!(
            render_form(&form, None).unwrap(),
            crate::render_form(&core_form, None).unwrap()
        );
        assert_eq!(
            form.get_data().unwrap().raw(),
            r#"{"b":"x","a":9007199254740992}"#
        );
        assert!(form.get_value("missing").unwrap().is_none());
    }

    /// CUIT-027: invalid text of an argument fails with its name.
    #[test]
    fn invalid_text_fails_with_its_argument() {
        let template = compile_form(
            &json(r#"{"type":"group","properties":{"name":{"type":"text"}}}"#),
            &CompileOptions::default(),
        )
        .unwrap();
        let error = bind_form(
            &template,
            &json(r#"{"name":"\ud800"}"#),
            &BindOptions::default(),
        )
        .unwrap_err();
        assert_eq!(
            error.message,
            "Text must be Unicode scalar values: data.name"
        );
    }
}
