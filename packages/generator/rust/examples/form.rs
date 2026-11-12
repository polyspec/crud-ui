#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

use polyspec_crudui_generator::{
    compile_form, render_detail, render_form, render_list, sequence_row_key, BindOptions,
    CompileOptions, DetailOptions, Form, ListOptions,
};
use polyspec_crudui_validator::validate::{validate, ValidateOptions};
use serde_json::{json, Value};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let spec = json!({
        "type": "group",
        "properties": {
            "companies": {
                "type": "group", "label": "Companies", "multiple": true,
                "properties": {
                    "name": { "type": "text", "label": "Name", "validate": { "required": true } },
                    "stores": {
                        "type": "group", "label": "Stores", "multiple": true,
                        "properties": { "name": { "type": "text", "label": "Store", "validate": { "required": true } } }
                    }
                }
            }
        }
    });
    let template = compile_form(
        &spec,
        &CompileOptions {
            key_prefix: Some("form".into()),
            ..Default::default()
        },
    )?;
    let cached = serde_json::to_vec(&template)?;
    let company = sequence_row_key("5")?;
    let data = json!({"companies": {
        company.clone(): {"name": "Company", "stores": {
            sequence_row_key("42")?: {"name": "Store"}
        }},
        sequence_row_key("6")?: {"name": "Second company", "stores": {
            sequence_row_key("43")?: {"name": "North store"},
            sequence_row_key("44")?: {"name": "South store"}
        }}
    }});
    let initial = Form::new(
        template,
        &data,
        BindOptions {
            language: "en".into(),
            ..Default::default()
        },
    )?;
    let mut injected = Form::new(
        serde_json::from_slice(&cached)?,
        &json!({"companies": {}}),
        BindOptions {
            language: "en".into(),
            ..Default::default()
        },
    )?;
    injected.set_data(&data)?;
    assert_eq!(render_form(&initial, None)?, render_form(&injected, None)?);
    assert_eq!(initial.get_data(), injected.get_data());
    let record = injected.get_data();
    let validation = validate(&spec, &record, &ValidateOptions::default())?;
    assert!(validation.valid);

    // The list and the detail display the same record: each company row becomes a display row
    // with its row key and its store count.
    let rows: Vec<Value> = record["companies"]
        .as_object()
        .ok_or("companies must be an object")?
        .iter()
        .map(|(key, company)| {
            json!({
                "key": key,
                "name": company["name"],
                "stores": company["stores"].as_object().map_or(0, |stores| stores.len()),
            })
        })
        .collect();
    let list_spec = json!({"columns": {
        "name": {"field": "name", "label": "Company", "format": {"type": "link", "href": "#company-{=key}"}},
        "key": {"field": "key", "label": "Row key", "format": "text"},
        "stores": {"field": "stores", "label": "Stores", "format": {"type": "badge", "map": {"1": "info", "2": "success"}}}
    }});
    let detail_spec = json!({"fields": {
        "name": {"field": "name", "label": "Company", "format": "text"},
        "key": {"field": "key", "label": "Row key", "format": "text"},
        "stores": {"field": "stores", "label": "Stores", "format": {"type": "number", "suffix": " stores"}}
    }});
    let list = render_list(
        &list_spec,
        &rows,
        &ListOptions {
            language: "en".into(),
            ..Default::default()
        },
    )?;
    assert!(list.contains(&format!("<a href=\"#company-{company}\">Company</a>")));
    assert!(list.contains("<span class=\"crudui-badge\" data-crudui-variant=\"success\">2</span>"));
    // Each list link targets the detail of its company row.
    let mut details = String::new();
    for row in &rows {
        let detail = render_detail(
            &detail_spec,
            row,
            &DetailOptions {
                language: "en".into(),
                ..Default::default()
            },
        )?;
        assert!(detail.contains("<dt class=\"crudui-detail__label\">Company</dt>"));
        let key = row["key"].as_str().ok_or("row key must be a string")?;
        details.push_str(&format!("<section id=\"company-{key}\">{detail}</section>"));
    }
    assert!(details.contains(&format!(
        "<section id=\"company-{company}\"><dl class=\"crudui-detail\">"
    )));
    assert!(details.contains(">1 stores</dd>") && details.contains(">2 stores</dd>"));

    println!(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>CRUDUI form, list and detail</title>\
         <h1>Form</h1><form method=\"post\">{}</form>\
         <h1>List</h1>{list}<h1>Detail</h1>{details}</html>",
        render_form(&injected, None)?
    );
    Ok(())
}
