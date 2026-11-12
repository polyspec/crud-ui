//! The form state fixtures against the Rust generator: the cases of `tests/fixtures/form-view` run their steps on a
//! form instance and those of `tests/fixtures/view-functions` call the view functions. Each observation equals the one
//! that the TypeScript reference recorded, as JSON text so that the order of object members counts. A row key that a
//! case does not write is one that an operation generated, and the observation names it `$1`, `$2` in the order of its
//! first appearance (tests/fixtures/form-state/README.md).

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

use libtest_mimic::{Arguments, Trial};
use polyspec_crudui_generator::{
    bind_form, collapsible_rows, compile_form, initial_view, rekey_row_view, remove_row_view,
    resolve_action, run_action, set_all_expanded_view, toggle_row_view, ActionInput, ActionResult,
    ActionTarget, AddRowOptions, BindOptions, CompileOptions, Form, FormError, FormResult,
    ViewState,
};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::Path;

fn cases(family: &str) -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../tests/fixtures")
        .join(family)
        .join("cases.json");
    let text = match std::fs::read_to_string(&path) {
        Ok(value) => value,
        Err(error) => panic!("read {}: {error}", path.display()),
    };
    let cases: Vec<Value> = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(error) => panic!("parse {}: {error}", path.display()),
    };
    assert!(!cases.is_empty(), "{family} holds no case");
    cases
}

/// Names the row keys that an operation generated.
struct Namer {
    pattern: Regex,
    known: Vec<String>,
    generated: HashMap<String, String>,
}

impl Namer {
    fn new(texts: &[String]) -> Self {
        let pattern = Regex::new(r"__[0-9A-Za-z]{13}__").unwrap();
        let known = texts
            .iter()
            .flat_map(|text| {
                pattern
                    .find_iter(text)
                    .map(|m| m.as_str().to_owned())
                    .collect::<Vec<_>>()
            })
            .collect();
        Self {
            pattern,
            known,
            generated: HashMap::new(),
        }
    }

    fn rename(&mut self, text: &str) -> String {
        let mut out = String::new();
        let mut last = 0;
        for found in self.pattern.find_iter(text) {
            out.push_str(&text[last..found.start()]);
            let key = found.as_str();
            if self.known.iter().any(|known| known == key) {
                out.push_str(key);
            } else {
                let next = format!("${}", self.generated.len() + 1);
                out.push_str(self.generated.entry(key.to_owned()).or_insert(next));
            }
            last = found.end();
        }
        out.push_str(&text[last..]);
        out
    }

    fn walk(&mut self, value: &Value) -> Value {
        match value {
            Value::String(text) => Value::String(self.rename(text)),
            Value::Array(items) => Value::Array(items.iter().map(|item| self.walk(item)).collect()),
            Value::Object(members) => {
                let mut out = Map::new();
                for (key, member) in members {
                    let key = self.rename(key);
                    out.insert(key, self.walk(member));
                }
                Value::Object(out)
            }
            other => other.clone(),
        }
    }
}

/// The row paths of the collapsed rows of the evaluated nodes, depth first.
fn collapsed_rows(nodes: &[Value]) -> Vec<Value> {
    let mut rows = Vec::new();
    for node in nodes {
        let children = node["children"].as_array().map_or(&[][..], Vec::as_slice);
        if node["kind"] != "collection" {
            rows.extend(collapsed_rows(children));
            continue;
        }
        for row in children {
            if row["collapsible"] == true && row["expanded"] == false {
                rows.push(json!(format!(
                    "{}.{}",
                    node["path"].as_str().unwrap(),
                    row["key"].as_str().unwrap()
                )));
            }
            rows.extend(collapsed_rows(
                row["children"].as_array().map_or(&[][..], Vec::as_slice),
            ));
        }
    }
    rows
}

/// The value and label of each option of the field node at a data path, depth first.
fn field_choices(nodes: &[Value], path: &str) -> Option<Value> {
    for node in nodes {
        if node["kind"] == "field" && node["path"] == path {
            let options = node["widget"]["options"]
                .as_array()
                .map_or(&[][..], Vec::as_slice);
            return Some(Value::Array(
                options
                    .iter()
                    .map(|option| json!({"value": option["value"], "label": option["label"]}))
                    .collect(),
            ));
        }
        if let Some(found) = field_choices(
            node["children"].as_array().map_or(&[][..], Vec::as_slice),
            path,
        ) {
            return Some(found);
        }
    }
    None
}

fn text(args: &[Value], index: usize) -> &str {
    args[index].as_str().unwrap()
}

fn options(args: &[Value], index: usize) -> AddRowOptions {
    args.get(index)
        .map_or_else(AddRowOptions::default, |value| {
            serde_json::from_value(value.clone()).unwrap()
        })
}

/// The target of a `runAction` step: its operation name, collection path and row key.
fn action_target(value: &Value) -> FormResult<ActionTarget> {
    ActionTarget::named(
        value["name"].as_str().unwrap(),
        value["path"].as_str().map(str::to_owned),
        value["key"].as_str().map(str::to_owned),
    )
}

/// The JSON object of an action target; path and key are absent when empty.
fn target_json(target: &ActionTarget) -> Value {
    let mut out = Map::new();
    out.insert("name".into(), json!(target.name.as_str()));
    if let Some(path) = target.path.as_deref().filter(|path| !path.is_empty()) {
        out.insert("path".into(), json!(path));
    }
    if let Some(key) = target.key.as_deref().filter(|key| !key.is_empty()) {
        out.insert("key".into(), json!(key));
    }
    Value::Object(out)
}

/// The JSON object of an action result; the focus is absent when the action focuses nothing.
fn action_result_json(result: ActionResult) -> Value {
    let mut out = Map::new();
    if let Some(focus) = result.focus {
        let mut target = Map::new();
        target.insert("path".into(), json!(focus.path));
        if let Some(key) = focus.key {
            target.insert("key".into(), json!(key));
        }
        out.insert("focus".into(), Value::Object(target));
    }
    Value::Object(out)
}

/// Run one step on the form and return what the step returned.
fn perform(form: &mut Form, spec: &Value, op: &str, args: &[Value]) -> FormResult<Option<Value>> {
    match op {
        "validate" => {
            // The errors of the validator for the specification and the current record, in the validator's order.
            let result = polyspec_crudui_validator::validate::validate(
                spec,
                &form.get_data(),
                &polyspec_crudui_validator::validate::ValidateOptions::default(),
            )
            .map_err(|error| FormError {
                code: match &error {
                    polyspec_crudui_validator::ValidateError::Load(load) => {
                        polyspec_crudui_generator::FormErrorCode::Compose(load.code)
                    }
                    polyspec_crudui_validator::ValidateError::Input(_) => {
                        polyspec_crudui_generator::FormErrorCode::InvalidFormInput
                    }
                },
                message: error.message().to_string(),
                at: String::new(),
                trace: Vec::new(),
            })?;
            let errors: Vec<Value> = result
                .errors
                .iter()
                .map(|error| json!({"path": error.path, "field": error.field, "rule": error.rule, "message": error.message}))
                .collect();
            Ok(Some(json!({"valid": result.valid, "errors": errors})))
        }
        "choices" => Ok(Some(
            field_choices(form.fields(), text(args, 0))
                .unwrap_or_else(|| panic!("no field node at {}", text(args, 0))),
        )),
        "resolveAction" => Ok(resolve_action(
            &serde_json::from_value::<ActionInput>(args[0].clone()).unwrap(),
        )
        .as_ref()
        .map(target_json)),
        "runAction" => action_target(&args[0])
            .and_then(|target| run_action(form, &target))
            .map(|result| result.map(action_result_json)),
        "addRow" => form
            .add_row(text(args, 0), options(args, 1))
            .map(|key| Some(json!(key))),
        "copyRow" => form
            .copy_row(text(args, 0), text(args, 1), options(args, 2))
            .map(|key| Some(json!(key))),
        "removeRow" => form.remove_row(text(args, 0), text(args, 1)).map(|()| None),
        "moveRow" => form
            .move_row(text(args, 0), text(args, 1), args[2].as_i64().unwrap())
            .map(|()| None),
        "rekeyRow" => form
            .rekey_row(text(args, 0), text(args, 1), text(args, 2))
            .map(|()| None),
        "setValue" => form
            .set_value(text(args, 0), args[1].clone())
            .map(|()| None),
        "setData" => form.set_data(&args[0]).map(|()| None),
        "toggleRow" => form.toggle_row(text(args, 0), text(args, 1)).map(|()| None),
        "setAllExpanded" => form.set_all_expanded(args[0] == true).map(|()| None),
        "undo" => form.undo().map(|()| None),
        "redo" => form.redo().map(|()| None),
        other => panic!("unknown step {other}"),
    }
}

/// Runs one session of a family on a form and compares each observation with the recorded one; `history` adds the undo
/// flags of the form to the observation.
fn check_session(case: &Value, history: bool) {
    let steps = case["steps"].as_array().unwrap();
    let mut namer = Namer::new(&[
        case["spec"].to_string(),
        case["data"].to_string(),
        case["steps"].to_string(),
    ]);
    let template = compile_form(&case["spec"], &CompileOptions::default()).unwrap();
    let mut form = Form::new(template, &case["data"], BindOptions::default()).unwrap();
    for (index, step) in steps.iter().enumerate() {
        let mut observed = Map::new();
        let op = step["op"].as_str().unwrap();
        match perform(
            &mut form,
            &case["spec"],
            op,
            step["args"].as_array().unwrap(),
        ) {
            Ok(result) => {
                // An action step reports its result even when it has none (null), as the reference does.
                if result.is_some() || op == "runAction" || op == "resolveAction" {
                    let value = result.unwrap_or(Value::Null);
                    observed.insert("result".into(), namer.walk(&value));
                }
            }
            Err(error) => {
                observed.insert(
                    "error".into(),
                    json!({"code": error.code, "message": error.message}),
                );
            }
        }
        observed.insert("data".into(), namer.walk(&form.get_data()));
        observed.insert("revision".into(), json!(form.revision()));
        if history {
            observed.insert("canUndo".into(), json!(form.can_undo()));
            observed.insert("canRedo".into(), json!(form.can_redo()));
        }
        observed.insert(
            "collapsed".into(),
            namer.walk(&Value::Array(collapsed_rows(form.fields()))),
        );
        assert_eq!(
            Value::Object(observed).to_string(),
            case["expected"][index].to_string(),
            "{} step {index} {step}",
            case["name"]
        );
    }
}

fn view_of(value: &Value) -> ViewState {
    ViewState {
        collapsed: value["collapsed"]
            .as_array()
            .unwrap()
            .iter()
            .map(|path| path.as_str().unwrap().to_owned())
            .collect(),
    }
}

fn view_json(view: ViewState) -> Value {
    json!({"collapsed": view.collapsed})
}

fn nodes(spec: &Value, data: &Value, collapsed: &Value) -> Vec<Value> {
    let template = compile_form(spec, &CompileOptions::default()).unwrap();
    let options = BindOptions {
        collapsed: collapsed.clone(),
        ..BindOptions::default()
    };
    bind_form(&template, data, &options).unwrap()
}

fn call(op: &str, args: &[Value]) -> Value {
    match op {
        "initialView" => view_json(initial_view()),
        "toggleRowView" => view_json(toggle_row_view(&view_of(&args[0]), text(args, 1))),
        "collapsibleRows" => json!(collapsible_rows(&nodes(&args[0], &args[1], &Value::Null))),
        "setAllExpandedView" => view_json(set_all_expanded_view(
            &nodes(&args[0], &args[1], &Value::Null),
            args[2] == true,
        )),
        "removeRowView" => view_json(remove_row_view(&view_of(&args[0]), text(args, 1))),
        "rekeyRowView" => view_json(rekey_row_view(
            &view_of(&args[0]),
            text(args, 1),
            text(args, 2),
        )),
        "bindCollapsed" => Value::Array(collapsed_rows(&nodes(&args[0], &args[1], &args[2]))),
        other => panic!("unknown function {other}"),
    }
}

/// One view function call returns the recorded result.
fn check_view_call(case: &Value) {
    let result = call(
        case["op"].as_str().unwrap(),
        case["args"].as_array().unwrap(),
    );
    assert_eq!(
        json!({"result": result}).to_string(),
        case["expected"].to_string(),
        "{}",
        case["name"]
    );
}

fn main() {
    let families: [(&str, &str, bool); 5] = [
        (
            "form-view",
            "form_view_sessions_equal_the_recorded_observations",
            false,
        ),
        (
            "form-history",
            "form_history_sessions_equal_the_recorded_observations",
            true,
        ),
        (
            "form-actions",
            "form_actions_sessions_equal_the_recorded_observations",
            true,
        ),
        (
            "form-choices",
            "form_choices_sessions_equal_the_recorded_observations",
            true,
        ),
        (
            "view-functions",
            "view_function_calls_equal_the_recorded_results",
            false,
        ),
    ];
    let mut trials = Vec::new();
    for (family, symbol, history) in families {
        for case in cases(family) {
            let name = case["name"]
                .as_str()
                .expect("a case has a name")
                .to_string();
            trials.push(Trial::test(format!("{symbol}::{name}"), move || {
                let feature = match family {
                    "form-history" => "formHistory",
                    "form-actions" => "runAction",
                    "form-choices" => "createForm",
                    _ => "viewState",
                };
                evidence::prove(
                    feature,
                    &format!("tests/fixtures/{family}/cases.json"),
                    &name,
                    || {
                        if family == "view-functions" {
                            check_view_call(&case);
                        } else {
                            check_session(&case, history);
                        }
                        Ok(())
                    },
                )
            }));
        }
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
