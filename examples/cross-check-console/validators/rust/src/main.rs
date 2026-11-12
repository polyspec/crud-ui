//! Rust validator process of the cross-check console. It reads one JSON request
//! on standard input, calls the public API of `polyspec-crud-ui-validator` and writes one
//! JSON response on standard output with the exit status. The contract, shared
//! with the JavaScript, PHP and Go programs, is in `../README.md`.
//!
//! Modes, selected by the request `mode` (absent → `"form"`):
//!   - form: `polyspec_crud_ui_validator::validate` validates `data`.
//!   - list: `polyspec_crud_ui_validator::validate_list` composes and scans the list; `data` is ignored.
//!   - detail: `polyspec_crud_ui_validator::validate_detail` composes and scans the detail; `data` is ignored.
//!
//! Request rules, checked in this order (each → exit 1, stdout exactly `{ "error" }`):
//!   1. stdin is not UTF-8 or not valid JSON → "Request must be valid JSON"
//!   2. the request is not an object → "Request must be an object"
//!   3. `spec` absent or not an object → "Request spec must be an object"
//!   4. `mode` present and not "form"/"list"/"detail" → "Unsupported validation mode"
//!   5. `files` present, not null and not an object → "Request files must be an object"
//!   6. a `files` member not an object → "Request files must contain objects"
//!   7. `basepath` present, not null and not a string → "Request basepath must be a string"
//!
//! Absent or null `files`/`basepath` mean none. A load failure or form input
//! failure exits 2 with `{ "error", "code", "at" }`. An omitted `data` member
//! validates `{}`; a supplied value is validated as is.

#![allow(
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths of the crudui cores; this program reads its requests with their documented defaults"
)]

use std::io::{self, Read, Write};

use serde_json::{Map, Value};

use polyspec_crud_ui_validator::text::{self, JsonText};
use polyspec_crud_ui_validator::validate::ValidationResult;
use polyspec_crud_ui_validator::{
    validate, validate_detail, validate_list, ValidateDetailOptions, ValidateListOptions,
    ValidateOptions,
};

fn main() {
    // Request rules, checked in the shared order (each → exit 1, `{ "error" }`).
    // 1. stdin must be valid JSON (an unreadable stdin counts as invalid JSON).
    // Standard input that is not UTF-8 is not JSON text.
    let mut input_bytes = String::new();
    if io::stdin().read_to_string(&mut input_bytes).is_err() {
        fail_request("Request must be valid JSON");
    }
    // JSON text with an unpaired surrogate escape is read without replacing it;
    // the request rules read its shape and the validator checks its text.
    let (req, text): (Value, Option<JsonText>) = match serde_json::from_str(&input_bytes) {
        Ok(v) => (v, None),
        Err(_) => match JsonText::parse(&input_bytes) {
            Ok(doc) if doc.has_invalid_text() => (doc.shape(), Some(doc)),
            _ => fail_request("Request must be valid JSON"),
        },
    };

    // 2. the request must be an object.
    let req = match req {
        Value::Object(m) => m,
        _ => fail_request("Request must be an object"),
    };

    // 3. `spec` must be present and an object.
    let spec = match req.get("spec") {
        Some(v @ Value::Object(_)) => v.clone(),
        _ => fail_request("Request spec must be an object"),
    };

    // 4. mode: absent → "form"; only "form" | "list" | "detail" are accepted
    // (null and every non-string value included in the rejection).
    let mode = match req.get("mode") {
        None => "form",
        Some(Value::String(s)) if matches!(s.as_str(), "form" | "list" | "detail") => s.as_str(),
        Some(_) => fail_request("Unsupported validation mode"),
    };

    // 5–6. files: absent or null → none; otherwise an object of objects.
    let files = match req.get("files") {
        None | Some(Value::Null) => None,
        Some(Value::Object(m)) => {
            if !m.values().all(Value::is_object) {
                fail_request("Request files must contain objects");
            }
            Some(m.clone())
        }
        Some(_) => fail_request("Request files must be an object"),
    };

    // 7. basepath: absent or null → none; otherwise a string.
    let basepath = match req.get("basepath") {
        None | Some(Value::Null) => None,
        Some(Value::String(s)) => Some(s.clone()),
        Some(_) => fail_request("Request basepath must be a string"),
    };

    if let Some(doc) = &text {
        let spec = doc.get("spec").expect("a checked specification");
        let present = |name: &str| doc.get(name).filter(|value| **value != JsonText::Null);
        let result = match mode {
            "list" => {
                text::validate_list_text(spec, present("files"), present("basepath")).map(|()| {
                    ValidationResult {
                        valid: true,
                        errors: Vec::new(),
                        hidden: Vec::new(),
                    }
                })
            }
            "detail" => text::validate_detail_text(spec, present("files"), present("basepath"))
                .map(|()| ValidationResult {
                    valid: true,
                    errors: Vec::new(),
                    hidden: Vec::new(),
                }),
            _ => text::validate_text(spec, doc.get("data"), present("files"), present("basepath")),
        };
        match result {
            Ok(result) => emit_result(&result, mode == "form"),
            Err(err) => failure(err.message(), err.code(), &err.at()),
        }
    }

    if mode == "list" || mode == "detail" {
        let result = if mode == "list" {
            validate_list(
                &spec,
                &ValidateListOptions {
                    files,
                    loader: None,
                    basepath,
                },
            )
        } else {
            validate_detail(
                &spec,
                &ValidateDetailOptions {
                    files,
                    loader: None,
                    basepath,
                },
            )
        };
        match result {
            // A list or detail has no data: a clean structure is valid.
            Ok(()) => emit_result(
                &ValidationResult {
                    valid: true,
                    errors: Vec::new(),
                    hidden: Vec::new(),
                },
                false,
            ),
            // A composition failure produces no validation result.
            Err(err) => failure(&err.message, err.code.as_str(), &err.trace.join(".")),
        }
    }

    // An omitted `data` member validates an empty object.
    let data = req
        .get("data")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    let options = ValidateOptions {
        files,
        loader: None,
        basepath,
    };

    match validate(&spec, &data, &options) {
        Ok(result) => emit_result(&result, mode == "form"),
        // Load and input failures produce no validation result.
        Err(err) => failure(err.message(), err.code(), &err.at()),
    }
}

/// Write a successful run on stdout: `{ valid, errors, hidden }` for a form,
/// `{ valid, errors }` for a list or detail.
fn emit_result(result: &ValidationResult, form: bool) -> ! {
    let errors: Vec<Value> = result.errors.iter().map(|e| e.to_value()).collect();
    let obj = if form {
        serde_json::json!({
            "valid": result.valid,
            "errors": errors,
            "hidden": result.hidden,
        })
    } else {
        serde_json::json!({
            "valid": result.valid,
            "errors": errors,
        })
    };
    write_line(&obj);
    std::process::exit(0);
}

/// Bad request (unreadable stdin / unparseable JSON / missing spec). Exit 1.
fn fail_request(msg: &str) -> ! {
    let obj = serde_json::json!({ "error": msg });
    write_line(&obj);
    std::process::exit(1);
}

/// Load or input failure. Exit 2 (distinct from a bad request). `at` is the
/// composition trace joined with `.`, or empty for an input failure.
fn failure(message: &str, code: &str, at: &str) -> ! {
    let obj = serde_json::json!({ "error": message, "code": code, "at": at });
    write_line(&obj);
    std::process::exit(2);
}

/// Write one JSON line to stdout (a trailing newline; serde never fails here).
fn write_line(obj: &Value) {
    let s = serde_json::to_string(obj).expect("a serde_json Value serializes to a string");
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    writeln!(handle, "{}", s).expect("write the JSON line to stdout");
}
