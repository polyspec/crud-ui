//! The public boundary of the validator for the bindings (CURP-030): JSON values cross it as
//! polyspec-json values, which are checked by the input text rules of their argument and read with
//! their members in order and their numbers as ECMAScript doubles; results leave as polyspec-json
//! values. Every operation here runs the operation of the same name of the crate.

use std::cell::RefCell;

use binding_core::{Failure, OrderedMap};
use polyspec_json::Value as JsonValue;
use serde_json::Value;

use crate::compose::{ComposeErrorCode, ComposeLoadError, ComposeResult, LoadedDoc};
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

/// The JSON text value of a boundary value. polyspec-json values hold only what JSON text holds, so
/// the conversion fails only on a broken invariant of polyspec-json.
pub(crate) fn text_of(value: &JsonValue) -> Result<JsonText, ValidateError> {
    from_ordered(value).map_err(|error| {
        ValidateError::InvalidFormInput(FormInputError::new(format!(
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
            let mut map = polyspec_json::OrderedMap::new();
            for (key, member) in members {
                map.insert(JsonValue::string(key), output(member)?)
                    .map_err(|error| FormInputError::new(error.message()))?;
            }
            JsonValue::object(&map).map_err(result_error)?
        }
    })
}

/// The failure of a value that leaves the boundary: beyond 256 levels it is the value limit of the
/// result (CURP-030), and any other refusal of polyspec-json keeps its message.
fn result_error(error: polyspec_json::Error) -> FormInputError {
    match error {
        polyspec_json::Error::MaximumDepthExceeded { .. } => {
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

/// [`crate::validate()`] at the boundary.
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

/// A source of composition files that the caller implements (CURP-031).
pub trait FileLoader {
    /// The key of the file that `path` names from `basepath`.
    ///
    /// # Errors
    /// The failure of the implementation.
    fn normalize(&mut self, path: &str, basepath: &str) -> Result<String, Failure<ValidateError>>;

    /// The document of the file at `key`.
    ///
    /// # Errors
    /// The failure of the implementation.
    fn load(&mut self, key: &str) -> Result<JsonValue, Failure<ValidateError>>;
}

/// The message of `files` given with a loader (CURP-031).
pub const FILES_WITH_LOADER_MESSAGE: &str = "Files and a loader are both given";

/// A caller's loader as the loader of the composition (CURP-031). The composition carries only
/// load failures, so the first other failure is kept here and the operation that used the loader
/// returns it with [`LoaderBridge::settle`]; after a failure the caller's loader is not called.
pub struct LoaderBridge<'a> {
    loader: RefCell<&'a mut dyn FileLoader>,
    failure: RefCell<Option<Failure<ValidateError>>>,
}

impl<'a> LoaderBridge<'a> {
    /// The bridge of a caller's loader.
    pub fn new(loader: &'a mut dyn FileLoader) -> Self {
        Self {
            loader: RefCell::new(loader),
            failure: RefCell::new(None),
        }
    }

    /// The result of the operation that used the loader: the failure that the loader or a check of
    /// its document gave, before the result of the operation.
    ///
    /// # Errors
    /// The kept failure, or the failure of the operation as a kind.
    pub fn settle<T, E>(self, result: Result<T, E>) -> Result<T, Failure<E>>
    where
        E: From<ValidateError>,
    {
        match self.failure.into_inner() {
            Some(Failure::Kind(error)) => Err(Failure::Kind(E::from(error))),
            Some(Failure::Raised(raised)) => Err(Failure::Raised(raised)),
            Some(Failure::Callback(error)) => Err(Failure::Callback(error)),
            None => result.map_err(Failure::Kind),
        }
    }

    /// Keep the first failure and give the load failure that ends the composition.
    fn keep(&self, failure: Failure<ValidateError>, key: &str) -> ComposeLoadError {
        let mut kept = self.failure.borrow_mut();
        if kept.is_none() {
            *kept = Some(failure);
        }
        Self::ended(key)
    }

    /// The load failure that ends the composition after a kept failure; the operation returns the
    /// kept failure, never this one.
    fn ended(key: &str) -> ComposeLoadError {
        ComposeLoadError::with_trace(
            ComposeErrorCode::RefFileNotFound,
            format!("$ref file not found: {key}"),
            vec![key.to_owned()],
        )
    }

    /// The document that the loader gave for `key`, checked as a file of `files` (CUIT-023).
    fn document(key: &str, document: &JsonValue) -> Result<Value, ValidateError> {
        let text = text_of(document)?;
        let files = JsonText::Object(vec![(JsonString::Text(key.to_owned()), text.clone())]);
        check_specification(None, Some(&files))?;
        decode(&text)
    }
}

impl crate::compose::FileLoader for LoaderBridge<'_> {
    fn normalize(&self, path: &str, basepath: &str) -> String {
        if self.failure.borrow().is_some() {
            return String::new();
        }
        let key = self.loader.borrow_mut().normalize(path, basepath);
        match key {
            Ok(key) => key,
            Err(failure) => {
                drop(self.keep(failure, path));
                String::new()
            }
        }
    }

    fn load(&self, key: &str) -> ComposeResult<LoadedDoc> {
        if self.failure.borrow().is_some() {
            return Err(Self::ended(key));
        }
        let document = self.loader.borrow_mut().load(key);
        let document = match document {
            Ok(document) => document,
            Err(failure) => return Err(self.keep(failure, key)),
        };
        match Self::document(key, &document) {
            Ok(Value::Object(document)) => Ok(document),
            // CUSC-092: a file is an object.
            Ok(_) => Err(crate::compose::loader::not_object(key)),
            Err(ValidateError::Load(error)) => Err(error),
            Err(error) => Err(self.keep(Failure::Kind(error), key)),
        }
    }
}

/// The base path of the options, after `files` given with a loader are refused (CURP-031).
fn loader_basepath(options: &ValidateOptions) -> Result<Option<String>, ValidateError> {
    if options.files.is_some() {
        return Err(FormInputError::new(FILES_WITH_LOADER_MESSAGE).into());
    }
    Ok(options.basepath.clone())
}

/// [`validate`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the validation as a kind, or the failure of the loader.
pub fn validate_with_loader(
    spec: &JsonValue,
    data: &JsonValue,
    loader: &mut dyn FileLoader,
    options: &ValidateOptions,
) -> Result<ValidationResult, Failure<ValidateError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let basepath = loader_basepath(options)?;
        let spec = specification(spec)?;
        let data = input("data", data)?;
        let options = crate::ValidateOptions {
            files: None,
            loader: Some(&bridge),
            basepath,
        };
        result_of(crate::validate(&spec, &data, &options)?)
    })();
    bridge.settle(result)
}

/// [`validate_list`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the validation as a kind, or the failure of the loader.
pub fn validate_list_with_loader(
    spec: &JsonValue,
    loader: &mut dyn FileLoader,
    options: &ValidateOptions,
) -> Result<(), Failure<ValidateError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let basepath = loader_basepath(options)?;
        let spec = specification(spec)?;
        let options = crate::ValidateListOptions {
            files: None,
            loader: Some(&bridge),
            basepath,
        };
        crate::validate_list(&spec, &options)
    })();
    bridge.settle(result)
}

/// [`validate_detail`] with the files of a loader (CURP-031).
///
/// # Errors
/// The failure of the validation as a kind, or the failure of the loader.
pub fn validate_detail_with_loader(
    spec: &JsonValue,
    loader: &mut dyn FileLoader,
    options: &ValidateOptions,
) -> Result<(), Failure<ValidateError>> {
    let bridge = LoaderBridge::new(loader);
    let result = (|| {
        let basepath = loader_basepath(options)?;
        let spec = specification(spec)?;
        let options = crate::ValidateDetailOptions {
            files: None,
            loader: Some(&bridge),
            basepath,
        };
        crate::validate_detail(&spec, &options)
    })();
    bridge.settle(result)
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
        polyspec_json::parse(text.as_bytes(), &polyspec_json::ParseOptions::default()).unwrap()
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

    /// A loader over a list of files; `fail` names a key whose load fails in the loader.
    struct Files {
        files: Vec<(&'static str, &'static str)>,
        fail: Option<&'static str>,
        loads: usize,
    }

    impl FileLoader for Files {
        fn normalize(
            &mut self,
            path: &str,
            basepath: &str,
        ) -> Result<String, Failure<ValidateError>> {
            Ok(format!("{basepath}:{path}"))
        }

        fn load(&mut self, key: &str) -> Result<JsonValue, Failure<ValidateError>> {
            self.loads += 1;
            if self.fail == Some(key) {
                return Err(Failure::Callback("the loader failed".into()));
            }
            match self.files.iter().find(|(name, _)| *name == key) {
                Some((_, text)) => Ok(json(text)),
                None => Err(Failure::Kind(ValidateError::Load(
                    ComposeLoadError::with_trace(
                        ComposeErrorCode::RefFileNotFound,
                        format!("$ref file not found: {key}"),
                        vec![key.to_owned()],
                    ),
                ))),
            }
        }
    }

    fn loader(files: &[(&'static str, &'static str)]) -> Files {
        Files {
            files: files.to_vec(),
            fail: None,
            loads: 0,
        }
    }

    fn based(basepath: &str) -> ValidateOptions {
        ValidateOptions {
            files: None,
            basepath: Some(basepath.to_owned()),
        }
    }

    /// CURP-031: the loader names the key from the base path and gives the document.
    #[test]
    fn a_loader_gives_the_files() {
        let mut files = loader(&[
            (
                "specs:Base.yml",
                r#"{"properties":{"name":{"type":"text","validate":{"required":true}}}}"#,
            ),
            (
                "specs:List.yml",
                r#"{"properties":{"name":{"type":"text"}}}"#,
            ),
        ]);
        let spec = json(r#"{"type":"group","properties":{"$ref":"Base.yml"}}"#);
        let result = validate_with_loader(&spec, &json("{}"), &mut files, &based("specs")).unwrap();
        assert_eq!(result.errors[0].rule, "required");
        let reference = json(r#"{"$ref":"List.yml"}"#);
        validate_list_with_loader(&reference, &mut files, &based("specs")).unwrap();
        validate_detail_with_loader(&reference, &mut files, &based("specs")).unwrap();
    }

    /// CURP-031, CUSC-092, CUIT-023: a document is checked as a file when the loader returns it.
    #[test]
    fn a_loaded_document_is_checked_as_a_file() {
        let spec = json(r#"{"type":"group","properties":{"$ref":"Base.yml"}}"#);
        let options = ValidateOptions::default();
        let mut list = loader(&[(":Base.yml", r#"["name"]"#)]);
        let Err(Failure::Kind(ValidateError::Load(error))) =
            validate_with_loader(&spec, &json("{}"), &mut list, &options)
        else {
            panic!("a list is no file");
        };
        assert_eq!(error.code.as_str(), "REF_FORMAT_ERROR");
        assert_eq!(error.message, "$ref file is not an object: :Base.yml");
        let mut text = loader(&[(":Base.yml", r#"{"name":{"label":"\ud800"}}"#)]);
        let Err(Failure::Kind(ValidateError::Load(error))) =
            validate_with_loader(&spec, &json("{}"), &mut text, &options)
        else {
            panic!("invalid text is no file");
        };
        assert_eq!(error.code.as_str(), "INVALID_TEXT");
        assert_eq!(error.trace, [":Base.yml", "name", "label"]);
    }

    /// CURP-031: a failure of the loader reaches the caller unchanged and ends the reading.
    #[test]
    fn a_failure_of_the_loader_reaches_the_caller() {
        let spec = json(
            r#"{"type":"group","properties":{"a":{"type":"group","properties":{"$ref":"A.yml"}},"b":{"type":"group","properties":{"$ref":"B.yml"}}}}"#,
        );
        let options = ValidateOptions::default();
        let mut files = loader(&[(":B.yml", "{}")]);
        files.fail = Some(":A.yml");
        let Err(Failure::Callback(error)) =
            validate_with_loader(&spec, &json("{}"), &mut files, &options)
        else {
            panic!("the loader failed");
        };
        assert_eq!(error.to_string(), "the loader failed");
        assert_eq!(files.loads, 1);
        let mut missing = loader(&[]);
        let Err(Failure::Kind(ValidateError::Load(error))) = validate_with_loader(
            &json(r#"{"type":"group","properties":{"$ref":"A.yml"}}"#),
            &json("{}"),
            &mut missing,
            &options,
        ) else {
            panic!("the file is missing");
        };
        assert_eq!(error.code.as_str(), "REF_FILE_NOT_FOUND");
    }

    /// CURP-031: files given with a loader fail.
    #[test]
    fn files_with_a_loader_fail() {
        let mut files = loader(&[]);
        let options = ValidateOptions {
            files: Some(OrderedMap::new()),
            basepath: None,
        };
        let Err(Failure::Kind(error)) = validate_with_loader(
            &json(r#"{"type":"group","properties":{}}"#),
            &json("{}"),
            &mut files,
            &options,
        ) else {
            panic!("files with a loader");
        };
        assert_eq!(error.message(), FILES_WITH_LOADER_MESSAGE);
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
