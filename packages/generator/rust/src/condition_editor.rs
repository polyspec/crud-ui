//! The structured condition editor (docs/spec/schema.md and docs/spec/form-markup.md, Structured
//! condition editor): the model of a value that the editor shows or the named error of a value that it
//! does not show, and the compilation checks of `design.editor` and `options.fields`.

use serde_json::{json, Map, Value};

use crate::messages::Messages;
use crate::util::condition_text;
use crate::{FormError, FormResult};

/// The comparison operators that the editor offers, in their order (CUSC-073, CUSC-085).
pub(crate) const CONDITION_OPS: [&str; 8] = ["eq", "ne", "lt", "le", "gt", "ge", "in", "has"];

/// The deepest level of a condition tree; the root is level 1 (CUSC-075).
const MAX_DEPTH: usize = 32;

/// An empty value (CUVR-020): a missing value, null, a string that is empty after trimming White_Space,
/// an empty array or an empty object. `str::trim` removes exactly the White_Space code points.
pub(crate) fn is_empty_condition_value(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => true,
        Some(Value::String(text)) => text.trim().is_empty(),
        Some(Value::Array(items)) => items.is_empty(),
        Some(Value::Object(members)) => members.is_empty(),
        Some(_) => false,
    }
}

fn is_scalar(value: &Value) -> bool {
    matches!(value, Value::String(_) | Value::Bool(_)) || value.as_f64().is_some_and(f64::is_finite)
}

/// The editor node of a condition, or `None` when the editor does not show it (CUSC-086).
fn node(value: &Value, path: &str, depth: usize, judge: bool) -> Option<Value> {
    let members = value.as_object().filter(|_| depth <= MAX_DEPTH)?;
    let keys: Vec<&str> = members.keys().map(String::as_str).collect();
    if let [mode @ ("all" | "any")] = keys.as_slice() {
        let items = members[*mode].as_array()?;
        let mut nodes = Vec::with_capacity(items.len());
        for (index, item) in items.iter().enumerate() {
            nodes.push(node(
                item,
                &format!("{path}/{mode}/{index}"),
                depth + 1,
                judge,
            )?);
        }
        return Some(json!({"kind":"group","path":path,"mode":mode,"items":nodes}));
    }
    if keys == ["judge"] {
        let text = members["judge"].as_str().filter(|_| judge)?;
        return Some(json!({"kind":"judge","path":path,"text":text}));
    }
    if keys.len() == 3
        && members.contains_key("field")
        && members.contains_key("op")
        && members.contains_key("value")
    {
        let field = members["field"].as_str()?;
        let op = members["op"]
            .as_str()
            .filter(|op| CONDITION_OPS.contains(op))?;
        let operand = &members["value"];
        let valid = if op == "in" {
            operand
                .as_array()
                .is_some_and(|items| items.iter().all(is_scalar))
        } else {
            is_scalar(operand)
        };
        return valid.then(|| json!({"kind":"comparison","path":path,"field":field,"op":op,"value":condition_text(Some(operand))}));
    }
    None
}

/// The editor model of a structured condition field (CUMK-067), or its named error (CUMK-068).
pub(crate) fn condition_editor(
    value: Option<&Value>,
    id: &str,
    spec: &Value,
    path: &str,
    messages: &Messages,
) -> Value {
    let judge = spec["validate"]["conditionTree"].as_str() == Some("judge");
    let root = if is_empty_condition_value(value) {
        Some(json!({"kind":"group","path":"","mode":"all","items":[]}))
    } else {
        value.and_then(|value| node(value, "", 1, judge))
    };
    let Some(root) = root else {
        return json!({"for":id,"error":messages.condition_invalid.replacen("{path}", path, 1)});
    };
    // CUSC-084: without `options.fields` the editor offers no field names.
    let fields = match spec["options"]["fields"].as_array() {
        Some(names) => Value::Array(names.clone()),
        None => Value::Null,
    };
    let labels = json!({
        "mode": messages.condition_mode,
        "addComparison": messages.condition_add_comparison,
        "addGroup": messages.condition_add_group,
        "addJudge": messages.condition_add_judge,
        "remove": messages.condition_remove,
    });
    json!({"for":id,"judge":judge,"fields":fields,"labels":labels,"root":root})
}

/// The error of an `options.fields` that breaks its rule (CUSC-084).
pub(crate) fn fields_error(path: &str) -> FormError {
    FormError::input(format!(
        "Invalid options.fields at {path}: expected distinct field names of a structured condition editor"
    ))
}

/// Reject a `design.editor` other than `text` or `structured` (CUSC-083) and an `options.fields` outside a
/// structured editor or with names that break its rule (CUSC-084).
pub(crate) fn check_condition_editor(spec: &Map<String, Value>, path: &str) -> FormResult<()> {
    let editor = spec
        .get("design")
        .and_then(Value::as_object)
        .and_then(|design| design.get("editor"));
    // CUSC-084: a condition field without `design.editor` takes the text editor.
    let editor = match editor {
        Some(editor) => editor.as_str(),
        None => Some("text"),
    };
    if !matches!(editor, Some("text" | "structured")) {
        return Err(FormError::input(format!(
            "Invalid design.editor at {path}: expected text or structured"
        )));
    }
    let Some(fields) = spec
        .get("options")
        .and_then(Value::as_object)
        .and_then(|options| options.get("fields"))
    else {
        return Ok(());
    };
    let names: Option<Vec<&str>> = fields
        .as_array()
        .and_then(|items| items.iter().map(Value::as_str).collect());
    let valid = names.is_some_and(|names| {
        names.iter().all(|name| !name.trim().is_empty())
            && names
                .iter()
                .enumerate()
                .all(|(index, name)| !names[..index].contains(name))
    });
    if editor != Some("structured") || !valid {
        return Err(fields_error(path));
    }
    Ok(())
}
