//! References (validation rules, "References").
//!
//! A `reference` parameter is the declaration path of a field: its property names from the
//! root joined with `.`, without row keys. The ids of the path are the values of that field in
//! the data, read in every row of every repeated field on the path, and a value passes when it
//! is a member of them as for `in`.

use serde_json::{Map, Value};

use super::membership::Comparable;
use super::validator::is_multiple;
use super::whitespace::trim;

/// The message of a `reference` parameter outside its definition.
pub(crate) const REFERENCE_PARAMETER_MESSAGE: &str =
    "Invalid reference parameter: expected the declaration path of a field";

/// Whether `path` is the declaration path of a field of the form whose type is not `group` and
/// whose `lang` is absent, `false` or `null` (CUVR-074).
pub(crate) fn is_reference_target(properties: &Map<String, Value>, path: &str) -> bool {
    let mut fields = Some(properties);
    let mut field: Option<&Map<String, Value>> = None;
    for name in path.split('.') {
        let Some(next) = fields
            .and_then(|map| map.get(name))
            .and_then(Value::as_object)
        else {
            return false;
        };
        field = Some(next);
        fields = if next.get("type").and_then(Value::as_str) == Some("group") {
            next.get("properties").and_then(Value::as_object)
        } else {
            None
        };
    }
    let Some(field) = field else {
        return false;
    };
    if field.get("type").and_then(Value::as_str) == Some("group") {
        return false;
    }
    matches!(
        field.get("lang"),
        None | Some(Value::Null) | Some(Value::Bool(false))
    )
}

/// The member of an id: a string, a number or a boolean whose canonical text is not empty after
/// trimming (CUVR-072); `None` for any other value, which is no id.
fn id_of(value: &Value) -> Option<Comparable> {
    match value {
        Value::String(_) | Value::Number(_) | Value::Bool(_) => {
            Comparable::of_scalar(value).filter(|id| !trim(id.text()).is_empty())
        }
        _ => None,
    }
}

/// The values a field has in its data: each row of a repeated field, or the value itself.
fn values_of<'a>(field: &Value, value: &'a Value) -> Vec<&'a Value> {
    if !is_multiple(field) {
        return vec![value];
    }
    // CURT-003: repeated data that is no keyed object fails the shape check, so it holds no id.
    match value.as_object() {
        Some(rows) => rows.values().collect(),
        None => Vec::new(),
    }
}

fn collect(
    fields: &Map<String, Value>,
    value: &Value,
    segments: &[&str],
    ids: &mut Vec<Comparable>,
) {
    let Some((name, rest)) = segments.split_first() else {
        return;
    };
    let (Some(field), Some(item)) = (
        fields.get(*name).filter(|field| field.is_object()),
        value.as_object().and_then(|object| object.get(*name)),
    ) else {
        return;
    };
    for element in values_of(field, item) {
        if rest.is_empty() {
            ids.extend(id_of(element));
        } else if let Some(children) = field.get("properties").and_then(Value::as_object) {
            collect(children, element, rest, ids);
        }
    }
}

/// The ids of the declaration path `path` in `data` (CUVR-072) as members. Data of another shape
/// at a step and a missing value hold no ids.
pub(crate) fn reference_ids(
    properties: &Map<String, Value>,
    data: &Value,
    path: &str,
) -> Vec<Comparable> {
    let segments: Vec<&str> = path.split('.').collect();
    let mut ids = Vec::new();
    collect(properties, data, &segments, &mut ids);
    ids
}
