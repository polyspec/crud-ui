//! The contract cases of the generator (`contracts/generator-cases.json`, binding G-5) against the boundary: each case
//! calls its member once with the arguments that it names; a case without `raises` succeeds, and `raises` names the
//! kind, the status and the category of the failure, which the generated bindings raise too.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths; this harness reads the contract cases and fails a case by a panic"
)]

use binding_core::{Kinds, OrderedMap};
use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_generator::boundary::{
    build_detail, build_list, build_outline, collapsible_rows, compile_form, empty_history,
    form_buttons_html, render_data_panel, render_detail, render_list, render_outline_view,
    set_all_expanded_view, template_from_json, CompileOptions, ListOptions,
};
use polyspec_crud_ui_generator::{
    create_row_key, initial_view, resolve_action, sequence_row_key, ActionInput, FormError,
};
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

/// An optional text of a record field: none for null.
fn optional_text(value: &Value) -> Option<String> {
    (value.kind() != Kind::Null).then(|| text(value))
}

/// The list options of a case, every field written.
fn list_options(case: &Value) -> ListOptions {
    let options = argument(case, "options");
    let mut files = OrderedMap::new();
    for (name, file) in argument(options, "files").members().unwrap().iter() {
        files.insert(text(name), case_value(file));
    }
    let number = |name: &str| {
        let value = argument(options, name);
        (value.kind() != Kind::Null)
            .then(|| value.number_literal().unwrap().parse::<u64>().unwrap())
    };
    let data = argument(options, "data");
    ListOptions {
        files,
        basepath: Some(text(argument(options, "basepath"))),
        language: Some(text(argument(options, "language"))),
        data: (data.kind() != Kind::Null).then(|| case_value(data)),
        page: number("page"),
        total: number("total"),
    }
}

fn values(value: &Value) -> Vec<Value> {
    value.items().unwrap().iter().map(case_value).collect()
}

fn argument<'a>(case: &'a Value, name: &str) -> &'a Value {
    case.get(name)
        .unwrap()
        .unwrap_or_else(|| panic!("the case gives no {name}"))
}

/// The category of a kind in the kinds of the generator contract: the kind of a variant is its name in lower snake
/// case (binding design E-1).
fn category_of(kind: &str) -> String {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("interface.json");
    let contract: serde_json::Value =
        serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for row in contract["errors"]["kinds"].as_array().unwrap() {
        let variant = row["variant"]
            .as_str()
            .unwrap()
            .rsplit("::")
            .next()
            .unwrap();
        let mut snake = String::new();
        for (index, letter) in variant.char_indices() {
            if letter.is_uppercase() && index > 0 {
                snake.push('_');
            }
            snake.extend(letter.to_lowercase());
        }
        if snake == kind {
            return row["category"].as_str().unwrap().to_owned();
        }
    }
    panic!("the contract names no kind {kind}")
}

/// The outcome of a member: success, or the failure's kind, status and category.
fn check(case: &Value, result: Result<(), FormError>) -> Result<(), Failed> {
    let raises = case.get("raises").unwrap();
    match (raises, result) {
        (None, Ok(())) => Ok(()),
        (None, Err(error)) => Err(Failed::from(format!(
            "raised {} ({})",
            error.kind(),
            error.message
        ))),
        (Some(raises), Ok(())) => Err(Failed::from(format!(
            "raised nothing, want {}",
            text(raises.get("kind").unwrap().unwrap())
        ))),
        (Some(raises), Err(error)) => {
            let want = text(raises.get("kind").unwrap().unwrap());
            let status = raises.get("status").unwrap().unwrap().kind() == Kind::Null;
            let category = text(raises.get("category").unwrap().unwrap());
            if error.kind() == want
                && status == error.status().is_none()
                && category == category_of(&want)
            {
                Ok(())
            } else {
                Err(Failed::from(format!(
                    "raised {} ({}), want {want}",
                    error.kind(),
                    error.message
                )))
            }
        }
    }
}

fn run(member: &str, case: &Value) -> Result<(), FormError> {
    match member {
        "compile_form" => {
            let options = argument(case, "options");
            let mut files = OrderedMap::new();
            for (name, file) in argument(options, "files").members().unwrap().iter() {
                files.insert(text(name), case_value(file));
            }
            let key_prefix = argument(options, "key_prefix");
            let options = CompileOptions {
                files,
                basepath: Some(text(argument(options, "basepath"))),
                key_prefix: (key_prefix.kind() != Kind::Null).then(|| text(key_prefix)),
            };
            compile_form(&case_value(argument(case, "spec")), &options).map(|_| ())
        }
        "build_outline" => {
            let nodes = values(argument(case, "nodes"));
            build_outline(&nodes).map(|_| ())
        }
        "render_outline_view" => {
            let fields = values(argument(case, "fields"));
            render_outline_view(
                &fields,
                argument(case, "can_undo").boolean_value().unwrap(),
                argument(case, "can_redo").boolean_value().unwrap(),
                &text(argument(case, "language")),
            )
            .map(|_| ())
        }
        "render_data_panel" => render_data_panel(
            &case_value(argument(case, "data")),
            &text(argument(case, "language")),
        )
        .map(|_| ()),
        "form_buttons_html" => {
            form_buttons_html(&case_value(argument(case, "buttons"))).map(|_| ())
        }
        "resolve_action" => {
            let input = argument(case, "input");
            let input = ActionInput {
                action: optional_text(argument(input, "action")),
                path: optional_text(argument(input, "path")),
                key: optional_text(argument(input, "key")),
            };
            drop(resolve_action(&input));
            Ok(())
        }
        "initial_view" => {
            drop(initial_view());
            Ok(())
        }
        "collapsible_rows" => collapsible_rows(&values(argument(case, "nodes"))).map(|_| ()),
        "set_all_expanded_view" => set_all_expanded_view(
            &values(argument(case, "nodes")),
            argument(case, "expanded").boolean_value().unwrap(),
        )
        .map(|_| ()),
        "empty_history" => {
            drop(empty_history());
            Ok(())
        }
        "sequence_row_key" => sequence_row_key(&text(argument(case, "sequence"))).map(|_| ()),
        "create_row_key" => create_row_key().map(|_| ()),
        "build_list" => build_list(
            &case_value(argument(case, "spec")),
            &values(argument(case, "rows")),
            &list_options(case),
        )
        .map(|_| ()),
        "render_list" => render_list(
            &case_value(argument(case, "spec")),
            &values(argument(case, "rows")),
            &list_options(case),
        )
        .map(|_| ()),
        "build_detail" => build_detail(
            &case_value(argument(case, "spec")),
            &case_value(argument(case, "record")),
            &list_options(case),
        )
        .map(|_| ()),
        "render_detail" => render_detail(
            &case_value(argument(case, "spec")),
            &case_value(argument(case, "record")),
            &list_options(case),
        )
        .map(|_| ()),
        "from_json" => template_from_json(&case_value(argument(case, "value"))).map(|_| ()),
        other => panic!("no member {other}"),
    }
}

/// Run `run` with the failure that a case injects: `random_source` makes the random source of this thread fail
/// (CURT-095, feature `random-failure-test`).
fn with_injected<T>(injected: Option<&str>, run: impl FnOnce() -> T) -> T {
    match injected {
        None => run(),
        #[cfg(feature = "random-failure-test")]
        Some("random_source") => {
            polyspec_crud_ui_generator::fail_random_source(true);
            let result = run();
            polyspec_crud_ui_generator::fail_random_source(false);
            result
        }
        Some(other) => panic!("no injected failure {other} in this build"),
    }
}

fn main() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../contracts/generator-cases.json");
    let source = std::fs::read(&path).unwrap();
    let file = polyspec_json::parse(&source, &ParseOptions::default()).unwrap();
    let mut trials = Vec::new();
    for member in [
        "compile_form",
        "build_outline",
        "render_outline_view",
        "render_data_panel",
        "form_buttons_html",
        "resolve_action",
        "initial_view",
        "collapsible_rows",
        "set_all_expanded_view",
        "empty_history",
        "sequence_row_key",
        "create_row_key",
        "from_json",
        "build_list",
        "render_list",
        "build_detail",
        "render_detail",
    ] {
        let cases = file
            .get(member)
            .unwrap()
            .unwrap_or_else(|| panic!("no group {member}"))
            .items()
            .unwrap()
            .to_vec();
        assert!(!cases.is_empty(), "the group {member} holds no case");
        for case in cases {
            let id = text(argument(&case, "id"));
            // A case that injects a failure of the environment runs with the test feature that injects it.
            let injected = case.get("inject").unwrap().map(text);
            let ignored = injected.is_some() && !cfg!(feature = "random-failure-test");
            let trial = Trial::test(format!("{member}::{id}"), move || {
                let result = with_injected(injected.as_deref(), || run(member, &case));
                check(&case, result)
            });
            trials.push(trial.with_ignored_flag(ignored));
        }
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
