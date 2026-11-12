//! Row view state of form instances, kept outside the record data.

use crate::util::OrNoList;
use crate::util::OrNoText;
use serde_json::Value;

/// The row paths `{collection}.{key}` rendered collapsed, in the order the rows were collapsed and without duplicates.
/// It is never submitted with the data.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ViewState {
    /// The collapsed row paths.
    pub collapsed: Vec<String>,
}

/// Whether `path` is the row path `row_path` or lies inside that row.
fn inside(row_path: &str, path: &str) -> bool {
    path == row_path
        || path
            .strip_prefix(row_path)
            .is_some_and(|rest| rest.starts_with('.'))
}

/// The view with no collapsed row. Replacing the record returns to it.
pub fn initial_view() -> ViewState {
    ViewState::default()
}

/// The row paths of every collapsible row of the evaluated nodes, depth first in node order.
pub fn collapsible_rows(nodes: &[Value]) -> Vec<String> {
    let mut rows = Vec::new();
    collect(nodes, &mut rows);
    rows
}

fn children(node: &Value) -> &[Value] {
    node.get("children").and_then(Value::as_array).or_no_list()
}

fn collect(nodes: &[Value], rows: &mut Vec<String>) {
    for node in nodes {
        if node["kind"] != "collection" {
            collect(children(node), rows);
            continue;
        }
        for row in children(node) {
            if row["collapsible"] == true {
                rows.push(format!(
                    "{}.{}",
                    node["path"].as_str().or_no_text(),
                    row["key"].as_str().or_no_text()
                ));
            }
            collect(children(row), rows);
        }
    }
}

/// Expand a collapsed row or collapse an expanded one, appending a collapsed row last.
pub fn toggle_row_view(view: &ViewState, row_path: &str) -> ViewState {
    let mut collapsed: Vec<String> = view
        .collapsed
        .iter()
        .filter(|path| *path != row_path)
        .cloned()
        .collect();
    if collapsed.len() == view.collapsed.len() {
        collapsed.push(row_path.to_owned());
    }
    ViewState { collapsed }
}

/// The view with no collapsed row when `expanded` is true, and otherwise the view that collapses every collapsible
/// row of the evaluated nodes.
pub fn set_all_expanded_view(nodes: &[Value], expanded: bool) -> ViewState {
    if expanded {
        initial_view()
    } else {
        ViewState {
            collapsed: collapsible_rows(nodes),
        }
    }
}

/// Drop the collapsed state of a removed row and of the rows inside it.
pub fn remove_row_view(view: &ViewState, row_path: &str) -> ViewState {
    ViewState {
        collapsed: view
            .collapsed
            .iter()
            .filter(|path| !inside(row_path, path))
            .cloned()
            .collect(),
    }
}

/// Move the collapsed state of a rekeyed row and of the rows inside it to the new row path.
pub fn rekey_row_view(view: &ViewState, old_path: &str, new_path: &str) -> ViewState {
    let mut collapsed: Vec<String> = Vec::new();
    for path in &view.collapsed {
        let moved = if inside(old_path, path) {
            format!("{new_path}{}", &path[old_path.len()..])
        } else {
            path.clone()
        };
        if !collapsed.contains(&moved) {
            collapsed.push(moved);
        }
    }
    ViewState { collapsed }
}
