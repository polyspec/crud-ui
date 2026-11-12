//! Rule parameter checks (validation rules, "Parameter errors").
//!
//! A parameter outside the definitions, and a `validate` or `messages` key that is
//! not a registered rule, is a load failure located at the field's declaration
//! path. Rule names and parameters are checked when the specification loads,
//! fields and rules in declaration order (a field's `messages` keys after its
//! rules, before the fields it contains), including every literal a condition map or a
//! ternary can select; a value a ternary takes from the data is checked when it is
//! selected. Checking yields the typed parameter the rule uses.

use std::collections::HashMap;
use std::sync::Arc;

use serde_json::{Map, Value};

use crate::compose::{ComposeErrorCode, ComposeLoadError};

use super::errors::ValidateError;
use super::group_source::group_source_failure;
use super::keyed_maps::check_keyed_map_reference;
use super::length::{limit, range_limits, MAX_LIMIT};
use super::membership::{members, Comparable};
use super::numeric::{number_range, step};
use super::pattern::{compile, Program};
use super::references::{is_reference_target, REFERENCE_PARAMETER_MESSAGE};
use super::rules::get_rule;
use super::validator::{
    is_conditional, is_disabled, is_group_with_properties, selectable_literals,
};

/// A checked rule parameter.
pub(crate) enum Parameter {
    /// A rule whose parameter needs no value beyond its check.
    Unchecked,
    /// A `minlength` or `maxlength` limit.
    Limit(u64),
    /// `rangelength` limits.
    Range(u64, u64),
    /// A `min` or `max` bound.
    Bound(f64),
    /// `range` bounds.
    Bounds(f64, f64),
    /// A `step` above 0.
    Step(f64),
    /// A `mincount` or `maxcount` limit.
    Count(u64),
    /// `in` members.
    Members(Vec<Comparable>),
    /// A compiled `pattern` or `match`.
    Pattern(Arc<Program>),
}

/// Patterns compiled while the specification loaded, by source text.
#[derive(Default)]
pub(crate) struct Patterns(HashMap<String, Arc<Program>>);

/// Check every declared parameter of `properties`; returns the compiled patterns.
pub(crate) fn check_declared(properties: &Map<String, Value>) -> Result<Patterns, ValidateError> {
    let mut patterns = Patterns::default();
    check_fields(properties, properties, &mut Vec::new(), &mut patterns)?;
    Ok(patterns)
}

fn check_fields(
    root: &Map<String, Value>,
    properties: &Map<String, Value>,
    path: &mut Vec<String>,
    patterns: &mut Patterns,
) -> Result<(), ValidateError> {
    for (key, field) in properties {
        if !field.is_object() {
            continue;
        }
        path.push(key.clone());
        // The shape of multiple is checked before the field's group source and rules (schema.md, Acceptance criteria).
        if field
            .get("multiple")
            .is_some_and(|multiple| !is_multiple_shape(multiple))
        {
            return Err(ValidateError::Load(ComposeLoadError::with_trace(
                ComposeErrorCode::InvalidRuleParameter,
                format!(
                    "Invalid multiple at {}: expected a boolean, only or an object",
                    path.join(".")
                ),
                path.clone(),
            )));
        }
        if let Some(message) = group_source_failure(field, &path.join("."), root) {
            return Err(ValidateError::Load(ComposeLoadError::with_trace(
                ComposeErrorCode::InvalidRuleParameter,
                message,
                path.clone(),
            )));
        }
        // CUVR-094: the rules of a field are an object, or false for none; another value is a load failure.
        let rules = match field.get("validate") {
            None | Some(Value::Bool(false)) => None,
            Some(Value::Object(rules)) => Some(rules),
            Some(_) => {
                return Err(parameter_failure(
                    format!("Invalid validate at {}: expected an object", path.join(".")),
                    path,
                ));
            }
        };
        if let Some(rules) = rules {
            for (rule, value) in rules {
                check_name(rule, path)?;
                if is_disabled(value) {
                    continue;
                }
                if is_conditional(rule, value) {
                    for literal in selectable_literals(rule, value) {
                        if !is_disabled(&literal) {
                            check(rule, &literal, path, patterns)?;
                        }
                    }
                    continue;
                }
                if rule == "reference" {
                    check(rule, value, path, patterns)?;
                    if !value
                        .as_str()
                        .is_some_and(|target| is_reference_target(root, target))
                    {
                        return Err(ValidateError::Load(ComposeLoadError::with_trace(
                            ComposeErrorCode::InvalidRuleParameter,
                            REFERENCE_PARAMETER_MESSAGE.to_string(),
                            path.clone(),
                        )));
                    }
                    continue;
                }
                if let Parameter::Pattern(program) = check(rule, value, path, patterns)? {
                    if let Value::String(source) = value {
                        patterns.0.insert(source.clone(), program);
                    }
                }
            }
        }
        // CUVR-089: a message override is text; one of another type is a load failure.
        match field.get("messages") {
            None => {}
            Some(Value::Object(messages)) => {
                for (rule, message) in messages {
                    check_name(rule, path)?;
                    if !message.is_string() {
                        return Err(parameter_failure(
                            format!(
                                "Invalid messages.{rule} at {}: expected a string",
                                path.join(".")
                            ),
                            path,
                        ));
                    }
                }
            }
            Some(_) => {
                return Err(parameter_failure(
                    format!("Invalid messages at {}: expected an object", path.join(".")),
                    path,
                ));
            }
        }
        check_keyed_map_reference(field, path, root)?;
        if let Some(children) = is_group_with_properties(field) {
            check_fields(root, children, path, patterns)?;
        }
        path.pop();
    }
    Ok(())
}

/// The load failure `INVALID_RULE_PARAMETER` located at the field's declaration path.
fn parameter_failure(message: String, path: &[String]) -> ValidateError {
    ValidateError::Load(ComposeLoadError::with_trace(
        ComposeErrorCode::InvalidRuleParameter,
        message,
        path.to_vec(),
    ))
}

/// Fail with `UNKNOWN_RULE` when `rule`, a `validate` or `messages` key, is not a
/// registered rule; `path` is the field's declaration path.
fn check_name(rule: &str, path: &[String]) -> Result<(), ValidateError> {
    if get_rule(rule).is_some() {
        return Ok(());
    }
    Err(ValidateError::Load(ComposeLoadError::with_trace(
        ComposeErrorCode::UnknownRule,
        format!("Unknown rule: {rule}"),
        path.to_vec(),
    )))
}

/// Check the parameter `rule` uses; `path` is the field's declaration path.
/// A `false` or `null` parameter disables the rule and is never passed here.
pub(crate) fn check(
    rule: &str,
    parameter: &Value,
    path: &[String],
    patterns: &Patterns,
) -> Result<Parameter, ValidateError> {
    let invalid = |message: String| {
        ValidateError::Load(ComposeLoadError::with_trace(
            ComposeErrorCode::InvalidRuleParameter,
            message,
            path.to_vec(),
        ))
    };
    match rule {
        "minlength" | "maxlength" => limit(parameter).map(Parameter::Limit).ok_or_else(|| {
            invalid(format!(
                "Invalid {rule} parameter: expected an integer from 0 to {MAX_LIMIT}"
            ))
        }),
        "rangelength" => range_limits(parameter)
            .map(|(minimum, maximum)| Parameter::Range(minimum, maximum))
            .ok_or_else(|| {
                invalid(
                    "Invalid rangelength parameter: expected [minimum, maximum] integers \
                     with minimum not above maximum"
                        .to_string(),
                )
            }),
        "number" | "digits" => match parameter {
            Value::Bool(_) => Ok(Parameter::Unchecked),
            _ => Err(invalid(format!(
                "Invalid {rule} parameter: expected true or false"
            ))),
        },
        "min" | "max" => finite(parameter).map(Parameter::Bound).ok_or_else(|| {
            invalid(format!(
                "Invalid {rule} parameter: expected a finite number"
            ))
        }),
        "range" => number_range(parameter)
            .map(|(minimum, maximum)| Parameter::Bounds(minimum, maximum))
            .ok_or_else(|| {
                invalid(
                    "Invalid range parameter: expected [minimum, maximum] finite numbers \
                 with minimum not above maximum"
                        .to_string(),
                )
            }),
        "step" => step(parameter).map(Parameter::Step).ok_or_else(|| {
            invalid("Invalid step parameter: expected a finite number above 0".to_string())
        }),
        "mincount" | "maxcount" => limit(parameter).map(Parameter::Count).ok_or_else(|| {
            invalid(format!(
                "Invalid {rule} parameter: expected an integer from 0 to {MAX_LIMIT}"
            ))
        }),
        "in" => members(parameter)
            .map(Parameter::Members)
            .map_err(|error| invalid(error.message().to_string())),
        "equalTo" | "containedIn" | "typeFrom" | "minFrom" | "maxFrom" | "enddate" => {
            match parameter {
                Value::String(_) => Ok(Parameter::Unchecked),
                _ => Err(invalid(format!(
                    "Invalid {rule} parameter: expected a field reference string"
                ))),
            }
        }
        "notEqual" => match parameter {
            Value::String(_) | Value::Number(_) | Value::Bool(_) => Ok(Parameter::Unchecked),
            _ => Err(invalid(
                "Invalid notEqual parameter: expected a string, number or boolean".to_string(),
            )),
        },
        "reference" => match parameter {
            Value::String(_) => Ok(Parameter::Unchecked),
            _ => Err(invalid(REFERENCE_PARAMETER_MESSAGE.to_string())),
        },
        "unique" => match parameter {
            Value::String(_) | Value::Bool(true) => Ok(Parameter::Unchecked),
            _ => Err(invalid(
                "Invalid unique parameter: expected true, false or a string".to_string(),
            )),
        },
        "conditionTree" => {
            if super::condition_tree::is_parameter(parameter) {
                Ok(Parameter::Unchecked)
            } else {
                Err(invalid(super::condition_tree::PARAMETER_ERROR.to_string()))
            }
        }
        "pattern" | "match" => {
            let Value::String(source) = parameter else {
                return Err(invalid(format!(
                    "Invalid {rule} parameter: expected a pattern string"
                )));
            };
            if let Some(program) = patterns.0.get(source) {
                return Ok(Parameter::Pattern(Arc::clone(program)));
            }
            compile(source)
                .map(|program| Parameter::Pattern(Arc::new(program)))
                .map_err(|error| {
                    ValidateError::Load(ComposeLoadError::with_trace(
                        ComposeErrorCode::InvalidRulePattern,
                        format!("Invalid {rule} pattern: {error}"),
                        path.to_vec(),
                    ))
                })
        }
        _ => Ok(Parameter::Unchecked),
    }
}

/// A JSON number as a finite double.
fn finite(value: &Value) -> Option<f64> {
    value.as_f64().filter(|number| number.is_finite())
}

/// Whether a `multiple` declaration is a boolean, `only` or an object (schema.md, Acceptance criteria).
fn is_multiple_shape(multiple: &Value) -> bool {
    matches!(multiple, Value::Bool(_) | Value::Object(_)) || multiple.as_str() == Some("only")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn failure(properties: Value) -> (String, String, String) {
        let properties = properties.as_object().cloned().expect("a properties map");
        let Err(error) = check_declared(&properties) else {
            panic!("the declaration loaded");
        };
        (
            error.code().to_string(),
            error.message().to_string(),
            error.at(),
        )
    }

    #[test]
    fn fields_and_rules_are_checked_in_declaration_order() {
        let (code, message, at) = failure(json!({
            "a": { "type": "text", "validate": { "in": [" "], "pattern": "(" } },
            "b": { "type": "text", "validate": { "maxlength": -1 } },
        }));
        assert_eq!(code, "INVALID_RULE_PARAMETER");
        assert_eq!(message, "Invalid in parameter: members must not be empty");
        assert_eq!(at, "a");

        let (code, message, at) = failure(json!({
            "g": {
                "type": "group",
                "multiple": true,
                "validate": { "required": true },
                "properties": { "n": { "type": "text", "validate": { "match": "a{2}{3}" } } },
            },
        }));
        assert_eq!(code, "INVALID_RULE_PATTERN");
        assert_eq!(message, "Invalid match pattern: invalid quantifier at 4");
        assert_eq!(at, "g.n");
    }

    #[test]
    fn selectable_literals_are_checked_at_load() {
        for (rule, value, message) in [
            (
                "minlength",
                json!({ ".big": 1.5, "true": 2 }),
                "Invalid minlength parameter: expected an integer from 0 to 9007199254740991",
            ),
            (
                "maxlength",
                json!(".big ? 3 : -1"),
                "Invalid maxlength parameter: expected an integer from 0 to 9007199254740991",
            ),
            (
                "maxlength",
                json!(".a ? .limit : .b ? 2 : \"x\""),
                "Invalid maxlength parameter: expected an integer from 0 to 9007199254740991",
            ),
            (
                "rangelength",
                json!({ ".a": [3, 2] }),
                "Invalid rangelength parameter: expected [minimum, maximum] integers \
                 with minimum not above maximum",
            ),
        ] {
            let (code, actual, at) = failure(json!({
                "g": { "type": "group", "properties": {
                    "v": { "type": "text", "validate": { rule: value } },
                } },
            }));
            assert_eq!(code, "INVALID_RULE_PARAMETER");
            assert_eq!(actual, message, "{value}");
            assert_eq!(at, "g.v");
        }
    }

    #[test]
    fn unknown_rule_names_fail_the_load() {
        for (properties, name, at) in [
            (
                json!({ "a": { "type": "text", "validate": { "unknown": false } } }),
                "unknown",
                "a",
            ),
            (
                json!({ "g": { "type": "group", "messages": { "Required": "x" },
                    "properties": { "a": { "type": "text", "validate": { "typo": true } } } } }),
                "Required",
                "g",
            ),
        ] {
            let Err(ValidateError::Load(error)) = check_declared(properties.as_object().unwrap())
            else {
                panic!("{name} loaded");
            };
            assert_eq!(error.code.as_str(), "UNKNOWN_RULE");
            assert_eq!(error.message, format!("Unknown rule: {name}"));
            assert_eq!(error.trace.join("."), at);
        }
    }

    #[test]
    fn disabled_conditional_and_unchecked_parameters_load() {
        let properties = json!({
            "a": { "type": "text", "validate": {
                "minlength": false, "maxlength": null, "in": false, "pattern": null,
                "rangelength": ".x ? .range : false", "match": false,
                "min": ".x",
            } },
            "b": { "type": "text", "validate": {
                "maxlength": { ".x": 3, "true": null },
                "minlength": ".x ? .limit : .y ? 2 : false",
            } },
            // Only groups are descended into, as the validator does.
            "c": { "type": "text", "properties": { "d": { "validate": { "in": [""] } } } },
        });
        if let Err(error) = check_declared(properties.as_object().unwrap()) {
            panic!("{error:?}");
        }
    }
}
