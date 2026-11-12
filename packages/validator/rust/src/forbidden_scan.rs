//! Recursive forbidden meta-key scan (SPEC §6) — the runtime half of the
//! global rejection that the meta-schema's `propertyNames` enforces statically.
//!
//! R1: the types/parser PRESERVE every key of the open buckets (round-trip), so
//! blocking forbidden meta keys is the VALIDATION layer's job, not the model's.
//! The typed models (`FieldSpec` + `ExtraMap`) only reject forbidden keys at the
//! top level, as unknown keys inside the closed buckets, and one level under open
//! buckets — a deeply nested meta key (`validate.required.if`,
//! `options.x.display_switch`, …) leaks through. This scan closes that leak: it
//! walks the COMPOSED single spec (after `$ref`/`$patch` expansion and x-strip)
//! to ARBITRARY depth and rejects a forbidden key found at ANY depth — including
//! one level under a slot/bucket body.
//!
//! Placement (SPEC §2 pipeline): this runs in the spec LOAD path, immediately
//! after compose expansion and before validation entry. A hit is therefore a LOAD
//! failure (`ComposeLoadError`, code `FORBIDDEN_META_KEY`) — the spec never comes
//! into existence — never a `valid:false` validation result.
//!
//! Forbidden set (SPEC §6): the enumerated `FORBIDDEN_META_KEYS`
//! (condition-only / retired / magic-symbol meta keys) PLUS the `x{key}` comment
//! family (any `x`-prefixed key). `$ref`/`$patch` are NOT forbidden — compose
//! already consumed them, so they do not survive to here; `x{key}` IS strip-
//! eligible, so any `x{key}` that survives to this scan is rejected (the strip
//! belongs to the meta-schema; survival means it was not stripped).
//!
//! Byte-for-byte with the JS reference (`legacy/packages/validator/ts/src/
//! forbidden-scan.ts`); the shared 4-language fixture
//! `tests/fixtures/spec-validity/cases.json` is the single source of truth.

use serde_json::Value;

use crate::compose::{ComposeErrorCode, ComposeLoadError};
use crate::types::FORBIDDEN_META_KEYS;

/// Whether `key` is an `x{key}` comment key: an `x` followed by at least one more
/// character (`xclass`, `xstyle`, `xnote`, …). The bare key `x` is not a comment.
/// The authoritative strip belongs to the meta-schema; this is the runtime
/// backstop that rejects an `x{key}` that survived.
fn is_x_comment_key(key: &str) -> bool {
    key.len() > 1 && key.as_bytes()[0] == b'x'
}

/// Whether `key` is globally forbidden (enumerated literal OR `x{key}`).
fn is_forbidden_key(key: &str) -> bool {
    FORBIDDEN_META_KEYS.contains(&key) || is_x_comment_key(key)
}

/// Recursively scan a composed single spec for any forbidden meta key at any
/// depth. Returns `Err(ComposeLoadError { code: FORBIDDEN_META_KEY })` on the
/// first hit, with the dotted path to the offending key in `message` and `trace`.
///
/// The scan descends into every object value AND every array element (a forbidden
/// key nested inside an array of sub-specs is caught too). Map keys are checked
/// before descending into their values, so the reported path points at the
/// shallowest offending key.
///
/// `root_path` is the path prefix for the error trace; the load path seeds it
/// with `["properties"]` so a hit reports `properties.<field>.…` (4-language
/// path convention).
pub fn scan_forbidden_keys(spec: &Value, root_path: &[String]) -> Result<(), ComposeLoadError> {
    walk(spec, root_path.to_vec())
}

fn walk(node: &Value, path: Vec<String>) -> Result<(), ComposeLoadError> {
    match node {
        Value::Array(items) => {
            for (i, item) in items.iter().enumerate() {
                let mut child = path.clone();
                child.push(i.to_string());
                walk(item, child)?;
            }
            Ok(())
        }
        Value::Object(map) => {
            // Check every key at THIS level first (shallowest hit reported),
            // then descend — matching the JS two-pass key walk.
            for key in map.keys() {
                if is_forbidden_key(key) {
                    let mut at = path.clone();
                    at.push(key.clone());
                    return Err(ComposeLoadError::with_trace(
                        ComposeErrorCode::ForbiddenMetaKey,
                        format!("forbidden meta key \"{key}\" at {}", at.join(".")),
                        at,
                    ));
                }
            }
            for (key, value) in map {
                let mut child = path.clone();
                child.push(key.clone());
                walk(value, child)?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn scan(v: &Value) -> Result<(), ComposeLoadError> {
        scan_forbidden_keys(v, &["properties".to_string()])
    }

    #[test]
    fn clean_spec_passes() {
        let v = json!({
            "field": { "type": "text", "validate": { "required": true } }
        });
        assert!(scan(&v).is_ok());
    }

    #[test]
    fn true_default_key_is_not_forbidden() {
        let v = json!({
            "field": { "type": "number", "validate": { "max": { ".tier == 'pro'": 1000, "true": 10 } } }
        });
        assert!(scan(&v).is_ok());
    }

    #[test]
    fn deeply_nested_forbidden_key_is_caught_with_path() {
        let v = json!({
            "field": { "type": "text", "validate": { "required": { "if": ".x" } } }
        });
        let err = scan(&v).unwrap_err();
        assert_eq!(err.code, ComposeErrorCode::ForbiddenMetaKey);
        assert_eq!(err.trace.join("."), "properties.field.validate.required.if");
    }

    #[test]
    fn x_comment_survivor_is_rejected_but_bare_x_object_value_is_not_a_key() {
        // `xnote` (x{key}) is rejected.
        let v = json!({ "field": { "type": "text", "xnote": "c" } });
        assert_eq!(
            scan(&v).unwrap_err().trace.join("."),
            "properties.field.xnote"
        );
    }

    #[test]
    fn forbidden_key_inside_array_element_is_caught() {
        let v = json!({
            "field": { "type": "select", "options": {
                "items": [ { "value": "a" }, { "value": "b", "display_target": ".x" } ]
            } }
        });
        assert_eq!(
            scan(&v).unwrap_err().trace.join("."),
            "properties.field.options.items.1.display_target"
        );
    }

    #[test]
    fn shallowest_key_reported_when_multiple_present() {
        // Two forbidden keys at the same level: declaration order picks the first.
        let v = json!({ "field": { "if": 1, "when": 2 } });
        let err = scan(&v).unwrap_err();
        assert_eq!(err.trace.join("."), "properties.field.if");
    }
}
