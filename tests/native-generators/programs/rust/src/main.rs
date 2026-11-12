//! Rust generator process of the native generator conformance suite. It reads one JSON request
//! on standard input, calls the public API of polyspec-crudui-generator and writes one JSON value on
//! standard output; ../../README.md defines the protocol.

#![allow(
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths of the crudui cores; this program reads its requests with their documented defaults"
)]

use std::io::{self, Read};

use polyspec_crudui_generator::text::{
    check_bind, check_compile_form, check_display, check_form_method, JsonText,
};
use polyspec_crudui_generator::{
    bind_buttons, bind_form, build_detail, build_list, build_outline, compile_form,
    form_buttons_html, list_rows, render_detail, render_form, render_list, AddRowOptions,
    BindOptions, CompileOptions, CopyRowOptions, DetailOptions, Form, FormError, FormResult,
    FormTemplate, ListOptions,
};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

fn input(message: impl Into<String>) -> FormError {
    FormError {
        code: polyspec_crudui_generator::FormErrorCode::InvalidFormInput,
        message: message.into(),
        at: String::new(),
        trace: Vec::new(),
    }
}

fn decode<T: DeserializeOwned>(value: &Value) -> FormResult<T> {
    serde_json::from_value(value.clone()).map_err(|error| input(error.to_string()))
}

/// A form template is exactly the compiled template shape; any other value is rejected.
fn template(value: &Value) -> FormResult<FormTemplate> {
    FormTemplate::from_json(value)
}

fn object<'a>(value: &'a Value, name: &str) -> FormResult<&'a Value> {
    if value.is_object() {
        Ok(value)
    } else {
        Err(input(format!("{name} must be an object")))
    }
}

fn option_string(options: &Value, key: &str) -> FormResult<Option<String>> {
    options
        .get(key)
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| input(format!("{key} must be a string")))
        })
        .transpose()
}

fn compile_options(options: &Value) -> FormResult<CompileOptions<'static>> {
    object(options, "Options")?;
    Ok(CompileOptions {
        files: match options.get("files") {
            Some(files) => object(files, "files")?.as_object().unwrap().clone(),
            None => Default::default(),
        },
        basepath: option_string(options, "basepath")?.unwrap_or_default(),
        key_prefix: option_string(options, "keyPrefix")?,
        loader: None,
    })
}

fn error_json(error: FormError) -> Value {
    json!({"code":error.code,"message":error.message,"at":error.at})
}

fn string_arg(args: &[Value], index: usize) -> FormResult<&str> {
    args.get(index)
        .and_then(Value::as_str)
        .ok_or_else(|| input(format!("Argument {index} must be a string")))
}

/// The text checks of a request part, when the request holds invalid text.
fn part<'a>(text: Option<&'a JsonText>, name: &str) -> Option<&'a JsonText> {
    text.and_then(|text| text.get(name))
}

fn action(form: &mut Form, action: &Value, text: Option<&JsonText>) -> FormResult<Value> {
    const METHODS: [&str; 9] = [
        "setData",
        "setValue",
        "addRow",
        "copyRow",
        "removeRow",
        "moveRow",
        "rekeyRow",
        "getValue",
        "getData",
    ];
    let (Some(method), Some(args)) = (action["method"].as_str(), action["args"].as_array()) else {
        return Err(input("Invalid form action"));
    };
    if !METHODS.contains(&method) {
        return Err(input("Invalid form action"));
    }
    if let Some(JsonText::Array(args)) = part(text, "args") {
        check_form_method(method, args)?;
    }
    match method {
        "setData" => {
            form.set_data(args.first().ok_or_else(|| input("setData requires data"))?)?;
        }
        "setValue" => {
            form.set_value(
                string_arg(args, 0)?,
                args.get(1)
                    .ok_or_else(|| input("setValue requires a value"))?
                    .clone(),
            )?;
        }
        "getData" => return Ok(form.get_data()),
        // The step record writes the absence of a value (CURT-093) as null, as the JavaScript program
        // writes `undefined ?? null`.
        "getValue" => {
            return match form.get_value(string_arg(args, 0)?)? {
                Some(value) => Ok(value),
                None => Ok(Value::Null),
            }
        }
        "addRow" => {
            let options = args
                .get(1)
                .map(decode::<AddRowOptions>)
                .transpose()?
                .unwrap_or_default();
            return form
                .add_row(string_arg(args, 0)?, options)
                .map(Value::String);
        }
        "copyRow" => {
            let options = args
                .get(2)
                .map(decode::<AddRowOptions>)
                .transpose()?
                .unwrap_or_default();
            // The request writes the options as the JavaScript `{ key, afterKey }`.
            let options = CopyRowOptions {
                new_key: options.key,
                after_key: options.after_key,
            };
            return form
                .copy_row(string_arg(args, 0)?, string_arg(args, 1)?, options)
                .map(Value::String);
        }
        "removeRow" => form.remove_row(string_arg(args, 0)?, string_arg(args, 1)?)?,
        "moveRow" => {
            let index = args
                .get(2)
                .and_then(Value::as_i64)
                .filter(|index| *index >= 0)
                .ok_or_else(|| input("Row position must be a nonnegative integer"))?;
            form.move_row(string_arg(args, 0)?, string_arg(args, 1)?, index)?;
        }
        "rekeyRow" => form.rekey_row(
            string_arg(args, 0)?,
            string_arg(args, 1)?,
            string_arg(args, 2)?,
        )?,
        _ => return Err(input("Invalid form action")),
    }
    Ok(Value::Null)
}

fn generate(request: &Value, text: Option<&JsonText>) -> FormResult<Value> {
    object(request, "Request")?;
    let empty = json!({});
    let options = object(request.get("options").unwrap_or(&empty), "Options")?;
    match request["operation"].as_str() {
        Some("compileForm") => {
            if text.is_some() {
                check_compile_form(part(text, "spec"), part(text, "options"))?;
            }
            serde_json::to_value(compile_form(&request["spec"], &compile_options(options)?)?)
                .map_err(|error| input(error.to_string()))
        }
        Some("bindForm") => {
            check_template_text(request, text)?;
            let template = template(&request["template"])?;
            let data = object(request.get("data").unwrap_or(&empty), "Form data")?;
            Ok(bind_form(&template, data, &decode::<BindOptions>(options)?)?.into())
        }
        Some("bindButtons") => {
            check_template_text(request, text)?;
            let template = template(&request["template"])?;
            let data = object(request.get("data").unwrap_or(&empty), "Form data")?;
            Ok(bind_buttons(&template, data, &decode::<BindOptions>(options)?)?.into())
        }
        Some("formButtonsHtml") => Ok(form_buttons_html(&request["buttons"])?.into()),
        Some("buildList") | Some("renderList") => {
            if text.is_some() {
                check_display(
                    part(text, "spec"),
                    "rows",
                    part(text, "rows"),
                    part(text, "options"),
                )?;
            }
            let compilation = compile_options(options)?;
            let language = option_string(options, "language")?.unwrap_or_else(|| "ko".into());
            // The specification rule precedes the rows rule, which only decoded JSON can break.
            let spec = &request["spec"];
            if !spec.is_object() {
                return Err(input("List specification must be an object"));
            }
            let rows = list_rows(request.get("rows"))?;
            let options = ListOptions {
                files: compilation.files,
                basepath: compilation.basepath,
                loader: None,
                language,
                data: options.get("data").cloned().unwrap_or(Value::Null),
                // The library checks page and total after the context; null means none.
                page: options.get("page").cloned().unwrap_or(Value::Null),
                total: options.get("total").cloned().unwrap_or(Value::Null),
                layout: options.get("layout").cloned().unwrap_or(Value::Null),
            };
            if request["operation"] == "buildList" {
                build_list(spec, rows, &options)
            } else {
                render_list(spec, rows, &options).map(Value::String)
            }
        }
        Some("renderDetail") => {
            if text.is_some() {
                check_display(
                    part(text, "spec"),
                    "record",
                    part(text, "record"),
                    part(text, "options"),
                )?;
            }
            let compilation = compile_options(options)?;
            let options = DetailOptions {
                files: compilation.files,
                basepath: compilation.basepath,
                loader: None,
                language: option_string(options, "language")?.unwrap_or_else(|| "ko".into()),
                // The library checks the context after the specification and record; null means empty.
                data: options.get("data").cloned().unwrap_or(Value::Null),
                page: Value::Null,
                total: Value::Null,
                layout: Value::Null,
            };
            let record = request.get("record").unwrap_or(&empty);
            render_detail(&request["spec"], record, &options).map(Value::String)
        }
        Some("buildDetail") => {
            if text.is_some() {
                check_display(
                    part(text, "spec"),
                    "record",
                    part(text, "record"),
                    part(text, "options"),
                )?;
            }
            let compilation = compile_options(options)?;
            let options = DetailOptions {
                files: compilation.files,
                basepath: compilation.basepath,
                loader: None,
                language: option_string(options, "language")?.unwrap_or_else(|| "ko".into()),
                // The library checks the context after the specification and record; null means empty.
                data: options.get("data").cloned().unwrap_or(Value::Null),
                page: Value::Null,
                total: Value::Null,
                layout: Value::Null,
            };
            let record = request.get("record").unwrap_or(&empty);
            build_detail(&request["spec"], record, &options)
        }
        Some("buildOutline") => {
            let Some(nodes) = request["nodes"].as_array() else {
                return Err(input("Outline nodes must be a list"));
            };
            if nodes.iter().any(|node| !node.is_object()) {
                return Err(input("Outline nodes must be evaluated node objects"));
            }
            Ok(Value::Array(build_outline(nodes)))
        }
        Some("renderForm") => {
            check_template_text(request, text)?;
            let template = template(&request["template"])?;
            let data = object(request.get("data").unwrap_or(&empty), "Form data")?;
            let form = Form::new(template, data, decode(options)?)?;
            // Render options are passed as decoded; render_form checks their shape.
            let render = request.get("render").cloned().unwrap_or_else(|| json!({}));
            Ok(Value::String(render_form(&form, Some(&render))?))
        }
        Some("form") => {
            check_template_text(request, text)?;
            let template = template(&request["template"])?;
            let data = object(request.get("data").unwrap_or(&empty), "Form data")?;
            let mut form = Form::new(template, data, decode(options)?)?;
            let mut steps = Vec::new();
            let actions = match request.get("actions") {
                Some(actions) => actions
                    .as_array()
                    .ok_or_else(|| input("Actions must be an array"))?
                    .as_slice(),
                None => &[],
            };
            for (index, step) in actions.iter().enumerate() {
                let step_text = part(text, "actions").and_then(|actions| actions.item(index));
                let (result, error) = match action(&mut form, step, step_text) {
                    Ok(value) => (value, Value::Null),
                    Err(error) => (Value::Null, error_json(error)),
                };
                steps.push(json!({"result":result,"error":error,"data":form.get_data(),"fields":form.fields(),"html":render_form(&form, None)?,"revision":form.revision()}));
            }
            Ok(
                json!({"data":form.get_data(),"fields":form.fields(),"html":render_form(&form, None)?,"revision":form.revision(),"steps":steps}),
            )
        }
        _ => Err(input("Unknown generator operation")),
    }
}

/// A binding's text checks follow the template object rule.
fn check_template_text(request: &Value, text: Option<&JsonText>) -> FormResult<()> {
    if text.is_none() {
        return Ok(());
    }
    if !request["template"].is_object() {
        return Err(input("Unsupported form template"));
    }
    check_bind(
        part(text, "template"),
        part(text, "data"),
        part(text, "options"),
    )
}

fn main() {
    // Standard input that is not UTF-8 is not JSON text. JSON text with an
    // unpaired surrogate escape is read without replacing it: the protocol
    // rules read its shape and each operation's text checks run first.
    let mut source = String::new();
    let result = io::stdin()
        .read_to_string(&mut source)
        .map_err(|error| match error.kind() {
            // Standard input that is not UTF-8 is not JSON text (the comment above).
            io::ErrorKind::InvalidData => input("Request must be valid JSON"),
            _ => input(format!("Cannot read the request: {error}")),
        })
        .and_then(|_| match serde_json::from_str::<Value>(&source) {
            Ok(request) => generate(&request, None),
            Err(_) => match JsonText::parse(&source) {
                Ok(text) if text.has_invalid_text() => generate(&text.shape(), Some(&text)),
                _ => Err(input("Request must be valid JSON")),
            },
        });
    match result {
        Ok(value) => println!("{value}"),
        Err(error) => {
            println!("{}", json!({"error":error_json(error)}));
            std::process::exit(1);
        }
    }
}
