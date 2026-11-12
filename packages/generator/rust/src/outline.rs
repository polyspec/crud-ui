//! The structure map model derived from evaluated nodes: one entry per form row.

use crate::util::OrNoList;
use crate::util::OrNoText;
use serde_json::{Map, Value};

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
