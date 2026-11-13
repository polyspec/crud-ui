//! The contract cases of the validator (`contracts/validator-cases.json`, binding G-5) against the boundary: each case
//! calls its member once with the arguments that it names; a case without `raises` succeeds, and `raises` names the
//! kind, the status and the category of the failure, which the generated bindings raise too. A case of an operation with
//! a file loader gives the loader as a callback fixture, whose rows answer the calls of the operation (CURP-031,
//! CURP-032).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths; this harness reads the contract cases and fails a case by a panic"
)]

use binding_core::OrderedMap;
use binding_core::{Failure, Kinds};
use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_validator::boundary::{
    hidden_paths, validate, validate_detail, validate_detail_with_loader, validate_list,
    validate_list_with_loader, validate_with_loader, FileLoader, ValidateOptions,
};
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

fn argument<'a>(case: &'a Value, name: &str) -> &'a Value {
    case.get(name)
        .unwrap()
        .unwrap_or_else(|| panic!("the case gives no {name}"))
}

/// The options of a case: the files, none for null, and the base path.
fn options(case: &Value) -> ValidateOptions {
    let options = argument(case, "options");
    let files = argument(options, "files");
    let basepath = argument(options, "basepath");
    ValidateOptions {
        files: (files.kind() != Kind::Null).then(|| {
            let mut map = OrderedMap::new();
            for (name, file) in files.members().unwrap().iter() {
                map.insert(text(name), case_value(file));
            }
            map
        }),
        basepath: (basepath.kind() != Kind::Null).then(|| text(basepath)),
    }
}

/// The answer of a row of a callback fixture.
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
    operation: impl FnOnce(&mut FixtureLoader) -> Result<T, Failure<ValidateError>>,
) -> Result<(), ValidateError> {
    let mut loader = FixtureLoader::new(case);
    let result = operation(&mut loader);
    assert!(
        loader.unexpected.is_empty(),
        "no row answers {:?}",
        loader.unexpected
    );
    match result {
        Ok(_) => Ok(()),
        Err(Failure::Kind(error)) => Err(error),
        Err(other) => panic!("the loader failed: {other}"),
    }
}

fn run(member: &str, case: &Value) -> Result<(), ValidateError> {
    let spec = case_value(argument(case, "spec"));
    match member {
        "validate_with_loader" => with_loader(case, |loader| {
            let data = case_value(argument(case, "data"));
            validate_with_loader(&spec, &data, loader, &options(case))
        }),
        "validate_list_with_loader" => with_loader(case, |loader| {
            validate_list_with_loader(&spec, loader, &options(case))
        }),
        "validate_detail_with_loader" => with_loader(case, |loader| {
            validate_detail_with_loader(&spec, loader, &options(case))
        }),
        "hidden_paths" => hidden_paths(&spec, &case_value(argument(case, "data"))).map(|_| ()),
        "validate" => {
            validate(&spec, &case_value(argument(case, "data")), &options(case)).map(|_| ())
        }
        "validate_list" => validate_list(&spec, &options(case)),
        "validate_detail" => validate_detail(&spec, &options(case)),
        other => panic!("no member {other}"),
    }
}

fn check(member: &str, case: &Value) -> Result<(), Failed> {
    match (case.get("raises").unwrap(), run(member, case)) {
        (None, Ok(())) => Ok(()),
        (None, Err(error)) => Err(Failed::from(format!(
            "raised {} ({})",
            error.kind(),
            error.message()
        ))),
        (Some(_), Ok(())) => Err(Failed::from("raised nothing")),
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
    let mut trials = Vec::new();
    for member in [
        "hidden_paths",
        "validate",
        "validate_list",
        "validate_detail",
        "validate_with_loader",
        "validate_list_with_loader",
        "validate_detail_with_loader",
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
            trials.push(Trial::test(format!("{member}::{id}"), move || {
                check(member, &case)
            }));
        }
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
