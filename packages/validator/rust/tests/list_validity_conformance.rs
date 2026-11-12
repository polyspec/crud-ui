//! CRUDUI list-spec structure conformance for SPEC §9.
//!
//! `tests/fixtures/list-validity/cases.json` contains independent meta-schema and
//! runtime expectations. This test reads `raises` and passes the files of the case options:
//! a case without `raises` requires successful composition and forbidden-key scanning; `raises` requires the declared
//! load-error code and complete dotted trace. Row validation does not apply.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

mod common;

const FEATURE: &str = "validateList";
const FIXTURE: &str = "tests/fixtures/list-validity/cases.json";

use std::path::{Path, PathBuf};

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_validator::list::{validate_list, ValidateListOptions};
use serde_json::Value;

fn fixture_path() -> PathBuf {
    // tests/ -> crate root is packages/validator/rust; the shared list-validity
    // fixture lives at ../../../tests/fixtures/list-validity/cases.json.
    let manifest = env!("CARGO_MANIFEST_DIR");
    Path::new(manifest)
        .join("..")
        .join("..")
        .join("..")
        .join("tests")
        .join("fixtures")
        .join("list-validity")
        .join("cases.json")
}

fn load_cases() -> Vec<Value> {
    common::read_cases(&fixture_path())
}

/// One case of the list-validity fixture, run through `prove_case`; returns its failure messages (none when it passes).
fn list_engine_case_failures(case: &Value) -> Vec<String> {
    let name = case
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("fixture case missing name"));
    common::prove_case(FEATURE, FIXTURE, name, || {
        let mut failures: Vec<String> = Vec::new();

        let spec = common::case_argument(case, "spec").unwrap_or(Value::Null);
        let options = ValidateListOptions {
            files: common::case_files(case),
            loader: None,
            basepath: None,
        };

        let result = validate_list(&spec, &options);

        // A case without `raises` composes and passes the forbidden-key scan; `raises` names the load failure and its
        // complete dotted trace.
        match case.get("raises") {
            None => match &result {
                Ok(()) => {}
                Err(e) => failures.push(format!(
                    "[{}] the case raises nothing but was rejected: {} ({})",
                    name, e.code, e.message
                )),
            },
            Some(want) => {
                let want_code = common::raised_code(case).unwrap_or_default();
                let want_code = want_code.as_str();
                let want_at = want.get("at").and_then(Value::as_str).unwrap_or("?");
                match &result {
                    Ok(()) => failures.push(format!(
                        "[{}] the case raises the LOAD failure {} at {} but the spec passed",
                        name, want_code, want_at
                    )),
                    Err(e) => {
                        let got_code = e.code.as_str();
                        let got_at = e.trace.join(".");
                        if got_code != want_code {
                            failures.push(format!(
                                "[{}] LOAD code mismatch: want {} got {}",
                                name, want_code, got_code
                            ));
                        }
                        if got_at != want_at {
                            failures.push(format!(
                                "[{}] LOAD trace mismatch: want `{}` got `{}`",
                                name, want_at, got_at
                            ));
                        }
                    }
                }
            }
        }
        failures
    })
}

fn main() {
    let cases = load_cases();
    assert!(
        !cases.is_empty(),
        "no list-validity fixture cases were loaded"
    );
    let trials: Vec<Trial> = cases
        .into_iter()
        .map(|case| {
            let name = case
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_else(|| panic!("fixture case missing name"))
                .to_owned();
            Trial::test(format!("list_engine_matches_fixture::{name}"), move || {
                let failures = list_engine_case_failures(&case);
                if failures.is_empty() {
                    Ok(())
                } else {
                    Err(Failed::from(failures.join("\n")))
                }
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
