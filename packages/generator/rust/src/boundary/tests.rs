use super::*;

fn json(text: &str) -> JsonValue {
    polyspec_json::parse(text.as_bytes(), &polyspec_json::ParseOptions::default()).unwrap()
}

/// A loader of one file, which fails when `fail` is set.
struct OneFile {
    fail: bool,
}

impl FileLoader for OneFile {
    fn normalize(&mut self, path: &str, basepath: &str) -> Result<String, Failure<ValidateError>> {
        Ok(format!("{basepath}/{path}"))
    }

    fn load(&mut self, key: &str) -> Result<JsonValue, Failure<ValidateError>> {
        if self.fail {
            return Err(Failure::Callback(format!("no {key}").into()));
        }
        if key.ends_with("Columns.yml") {
            return Ok(json(
                r#"{"properties":{"name":{"field":"name","label":"Name"}}}"#,
            ));
        }
        Ok(json(r#"{"properties":{"name":{"type":"text"}}}"#))
    }
}

/// U-2 of binding: an option that the options leave out is the constant that the interface contract names in
/// `default_core`, so a list without a language is the list in `ko` and a form without a base path is the form
/// with the empty one.
#[test]
fn a_left_out_option_is_its_default_constant() {
    assert_eq!(DEFAULT_BASEPATH, "");
    assert_eq!(DEFAULT_LANGUAGE, "ko");
    let list = json(r#"{"columns":{"name":{"field":"name","label":{"ko":"이름","en":"Name"}}}}"#);
    let rows = [json(r#"{"name":"x"}"#)];
    let explicit = ListOptions {
        basepath: Some(DEFAULT_BASEPATH.to_owned()),
        language: Some(DEFAULT_LANGUAGE.to_owned()),
        ..ListOptions::default()
    };
    let left_out = render_list(&list, Some(&rows[..]), &ListOptions::default()).unwrap();
    assert_eq!(
        left_out,
        render_list(&list, Some(&rows[..]), &explicit).unwrap()
    );
    assert!(left_out.contains("이름"));
    let english = ListOptions {
        language: Some("en".to_owned()),
        ..ListOptions::default()
    };
    assert!(render_list(&list, Some(&rows[..]), &english)
        .unwrap()
        .contains("Name"));
    let spec = json(r#"{"type":"group","properties":{"name":{"type":"text"}}}"#);
    let explicit = CompileOptions {
        basepath: Some(DEFAULT_BASEPATH.to_owned()),
        ..CompileOptions::default()
    };
    assert_eq!(
        serde_json::to_string(&compile_form(&spec, &CompileOptions::default()).unwrap()).unwrap(),
        serde_json::to_string(&compile_form(&spec, &explicit).unwrap()).unwrap()
    );
}

/// CURP-031: the operations with a loader read its files, refuse `files` beside it and return
/// its failure unchanged.
#[test]
fn a_loader_gives_the_files_of_the_operations() {
    let spec = json(r#"{"type":"group","properties":{"$ref":"Base.yml"}}"#);
    let files = json(r#"{"Base.yml":{"properties":{"name":{"type":"text"}}}}"#);
    let mut options = CompileOptions::default();
    let loaded = compile_form_with_loader(&spec, &mut OneFile { fail: false }, &options).unwrap();
    let mut named = OrderedMap::new();
    for (name, file) in files.members().unwrap().iter() {
        named.insert(name.string_value().unwrap(), file.clone());
    }
    options.files = Some(named);
    let declared = compile_form(&spec, &options).unwrap();
    assert_eq!(
        serde_json::to_string(&loaded).unwrap(),
        serde_json::to_string(&declared).unwrap()
    );
    let Err(Failure::Kind(error)) =
        compile_form_with_loader(&spec, &mut OneFile { fail: false }, &options)
    else {
        panic!("files with a loader");
    };
    assert_eq!(error.message, FILES_WITH_LOADER_MESSAGE);
    let Err(Failure::Callback(error)) = compile_form_with_loader(
        &spec,
        &mut OneFile { fail: true },
        &CompileOptions::default(),
    ) else {
        panic!("the loader failed");
    };
    assert_eq!(error.to_string(), "no /Base.yml");
    let list = json(r#"{"columns":{"$ref":"Columns.yml"}}"#);
    let html = render_list_with_loader(
        &list,
        &[json(r#"{"name":"x"}"#)],
        &mut OneFile { fail: false },
        &ListOptions::default(),
    )
    .unwrap();
    assert!(html.contains("Name"));
    let detail = json(r#"{"fields":{"$ref":"Columns.yml"}}"#);
    let built = build_detail_with_loader(
        &detail,
        &json(r#"{"name":"x"}"#),
        &mut OneFile { fail: false },
        &ListOptions::default(),
    )
    .unwrap();
    assert!(built.raw().contains("Name"));
    let Err(Failure::Callback(_)) = render_detail_with_loader(
        &detail,
        &json("{}"),
        &mut OneFile { fail: true },
        &ListOptions::default(),
    ) else {
        panic!("the loader failed");
    };
}

/// CURP-032, CURP-033: a file that the loader reports as missing is the failure of the operation, whose code
/// `FormError::code` gives.
#[test]
fn a_missing_file_of_a_loader_is_the_failure_of_the_operation() {
    use crate::FormErrorCode;
    use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};
    struct Missing;
    impl FileLoader for Missing {
        fn normalize(
            &mut self,
            path: &str,
            _basepath: &str,
        ) -> Result<String, Failure<ValidateError>> {
            Ok(path.to_owned())
        }

        fn load(&mut self, _key: &str) -> Result<JsonValue, Failure<ValidateError>> {
            Err(Failure::Kind(ValidateError::Load(
                ComposeLoadError::with_trace(
                    ComposeErrorCode::RefFileNotFound,
                    "the text of the loader",
                    Vec::new(),
                ),
            )))
        }
    }
    let spec = json(r#"{"type":"group","properties":{"$ref":"Base.yml"}}"#);
    let Err(Failure::Kind(error)) =
        compile_form_with_loader(&spec, &mut Missing, &CompileOptions::default())
    else {
        panic!("the file is missing");
    };
    assert!(matches!(error.code(), FormErrorCode::RefFileNotFound));
    assert_eq!(error.message, "$ref file not found: Base.yml");
    assert_eq!(error.trace, ["Base.yml"]);
    assert_eq!(binding_core::Kinds::kind(&error), "ref_file_not_found");
}

/// CURP-030: the boundary renders the instance that the crate renders, and data leaves with its
/// members in order and its numbers as ECMAScript doubles.
#[test]
fn the_boundary_runs_the_operations_of_the_crate() {
    let spec = r#"{"type":"group","properties":{"b":{"type":"text"},"a":{"type":"number"}}}"#;
    let data = r#"{"b":"x","a":9007199254740993}"#;
    let template = compile_form(&json(spec), &CompileOptions::default()).unwrap();
    let form = Form::new(&template, Some(&json(data)), &BindOptions::default()).unwrap();
    let core_template = crate::compile_form(
        &serde_json::from_str(spec).unwrap(),
        &crate::CompileOptions::default(),
    )
    .unwrap();
    let core_form = crate::Form::new(
        core_template,
        &serde_json::from_str(data).unwrap(),
        crate::BindOptions::default(),
    )
    .unwrap();
    assert_eq!(
        render_form(&form, None).unwrap(),
        crate::render_form(&core_form, None).unwrap()
    );
    assert_eq!(
        form.get_data().unwrap().raw(),
        r#"{"b":"x","a":9007199254740992}"#
    );
    assert!(form.get_value("missing").unwrap().is_none());
}

/// CUIT-027: invalid text of an argument fails with its name.
#[test]
fn invalid_text_fails_with_its_argument() {
    let template = compile_form(
        &json(r#"{"type":"group","properties":{"name":{"type":"text"}}}"#),
        &CompileOptions::default(),
    )
    .unwrap();
    let error = bind_form(
        &template,
        &json(r#"{"name":"\ud800"}"#),
        &BindOptions::default(),
    )
    .unwrap_err();
    assert_eq!(
        error.message,
        "Text must be Unicode scalar values: data.name"
    );
}
