//! The input text fixtures of the generator operations (tests/fixtures/text-validity): every case of the five
//! generator families runs through the public API, one trial per case. A case's members are read as JSON text with
//! `JsonText`, which keeps unpaired surrogates. Each operation checks its text first, in the order of
//! docs/spec/input-text.md, and decodes the members into values only after the checks pass.
//!
//! CUIT-041: the generator reports a load failure and an input failure both as FormError, as its entry of the table says.

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
use polyspec_crud_ui_generator::text::{
    check_bind, check_compile_form, check_display, check_form_method,
};
use polyspec_crud_ui_generator::{
    bind_form, build_detail, build_list, compile_form, AddRowOptions, BindOptions, CompileOptions,
    CopyRowOptions, Form, FormResult, FormTemplate, ListOptions,
};
use polyspec_crud_ui_validator::text::JsonText;
use serde_json::{json, Map, Value};
use std::path::Path;

/// The fixture families of the text units, each with the symbol of its test.
const FEATURES: [(&str, &str); 5] = [
    ("compileForm", "text_compile_form"),
    ("bindForm", "text_bind_form"),
    ("createForm", "text_create_form"),
    ("buildList", "text_build_list"),
    ("buildDetail", "text_build_detail"),
];

fn cases(feature: &str) -> Vec<JsonText> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .join("tests/fixtures/text-validity")
        .join(feature)
        .join("cases.json");
    let source = match std::fs::read_to_string(&path) {
        Ok(source) => source,
        Err(e) => panic!("read {path:?}: {e}"),
    };
    match JsonText::parse(&source).expect("the fixture is JSON text") {
        JsonText::Array(cases) => cases,
        _ => panic!("the fixture is not an array"),
    }
}

/// A member decoded after its text check; an absent or null member takes `default`.
fn value_of(member: Option<&JsonText>, default: Value) -> Value {
    member
        .and_then(JsonText::to_value)
        .filter(|value| !value.is_null())
        .unwrap_or(default)
}

fn text_of(options: &Value, name: &str) -> String {
    options
        .get(name)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn files_of(options: &Value) -> Map<String, Value> {
    options
        .get("files")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn compile_options(options: &Value) -> CompileOptions<'static> {
    CompileOptions {
        files: files_of(options),
        loader: None,
        basepath: text_of(options, "basepath"),
        key_prefix: options
            .get("keyPrefix")
            .and_then(Value::as_str)
            .map(str::to_owned),
    }
}

fn list_options(options: &Value) -> ListOptions<'static> {
    let language = match options.get("language").and_then(Value::as_str) {
        Some(language) => language.to_owned(),
        None => ListOptions::default().language,
    };
    ListOptions {
        files: files_of(options),
        basepath: text_of(options, "basepath"),
        language,
        data: options.get("data").cloned().unwrap_or(Value::Null),
        layout: options.get("layout").cloned().unwrap_or(Value::Null),
        ..ListOptions::default()
    }
}

/// The binding options, each taken as decoded; null means the default.
fn bind_options(options: &Value) -> BindOptions {
    let get = |name: &str| options.get(name).cloned().unwrap_or(Value::Null);
    BindOptions {
        id_prefix: get("idPrefix"),
        language: get("language"),
        key_prefix: get("keyPrefix"),
        unsupported: get("unsupported"),
        collapsed: Value::Null,
    }
}

/// The template of a case: its JSON text decoded, or the specification compiled when the case gives none.
fn template_of(case: &JsonText) -> FormResult<FormTemplate> {
    match case.get("template") {
        Some(template) => FormTemplate::from_json(&template.to_value().unwrap_or(Value::Null)),
        None => {
            let spec = case.get("spec");
            check_compile_form(spec, None)?;
            compile_form(&value_of(spec, json!({})), &CompileOptions::default())
        }
    }
}

fn compile_form_case(case: &JsonText) -> FormResult<()> {
    let spec = case.get("spec");
    let options = case.get("options");
    check_compile_form(spec, options)?;
    compile_form(
        &value_of(spec, json!({})),
        &compile_options(&value_of(options, json!({}))),
    )
    .map(|_| ())
}

fn bind_form_case(case: &JsonText) -> FormResult<()> {
    let data = case.get("data");
    let options = case.get("options");
    check_bind(case.get("template"), data, options)?;
    let template = template_of(case)?;
    bind_form(
        &template,
        &value_of(data, json!({})),
        &bind_options(&value_of(options, json!({}))),
    )
    .map(|_| ())
}

fn create_form_case(case: &JsonText) -> FormResult<()> {
    let data = case.get("data");
    let options = case.get("options");
    check_bind(case.get("template"), data, options)?;
    let template = template_of(case)?;
    let mut form = Form::new(
        template,
        &value_of(data, json!({})),
        bind_options(&value_of(options, json!({}))),
    )?;
    match case.get("action") {
        Some(action) => run_action(&mut form, action),
        None => Ok(()),
    }
}

/// Calls the form method that an action names, after the text checks of the method's arguments.
fn run_action(form: &mut Form, action: &JsonText) -> FormResult<()> {
    let method = action
        .get("method")
        .and_then(JsonText::to_value)
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_default();
    let args: Vec<JsonText> = match action.get("args") {
        Some(JsonText::Array(items)) => items.clone(),
        _ => Vec::new(),
    };
    check_form_method(&method, &args)?;
    let arg = |index: usize| {
        args.get(index)
            .and_then(JsonText::to_value)
            .unwrap_or(Value::Null)
    };
    let text = |index: usize| arg(index).as_str().unwrap_or_default().to_owned();
    match method.as_str() {
        "setData" => form.set_data(&arg(0)),
        "setValue" => form.set_value(&text(0), arg(1)),
        "getValue" => form.get_value(&text(0)).map(|_| ()),
        "addRow" => {
            let options: AddRowOptions = serde_json::from_value(arg(1))
                .expect("the options of addRow are an object of key, afterKey and value");
            form.add_row(&text(0), options).map(|_| ())
        }
        "copyRow" => form
            .copy_row(&text(0), &text(1), CopyRowOptions::default())
            .map(|_| ()),
        "removeRow" => form.remove_row(&text(0), &text(1)),
        "moveRow" => form.move_row(&text(0), &text(1), arg(2).as_i64().unwrap_or_default()),
        "rekeyRow" => form.rekey_row(&text(0), &text(1), &text(2)),
        other => panic!("unknown form action {other}"),
    }
}

fn build_list_case(case: &JsonText) -> FormResult<()> {
    let spec = case.get("spec");
    let rows = case.get("rows");
    let options = case.get("options");
    check_display(spec, "rows", rows, options)?;
    let rows = value_of(rows, json!([]));
    let rows = rows.as_array().cloned().unwrap_or_default();
    build_list(
        &value_of(spec, json!({})),
        &rows,
        &list_options(&value_of(options, json!({}))),
    )
    .map(|_| ())
}

fn build_detail_case(case: &JsonText) -> FormResult<()> {
    let spec = case.get("spec");
    let record = case.get("record");
    let options = case.get("options");
    check_display(spec, "record", record, options)?;
    build_detail(
        &value_of(spec, json!({})),
        &value_of(record, json!({})),
        &list_options(&value_of(options, json!({}))),
    )
    .map(|_| ())
}

fn run_case(feature: &str, case: &JsonText) -> FormResult<()> {
    match feature {
        "compileForm" => compile_form_case(case),
        "bindForm" => bind_form_case(case),
        "createForm" => create_form_case(case),
        "buildList" => build_list_case(case),
        _ => build_detail_case(case),
    }
}

/// The outcome in the expect shape of the fixture: "pass", or the failure code, message and path.
fn outcome(result: FormResult<()>) -> Value {
    match result {
        Ok(()) => json!("pass"),
        Err(error) => json!({"code": error.code, "message": error.message, "at": error.at}),
    }
}

fn main() {
    let mut trials = Vec::new();
    for (feature, symbol) in FEATURES {
        for case in cases(feature) {
            let name = case
                .get("name")
                .and_then(JsonText::to_value)
                .and_then(|value| value.as_str().map(str::to_owned))
                .expect("a case has a name");
            let fixture = format!("tests/fixtures/text-validity/{feature}/cases.json");
            trials.push(Trial::test(format!("{symbol}::{name}"), move || {
                evidence::prove_all(&[feature], &fixture, &name, || {
                    let expected = case
                        .get("expect")
                        .and_then(JsonText::to_value)
                        .expect("a case has an expectation");
                    let observed = outcome(run_case(feature, &case));
                    if observed == expected {
                        Ok(())
                    } else {
                        Err(Failed::from(format!("\n got {observed}\nwant {expected}")))
                    }
                })
            }));
        }
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
