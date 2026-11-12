//! Render options of a complete form (form-runtime.md, "Complete form"): the form element, the
//! hidden fields, form errors and node errors.

use crate::util::OrNoText;
use std::collections::HashMap;

use serde_json::{Map, Value};

use crate::error::{FormError, FormResult};

/// Error texts of the nodes that have errors, by node address within one render.
pub(crate) type NodeErrors = HashMap<*const Value, Vec<String>>;

/// Checked render options as the renderer writes them.
#[derive(Default)]
pub(crate) struct RenderModel {
    /// Form element attributes in the order React writes them; `None` without `action`.
    pub(crate) form: Option<Map<String, Value>>,
    /// Hidden inputs as name and value pairs in member order.
    pub(crate) hidden: Vec<(String, String)>,
    /// Errors of the whole form.
    pub(crate) form_errors: Vec<String>,
    /// Error texts of each node that has errors.
    pub(crate) node_errors: NodeErrors,
}

const MEMBERS: [&str; 4] = ["action", "hidden", "formErrors", "errors"];
const ACTION_MEMBERS: [&str; 3] = ["method", "url", "enctype"];

fn failure(message: impl Into<String>) -> FormError {
    FormError::input(message)
}

/// Whether every member is a string and, with `allowed`, has an allowed name.
fn string_members(object: &Map<String, Value>, allowed: Option<&[&str]>) -> bool {
    object.iter().all(|(key, value)| {
        value.is_string() && allowed.is_none_or(|names| names.contains(&key.as_str()))
    })
}

/// Every node with a data path, by that path: a row's path is its collection path, `.` and its
/// key; a lang-item has no path.
fn nodes_by_path<'a>(
    nodes: &'a [Value],
    parent: Option<&str>,
    out: &mut HashMap<String, &'a Value>,
) {
    for node in nodes {
        let path = match node["kind"].as_str() {
            Some("row") => Some(format!(
                "{}.{}",
                parent.or_no_text(),
                node["key"].as_str().or_no_text()
            )),
            Some("lang-item") => None,
            _ => node["path"].as_str().map(str::to_string),
        };
        if let Some(path) = &path {
            out.insert(path.clone(), node);
        }
        if let Some(children) = node["children"].as_array() {
            nodes_by_path(children, path.as_deref(), out);
        }
    }
}

/// Check render options and build the model the renderer writes; `None` is empty options.
/// Returns the first option outside the contract, in the documented order.
pub(crate) fn render_model(
    fields: &[Value],
    template_action: Option<&Map<String, Value>>,
    options: Option<&Value>,
) -> FormResult<RenderModel> {
    let mut model = RenderModel::default();
    let Some(options) = options else {
        return Ok(model);
    };
    let Some(options) = options.as_object() else {
        return Err(failure("Render options must be an object"));
    };
    if let Some(name) = options
        .keys()
        .find(|name| !MEMBERS.contains(&name.as_str()))
    {
        return Err(failure(format!("Unknown render option: {name}")));
    }
    let action = options.get("action");
    if action.is_some_and(|action| {
        !action
            .as_object()
            .is_some_and(|action| string_members(action, Some(&ACTION_MEMBERS)))
    }) {
        return Err(failure(
            "action must be an object with string method, url and enctype",
        ));
    }
    let hidden = options.get("hidden");
    if hidden.is_some_and(|hidden| {
        !hidden
            .as_object()
            .is_some_and(|hidden| string_members(hidden, None))
    }) {
        return Err(failure("hidden must be an object of strings"));
    }
    if hidden.is_some() && action.is_none() {
        return Err(failure("hidden requires action"));
    }
    if let Some(form_errors) = options.get("formErrors") {
        let texts = form_errors
            .as_array()
            .and_then(|list| {
                list.iter()
                    .map(|text| text.as_str().map(str::to_string))
                    .collect::<Option<Vec<_>>>()
            })
            .ok_or_else(|| failure("formErrors must be a list of strings"))?;
        model.form_errors = texts;
    }
    let mut records = Vec::new();
    if let Some(errors) = options.get("errors") {
        records = errors
            .as_array()
            .and_then(|list| {
                list.iter()
                    .map(|error| {
                        match (
                            error.as_object(),
                            error["path"].as_str(),
                            error["message"].as_str(),
                        ) {
                            (Some(_), Some(path), Some(message)) => {
                                Some((path.to_string(), message.to_string()))
                            }
                            _ => None,
                        }
                    })
                    .collect::<Option<Vec<_>>>()
            })
            .ok_or_else(|| {
                failure("errors must be a list of objects with string path and message")
            })?;
    }
    if !records.is_empty() {
        let mut by_path = HashMap::new();
        nodes_by_path(fields, None, &mut by_path);
        for (path, message) in records {
            let Some(node) = by_path.get(&path) else {
                return Err(failure(format!("Unknown error path: {path}")));
            };
            model
                .node_errors
                .entry(*node as *const Value)
                .or_default()
                .push(message);
        }
    }
    if let Some(action) = action.and_then(Value::as_object) {
        let member = |key: &str| {
            action
                .get(key)
                .or_else(|| template_action.and_then(|declared| declared.get(key)))
                .and_then(Value::as_str)
                .map(str::to_string)
        };
        let mut form = Map::new();
        if let Some(url) = member("url") {
            form.insert("action".into(), crate::render::sanitize_url(&url).into());
        }
        if let Some(enc_type) = member("enctype") {
            form.insert("encType".into(), enc_type.into());
        }
        if let Some(method) = member("method") {
            form.insert("method".into(), method.into());
        }
        model.form = Some(form);
    }
    if let Some(hidden) = hidden.and_then(Value::as_object) {
        model.hidden = hidden
            .iter()
            .map(|(name, value)| (name.clone(), value.as_str().or_no_text().to_string()))
            .collect();
    }
    Ok(model)
}
