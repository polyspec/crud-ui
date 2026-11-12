//! Keyed maps (docs/spec/schema.md and docs/spec/validation-rules.md, "Keyed maps"): a field
//! that declares `multiple.keys` holds rows only under the row keys of the repeated group that
//! the reference names.

use serde_json::{Map, Value};

use super::errors::{FormInputError, ValidateError};
use super::rules::resolve_field_reference;
use super::validator::{is_group_with_properties, is_multiple, path_to_string};

/// The declared `multiple.keys` of a field, if it declares one.
fn keyed_map_reference(field: &Value) -> Option<&Value> {
    field
        .get("multiple")
        .and_then(Value::as_object)
        .and_then(|settings| settings.get("keys"))
}

/// Whether `reference`, declared by the field at `declaration`, names a repeated group of the
/// form whose root field map is `root` (CUSC-077): it leaves as many fields of the declaration
/// path as it has leading dots (a bare name one; a path with a dot inside and no leading dot
/// starts at the root), stays within the root, has no empty name and no `*`, passes only through
/// groups that do not repeat and ends on a repeated group.
fn names_repeated_group(
    reference: &Value,
    declaration: &[String],
    root: &Map<String, Value>,
) -> bool {
    let Some(text) = reference.as_str() else {
        return false;
    };
    let dots = text.bytes().take_while(|byte| *byte == b'.').count();
    let rest = &text[dots..];
    let leave = if dots == 0 && rest.contains('.') {
        declaration.len()
    } else {
        dots.max(1)
    };
    if leave > declaration.len() {
        return false;
    }
    let names: Vec<&str> = rest.split('.').collect();
    if names.iter().any(|name| name.is_empty() || *name == "*") {
        return false;
    }
    let mut properties = root;
    for name in &declaration[..declaration.len() - leave] {
        // A declaration step without properties holds no named field.
        let Some(next) = properties
            .get(name)
            .and_then(|field| field.get("properties"))
            .and_then(Value::as_object)
        else {
            return false;
        };
        properties = next;
    }
    for (index, name) in names.iter().enumerate() {
        let Some(field) = properties.get(*name) else {
            return false;
        };
        let Some(children) = is_group_with_properties(field) else {
            return false;
        };
        if index == names.len() - 1 {
            return is_multiple(field);
        }
        if is_multiple(field) {
            return false;
        }
        properties = children;
    }
    false
}

/// Fail the load when the field declares a `multiple.keys` that names no repeated group
/// (CUVR-070), with the field's declaration path.
pub(crate) fn check_keyed_map_reference(
    field: &Value,
    declaration: &[String],
    root: &Map<String, Value>,
) -> Result<(), ValidateError> {
    match keyed_map_reference(field) {
        Some(reference) if !names_repeated_group(reference, declaration, root) => {
            Err(FormInputError::new(format!(
                "Invalid multiple.keys at {}: expected a reference to a repeated group",
                path_to_string(declaration)
            ))
            .into())
        }
        _ => Ok(()),
    }
}

/// Fail when a key of the field's keyed object `value` is not a row key of the group that its
/// `multiple.keys` names, read in the field's row context (CUVR-069); keys in code point order,
/// the byte order of their UTF-8 text.
pub(crate) fn check_keyed_map_keys(
    field: &Value,
    value: &Map<String, Value>,
    field_path: &[String],
    row_keys: &[usize],
    form_data: &Value,
) -> Result<(), ValidateError> {
    let Some(reference) = keyed_map_reference(field).and_then(Value::as_str) else {
        return Ok(());
    };
    let ids = resolve_field_reference(reference, field_path, row_keys, form_data).as_object();
    let mut keys: Vec<&String> = value.keys().collect();
    keys.sort();
    for key in keys {
        if !ids.is_some_and(|ids| ids.contains_key(key.as_str())) {
            let mut row_path = field_path.to_vec();
            row_path.push(key.clone());
            return Err(FormInputError::new(format!(
                "Row key is not an id of {reference}: {}",
                path_to_string(&row_path)
            ))
            .into());
        }
    }
    Ok(())
}
