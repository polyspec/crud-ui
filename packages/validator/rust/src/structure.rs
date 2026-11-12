//! Shared steps for structure-only validation of list and detail specifications.
//!
//! Both entries resolve the loader, compose the root the same way, expand a
//! properties-shaped map slot with the form properties engine, and scan the whole
//! composed tree for forbidden meta keys.

use serde_json::{Map, Value};

use crate::compose::{
    compose_properties, compose_spec, member_ordered, ComposeLoadError, ComposeOptions, FileLoader,
    MemoryLoader,
};
use crate::forbidden_scan::scan_forbidden_keys;

/// Resolve the loader and compose options, compose with `compose`, then scan the
/// composed tree from the root (no `properties` prefix).
pub(crate) fn validate_structure<F>(
    spec: &Value,
    files: Option<&Map<String, Value>>,
    loader: Option<&dyn FileLoader>,
    basepath: Option<&str>,
    compose: F,
) -> Result<(), ComposeLoadError>
where
    F: FnOnce(&Value, &dyn FileLoader, &ComposeOptions) -> Result<Value, ComposeLoadError>,
{
    let owned_loader;
    let loader: &dyn FileLoader = match loader {
        Some(l) => l,
        None => {
            // Without files a composition reads no file.
            owned_loader = match files {
                Some(files) => MemoryLoader::new(files.clone()),
                None => MemoryLoader::new(Map::new()),
            };
            &owned_loader
        }
    };
    let opts = match basepath {
        Some(bp) => ComposeOptions::with_basepath(bp.to_string()),
        None => ComposeOptions::default(),
    };
    let composed = compose(&member_ordered(spec), loader, &opts)?;
    scan_forbidden_keys(&composed, &[])
}

/// Compose a list or detail root: expand root `$ref`/`$patch` with
/// `compose_spec`. Returns `None` for a non-object spec (it composes to itself;
/// the meta-schema owns that shape).
pub(crate) fn compose_root(
    spec: &Value,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> Result<Option<Map<String, Value>>, ComposeLoadError> {
    match spec.as_object() {
        Some(m) => compose_spec(m.clone(), loader, opts).map(Some),
        None => Ok(None),
    }
}

/// Expand a properties-shaped map slot (`columns`, `fields`) in place with the
/// form properties engine when the slot holds an object.
pub(crate) fn compose_map_slot(
    composed: &mut Map<String, Value>,
    key: &str,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> Result<(), ComposeLoadError> {
    if let Some(Value::Object(map)) = composed.get(key).cloned() {
        let expanded = compose_properties(map, loader, opts)?;
        composed.insert(key.to_string(), Value::Object(expanded));
    }
    Ok(())
}
