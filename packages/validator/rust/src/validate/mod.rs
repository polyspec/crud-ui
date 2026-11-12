//! CRUDUI validation entry point (SPEC §2 pipeline).
//!
//! Wires the three CRUDUI passes in order (G5 compose first → §3 traversal → §2 G1
//! value evaluation):
//!
//! 1. compose — `compose_spec` / `compose_properties` expand `$ref`/`$patch` into
//!    a single spec. An unresolved composition returns `Err(ComposeLoadError)`
//!    HERE (a LOAD failure, NOT `valid:false`) — an unresolved `$ref` never
//!    yields `valid:true`.
//! 2. validate — `Validator` traverses the composed spec and runs the `validate`
//!    slot (conditional rule values evaluated by the CRUDUI expression engine, then
//!    handed to the rule registry).
//!
//! The compose pass reuses the existing `crate::compose` module and the
//! expression engine reuses `crate::expr`. Nothing re-implements them.

pub mod canonical;
mod choice_data;
mod condition_tree;
mod data_limits;
pub mod errors;
pub mod group_source;
mod keyed_maps;
mod length;
mod membership;
pub mod numeric;
mod parameters;
mod pattern;
mod references;
pub mod rules;
mod unicode;
pub mod validator;
pub mod visibility;
mod whitespace;

pub use errors::{FormInputError, ValidateError};
pub use validator::{ValidationError, ValidationResult, Validator};

use serde_json::{Map, Value};

use crate::compose::{
    compose_properties, compose_spec, member_ordered, ComposeOptions, FileLoader, MemoryLoader,
};
use crate::forbidden_scan::scan_forbidden_keys;
use data_limits::{check_data_limits, data_limits};

/// Options for a CRUDUI validation run.
#[derive(Default)]
pub struct ValidateOptions<'a> {
    /// Virtual file set for `$ref` resolution (default empty — no `$ref`).
    pub files: Option<Map<String, Value>>,
    /// A custom loader (overrides `files`).
    pub loader: Option<&'a dyn FileLoader>,
    /// Basepath for relative `$ref` resolution.
    pub basepath: Option<String>,
}

/// Validate `data` against a CRUDUI spec. The spec may carry `$ref`/`$patch`; they are
/// expanded first via the compose pass. An unresolved composition or a rule
/// parameter outside the validation-rule definitions returns
/// `Err(ValidateError::Load)` and data with the wrong shape returns
/// `Err(ValidateError::Input)`; neither produces a validation result.
///
/// Two entry shapes (JS `validate`):
///   (a) a full root group spec `{ type:'group', properties:{…} }` — compose the
///       whole spec, then read its composed `properties`.
///   (b) a properties-layer composition entry `{ $ref, $patch }` with no own
///       `properties` — compose it AS a properties map directly.
pub fn validate(
    spec: &Value,
    data: &Value,
    options: &ValidateOptions,
) -> Result<ValidationResult, ValidateError> {
    // Root data is a request precondition, checked before composition.
    if !data.is_object() {
        return Err(FormInputError::new("Form data must be an object").into());
    }
    let owned_loader;
    let loader: &dyn FileLoader = match options.loader {
        Some(l) => l,
        None => {
            // Without files a composition reads no file.
            owned_loader = match &options.files {
                Some(files) => MemoryLoader::new(files.clone()),
                None => MemoryLoader::new(Map::new()),
            };
            &owned_loader
        }
    };
    let opts = match &options.basepath {
        Some(bp) => ComposeOptions::with_basepath(bp.clone()),
        None => ComposeOptions::default(),
    };

    // The specification is read in member order; the data keeps its own order.
    let spec = &member_ordered(spec);
    // CUVR-088: a specification that is not an object fails before composition; it is never a
    // form without fields.
    let Some(spec_map) = spec.as_object().cloned() else {
        return Err(FormInputError::new("Form specification must be an object").into());
    };

    let has_own_properties = matches!(spec.get("properties"), Some(Value::Object(_)));
    let is_composition_entry = spec_map.contains_key("$ref") || spec_map.contains_key("$patch");

    let properties: Map<String, Value> = if is_composition_entry && !has_own_properties {
        compose_properties(spec_map, loader, &opts)?
    } else {
        let composed = compose_spec(spec_map, loader, &opts)?;
        // CUVR-091: a root without object properties after composition is no form.
        match composed.get("properties") {
            Some(Value::Object(properties)) => properties.clone(),
            _ => {
                return Err(
                    FormInputError::new("A form spec must be a group with properties").into(),
                )
            }
        }
    };

    // Load-path forbidden-scan (SPEC §6): walk the composed single spec to
    // arbitrary depth and reject any forbidden meta key BEFORE validation entry.
    // A hit returns Err(ComposeLoadError) (a LOAD failure), never `valid:false`.
    // This closes the deep-nesting leak the typed model alone could not (R1).
    let props_value = Value::Object(properties.clone());
    scan_forbidden_keys(&props_value, &["properties".to_string()])?;
    // The form root declarations are scanned like the fields they sit beside.
    for key in ["buttons", "action"] {
        if let Some(declared) = spec.get(key) {
            scan_forbidden_keys(declared, &[key.to_string()])?;
        }
    }

    // The data limits are checked after the forbidden-key scan and before the rule parameters.
    let limits = data_limits(spec)?;
    // Rule parameters are checked after composition and the forbidden-key scan.
    let validator = Validator::new(properties)?;
    // The data is measured before any rule.
    check_data_limits(data, &limits)?;
    validator.validate(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// CUVR-088: a specification that is not an object is an input failure, never a valid result.
    #[test]
    fn a_specification_that_is_not_an_object_fails() {
        for spec in [json!([]), json!("form"), json!(5), json!(null), json!(true)] {
            match validate(&spec, &json!({}), &ValidateOptions::default()) {
                Err(ValidateError::Input(error)) => {
                    assert_eq!(error.message, "Form specification must be an object");
                }
                other => panic!("{spec} gave {other:?}"),
            }
        }
    }
}
