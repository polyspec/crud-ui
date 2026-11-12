//! The public boundary of the validator for the bindings (CURP-030): JSON values cross it as
//! ordered-json values, which are checked by the input text rules of their argument and read with
//! their members in order and their numbers as ECMAScript doubles; results leave as ordered-json
//! values. Every operation here runs the operation of the same name of the crate.

use bindgen_core::OrderedMap;
use polyspec_ordered_json::Value as JsonValue;
use serde_json::Value;

use crate::text::{
    check_inputs, check_specification, decode, from_ordered, validate_detail_text,
    validate_list_text, validate_text, JsonString, JsonText, VALUE_LIMIT_MESSAGE,
};
use crate::validate::canonical::json_number;
use crate::{FormInputError, ValidateError};

/// The options of a validation at the boundary: the composition files by name and the base path.
#[derive(Debug, Clone, Default)]
pub struct ValidateOptions {
    /// The composition files by name; none reads no file.
    pub files: Option<OrderedMap<JsonValue>>,
    /// The base path of relative references; none is the root.
    pub basepath: Option<String>,
}

/// One validation error at the boundary.
#[derive(Debug, Clone)]
pub struct ValidationError {
    /// Data path with row keys.
    pub path: String,
    /// The field name.
    pub field: String,
    /// The declared rule name.
    pub rule: String,
    /// The message.
    pub message: String,
    /// The value that failed, null for a missing value (CUVR-090).
    pub value: JsonValue,
}

/// A validation result at the boundary.
#[derive(Debug, Clone)]
pub struct ValidationResult {
    /// Whether the data has no error.
    pub valid: bool,
    /// The errors, the first of each field, in declaration order.
    pub errors: Vec<ValidationError>,
    /// The data paths that `design.show` hides (CUVR-093).
    pub hidden: Vec<String>,
}

/// The JSON text value of a boundary value. ordered-json values hold only what JSON text holds, so
/// the conversion fails only on a broken invariant of ordered-json.
pub(crate) fn text_of(value: &JsonValue) -> Result<JsonText, ValidateError> {
    from_ordered(value).map_err(|error| {
        ValidateError::Input(FormInputError::new(format!(
            "Invalid JSON value at byte {}",
            error.offset
        )))
    })
}

/// The files of the options as one JSON text object, in their order.
fn files_text(files: &OrderedMap<JsonValue>) -> Result<JsonText, ValidateError> {
    let mut members = Vec::new();
    for (name, file) in files.iter() {
        members.push((JsonString::Text(name.to_owned()), text_of(file)?));
    }
    Ok(JsonText::Object(members))
}

/// A value that enters the boundary as the argument `name` (CURP-030): the input text rules of the
/// argument, then the value with its members in order.
pub fn input(name: &str, value: &JsonValue) -> Result<Value, ValidateError> {
    let text = text_of(value)?;
    check_inputs(&[(name, Some(&text))])?;
    decode(&text)
}

/// A specification that enters the boundary (CURP-030): the input text rules of a specification,
/// whose invalid text is a load failure (CUIT-023), then the value.
pub fn specification(value: &JsonValue) -> Result<Value, ValidateError> {
    let text = text_of(value)?;
    check_specification(Some(&text), None)?;
    decode(&text)
}

/// Composition files that enter the boundary (CURP-030): the input text rules of the files, whose
/// invalid text is a load failure located at the file (CUIT-023), then each file in its order.
pub fn files(
    files: &OrderedMap<JsonValue>,
) -> Result<serde_json::Map<String, Value>, ValidateError> {
    let text = files_text(files)?;
    check_specification(None, Some(&text))?;
    match decode(&text)? {
        Value::Object(files) => Ok(files),
        // files_text writes an object.
        _ => Ok(serde_json::Map::new()),
    }
}

/// A value that leaves the boundary (CURP-030): members in order and each number as
/// `Number::toString` writes its double; a value nested beyond 256 levels fails.
pub fn output(value: &Value) -> Result<JsonValue, FormInputError> {
    Ok(match value {
        Value::Null => JsonValue::null(),
        Value::Bool(b) => JsonValue::boolean(*b),
        Value::Number(n) => JsonValue::from_f64(json_number(n)).map_err(|error| {
            FormInputError::new(format!("Invalid number in the result: {}", error.message()))
        })?,
        Value::String(text) => JsonValue::string(text),
        Value::Array(items) => {
            let items = items.iter().map(output).collect::<Result<Vec<_>, _>>()?;
            JsonValue::array(&items).map_err(result_error)?
        }
        Value::Object(members) => {
            let mut map = polyspec_ordered_json::OrderedMap::new();
            for (key, member) in members {
                map.insert(JsonValue::string(key), output(member)?)
                    .map_err(|error| FormInputError::new(error.message()))?;
            }
            JsonValue::object(&map).map_err(result_error)?
        }
    })
}

/// The failure of a value that leaves the boundary: beyond 256 levels it is the value limit of the
/// result (CURP-030), and any other refusal of ordered-json keeps its message.
fn result_error(error: polyspec_ordered_json::Error) -> FormInputError {
    match error {
        polyspec_ordered_json::Error::MaximumDepthExceeded { .. } => {
            FormInputError::new(format!("{VALUE_LIMIT_MESSAGE}: result"))
        }
        other => FormInputError::new(other.message()),
    }
}

/// The result of [`crate::validate`] at the boundary.
fn result_of(result: crate::validate::ValidationResult) -> Result<ValidationResult, ValidateError> {
    let mut errors = Vec::with_capacity(result.errors.len());
    for error in result.errors {
        errors.push(ValidationError {
            value: output(&error.value)?,
            path: error.path,
            field: error.field,
            rule: error.rule,
            message: error.message,
        });
    }
    Ok(ValidationResult {
        valid: result.valid,
        errors,
        hidden: result.hidden,
    })
}

/// The files and the base path of the options as JSON text arguments.
fn option_texts(
    options: &ValidateOptions,
) -> Result<(Option<JsonText>, Option<JsonText>), ValidateError> {
    let files = match &options.files {
        Some(files) => Some(files_text(files)?),
        None => None,
    };
    let basepath = options
        .basepath
        .as_ref()
        .map(|basepath| JsonText::String(JsonString::Text(basepath.clone())));
    Ok((files, basepath))
}

/// [`crate::validate`] at the boundary.
pub fn validate(
    spec: &JsonValue,
    data: &JsonValue,
    options: &ValidateOptions,
) -> Result<ValidationResult, ValidateError> {
    let (files, basepath) = option_texts(options)?;
    let result = validate_text(
        &text_of(spec)?,
        Some(&text_of(data)?),
        files.as_ref(),
        basepath.as_ref(),
    )?;
    result_of(result)
}

/// [`crate::validate_list`] at the boundary.
pub fn validate_list(spec: &JsonValue, options: &ValidateOptions) -> Result<(), ValidateError> {
    let (files, basepath) = option_texts(options)?;
    validate_list_text(&text_of(spec)?, files.as_ref(), basepath.as_ref())
}

/// [`crate::validate_detail`] at the boundary.
pub fn validate_detail(spec: &JsonValue, options: &ValidateOptions) -> Result<(), ValidateError> {
    let (files, basepath) = option_texts(options)?;
    validate_detail_text(&text_of(spec)?, files.as_ref(), basepath.as_ref())
}

/// [`crate::hidden_paths`] at the boundary.
pub fn hidden_paths(spec: &JsonValue, data: &JsonValue) -> Result<Vec<String>, ValidateError> {
    let spec = specification(spec)?;
    let data = input("data", data)?;
    crate::hidden_paths(&spec, &data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(text: &str) -> JsonValue {
        polyspec_ordered_json::parse(
            text.as_bytes(),
            &polyspec_ordered_json::ParseOptions::default(),
        )
        .unwrap()
    }

    /// CURP-030: members keep their order and numbers leave as ECMAScript doubles.
    #[test]
    fn values_cross_in_order_as_doubles() {
        let value = input("data", &json(r#"{"b":9007199254740993,"a":[1.50,"x"]}"#)).unwrap();
        let back = output(&value).unwrap();
        assert_eq!(back.raw(), r#"{"b":9007199254740992,"a":[1.5,"x"]}"#);
    }

    /// CURP-030, CUIT-027: an unpaired surrogate fails as the input text of its argument.
    #[test]
    fn invalid_text_fails_with_its_argument() {
        let error = input("data", &json(r#"{"a":"\ud800"}"#)).unwrap_err();
        assert_eq!(
            error.message(),
            "Text must be Unicode scalar values: data.a"
        );
    }

    /// The boundary validation gives the result of the crate.
    #[test]
    fn validate_runs_the_validation() {
        let spec = json(
            r#"{"type":"group","properties":{"name":{"type":"text","validate":{"required":true}}}}"#,
        );
        let result = validate(&spec, &json("{}"), &ValidateOptions::default()).unwrap();
        assert!(!result.valid);
        assert_eq!(result.errors[0].value.raw(), "null");
    }
}
