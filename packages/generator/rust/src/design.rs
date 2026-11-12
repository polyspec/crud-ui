use crate::util::{js_string, segments};
use polyspec_crud_ui_validator::expr::condition_map;
use polyspec_crud_ui_validator::expr::{is_truthy, Evaluator, Expression, Node};
use polyspec_crud_ui_validator::validate::rules::is_condition_expression;
use serde_json::{json, Value};

/// The value that a condition map selects, or null when it selects none: a setting that selects
/// no value is unset.
fn resolve_map(
    map: &serde_json::Map<String, Value>,
    data: &Value,
    path: &[String],
    rows: &[usize],
) -> Value {
    let entries = map
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect::<Vec<_>>();
    match condition_map::resolve(&entries, data, path, rows) {
        Some(selected) => selected,
        None => Value::Null,
    }
}

/// Form visibility, resolved as the validator resolves it, so a server skips exactly
/// the rules of the fields the form hides.
pub(crate) use polyspec_crud_ui_validator::validate::visibility::show;

/// A conditional flag other than visibility: a condition map that selects nothing,
/// and an invalid expression, are false.
pub(crate) fn flag(value: Option<&Value>, data: &Value, path: &[String], rows: &[usize]) -> bool {
    match value {
        None | Some(Value::Null) => true,
        Some(Value::Object(map)) => is_truthy(&resolve_map(map, data, path, rows)),
        Some(Value::String(s)) => expression_flag(s, data, path, rows),
        Some(v) => is_truthy(v),
    }
}

/// An appearance setting such as `design.class`: a condition map selects its value, a
/// ternary its branch and a condition expression that parses completely its result; any
/// other string is literal text.
pub(crate) fn appearance(
    value: Option<&Value>,
    data: &Value,
    path: &[String],
    rows: &[usize],
) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::Object(map)) => {
            let result = resolve_map(map, data, path, rows);
            if result.is_null() {
                String::new()
            } else {
                js_string(&result)
            }
        }
        // A string that does not parse is literal text. A parsed expression is evaluated by the evaluator, which
        // reports no error: a path that the data lacks gives null, as the reference evaluates it.
        Some(Value::String(s)) => match Expression::parse(s) {
            Ok(node @ Node::Ternary { .. }) => {
                let result = Evaluator::new(data, path, rows).evaluate_value(&node);
                if result.is_null() {
                    String::new()
                } else {
                    js_string(&result)
                }
            }
            Ok(node) if is_condition_expression(s) && !has_ternary_text(s) => {
                let result = Evaluator::new(data, path, rows).evaluate_value(&node);
                if result.is_null() || result == false {
                    String::new()
                } else {
                    js_string(&result)
                }
            }
            _ => s.clone(),
        },
        Some(v) => js_string(v),
    }
}

/// A condition expression that does not evaluate is false, as the TypeScript reference reads it (expr.ts).
#[allow(
    clippy::disallowed_methods,
    reason = "the reference expression is not evaluated as false"
)]
fn expression_flag(text: &str, data: &Value, path: &[String], rows: &[usize]) -> bool {
    Expression::evaluate(text, data, path, rows).unwrap_or(false)
}

fn has_ternary_text(s: &str) -> bool {
    s.find('?').is_some_and(|i| s[i..].contains(':'))
}

/// The design of a node at `path`; `rows` are the positions of the row keys in the path.
pub(crate) fn resolve_design(
    design: Option<&Value>,
    data: &Value,
    path: &str,
    rows: &[usize],
) -> Value {
    let empty = json!({});
    // A field without a design object has no design settings.
    let design = match design.filter(|v| v.is_object()) {
        Some(design) => design,
        None => &empty,
    };
    let path = segments(path);
    let node = |value: &Value| {
        json!({
            "class": appearance(value.get("class"),data,&path,rows),
            "style": appearance(value.get("style"),data,&path,rows),
        })
    };
    json!({"show": show(design.get("show"),data,&path,rows), "main": node(design),
        "label": node(&design["label"]), "wrapper": node(&design["wrapper"]),
        "group": node(&design["group"]), "prepend": node(&design["prepend"])})
}
