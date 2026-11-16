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
    fn normalize(&mut self, path: &str, basepath: &str) -> Result<String, Failure<ValidateError>> {
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

/// CURP-032: a file that the loader reports as missing fails as a file that `files` does not hold, with the
/// message and the trace of the operation.
#[test]
fn a_file_that_the_loader_reports_as_missing_is_no_file() {
    struct Missing;
    impl FileLoader for Missing {
        fn normalize(
            &mut self,
            path: &str,
            _basepath: &str,
        ) -> Result<String, Failure<ValidateError>> {
            Ok(format!("key:{path}"))
        }

        fn load(&mut self, _key: &str) -> Result<JsonValue, Failure<ValidateError>> {
            Err(Failure::Kind(ValidateError::Load(
                ComposeLoadError::with_trace(
                    ComposeErrorCode::RefFileNotFound,
                    "the text of the loader",
                    vec!["the trace of the loader".to_owned()],
                ),
            )))
        }
    }
    let spec = json(r#"{"type":"group","properties":{"$ref":"A.yml"}}"#);
    let options = ValidateOptions::default();
    let Err(Failure::Kind(ValidateError::Load(error))) =
        validate_with_loader(&spec, &json("{}"), &mut Missing, &options)
    else {
        panic!("the file is missing");
    };
    let files = ValidateOptions {
        files: Some(OrderedMap::new()),
        basepath: None,
    };
    let Err(ValidateError::Load(held)) = validate(&spec, &json("{}"), &files) else {
        panic!("the file is missing");
    };
    assert_eq!(held.message, "$ref file not found: A.yml");
    assert_eq!(error.code, ComposeErrorCode::RefFileNotFound);
    assert_eq!(error.message, "$ref file not found: key:A.yml");
    assert_eq!(error.trace, ["key:A.yml"]);
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
