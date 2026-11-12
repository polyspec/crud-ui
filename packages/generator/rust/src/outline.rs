//! The structure map model derived from evaluated nodes: one entry per form row.

use crate::render::{controls, element, escape};
use crate::util::pretty_json_text;
use crate::util::OrNoList;
use crate::util::OrNoText;
use crate::{Form, FormResult};
use serde_json::{json, Map, Value};

/// The child nodes of `node`, none when it has no `children` list.
fn children(node: &Value) -> &[Value] {
    node.get("children").and_then(Value::as_array).or_no_list()
}

/// The rows under `nodes`, looking through every node that is not a collection.
fn rows(nodes: &[Value]) -> Vec<Value> {
    nodes
        .iter()
        .flat_map(|node| {
            if node["kind"] == "collection" {
                let path = node["path"].as_str().or_no_text();
                children(node).iter().map(|row| entry(path, row)).collect()
            } else {
                rows(children(node))
            }
        })
        .collect()
}

/// The entry of one row of the collection at `path`, with the rows nested in it.
fn entry(path: &str, row: &Value) -> Value {
    let mut entry = Map::new();
    entry.insert("path".into(), path.into());
    entry.insert("key".into(), row["key"].as_str().or_no_text().into());
    for name in ["number", "title"] {
        if let Some(text) = row["header"].get(name).filter(|text| !text.is_null()) {
            entry.insert(name.into(), text.clone());
        }
    }
    if row["controls"]["placement"] == "outline" {
        entry.insert("controls".into(), row["controls"].clone());
    }
    entry.insert("rows".into(), Value::Array(rows(children(row))));
    Value::Object(entry)
}

/// Build the structure map: the form's rows, nested as in the form. Collections, counts and empty collections are not rows.
pub fn build_outline(nodes: &[Value]) -> Vec<Value> {
    rows(nodes)
}

/// A text action button of the structure map header; a disabled one carries `aria-disabled`.
fn text_action(name: &str, label: &str, disabled: bool) -> String {
    let mut attrs = json!({"type":"button","class":"crudui-action crudui-action--text","data-crudui-action":name});
    if disabled {
        attrs["aria-disabled"] = "true".into();
    }
    element("button", &attrs, &escape(label))
}

/// The markup of one structure map row and the rows nested in it (CUMK-072).
fn outline_row(row: &Value) -> String {
    let mut select = String::new();
    for (name, class) in [
        ("number", "crudui-node__number"),
        ("title", "crudui-node__title"),
    ] {
        if let Some(text) = row.get(name) {
            select += &element(
                "span",
                &json!({"class":class}),
                &escape(&crate::util::js_string(text)),
            );
        }
    }
    let select = element(
        "button",
        &json!({"type":"button","class":"crudui-action crudui-action--text","data-crudui-action":"select-row"}),
        &select,
    );
    let row_controls = match row.get("controls") {
        Some(row_controls) => controls(row_controls),
        None => String::new(),
    };
    let nested = row["rows"].as_array().or_no_list();
    let body = if nested.is_empty() {
        String::new()
    } else {
        element(
            "div",
            &json!({"class":"crudui-node__body"}),
            &nested.iter().map(outline_row).collect::<String>(),
        )
    };
    element(
        "div",
        &json!({"class":"crudui-node crudui-node--row","data-field-path":row["path"],"data-crudui-row-key":row["key"]}),
        &(element(
            "div",
            &json!({"class":"crudui-node__header"}),
            &(select + &row_controls),
        ) + &body),
    )
}

/// The structure map of evaluated nodes with the form controls (CUMK-072): expand all, collapse
/// all, and undo and redo, disabled when they have no record, in the interface text of `language`.
pub fn render_outline_view(
    fields: &[Value],
    can_undo: bool,
    can_redo: bool,
    language: &str,
) -> FormResult<String> {
    let messages = crate::messages::form_messages(language)?;
    let controls = element(
        "div",
        &json!({"class":"crudui-controls","role":"group","aria-label":messages.form_controls}),
        &(text_action("expand-all", messages.expand_all, false)
            + &text_action("collapse-all", messages.collapse_all, false)
            + &text_action("undo", messages.undo, !can_undo)
            + &text_action("redo", messages.redo, !can_redo)),
    );
    Ok(element(
        "div",
        &json!({"class":"crudui-outline"}),
        &(element("div", &json!({"class":"crudui-outline__header"}), &controls)
            + &element(
                "div",
                &json!({"class":"crudui-outline__body"}),
                &build_outline(fields)
                    .iter()
                    .map(outline_row)
                    .collect::<String>(),
            )),
    ))
}

/// The structure map of a form instance (CUMK-072).
pub fn render_outline(form: &Form) -> FormResult<String> {
    render_outline_view(
        form.fields(),
        form.can_undo(),
        form.can_redo(),
        form.language(),
    )
}

/// The current data panel (CUMK-071): the heading in the interface text of `language` and the data
/// as `JSON.stringify(data, null, 2)` writes it.
pub fn render_data_panel(data: &Value, language: &str) -> FormResult<String> {
    let messages = crate::messages::form_messages(language)?;
    Ok(element(
        "div",
        &json!({"class":"crudui-data"}),
        &(element(
            "div",
            &json!({"class":"crudui-data__header"}),
            &escape(messages.data),
        ) + &element(
            "pre",
            &json!({"class":"crudui-data__body"}),
            &escape(&pretty_json_text(data)),
        )),
    ))
}

/// The current data panel of a form instance (CUMK-071).
pub fn render_data(form: &Form) -> FormResult<String> {
    render_data_panel(&form.get_data(), form.language())
}
