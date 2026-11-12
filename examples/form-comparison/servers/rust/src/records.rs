//! The customer record resource of the canonical page: the paged list, one record, its save,
//! the reset and the SSR stage views (docs/operations/form-comparison.md, "Record resource").
use crate::{
    bad, failure,
    form::{field, required, shaped, Shape, COMPANIES},
    json as codec, media_type, parse_native, reply, Error, Result, Server, MAX_BYTES,
};
use axum::{
    extract::{Request, State},
    http::{Method, StatusCode},
    response::Response,
    routing::any,
    Router,
};
use polyspec_crudui_generator::{
    compile_form, render_detail, render_form, render_list, BindOptions, CompileOptions,
    DetailOptions, Form, ListOptions,
};
use polyspec_crudui_validator::validate::{validate, ValidateOptions};
use serde_json::{json, Number, Value};
use std::{fs, io::Write, path::PathBuf, sync::Arc};

const SERVER: &str = "rust";
const PER_PAGE: usize = 20;
const FIXTURE_FILE: &str = "customer-records.json";
const SPECS_FILE: &str = "customer-specs.json";
const STORE_FILE: &str = "records-rust.json";
const LANGUAGES: [&str; 2] = ["ko", "en"];
const FRAMEWORKS: [&str; 4] = ["html", "react", "vue", "svelte"];
const MODES: [&str; 2] = ["bindForm", "createForm"];
const VIEWS: [&str; 3] = ["list", "detail", "form"];
/// The selection members of a view query, in order; `id` precedes them for detail and form.
const SELECTION: [&str; 6] = [
    "lang",
    "server",
    "framework",
    "initialization",
    "mode",
    "page",
];
/// The submitted record form; only `id` must be present.
const FORM: Shape = Shape::Fields(&[
    required("id", Shape::Text),
    field("name", Shape::Text),
    field("status", Shape::Text),
    field("joined", Shape::Text),
    field("score", Shape::Text),
    field("relation", Shape::Texts(&["name"])),
    field("markup", Shape::Text),
    field("companies", COMPANIES),
]);
/// The members of one stored record, in order.
const RECORD_MEMBERS: [&str; 9] = [
    "id",
    "name",
    "status",
    "joined",
    "score",
    "relation",
    "avatar",
    "markup",
    "companies",
];
/// The largest integer a double represents exactly.
const SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

pub fn routes() -> Router<Arc<Server>> {
    Router::new()
        .route("/api/records", any(list))
        .route("/api/records/reset", any(reset))
        .route("/api/records/view/{view}", any(view))
        .route("/api/records/{id}", any(record))
}

fn not_found(message: &str) -> Error {
    failure(StatusCode::NOT_FOUND, message)
}

fn internal(message: impl Into<String>) -> Error {
    failure(StatusCode::INTERNAL_SERVER_ERROR, message)
}

fn allow(request: &Request, method: Method) -> Result<()> {
    if request.method() != method {
        return Err(failure(
            StatusCode::METHOD_NOT_ALLOWED,
            "Method not allowed",
        ));
    }
    Ok(())
}

/// A decimal integer from 1 without sign or leading zero; a value beyond `u64` is beyond every page.
// The fallback is needed: digits-only text fails to parse only when it exceeds `u64`, and such a
// page number is beyond every page.
#[allow(
    clippy::disallowed_methods,
    reason = "digits beyond u64 are beyond every page"
)]
fn positive_decimal(text: &str) -> Option<u64> {
    if text.is_empty() || text.starts_with('0') || !text.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some(text.parse().unwrap_or(u64::MAX))
}

/// JavaScript's text of a JSON number.
pub fn number_text(number: &Number) -> String {
    match number.as_f64().filter(|_| number.is_f64()) {
        Some(value) => ryu_js::Buffer::new().format(value).to_string(),
        None => number.to_string(),
    }
}

/// The persistent store of this server and the fixture it is seeded from.
struct Store {
    file: PathBuf,
    fixture: PathBuf,
}

impl Store {
    fn of(server: &Server) -> Self {
        Self {
            file: server.data.join(STORE_FILE),
            fixture: server.public.join(FIXTURE_FILE),
        }
    }

    fn fixture(&self) -> Result<Vec<Value>> {
        records(&fs::read(&self.fixture)?, "fixture")
    }

    /// Run the operation under the exclusive store lock.
    fn locked<T>(&self, operation: impl FnOnce() -> Result<T>) -> Result<T> {
        let lock = crate::repository::open_lock(&self.file)?;
        lock.lock()?;
        operation()
    }

    /// Atomically replace the store file with the records through a temporary file.
    fn replace(&self, encoded: &str) -> Result<()> {
        let mut temporary = tempfile::NamedTempFile::new_in(
            self.file
                .parent()
                .ok_or_else(|| internal("Missing store directory"))?,
        )?;
        writeln!(temporary, "{encoded}")?;
        temporary.as_file().sync_all()?;
        temporary.persist(&self.file).map_err(|e| e.error)?;
        Ok(())
    }

    /// Lock the store, read it (seeding a missing file from the fixture) and atomically replace
    /// it with the records the operation returns. A failed operation writes nothing.
    fn transaction<T>(
        &self,
        operation: impl FnOnce(Vec<Value>) -> Result<(Vec<Value>, T)>,
    ) -> Result<T> {
        self.locked(|| {
            let (before, exists) = match fs::read(&self.file) {
                Ok(bytes) => (records(&bytes, "store")?, true),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    (self.fixture()?, false)
                }
                Err(error) => return Err(error.into()),
            };
            let unchanged = codec::encode_values(&Value::Array(before.clone()))?;
            let (after, result) = operation(before)?;
            let encoded = codec::encode_values(&Value::Array(after))?;
            if !exists || encoded != unchanged {
                self.replace(&encoded)?;
            }
            Ok(result)
        })
    }

    /// Replace the store with the fixture, whatever the store file holds, and return its count.
    fn reset(&self) -> Result<usize> {
        let fixture = self.fixture()?;
        let encoded = codec::encode_values(&Value::Array(fixture.clone()))?;
        self.locked(|| self.replace(&encoded))?;
        Ok(fixture.len())
    }

    fn read(&self) -> Result<Vec<Value>> {
        self.transaction(|records| Ok((records.clone(), records)))
    }
}

/// Decode a records array: records with exactly the fixture's members in order, `score` a
/// number, every other scalar a string and `companies` complete in the form's shape and member
/// order. Anything else is a server fault.
fn records(bytes: &[u8], name: &str) -> Result<Vec<Value>> {
    let malformed = |detail: &str| internal(format!("The record {name} is malformed: {detail}"));
    let value = codec::decode_values(bytes).map_err(|e| malformed(&e.message))?;
    let items = value
        .as_array()
        .ok_or_else(|| malformed("expected a records array"))?;
    for item in items {
        let record = item
            .as_object()
            .filter(|record| record.keys().eq(RECORD_MEMBERS.iter()))
            .ok_or_else(|| malformed("expected the record members"))?;
        for member in RECORD_MEMBERS {
            let value = &record[member];
            let valid = match member {
                "score" => value.is_number(),
                "relation" => value.as_object().is_some_and(|relation| {
                    relation.len() == 1 && relation.get("name").is_some_and(Value::is_string)
                }),
                // A stored record holds its companies complete, in member order.
                "companies" => {
                    let completed = shaped(value, &COMPANIES, "companies")
                        .map_err(|e| malformed(&e.message))?;
                    serde_json::to_string(&completed).expect("a serde_json Value serializes")
                        == serde_json::to_string(value).expect("a serde_json Value serializes")
                }
                _ => value.is_string(),
            };
            if !valid {
                return Err(malformed(&format!("expected the record member {member}")));
            }
        }
    }
    Ok(items.clone())
}

fn find<'a>(records: &'a [Value], id: &str) -> Result<&'a Value> {
    records
        .iter()
        .find(|record| record["id"] == id)
        .ok_or_else(|| not_found("Record not found"))
}

fn page_data(records: &[Value], page: u64) -> Result<Value> {
    let last = records.len().div_ceil(PER_PAGE).max(1) as u64;
    if page > last {
        return Err(not_found("Page not found"));
    }
    let start = (page as usize - 1) * PER_PAGE;
    let items = &records[start..records.len().min(start + PER_PAGE)];
    Ok(json!({"page":page,"perPage":PER_PAGE,"total":records.len(),"records":items}))
}

fn specs(server: &Server) -> Result<Value> {
    let specs = codec::decode(&fs::read(server.public.join(SPECS_FILE))?).map_err(|error| {
        internal(format!(
            "The record specifications are malformed: {}",
            error.message
        ))
    })?;
    if !["list", "detail", "form"]
        .iter()
        .all(|name| specs[name].is_object())
    {
        return Err(internal(
            "Expected the list, detail and form specifications",
        ));
    }
    Ok(specs)
}

async fn list(State(server): State<Arc<Server>>, request: Request) -> Result<Response> {
    allow(&request, Method::GET)?;
    let query = request.uri().query().unwrap_or("");
    let pairs: Vec<_> = form_urlencoded::parse(query.as_bytes()).collect();
    let page = match pairs.as_slice() {
        [(name, value)] if name == "page" => positive_decimal(value),
        _ => None,
    }
    .ok_or_else(|| bad("Expected one page parameter"))?;
    let records = Store::of(&server).read()?;
    reply(StatusCode::OK, page_data(&records, page)?)
}

async fn reset(State(server): State<Arc<Server>>, request: Request) -> Result<Response> {
    allow(&request, Method::POST)?;
    let body = axum::body::to_bytes(request.into_body(), MAX_BYTES)
        .await
        .map_err(|e| failure(StatusCode::PAYLOAD_TOO_LARGE, e.to_string()))?;
    if !body.is_empty() {
        return Err(bad("The reset request takes no body"));
    }
    let total = Store::of(&server).reset()?;
    reply(StatusCode::OK, json!({"total":total}))
}

/// The last path segment as written, without percent-decoding.
fn raw_segment(request: &Request) -> String {
    let path = request.uri().path();
    path[path.rfind('/').map_or(0, |index| index + 1)..].to_owned()
}

async fn record(State(server): State<Arc<Server>>, request: Request) -> Result<Response> {
    let id = raw_segment(&request);
    if request.method() == Method::GET {
        let records = Store::of(&server).read()?;
        return reply(StatusCode::OK, json!({"record":find(&records, &id)?}));
    }
    allow(&request, Method::POST)?;
    save(&server, &id, request).await
}

/// The submitted form object of a native or JSON save request.
pub(crate) async fn submitted(request: Request) -> Result<Value> {
    let kind = media_type(&request)?;
    let mut body = match kind.as_str() {
        "application/json" => {
            let bytes = axum::body::to_bytes(request.into_body(), MAX_BYTES)
                .await
                .map_err(|e| failure(StatusCode::PAYLOAD_TOO_LARGE, e.to_string()))?;
            codec::decode(&bytes)?
        }
        "multipart/form-data" | "application/x-www-form-urlencoded" => {
            let mut fields = parse_native(request, &kind).await?;
            let members = fields
                .as_object_mut()
                .expect("native fields form an object");
            if members
                .remove("_form_complete")
                .as_ref()
                .and_then(Value::as_str)
                != Some("1")
            {
                return Err(bad("Incomplete native form submission"));
            }
            // A native form without rows or values posts no `form` field at all.
            if !members.contains_key("form") {
                members.insert("form".into(), json!({}));
            }
            fields
        }
        _ => {
            return Err(failure(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "Expected a form or JSON request",
            ))
        }
    };
    match body.as_object_mut() {
        Some(members) if members.len() == 1 => members
            .remove("form")
            .ok_or_else(|| bad("Expected form object")),
        _ => Err(bad("Expected form object")),
    }
}

/// The submission completed in the member order of the record form.
pub(crate) fn form_members(form: &Value) -> Result<Value> {
    shaped(form, &FORM, "form")
}

/// The JSON number of valid numeric text; an integral value is stored as an integer.
fn score(text: &str) -> Result<Value> {
    let value: f64 = text
        .trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
        .parse()
        .map_err(|error| bad(format!("Expected a numeric score: {error}")))?;
    if value.fract() == 0.0 && value.abs() <= SAFE_INTEGER {
        return Ok(json!(value as i64));
    }
    Number::from_f64(value)
        .map(Value::Number)
        .ok_or_else(|| bad("Expected a finite score"))
}

async fn save(server: &Server, id: &str, request: Request) -> Result<Response> {
    let store = Store::of(server);
    find(&store.read()?, id)?;
    let data = form_members(&submitted(request).await?)?;
    if data["id"] != id {
        return Err(bad("The form id differs from the record id"));
    }
    let validation = validate(&specs(server)?["form"], &data, &ValidateOptions::default())
        .map_err(|e| internal(e.to_string()))?;
    let errors: Vec<Value> = validation.errors.iter().map(|e| e.to_value()).collect();
    let validation = json!({"valid":validation.valid,"errors":errors,"hidden":validation.hidden});
    if validation["valid"] != true {
        return reply(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!({"validation":validation}),
        );
    }
    let score = score(data["score"].as_str().expect("members are text"))?;
    let saved = store.transaction(|mut records| {
        let index = records
            .iter()
            .position(|record| record["id"] == id)
            .ok_or_else(|| not_found("Record not found"))?;
        let mut record = records[index]
            .as_object()
            .cloned()
            .expect("stored records are objects");
        for (name, value) in record.iter_mut() {
            match name.as_str() {
                "score" => *value = score.clone(),
                "name" | "status" | "joined" | "relation" | "markup" | "companies" => {
                    *value = data[name].clone()
                }
                _ => {}
            }
        }
        let record = Value::Object(record);
        records[index] = record.clone();
        Ok((records, record))
    })?;
    reply(
        StatusCode::OK,
        json!({"record":saved,"validation":validation}),
    )
}

struct Selection {
    id: Option<String>,
    language: String,
    framework: String,
    mode: String,
    page: u64,
}

impl Selection {
    /// Accept exactly `[id,] lang, server, framework, initialization, mode, page` in this order.
    fn parse(view: &str, query: &str) -> Result<Self> {
        let invalid = || {
            bad("Expected id, lang, server, framework, initialization, mode and page for this view")
        };
        let pairs: Vec<(String, String)> = form_urlencoded::parse(query.as_bytes())
            .map(|(name, value)| (name.into_owned(), value.into_owned()))
            .collect();
        let (id, selection) = if view == "list" {
            (None, pairs.as_slice())
        } else {
            match pairs.split_first() {
                Some(((name, id), rest)) if name == "id" && positive_decimal(id).is_some() => {
                    (Some(id.clone()), rest)
                }
                _ => return Err(invalid()),
            }
        };
        if selection.len() != SELECTION.len()
            || selection
                .iter()
                .zip(SELECTION)
                .any(|((name, _), expected)| name != expected)
        {
            return Err(invalid());
        }
        let value = |index: usize| selection[index].1.as_str();
        if !LANGUAGES.contains(&value(0))
            || value(1) != SERVER
            || !FRAMEWORKS.contains(&value(2))
            || value(3) != "ssr"
            || !MODES.contains(&value(4))
        {
            return Err(invalid());
        }
        Ok(Self {
            id,
            language: value(0).into(),
            framework: value(2).into(),
            mode: value(4).into(),
            page: positive_decimal(value(5)).ok_or_else(invalid)?,
        })
    }

    /// The selection query every generated link carries.
    fn query(&self) -> String {
        format!(
            "lang={}&server={SERVER}&framework={}&initialization=ssr&mode={}&page={}",
            self.language, self.framework, self.mode, self.page
        )
    }
}

fn append_link(spec: &mut Value, query: &str) -> Result<()> {
    let href = spec
        .as_str()
        .ok_or_else(|| internal("Expected a link address in the record specifications"))?;
    *spec = Value::String(format!("{href}&{query}"));
    Ok(())
}

/// The form data of one stored record: every form member as text.
fn form_data(record: &Value) -> Result<Value> {
    let text = |value: &Value| {
        value
            .as_str()
            .map(|text| Value::String(text.into()))
            .ok_or_else(|| internal("Expected a text member in the stored record"))
    };
    let companies = record["companies"]
        .as_object()
        .ok_or_else(|| internal("Expected companies in the stored record"))?;
    let score = record["score"]
        .as_number()
        .ok_or_else(|| internal("Expected a numeric score in the stored record"))?;
    Ok(json!({
        "id": text(&record["id"])?, "name": text(&record["name"])?,
        "status": text(&record["status"])?, "joined": text(&record["joined"])?,
        "score": number_text(score), "relation": {"name": text(&record["relation"]["name"])?},
        "markup": text(&record["markup"])?, "companies": companies,
    }))
}

async fn view(State(server): State<Arc<Server>>, request: Request) -> Result<Response> {
    allow(&request, Method::GET)?;
    let view = raw_segment(&request);
    if !VIEWS.contains(&view.as_str()) {
        return Err(not_found("Unknown view"));
    }
    let selection = Selection::parse(&view, request.uri().query().unwrap_or(""))?;
    let records = Store::of(&server).read()?;
    let list = page_data(&records, selection.page)?;
    let mut specs = specs(&server)?;
    let query = selection.query();
    let language = selection.language.clone();
    let render = |error: polyspec_crudui_generator::FormError| internal(error.to_string());
    let (html, data) = match (view.as_str(), &selection.id) {
        ("list", None) => {
            append_link(
                &mut specs["list"]["columns"]["name"]["format"]["href"],
                &query,
            )?;
            let html = render_list(
                &specs["list"],
                list["records"].as_array().expect("a page holds records"),
                &ListOptions {
                    language,
                    page: json!(selection.page),
                    total: list["total"].clone(),
                    layout: json!("table"),
                    ..Default::default()
                },
            )
            .map_err(render)?;
            (html, list)
        }
        ("detail", Some(id)) => {
            let record = find(&records, id)?;
            append_link(
                &mut specs["detail"]["fields"]["id"]["format"]["href"],
                &query,
            )?;
            let html = render_detail(
                &specs["detail"],
                record,
                &DetailOptions {
                    language,
                    ..Default::default()
                },
            )
            .map_err(render)?;
            (html, json!({"record":record}))
        }
        ("form", Some(id)) => {
            let record = find(&records, id)?;
            let template = compile_form(
                &specs["form"],
                &CompileOptions {
                    key_prefix: Some("form".into()),
                    ..Default::default()
                },
            )
            .map_err(render)?;
            let form = Form::new(
                template,
                &form_data(record)?,
                BindOptions {
                    language: Value::String(language),
                    ..Default::default()
                },
            )
            .map_err(render)?;
            let html = format!(
                r#"<form id="record-form" method="post" action="/api/{SERVER}/records/{id}" enctype="multipart/form-data">{}</form>"#,
                render_form(&form, None).map_err(render)?
            );
            (html, json!({"record":record}))
        }
        _ => unreachable!("the query parser requires an id exactly for detail and form"),
    };
    reply(StatusCode::OK, json!({"view":view,"html":html,"data":data}))
}
