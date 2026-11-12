//! CRUDUI detail-spec structure validation.
//!
//! A detail contains no record data and no search, so this module performs only
//! composition and forbidden-key scanning, at the same level as list validation.
//!
//! Pass 1 — compose: the detail root composes exactly as the list root does
//! (`compose_spec` expands root `$ref`/`$patch`); an object `fields` map then
//! expands with `compose_properties`, the same engine the list uses for
//! `columns`. An unresolved composition is a LOAD failure (`ComposeLoadError`).
//!
//! Pass 2 — forbidden-scan (§6): `scan_forbidden_keys` walks the whole composed
//! detail tree to arbitrary depth and rejects any forbidden meta key as a LOAD
//! failure, with the trace seeded at the detail root.
//!
//! The meta-schema separately checks closed objects and shapes. The shared
//! fixture `tests/fixtures/detail-validity/cases.json` declares both results.

use serde_json::{Map, Value};

use crate::compose::{ComposeLoadError, ComposeOptions, FileLoader};
use crate::structure::{compose_map_slot, compose_root, validate_structure};
use crate::{FormInputError, ValidateError};

/// Options for a detail-spec validation run (no data, so no `data` field).
#[derive(Default)]
pub struct ValidateDetailOptions<'a> {
    /// Virtual file set for `$ref` resolution (default empty — no `$ref`).
    pub files: Option<Map<String, Value>>,
    /// A custom loader (overrides `files`).
    pub loader: Option<&'a dyn FileLoader>,
    /// Basepath for relative `$ref` resolution.
    pub basepath: Option<String>,
}

/// Validate a detail-spec's STRUCTURE: compose then forbidden-scan (§6).
///
/// Returns `Ok(())` when the composed detail tree carries no forbidden meta key.
/// Returns `Err(ComposeLoadError)` for an unresolved composition (`$ref`/`$patch`)
/// or a forbidden meta key at any depth (`FORBIDDEN_META_KEY`). Both are LOAD
/// failures, never a `valid:false` result.
pub fn validate_detail(spec: &Value, options: &ValidateDetailOptions) -> Result<(), ValidateError> {
    // CUDF-091: a specification that is no object fails before the composition (CUDF-032).
    if !spec.is_object() {
        return Err(FormInputError::new("Detail specification must be an object").into());
    }
    Ok(validate_structure(
        spec,
        options.files.as_ref(),
        options.loader,
        options.basepath.as_deref(),
        compose_detail,
    )?)
}

/// Compose a detail-spec: expand the root `$ref`/`$patch`, then the `fields` map.
/// A non-object spec composes to itself.
fn compose_detail(
    spec: &Value,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> Result<Value, ComposeLoadError> {
    let mut composed = match compose_root(spec, loader, opts)? {
        Some(m) => m,
        None => return Ok(spec.clone()),
    };
    compose_map_slot(&mut composed, "fields", loader, opts)?;
    Ok(Value::Object(composed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compose::ComposeErrorCode;
    use serde_json::json;

    #[test]
    fn minimal_fields_passes() {
        let v = json!({ "fields": { "name": { "field": "name" } } });
        assert!(validate_detail(&v, &ValidateDetailOptions::default()).is_ok());
    }

    /// CUDF-091: a specification that is no object fails before the composition.
    #[test]
    fn a_specification_that_is_no_object_fails() {
        let Err(ValidateError::InvalidFormInput(error)) =
            validate_detail(&json!([]), &ValidateDetailOptions::default())
        else {
            panic!("a list is no specification");
        };
        assert_eq!(error.message, "Detail specification must be an object");
    }

    #[test]
    fn forbidden_field_key_is_load_error() {
        let v = json!({ "fields": { "name": { "field": "name", "show_if": ".admin" } } });
        let Err(ValidateError::Load(err)) = validate_detail(&v, &ValidateDetailOptions::default())
        else {
            panic!("a forbidden key is a load failure");
        };
        assert_eq!(err.code, ComposeErrorCode::ForbiddenMetaKey);
        assert_eq!(err.trace.join("."), "fields.name.show_if");
    }
}
