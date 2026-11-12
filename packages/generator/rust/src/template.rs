use crate::condition_editor::{check_condition_editor, fields_error};
use crate::util::OrNoText;
use crate::{FormError, FormResult};
use polyspec_crud_ui_validator::compose::{
    compose_properties, member_ordered, member_ordered_map, ComposeOptions, FileLoader,
    MemoryLoader,
};
use polyspec_crud_ui_validator::validate::group_source::{group_source_failure, scalar_child};
use polyspec_crud_ui_validator::validate::numeric;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// One data-independent field definition.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldTemplate {
    /// Property name relative to its parent group.
    pub name: String,
    /// Composed field settings without child properties.
    pub spec: Map<String, Value>,
    /// Child field definitions, stored once for repeated groups.
    pub children: Vec<FieldTemplate>,
}

/// A JSON-serializable form structure without record data.
///
/// Reading one from JSON accepts exactly the shape `compile_form` produces; see
/// [`FormTemplate::from_json`].
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FormTemplate {
    /// Template format identifier.
    pub kind: String,
    /// Optional root prefix for input names.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_prefix: Option<String>,
    /// Top-level field definitions.
    pub fields: Vec<FieldTemplate>,
    /// Form buttons in declaration order; one submit button when the spec declares none.
    pub buttons: Vec<Map<String, Value>>,
    /// Submission target declared by the spec, kept unchanged in the template.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<Map<String, Value>>,
    /// Root description content as declared by the spec (any value, `null` included), translated
    /// when the form is rendered; `None` when the root declares no description.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<Value>,
}

impl FormTemplate {
    /// Read a template that is exactly what `compile_form` produces: an object whose only
    /// members are `kind` (`crudui/form-template`), `fields`, `buttons` (objects), an optional
    /// string `keyPrefix`, an optional object `action` and an optional `description` of any
    /// value; each field has exactly a string
    /// `name`, an object `spec` and a field list `children`. Any other value fails with
    /// `Unsupported form template`.
    pub fn from_json(value: &Value) -> FormResult<FormTemplate> {
        let shape = || FormError::input("Unsupported form template");
        let object = value.as_object().ok_or_else(shape)?;
        if !only_members(
            object,
            &[
                "kind",
                "keyPrefix",
                "fields",
                "buttons",
                "action",
                "description",
            ],
        ) || object.get("kind").and_then(Value::as_str) != Some("crudui/form-template")
        {
            return Err(shape());
        }
        let key_prefix = match object.get("keyPrefix") {
            None => None,
            Some(Value::String(prefix)) => Some(prefix.clone()),
            Some(_) => return Err(shape()),
        };
        let action = match object.get("action") {
            None => None,
            Some(Value::Object(action)) => Some(action.clone()),
            Some(_) => return Err(shape()),
        };
        let fields = field_templates(object.get("fields")).ok_or_else(shape)?;
        let buttons = object
            .get("buttons")
            .and_then(Value::as_array)
            .ok_or_else(shape)?
            .iter()
            .map(|button| button.as_object().cloned())
            .collect::<Option<Vec<_>>>()
            .ok_or_else(shape)?;
        Ok(FormTemplate {
            kind: "crudui/form-template".into(),
            key_prefix,
            fields,
            buttons,
            action,
            description: object.get("description").cloned(),
        })
    }
}

impl<'de> Deserialize<'de> for FormTemplate {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = Value::deserialize(deserializer)?;
        FormTemplate::from_json(&value).map_err(serde::de::Error::custom)
    }
}

fn only_members(object: &Map<String, Value>, allowed: &[&str]) -> bool {
    object.keys().all(|key| allowed.contains(&key.as_str()))
}

/// A field template list with exactly `name`, `spec` and `children` in every field.
fn field_templates(value: Option<&Value>) -> Option<Vec<FieldTemplate>> {
    value?
        .as_array()?
        .iter()
        .map(|field| {
            let field = field.as_object()?;
            if field.len() != 3 || !only_members(field, &["name", "spec", "children"]) {
                return None;
            }
            Some(FieldTemplate {
                name: field.get("name")?.as_str()?.to_owned(),
                spec: field.get("spec")?.as_object()?.clone(),
                children: field_templates(field.get("children"))?,
            })
        })
        .collect()
}

/// Inputs used only during structure compilation.
#[derive(Default)]
pub struct CompileOptions<'a> {
    /// Parsed documents indexed by their composition paths.
    pub files: Map<String, Value>,
    /// Optional explicit document loader.
    pub loader: Option<&'a dyn FileLoader>,
    /// Directory for resolving relative references.
    pub basepath: String,
    /// Root prefix for input names.
    pub key_prefix: Option<String>,
}

/// A string, or a condition map: a non-empty object.
fn condition_value(value: &Value) -> bool {
    value.is_string() || value.as_object().is_some_and(|map| !map.is_empty())
}

/// Allowed keys of the closed `multiple` bucket.
const MULTIPLE_KEYS: &[&str] = &[
    "only", "min", "max", "copy", "sortable", "title", "controls", "header", "onclick", "keys",
];
/// Keys `multiple` accepts beside `only: true`.
const ONLY_MULTIPLE_KEYS: &[&str] = &["only", "title", "header", "keys"];
/// Allowed keys of the closed `lang` bucket.
const LANG_KEYS: &[&str] = &[
    "mode",
    "only",
    "name",
    "key",
    "frame",
    "title",
    "group_class",
];
/// Allowed keys of the closed `design` bucket.
const DESIGN_KEYS: &[&str] = &[
    "show", "class", "style", "label", "wrapper", "group", "prepend",
];
/// Allowed keys of a closed design node.
const DESIGN_NODE_KEYS: &[&str] = &["class", "style"];
/// Allowed keys of the closed `design` bucket of a form field.
/// A condition field also declares its editor (docs/spec/schema.md, Structured condition editor).
const CONDITION_DESIGN_KEYS: &[&str] = &[
    "show",
    "class",
    "style",
    "attributes",
    "editor",
    "label",
    "wrapper",
    "group",
    "prepend",
];
const FIELD_DESIGN_KEYS: &[&str] = &[
    "show",
    "class",
    "style",
    "attributes",
    "label",
    "wrapper",
    "group",
    "prepend",
];
/// Allowed keys of the closed `design` bucket of a group field.
const GROUP_DESIGN_KEYS: &[&str] = &[
    "show",
    "class",
    "style",
    "attributes",
    "layout",
    "label",
    "wrapper",
    "group",
    "prepend",
];
/// Allowed keys of the `wrapper` design node of a form field.
const FIELD_WRAPPER_KEYS: &[&str] = &["class", "style", "attributes"];
/// Prefixes of attribute names crudui writes on a control or a node root.
const OWNED_ATTRIBUTE_PREFIXES: &[&str] = &["data-crudui-", "data-source-"];
/// Attribute names crudui writes on a control or a node root.
const OWNED_ATTRIBUTE_NAMES: &[&str] = &[
    "data-field-path",
    "data-lang",
    "data-name",
    "data-rule-name",
    "data-default",
    "data-is-default",
    "data-type",
    "data-height",
    "data-upload-server",
    "data-fileserver",
    "data-server",
    "data-max-tags",
    "data-keyword-min-length",
    "data-delay",
    "data-api-server",
    "data-max-width",
    "data-min-width",
    "data-max-height",
    "data-min-height",
    "data-preview-max-width",
    "data-preview-max-height",
    "data-unsupported-type",
];

/// Whether `name` is a `data-*` or `aria-*` name crudui does not write: lowercase letters,
/// digits, `-`, `_` and `.` after the prefix, starting with a letter or a digit.
fn declared_attribute_name(name: &str) -> bool {
    let Some(rest) = name
        .strip_prefix("data-")
        .or_else(|| name.strip_prefix("aria-"))
    else {
        return false;
    };
    let valid = !rest.is_empty()
        && rest.bytes().enumerate().all(|(index, c)| {
            c.is_ascii_lowercase()
                || c.is_ascii_digit()
                || (index > 0 && (c == b'-' || c == b'_' || c == b'.'))
        });
    valid
        && !OWNED_ATTRIBUTE_NAMES.contains(&name)
        && !OWNED_ATTRIBUTE_PREFIXES
            .iter()
            .any(|prefix| name.starts_with(prefix))
}

/// Reject declared attributes at `key` that are not an object of permitted names to strings.
/// Every name is checked before any value.
pub(crate) fn check_declared_attributes(
    attributes: &Value,
    key: &str,
    path: &str,
) -> FormResult<()> {
    let Some(attributes) = attributes.as_object() else {
        return Err(FormError::input(format!(
            "Invalid {key} at {path}: expected an object"
        )));
    };
    if let Some(name) = attributes
        .keys()
        .find(|name| !declared_attribute_name(name))
    {
        return Err(FormError::input(format!(
            "Invalid {key}.{name} at {path}: expected a data-* or aria-* name that crudui does not write"
        )));
    }
    if let Some((name, _)) = attributes.iter().find(|(_, value)| !value.is_string()) {
        return Err(FormError::input(format!(
            "Invalid {key}.{name} at {path}: expected a string"
        )));
    }
    Ok(())
}
/// Allowed keys of the closed `behavior` bucket.
const BEHAVIOR_KEYS: &[&str] = &["onchange", "onclick", "onload"];

/// Reject the first key of a closed bucket that the bucket does not allow.
pub(crate) fn check_known_keys(
    bucket: &str,
    settings: &Map<String, Value>,
    allowed: &[&str],
    path: &str,
) -> FormResult<()> {
    match settings.keys().find(|key| !allowed.contains(&key.as_str())) {
        Some(key) => Err(FormError::input(format!(
            "Invalid {bucket}.{key} at {path}: unknown key"
        ))),
        None => Ok(()),
    }
}

/// Reject an unknown key or a wrong value type in one `design` declaration at `path`. Form
/// fields, form buttons, list and detail specifications, their columns and fields share this
/// rule; only a form field (`field`) accepts `attributes` and `wrapper.attributes`, and only a
/// group field accepts `layout`, one of `layouts`.
pub(crate) fn check_design_declaration(
    design: &Value,
    path: &str,
    field: bool,
    layouts: Option<&[&str]>,
    condition: bool,
) -> FormResult<()> {
    let fail = |key: &str, expected: &str| -> FormResult<()> {
        Err(FormError::input(format!(
            "Invalid {key} at {path}: expected {expected}"
        )))
    };
    if !design.is_boolean() && !design.is_object() {
        return fail("design", "a boolean or an object");
    }
    let Some(design) = design.as_object() else {
        return Ok(());
    };
    let design_keys = if layouts.is_some() {
        GROUP_DESIGN_KEYS
    } else if condition {
        CONDITION_DESIGN_KEYS
    } else if field {
        FIELD_DESIGN_KEYS
    } else {
        DESIGN_KEYS
    };
    check_known_keys("design", design, design_keys, path)?;
    if design
        .get("show")
        .is_some_and(|v| !v.is_boolean() && !condition_value(v))
    {
        return fail("design.show", "an expression, a boolean or a condition map");
    }
    for key in ["class", "style"] {
        if design.get(key).is_some_and(|v| !condition_value(v)) {
            return fail(&format!("design.{key}"), "a string or a condition map");
        }
    }
    if let Some(attributes) = design.get("attributes") {
        check_declared_attributes(attributes, "design.attributes", path)?;
    }
    if let (Some(layouts), Some(layout)) = (layouts, design.get("layout")) {
        if !layout
            .as_str()
            .is_some_and(|layout| layouts.contains(&layout))
        {
            return fail(
                "design.layout",
                if layouts.len() == 3 {
                    "stacked, inline or line"
                } else {
                    "stacked or inline"
                },
            );
        }
    }
    for node in ["label", "wrapper", "group", "prepend"] {
        let Some(value) = design.get(node) else {
            continue;
        };
        let Some(value) = value.as_object() else {
            return fail(&format!("design.{node}"), "an object");
        };
        let node_keys = if field && node == "wrapper" {
            FIELD_WRAPPER_KEYS
        } else {
            DESIGN_NODE_KEYS
        };
        check_known_keys(&format!("design.{node}"), value, node_keys, path)?;
        for key in ["class", "style"] {
            if value.get(key).is_some_and(|v| !condition_value(v)) {
                return fail(
                    &format!("design.{node}.{key}"),
                    "a string or a condition map",
                );
            }
        }
        if let Some(attributes) = value.get("attributes") {
            check_declared_attributes(attributes, &format!("design.{node}.attributes"), path)?;
        }
    }
    Ok(())
}

/// Reject a wrong value type or an unknown key in one field's `multiple`, `lang`,
/// `design` and `behavior` declarations. Only a form field (`field`) accepts declared attributes.
fn check_declarations(spec: &Map<String, Value>, path: &str, field: bool) -> FormResult<()> {
    let fail = |key: &str, expected: &str| -> FormResult<()> {
        Err(FormError::input(format!(
            "Invalid {key} at {path}: expected {expected}"
        )))
    };
    // Buttons and the submission target belong to the form, not to a field.
    for key in ["buttons", "action"] {
        if spec.contains_key(key) {
            return fail(key, "the form root");
        }
    }
    if let Some(multiple) = spec.get("multiple") {
        if !multiple.is_boolean() && multiple != "only" && !multiple.is_object() {
            return fail("multiple", "a boolean, only or an object");
        }
        if let Some(settings) = multiple.as_object() {
            check_known_keys("multiple", settings, MULTIPLE_KEYS, path)?;
            if settings.get("only").is_some_and(|v| !v.is_boolean()) {
                return fail("multiple.only", "a boolean");
            }
            // Rows of a data-only collection come from the data: row limits and row
            // controls do not apply.
            if settings.get("only").is_some_and(|v| *v == true) {
                check_known_keys("multiple", settings, ONLY_MULTIPLE_KEYS, path)?;
            }
            // A keyed map is a data-only collection; validation resolves its reference.
            if let Some(keys) = settings.get("keys") {
                if settings.get("only").is_none_or(|v| *v != true) {
                    return fail("multiple.keys", "multiple.only: true");
                }
                if !keys.is_string() {
                    return fail("multiple.keys", "a reference to a repeated group");
                }
            }
            for key in ["min", "max"] {
                if settings.get(key).is_some_and(|v| !v.is_number()) {
                    return fail(&format!("multiple.{key}"), "a number");
                }
            }
            for key in ["copy", "sortable"] {
                if settings.get(key).is_some_and(|v| !v.is_boolean()) {
                    return fail(&format!("multiple.{key}"), "a boolean");
                }
            }
            if let Some(title) = settings.get("title") {
                if spec.get("type").is_none_or(|t| t != "group") {
                    return fail("multiple.title", "a repeated group");
                }
                let child = title.as_str().and_then(|name| {
                    spec.get("properties")
                        .and_then(Value::as_object)
                        .and_then(|properties| properties.get(name))
                });
                if !child.is_some_and(scalar_child) {
                    return fail(
                        "multiple.title",
                        "the name of a direct child field without multiple, properties or lang",
                    );
                }
            }
            if settings
                .get("controls")
                .is_some_and(|v| !["header", "footer", "outline"].iter().any(|p| v == p))
            {
                return fail("multiple.controls", "header, footer or outline");
            }
            if settings
                .get("header")
                .is_some_and(|v| !["static", "sticky"].iter().any(|p| v == p))
            {
                return fail("multiple.header", "static or sticky");
            }
        }
    }
    if spec
        .get("lang")
        .is_some_and(|v| !v.is_boolean() && !v.is_object())
    {
        return fail("lang", "a boolean or an object");
    }
    if let Some(lang) = spec.get("lang").and_then(Value::as_object) {
        check_known_keys("lang", lang, LANG_KEYS, path)?;
    }
    if let Some(only) = spec
        .get("lang")
        .and_then(Value::as_object)
        .and_then(|lang| lang.get("only"))
    {
        let codes = only
            .as_array()
            .is_some_and(|codes| codes.iter().all(Value::is_string));
        if !codes && !only.is_object() {
            return fail("lang.only", "a list of language codes or an object");
        }
    }
    if let Some(design) = spec.get("design") {
        let layouts = if field { group_layouts(spec) } else { None };
        check_design_declaration(design, path, field, layouts, field && is_condition(spec))?;
    }
    if let Some(behavior) = spec.get("behavior").and_then(Value::as_object) {
        check_known_keys("behavior", behavior, BEHAVIOR_KEYS, path)?;
    }
    if field
        && spec
            .get("type")
            .and_then(Value::as_str)
            .is_some_and(|t| t.to_lowercase() == "range")
    {
        check_range_declaration(spec, path)?;
    }
    if field && is_condition(spec) {
        check_condition_declaration(spec, path)?;
        check_condition_editor(spec, path)?;
    } else if field
        && spec
            .get("options")
            .and_then(Value::as_object)
            .is_some_and(|options| options.contains_key("fields"))
    {
        return Err(fields_error(path));
    }
    Ok(())
}

/// Whether a field declares the condition type.
fn is_condition(spec: &Map<String, Value>) -> bool {
    spec.get("type")
        .and_then(Value::as_str)
        .is_some_and(|t| t.to_lowercase() == "condition")
}

/// Reject a condition field whose `validate.conditionTree` is not the literal `true` or `judge`:
/// every value of the field is checked as a condition tree.
fn check_condition_declaration(spec: &Map<String, Value>, path: &str) -> FormResult<()> {
    let accepted = spec
        .get("validate")
        .and_then(|v| v.get("conditionTree"))
        .is_some_and(|parameter| {
            *parameter == Value::Bool(true) || parameter.as_str() == Some("judge")
        });
    if accepted {
        return Ok(());
    }
    Err(FormError::input(format!(
        "Invalid validate.conditionTree at {path}: expected true or judge"
    )))
}

/// Reject a range field without literal bounds and a literal step whose multiple the minimum
/// is: the slider moves from the minimum in steps.
fn check_range_declaration(spec: &Map<String, Value>, path: &str) -> FormResult<()> {
    let validate = spec.get("validate").filter(|v| v.is_object());
    // A rule that `validate` does not declare is null, as JSON indexing reads it.
    let rule = |key: &str| -> &Value {
        match validate {
            Some(validate) => &validate[key],
            None => &Value::Null,
        }
    };
    let Some((minimum, _)) = numeric::number_range(rule("range")) else {
        return Err(FormError::input(format!(
            "Invalid validate.range at {path}: expected [minimum, maximum] finite numbers with minimum not above maximum"
        )));
    };
    let Some(step) = numeric::step(rule("step")) else {
        return Err(FormError::input(format!(
            "Invalid validate.step at {path}: expected a finite number above 0"
        )));
    };
    if !numeric::is_multiple(minimum, step) {
        return Err(FormError::input(format!(
            "Invalid validate.range at {path}: expected a minimum that is a multiple of validate.step"
        )));
    }
    Ok(())
}

/// The `design.layout` values a group field accepts: a repeated group has no line, and a field
/// that is not a group has no layout.
fn group_layouts(spec: &Map<String, Value>) -> Option<&'static [&'static str]> {
    if spec.get("type").is_none_or(|t| t != "group") {
        return None;
    }
    let repeated = spec
        .get("multiple")
        .is_some_and(|v| *v == true || *v == "only" || v.is_object());
    Some(if repeated {
        &["stacked", "inline"]
    } else {
        &["stacked", "inline", "line"]
    })
}

/// Reject a wrong root `action` or `buttons` declaration.
fn check_form_declarations(spec: &Map<String, Value>) -> FormResult<()> {
    let fail = |key: &str, expected: &str| -> FormResult<()> {
        Err(FormError::input(format!(
            "Invalid {key} at form: expected {expected}"
        )))
    };
    if let Some(action) = spec.get("action") {
        let Some(action) = action.as_object() else {
            return fail("action", "an object");
        };
        for key in ["method", "url", "enctype"] {
            if action.get(key).is_some_and(|v| !v.is_string()) {
                return fail(&format!("action.{key}"), "a string");
            }
        }
    }
    let Some(buttons) = spec.get("buttons") else {
        return Ok(());
    };
    let Some(buttons) = buttons.as_array() else {
        return fail("buttons", "a list of buttons");
    };
    for (index, button) in buttons.iter().enumerate() {
        let key = format!("buttons.{index}");
        let Some(button) = button.as_object() else {
            return fail(&key, "an object");
        };
        let kind = button.get("type").and_then(Value::as_str).or_no_text();
        if !crate::buttons::FORM_BUTTON_TYPES.contains(&kind) {
            return fail(&format!("{key}.type"), "submit, reset, button or link");
        }
        for name in ["name", "value", "href"] {
            if button.get(name).is_some_and(|v| !v.is_string()) {
                return fail(&format!("{key}.{name}"), "a string");
            }
        }
        // A button type without interface text needs declared text.
        if crate::buttons::button_text(crate::messages::form_messages("ko")?, kind).is_empty()
            && !button.contains_key("text")
        {
            return fail(&format!("{key}.text"), "content for this button type");
        }
        if kind == "link" && !button.contains_key("href") {
            return fail(&format!("{key}.href"), "a link target");
        }
        check_declarations(button, &format!("form.{key}"), false)?;
    }
    Ok(())
}

fn fields(
    root: &Map<String, Value>,
    properties: &Map<String, Value>,
    parent: &str,
) -> FormResult<Vec<FieldTemplate>> {
    let mut out = Vec::new();
    for (name, value) in properties {
        let Some(raw) = value.as_object() else {
            continue;
        };
        let path = if parent.is_empty() {
            name.clone()
        } else {
            format!("{parent}.{name}")
        };
        check_declarations(raw, &path, true)?;
        // A group source is checked after the other declarations of the field.
        if let Some(message) = group_source_failure(value, &path, root) {
            return Err(FormError::input(message));
        }
        let mut spec = raw.clone();
        let children = match spec.shift_remove("properties") {
            Some(Value::Object(children)) => fields(root, &children, &path)?,
            _ => Vec::new(),
        };
        out.push(FieldTemplate {
            name: name.clone(),
            spec,
            children,
        });
    }
    Ok(out)
}

/// A field template whose specification maps, at every depth, are in specification member order.
fn member_ordered_field(field: &FieldTemplate) -> FieldTemplate {
    FieldTemplate {
        name: field.name.clone(),
        spec: member_ordered_map(&field.spec),
        children: field.children.iter().map(member_ordered_field).collect(),
    }
}

/// A form template whose field specifications, buttons, action and description are in
/// specification member order.
pub(crate) fn member_ordered_template(template: &FormTemplate) -> FormTemplate {
    FormTemplate {
        kind: template.kind.clone(),
        key_prefix: template.key_prefix.clone(),
        fields: template.fields.iter().map(member_ordered_field).collect(),
        buttons: template.buttons.iter().map(member_ordered_map).collect(),
        action: template.action.as_ref().map(member_ordered_map),
        description: template.description.as_ref().map(member_ordered),
    }
}

/// Compile a complete form structure before record data is available.
pub fn compile_form(spec: &Value, options: &CompileOptions<'_>) -> FormResult<FormTemplate> {
    // The specification is read in member order; composition orders every loaded document.
    let spec = &member_ordered(spec);
    let (Some(root), Some(declared)) = (spec.as_object(), spec["properties"].as_object()) else {
        return Err(FormError::input(
            "A form spec must be a group with properties",
        ));
    };
    if spec["type"] != "group" {
        return Err(FormError::input(
            "A form spec must be a group with properties",
        ));
    }
    check_form_declarations(root)?;
    // The form root takes no layout; a group field declares it.
    if spec["design"].get("layout").is_some() {
        return Err(FormError::input(
            "Invalid design.layout at form: unknown key",
        ));
    }
    let memory = MemoryLoader::new(options.files.clone());
    // Without a loader, composition reads the files of the options.
    let loader: &dyn FileLoader = match options.loader {
        Some(loader) => loader,
        None => &memory,
    };
    let properties = compose_properties(
        declared.clone(),
        loader,
        &ComposeOptions::with_basepath(&options.basepath),
    )?;
    Ok(FormTemplate {
        kind: "crudui/form-template".into(),
        key_prefix: options.key_prefix.clone(),
        fields: fields(&properties, &properties, "")?,
        buttons: match spec.get("buttons").and_then(Value::as_array) {
            Some(declared) => declared
                .iter()
                .filter_map(|b| b.as_object().cloned())
                .collect(),
            None => vec![Map::from_iter([(
                "type".to_string(),
                Value::from("submit"),
            )])],
        },
        action: spec.get("action").and_then(Value::as_object).cloned(),
        description: spec.get("description").cloned(),
    })
}

pub(crate) fn repeats(field: &FieldTemplate) -> bool {
    field
        .spec
        .get("multiple")
        .is_some_and(|v| *v == true || *v == "only" || v.is_object())
}

/// A `multiple: only` collection: its rows come only from the data.
pub(crate) fn data_only(field: &FieldTemplate) -> bool {
    field
        .spec
        .get("multiple")
        .is_some_and(|v| *v == "only" || v.get("only").is_some_and(|only| *only == true))
}
