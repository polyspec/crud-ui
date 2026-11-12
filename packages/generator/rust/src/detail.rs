//! Read-only detail models and HTML rendering.

use crate::util::{OrNoList, OrNoText};
use polyspec_crud_ui_validator::compose::member_ordered;
use serde_json::{json, Value};

use crate::list::{actions_html, build_display, cell_html, ListContext, ListOptions};
use crate::render::{element, escape};
use crate::util::join_class;
use crate::{FormError, FormResult};

/// Detail options use the same composition, language and data inputs as lists; the list-only
/// `layout`, `page` and `total` are ignored.
pub type DetailOptions<'a> = ListOptions<'a>;

/// Build one read-only detail model from a supplied record.
pub fn build_detail(
    spec: &Value,
    record: &Value,
    options: &DetailOptions<'_>,
) -> FormResult<Value> {
    // The specification is read in member order; the record keeps its own order.
    let spec = &member_ordered(spec);
    let Some(spec) = spec.as_object() else {
        return Err(FormError::input("Detail specification must be an object"));
    };
    // Argument shapes in argument order, then the declaration, then options.
    let Some(record) = record.as_object() else {
        return Err(FormError::input("Detail record must be an object"));
    };
    if !spec.contains_key("fields") {
        return Err(FormError::input("Detail specification must declare fields"));
    }
    if !options.data.is_null() && !options.data.is_object() {
        return Err(FormError::input("Detail context must be an object"));
    }
    // Page and total are list-only options: a detail neither checks nor uses them.
    let checked = ListContext {
        data: if options.data.is_null() {
            json!({})
        } else {
            options.data.clone()
        },
        page: None,
        total: None,
    };
    let list = build_display(
        &Value::Object(spec.clone()),
        &[Value::Object(record.clone())],
        options,
        &checked,
        "detail",
        "fields",
    )?;
    let columns = list["columns"].as_array().or_no_list().to_vec();
    // A detail without a record row has no cells.
    let cells = list["rows"]
        .as_array()
        .and_then(|rows| rows.first())
        .and_then(|row| row["cells"].as_array())
        .or_no_list()
        .to_vec();
    let fields = columns
        .iter()
        .zip(cells.iter())
        .map(|(column, cell)| {
            json!({
                "key": column["key"], "label": column["label"], "format": cell["format"],
                "value": cell["value"], "display": cell["display"], "design": cell["design"]
            })
        })
        .collect::<Vec<_>>();
    Ok(json!({"fields": fields, "actions": list["actions"], "design": list["design"]}))
}

/// Render one read-only detail: image preload links, the actions when the detail has any, and
/// the definition list.
pub fn render_detail(
    spec: &Value,
    record: &Value,
    options: &DetailOptions<'_>,
) -> FormResult<String> {
    let model = build_detail(spec, record, options)?;
    let design = &model["design"];
    let class = join_class(&[
        "crudui-detail",
        design["wrapper"]["class"].as_str().or_no_text(),
    ]);
    let body = model["fields"]
        .as_array()
        .or_no_list()
        .iter()
                .map(|field| {
                    let cell = json!({"display": field["display"], "design": field["design"], "format": field["format"]});
                    let label = element("dt", &json!({"class":"crudui-detail__label"}), &escape(field["label"].as_str().or_no_text()));
                    let value = cell_html(&cell, "dd", &format!("crudui-detail__value crudui-value crudui-value--{}", format_type(&field["format"])));
                    element("div", &json!({"class":"crudui-detail__field"}), &format!("{label}{value}"))
                })
                .collect::<String>();
    let mut attrs = json!({"class": class});
    if let Some(style) = design["wrapper"]["style"]
        .as_str()
        .filter(|style| !style.is_empty())
    {
        attrs["style"] = style.into();
    }
    let mut preloads = String::new();
    let mut seen = std::collections::HashSet::new();
    if let Some(fields) = model["fields"].as_array() {
        for field in fields {
            let display = &field["display"];
            if display["kind"] != "image" {
                continue;
            }
            let Some(source) = display["src"].as_str().filter(|source| {
                !source.is_empty() && !source.to_ascii_lowercase().starts_with("data:")
            }) else {
                continue;
            };
            if seen.insert(source) {
                preloads.push_str(&element(
                    "link",
                    &json!({"rel":"preload", "as":"image", "href":source}),
                    "",
                ));
            }
        }
    }
    let actions = actions_html(&model["actions"], "crudui-detail");
    Ok(format!(
        "{preloads}{actions}{}",
        element("dl", &attrs, &body)
    ))
}

/// The type of a display format; CUDF-005: a format without a type is `text`.
fn format_type(format: &Value) -> &str {
    match format["type"].as_str() {
        Some(kind) => kind,
        None => "text",
    }
}

#[cfg(test)]
mod tests {
    use super::{build_detail, render_detail, DetailOptions};
    use serde_json::json;

    #[test]
    fn detail_reuses_ordered_list_display_model() {
        let spec = json!({"fields": {"name": {"field": "name", "label": "Name"}, "active": {"field": "active", "label": "Active", "format": {"type": "bool", "true": "Yes", "false": "No"}}}});
        let model = build_detail(
            &spec,
            &json!({"name": "Ada", "active": true}),
            &DetailOptions::default(),
        )
        .unwrap();
        assert_eq!(model["fields"].as_array().unwrap().len(), 2);
        assert_eq!(model["fields"][0]["display"], "Ada");
        assert_eq!(model["fields"][1]["display"]["label"], "Yes");
    }

    #[test]
    fn detail_context_must_be_an_object_after_record_checks() {
        let spec = json!({"fields": {"v": {"field": "v"}}});
        for data in [json!([]), json!("s"), json!(1)] {
            let options = DetailOptions {
                data,
                ..Default::default()
            };
            for result in [
                build_detail(&spec, &json!({}), &options).map(|_| String::new()),
                render_detail(&spec, &json!({}), &options),
            ] {
                let error = result.unwrap_err();
                assert_eq!(
                    (
                        error.code.as_str(),
                        error.message.as_str(),
                        error.at.as_str()
                    ),
                    ("INVALID_FORM_INPUT", "Detail context must be an object", "")
                );
            }
            assert_eq!(
                build_detail(&json!({}), &json!({}), &options)
                    .unwrap_err()
                    .message,
                "Detail specification must declare fields"
            );
            assert_eq!(
                build_detail(&spec, &json!([]), &options)
                    .unwrap_err()
                    .message,
                "Detail record must be an object"
            );
        }
        let options = DetailOptions {
            data: json!(null),
            ..Default::default()
        };
        assert!(render_detail(&spec, &json!({}), &options).is_ok());
    }

    #[test]
    fn detail_renders_read_only_definition_list() {
        let spec = json!({"fields": {"name": {"field": "name", "label": "Name"}}});
        let html =
            render_detail(&spec, &json!({"name": "Ada"}), &DetailOptions::default()).unwrap();
        assert_eq!(
            html,
            r#"<dl class="crudui-detail"><div class="crudui-detail__field"><dt class="crudui-detail__label">Name</dt><dd class="crudui-detail__value crudui-value crudui-value--text">Ada</dd></div></dl>"#
        );
    }
}
