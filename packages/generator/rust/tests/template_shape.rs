//! The compiled cases also test CURP-019 and CURP-024 (a serialized compiled template is bound).
//! The form template shape of the Rust generator against tests/fixtures/template-shape (CURT-092): each case's template
//! is decoded with `FormTemplate::from_json` first, which refuses a shape that is not the compiled one; the case's
//! operation then runs on the decoded template, one trial per case.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

#[path = "support/evidence.rs"]
mod evidence;

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crudui_generator::{
    bind_buttons, bind_form, BindOptions, Form, FormResult, FormTemplate,
};
use polyspec_crudui_validator::text::JsonText;
use serde_json::{json, Value};
use std::path::Path;

/// The cases of the fixture, parsed as JSON text.
fn cases() -> Vec<JsonText> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .join("tests/fixtures/template-shape/cases.json");
    let source = match std::fs::read_to_string(&path) {
        Ok(source) => source,
        Err(e) => panic!("read {path:?}: {e}"),
    };
    match JsonText::parse(&source).expect("the fixture is JSON text") {
        JsonText::Array(cases) => cases,
        _ => panic!("the fixture is not an array"),
    }
}

/// The decoded value of a member of a case, which the fixture gives as valid text.
fn member(case: &JsonText, name: &str) -> Value {
    case.get(name)
        .and_then(JsonText::to_value)
        .unwrap_or_else(|| panic!("a case has the member {name}"))
}

/// The case's template is decoded first; a refusal is the error of the decoder, and the operation runs otherwise.
fn run_case(case: &JsonText) -> FormResult<()> {
    let template_value = member(case, "template");
    let template = FormTemplate::from_json(&template_value)?;
    let data = member(case, "data");
    let options = BindOptions::default();
    match member(case, "operation").as_str() {
        Some("bindForm") => bind_form(&template, &data, &options).map(|_| ()),
        Some("bindButtons") => bind_buttons(&template, &data, &options).map(|_| ()),
        Some("createForm") => Form::new(template, &data, options).map(|_| ()),
        other => panic!("unknown template operation {other:?}"),
    }
}

/// The outcome in the expect shape of the fixture: "pass", or the failure code, message and path.
fn outcome(result: FormResult<()>) -> Value {
    match result {
        Ok(()) => json!("pass"),
        Err(error) => json!({"code": error.code, "message": error.message, "at": error.at}),
    }
}

/// CURT-050: each record is bound from the serialized template alone, and the values of its paths are its own.
fn check_records(case: &JsonText, expected: &Value) -> Result<(), Failed> {
    let template_value = member(case, "template");
    let records = member(case, "data");
    let paths = member(case, "paths");
    let mut results = Vec::new();
    for (index, record) in records
        .as_array()
        .expect("the records are a list")
        .iter()
        .enumerate()
    {
        let template =
            FormTemplate::from_json(&template_value).expect("the serialized template decodes");
        let form = Form::new(template, record, BindOptions::default()).expect("the record binds");
        let mut read = serde_json::Map::new();
        for path in paths[index]
            .as_array()
            .expect("the paths of a record are a list")
        {
            let path = path.as_str().expect("a path is text");
            // CURT-093: a path without a value is absent from the results, as JSON writes undefined.
            if let Some(value) = form.get_value(path).expect("the path reads") {
                read.insert(path.to_string(), value);
            }
        }
        results.push(Value::Object(read));
    }
    let observed = json!({"results": results});
    if &observed == expected {
        Ok(())
    } else {
        Err(Failed::from(format!("\n got {observed}\nwant {expected}")))
    }
}

fn main() {
    let cases = cases();
    assert_eq!(cases.len(), 44, "the template shape fixture holds 44 cases");
    let trials = cases
        .into_iter()
        .map(|case| {
            let name = member(&case, "name");
            let name = name.as_str().expect("a case has a name").to_string();
            Trial::test(format!("template_shape::{name}"), move || {
                let operation = member(&case, "operation");
                let operation = operation
                    .as_str()
                    .expect("a template case has an operation");
                let feature = if operation == "createRecords" {
                    "createForm"
                } else {
                    operation
                };
                evidence::prove(
                    feature,
                    "tests/fixtures/template-shape/cases.json",
                    &name,
                    || {
                        let expected = member(&case, "expect");
                        if member(&case, "operation").as_str() == Some("createRecords") {
                            return check_records(&case, &expected);
                        }
                        let observed = outcome(run_case(&case));
                        if observed == expected {
                            Ok(())
                        } else {
                            Err(Failed::from(format!("\n got {observed}\nwant {expected}")))
                        }
                    },
                )
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
