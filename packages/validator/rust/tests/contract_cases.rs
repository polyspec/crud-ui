//! The contract cases of the validator (`contracts/validator-cases.json`, binding G-5) against the boundary: each case
//! calls its member once with the arguments that it names; a case without `raises` succeeds, and `raises` names the
//! kind, the status and the category of the failure, which the generated bindings raise too.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths; this harness reads the contract cases and fails a case by a panic"
)]

use binding_core::Kinds;
use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_validator::boundary::hidden_paths;
use polyspec_json::{Kind, ParseOptions, Value};

/// A value in the case form as the JSON value that it names, its texts kept as UTF-16 code units.
fn case_value(value: &Value) -> Value {
    let kind = text(value.get("kind").unwrap().expect("a value names its kind"));
    let inner = || {
        value
            .get("value")
            .unwrap()
            .expect("a value holds its value")
    };
    match kind.as_str() {
        "null" => Value::null(),
        "bool" => Value::boolean(inner().boolean_value().unwrap()),
        "number" => Value::number(&text(inner())).unwrap(),
        "text" => Value::from_units(&inner().string_units().unwrap()).unwrap(),
        "list" => Value::array(
            &inner()
                .items()
                .unwrap()
                .iter()
                .map(case_value)
                .collect::<Vec<_>>(),
        )
        .unwrap(),
        "map" => {
            let mut members = polyspec_json::OrderedMap::new();
            for pair in inner().items().unwrap() {
                let pair = pair.items().unwrap();
                members
                    .insert(pair[0].clone(), case_value(&pair[1]))
                    .unwrap();
            }
            Value::object(&members).unwrap()
        }
        other => panic!("unknown value kind {other}"),
    }
}

fn text(value: &Value) -> String {
    value.string_value().unwrap()
}

fn argument<'a>(case: &'a Value, name: &str) -> &'a Value {
    case.get(name)
        .unwrap()
        .unwrap_or_else(|| panic!("the case gives no {name}"))
}

fn check(case: &Value) -> Result<(), Failed> {
    let result = hidden_paths(
        &case_value(argument(case, "spec")),
        &case_value(argument(case, "data")),
    );
    match (case.get("raises").unwrap(), result) {
        (None, Ok(_)) => Ok(()),
        (None, Err(error)) => Err(Failed::from(format!(
            "raised {} ({})",
            error.kind(),
            error.message()
        ))),
        (Some(_), Ok(_)) => Err(Failed::from("raised nothing")),
        (Some(raises), Err(error)) => {
            let want = text(raises.get("kind").unwrap().unwrap());
            let status = raises.get("status").unwrap().unwrap().kind() == Kind::Null;
            let category = text(raises.get("category").unwrap().unwrap());
            if error.kind() == want && status == error.status().is_none() && category == "value" {
                Ok(())
            } else {
                Err(Failed::from(format!(
                    "raised {} ({}), want {want}",
                    error.kind(),
                    error.message()
                )))
            }
        }
    }
}

fn main() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../contracts/validator-cases.json");
    let file =
        polyspec_json::parse(&std::fs::read(&path).unwrap(), &ParseOptions::default()).unwrap();
    let cases = file
        .get("hidden_paths")
        .unwrap()
        .expect("the group hidden_paths")
        .items()
        .unwrap()
        .to_vec();
    assert!(!cases.is_empty(), "the group hidden_paths holds no case");
    let trials = cases
        .into_iter()
        .map(|case| {
            Trial::test(
                format!("hidden_paths::{}", text(argument(&case, "id"))),
                move || check(&case),
            )
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
