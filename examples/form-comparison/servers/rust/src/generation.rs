use crate::{
    bad, json as codec, reply,
    repository::{load_data, read_object, Repository},
    Error, Result, Server, MAX_BYTES,
};
use axum::{
    extract::Request,
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
};
use polyspec_crud_ui_generator::{
    compile_form, render_form, BindOptions, CompileOptions, Form, FormTemplate,
};
use polyspec_crud_ui_validator::compose::{ComposeResult, FileLoader, LoadedDoc, MemoryLoader};
use serde_json::{json, Map, Value};
use std::cell::Cell;

/// Read the identity of the repository tree the running build came from: its commit and the
/// digest of its uncommitted changes, or null.
pub fn source_identity(server: &Server) -> Result<Value> {
    let identity = read_object(&server.source)?;
    let keys = identity
        .as_object()
        .map(|members| members.keys().map(String::as_str).collect::<Vec<_>>());
    if keys.as_deref() != Some(&["commit", "changes"][..]) {
        return Err(internal(
            "Expected a source identity with commit and changes",
        ));
    }
    Ok(identity)
}

pub fn provenance(server: &Server) -> Result<Value> {
    Ok(json!({"runtime":"rust","source":source_identity(server)?}))
}

fn object<'a>(request: &'a Value, name: &str) -> Result<&'a Value> {
    request
        .get(name)
        .filter(|value| value.is_object())
        .ok_or_else(|| bad(format!("Expected {name} object")))
}

fn string_option(options: &Map<String, Value>, name: &str) -> Result<Option<String>> {
    options
        .get(name)
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| bad(format!("Expected string option: {name}")))
        })
        .transpose()
}

struct CountingLoader {
    loader: MemoryLoader,
    reads: Cell<usize>,
}

impl FileLoader for CountingLoader {
    fn normalize(&self, path: &str, basepath: &str) -> String {
        self.loader.normalize(path, basepath)
    }

    fn load(&self, key: &str) -> ComposeResult<LoadedDoc> {
        self.reads.set(self.reads.get() + 1);
        self.loader.load(key)
    }
}

fn compile(request: &Value, options: &Map<String, Value>, generator: Value) -> Result<Value> {
    let files = match options.get("files") {
        Some(value) => value
            .as_object()
            .cloned()
            .ok_or_else(|| bad("Expected composition files object"))?,
        None => Map::new(),
    };
    let loader = CountingLoader {
        loader: MemoryLoader::new(files),
        reads: Cell::new(0),
    };
    let template = compile_form(
        object(request, "spec")?,
        &CompileOptions {
            loader: Some(&loader),
            basepath: string_option(options, "basepath")?.unwrap_or_default(),
            key_prefix: string_option(options, "keyPrefix")?,
            ..Default::default()
        },
    )
    .map_err(|error| bad(error.to_string()))?;
    Ok(json!({"template":template,"generator":generator,"referenceReads":loader.reads.get()}))
}

fn render(request: &Value, options: &Map<String, Value>, generator: Value) -> Result<Value> {
    for name in ["files", "loader", "basepath"] {
        if options.contains_key(name) {
            return Err(bad(format!(
                "Composition option is not valid for rendering: {name}"
            )));
        }
    }
    let template: FormTemplate = serde_json::from_value(object(request, "template")?.clone())
        .map_err(|error| bad(error.to_string()))?;
    // An absent option is null so the generator applies its default.
    let option = |name| -> Result<Value> {
        Ok(string_option(options, name)?.map_or(Value::Null, Value::String))
    };
    let binding = BindOptions {
        key_prefix: option("keyPrefix")?,
        id_prefix: option("idPrefix")?,
        language: option("language")?,
        unsupported: option("unsupported")?,
        // The comparison renders the initial view, every row expanded (CURT-068).
        collapsed: Value::Null,
    };
    let form = Form::new(template, object(request, "data")?, binding)
        .map_err(|error| bad(error.to_string()))?;
    let html = render_form(&form, None).map_err(|error| bad(error.to_string()))?;
    Ok(
        json!({"data":form.get_data(),"fields":form.fields(),"html":html,"revision":form.revision(),"generator":generator}),
    )
}

pub async fn handle(
    server: &Server,
    action: &str,
    rendering_path: &str,
    framework: &str,
    request: Request,
) -> Result<Response> {
    let expected = if action == "ssr" {
        Method::GET
    } else {
        Method::POST
    };
    if request.method() != expected {
        return Err(Error {
            status: StatusCode::METHOD_NOT_ALLOWED,
            message: "Method not allowed".into(),
        });
    }
    if action == "ssr" {
        return document(server, rendering_path, framework, request.uri().query());
    }
    let kind = crate::media_type(&request)?;
    if kind != "application/json" {
        return Err(Error {
            status: StatusCode::UNSUPPORTED_MEDIA_TYPE,
            message: "Expected a JSON generation request".into(),
        });
    }
    let bytes = axum::body::to_bytes(request.into_body(), MAX_BYTES)
        .await
        .map_err(|error| Error {
            status: StatusCode::PAYLOAD_TOO_LARGE,
            message: error.to_string(),
        })?;
    let body = codec::decode(&bytes)?;
    if !body.is_object() {
        return Err(bad("Expected request object"));
    }
    let options = match body.get("options") {
        Some(value) => value
            .as_object()
            .cloned()
            .ok_or_else(|| bad("Expected options object"))?,
        None => Map::new(),
    };
    let generator = provenance(server)?;
    let response = if action == "compile" {
        compile(&body, &options, generator)?
    } else {
        render(&body, &options, generator)?
    };
    reply(StatusCode::OK, response)
}

const FRAME_ERROR: &str =
    "The frame document must contain one html start tag, one empty form view and one body end tag";
const HTML_START: &str = "<html>";
const FORM_VIEW: &str = r#"<div id="form-view"></div>"#;
const BODY_END: &str = "</body>";

fn internal(message: impl Into<String>) -> Error {
    Error {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: message.into(),
    }
}

/// Accept exactly lang, server and initialization, each once.
fn frame_language(query: Option<&str>) -> Result<String> {
    let invalid = || bad("Expected lang, server and initialization for this SSR frame");
    let mut values: [Option<String>; 3] = [None, None, None];
    for (name, value) in form_urlencoded::parse(query.unwrap_or("").as_bytes()) {
        let index = ["lang", "server", "initialization"]
            .iter()
            .position(|expected| *expected == name)
            .ok_or_else(invalid)?;
        if values[index].replace(value.into_owned()).is_some() {
            return Err(invalid());
        }
    }
    match values {
        [Some(language), Some(server), Some(initialization)]
            if ["ko", "en"].contains(&language.as_str())
                && server == "rust"
                && initialization == "ssr" =>
        {
            Ok(language)
        }
        _ => Err(invalid()),
    }
}

fn document(
    server: &Server,
    rendering_path: &str,
    framework: &str,
    query: Option<&str>,
) -> Result<Response> {
    let language = frame_language(query)?;
    let frame_path = server
        .public
        .join("frames")
        .join(format!("{rendering_path}-{framework}"))
        .join("index.html");
    // The response carries the contract error; the server's error stream names the file and the cause.
    let frame = std::fs::read_to_string(&frame_path).map_err(|error| {
        eprintln!("read {}: {error}", frame_path.display());
        internal(FRAME_ERROR)
    })?;
    if [HTML_START, FORM_VIEW, BODY_END]
        .iter()
        .any(|part| frame.matches(part).count() != 1)
    {
        return Err(internal(FRAME_ERROR));
    }
    let spec = read_object(&server.public.join("spec.json"))?;
    let template = compile_form(
        &spec,
        &CompileOptions {
            key_prefix: Some("form".into()),
            ..Default::default()
        },
    )
    .map_err(|error| internal(error.to_string()))?;
    let repository = Repository {
        file: server
            .data
            .join(format!("rust-{rendering_path}-{framework}.json")),
        fixtures: server.public.join("records.json"),
    };
    let data = load_data(&repository.read()?)?;
    let form = Form::new(
        template,
        &data,
        BindOptions {
            language: Value::String(language.clone()),
            ..Default::default()
        },
    )
    .map_err(|error| internal(error.to_string()))?;
    let markup = render_form(&form, None).map_err(|error| internal(error.to_string()))?;
    // JSON escapes keep the payload from ending the script element early.
    let payload = codec::encode(&json!({"data":form.get_data(),"generator":provenance(server)?}))?
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
        .replace('&', "\\u0026");
    // Each part occurs once; the form markup is inserted last so it is never searched.
    let document = frame
        .replacen(HTML_START, &format!(r#"<html lang="{language}">"#), 1)
        .replacen(
            BODY_END,
            &format!(
                r#"<script type="application/json" id="crudui-ssr">{payload}</script>{BODY_END}"#
            ),
            1,
        )
        .replacen(
            FORM_VIEW,
            &format!(r#"<div id="form-view">{markup}</div>"#),
            1,
        );
    Ok((
        StatusCode::OK,
        [
            ("Content-Type", "text/html; charset=utf-8"),
            ("Cache-Control", "no-store"),
        ],
        document,
    )
        .into_response())
}
