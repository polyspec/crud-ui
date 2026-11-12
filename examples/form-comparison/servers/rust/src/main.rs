//! Parse, validate and persist form comparison requests with the Rust libraries.
#![allow(
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths of the crudui cores; this program reads its requests with their documented defaults"
)]

mod form;
mod generation;
mod json;
mod records;
mod repository;

use axum::{
    extract::{DefaultBodyLimit, FromRequest, Multipart, Path, Request, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use polyspec_crud_ui_validator::validate::{validate, ValidateOptions};
use repository::{load_data, read_object, Repository};
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Arc};

const MAX_BYTES: usize = 2 * 1024 * 1024;

type Result<T> = std::result::Result<T, Error>;
#[derive(Debug)]
struct Error {
    status: StatusCode,
    message: String,
}
fn failure(status: StatusCode, message: impl Into<String>) -> Error {
    Error {
        status,
        message: message.into(),
    }
}
fn bad(message: impl Into<String>) -> Error {
    failure(StatusCode::BAD_REQUEST, message)
}
impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: error.to_string(),
        }
    }
}
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let body = json::encode_values(&json!({"error":self.message,"server":"rust"}))
            .expect("error response contains valid strings");
        (
            self.status,
            [
                ("Content-Type", "application/json; charset=utf-8"),
                ("Cache-Control", "no-store"),
            ],
            body,
        )
            .into_response()
    }
}
fn reply(status: StatusCode, mut body: Value) -> Result<Response> {
    body["server"] = json!("rust");
    Ok((
        status,
        [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Cache-Control", "no-store"),
        ],
        json::encode_values(&body)?,
    )
        .into_response())
}

/// The lowercase media type of a request without parameters. A Content-Type that is not text is a
/// bad request, not an absent one.
pub(crate) fn media_type(request: &Request) -> Result<String> {
    let text = match request.headers().get("Content-Type") {
        None => "",
        Some(value) => value
            .to_str()
            .map_err(|error| bad(format!("Content-Type is not text: {error}")))?,
    };
    Ok(text
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase())
}

struct Server {
    data: PathBuf,
    /// The public directory: the browser matrix, the benchmark specification and records, the
    /// frames and the customer record fixture and specifications.
    public: PathBuf,
    /// The source identity of the running build, read on every request.
    source: PathBuf,
    actions: Vec<String>,
    rendering_paths: Vec<String>,
    frameworks: Vec<String>,
}

impl Server {
    /// Read the browser matrix shared with the JavaScript comparison runner
    /// (runtime-paths.json in the public directory) once.
    fn load(data: PathBuf, public: PathBuf, source: PathBuf) -> Result<Self> {
        let matrix = read_object(&public.join("runtime-paths.json"))?;
        let list = |name: &str| -> Result<Vec<String>> {
            matrix[name]
                .as_array()
                .filter(|items| !items.is_empty())
                .and_then(|items| {
                    items
                        .iter()
                        .map(|item| item.as_str().map(str::to_string))
                        .collect::<Option<Vec<_>>>()
                })
                .ok_or_else(|| bad(format!("The browser matrix needs {name}")))
        };
        Ok(Self {
            actions: list("actions")?,
            rendering_paths: list("renderingPaths")?,
            frameworks: list("frameworks")?,
            data,
            public,
            source,
        })
    }
}

async fn parse_native(request: Request, kind: &str) -> Result<Value> {
    let mut result = json!({});
    if kind == "multipart/form-data" {
        let mut multipart = Multipart::from_request(request, &())
            .await
            .map_err(|e| Error {
                status: e.status(),
                message: e.to_string(),
            })?;
        let mut count = 0;
        while let Some(field) = multipart.next_field().await.map_err(|e| Error {
            status: e.status(),
            message: e.to_string(),
        })? {
            count += 1;
            if count > 10000 {
                return Err(bad("Too many native form fields"));
            }
            if field.file_name().is_some() {
                return Err(bad("File uploads are not part of this form"));
            }
            let name = field
                .name()
                .ok_or_else(|| bad("Missing native field name"))?
                .to_string();
            let bytes = field.bytes().await.map_err(|e| Error {
                status: e.status(),
                message: e.to_string(),
            })?;
            let value = String::from_utf8(bytes.to_vec()).map_err(|e| bad(e.to_string()))?;
            form::insert_native(&mut result, &name, value)?;
        }
    } else if kind == "application/x-www-form-urlencoded" {
        let bytes = axum::body::to_bytes(request.into_body(), MAX_BYTES)
            .await
            .map_err(|e| Error {
                status: StatusCode::PAYLOAD_TOO_LARGE,
                message: e.to_string(),
            })?;
        for (i, (name, value)) in form_urlencoded::parse(&bytes).enumerate() {
            if i >= 10000 {
                return Err(bad("Too many native form fields"));
            }
            form::insert_native(&mut result, &name, value.into_owned())?;
        }
    } else {
        return Err(Error {
            status: StatusCode::UNSUPPORTED_MEDIA_TYPE,
            message: "Expected a native form".into(),
        });
    }
    Ok(result)
}

async fn handle(
    State(server): State<Arc<Server>>,
    Path((action, rendering_path, framework)): Path<(String, String, String)>,
    request: Request,
) -> Result<Response> {
    if !server.rendering_paths.contains(&rendering_path)
        || !server.frameworks.contains(&framework)
        || !server.actions.contains(&action)
    {
        return Err(Error {
            status: StatusCode::NOT_FOUND,
            message: "Unknown endpoint".into(),
        });
    }
    if ["compile", "render", "ssr"].contains(&action.as_str()) {
        return generation::handle(&server, &action, &rendering_path, &framework, request).await;
    }
    let expected = if action == "load" {
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
    let repo = Repository {
        file: server
            .data
            .join(format!("rust-{rendering_path}-{framework}.json")),
        fixtures: server.public.join("records.json"),
    };
    let kind = media_type(&request)?;
    if action == "load" || action == "reset" {
        let storage = if action == "load" {
            repo.read()?
        } else {
            let fields = parse_native(request, &kind).await?;
            let fixture = match fields.get("fixture") {
                None => "default",
                Some(value) => value.as_str().ok_or_else(|| bad("Expected fixture name"))?,
            };
            repo.reset(fixture)?
        };
        let data = load_data(&storage)?;
        return reply(StatusCode::OK, json!({"storage":storage,"data":data}));
    }
    // One request rule for the record save and the benchmark: exactly `form` in JSON, exactly
    // `form[...]` and `_form_complete=1` in a native form.
    let received = records::submitted(request).await?;
    // The benchmark form holds only `companies`, under the one rule of the record form.
    let data = form::shaped(&received, &form::SCENARIO, "form")?;
    let spec = read_object(&server.public.join("spec.json"))?;
    let validation = validate(&spec, &data, &ValidateOptions::default()).map_err(|e| Error {
        status: match e {
            polyspec_crud_ui_validator::ValidateError::InvalidFormInput(_) => {
                StatusCode::BAD_REQUEST
            }
            polyspec_crud_ui_validator::ValidateError::Load(_) => StatusCode::INTERNAL_SERVER_ERROR,
        },
        message: e.to_string(),
    })?;
    let errors: Vec<Value> = validation
        .errors
        .iter()
        .map(|error| error.to_value())
        .collect();
    let mut result = json!({"transport":kind,"jsonProcessor":"ordered-json","validatorSource":"current","received":received,"normalized":data,"validation":{"valid":validation.valid,"errors":errors,"hidden":validation.hidden}});
    if action == "validate" {
        return reply(StatusCode::OK, result);
    }
    if !validation.valid {
        return reply(StatusCode::UNPROCESSABLE_ENTITY, result);
    }
    let saved = repo.save(&data)?;
    for (key, value) in saved.as_object().expect("repository result is an object") {
        result[key] = value.clone();
    }
    reply(StatusCode::OK, result)
}

#[tokio::main]
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 {
        return Err(
            "Expected arguments: address data-directory public-directory source-identity-file"
                .into(),
        );
    }
    let server = Arc::new(
        Server::load(
            PathBuf::from(&args[2]),
            PathBuf::from(&args[3]),
            PathBuf::from(&args[4]),
        )
        .map_err(|error| error.message)?,
    );
    let app = application(server);
    let listener = tokio::net::TcpListener::bind(&args[1]).await?;
    // The address that the listener took, also for port 0.
    eprintln!("CRUDUI_READY rust {}", listener.local_addr()?);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(server): State<Arc<Server>>) -> Result<Response> {
    reply(
        StatusCode::OK,
        json!({"status":"ok","validatorSource":"current","source":generation::source_identity(&server)?,"storage":"JSON files","jsonProcessor":"ordered-json","generator":generation::provenance(&server)?}),
    )
}

fn application(server: Arc<Server>) -> Router {
    Router::new()
        .route("/api/health", any(health))
        .route("/api/{action}/{rendering_path}/{framework}", any(handle))
        .merge(records::routes())
        .with_state(server)
        .layer(DefaultBodyLimit::max(MAX_BYTES))
}

#[cfg(test)]
mod tests;
