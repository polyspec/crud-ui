//! Input text (docs/spec/input-text.md).
//!
//! Every string and object member name of a specification, a composition file
//! and caller data is a sequence of Unicode scalar values. A Rust `String` is
//! always one, so the value entry points need no check. JSON text can still
//! carry an unpaired surrogate escape such as `"\ud800"`, which `serde_json`
//! refuses to decode. [`JsonText`] reads such a document without replacing
//! anything, and [`check_specification`] and [`check_inputs`] report the same
//! failures as every other runtime: the load failure `INVALID_TEXT` for a
//! specification or a file, and `INVALID_FORM_INPUT` for other caller values.

use std::fmt;

use serde_json::{Map, Number, Value};

use crate::compose::{ComposeErrorCode, ComposeLoadError};
use crate::validate::{FormInputError, ValidateError, ValidateOptions, ValidationResult};
use crate::{ValidateDetailOptions, ValidateListOptions};

/// Message of every input text failure.
pub const MESSAGE: &str = "Text must be Unicode scalar values";

/// Message of every value beyond the limits.
pub const VALUE_LIMIT_MESSAGE: &str = "Recursive or excessively nested value";

/// Maximum nodes a value may hold: every array, object, string, number, boolean and null.
pub(crate) const NODE_LIMIT: usize = 1_000_000;

/// Maximum levels of arrays and objects a value may nest (CUIT-022).
pub(crate) const NESTING_LIMIT: usize = 256;

/// A string or member name of a JSON document: valid text, or the UTF-16
/// code units of text that holds an unpaired surrogate.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum JsonString {
    /// A sequence of Unicode scalar values.
    Text(String),
    /// Code units that include an unpaired surrogate.
    Units(Vec<u16>),
}

impl JsonString {
    /// The text, when it is valid.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            JsonString::Text(text) => Some(text),
            JsonString::Units(_) => None,
        }
    }
}

/// A JSON document read without replacing any text.
///
/// A value owns each of its nodes: it shares no container and does not contain itself. A language
/// value that shares a container or contains itself is walked as the tree it denotes by the
/// binding that describes it to the core (CUIT-042).
#[derive(Clone, Debug, PartialEq)]
pub enum JsonText {
    /// `null`.
    Null,
    /// `true` or `false`.
    Bool(bool),
    /// A number, kept as written.
    Number(String),
    /// A string.
    String(JsonString),
    /// An array.
    Array(Vec<JsonText>),
    /// An object with unique member names.
    Object(Vec<(JsonString, JsonText)>),
}

/// JSON text that is not one JSON document.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JsonTextError {
    /// Byte offset of the first character that is not accepted.
    pub offset: usize,
}

impl fmt::Display for JsonTextError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Invalid JSON text at byte {}", self.offset)
    }
}

impl std::error::Error for JsonTextError {}

impl JsonText {
    /// Read one JSON document with the reader of polyspec-json (C-1): its grammar (RFC 8259), its
    /// nesting limit of 256 levels (CUIT-022), and a repeated member name refused, keeping every
    /// string as written, an unpaired surrogate escape included.
    pub fn parse(text: &str) -> Result<JsonText, JsonTextError> {
        let options = polyspec_json::ParseOptions {
            max_depth: None,
            reject_duplicates: Some(true),
        };
        let value = polyspec_json::parse(text.as_bytes(), &options).map_err(text_error)?;
        from_ordered(&value)
    }

    /// The member `name` of an object.
    pub fn get(&self, name: &str) -> Option<&JsonText> {
        match self {
            JsonText::Object(members) => members
                .iter()
                .find(|(member, _)| member.as_str() == Some(name))
                .map(|(_, value)| value),
            _ => None,
        }
    }

    /// The item at `index` of an array.
    pub fn item(&self, index: usize) -> Option<&JsonText> {
        match self {
            JsonText::Array(items) => items.get(index),
            _ => None,
        }
    }

    /// The value as [`Value`], or `None` when it holds invalid text, a number
    /// `serde_json` does not accept, or a value beyond its limits.
    pub fn to_value(&self) -> Option<Value> {
        if value_failure(self) == Some(ValueFailure::Limit) {
            return None;
        }
        json_text_to_value(self)
    }

    /// The document's shape for request checks that read only kinds and valid
    /// names: invalid text becomes an empty string, an invalid member name a
    /// name no valid request member uses, and a number `serde_json` does not
    /// accept `null`. A value beyond its limits has no shape and is `null`. The
    /// shape is never an operation input; the text checks run before any part of
    /// it reaches an operation.
    pub fn shape(&self) -> Value {
        if value_failure(self) == Some(ValueFailure::Limit) {
            return Value::Null;
        }
        shape_of(self)
    }

    /// Whether the first failure of the value is invalid text (see [`JsonText::invalid_path`]).
    pub fn has_invalid_text(&self) -> bool {
        matches!(value_failure(self), Some(ValueFailure::Text(_)))
    }

    /// The path of the first failure when it is invalid text: the path of a string, or of the
    /// object whose member name is invalid. Members are visited in code point order of their names
    /// after every member name is checked, and array items in index order.
    pub fn invalid_path(&self) -> Option<Vec<String>> {
        match value_failure(self) {
            Some(ValueFailure::Text(path)) => Some(path),
            _ => None,
        }
    }

    /// Whether this value holds a limit violation (too many nodes or too deep nesting).
    pub fn has_limit_violation(&self) -> bool {
        value_failure(self) == Some(ValueFailure::Limit)
    }
}

/// The failure of a JSON text at the offset that the reader reports.
fn text_error(error: polyspec_json::Error) -> JsonTextError {
    let offset = match error.offset().map(usize::try_from) {
        Some(Ok(offset)) => offset,
        // A failure without an offset, or one beyond usize, is placed at the end of the text.
        _ => usize::MAX,
    };
    JsonTextError { offset }
}

/// A JSON string of the UTF-16 code units of a string value: text when they are valid UTF-16.
fn json_string(value: &polyspec_json::Value) -> Result<JsonString, JsonTextError> {
    let mut units = Vec::new();
    for unit in value.string_units().map_err(text_error)? {
        // polyspec-json gives UTF-16 code units, each below 65536.
        match u16::try_from(unit) {
            Ok(unit) => units.push(unit),
            Err(_) => return Err(JsonTextError { offset: usize::MAX }),
        }
    }
    Ok(match String::from_utf16(&units) {
        Ok(text) => JsonString::Text(text),
        Err(_) => JsonString::Units(units),
    })
}

/// The JSON text value of a value that polyspec-json read.
pub(crate) fn from_ordered(value: &polyspec_json::Value) -> Result<JsonText, JsonTextError> {
    use polyspec_json::Kind;
    Ok(match value.kind() {
        Kind::Null => JsonText::Null,
        Kind::Boolean => JsonText::Bool(value.boolean_value().map_err(text_error)?),
        Kind::Number => JsonText::Number(value.number_literal().map_err(text_error)?.to_owned()),
        Kind::String => JsonText::String(json_string(value)?),
        Kind::Array => JsonText::Array(
            value
                .items()
                .map_err(text_error)?
                .iter()
                .map(from_ordered)
                .collect::<Result<_, _>>()?,
        ),
        Kind::Object => JsonText::Object(
            value
                .members()
                .map_err(text_error)?
                .iter()
                .map(|(name, member)| Ok((json_string(name)?, from_ordered(member)?)))
                .collect::<Result<_, JsonTextError>>()?,
        ),
    })
}

/// The first failure of a value, which the text and limit checks report.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum ValueFailure {
    /// Invalid text at this path (the path of its string, or of the object whose member name is invalid).
    Text(Vec<String>),
    /// A value beyond its limits, reached before any text failure in the walk order.
    Limit,
}

/// The nodes of one walk.
#[derive(Default)]
struct Walk {
    nodes: usize,
}

impl Walk {
    /// Count a node at `depth`; false when it takes the value beyond its limits.
    fn admit(&mut self, node: &JsonText, depth: usize) -> bool {
        self.nodes += 1;
        if self.nodes > NODE_LIMIT {
            return false;
        }
        depth < NESTING_LIMIT || !matches!(node, JsonText::Array(_) | JsonText::Object(_))
    }
}

/// Whether the value holds a failure, walked in member order: the quick walk that precedes the
/// ordered one, with its own node count.
fn holds_failure(value: &JsonText, depth: usize, walk: &mut Walk) -> bool {
    let node = value;
    {
        if !walk.admit(node, depth) {
            return true;
        }
        match node {
            JsonText::String(text) => text.as_str().is_none(),
            JsonText::Array(items) => items
                .iter()
                .any(|item| holds_failure(item, depth + 1, walk)),
            JsonText::Object(members) => members.iter().any(|(name, member)| {
                name.as_str().is_none() || holds_failure(member, depth + 1, walk)
            }),
            _ => false,
        }
    }
}

/// The first failure in walk order: array items in index order; for an object, every member name
/// first, then the members in code point order of their names.
fn first_failure(
    value: &JsonText,
    path: &mut Vec<String>,
    depth: usize,
    walk: &mut Walk,
) -> Option<ValueFailure> {
    let node = value;
    {
        if !walk.admit(node, depth) {
            return Some(ValueFailure::Limit);
        }
        match node {
            JsonText::String(text) => text
                .as_str()
                .is_none()
                .then(|| ValueFailure::Text(path.clone())),
            JsonText::Array(items) => {
                for (index, item) in items.iter().enumerate() {
                    path.push(index.to_string());
                    let found = first_failure(item, path, depth + 1, walk);
                    path.pop();
                    if found.is_some() {
                        return found;
                    }
                }
                None
            }
            JsonText::Object(members) => {
                let mut named = Vec::with_capacity(members.len());
                for (name, member) in members {
                    match name.as_str() {
                        Some(text) => named.push((text, member)),
                        None => return Some(ValueFailure::Text(path.clone())),
                    }
                }
                // Byte order of UTF-8 is code point order.
                named.sort_by(|a, b| a.0.cmp(b.0));
                for (name, member) in named {
                    path.push(name.to_owned());
                    let found = first_failure(member, path, depth + 1, walk);
                    path.pop();
                    if found.is_some() {
                        return found;
                    }
                }
                None
            }
            _ => None,
        }
    }
}

/// The first failure of `value`: the quick walk finds whether there is one, and the ordered walk
/// reports it. Each walk counts its own nodes, as the TypeScript runtime does.
fn value_failure(value: &JsonText) -> Option<ValueFailure> {
    if !holds_failure(value, 0, &mut Walk::default()) {
        return None;
    }
    // The ordered walk visits the nodes that the quick walk visited, so it finds the failure.
    first_failure(value, &mut Vec::new(), 0, &mut Walk::default())
}

/// The shape of a value within its limits, as [`JsonText::shape`] states it.
fn shape_of(value: &JsonText) -> Value {
    match value {
        JsonText::Array(items) => Value::Array(items.iter().map(shape_of).collect()),
        JsonText::Object(members) => {
            let mut map = Map::new();
            for (index, (name, member)) in members.iter().enumerate() {
                let name = match name {
                    JsonString::Text(text) => text.clone(),
                    JsonString::Units(_) => format!("\u{FFFF}{index}"),
                };
                map.insert(name, shape_of(member));
            }
            Value::Object(map)
        }
        JsonText::String(JsonString::Units(_)) => Value::String(String::new()),
        JsonText::String(JsonString::Text(text)) => Value::String(text.clone()),
        JsonText::Null => Value::Null,
        JsonText::Bool(value) => Value::Bool(*value),
        #[allow(
            clippy::disallowed_methods,
            reason = "CUIT-040: a shape is read only for kinds, and the text checks report the number first"
        )]
        JsonText::Number(text) => number_value(text).unwrap_or(Value::Null),
    }
}

/// Check a specification and then the composition files an operation reads.
/// Invalid text is the `INVALID_TEXT` load failure located at its
/// specification path, or at the file name followed by its path in the file;
/// an invalid file name is located at the empty path. A value beyond its limits
/// is `INVALID_FORM_INPUT` naming `spec` or `files`. Each value is checked in
/// walk order: the first failure of the value decides its error.
pub fn check_specification(
    spec: Option<&JsonText>,
    files: Option<&JsonText>,
) -> Result<(), ValidateError> {
    for (name, value) in [("spec", spec), ("files", files)] {
        if let Some(value) = value {
            match value_failure(value) {
                Some(ValueFailure::Limit) => {
                    return Err(ValidateError::Input(FormInputError::new(format!(
                        "{VALUE_LIMIT_MESSAGE}: {name}"
                    ))));
                }
                Some(ValueFailure::Text(trace)) => {
                    return Err(ValidateError::Load(ComposeLoadError::with_trace(
                        ComposeErrorCode::InvalidText,
                        MESSAGE,
                        trace,
                    )));
                }
                None => {}
            }
        }
    }
    Ok(())
}

/// Check named caller values in order; absent values are skipped. Invalid text
/// is `INVALID_FORM_INPUT` naming the value and its path, and a value beyond its limits
/// is `INVALID_FORM_INPUT` naming the value. Each value's first failure decides its error.
pub fn check_inputs(inputs: &[(&str, Option<&JsonText>)]) -> Result<(), FormInputError> {
    for (name, value) in inputs {
        if let Some(value) = value {
            match value_failure(value) {
                Some(ValueFailure::Limit) => {
                    return Err(FormInputError::new(format!(
                        "{VALUE_LIMIT_MESSAGE}: {name}"
                    )));
                }
                Some(ValueFailure::Text(path)) => {
                    let mut location = vec![(*name).to_owned()];
                    location.extend(path);
                    return Err(FormInputError::new(format!(
                        "{MESSAGE}: {}",
                        location.join(".")
                    )));
                }
                None => {}
            }
        }
    }
    Ok(())
}

/// The value of a JSON number. A number that `serde_json` does not accept (out of its
/// range) is invalid input: the callers return `None`, and the text checks report it.
#[allow(
    clippy::disallowed_methods,
    reason = "a number serde_json rejects is invalid"
)]
fn number_value(text: &str) -> Option<Value> {
    serde_json::from_str::<Number>(text).ok().map(Value::Number)
}

/// Convert a value to serde_json::Value. Invalid text becomes None, as do numbers serde_json does
/// not accept. The callers convert only values within their limits, so the nesting is bounded by
/// the nesting limit and the recursion stays within it.
fn json_text_to_value(value: &JsonText) -> Option<Value> {
    match value {
        JsonText::Null => Some(Value::Null),
        JsonText::Bool(b) => Some(Value::Bool(*b)),
        JsonText::Number(text) => number_value(text),
        JsonText::String(text) => Some(Value::String(text.as_str()?.to_owned())),
        JsonText::Array(items) => items
            .iter()
            .map(json_text_to_value)
            .collect::<Option<Vec<_>>>()
            .map(Value::Array),
        JsonText::Object(members) => {
            // Member names are checked before any value is converted.
            let mut names = Vec::with_capacity(members.len());
            for (name, _) in members {
                names.push(name.as_str()?);
            }
            let mut object = Map::new();
            for (name, (_, member)) in names.into_iter().zip(members) {
                object.insert(name.to_owned(), json_text_to_value(member)?);
            }
            Some(Value::Object(object))
        }
    }
}

/// A JSON text member that is not text, or a number `serde_json` does not
/// accept, after the text checks passed.
fn decoded(value: Option<&JsonText>) -> Result<Option<Value>, ValidateError> {
    value.map(decode).transpose()
}

/// A JSON text value, or the failure of a number that `serde_json` does not accept.
pub(crate) fn decode(value: &JsonText) -> Result<Value, ValidateError> {
    json_text_to_value(value).ok_or_else(|| {
        ValidateError::Input(FormInputError::new("Numbers must be finite JSON numbers"))
    })
}

/// The decoded files and base path of a JSON text validation.
type Composition = (Option<Map<String, Value>>, Option<String>);

/// Decode the files and base path of a JSON text validation.
fn composition(
    files: Option<&JsonText>,
    basepath: Option<&JsonText>,
) -> Result<Composition, ValidateError> {
    // CUVR-092: files are an object and a base path is a string.
    let files = match decoded(files)? {
        None => None,
        Some(Value::Object(files)) => Some(files),
        Some(_) => {
            return Err(ValidateError::Input(FormInputError::new(
                "Files must be an object",
            )))
        }
    };
    let basepath = match decoded(basepath)? {
        None => None,
        Some(Value::String(basepath)) => Some(basepath),
        Some(_) => {
            return Err(ValidateError::Input(FormInputError::new(
                "Basepath must be a string",
            )))
        }
    };
    Ok((files, basepath))
}

/// [`validate`](crate::validate()) over JSON text. The specification, the files,
/// the data and the base path are checked for invalid text in that order; each
/// argument is then decoded and validated. Absent data validates an empty
/// object.
pub fn validate_text(
    spec: &JsonText,
    data: Option<&JsonText>,
    files: Option<&JsonText>,
    basepath: Option<&JsonText>,
) -> Result<ValidationResult, ValidateError> {
    check_specification(Some(spec), files)?;
    check_inputs(&[("data", data), ("options.basepath", basepath)])?;
    let (files, basepath) = composition(files, basepath)?;
    let spec = decode(spec)?;
    // CUIT-040: absent data is the empty object.
    let data = match decoded(data)? {
        Some(data) => data,
        None => Value::Object(Map::new()),
    };
    crate::validate(
        &spec,
        &data,
        &ValidateOptions {
            files,
            loader: None,
            basepath,
        },
    )
}

/// The input of a list or detail specification after the checks of [`validate_text`] for their
/// text, which `validate` then validates: the decoded specification, the files and the base path.
fn structure_text(
    spec: &JsonText,
    files: Option<&JsonText>,
    basepath: Option<&JsonText>,
    validate: impl FnOnce(
        &Value,
        Option<Map<String, Value>>,
        Option<String>,
    ) -> Result<(), ValidateError>,
) -> Result<(), ValidateError> {
    check_specification(Some(spec), files)?;
    check_inputs(&[("options.basepath", basepath)])?;
    let (files, basepath) = composition(files, basepath)?;
    let spec = decode(spec)?;
    validate(&spec, files, basepath)
}

/// Defines a function that validates a list or a detail specification given as JSON text, with the checks of
/// [`validate_text`] for the specification, the files and the base path.
macro_rules! structure_text_validator {
    ($(#[$meta:meta])* $name:ident, $options:ident, $validate:ident) => {
        $(#[$meta])*
        pub fn $name(
            spec: &JsonText,
            files: Option<&JsonText>,
            basepath: Option<&JsonText>,
        ) -> Result<(), ValidateError> {
            structure_text(spec, files, basepath, |spec, files, basepath| {
                let options = $options { files, loader: None, basepath };
                Ok(crate::$validate(spec, &options)?)
            })
        }
    };
}

structure_text_validator! {
    /// [`validate_list`](crate::validate_list()) over JSON text, with the checks of
    /// [`validate_text`] for the specification, the files and the base path.
    validate_list_text, ValidateListOptions, validate_list
}

structure_text_validator! {
    /// [`validate_detail`](crate::validate_detail()) over JSON text, with the checks
    /// of [`validate_text`] for the specification, the files and the base path.
    validate_detail_text, ValidateDetailOptions, validate_detail
}

#[cfg(test)]
mod tests {

    /// CUVR-092: files that are no object and a base path that is no string are input failures.
    #[test]
    fn options_of_other_types_fail() {
        let spec = JsonText::parse(r#"{"type":"group","properties":{}}"#).unwrap();
        let files = JsonText::parse("[]").unwrap();
        let basepath = JsonText::parse("5").unwrap();
        let failure = validate_text(&spec, None, Some(&files), None).unwrap_err();
        assert_eq!(failure.message(), "Files must be an object");
        let failure = validate_text(&spec, None, None, Some(&basepath)).unwrap_err();
        assert_eq!(failure.message(), "Basepath must be a string");
    }
    use super::*;

    /// An object of `count` distinct members.
    fn object(count: usize) -> String {
        let members: Vec<String> = (0..count).map(|i| format!("\"m{i}\":{i}")).collect();
        format!("{{{}}}", members.join(","))
    }

    #[test]
    fn repeated_member_is_rejected() {
        for source in [
            r#"{"a":1,"b":2,"a":3}"#,
            r#"{"a":{"b":1,"\u0062":2}}"#,
            r#"[{"a":1,"a":2}]"#,
        ] {
            assert!(JsonText::parse(source).is_err(), "{source}");
        }
    }

    #[test]
    fn decoded_object_values_keep_their_names_and_order() {
        let source = r#"{"a":1,"b":{"x":2,"y":3},"c":[4,{"z":5}]}"#;
        let parsed = JsonText::parse(source).unwrap();
        let decoded = super::json_text_to_value(&parsed).unwrap();
        assert_eq!(serde_json::to_string(&decoded).unwrap(), source);
    }

    /// An object of 100,000 distinct members, each found in constant time, is read within a
    /// second; comparing each member with every earlier one makes 5 * 10^9 comparisons and does
    /// not end before the per-test timeout of the run-tests tool of @polyspec/kit.
    #[test]
    fn reading_many_members_ends() {
        JsonText::parse(&object(100_000)).unwrap();
        assert!(JsonText::parse(&format!("{{\"m0\":0,{}", &object(100_000)[1..])).is_err());
    }
}
