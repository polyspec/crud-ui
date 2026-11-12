//! CRUDUI list-spec structure validation (SPEC §9).
//!
//! A list contains no row data, so this module performs only composition and
//! forbidden-key scanning. The server supplies rows separately.
//!
//! Pass 1 — compose (G5): `compose_spec`/`compose_properties` expand
//! `$ref`/`$patch` on the list root, the `columns` map, and the `search`
//! sub-form. An unresolved composition is a LOAD failure (`ComposeLoadError`),
//! never a silent pass — the same engine, the same error.
//!
//! Pass 2 — forbidden-scan (§6): `scan_forbidden_keys` walks the COMPOSED list
//! tree (columns / each Column / open format-options bucket / actions / sort /
//! pagination / design / search) to ARBITRARY depth and rejects any forbidden
//! meta key (`display_switch`/`if`/`when`/`show_if`/`x{key}`…) as a LOAD failure.
//!
//! The meta-schema separately checks closed objects, required columns, enums and
//! CellFormat polymorphism. This runtime does not repeat those shape checks. The
//! shared fixture `tests/fixtures/list-validity/cases.json` declares both results.

use serde_json::{Map, Value};

use crate::compose::{compose_spec, ComposeLoadError, ComposeOptions, FileLoader};
use crate::structure::{compose_map_slot, compose_root, validate_structure};
use crate::{FormInputError, ValidateError};

/// Options for a list-spec validation run (the form `ValidateOptions` shape —
/// no data, so no `data` field).
#[derive(Default)]
pub struct ValidateListOptions<'a> {
    /// Virtual file set for `$ref` resolution (default empty — no `$ref`).
    pub files: Option<Map<String, Value>>,
    /// A custom loader (overrides `files`).
    pub loader: Option<&'a dyn FileLoader>,
    /// Basepath for relative `$ref` resolution.
    pub basepath: Option<String>,
}

/// Validate a list-spec's STRUCTURE: compose (§5 G5) then forbidden-scan (§6).
///
/// Returns `Ok(())` when the composed list tree carries no forbidden meta key.
/// Returns `Err(ComposeLoadError)` for an unresolved composition (`$ref`/`$patch`)
/// OR a forbidden meta key at any depth (`FORBIDDEN_META_KEY`) — both are LOAD
/// failures (the spec never comes into existence), never a `valid:false`.
///
/// The composed list tree is built field-by-field so each sub-tree composes with
/// the form engine it shares. The list root may carry `$ref`/`$patch` →
/// `compose_spec` (whole-spec inheritance), but the root is NOT a form Field, so
/// its named slots (`columns`/`search`/…) are composed individually, NOT via the
/// form `properties` recursion. `columns` is a properties-shaped map →
/// `compose_properties` (the SAME code that composes form `properties`).
/// `search` is a form-spec reference (input, §9.1) → `compose_spec`.
pub fn validate_list(spec: &Value, options: &ValidateListOptions) -> Result<(), ValidateError> {
    // CUDF-091: a specification that is no object fails before the composition (CUDF-024).
    if !spec.is_object() {
        return Err(FormInputError::new("List specification must be an object").into());
    }
    // Load-path forbidden-scan (§6) runs over the WHOLE composed list tree, with
    // the trace seeded at the list root (no `properties` prefix — a list is not a
    // Field).
    Ok(validate_structure(
        spec,
        options.files.as_ref(),
        options.loader,
        options.basepath.as_deref(),
        compose_list,
    )?)
}

/// Compose a list-spec into a single composition-free tree: expand the root
/// `$ref`/`$patch`, then expand the `columns` map and the `search` sub-form.
///
/// A non-object spec composes to itself (the forbidden-scan then finds nothing —
/// the meta-schema owns the "list must be an object/required columns" shape).
fn compose_list(
    spec: &Value,
    loader: &dyn FileLoader,
    opts: &ComposeOptions,
) -> Result<Value, ComposeLoadError> {
    // Root-level $ref/$patch: a list may inherit a whole base list. compose_spec
    // expands $ref/$patch and recurses into a `properties` child — a list has no
    // `properties`, so this only flattens the root composition keys.
    let mut composed = match compose_root(spec, loader, opts)? {
        Some(m) => m,
        None => return Ok(spec.clone()),
    };

    // `columns` is a properties-shaped map (named Column entries, possibly a
    // `$ref`/`$patch` compose entry) → the form properties engine, verbatim.
    compose_map_slot(&mut composed, "columns", loader, opts)?;

    // `search` is a form-spec reference (input, §9.1): a Field/group entry that
    // may carry `$ref`/`$patch` → compose_spec (which recurses into its own
    // `properties`, so the referenced sub-form composes fully).
    if let Some(Value::Object(search)) = composed.get("search").cloned() {
        let expanded = compose_spec(search, loader, opts)?;
        composed.insert("search".to_string(), Value::Object(expanded));
    }

    Ok(Value::Object(composed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compose::ComposeErrorCode;
    use serde_json::json;

    /// The load failure of a structure check; another failure fails the test.
    fn load(error: ValidateError) -> ComposeLoadError {
        match error {
            ValidateError::Load(error) => error,
            other => panic!("not a load failure: {other}"),
        }
    }

    fn run(spec: &Value) -> Result<(), ComposeLoadError> {
        validate_list(spec, &ValidateListOptions::default()).map_err(load)
    }

    fn run_with_files(spec: &Value, files: Value) -> Result<(), ComposeLoadError> {
        let opts = ValidateListOptions {
            files: files.as_object().cloned(),
            loader: None,
            basepath: None,
        };
        validate_list(spec, &opts).map_err(load)
    }

    #[test]
    fn minimal_columns_passes() {
        let v = json!({ "columns": { "name": { "field": "name" } } });
        assert!(run(&v).is_ok());
    }

    #[test]
    fn forbidden_column_key_is_load_error() {
        let v = json!({
            "columns": { "name": { "field": "name" }, "display_switch": { "field": "x" } }
        });
        let err = run(&v).unwrap_err();
        assert_eq!(err.code, ComposeErrorCode::ForbiddenMetaKey);
        assert_eq!(err.trace.join("."), "columns.display_switch");
    }

    #[test]
    fn x_prefixed_column_key_is_load_error() {
        let v = json!({ "columns": { "name": { "field": "name" }, "xclass": { "field": "x" } } });
        assert_eq!(run(&v).unwrap_err().trace.join("."), "columns.xclass");
    }

    #[test]
    fn forbidden_key_in_format_options_bucket_is_load_error() {
        let v = json!({
            "columns": { "name": { "field": "name", "format": { "type": "badge", "if": ".admin" } } }
        });
        assert_eq!(
            run(&v).unwrap_err().trace.join("."),
            "columns.name.format.if"
        );
    }

    #[test]
    fn columns_ref_patch_composes_with_supplied_files() {
        // The columns map is composed by the FORM properties engine: $ref pulls a
        // base file's `properties` layer (detectKey), $patch overlays.
        let files = json!({
            "base-columns.yml": { "properties": { "name": { "field": "name" } } }
        });
        let v = json!({
            "columns": { "$ref": "base-columns.yml", "$patch": { "extra": { "field": "extra" } } }
        });
        assert!(run_with_files(&v, files).is_ok());
    }

    #[test]
    fn unresolved_columns_ref_is_load_error() {
        // No files → the columns $ref cannot resolve → REF_FILE_NOT_FOUND. An
        // unresolved composition is a LOAD failure, never a silent pass.
        let v = json!({ "columns": { "$ref": "missing.yml" } });
        assert_eq!(run(&v).unwrap_err().code, ComposeErrorCode::RefFileNotFound);
    }

    #[test]
    fn search_form_ref_composes_with_supplied_files() {
        let files = json!({
            "search-form.yml": { "properties": { "q": { "type": "text" } } }
        });
        let v = json!({
            "columns": { "name": { "field": "name" } },
            "search": { "$ref": "search-form.yml", "$patch": { "add": {} } }
        });
        assert!(run_with_files(&v, files).is_ok());
    }

    #[test]
    fn forbidden_key_in_composed_search_subform_is_load_error() {
        // The search sub-form composes, then forbidden-scan walks it: a meta key
        // INHERITED through the search $ref base is caught at its composed depth.
        let files = json!({
            "search-form.yml": { "properties": { "q": { "type": "text", "show_if": ".admin" } } }
        });
        let v = json!({
            "columns": { "name": { "field": "name" } },
            "search": { "$ref": "search-form.yml" }
        });
        // compose_spec on the search $ref resolves the file's `properties` layer
        // (detectKey) and flattens it onto `search` directly, so the offending key
        // composes to `search.q.show_if` (NOT under a surviving `properties`).
        let err = run_with_files(&v, files).unwrap_err();
        assert_eq!(err.code, ComposeErrorCode::ForbiddenMetaKey);
        assert_eq!(err.trace.join("."), "search.q.show_if");
    }

    #[test]
    fn metaschema_only_shape_violations_pass_the_engine() {
        // The runtime does not report meta-schema-only shape errors.
        for v in [
            json!({ "columns": { "name": { "field": "name" } }, "sort": { "dir": "sideways" } }),
            json!({ "columns": { "name": { "field": "name" } }, "limit": 10 }),
            json!({ "columns": { "name": { "field": "name", "format": ["date"] } } }),
            json!({ "sort": { "field": "name" } }),
        ] {
            assert!(
                run(&v).is_ok(),
                "engine must not reject a meta-schema-only shape: {v}"
            );
        }
    }
}
