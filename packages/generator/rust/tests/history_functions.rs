//! The cases of tests/fixtures/history-functions (CURT-063, CURT-076 to CURT-080): the other implementations pass the same
//! cases. Each case is a test `history_functions::<name>`.

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
use polyspec_crud_ui_generator::{
    can_redo, can_undo, empty_history, record_change, redo_change, undo_change, History,
    HistoryResult,
};
use serde_json::{json, Value};

/// The history of a case argument.
fn history_of(value: &Value) -> History<Value> {
    let list = |key: &str| value[key].as_array().cloned().unwrap_or_default();
    History {
        entries: list("entries"),
        redo_entries: list("redoEntries"),
        last_path: value["lastPath"].as_str().map(str::to_string),
    }
}

/// The JSON object of a history; `lastPath` is present only when the last change was a value edit.
fn history_json(history: &History<Value>) -> Value {
    let mut object = json!({ "entries": history.entries, "redoEntries": history.redo_entries });
    if let Some(path) = &history.last_path {
        object["lastPath"] = json!(path);
    }
    object
}

/// The JSON object of the outcome of an undo or a redo.
fn restored_json(result: &HistoryResult<Value>) -> Value {
    json!({ "history": history_json(&result.history), "value": result.value })
}

/// The observation `{ result }` or `{ error }` of the function of a case.
fn observe(op: &str, args: &[Value]) -> Value {
    let failed =
        |message: String| json!({ "error": { "code": "INVALID_FORM_INPUT", "message": message } });
    match op {
        "emptyHistory" => json!({ "result": history_json(&empty_history::<Value>()) }),
        "recordChange" => {
            let next = record_change(&history_of(&args[0]), args[1].clone(), args[2].as_str());
            json!({ "result": history_json(&next) })
        }
        "canUndoRedo" => {
            let history = history_of(&args[0]);
            json!({ "result": [can_undo(&history), can_redo(&history)] })
        }
        "undoChange" => match undo_change(&history_of(&args[0]), args[1].clone()) {
            Ok(result) => json!({ "result": restored_json(&result) }),
            Err(error) => failed(error.message),
        },
        "redoChange" => match redo_change(&history_of(&args[0]), args[1].clone()) {
            Ok(result) => json!({ "result": restored_json(&result) }),
            Err(error) => failed(error.message),
        },
        other => panic!("unknown function {other}"),
    }
}

fn main() {
    let text = include_str!("../../../../tests/fixtures/history-functions/cases.json");
    let cases: Vec<Value> = serde_json::from_str(text).expect("the cases are JSON");
    assert!(!cases.is_empty(), "history-functions holds no case");
    let trials = cases
        .into_iter()
        .map(|case| {
            let name = case["name"]
                .as_str()
                .expect("a case has a name")
                .to_string();
            Trial::test(format!("history_functions::{name}"), move || {
                evidence::prove(
                    "formHistory",
                    "tests/fixtures/history-functions/cases.json",
                    &name,
                    || {
                        let args = case["args"].as_array().cloned().unwrap_or_default();
                        let observed = observe(case["op"].as_str().unwrap_or_default(), &args);
                        if observed == case["expected"] {
                            Ok(())
                        } else {
                            Err(Failed::from(format!(
                                "\n got {observed}\nwant {}",
                                case["expected"]
                            )))
                        }
                    },
                )
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
