//! The contract cases of the generator (`contracts/generator-cases.json`, binding G-5) against the boundary: each case
//! calls its member once with the arguments that it names; a case without `raises` succeeds, and `raises` names the
//! kind, the status and the category of the failure, which the generated bindings raise too. A case of a member of a
//! class, or with an argument of a class type, gives the instance as an instance value of binding GN-13f
//! (`{"new": <member>, "args": {...}, "then": [...]}`), which the harness makes by those members; a case with a
//! `result` compares the result of the member, in the case form.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths; this harness reads the contract cases and fails a case by a panic"
)]

use binding_core::{Failure, Kinds, OrderedMap};
use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_generator::boundary::{
    bind_buttons, bind_form, build_detail, build_list, build_outline, collapsible_rows,
    compile_form, empty_history, form_buttons_html, record_change, redo_change, render_data,
    render_data_panel, render_detail, render_form, render_form_view, render_list, render_outline,
    render_outline_view, run_action, set_all_expanded_view, template_from_json, undo_change,
    AddRowOptions, BindOptions, BoundaryHistory, CompileOptions, Form, ListOptions,
};
use polyspec_crud_ui_generator::boundary::{
    build_detail_with_loader, build_list_with_loader, compile_form_with_loader,
    render_detail_with_loader, render_list_with_loader,
};
use polyspec_crud_ui_generator::{
    can_redo, can_undo, create_row_key, initial_view, rekey_row_view, remove_row_view,
    resolve_action, sequence_row_key, toggle_row_view, ActionInput, ActionTarget, CopyRowOptions,
    FormError, FormTemplate, ViewState,
};
use polyspec_crud_ui_validator::boundary::FileLoader;
use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};
use polyspec_crud_ui_validator::ValidateError;
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

/// The outcome of a member: success with the result that the case names, or the failure's kind, status and category.
fn check(case: &Value, result: Result<Option<serde_json::Value>, FormError>) -> Result<(), Failed> {
    let raises = case.get("raises").unwrap();
    match (raises, result) {
        (None, Ok(got)) => match (case.get("result").unwrap(), got) {
            (Some(want), Some(got)) => {
                let want: serde_json::Value = serde_json::from_str(want.raw()).unwrap();
                if want == got {
                    Ok(())
                } else {
                    Err(Failed::from(format!("gave {got}, want {want}")))
                }
            }
            (Some(_), None) => Err(Failed::from(
                "the case names a result that the harness does not compare",
            )),
            (None, _) => Ok(()),
        },
        (None, Err(error)) => Err(Failed::from(format!(
            "raised {} ({})",
            error.kind(),
            error.message
        ))),
        (Some(raises), Ok(_)) => Err(Failed::from(format!(
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

/// Run `run` with the fault injection points that a case arms (binding G-5): the faults are armed for the member on
/// this thread, the call runs with them installed, and every fault must have fired. Without the feature `fault-test`
/// no point is live, so such a case fails.
fn with_faults<T>(
    member: &str,
    faults: Option<&Value>,
    run: impl FnOnce() -> T,
) -> Result<T, Failed> {
    let Some(faults) = faults else {
        return Ok(run());
    };
    #[cfg(feature = "fault-test")]
    {
        let id = binding_core::fault::arm(member, faults.raw())
            .map_err(|error| Failed::from(format!("the faults of the case: {error}")))?;
        let result = binding_core::fault::take(member).run(run);
        let left = binding_core::fault::left(id)
            .map_err(|error| Failed::from(format!("the faults of the case: {error}")))?;
        if left.is_empty() {
            Ok(result)
        } else {
            Err(Failed::from(format!("the faults {left:?} did not fire")))
        }
    }
    #[cfg(not(feature = "fault-test"))]
    {
        drop(run);
        Err(Failed::from(format!(
            "the case of {member} arms {}, which only a build with the feature fault-test has",
            faults.raw()
        )))
    }
}

/// The groups of the members of a class and of the members that take an instance (C19.4).
const INSTANCE_GROUPS: [&str; 46] = [
    "view_state_collapsed",
    "history_entries",
    "history_redo_entries",
    "history_last_path",
    "form_constructor",
    "form_template",
    "form_fields",
    "form_buttons",
    "form_description",
    "form_revision",
    "form_snapshot",
    "form_get_data",
    "form_get_value",
    "form_set_data",
    "form_set_value",
    "form_add_row",
    "form_copy_row",
    "form_remove_row",
    "form_move_row",
    "form_rekey_row",
    "form_toggle_row",
    "form_set_all_expanded",
    "form_undo",
    "form_redo",
    "form_can_undo",
    "form_can_redo",
    "bind_form",
    "bind_buttons",
    "render_form",
    "render_form_view",
    "render_outline",
    "render_data",
    "run_action",
    "toggle_row_view",
    "remove_row_view",
    "rekey_row_view",
    "record_change",
    "can_undo",
    "can_redo",
    "undo_change",
    "redo_change",
    "compile_form_with_loader",
    "build_list_with_loader",
    "render_list_with_loader",
    "build_detail_with_loader",
    "render_detail_with_loader",
];

/// The result of a member of a group: the result in the case form where the harness compares it.
fn outcome(member: &str, case: &Value) -> Result<Option<serde_json::Value>, FormError> {
    if INSTANCE_GROUPS.contains(&member) {
        instance_member(member, case)
    } else {
        run(member, case).map(|()| None)
    }
}

/// A JSON value in the case form `{kind, value}` of binding G-5.
fn case_form(value: &Value) -> serde_json::Value {
    match value.kind() {
        Kind::Null => serde_json::json!({"kind": "null", "value": null}),
        Kind::Boolean => {
            serde_json::json!({"kind": "bool", "value": value.boolean_value().unwrap()})
        }
        Kind::Number => {
            serde_json::json!({"kind": "number", "value": value.number_literal().unwrap()})
        }
        Kind::String => serde_json::json!({"kind": "text", "value": text(value)}),
        Kind::Array => serde_json::json!({
            "kind": "list",
            "value": value.items().unwrap().iter().map(case_form).collect::<Vec<_>>()
        }),
        Kind::Object => serde_json::json!({
            "kind": "map",
            "value": value
                .members()
                .unwrap()
                .iter()
                .map(|(name, member)| serde_json::json!([text(name), case_form(member)]))
                .collect::<Vec<_>>()
        }),
    }
}

fn case_list(values: &[Value]) -> Option<serde_json::Value> {
    Some(serde_json::Value::Array(
        values.iter().map(case_form).collect(),
    ))
}

/// The compile options of a case, every field written.
fn compile_options(options: &Value) -> CompileOptions {
    let mut files = OrderedMap::new();
    for (name, file) in argument(options, "files").members().unwrap().iter() {
        files.insert(text(name), case_value(file));
    }
    CompileOptions {
        files,
        basepath: Some(text(argument(options, "basepath"))),
        key_prefix: optional_text(argument(options, "key_prefix")),
    }
}

/// The binding options of a case, every field written.
fn bind_options(options: &Value) -> BindOptions {
    BindOptions {
        id_prefix: optional_text(argument(options, "id_prefix")),
        language: optional_text(argument(options, "language")),
        key_prefix: optional_text(argument(options, "key_prefix")),
        unsupported: optional_text(argument(options, "unsupported")),
        collapsed: argument(options, "collapsed")
            .items()
            .unwrap()
            .iter()
            .map(text)
            .collect(),
    }
}

/// An optional JSON value of a case: none for null.
fn optional_value(value: &Value) -> Option<Value> {
    (value.kind() != Kind::Null).then(|| case_value(value))
}

/// An instance that an instance value makes (binding GN-13f).
enum Instance {
    Template(Box<FormTemplate>),
    Form(Box<Form>),
    View(ViewState),
    History(BoundaryHistory),
}

/// Makes the instance of an instance value by its member `new` and runs the calls of `then` on it; a failure of a
/// preparation fails the case as a preparation failure, never as the failure that the case expects.
fn make(value: &Value) -> Instance {
    let member = text(argument(value, "new"));
    let made = (|| -> Result<Instance, FormError> {
        let args = || argument(value, "args");
        Ok(match member.as_str() {
            "generator.compile_form" => Instance::Template(Box::new(compile_form(
                &case_value(argument(args(), "spec")),
                &compile_options(argument(args(), "options")),
            )?)),
            "form.constructor" => Instance::Form(Box::new(Form::new(
                &template_of(argument(args(), "template")),
                &case_value(argument(args(), "data")),
                &bind_options(argument(args(), "options")),
            )?)),
            "generator.initial_view" => Instance::View(initial_view()),
            "generator.toggle_row_view" => Instance::View(toggle_row_view(
                &view_of(argument(args(), "view")),
                &text(argument(args(), "row_path")),
            )),
            "generator.empty_history" => Instance::History(empty_history()),
            "generator.record_change" => Instance::History(record_change(
                &history_of(argument(args(), "history")),
                case_value(argument(args(), "previous")),
                optional_text(argument(args(), "path")).as_deref(),
            )),
            other => panic!("no factory {other} of an instance value"),
        })
    })();
    let mut instance = made.unwrap_or_else(|error| {
        panic!(
            "preparation failure: {member} raised {} ({})",
            error.kind(),
            error.message
        )
    });
    if let Some(then) = value.get("then").unwrap() {
        for step in then.items().unwrap() {
            let call = text(argument(step, "call"));
            let Instance::Form(form) = &mut instance else {
                panic!("no method {call} of this instance value");
            };
            let args = match step.get("args").unwrap() {
                Some(args) => args.clone(),
                None => polyspec_json::parse(b"{}", &ParseOptions::default()).unwrap(),
            };
            if let Err(error) = form_method(form, &call, &args) {
                panic!(
                    "preparation failure: {call} raised {} ({})",
                    error.kind(),
                    error.message
                );
            }
        }
    }
    instance
}

fn template_of(value: &Value) -> FormTemplate {
    match make(value) {
        Instance::Template(template) => *template,
        _ => panic!("the instance value is no form_template"),
    }
}

fn form_of(value: &Value) -> Form {
    match make(value) {
        Instance::Form(form) => *form,
        _ => panic!("the instance value is no form"),
    }
}

fn view_of(value: &Value) -> ViewState {
    match make(value) {
        Instance::View(view) => view,
        _ => panic!("the instance value is no view_state"),
    }
}

fn history_of(value: &Value) -> BoundaryHistory {
    match make(value) {
        Instance::History(history) => history,
        _ => panic!("the instance value is no history"),
    }
}

/// A method of form, by its member id, with the arguments of `args`.
fn form_method(
    form: &mut Form,
    member: &str,
    args: &Value,
) -> Result<Option<serde_json::Value>, FormError> {
    let arg = |name: &str| argument(args, name);
    let path = || text(arg("path"));
    let key = || text(arg("key"));
    Ok(match member {
        "form.template" => {
            drop(form.template().clone());
            None
        }
        "form.fields" => {
            drop(form.fields()?);
            None
        }
        "form.buttons" => case_list(&form.buttons()?),
        "form.description" => Some(serde_json::json!(form.description())),
        "form.revision" => Some(serde_json::json!(form.revision())),
        "form.snapshot" => {
            drop(form.snapshot()?);
            None
        }
        "form.get_data" => Some(case_form(&form.get_data()?)),
        "form.get_value" => Some(match form.get_value(&path())? {
            Some(value) => case_form(&value),
            None => serde_json::Value::Null,
        }),
        "form.set_data" => {
            form.set_data(&case_value(arg("data")))?;
            None
        }
        "form.set_value" => {
            form.set_value(&path(), &case_value(arg("value")))?;
            None
        }
        "form.add_row" => {
            let options = arg("options");
            let options = AddRowOptions {
                key: optional_text(argument(options, "key")),
                after_key: optional_text(argument(options, "after_key")),
                value: optional_value(argument(options, "value")),
            };
            Some(serde_json::json!(form.add_row(&path(), &options)?))
        }
        "form.copy_row" => {
            let options = arg("options");
            let options = CopyRowOptions {
                new_key: optional_text(argument(options, "new_key")),
                after_key: optional_text(argument(options, "after_key")),
            };
            Some(serde_json::json!(form.copy_row(
                &path(),
                &key(),
                options
            )?))
        }
        "form.remove_row" => {
            form.remove_row(&path(), &key())?;
            None
        }
        "form.move_row" => {
            let index = arg("index")
                .number_literal()
                .unwrap()
                .parse::<i64>()
                .unwrap();
            form.move_row(&path(), &key(), index)?;
            None
        }
        "form.rekey_row" => {
            form.rekey_row(&path(), &text(arg("old_key")), &text(arg("new_key")))?;
            None
        }
        "form.toggle_row" => {
            form.toggle_row(&path(), &key())?;
            None
        }
        "form.set_all_expanded" => {
            form.set_all_expanded(arg("expanded").boolean_value().unwrap())?;
            None
        }
        "form.undo" => {
            form.undo()?;
            None
        }
        "form.redo" => {
            form.redo()?;
            None
        }
        "form.can_undo" => Some(serde_json::json!(form.can_undo())),
        "form.can_redo" => Some(serde_json::json!(form.can_redo())),
        other => panic!("no method {other} of form"),
    })
}

/// A member of a class, or a member that takes an instance, of the group `group`.
fn instance_member(group: &str, case: &Value) -> Result<Option<serde_json::Value>, FormError> {
    let arg = |name: &str| argument(case, name);
    if let Some(method) = group.strip_prefix("form_") {
        if method != "constructor" {
            let mut form = form_of(arg("receiver"));
            return form_method(&mut form, &format!("form.{method}"), case);
        }
    }
    Ok(match group {
        "view_state_collapsed" => Some(serde_json::json!(view_of(arg("receiver")).collapsed())),
        "history_entries" => case_list(history_of(arg("receiver")).entries()),
        "history_redo_entries" => case_list(history_of(arg("receiver")).redo_entries()),
        "history_last_path" => Some(serde_json::json!(history_of(arg("receiver")).last_path())),
        "form_constructor" => {
            drop(Form::new(
                &template_of(arg("template")),
                &case_value(arg("data")),
                &bind_options(arg("options")),
            )?);
            None
        }
        "bind_form" => {
            drop(bind_form(
                &template_of(arg("template")),
                &case_value(arg("data")),
                &bind_options(arg("options")),
            )?);
            None
        }
        "bind_buttons" => case_list(&bind_buttons(
            &template_of(arg("template")),
            &case_value(arg("data")),
            &bind_options(arg("options")),
        )?),
        "render_form" => {
            drop(render_form(
                &form_of(arg("form")),
                optional_value(arg("options")).as_ref(),
            )?);
            None
        }
        "render_form_view" => {
            drop(render_form_view(
                &template_of(arg("template")),
                &case_value(arg("data")),
                optional_value(arg("render")).as_ref(),
                &bind_options(arg("options")),
            )?);
            None
        }
        "render_outline" => {
            drop(render_outline(&form_of(arg("form")))?);
            None
        }
        "render_data" => {
            drop(render_data(&form_of(arg("form")))?);
            None
        }
        "run_action" => {
            let target = arg("target");
            let target = ActionTarget::named(
                &text(argument(target, "name")),
                optional_text(argument(target, "path")),
                optional_text(argument(target, "key")),
            )?;
            drop(run_action(&mut form_of(arg("form")), &target)?);
            None
        }
        "toggle_row_view" => {
            drop(toggle_row_view(
                &view_of(arg("view")),
                &text(arg("row_path")),
            ));
            None
        }
        "remove_row_view" => {
            drop(remove_row_view(
                &view_of(arg("view")),
                &text(arg("row_path")),
            ));
            None
        }
        "rekey_row_view" => {
            drop(rekey_row_view(
                &view_of(arg("view")),
                &text(arg("old_path")),
                &text(arg("new_path")),
            ));
            None
        }
        "record_change" => {
            drop(record_change(
                &history_of(arg("history")),
                case_value(arg("previous")),
                optional_text(arg("path")).as_deref(),
            ));
            None
        }
        "can_undo" => Some(serde_json::json!(can_undo(&history_of(arg("history"))))),
        "can_redo" => Some(serde_json::json!(can_redo(&history_of(arg("history"))))),
        "undo_change" => {
            drop(undo_change(
                &history_of(arg("history")),
                case_value(arg("current")),
            )?);
            None
        }
        "redo_change" => {
            drop(redo_change(
                &history_of(arg("history")),
                case_value(arg("current")),
            )?);
            None
        }
        "compile_form_with_loader" => with_loader(case, |loader| {
            compile_form_with_loader(
                &case_value(arg("spec")),
                loader,
                &compile_options(arg("options")),
            )
        })?,
        "build_list_with_loader" => with_loader(case, |loader| {
            build_list_with_loader(
                &case_value(arg("spec")),
                &values(arg("rows")),
                loader,
                &list_options(case),
            )
        })?,
        "render_list_with_loader" => with_loader(case, |loader| {
            render_list_with_loader(
                &case_value(arg("spec")),
                &values(arg("rows")),
                loader,
                &list_options(case),
            )
        })?,
        "build_detail_with_loader" => with_loader(case, |loader| {
            build_detail_with_loader(
                &case_value(arg("spec")),
                &case_value(arg("record")),
                loader,
                &list_options(case),
            )
        })?,
        "render_detail_with_loader" => with_loader(case, |loader| {
            render_detail_with_loader(
                &case_value(arg("spec")),
                &case_value(arg("record")),
                loader,
                &list_options(case),
            )
        })?,
        other => panic!("no member {other}"),
    })
}

/// The answer of a row of a callback fixture of `file_loader` (validator contract, CURP-032).
enum Answer {
    /// The key that `normalize` returns.
    Key(String),
    /// The document that `load` returns.
    Document(Value),
    /// `load` raises the composition load error of kind `ref_file_not_found` (CURP-032).
    Missing,
}

/// A row of a callback fixture: the arguments of the call that it answers, in the order of the parameters.
struct Row {
    args: Vec<String>,
    answer: Answer,
}

/// The file loader of a case: the rows of its callback fixture, and the calls that no row answered.
struct FixtureLoader {
    normalize: Vec<Row>,
    load: Vec<Row>,
    unexpected: Vec<String>,
}

impl FixtureLoader {
    /// The rows of `member` in the fixture; `parameters` names the arguments of a call in their order.
    fn rows(fixture: &Value, member: &str, parameters: &[&str]) -> Vec<Row> {
        let Some(rows) = fixture.get(member).unwrap() else {
            return Vec::new();
        };
        rows.items()
            .unwrap()
            .iter()
            .map(|row| {
                assert!(
                    row.get("once").unwrap().is_none() && row.get("async").unwrap().is_none(),
                    "this harness runs no once or async row"
                );
                let args = argument(row, "args");
                let answer = match (row.get("result").unwrap(), row.get("raise").unwrap()) {
                    (Some(result), None) if member == "file_loader.normalize" => {
                        Answer::Key(text(result))
                    }
                    (Some(result), None) => Answer::Document(case_value(result)),
                    (None, Some(raise)) => {
                        assert_eq!(text(argument(raise, "error")), "compose_load_error");
                        assert_eq!(text(argument(raise, "kind")), "ref_file_not_found");
                        Answer::Missing
                    }
                    _ => panic!("a row of {member} has either a result or a raise"),
                };
                Row {
                    args: parameters
                        .iter()
                        .map(|name| text(argument(args, name)))
                        .collect(),
                    answer,
                }
            })
            .collect()
    }

    fn new(case: &Value) -> Self {
        let fixture = argument(argument(case, "loader"), "callback");
        Self {
            normalize: Self::rows(fixture, "file_loader.normalize", &["path", "basepath"]),
            load: Self::rows(fixture, "file_loader.load", &["key"]),
            unexpected: Vec::new(),
        }
    }

    /// The failure of a call that no row answers, which the call records.
    fn unexpected(&mut self, call: String) -> Failure<ValidateError> {
        self.unexpected.push(call.clone());
        Failure::Callback(format!("UnexpectedCall: {call}").into())
    }
}

impl FileLoader for FixtureLoader {
    fn normalize(&mut self, path: &str, basepath: &str) -> Result<String, Failure<ValidateError>> {
        let row = self
            .normalize
            .iter()
            .find(|row| row.args == [path, basepath]);
        match row.map(|row| &row.answer) {
            Some(Answer::Key(key)) => Ok(key.clone()),
            _ => Err(self.unexpected(format!("normalize({path:?}, {basepath:?})"))),
        }
    }

    fn load(&mut self, key: &str) -> Result<Value, Failure<ValidateError>> {
        let row = self.load.iter().find(|row| row.args == [key]);
        match row.map(|row| &row.answer) {
            Some(Answer::Document(document)) => Ok(document.clone()),
            // The message and the trace are not those of the operation, which writes its own (CURP-032).
            Some(Answer::Missing) => Err(Failure::Kind(ValidateError::Load(
                ComposeLoadError::with_trace(
                    ComposeErrorCode::RefFileNotFound,
                    "the fixture raises ref_file_not_found",
                    Vec::new(),
                ),
            ))),
            _ => Err(self.unexpected(format!("load({key:?})"))),
        }
    }
}

/// The result of an operation with the fixture loader of the case. A call that no row answered fails the case, and so
/// does a failure that is no kind.
fn with_loader<T>(
    case: &Value,
    operation: impl FnOnce(&mut FixtureLoader) -> Result<T, Failure<FormError>>,
) -> Result<Option<serde_json::Value>, FormError> {
    let mut loader = FixtureLoader::new(case);
    let result = operation(&mut loader);
    assert!(
        loader.unexpected.is_empty(),
        "no row answers {:?}",
        loader.unexpected
    );
    match result {
        Ok(_) => Ok(None),
        Err(Failure::Kind(error)) => Err(error),
        Err(other) => panic!("the loader failed: {other}"),
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
    ]
    .into_iter()
    .chain(INSTANCE_GROUPS)
    {
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
            let faults = case.get("faults").unwrap().cloned();
            let trial = Trial::test(format!("{member}::{id}"), move || {
                let result = with_faults(member, faults.as_ref(), || outcome(member, &case))?;
                check(&case, result)
            });
            trials.push(trial);
        }
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
