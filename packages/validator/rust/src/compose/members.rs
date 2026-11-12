//! The member rules that `$ref` and `$patch` share with the composition orchestrator: the
//! layering of the members of one node (SPEC §5) and the type names of the error texts.

use serde_json::{Map, Value};

use super::errors::ComposeResult;
use super::patch::apply_patch;
use crate::json_type::js_type_of;

/// Layer the members of a node in declaration order: a `$ref` lays its resolved base over the
/// members declared before it, the members declared after it override that base (an
/// existing key keeps its slot), and a `$patch` overlays the result.
pub(super) fn layer_members(
    node: Map<String, Value>,
    mut resolve: impl FnMut(&Value) -> ComposeResult<Map<String, Value>>,
) -> ComposeResult<Map<String, Value>> {
    let mut base: Map<String, Value> = Map::new();
    let mut patch: Option<Value> = None;
    let mut own: Map<String, Value> = Map::new();

    for (k, v) in node {
        if k == "$ref" {
            // The ref lays down onto whatever was declared before it (declaration order).
            let resolved = resolve(&v)?;
            let mut next_base: Map<String, Value> = Map::new();
            for (ok, ov) in own.iter() {
                next_base.insert(ok.clone(), ov.clone());
            }
            for (rk, rv) in resolved {
                next_base.insert(rk, rv);
            }
            base = next_base;
            own.clear();
        } else if k == "$patch" {
            patch = Some(v);
        } else {
            own.insert(k, v);
        }
    }

    let mut result = base;
    for (k, v) in own {
        result.insert(k, v);
    }
    if let Some(p) = patch {
        result = apply_patch(result, &p)?;
    }
    Ok(result)
}

/// JS-style type name for error messages (matches the JS `typeof`/array wording): an array
/// is named `array`, not `object`.
pub(super) fn kind_of(v: &Value) -> &'static str {
    if v.is_array() {
        "array"
    } else {
        js_type_of(v)
    }
}
