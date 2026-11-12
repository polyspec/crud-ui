//! Input text of the generator operations over JSON text
//! (docs/spec/input-text.md).
//!
//! A Rust `String` is always a sequence of Unicode scalar values, so the value
//! operations need no check. A caller that decodes JSON text with
//! [`JsonText`] passes its parts here, in the
//! order each operation checks them, before decoding them into values.

use polyspec_crud_ui_validator::text::{check_inputs, check_specification};
use polyspec_crud_ui_validator::validate::ValidateError;

pub use polyspec_crud_ui_validator::text::{JsonString, JsonText, JsonTextError};

use crate::error::{FormError, FormResult};

/// Options of a form binding or instance, in code point order of their names.
const BIND_OPTIONS: [&str; 4] = ["idPrefix", "keyPrefix", "language", "unsupported"];

/// Options of a list or detail model, in code point order of their names.
const DISPLAY_OPTIONS: [&str; 4] = ["basepath", "data", "language", "layout"];

fn inputs(values: &[(&str, Option<&JsonText>)]) -> FormResult<()> {
    check_inputs(values).map_err(|error| FormError::input(error.message))
}

/// The specification and file checks: a value over the limits is an input failure, invalid
/// text a load failure.
fn specification(spec: Option<&JsonText>, files: Option<&JsonText>) -> FormResult<()> {
    check_specification(spec, files).map_err(|error| match error {
        ValidateError::Input(error) => FormError::input(error.message),
        ValidateError::Load(error) => error.into(),
    })
}

fn options<'a>(
    options: Option<&'a JsonText>,
    names: &[&str],
) -> Vec<(String, Option<&'a JsonText>)> {
    names
        .iter()
        .map(|name| (format!("options.{name}"), options.and_then(|o| o.get(name))))
        .collect()
}

fn check(
    arguments: &[(&str, Option<&JsonText>)],
    named: Vec<(String, Option<&JsonText>)>,
) -> FormResult<()> {
    inputs(arguments)?;
    let named: Vec<(&str, Option<&JsonText>)> = named
        .iter()
        .map(|(name, value)| (name.as_str(), *value))
        .collect();
    inputs(&named)
}

/// The checks of `compile_form`: the specification, the files, then the
/// `basepath` and `keyPrefix` options.
pub fn check_compile_form(
    spec: Option<&JsonText>,
    options_text: Option<&JsonText>,
) -> FormResult<()> {
    specification(spec, options_text.and_then(|o| o.get("files")))?;
    check(&[], options(options_text, &["basepath", "keyPrefix"]))
}

/// The checks of `bind_form`, `bind_buttons` and `Form::new`: the template,
/// the data, then the binding options.
pub fn check_bind(
    template: Option<&JsonText>,
    data: Option<&JsonText>,
    options_text: Option<&JsonText>,
) -> FormResult<()> {
    check(
        &[("template", template), ("data", data)],
        options(options_text, &BIND_OPTIONS),
    )
}

/// The checks of a list or detail model: the specification, the files, the
/// rows or record named `input`, then the display options.
pub fn check_display(
    spec: Option<&JsonText>,
    input: &str,
    value: Option<&JsonText>,
    options_text: Option<&JsonText>,
) -> FormResult<()> {
    specification(spec, options_text.and_then(|o| o.get("files")))?;
    check(&[(input, value)], options(options_text, &DISPLAY_OPTIONS))
}

/// The checks of a `Form` method named as in the JavaScript instance API, over
/// its JSON arguments in order.
pub fn check_form_method(method: &str, args: &[JsonText]) -> FormResult<()> {
    let arg = |index: usize| args.get(index);
    match method {
        "setData" => check(&[("data", arg(0))], Vec::new()),
        "getValue" => check(&[("path", arg(0))], Vec::new()),
        "setValue" => check(&[("path", arg(0)), ("value", arg(1))], Vec::new()),
        "addRow" => check(
            &[("path", arg(0))],
            options(arg(1), &["afterKey", "key", "value"]),
        ),
        "copyRow" => check(
            &[("path", arg(0)), ("key", arg(1))],
            options(arg(2), &["afterKey", "key"]),
        ),
        "removeRow" | "moveRow" => check(&[("path", arg(0)), ("key", arg(1))], Vec::new()),
        "rekeyRow" => check(
            &[("path", arg(0)), ("oldKey", arg(1)), ("newKey", arg(2))],
            Vec::new(),
        ),
        _ => Ok(()),
    }
}
