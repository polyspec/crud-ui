use crate::choice_list::{
    check_choice_appearance, choice_pairs, is_choice_list, with_group_choices, CHOICE_LIST_EXPECTED,
};
use crate::design::resolve_design;
use crate::messages::{form_messages, format_count, Messages};
use crate::template::member_ordered_template;
use crate::util::OrNoList;
use crate::util::OrNoText;
use crate::util::*;
use crate::widget::{declared_attributes, evaluate_widget, widget_kind, WidgetContext};
use crate::{FieldTemplate, FormError, FormResult, FormTemplate};
use polyspec_crudui_validator::validate::group_source::is_group_source;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

/// Per-instance input names, content language and presentation.
///
/// Every option is kept as decoded JSON so that a value of the wrong type is rejected
/// by binding, not by decoding. Null means the default.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BindOptions {
    /// Stable DOM identifier prefix, `crudui` by default.
    pub id_prefix: Value,
    /// Content and interface language: `ko` (default), `en`, `ja` or `zh`.
    pub language: Value,
    /// Input prefix overriding the template prefix.
    pub key_prefix: Value,
    /// Unsupported field handling: `throw` (default) or `marker`.
    pub unsupported: Value,
    /// Row paths `{collection}.{key}` rendered collapsed, a list of strings; null renders every row expanded.
    pub collapsed: Value,
}
impl Default for BindOptions {
    fn default() -> Self {
        Self {
            id_prefix: "crudui".into(),
            language: "ko".into(),
            key_prefix: Value::Null,
            unsupported: "throw".into(),
            collapsed: Value::Null,
        }
    }
}

/// A present string option, or `None` for null.
fn string_option<'a>(value: &'a Value, error: &str) -> FormResult<Option<&'a str>> {
    match value {
        Value::Null => Ok(None),
        Value::String(text) => Ok(Some(text)),
        _ => Err(FormError::input(error)),
    }
}

struct Binding<'a> {
    data: &'a Value,
    /// The row paths rendered collapsed.
    collapsed: Vec<&'a str>,
    id_prefix: &'a str,
    key_prefix: Option<&'a str>,
    unsupported: &'a str,
    language: &'a str,
    messages: &'static Messages,
}

/// Enclosing repeated rows of a node.
#[derive(Clone, Default)]
struct Scope {
    /// Repeated path segment positions, independent of their key encoding.
    row_segments: Vec<usize>,
    /// One-based positions of the enclosing rows.
    row_numbers: Vec<usize>,
    /// Number of enclosing rows with a sticky header.
    sticky_depth: usize,
    /// Whether the enclosing groups lay their field nodes out inline.
    inline: bool,
}

/// The `design.layout` a group declares; compilation has checked the value.
fn declared_layout(spec: &Value) -> Option<&str> {
    spec["design"]["layout"].as_str()
}

/// The scope of a group's children: a declared layout replaces the inherited one, and a line
/// ends it.
fn layout_scope(scope: &Scope, layout: Option<&str>) -> Scope {
    let mut next = scope.clone();
    if let Some(layout) = layout {
        next.inline = layout == "inline";
    }
    next
}

/// Evaluate the node grammar using a compiled template and independent record data.
/// The template specification is read in member order; the data keeps its own order.
pub fn bind_form(
    template: &FormTemplate,
    data: &Value,
    options: &BindOptions,
) -> FormResult<Vec<Value>> {
    bind_ordered(&member_ordered_template(template), data, options)
}

/// Evaluate the template's form buttons for a record.
///
/// Each button is an ordered JSON object `type, tag, text, attrs`; `attrs` keeps the
/// output order type, class, style, name, value, href, onclick. Text is the declared
/// content or the interface text of the button type in `options.language`; only the
/// language option applies.
pub fn bind_buttons(
    template: &FormTemplate,
    data: &Value,
    options: &BindOptions,
) -> FormResult<Vec<Value>> {
    let language = bindable_language(template, data, options)?;
    let messages = form_messages(language)?;
    let members = member_ordered_template(template);
    let declared = &members.buttons;
    for button in declared {
        let kind = button.get("type").and_then(Value::as_str).or_no_text();
        if !matches!(kind, "submit" | "reset" | "button" | "link") {
            return Err(FormError::input(format!("Invalid button type: {kind}")));
        }
    }
    Ok(crate::buttons::button_models(
        declared, data, language, messages,
    ))
}

/// Markup of buttons evaluated by [`bind_buttons`], identical to the form footer buttons.
///
/// Every button must be an object with tag `a` or `button`, string text and `attrs`
/// whose names are type, class, style, name, value, href or onclick and whose values are
/// strings; anything else is an input error.
pub fn form_buttons_html(buttons: &Value) -> FormResult<String> {
    let list = buttons
        .as_array()
        .ok_or_else(|| FormError::input("Form buttons must be a list"))?;
    crate::buttons::buttons_markup(list)
}

/// The language of a binding, once the record is an object and the template a form template.
fn bindable_language<'a>(
    template: &FormTemplate,
    data: &Value,
    options: &'a BindOptions,
) -> FormResult<&'a str> {
    if !data.is_object() {
        return Err(FormError::input("Form data must be an object"));
    }
    if template.kind != "crudui/form-template" {
        return Err(FormError::input("Unsupported form template"));
    }
    #[allow(
        clippy::disallowed_methods,
        reason = "form-markup.md, interface text: an absent or null language option uses its default ko"
    )]
    let language = string_option(&options.language, "Language must be a string")?.unwrap_or("ko");
    Ok(language)
}

/// `bind_form` over a template already in specification member order.
pub(crate) fn bind_ordered(
    template: &FormTemplate,
    data: &Value,
    options: &BindOptions,
) -> FormResult<Vec<Value>> {
    let language = bindable_language(template, data, options)?;
    let key_prefix = string_option(&options.key_prefix, "keyPrefix must be a string")?;
    let id_prefix = string_option(&options.id_prefix, "idPrefix must be a string")?;
    let unsupported = match &options.unsupported {
        Value::Null => "throw",
        Value::String(mode) if mode == "throw" || mode == "marker" => mode.as_str(),
        _ => return Err(FormError::input("unsupported must be throw or marker")),
    };
    let collapsed = match &options.collapsed {
        Value::Null => Vec::new(),
        Value::Array(rows) => rows
            .iter()
            .map(|row| {
                row.as_str()
                    .ok_or_else(|| FormError::input("collapsed must be a list of row paths"))
            })
            .collect::<FormResult<Vec<_>>>()?,
        _ => return Err(FormError::input("collapsed must be a list of row paths")),
    };
    let messages = form_messages(language)?;
    let state = Binding {
        data,
        collapsed,
        id_prefix: match id_prefix {
            Some(prefix) => prefix,
            // form-runtime.md, input labels: the default `idPrefix` is crudui.
            None => "crudui",
        },
        key_prefix: key_prefix.or(template.key_prefix.as_deref()),
        unsupported,
        language,
        messages,
    };
    template
        .fields
        .iter()
        .map(|field| state.field(field, &field.name, &Scope::default()))
        .collect()
}

/// Evaluated controls and limits for a repeated field.
struct Multiple {
    /// Rows come only from the data: missing data is zero rows and no row control renders.
    only: bool,
    min: Option<f64>,
    max: Option<f64>,
    copy: bool,
    sortable: bool,
    title: Option<String>,
    controls: &'static str,
    sticky: bool,
}

fn multiple(spec: &Value) -> Option<Multiple> {
    match spec.get("multiple") {
        Some(Value::Bool(true)) => Some(Multiple {
            only: false,
            min: None,
            max: None,
            copy: false,
            sortable: false,
            title: None,
            controls: "header",
            sticky: false,
        }),
        Some(Value::String(keyword)) if keyword == "only" => Some(Multiple {
            only: true,
            min: None,
            max: None,
            copy: false,
            sortable: false,
            title: None,
            controls: "header",
            sticky: false,
        }),
        Some(Value::Object(m)) => Some(Multiple {
            only: m.get("only").is_some_and(|v| *v == true),
            min: m.get("min").and_then(Value::as_f64),
            max: m.get("max").and_then(Value::as_f64),
            copy: m.get("copy").is_some_and(|v| *v == true),
            sortable: m.get("sortable").is_some_and(|v| *v == true),
            title: m.get("title").and_then(Value::as_str).map(str::to_owned),
            controls: match m.get("controls").and_then(Value::as_str) {
                Some("footer") => "footer",
                Some("outline") => "outline",
                _ => "header",
            },
            sticky: m.get("header").is_some_and(|v| v == "sticky"),
        }),
        _ => None,
    }
}

/// Language codes, frame and title of a language field.
struct Lang<'a> {
    codes: Vec<Value>,
    frame: bool,
    title: Option<&'a Value>,
    group_class: &'a str,
}

fn lang(spec: &Value) -> Option<Lang<'_>> {
    let defaults = || ["ko", "en", "ja", "zh"].map(Value::from).to_vec();
    match spec.get("lang") {
        Some(Value::Bool(true)) => Some(Lang {
            codes: defaults(),
            frame: true,
            title: None,
            group_class: "",
        }),
        Some(Value::Object(l)) => Some(Lang {
            codes: match l
                .get("only")
                .and_then(Value::as_array)
                .filter(|codes| !codes.is_empty())
            {
                Some(codes) => codes.clone(),
                // schema.md, content translation: without `lang.only` the languages are ko, en, ja and zh.
                None => defaults(),
            },
            frame: l.get("frame").is_none_or(|v| *v != false),
            title: l.get("title"),
            group_class: l.get("group_class").and_then(Value::as_str).or_no_text(),
        }),
        _ => None,
    }
}

/// Row keys of a keyed collection. Missing data has one initial row, or none in a
/// data-only collection.
fn rows(value: Option<&Value>, path: &str, only: bool) -> FormResult<Vec<String>> {
    match value {
        None if only => Ok(Vec::new()),
        None => Ok(vec!["__0000000000000__".into()]),
        Some(Value::Object(m)) => Ok(m.keys().cloned().collect()),
        Some(_) => Err(FormError::input(format!(
            "Repeated data must be a keyed object: {path}"
        ))),
    }
}

/// Present group data, including a repeated group row, must be an object.
fn check_group(value: Option<&Value>, path: &str) -> FormResult<()> {
    match value {
        Some(value) if !value.is_object() => Err(FormError::input(format!(
            "Group data must be an object: {path}"
        ))),
        _ => Ok(()),
    }
}

fn text_at<'a>(value: &'a Value, node: &str, key: &str) -> &'a str {
    value[node][key].as_str().or_no_text()
}

fn node_root(kind: &str, path: &str, design: &Value, spec: &Value) -> Map<String, Value> {
    let mut node = Map::new();
    put_string(&mut node, "kind", kind);
    put_string(&mut node, "path", path);
    put_string(&mut node, "className", text_at(design, "wrapper", "class"));
    put_nonempty(
        &mut node,
        "style",
        style(text_at(design, "wrapper", "style")),
    );
    if let Some(attributes) = declared_attributes(spec, true) {
        node.insert("attributes".into(), attributes.into());
    }
    node.insert("hidden".into(), (design["show"] != true).into());
    node
}

/// Header with the given parts, or `None` when every part is empty.
fn node_header(parts: Vec<(&str, Option<String>)>, design: &Value) -> Option<Value> {
    let present = parts
        .into_iter()
        .filter_map(|(key, value)| value.filter(|v| !v.is_empty()).map(|v| (key, v)))
        .collect::<Vec<_>>();
    if present.is_empty() {
        return None;
    }
    let mut header = Map::new();
    put_string(&mut header, "className", text_at(design, "label", "class"));
    put_nonempty(
        &mut header,
        "style",
        style(text_at(design, "label", "style")),
    );
    for (key, value) in present {
        put_string(&mut header, key, value);
    }
    Some(header.into())
}

fn node_body(class: &str, inline: &str, id: Option<String>) -> Value {
    let mut body = Map::new();
    put_string(&mut body, "className", class);
    put_nonempty(&mut body, "style", style(inline));
    if let Some(id) = id {
        put_nonempty(&mut body, "id", id);
    }
    body.into()
}

fn row_controls(settings: &Multiple, messages: &Messages, index: usize, count: usize) -> Value {
    let full = settings.max.is_some_and(|max| count as f64 >= max);
    let mut actions = Vec::new();
    if settings.sortable {
        actions.push(action("move-up", messages.move_up, index == 0));
        actions.push(action("move-down", messages.move_down, index + 1 == count));
    }
    actions.push(action("add-row", messages.add_row, full));
    if settings.copy {
        actions.push(action("copy-row", messages.copy_row, full));
    }
    let minimum = settings.min.is_some_and(|min| count as f64 <= min);
    actions.push(action("remove-row", messages.remove_row, minimum));
    json!({"placement": settings.controls, "label": messages.row_controls, "actions": actions})
}

fn action(name: &str, label: &str, disabled: bool) -> Value {
    json!({"name": name, "label": label, "disabled": disabled})
}

fn label_target(widget: &Value) -> Option<String> {
    if widget["unsupported"] == true {
        return None;
    }
    widget["extra"]["file"]["id"]
        .as_str()
        .or_else(|| widget["attrs"]["id"].as_str())
        .map(str::to_owned)
}

impl Binding<'_> {
    fn widget(
        &self,
        declared: &Value,
        path: &str,
        design: &Value,
        row_segments: &[usize],
    ) -> FormResult<Value> {
        // A group source lists the rows of its group in the data as its choice list.
        let grouped = is_group_source(&declared["items"])
            .then(|| with_group_choices(declared, self.data, path))
            .transpose()?;
        let spec = match grouped.as_ref() {
            Some(grouped) => grouped,
            None => declared,
        };
        let field_type = spec["type"].as_str().or_no_text().to_lowercase();
        if is_choice_list(&spec["items"]) {
            // Only the choices of a choice or multichoice field declare their appearance, and
            // only the choice list of a select field has groups.
            let appearance = matches!(widget_kind(&field_type), Some("choice" | "multichoice"));
            let groups = widget_kind(&field_type) == Some("select");
            if choice_pairs(&spec["items"], appearance, groups).is_none() {
                return Err(FormError::input(format!(
                    "Invalid items at {path}: expected {CHOICE_LIST_EXPECTED}"
                )));
            }
            if appearance {
                check_choice_appearance(&spec["items"], path)?;
            }
        }
        let id = control_id(self.id_prefix, path);
        let context = WidgetContext {
            spec,
            value: value_at(self.data, path),
            path,
            design,
            key_prefix: self.key_prefix,
            id: &id,
            language: self.language,
            row_segments,
        };
        let kind = spec["type"].as_str().or_no_text();
        match evaluate_widget(kind, &context) {
            Some(widget) => Ok(widget),
            None if self.unsupported == "marker" => Ok(json!({"unsupported": true, "type": kind})),
            None => Err(FormError {
                code: "UNSUPPORTED_FIELD_TYPE".into(),
                message: format!("Unsupported field type \"{kind}\" at \"{path}\""),
                at: path.into(),
                trace: Vec::new(),
            }),
        }
    }

    fn children(
        &self,
        fields: &[FieldTemplate],
        path: &str,
        scope: &Scope,
    ) -> FormResult<Vec<Value>> {
        fields
            .iter()
            .map(|field| self.field(field, &format!("{path}.{}", field.name), scope))
            .collect()
    }

    /// Build the node for one composed field.
    fn field(&self, field: &FieldTemplate, path: &str, scope: &Scope) -> FormResult<Value> {
        let spec = Value::Object(field.spec.clone());
        let design = resolve_design(spec.get("design"), self.data, path, &scope.row_segments);
        let language = self.language;
        let label = spec
            .get("label")
            .filter(|v| polyspec_crudui_validator::expr::is_truthy(v))
            .map(|v| translate(Some(v), language))
            .filter(|v| !v.is_empty());
        let description = Some(translate(spec.get("description"), language));
        if let Some(settings) = multiple(&spec) {
            return self.collection(
                field,
                &spec,
                path,
                &design,
                label,
                description,
                &settings,
                scope,
            );
        }
        if spec["type"] == "group" {
            check_group(value_at(self.data, path), path)?;
            let layout = declared_layout(&spec);
            let mut node = node_root("group", path, &design, &spec);
            // A line group is one row in an inline layout, and its children take no inline layout.
            if layout == Some("line") {
                let class_name = join_class(&[
                    if scope.inline {
                        "crudui-node--inline"
                    } else {
                        ""
                    },
                    "crudui-node--line",
                    text_at(&design, "wrapper", "class"),
                ]);
                put_string(&mut node, "className", class_name);
            }
            if let Some(header) = node_header(
                vec![("label", label), ("description", description)],
                &design,
            ) {
                node.insert("header".into(), header);
            }
            node.insert(
                "body".into(),
                node_body(
                    text_at(&design, "group", "class"),
                    text_at(&design, "group", "style"),
                    None,
                ),
            );
            node.insert(
                "children".into(),
                self.children(&field.children, path, &layout_scope(scope, layout))?
                    .into(),
            );
            return Ok(node.into());
        }
        if let Some(settings) = lang(&spec) {
            return self.lang(&spec, path, &design, label, description, &settings, scope);
        }
        self.leaf(&spec, path, &design, label, description, scope)
    }

    fn leaf(
        &self,
        spec: &Value,
        path: &str,
        design: &Value,
        label: Option<String>,
        description: Option<String>,
        scope: &Scope,
    ) -> FormResult<Value> {
        let kind = spec["type"].as_str().or_no_text();
        let mut node = node_root("field", path, design, spec);
        // A field node of an inline layout is one row of a label column and a control column.
        if scope.inline {
            let class_name =
                join_class(&["crudui-node--inline", text_at(design, "wrapper", "class")]);
            put_string(&mut node, "className", class_name);
        }
        if kind == "checkbox" || kind == "switcher" {
            let id = control_id(self.id_prefix, path);
            // An inline layout writes the label in the label column of the header instead of the caption.
            let header_label = label.clone().filter(|_| scope.inline);
            let parts = match &header_label {
                Some(label) => vec![
                    ("label", Some(label.clone())),
                    ("labelFor", Some(id.clone())),
                    ("description", description),
                ],
                None => vec![("description", description)],
            };
            if let Some(header) = node_header(parts, design) {
                node.insert("header".into(), header);
            }
            node.insert("body".into(), node_body("", "", None));
            let on = |v: &Value| v.as_f64() == Some(1.0) || *v == true || *v == "1";
            let checked = match value_at(self.data, path) {
                Some(value) => on(value),
                None => spec.get("default").is_some_and(on),
            };
            // A switcher is a checkbox input announced and drawn as a switch.
            let switcher = kind == "switcher";
            let mut checkbox = json!({
                "id": id,
                "name": bracket(path, self.key_prefix),
                "className": join_class(&[
                    "valid-target",
                    if switcher { "crudui-input crudui-input--switch" } else { "" },
                    text_at(design, "main", "class"),
                ]),
                "checked": checked,
            });
            if switcher {
                checkbox["role"] = "switch".into();
            }
            if header_label.is_none() {
                // A checkbox without a label has an empty caption.
                checkbox["caption"] = match label {
                    Some(label) => label.into(),
                    None => "".into(),
                };
            }
            if let Some(attributes) = declared_attributes(spec, false) {
                checkbox["attributes"] = attributes.into();
            }
            node.insert("checkbox".into(), checkbox);
            return Ok(node.into());
        }
        let widget = self.widget(spec, path, design, &scope.row_segments)?;
        if kind != "hidden" {
            let label_for = label.as_ref().and_then(|_| label_target(&widget));
            let parts = vec![
                ("label", label),
                ("labelFor", label_for),
                ("description", description),
            ];
            if let Some(header) = node_header(parts, design) {
                node.insert("header".into(), header);
            }
        }
        node.insert("body".into(), node_body("", "", None));
        node.insert("widget".into(), widget);
        Ok(node.into())
    }

    #[allow(
        clippy::too_many_arguments,
        reason = "the binding step takes the shared inputs"
    )]
    fn collection(
        &self,
        field: &FieldTemplate,
        spec: &Value,
        path: &str,
        design: &Value,
        label: Option<String>,
        description: Option<String>,
        settings: &Multiple,
        scope: &Scope,
    ) -> FormResult<Value> {
        let keys = rows(value_at(self.data, path), path, settings.only)?;
        let item = if spec["type"] == "group" {
            "group"
        } else {
            "field"
        };
        let full = settings.max.is_some_and(|max| keys.len() as f64 >= max);
        let rows_scope = if item == "group" {
            layout_scope(scope, declared_layout(spec))
        } else {
            scope.clone()
        };
        let children = keys
            .iter()
            .enumerate()
            .map(|(index, key)| {
                self.row(
                    field,
                    spec,
                    path,
                    key,
                    index,
                    keys.len(),
                    &label,
                    settings,
                    &rows_scope,
                )
            })
            .collect::<FormResult<Vec<_>>>()?;
        let count = Some(format_count(self.messages.count, keys.len()));
        let mut node = node_root("collection", path, design, spec);
        if let Some(header) = node_header(
            vec![
                ("label", label),
                ("description", description),
                ("count", count),
            ],
            design,
        ) {
            node.insert("header".into(), header);
        }
        node.insert("body".into(), node_body("", "", None));
        put_string(&mut node, "item", item);
        if keys.is_empty() && !settings.only {
            node.insert(
                "controls".into(),
                json!({
                    "placement": "footer",
                    "label": self.messages.collection_controls,
                    "actions": [action("add-row", self.messages.add_row, full)],
                }),
            );
        }
        node.insert("children".into(), children.into());
        Ok(node.into())
    }

    #[allow(
        clippy::too_many_arguments,
        reason = "the binding step takes the shared inputs"
    )]
    fn row(
        &self,
        field: &FieldTemplate,
        spec: &Value,
        collection: &str,
        key: &str,
        index: usize,
        count: usize,
        label: &Option<String>,
        settings: &Multiple,
        scope: &Scope,
    ) -> FormResult<Value> {
        let messages = self.messages;
        let row_path = format!("{collection}.{key}");
        let mut inner = scope.clone();
        inner.row_segments.push(segments(collection).len());
        let design = resolve_design(
            spec.get("design"),
            self.data,
            &row_path,
            &inner.row_segments,
        );
        inner.row_numbers.push(index + 1);
        inner.sticky_depth += usize::from(settings.sticky);
        let mut row = Map::new();
        put_string(&mut row, "kind", "row");
        put_string(&mut row, "key", key);
        put_string(&mut row, "className", "");
        row.insert("hidden".into(), false.into());
        // Rows of a data-only collection have no row controls.
        if !settings.only {
            row.insert(
                "controls".into(),
                row_controls(settings, messages, index, count),
            );
        }
        if settings.sticky {
            row.insert("sticky".into(), true.into());
            row.insert("stickyDepth".into(), scope.sticky_depth.into());
        }
        let mut header = Map::new();
        put_string(&mut header, "className", "");
        if let Some(label) = label {
            put_string(&mut header, "label", label.as_str());
        }
        let number = inner
            .row_numbers
            .iter()
            .map(usize::to_string)
            .collect::<Vec<_>>();
        put_string(&mut header, "number", number.join("."));
        if spec["type"] != "group" {
            row.insert("header".into(), header.into());
            row.insert("body".into(), node_body("", "", None));
            row.insert(
                "widget".into(),
                self.widget(spec, &row_path, &design, &inner.row_segments)?,
            );
            return Ok(row.into());
        }
        check_group(value_at(self.data, &row_path), &row_path)?;
        let children = self.children(&field.children, &row_path, &inner)?;
        let nested = children
            .iter()
            .filter(|child| child["kind"] == "collection")
            .collect::<Vec<_>>();
        let summary = if nested.is_empty() {
            messages.collapsed.to_owned()
        } else {
            let total = nested
                .iter()
                .map(|child| child["children"].as_array().or_no_list().len())
                .sum();
            format_count(messages.children, total)
        };
        if let Some(title) = &settings.title {
            let title = match value_at(self.data, &format!("{row_path}.{title}")) {
                None | Some(Value::Null) => messages.untitled.to_owned(),
                Some(Value::String(text)) if text.is_empty() => messages.untitled.to_owned(),
                Some(value) => js_string(value),
            };
            put_string(&mut header, "title", title);
        }
        put_string(&mut header, "summary", summary);
        row.insert("header".into(), header.into());
        let body_id = format!("{}:body", control_id(self.id_prefix, &row_path));
        row.insert(
            "body".into(),
            node_body(
                text_at(&design, "group", "class"),
                text_at(&design, "group", "style"),
                Some(body_id),
            ),
        );
        row.insert("collapsible".into(), true.into());
        row.insert(
            "expanded".into(),
            (!self.collapsed.contains(&row_path.as_str())).into(),
        );
        put_string(&mut row, "toggleLabel", messages.toggle_row);
        row.insert("children".into(), children.into());
        Ok(row.into())
    }

    #[allow(
        clippy::too_many_arguments,
        reason = "the binding step takes the shared inputs"
    )]
    fn lang(
        &self,
        spec: &Value,
        path: &str,
        design: &Value,
        label: Option<String>,
        description: Option<String>,
        settings: &Lang<'_>,
        scope: &Scope,
    ) -> FormResult<Value> {
        let title = Some(translate(settings.title, self.language));
        let mut node = node_root("lang", path, design, spec);
        if let Some(header) = node_header(
            vec![
                ("label", label),
                ("description", description),
                ("title", title),
            ],
            design,
        ) {
            node.insert("header".into(), header);
        }
        // A framed language group is a node modifier; the stylesheet draws the frame around its body.
        let frame = if settings.frame {
            "crudui-node--framed"
        } else {
            ""
        };
        let class_name = join_class(&[frame, text_at(design, "wrapper", "class")]);
        put_string(&mut node, "className", class_name);
        node.insert(
            "body".into(),
            node_body(&join_class(&[settings.group_class]), "", None),
        );
        let children = settings
            .codes
            .iter()
            .map(|code| {
                let lang_path = format!("{path}.{}", js_string(code));
                let lang_design = resolve_design(
                    spec.get("design"),
                    self.data,
                    &lang_path,
                    &scope.row_segments,
                );
                Ok(json!({
                    "kind": "lang-item",
                    "lang": code,
                    "className": "",
                    "hidden": false,
                    "header": {"className": "", "label": code},
                    "body": node_body("", "", None),
                    "widget": self.widget(spec, &lang_path, &lang_design, &scope.row_segments)?,
                }))
            })
            .collect::<FormResult<Vec<_>>>()?;
        node.insert("children".into(), children.into());
        Ok(node.into())
    }
}
