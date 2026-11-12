//! Visibility (validation rules, "Evaluation"): `design.show` resolved against
//! the data in the field's row context.

use serde_json::Value;

use super::rules::is_condition_expression;
use super::validator::has_ternary_regex;
use crate::expr::{condition_map, Evaluator, Expression, Node};

/// Whether a `design.show` value shows its field. The value resolves like a
/// conditional parameter: a condition map selects its value, a ternary its branch
/// and a condition expression that parses completely its value; any other string
/// and any other value is a literal. Only a value that resolves to `false` hides
/// the field, so a missing value, `null`, a condition map that selects nothing and
/// a literal string show it. `path` is the field's data path, row keys included,
/// and `row_keys` the positions of the row keys in it.
pub fn show(value: Option<&Value>, data: &Value, path: &[String], row_keys: &[usize]) -> bool {
    let resolved = match value {
        None => return true,
        Some(Value::Object(map)) => {
            let entries: Vec<(String, Value)> =
                map.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
            // A condition map that selects no value leaves the field shown: only `false` hides it.
            match condition_map::resolve(&entries, data, path, row_keys) {
                Some(selected) => selected,
                None => return true,
            }
        }
        Some(Value::String(expression)) => match Expression::parse(expression) {
            Ok(node @ Node::Ternary { .. }) => {
                Evaluator::new(data, path, row_keys).evaluate_value(&node)
            }
            Ok(node) if is_condition_expression(expression) && !has_ternary_regex(expression) => {
                Evaluator::new(data, path, row_keys).evaluate_value(&node)
            }
            _ => return true,
        },
        Some(literal) => literal.clone(),
    };
    resolved != Value::Bool(false)
}

/// Whether a field is visible: its `design` object's `show` shows it. A field
/// without `design.show` is visible.
pub fn is_visible(field: &Value, data: &Value, path: &[String], row_keys: &[usize]) -> bool {
    match field.get("design") {
        Some(Value::Object(design)) => show(design.get("show"), data, path, row_keys),
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn show_values() {
        let data = json!({ "on": 1, "rows": { "r": { "kind": "a" } } });
        let path = |p: &str| p.split('.').map(String::from).collect::<Vec<_>>();
        assert!(show(None, &data, &path("x"), &[]));
        assert!(show(Some(&json!(null)), &data, &path("x"), &[]));
        assert!(show(
            Some(&json!("not an (expression")),
            &data,
            &path("x"),
            &[]
        ));
        assert!(show(Some(&json!(true)), &data, &path("x"), &[]));
        assert!(!show(Some(&json!(false)), &data, &path("x"), &[]));
        assert!(show(Some(&json!(".on")), &data, &path("x"), &[]));
        assert!(!show(Some(&json!(".off")), &data, &path("x"), &[]));
        assert!(show(
            Some(&json!(".kind == 'a'")),
            &data,
            &path("rows.r.note"),
            &[]
        ));
        assert!(!show(
            Some(&json!({ ".on": false, "true": true })),
            &data,
            &path("x"),
            &[]
        ));
        assert!(show(
            Some(&json!({ ".off": false, "true": true })),
            &data,
            &path("x"),
            &[]
        ));
        assert!(show(
            Some(&json!({ ".off": false })),
            &data,
            &path("x"),
            &[]
        ));
        assert!(show(Some(&json!({ ".on": null })), &data, &path("x"), &[]));
        assert!(is_visible(
            &json!({ "design": false }),
            &data,
            &path("x"),
            &[]
        ));
        assert!(!is_visible(
            &json!({ "design": { "show": false } }),
            &data,
            &path("x"),
            &[]
        ));
    }
}
