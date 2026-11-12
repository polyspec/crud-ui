//! Condition-map resolver (expressions.md §8). A thin wrapper over the
//! expression engine — NOT a separate parser.
//!
//! A condition map is an ordered `{expr: value, …}`. Keys (each an §2 expression)
//! are evaluated in declaration order; the first truthy key's value wins. On a
//! miss the literal `true` key's value is used if present, else null. Declaration
//! order must be preserved by the caller's map type (`serde_json::Map` with
//! `preserve_order`, or an ordered key list).
//!
//! The `true` default key is the literal expression `true` (always truthy); R4
//! forbids convention sigils such as `_`. The map's value is returned verbatim
//! (boolean | string | number | null) — the call site decides the expected type.

use serde_json::Value;

use super::expression::Expression;

/// The default (else) key: the literal expression `true`.
pub const DEFAULT_KEY: &str = "true";

/// Resolve a condition map against form data.
///
/// `entries` is the ordered `(expr, value)` list; the default key is matched by
/// literal text (never by evaluation), so it never short-circuits an earlier real
/// condition. Returns `None` only when no key matches and there is no `true` key.
pub fn resolve(
    entries: &[(String, Value)],
    form_data: &Value,
    current_path: &[String],
    row_keys: &[usize],
) -> Option<Value> {
    for (expr, value) in entries {
        if expr == DEFAULT_KEY {
            continue;
        }
        if key_holds(expr, form_data, current_path, row_keys) {
            return Some(value.clone());
        }
    }

    for (expr, value) in entries {
        if expr == DEFAULT_KEY {
            return Some(value.clone());
        }
    }

    None
}

/// Whether a non-default key holds. A key that does not parse is a literal, not a
/// condition, so it does not hold: the JS reference `evaluateCondition` catches the
/// parse error and returns false (packages/validator/ts/src/validate/validator.ts).
#[allow(
    clippy::disallowed_methods,
    reason = "a key that does not parse is a literal"
)]
fn key_holds(expr: &str, form_data: &Value, current_path: &[String], row_keys: &[usize]) -> bool {
    Expression::evaluate(expr, form_data, current_path, row_keys).unwrap_or(false)
}
