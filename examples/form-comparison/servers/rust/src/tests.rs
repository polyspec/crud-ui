use super::*;
use axum::body::{to_bytes, Body};
use polyspec_crud_ui_generator::{compile_form, render_form, BindOptions, CompileOptions, Form};
use polyspec_crud_ui_validator::validate::{validate, ValidateOptions};
use serde_json::Map;
use std::fs;
use tower::ServiceExt;

fn spec() -> Value {
    json!({"type":"group","properties":{"companies":{"type":"group","multiple":true,"properties":{
        "name":{"type":"text","label":{"en":"Company","ko":"회사"},"validate":{"required":true}},
        "stores":{"type":"group","multiple":true,"properties":{
            "name":{"type":"text","validate":{"required":true}},
            "enabled":{"type":"checkbox","default":"1"},
            "detail":{"type":"textarea","design":{"show":".enabled"}},
            "title":{"type":"text","lang":{"only":["ko","en"]}},
            "departments":{"type":"group","multiple":true,"properties":{"name":{"type":"text","validate":{"required":true}}}}
        }}
    }}},
    "buttons":[{"type":"submit","name":"_form_complete","value":"1","text":{"en":"Save","ko":"저장"}}]})
}

const FRAME: &str = r#"<!doctype html><html><head><title>Frame</title></head><body><main><div id="form-view"></div></main><script type="module" src="./frame.js"></script></body></html>"#;
const CUSTOMER_RECORDS: &str = include_str!("../../../fixtures/customer-records.json");
const CUSTOMER_SPECS: &str = include_str!("../../../fixtures/customer-specs.json");
const TEST_COMMIT: &str = "0123456789abcdef0123456789abcdef01234567";

fn fixture() -> (tempfile::TempDir, Arc<Server>) {
    let directory = tempfile::tempdir().unwrap();
    let data = directory.path().join("data");
    let public = directory.path().join("public");
    let source = directory.path().join("source.json");
    fs::create_dir_all(&data).unwrap();
    fs::create_dir_all(&public).unwrap();
    fs::write(
        &source,
        format!(r#"{{"commit":"{TEST_COMMIT}","changes":null}}"#),
    )
    .unwrap();
    for (name, contents) in [
        (
            "records.json",
            include_str!("../../../fixtures/records.json"),
        ),
        (
            "runtime-paths.json",
            include_str!("../../../src/runtime-paths.json"),
        ),
        ("customer-records.json", CUSTOMER_RECORDS),
        ("customer-specs.json", CUSTOMER_SPECS),
    ] {
        fs::write(public.join(name), contents).unwrap();
    }
    fs::write(public.join("spec.json"), json::encode(&spec()).unwrap()).unwrap();
    for frame in ["createForm-react", "createForm-vue"] {
        fs::create_dir_all(public.join("frames").join(frame)).unwrap();
        fs::write(public.join("frames").join(frame).join("index.html"), FRAME).unwrap();
    }
    (
        directory,
        Arc::new(Server::load(data, public, source).unwrap()),
    )
}

async fn request(
    app: &Router,
    method: &str,
    path: &str,
    content_type: &str,
    body: String,
) -> Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("Content-Type", content_type)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn decoded(response: Response) -> Value {
    let bytes = to_bytes(response.into_body(), MAX_BYTES * 10)
        .await
        .unwrap();
    json::decode_values(&bytes).unwrap()
}

async fn post(app: &Router, operation: &str, body: Value) -> Value {
    let response = request(
        app,
        "POST",
        &format!("/api/{operation}/createForm/react"),
        "application/json",
        json::encode(&body).unwrap(),
    )
    .await;
    let status = response.status();
    let value = decoded(response).await;
    assert_eq!(status, StatusCode::OK, "{operation}: {value}");
    value
}

/// The collapsible rows of evaluated nodes, depth first.
fn collapsible_rows<'a>(nodes: &'a Value, rows: &mut Vec<&'a Value>) {
    for node in nodes.as_array().into_iter().flatten() {
        if node["collapsible"] == json!(true) {
            rows.push(node);
        }
        collapsible_rows(&node["children"], rows);
    }
}

#[tokio::test]
async fn compilation_and_cached_rendering_use_rust_and_preserve_order() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    // Fields come by reference; root declarations such as buttons stay on the form root.
    let compiled = post(&app, "compile", json!({"spec":{"type":"group","buttons":spec()["buttons"],"properties":{"$ref":"fields.json"}},"options":{"keyPrefix":"form","files":{"fields.json":{"type":"group","properties":spec()["properties"]}}}})).await;
    assert_eq!(
        compiled["generator"],
        json!({"runtime":"rust","source":{"commit":TEST_COMMIT,"changes":null}})
    );
    assert_eq!(compiled["referenceReads"], 1);
    let direct = post(&app, "compile", json!({"spec":spec()})).await;
    assert_eq!(direct["referenceReads"], 0);
    assert_eq!(
        fs::read_dir(&server.data).unwrap().count(),
        0,
        "Compilation must not access record storage"
    );
    let records = json::decode(include_bytes!("../../../fixtures/records.json")).unwrap();
    let data = load_data(&records["nonsequential"]).unwrap();
    let input = json!({"template":compiled["template"],"data":data,"options":{"idPrefix":"scope:'한글","language":"en"}});
    let initial = post(&app, "render", input.clone()).await;
    let repeated = post(&app, "render", input).await;
    assert_eq!(initial, repeated);
    assert_eq!(initial["data"], data);
    assert_eq!(
        initial["data"]["companies"]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        [
            "__0000000000005__",
            "__0000000000007__",
            "__0000000000001__"
        ]
    );
    assert_eq!(initial["revision"], 0);
    assert_eq!(initial["generator"], compiled["generator"]);
    assert!(initial["fields"].is_array());
    // Server rendering uses the initial view: every collapsible row is expanded (CURT-068).
    let mut rows = Vec::new();
    collapsible_rows(&initial["fields"], &mut rows);
    assert!(!rows.is_empty());
    assert!(rows.iter().all(|row| row["expanded"] == json!(true)));
    let html = initial["html"].as_str().unwrap();
    assert!(html.contains("form[companies][__0000000000005__][stores][__0000000000005__][name]"));
    assert!(html.contains("id=\"scope%3A&#x27;"));
    let empty = post(
        &app,
        "render",
        json!({"template":compiled["template"],"data":{"companies":{}}}),
    )
    .await;
    assert_eq!(empty["data"], json!({"companies":{}}));
    assert!(empty["html"]
        .as_str()
        .unwrap()
        .contains("data-crudui-action=\"add-row\""));
    let generated = post(
        &app,
        "render",
        json!({"template":compiled["template"],"data":{}}),
    )
    .await;
    let keys = generated["data"]["companies"]
        .as_object()
        .unwrap()
        .keys()
        .collect::<Vec<_>>();
    assert_eq!(keys.len(), 1);
    assert!(form::valid_key(keys[0]));
    let restored = post(
        &app,
        "render",
        json!({"template":compiled["template"],"data":generated["data"]}),
    )
    .await;
    assert_eq!(
        restored, generated,
        "Returned default rows must make subsequent binding identical"
    );
}

#[tokio::test]
async fn generation_rejects_invalid_requests_without_storage_changes() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let compiled = post(&app, "compile", json!({"spec":spec()})).await;
    for body in [
        json!({"template":compiled["template"],"data":{},"options":{"files":{}}}),
        json!({"template":compiled["template"],"data":[],"options":{}}),
        json!({"template":compiled["template"],"data":null}),
        json!({"template":compiled["template"],"data":{},"options":{"language":42}}),
        json!({"template":{},"data":{}}),
    ] {
        let response = request(
            &app,
            "POST",
            "/api/render/createForm/react",
            "application/json",
            json::encode(&body).unwrap(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
    for (method, path, media, body, expected) in [
        (
            "GET",
            "/api/compile/createForm/react",
            "application/json",
            "{}",
            StatusCode::METHOD_NOT_ALLOWED,
        ),
        (
            "POST",
            "/api/compile/createForm/react",
            "text/plain",
            "{}",
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ),
        (
            "POST",
            "/api/compile/createForm/react",
            "application/json",
            "{}{}",
            StatusCode::BAD_REQUEST,
        ),
        (
            "POST",
            "/api/compile/createForm/react",
            "application/json",
            "{\"spec\":1e999}",
            StatusCode::BAD_REQUEST,
        ),
        (
            "POST",
            "/api/compile/createForm/react",
            "application/json",
            "[]",
            StatusCode::BAD_REQUEST,
        ),
        (
            "POST",
            "/api/compile/keyed/react",
            "application/json",
            "{}",
            StatusCode::NOT_FOUND,
        ),
    ] {
        let response = request(&app, method, path, media, body.into()).await;
        assert_eq!(response.status(), expected, "{method} {path} {body}");
    }
    let response = request(
        &app,
        "POST",
        "/api/compile/createForm/react",
        "application/json",
        " ".repeat(MAX_BYTES + 1),
    )
    .await;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(fs::read_dir(&server.data).unwrap().count(), 0);
}

fn native_fields(value: &Value, name: &str, output: &mut Vec<(String, String)>) {
    match value {
        Value::Object(members) => {
            for (key, value) in members {
                native_fields(value, &format!("{name}[{key}]"), output);
            }
        }
        Value::String(value) => output.push((name.into(), value.clone())),
        _ => panic!("The fixture contains only objects and string controls"),
    }
}

#[tokio::test]
async fn server_html_uses_framework_storage_and_native_submission() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let repo = react_repository(&server);
    let state = repo.reset("nonsequential").unwrap();
    let (status, html) = ssr(
        &app,
        "/api/ssr/createForm/react?lang=en&server=rust&initialization=ssr",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (markup, payload) = frame_parts(&html);
    let records = json::decode(include_bytes!("../../../fixtures/records.json")).unwrap();
    let template = compile_form(
        &spec(),
        &CompileOptions {
            key_prefix: Some("form".into()),
            ..Default::default()
        },
    )
    .unwrap();
    let expected = Form::new(
        template,
        &load_data(&records["nonsequential"]).unwrap(),
        BindOptions {
            language: json!("en"),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(markup, render_form(&expected, None).unwrap());
    assert!(!payload.contains('<'));
    let decoded_payload = json::decode(payload.as_bytes()).unwrap();
    assert_eq!(
        decoded_payload
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        ["data", "generator"]
    );
    assert_eq!(decoded_payload["data"], expected.get_data());
    assert_eq!(
        decoded_payload["generator"],
        generation::provenance(&server).unwrap()
    );
    // Only the language attribute, the view content and the payload script are added.
    assert_eq!(
        html,
        format!(
            r#"<!doctype html><html lang="en"><head><title>Frame</title></head><body><main><div id="form-view">{markup}</div></main><script type="module" src="./frame.js"></script><script type="application/json" id="crudui-ssr">{payload}</script></body></html>"#
        )
    );
    assert_eq!(html.matches("type=\"submit\"").count(), 1);
    assert!(html.contains(
        "<button type=\"submit\" class=\"crudui-action crudui-action--text\" name=\"_form_complete\" value=\"1\">Save</button>"
    ));
    assert!(!html.contains("type=\"hidden\""));
    assert!(!html.contains("[company_seq]"));
    assert!(html.find("Company 5").unwrap() < html.find("Company 7").unwrap());
    assert!(html.find("Company 7").unwrap() < html.find("Company 1").unwrap());
    let mut data = load_data(&state).unwrap();
    data["companies"]["__0000000000005__"]["name"] = json!("Native update");
    let mut fields = Vec::new();
    native_fields(&data, "form", &mut fields);
    let response = post_native(&app, fields).await;
    assert_eq!(response.status(), StatusCode::OK);
    let native = decoded(response).await;
    assert_eq!(native["validation"]["valid"], true);
    assert_eq!(native["data"], data);
    repo.reset("nonsequential").unwrap();
    let json_save = post(&app, "save", json!({"form":data})).await;
    assert_eq!(native["storage"], json_save["storage"]);
    let before = fs::read(&repo.file).unwrap();
    let response = request(
        &app,
        "POST",
        "/api/save/createForm/react",
        "application/x-www-form-urlencoded",
        "form[companies][__0000000000005__][name]=Invalid".into(),
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(fs::read(&repo.file).unwrap(), before);
    data["companies"]["__0000000000005__"]["name"] = json!("");
    let response = request(
        &app,
        "POST",
        "/api/save/createForm/react",
        "application/json",
        json::encode(&json!({"form":data})).unwrap(),
    )
    .await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(decoded(response).await["validation"]["valid"], false);
    assert_eq!(fs::read(&repo.file).unwrap(), before);
    let (status, vue_html) = ssr(
        &app,
        "/api/ssr/createForm/vue?lang=ko&server=rust&initialization=ssr",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(vue_html.contains("Company A"));
    assert!(!vue_html.contains("Native update"));
}

async fn ssr(app: &Router, path: &str) -> (StatusCode, String) {
    let response = request(app, "GET", path, "", String::new()).await;
    let status = response.status();
    if status == StatusCode::OK {
        assert_eq!(
            response.headers()["content-type"],
            "text/html; charset=utf-8"
        );
        assert_eq!(response.headers()["cache-control"], "no-store");
    }
    let bytes = to_bytes(response.into_body(), MAX_BYTES * 10)
        .await
        .unwrap();
    (status, String::from_utf8(bytes.to_vec()).unwrap())
}

/// Return the form view content and the SSR payload of a frame document.
fn frame_parts(html: &str) -> (&str, &str) {
    let view = r#"<div id="form-view">"#;
    let script = r#"<script type="application/json" id="crudui-ssr">"#;
    assert_eq!(html.matches(view).count(), 1);
    assert_eq!(html.matches(script).count(), 1);
    let start = html.find(view).unwrap() + view.len();
    let end = html.find("</div></main>").unwrap();
    let payload = html.find(script).unwrap() + script.len();
    let payload_end = payload + html[payload..].find("</script>").unwrap();
    (&html[start..end], &html[payload..payload_end])
}

#[tokio::test]
async fn ssr_frame_rejects_wrong_queries_and_templates() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    for query in [
        "",
        "?lang=de&server=rust&initialization=ssr",
        "?lang=en&initialization=ssr",
        "?lang=en&server=go&initialization=ssr",
        "?lang=en&server=rust&initialization=csr",
        "?lang=en&lang=en&server=rust&initialization=ssr",
        "?lang=en&server=rust&initialization=ssr&language=en",
        "?language=en",
    ] {
        let (status, body) = ssr(&app, &format!("/api/ssr/createForm/react{query}")).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{query}");
        assert_eq!(
            json::decode(body.as_bytes()).unwrap()["error"],
            "Expected lang, server and initialization for this SSR frame"
        );
    }
    let valid = "?lang=en&server=rust&initialization=ssr";
    let repo = react_repository(&server);
    let mut data = load_data(&repo.reset("nonsequential").unwrap()).unwrap();
    data["companies"]["__0000000000005__"]["name"] = json!("</script><b>&amp;");
    post(&app, "save", json!({"form":data})).await;
    let (status, html) = ssr(&app, &format!("/api/ssr/createForm/react{valid}")).await;
    assert_eq!(status, StatusCode::OK);
    let (_, payload) = frame_parts(&html);
    assert!(!payload.contains(['<', '>', '&']));
    assert!(payload.contains(r"\u003c/script\u003e\u003cb\u003e\u0026amp;"));
    assert_eq!(
        json::decode(payload.as_bytes()).unwrap()["data"]["companies"]["__0000000000005__"]["name"],
        "</script><b>&amp;"
    );
    let frame = server.public.join("frames/createForm-react/index.html");
    let view = r#"<div id="form-view"></div>"#;
    for template in [
        Some(FRAME.replace("<html>", "<html lang=\"en\">")),
        Some(FRAME.replace("</main>", "</main><html>")),
        Some(FRAME.replace(view, "")),
        Some(FRAME.replace("</main>", &format!("</main>{view}"))),
        Some(FRAME.replace(view, r#"<div id="form-view"> </div>"#)),
        Some(FRAME.replace("</body>", "")),
        Some(FRAME.replace("</main>", "</main></body>")),
        None,
    ] {
        match template {
            Some(template) => fs::write(&frame, template).unwrap(),
            None => fs::remove_file(&frame).unwrap(),
        }
        let (status, body) = ssr(&app, &format!("/api/ssr/createForm/react{valid}")).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(
            json::decode(body.as_bytes()).unwrap()["error"],
            "The frame document must contain one html start tag, one empty form view and one body end tag"
        );
    }
}

#[test]
fn ordered_json_retains_member_order_and_rejects_unrepresentable_numbers() {
    let input = r#"{"5":{"__0000000000007__":{}},"7":[],"1":null}"#;
    let decoded = json::decode(input.as_bytes()).unwrap();
    assert_eq!(json::encode(&decoded).unwrap(), input);
    let unicode =
        json::decode(r#"{"서울":"😀","\ud83d\ude00":"\uc11c\uc6b8"}"#.as_bytes()).unwrap();
    assert_eq!(unicode["서울"], "😀");
    assert_eq!(unicode["😀"], "서울");
    assert_eq!(
        json::decode(json::encode(&unicode).unwrap().as_bytes()).unwrap(),
        unicode
    );
    for invalid in [
        r#"{"a":1}false"#,
        r#"{"a":1e999}"#,
        r#"{"a":9007199254740992}"#,
        r#"{"a":"\ud800"}"#,
        r#"{"\ud800":1}"#,
        r#"{"a":"\udc00"}"#,
    ] {
        assert!(json::decode(invalid.as_bytes()).is_err());
    }
}

async fn call(
    app: &Router,
    method: &str,
    path: &str,
    content_type: &str,
    body: String,
) -> (StatusCode, Value) {
    let response = request(app, method, path, content_type, body).await;
    let status = response.status();
    assert_eq!(
        response.headers()["content-type"],
        "application/json; charset=utf-8",
        "{method} {path}"
    );
    assert_eq!(response.headers()["cache-control"], "no-store");
    let value = decoded(response).await;
    assert_eq!(value["server"], "rust", "{method} {path}");
    (status, value)
}

fn customer_records() -> Vec<Value> {
    json::decode_values(CUSTOMER_RECORDS.as_bytes())
        .unwrap()
        .as_array()
        .unwrap()
        .clone()
}

/// A valid submission for one stored record: edited members and the record's companies.
fn edited(id: &str) -> Value {
    let records = customer_records();
    let record = records.iter().find(|record| record["id"] == id).unwrap();
    json!({"id":id,"name":"Edited & <b>","status":"blocked","joined":"2027-02-28","score":"9021.25","relation":{"name":"Relation / 연관"},"markup":"<em>saved</em>","companies":record["companies"]})
}

/// Native fields as the rendered record form posts them: an unchecked `enabled` and a
/// collection without rows post nothing.
/// The repository of the React create form, which the server saves to its data folder.
fn react_repository(server: &Server) -> Repository {
    Repository {
        file: server.data.join("rust-createForm-react.json"),
        fixtures: server.public.join("records.json"),
    }
}

/// Post native form fields to the React create form, as a browser submits it; the completion marker is added here.
async fn post_native(app: &Router, mut fields: Vec<(String, String)>) -> Response {
    fields.push(("_form_complete".into(), "1".into()));
    let body = form_urlencoded::Serializer::new(String::new())
        .extend_pairs(fields)
        .finish();
    request(
        app,
        "POST",
        "/api/save/createForm/react",
        "application/x-www-form-urlencoded",
        body,
    )
    .await
}

fn record_fields(data: &Value) -> Vec<(String, String)> {
    let mut fields = Vec::new();
    native_fields(data, "form", &mut fields);
    fields.retain(|(name, value)| !(name.ends_with("[enabled]") && value.is_empty()));
    fields
}

fn store(server: &Server) -> Vec<u8> {
    fs::read(server.data.join("records-rust.json")).unwrap()
}

#[tokio::test]
async fn records_are_paged_read_and_reset_from_the_fixture() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let fixture = customer_records();
    assert_eq!(fixture.len(), 45);
    for page in [1, 2, 3] {
        let (status, body) = call(
            &app,
            "GET",
            &format!("/api/records?page={page}"),
            "",
            String::new(),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let start = (page - 1) * 20;
        assert_eq!(
            body,
            json!({"page":page,"perPage":20,"total":45,"records":fixture[start..(start + 20).min(45)],"server":"rust"})
        );
    }
    assert_eq!(
        json::decode_values(&store(&server)).unwrap(),
        Value::Array(fixture.clone())
    );
    for query in [
        "",
        "?page=",
        "?page=0",
        "?page=01",
        "?page=-1",
        "?page=1.0",
        "?page=1&page=1",
        "?page=1&sort=name",
    ] {
        let (status, body) = call(
            &app,
            "GET",
            &format!("/api/records{query}"),
            "",
            String::new(),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{query}");
        assert_eq!(body["error"], "Expected one page parameter");
    }
    let (status, body) = call(&app, "GET", "/api/records?page=4", "", String::new()).await;
    assert_eq!(
        (status, body["error"].clone()),
        (StatusCode::NOT_FOUND, json!("Page not found"))
    );
    let (status, body) = call(&app, "GET", "/api/records/22", "", String::new()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({"record":fixture[21],"server":"rust"}));
    for id in ["46", "0", "022"] {
        let (status, body) = call(
            &app,
            "GET",
            &format!("/api/records/{id}"),
            "",
            String::new(),
        )
        .await;
        assert_eq!(
            (status, body["error"].clone()),
            (StatusCode::NOT_FOUND, json!("Record not found")),
            "{id}"
        );
    }
    for (method, path) in [
        ("POST", "/api/records?page=1"),
        ("PUT", "/api/records/22"),
        ("GET", "/api/records/reset"),
        ("POST", "/api/records/view/list"),
    ] {
        assert_eq!(
            call(&app, method, path, "", String::new()).await.0,
            StatusCode::METHOD_NOT_ALLOWED,
            "{method} {path}"
        );
    }
    let (status, _) = call(
        &app,
        "POST",
        "/api/records/22",
        "application/json",
        json::encode(&json!({"form":edited("22")})).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_ne!(
        json::decode_values(&store(&server)).unwrap(),
        Value::Array(fixture.clone())
    );
    let (status, _) = call(&app, "POST", "/api/records/reset", "text/plain", "x".into()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, body) = call(&app, "POST", "/api/records/reset", "", String::new()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({"total":45,"server":"rust"}));
    assert_eq!(
        json::decode_values(&store(&server)).unwrap(),
        Value::Array(fixture)
    );
}

#[tokio::test]
async fn saves_store_the_submitted_members_in_fixture_order() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let data = edited("22");
    let mut fields = record_fields(&data);
    assert!(!fields
        .iter()
        .any(|(name, _)| name.ends_with("[departments]")));
    fields.push(("_form_complete".into(), "1".into()));
    let native = form_urlencoded::Serializer::new(String::new())
        .extend_pairs(&fields)
        .finish();
    let boundary = "crudui-boundary";
    let multipart = fields
        .iter()
        .map(|(name, value)| format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"))
        .collect::<String>()
        + &format!("--{boundary}--\r\n");
    let json_body = json::encode(&json!({"form":data})).unwrap();
    let multipart_type = format!("multipart/form-data; boundary={boundary}");
    for (content_type, body) in [
        (multipart_type.as_str(), multipart.clone()),
        ("application/x-www-form-urlencoded", native.clone()),
        ("application/json", json_body.clone()),
    ] {
        call(&app, "POST", "/api/records/reset", "", String::new()).await;
        let (status, response) = call(&app, "POST", "/api/records/22", content_type, body).await;
        assert_eq!(status, StatusCode::OK, "{content_type}: {response}");
        let mut records = customer_records();
        let previous = records[21].clone();
        let expected = json!({"id":"22","name":data["name"],"status":"blocked","joined":"2027-02-28","score":9021.25,"relation":{"name":data["relation"]["name"]},"avatar":previous["avatar"],"markup":"<em>saved</em>","companies":data["companies"]});
        // The store `__0000000000176__` of record 22 is unchecked, so `design.show` hides its notes.
        let hidden = json!(["companies.__0000000000177__.stores.__0000000000176__.detail"]);
        assert_eq!(
            response,
            json!({"record":expected,"validation":{"valid":true,"errors":[],"hidden":hidden},"server":"rust"})
        );
        let stored = json::decode_values(&store(&server)).unwrap();
        assert_eq!(
            stored[21].as_object().unwrap().keys().collect::<Vec<_>>(),
            previous.as_object().unwrap().keys().collect::<Vec<_>>()
        );
        records[21] = expected;
        assert_eq!(stored, Value::Array(records));
    }
    // Integral scores are stored as integers; others keep JavaScript's number text.
    for (text, stored) in [
        (" 12.0 ", "12"),
        ("1e7", "10000000"),
        ("9999999.5", "9999999.5"),
        ("0.000001", "0.000001"),
    ] {
        let mut data = edited("22");
        data["score"] = json!(text);
        let body = json::encode(&json!({"form":data})).unwrap();
        let (status, response) =
            call(&app, "POST", "/api/records/22", "application/json", body).await;
        assert_eq!(status, StatusCode::OK, "{text}: {response}");
        let file = String::from_utf8(store(&server)).unwrap();
        assert!(
            file.contains(&format!(r#""score":{stored},"#)),
            "{text}: {file}"
        );
        let (_, view) = call(&app, "GET", "/api/records/view/form?id=22&lang=en&server=rust&framework=html&initialization=ssr&mode=bindForm&page=2", "", String::new()).await;
        assert!(
            view["html"]
                .as_str()
                .unwrap()
                .contains(&format!(r#"value="{stored}""#)),
            "{text}"
        );
    }
}

#[tokio::test]
async fn invalid_and_rejected_saves_keep_the_store() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    call(&app, "POST", "/api/records/reset", "", String::new()).await;
    let before = store(&server);
    let mut invalid = edited("22");
    for (name, value) in [
        ("name", ""),
        ("status", "unknown"),
        ("joined", "2027-13-40"),
        ("score", "many"),
    ] {
        invalid[name] = json!(value);
    }
    let (status, body) = call(
        &app,
        "POST",
        "/api/records/22",
        "application/json",
        json::encode(&json!({"form":invalid})).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let spec = json::decode(CUSTOMER_SPECS.as_bytes()).unwrap();
    let expected = validate(&spec["form"], &invalid, &ValidateOptions::default()).unwrap();
    assert_eq!(body["validation"]["valid"], false);
    assert_eq!(
        body["validation"]["errors"].as_array().unwrap().len(),
        expected.errors.len()
    );
    assert_eq!(
        body.as_object().unwrap().keys().collect::<Vec<_>>(),
        ["validation", "server"]
    );
    let data = edited("22");
    let with = |name: &str, value: Value| {
        let mut data = data.clone();
        match value {
            Value::Null => {
                data.as_object_mut().unwrap().remove(name);
            }
            value => data[name] = value,
        }
        json::encode(&json!({"form":data})).unwrap()
    };
    let json_type = "application/json";
    let native = "application/x-www-form-urlencoded";
    for (path, content_type, body, expected) in [
        (
            "/api/records/46",
            json_type,
            with("id", json!("46")),
            StatusCode::NOT_FOUND,
        ),
        (
            "/api/records/22",
            json_type,
            with("id", json!("23")),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            with("extra", json!("x")),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            with("id", Value::Null),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            with("relation", json!({"name":"x","extra":"y"})),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            with("score", json!(9021.25)),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            with("name", json!({"ko":"x"})),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            r#"{"form":"#.into(),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            json_type,
            format!(r#"{{"form":{},"more":1}}"#, json::encode(&data).unwrap()),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            native,
            "form[id]=22&form[name]=x".into(),
            StatusCode::BAD_REQUEST,
        ),
        (
            "/api/records/22",
            "text/plain",
            "name=x".into(),
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ),
        (
            "/api/records/22",
            native,
            format!("form[markup]={}", "x".repeat(MAX_BYTES)),
            StatusCode::PAYLOAD_TOO_LARGE,
        ),
    ] {
        let (status, response) = call(&app, "POST", path, content_type, body.clone()).await;
        assert_eq!(status, expected, "{body:.80}: {response}");
        assert!(response["error"].is_string());
        assert_eq!(store(&server), before, "{body:.80}");
    }
    let fields = record_fields(&data);
    let incomplete = form_urlencoded::Serializer::new(String::new())
        .extend_pairs(&fields)
        .finish();
    let (status, _) = call(&app, "POST", "/api/records/22", native, incomplete.clone()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = call(
        &app,
        "POST",
        "/api/records/22",
        native,
        format!("{incomplete}&_form_complete=1&other=1"),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(store(&server), before);
}

#[tokio::test]
async fn malformed_stores_fail_without_being_replaced() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let mut records = customer_records();
    records[0].as_object_mut().unwrap().remove("companies");
    let without_companies = serde_json::to_string(&records).unwrap();
    // Stored companies are complete in member order; the store does not complete them.
    let mut records = customer_records();
    records[0]["companies"] = json!({"__0000000000001__":{"name":"A"}});
    let incomplete = serde_json::to_string(&records).unwrap();
    records[0]["companies"] = json!({"__0000000000001__":{"stores":{},"name":"A"}});
    let out_of_order = serde_json::to_string(&records).unwrap();
    let save = serde_json::to_string(&serde_json::json!({"form":edited("1")})).unwrap();
    for malformed in [
        "{\"records\":[]}",
        without_companies.as_str(),
        incomplete.as_str(),
        out_of_order.as_str(),
    ] {
        fs::write(server.data.join("records-rust.json"), malformed).unwrap();
        for (method, path, content_type, body) in [
            ("GET", "/api/records?page=1", "", String::new()),
            ("GET", "/api/records/1", "", String::new()),
            ("POST", "/api/records/1", "application/json", save.clone()),
        ] {
            let (status, value) = call(&app, method, path, content_type, body).await;
            assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{method} {path}");
            assert!(value["error"].is_string());
        }
        assert_eq!(store(&server), malformed.as_bytes());
    }
    // Reset replaces a malformed store with the fixture.
    let (status, _) = call(&app, "POST", "/api/records/reset", "", String::new()).await;
    assert_eq!(status, StatusCode::OK);
    let stored = json::decode_values(&store(&server)).unwrap();
    assert_eq!(stored.as_array().unwrap(), &customer_records());
}

const VIEW_QUERY: &str =
    "lang=en&server=rust&framework=vue&initialization=ssr&mode=createForm&page=2";

#[tokio::test]
async fn views_render_the_selected_stage() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let records = customer_records();
    let (status, list) = call(
        &app,
        "GET",
        &format!("/api/records/view/list?{VIEW_QUERY}"),
        "",
        String::new(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert_eq!(
        list.as_object().unwrap().keys().collect::<Vec<_>>(),
        ["view", "html", "data", "server"]
    );
    assert_eq!(list["view"], "list");
    assert_eq!(
        list["data"],
        json!({"page":2,"perPage":20,"total":45,"records":records[20..40]})
    );
    let html = list["html"].as_str().unwrap();
    assert!(
        html.contains(&format!(
            r#"href="/detail?id=21&amp;{}""#,
            VIEW_QUERY.replace('&', "&amp;")
        )),
        "{html}"
    );
    assert!(!html.contains("id=20&"));
    let (status, detail) = call(
        &app,
        "GET",
        &format!("/api/records/view/detail?id=22&{VIEW_QUERY}"),
        "",
        String::new(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{detail}");
    assert_eq!(detail["data"], json!({"record":records[21]}));
    assert!(detail["html"].as_str().unwrap().contains(&format!(
        r#"href="/form?id=22&amp;{}""#,
        VIEW_QUERY.replace('&', "&amp;")
    )));
    let (status, form) = call(
        &app,
        "GET",
        &format!("/api/records/view/form?id=22&{VIEW_QUERY}"),
        "",
        String::new(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{form}");
    assert_eq!(form["data"], json!({"record":records[21]}));
    let html = form["html"].as_str().unwrap();
    assert!(html.starts_with(r#"<form id="record-form" method="post" action="/api/rust/records/22" enctype="multipart/form-data">"#));
    assert!(html.ends_with("</form>"));
    assert!(html.contains(r#"name="form[relation][name]""#));
    for key in records[21]["companies"].as_object().unwrap().keys() {
        assert!(
            html.contains(&format!(r#"name="form[companies][{key}][name]""#)),
            "{key}"
        );
    }
    assert!(!html.contains("avatar"));
}

#[tokio::test]
async fn views_reject_other_queries() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let base = "lang=en&server=rust&framework=html&initialization=ssr&mode=bindForm&page=1";
    for (view, query, expected) in [
        ("list", base.replace("rust", "go"), StatusCode::BAD_REQUEST),
        ("list", base.replace("ssr", "csr"), StatusCode::BAD_REQUEST),
        ("list", base.replace("en", "fr"), StatusCode::BAD_REQUEST),
        (
            "list",
            base.replace("html", "angular"),
            StatusCode::BAD_REQUEST,
        ),
        (
            "list",
            base.replace("bindForm", "form"),
            StatusCode::BAD_REQUEST,
        ),
        (
            "list",
            base.replace("page=1", "page=01"),
            StatusCode::BAD_REQUEST,
        ),
        ("list", format!("{base}&saved=1"), StatusCode::BAD_REQUEST),
        ("list", format!("{base}&lang=en"), StatusCode::BAD_REQUEST),
        (
            "list",
            base.replace("&mode=bindForm", ""),
            StatusCode::BAD_REQUEST,
        ),
        (
            "list",
            base.replace("lang=en&server=rust", "server=rust&lang=en"),
            StatusCode::BAD_REQUEST,
        ),
        ("list", format!("id=1&{base}"), StatusCode::BAD_REQUEST),
        ("detail", base.into(), StatusCode::BAD_REQUEST),
        ("detail", format!("{base}&id=1"), StatusCode::BAD_REQUEST),
        ("form", format!("id=x&{base}"), StatusCode::BAD_REQUEST),
        ("form", format!("id=%2B1&{base}"), StatusCode::BAD_REQUEST),
        (
            "list",
            base.replace("page=1", "page=4"),
            StatusCode::NOT_FOUND,
        ),
        ("detail", format!("id=46&{base}"), StatusCode::NOT_FOUND),
        ("form", format!("id=46&{base}"), StatusCode::NOT_FOUND),
        ("form", format!("id=022&{base}"), StatusCode::BAD_REQUEST),
        ("detail", format!("id=0&{base}"), StatusCode::BAD_REQUEST),
        ("table", base.into(), StatusCode::NOT_FOUND),
    ] {
        let (status, body) = call(
            &app,
            "GET",
            &format!("/api/records/view/{view}?{query}"),
            "",
            String::new(),
        )
        .await;
        assert_eq!(status, expected, "{view}?{query}: {body}");
        assert!(body["error"].is_string());
    }
}

/// One store of a companies submission, with every member.
fn store_row(enabled: &str) -> Value {
    json!({"name":"Lima","enabled":enabled,"detail":"Open","title":{"ko":"매장","en":"Store"},
        "departments":{"__0000000000001__":{"name":"Support"}}})
}

fn with_companies(companies: Value) -> Value {
    let mut data = edited("22");
    data["companies"] = companies;
    data
}

#[test]
fn companies_keep_rows_and_keys_in_submitted_order_and_member_order() {
    // Members arrive in another order; rows keep their submitted order and keys.
    let submitted = with_companies(json!({
        "__00000000000ff__":{"stores":{
            "__0000000000002__":{"departments":{},"title":{"en":"Second","ko":"둘째"},"detail":"Hidden","enabled":"","name":"B"},
            "__0000000000001__":store_row("1")},"name":"Later"},
        "__0000000000000__":{"name":"Earlier","stores":{}}}));
    let data = records::form_members(&submitted).unwrap();
    assert_eq!(
        data.as_object().unwrap().keys().collect::<Vec<_>>(),
        [
            "id",
            "name",
            "status",
            "joined",
            "score",
            "relation",
            "markup",
            "companies"
        ]
    );
    let companies = data["companies"].as_object().unwrap();
    assert_eq!(
        companies.keys().collect::<Vec<_>>(),
        ["__00000000000ff__", "__0000000000000__"]
    );
    let company = companies["__00000000000ff__"].as_object().unwrap();
    assert_eq!(company.keys().collect::<Vec<_>>(), ["name", "stores"]);
    let stores = company["stores"].as_object().unwrap();
    assert_eq!(
        stores.keys().collect::<Vec<_>>(),
        ["__0000000000002__", "__0000000000001__"]
    );
    let store = stores["__0000000000002__"].as_object().unwrap();
    assert_eq!(
        store.keys().collect::<Vec<_>>(),
        ["name", "enabled", "detail", "title", "departments"]
    );
    assert_eq!(store["detail"], "Hidden", "a hidden detail is kept");
    assert_eq!(
        store["title"]
            .as_object()
            .unwrap()
            .keys()
            .collect::<Vec<_>>(),
        ["ko", "en"]
    );
}

#[test]
fn absent_fields_complete_as_empty_values() {
    // Form data leaves out a field that holds no value, in both media types.
    let native = with_companies(json!({
        "__0000000000001__":{"name":"A","stores":{
            "__0000000000002__":{"name":"Lima","detail":"Open","title":{"ko":"매장","en":"Store"}},
            "__0000000000004__":{"enabled":"1","departments":{"__0000000000005__":{}}}}},
        "__0000000000003__":{}}));
    let data = records::form_members(&native).unwrap();
    assert_eq!(
        data["companies"],
        json!({
            "__0000000000001__":{"name":"A","stores":{
                "__0000000000002__":{"name":"Lima","enabled":"","detail":"Open","title":{"ko":"매장","en":"Store"},"departments":{}},
                "__0000000000004__":{"name":"","enabled":"1","detail":"","title":{"ko":"","en":""},
                    "departments":{"__0000000000005__":{"name":""}}}}},
            "__0000000000003__":{"name":"","stores":{}}})
    );
    assert_eq!(
        records::form_members(&json!({"id":"22"})).unwrap(),
        json!({"id":"22","name":"","status":"","joined":"","score":"","relation":{"name":""},"markup":"","companies":{}})
    );
    let mut without_id = edited("22");
    without_id.as_object_mut().unwrap().remove("id");
    assert!(records::form_members(&without_id).is_err());
    for relation in [json!({}), json!({"name":"R","extra":"x"})] {
        let mut data = edited("22");
        data["relation"] = relation;
        assert!(records::form_members(&data).is_err());
    }
}

#[test]
fn companies_reject_every_other_shape() {
    let store = |change: &dyn Fn(&mut Map<String, Value>)| {
        let mut row = store_row("1");
        change(row.as_object_mut().unwrap());
        with_companies(json!({"__0000000000001__":{"name":"A","stores":{"__0000000000002__":row}}}))
    };
    let cases = [
        ("companies is text", with_companies(json!("x"))),
        ("companies is a list", with_companies(json!([]))),
        (
            "row key is a word",
            with_companies(json!({"first":{"name":"A","stores":{}}})),
        ),
        (
            "row key has capitals",
            with_companies(json!({"__00000000000AA__":{"name":"A","stores":{}}})),
        ),
        (
            "row key is short",
            with_companies(json!({"__000000000001__":{"name":"A","stores":{}}})),
        ),
        (
            "row is text",
            with_companies(json!({"__0000000000001__":"A"})),
        ),
        (
            "company has another member",
            with_companies(json!({"__0000000000001__":{"name":"A","stores":{},"extra":"x"}})),
        ),
        (
            "store has another member",
            store(&|row| {
                row.insert("extra".into(), json!("x"));
            }),
        ),
        (
            "store name is a number",
            store(&|row| {
                row.insert("name".into(), json!(1));
            }),
        ),
        (
            "enabled is yes",
            store(&|row| {
                row.insert("enabled".into(), json!("yes"));
            }),
        ),
        (
            "enabled is true",
            store(&|row| {
                row.insert("enabled".into(), json!(true));
            }),
        ),
        (
            "title misses en",
            store(&|row| {
                row.insert("title".into(), json!({"ko":"x"}));
            }),
        ),
        (
            "title has another language",
            store(&|row| {
                row.insert("title".into(), json!({"ko":"x","en":"y","fr":"z"}));
            }),
        ),
        (
            "title replaces en",
            store(&|row| {
                row.insert("title".into(), json!({"ko":"x","fr":"y"}));
            }),
        ),
        (
            "title is text",
            store(&|row| {
                row.insert("title".into(), json!("x"));
            }),
        ),
        (
            "title leaf is null",
            store(&|row| {
                row.insert("title".into(), json!({"ko":"x","en":null}));
            }),
        ),
        (
            "department name is a number",
            store(&|row| {
                row.insert(
                    "departments".into(),
                    json!({"__0000000000003__":{"name":1}}),
                );
            }),
        ),
        (
            "department has another member",
            store(&|row| {
                row.insert(
                    "departments".into(),
                    json!({"__0000000000003__":{"name":"x","extra":"y"}}),
                );
            }),
        ),
        (
            "department key is a word",
            store(&|row| {
                row.insert("departments".into(), json!({"x":{"name":"x"}}));
            }),
        ),
    ];
    for (name, data) in cases {
        let error = records::form_members(&data).unwrap_err();
        assert_eq!(error.status, StatusCode::BAD_REQUEST, "{name}");
    }
}

#[tokio::test]
async fn benchmark_saves_and_validations_use_the_companies_rule() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let repo = react_repository(&server);
    let data = load_data(&repo.reset("nonsequential").unwrap()).unwrap();
    let before = fs::read(&repo.file).unwrap();
    let company = |change: &dyn Fn(&mut Map<String, Value>)| {
        let mut data = data.clone();
        change(
            data["companies"]["__0000000000005__"]
                .as_object_mut()
                .unwrap(),
        );
        data
    };
    let first_store = |change: &dyn Fn(&mut Map<String, Value>)| {
        company(&|row| {
            let stores = row["stores"].as_object_mut().unwrap();
            change(stores.values_mut().next().unwrap().as_object_mut().unwrap());
        })
    };
    let mut other_member = data.clone();
    other_member["other"] = json!("x");
    let cases = [
        ("form has another member", other_member),
        ("companies is a list", json!({"companies":[]})),
        (
            "company name is null",
            company(&|row| {
                row.insert("name".into(), Value::Null);
            }),
        ),
        (
            "company has another member",
            company(&|row| {
                row.insert("extra".into(), json!("x"));
            }),
        ),
        (
            "enabled is 2",
            first_store(&|row| {
                row.insert("enabled".into(), json!("2"));
            }),
        ),
        (
            "title has fr",
            first_store(&|row| {
                row.insert("title".into(), json!({"fr":"x"}));
            }),
        ),
    ];
    for action in ["save", "validate"] {
        for (name, form) in &cases {
            let response = request(
                &app,
                "POST",
                &format!("/api/{action}/createForm/react"),
                "application/json",
                json::encode(&json!({"form":form})).unwrap(),
            )
            .await;
            assert_eq!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "{action}: {name}"
            );
        }
    }
    assert_eq!(fs::read(&repo.file).unwrap(), before);
    // JSON data of a newly added row and of a form without rows completes as the native form does.
    let added = json!({"companies":{"__0000000000001__":{"name":"C","stores":{
        "__0000000000002__":{"name":"S","enabled":"1","departments":{"__0000000000003__":{}}}}}}});
    let completed = json!({"companies":{"__0000000000001__":{"name":"C","stores":{
        "__0000000000002__":{"name":"S","enabled":"1","detail":"","title":{"ko":"","en":""},
            "departments":{"__0000000000003__":{"name":""}}}}}}});
    for (form, expected) in [(added, completed), (json!({}), json!({"companies":{}}))] {
        let response = request(
            &app,
            "POST",
            "/api/validate/createForm/react",
            "application/json",
            json::encode(&json!({"form":form})).unwrap(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(decoded(response).await["normalized"], expected);
    }
    // A native save completes an unchecked enabled and collections without rows.
    let mut expected = data.clone();
    let stores = expected["companies"]["__0000000000005__"]["stores"]
        .as_object_mut()
        .unwrap();
    let store = stores.values_mut().next().unwrap();
    store["enabled"] = json!("");
    store["departments"] = json!({});
    let response = post_native(&app, record_fields(&expected)).await;
    assert_eq!(response.status(), StatusCode::OK);
    let saved = decoded(response).await;
    assert_eq!(saved["normalized"], expected);
    assert_eq!(saved["data"], expected);
}

#[tokio::test]
async fn repeated_native_fields_are_rejected() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    for name in ["form[name]", "form[a][b]", "_form_complete"] {
        let mut root = json!({});
        form::insert_native(&mut root, name, "x".into()).unwrap();
        let error = form::insert_native(&mut root, name, "y".into()).unwrap_err();
        assert_eq!(error.status, StatusCode::BAD_REQUEST, "{name}");
    }
    let mut root = json!({});
    form::insert_native(&mut root, "form[a][b]", "x".into()).unwrap();
    assert!(form::insert_native(&mut root, "form[a]", "y".into()).is_err());
    call(&app, "POST", "/api/records/reset", "", String::new()).await;
    let before = store(&server);
    let repo = react_repository(&server);
    let benchmark = load_data(&repo.reset("nonsequential").unwrap()).unwrap();
    let benchmark_before = fs::read(&repo.file).unwrap();
    let boundary = "crudui-boundary";
    for (path, data) in [
        ("/api/records/22", edited("22")),
        ("/api/save/createForm/react", benchmark.clone()),
        ("/api/validate/createForm/react", benchmark),
    ] {
        let mut fields = record_fields(&data);
        fields.push(("_form_complete".into(), "1".into()));
        let repeated = fields[1].clone();
        fields.push(repeated);
        let urlencoded = form_urlencoded::Serializer::new(String::new())
            .extend_pairs(&fields)
            .finish();
        let multipart = fields
            .iter()
            .map(|(name, value)| format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"))
            .collect::<String>()
            + &format!("--{boundary}--\r\n");
        for (content_type, body) in [
            ("application/x-www-form-urlencoded".to_string(), urlencoded),
            (
                format!("multipart/form-data; boundary={boundary}"),
                multipart,
            ),
        ] {
            let response = request(&app, "POST", path, &content_type, body).await;
            assert_eq!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "{path} {content_type}"
            );
        }
    }
    assert_eq!(store(&server), before);
    assert_eq!(fs::read(&repo.file).unwrap(), benchmark_before);
}

#[test]
fn number_text_matches_ecmascript() {
    for (value, expected) in [
        (json!(0), "0"),
        (json!(42), "42"),
        (json!(1234567.5), "1234567.5"),
        (json!(1e21), "1e+21"),
        (json!(1e20), "100000000000000000000"),
        (json!(0.000001), "0.000001"),
        (json!(1e-7), "1e-7"),
        (json!(-2.5e-8), "-2.5e-8"),
    ] {
        let Value::Number(number) = &value else {
            unreachable!()
        };
        assert_eq!(records::number_text(number), expected, "{value}");
    }
}

/// The stored bytes of a record file; a file that does not exist is an empty store, and any other
/// read failure fails the test.
fn stored_bytes(file: &std::path::Path) -> Option<Vec<u8>> {
    match fs::read(file) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => panic!("read {}: {error}", file.display()),
    }
}

#[tokio::test]
async fn benchmark_requests_hold_exactly_the_form() {
    let (_directory, server) = fixture();
    let app = application(server.clone());
    let file = server.data.join("rust-createForm-react.json");
    let path = "/api/save/createForm/react";
    let before = stored_bytes(&file);
    for (content_type, body) in [
        ("application/json", r#"{"form":{},"extra":1}"#),
        (
            "application/x-www-form-urlencoded",
            "_form_complete=1&extra=1",
        ),
    ] {
        let (status, response) = call(&app, "POST", path, content_type, body.into()).await;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "{content_type}: {response}"
        );
        assert_eq!(
            stored_bytes(&file),
            before,
            "{content_type}: the store is unchanged"
        );
    }
    // A native form without rows posts only the completion field.
    let (status, response) = call(
        &app,
        "POST",
        "/api/validate/createForm/react",
        "application/x-www-form-urlencoded",
        "_form_complete=1".into(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{response}");
}
