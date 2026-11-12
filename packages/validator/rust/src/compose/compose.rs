//! Composition orchestrator (SPEC §5, G5) — the parser's FIRST pass.
//!
//! Resolution order (SPEC §5, verbatim):
//!   (1) $ref   — expand file/path base, recursively (nested $ref included) into a
//!                single properties base.
//!   (2) $patch — overlay add/remove/replace and deep-path set on that base.
//!   (3) the result is the equivalent SINGLE SPEC (composition keys eliminated).
//!   (4) the field layer (validate/design/behavior/options) then applies to it.
//!
//! G5 (SPEC §2): the parser expands composition first, producing a single spec,
//! BEFORE applying the field layer — without composition a `$ref`-using spec
//! cannot even be loaded. So composition is a pre-processing pass that runs
//! BEFORE validation/render, not a validation step.
//!
//! Merge priority is positional: `$ref` = base
//! (first), `$patch` = overlay (later) — base is laid down, patch overrides.
//!
//! `compose_properties` is the entry point: it operates on a `properties` map (the
//! composition entry point, SPEC §2 / types.rs:73) where `$ref`/`$patch` may sit
//! alongside named child fields. `compose_spec` recurses the whole field tree so a
//! `$ref` nested inside any child `properties` is expanded too. Both return a
//! `ComposeLoadError` for any unresolved composition (never `valid:true`).

use std::collections::BTreeSet;

use serde_json::{Map, Value};

use super::errors::ComposeResult;
use super::loader::FileLoader;
use super::member_order::member_ordered_map;
use super::members::layer_members;
use super::ref_::resolve_ref;

/// Options for a composition pass.
#[derive(Debug, Clone, Default)]
pub struct ComposeOptions {
    /// Basepath for relative `$ref` resolution.
    pub basepath: String,
}

impl ComposeOptions {
    /// Construct options with the given basepath.
    pub fn with_basepath(basepath: impl Into<String>) -> Self {
        ComposeOptions {
            basepath: basepath.into(),
        }
    }
}

/// Compose a `properties` map: expand `$ref` to a base, overlay `$patch`, return
/// the single (composition-free) properties map. Named sibling keys follow
/// declaration order — a key declared after `$ref` overrides the base; a key
/// declared before it is overridden by the base. The input and the result are in
/// specification member order at every depth.
pub fn compose_properties(
    properties: Map<String, Value>,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> ComposeResult<Map<String, Value>> {
    let composed = expand_properties(member_ordered_map(&properties), loader, opts)?;
    Ok(member_ordered_map(&composed))
}

/// Compose a full field spec: expand a field-level `$ref`/`$patch`, then recurse
/// into its `properties` (which may itself compose). Returns the single spec. The
/// input and the result are in specification member order at every depth.
pub fn compose_spec(
    spec: Map<String, Value>,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> ComposeResult<Map<String, Value>> {
    let composed = expand_spec(member_ordered_map(&spec), loader, opts)?;
    Ok(member_ordered_map(&composed))
}

/// The resolution of the value of a `$ref` from the base path of the options, with no file
/// being resolved yet.
fn reference_resolver<'a>(
    loader: &'a dyn FileLoader,
    opts: &'a ComposeOptions,
) -> impl Fn(&Value) -> ComposeResult<Map<String, Value>> + 'a {
    move |value| resolve_ref(value, &opts.basepath, loader, &BTreeSet::new())
}

/// `compose_properties` over a member-ordered input, without ordering the result.
fn expand_properties(
    properties: Map<String, Value>,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> ComposeResult<Map<String, Value>> {
    let mut result = layer_members(properties, reference_resolver(loader, opts))?;

    // Recurse into every child field's `properties` (the tree may compose deeper).
    // ORDER: clone the child value out (get().cloned()), compose it, then re-insert
    // under the SAME key. IndexMap::insert keeps an existing key in its place — so
    // declaration order is preserved. NEVER remove()+insert (remove = swap_remove,
    // which moves the last key into this slot and corrupts the positional order
    // that the merge priority is load-bearing on).
    let keys: Vec<String> = result.keys().cloned().collect();
    for field_name in keys {
        if let Some(Value::Object(child)) = result.get(&field_name).cloned() {
            let composed = expand_spec(child, loader, opts)?;
            result.insert(field_name, Value::Object(composed));
        }
    }

    Ok(result)
}

/// `compose_spec` over a member-ordered input, without ordering the result.
fn expand_spec(
    spec: Map<String, Value>,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> ComposeResult<Map<String, Value>> {
    let mut resolved: Map<String, Value>;

    // Field-level $ref / $patch (a field may inherit a whole base spec).
    if spec.contains_key("$ref") || spec.contains_key("$patch") {
        // Field-level $ref resolves a file's properties layer too (detectKey).
        let merged = layer_members(spec, reference_resolver(loader, opts))?;
        resolved = merged;
    } else {
        resolved = spec;
    }

    // Recurse into `properties` (composition entry point, SPEC §2 / types.rs:73).
    // ORDER: clone out, compose, re-insert under the SAME key so `properties` keeps
    // its declared position (IndexMap::insert preserves an existing key's slot).
    // remove() here would swap_remove and shove `properties` to a wrong position.
    if let Some(Value::Object(props)) = resolved.get("properties").cloned() {
        let composed = expand_properties(props, loader, opts)?;
        resolved.insert("properties".to_string(), Value::Object(composed));
    }

    Ok(resolved)
}

#[cfg(test)]
mod order_tests {
    //! Verify the literal unsorted key sequence for the composition tree. Value
    //! equality does not detect reordering, so these tests compare keys directly.

    use super::{compose_properties, compose_spec, ComposeOptions};
    use crate::compose::loader::MemoryLoader;
    use serde_json::{json, Value};

    fn keys(v: &Value) -> Vec<String> {
        v.as_object().unwrap().keys().cloned().collect()
    }

    fn loader(files: Value) -> MemoryLoader {
        MemoryLoader::new(files.as_object().unwrap().clone())
    }

    fn props(v: Value) -> serde_json::Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    /// The composed value of `entry` over the base documents `files`.
    fn composed(files: Value, entry: Value) -> Value {
        let out =
            compose_properties(props(entry), &loader(files), &ComposeOptions::default()).unwrap();
        Value::Object(out)
    }

    #[test]
    fn child_recursion_preserves_field_declaration_order() {
        // Three sibling fields, each with a nested `properties` that composes. The
        // re-insert after composing each child must keep a,b,c in order — a
        // remove()+insert (swap_remove) would scramble them to e.g. c,b,a / a,c,b.
        let out = composed(
            json!({}),
            json!({
                "a": {"type": "group", "properties": {"x": {"type": "text"}}},
                "b": {"type": "group", "properties": {"y": {"type": "text"}}},
                "c": {"type": "group", "properties": {"z": {"type": "text"}}}
            }),
        );
        assert_eq!(keys(&out), vec!["a", "b", "c"]);
    }

    #[test]
    fn ref_base_then_sibling_after_keeps_base_order_and_appends_new() {
        // base = {a,b}; entry declares $ref then sibling c → a,b (base order) then c.
        let out = composed(
            json!({
                "base.yml": {"properties": {"a": {"t": 1}, "b": {"t": 2}}}
            }),
            json!({"$ref": "base.yml", "c": {"t": 3}}),
        );
        assert_eq!(keys(&out), vec!["a", "b", "c"]);
    }

    #[test]
    fn sibling_after_ref_overrides_base_in_its_base_slot() {
        // a declared AFTER $ref overrides the base value but the key keeps the
        // base's slot (insert on an existing key preserves position): a,b order.
        let out = composed(
            json!({
                "base.yml": {"properties": {"a": {"from": "base"}, "b": {"t": 2}}}
            }),
            json!({"$ref": "base.yml", "a": {"from": "override"}}),
        );
        assert_eq!(keys(&out), vec!["a", "b"]);
        assert_eq!(out["a"]["from"], json!("override"));
    }

    #[test]
    fn spec_level_properties_keeps_its_declared_position() {
        // type, properties, behavior — composing `properties` must NOT move it to
        // the end (it sits in slot 1 and must stay there).
        let ml = loader(json!({
            "group.yml": {"properties": {"child": {"type": "text"}}}
        }));
        let entry = props(json!({
            "type": "group",
            "properties": {"$ref": "group.yml"},
            "behavior": {"collapsible": true}
        }));
        let out = compose_spec(entry, &ml, &ComposeOptions::default()).unwrap();
        let out = Value::Object(out);
        assert_eq!(keys(&out), vec!["type", "properties", "behavior"]);
        assert_eq!(keys(&out["properties"]), vec!["child"]);
    }

    /// An object with members inserted in exactly the given order.
    fn written(members: &[(&str, Value)]) -> Value {
        Value::Object(
            members
                .iter()
                .map(|(name, value)| ((*name).to_string(), value.clone()))
                .collect(),
        )
    }

    #[test]
    fn patched_array_index_member_joins_in_member_order() {
        let base = written(&[("b", json!({"t": "b"})), ("a", json!({"t": "a"}))]);
        let out = composed(
            json!({"base.yml": {"properties": base}}),
            json!({"$ref": "base.yml", "$patch": {"10": {"t": "ten"}}}),
        );
        assert_eq!(keys(&out), vec!["10", "b", "a"]);
    }

    /// A loader that returns documents exactly as written, like a custom loader.
    struct Written(Value);

    impl crate::compose::FileLoader for Written {
        fn normalize(&self, path: &str, _basepath: &str) -> String {
            path.to_string()
        }
        fn load(
            &self,
            _key: &str,
        ) -> crate::compose::ComposeResult<serde_json::Map<String, Value>> {
            Ok(self.0.as_object().unwrap().clone())
        }
    }

    #[test]
    fn loaded_documents_are_read_in_member_order() {
        let doc = written(&[(
            "properties",
            written(&[("b", json!({})), ("10", json!({})), ("a", json!({}))]),
        )]);
        let custom = Written(json!({"properties": {"10": {"from": "base"}}}));
        let out = compose_properties(
            props(json!({"$ref": "doc.yml"})),
            &Written(doc),
            &ComposeOptions::default(),
        )
        .unwrap();
        assert_eq!(keys(&Value::Object(out)), vec!["10", "b", "a"]);
        // Written as $ref, 10: in member order 10 precedes $ref, so the base overrides it.
        let entry = written(&[("$ref", json!("x.yml")), ("10", json!({"from": "entry"}))]);
        let out = compose_properties(
            entry.as_object().unwrap().clone(),
            &custom,
            &ComposeOptions::default(),
        )
        .unwrap();
        assert_eq!(Value::Object(out)["10"]["from"], json!("base"));
    }

    #[test]
    fn validation_errors_follow_member_order_and_data_is_not_reordered() {
        use crate::validate::{validate, ValidateOptions};
        let required = json!({"type": "text", "validate": {"required": true}});
        let properties = written(&[
            ("b", required.clone()),
            ("10", required.clone()),
            ("a", required),
        ]);
        let data = written(&[("a", json!("")), ("b", json!(""))]);
        let result = validate(
            &json!({"type": "group", "properties": properties}),
            &data,
            &ValidateOptions::default(),
        )
        .unwrap();
        let paths: Vec<&str> = result.errors.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, vec!["10", "b", "a"]);
        assert_eq!(keys(&data), vec!["a", "b"]);
    }

    #[test]
    fn nested_ref_flatten_keeps_inner_then_own_order() {
        // base.yml: $ref inner.yml (deep) then own → inner base laid first, own
        // appended: deep, own (declaration order across the $ref boundary).
        let out = composed(
            json!({
                "base.yml": {"properties": {"$ref": "inner.yml", "own": {"from": "base"}}},
                "inner.yml": {"properties": {"deep": {"from": "inner"}}}
            }),
            json!({"$ref": "base.yml"}),
        );
        assert_eq!(keys(&out), vec!["deep", "own"]);
    }
}
