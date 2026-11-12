//! Shared helpers of the rendering suites: the fixture reader and the normalized layout tree that the render runners
//! compare (the Python runner's `html_tree`, legacy/packages/generator/python/tests/conformance.py).

use serde_json::{json, Value};
use std::path::Path;

#[path = "../../../../validator/rust/tests/common/case_value.rs"]
mod case_value;
#[allow(
    unused_imports,
    reason = "each test crate of the package uses the readers that its fixtures need"
)]
pub use case_value::*;

/// The cases of the groups `groups` of a fixture family in the case form of binding (G-5), in group order.
#[allow(
    dead_code,
    reason = "each test crate of the package uses the readers that its fixtures need"
)]
pub fn case_groups(family: &str, groups: &[&str]) -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../tests/fixtures")
        .join(family)
        .join("cases.json");
    let file = read_file(&path);
    let mut cases = Vec::new();
    for group in groups {
        match file.get(*group) {
            Some(Value::Array(items)) => cases.extend(items.iter().cloned()),
            _ => panic!("{} has no group {group}", path.display()),
        }
    }
    assert!(!cases.is_empty(), "{family} holds no case");
    cases
}

/// The cases of one fixture family, read from `tests/fixtures/<family>/cases.json`; a family holds at least one case.
#[allow(
    dead_code,
    reason = "each test crate of the package uses the readers that its fixtures need"
)]
pub fn cases(family: &str) -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../tests/fixtures")
        .join(family)
        .join("cases.json");
    let text = match std::fs::read_to_string(&path) {
        Ok(value) => value,
        Err(error) => panic!("read {}: {error}", path.display()),
    };
    let cases: Vec<Value> = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(error) => panic!("parse {}: {error}", path.display()),
    };
    assert!(!cases.is_empty(), "{family} holds no case");
    cases
}

const BOOLEAN_ATTRIBUTES: [&str; 7] = [
    "checked",
    "selected",
    "disabled",
    "readonly",
    "multiple",
    "required",
    "autofocus",
];
const PRESERVE: [&str; 4] = ["textarea", "pre", "script", "style"];
const VOID: [&str; 14] = [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
];

/// The element of the tree under construction: its tag, its attributes as written and its children.
struct Element {
    tag: String,
    attributes: Vec<(String, String)>,
    children: Vec<Value>,
}

/// Decodes the character references that the generator writes; any other reference stays as written.
fn unescape(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('&') {
        out.push_str(&rest[..start]);
        rest = &rest[start..];
        let Some(end) = rest.find(';').filter(|end| *end <= 12) else {
            out.push('&');
            rest = &rest[1..];
            continue;
        };
        let name = &rest[1..end];
        let decoded = match name {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "nbsp" => Some('\u{a0}'),
            _ => name.strip_prefix('#').and_then(|number| {
                let parsed = match number.strip_prefix(['x', 'X']) {
                    Some(hex) => u32::from_str_radix(hex, 16),
                    None => number.parse::<u32>(),
                };
                // A reference whose number does not parse is no character reference, so it stays as written.
                match parsed {
                    Ok(code) => char::from_u32(code),
                    Err(_) => None,
                }
            }),
        };
        match decoded {
            Some(character) => {
                out.push(character);
                rest = &rest[end + 1..];
            }
            None => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// The normalized comparison tree of a rendered HTML string: the element and text nodes, with sorted attributes, boolean
/// attributes empty, a canonical style, no empty class or style, and no whitespace-only text outside preformatted
/// elements. The style canonical form splits declarations on `;` and joins them with `; `, which equals the
/// generator's canonical form for the declarations of the fixtures.
pub fn html_tree(html: &str) -> Value {
    let mut stack = vec![Element {
        tag: "#root".into(),
        attributes: vec![],
        children: vec![],
    }];
    let mut rest = html;
    while !rest.is_empty() {
        if let Some(after) = rest.strip_prefix("<!--") {
            rest = after.find("-->").map_or("", |end| &after[end + 3..]);
        } else if rest.starts_with("<!") || rest.starts_with("<?") {
            rest = rest.find('>').map_or("", |end| &rest[end + 1..]);
        } else if let Some(after) = rest.strip_prefix("</") {
            let end = after.find('>').unwrap_or(after.len());
            let tag = after[..end].trim().to_ascii_lowercase();
            close(&mut stack, &tag);
            rest = after.get(end + 1..).unwrap_or("");
        } else if rest.starts_with('<') && rest[1..].starts_with(|c: char| c.is_ascii_alphabetic())
        {
            let (tag, attributes, self_closing, after) = start_tag(&rest[1..]);
            let raw = !self_closing && (tag == "script" || tag == "style");
            let element = Element {
                tag: tag.clone(),
                attributes,
                children: vec![],
            };
            if raw {
                let close_at = after
                    .to_ascii_lowercase()
                    .find(&format!("</{tag}"))
                    .unwrap_or(after.len());
                stack.push(element);
                text(&mut stack, &after[..close_at]);
                let end = after[close_at..]
                    .find('>')
                    .map_or(after.len(), |end| close_at + end + 1);
                rest = &after[end..];
                close(&mut stack, &tag);
                continue;
            }
            if VOID.contains(&tag.as_str()) || self_closing {
                stack.last_mut().unwrap().children.push(node(&element));
            } else {
                stack.push(element);
            }
            rest = after;
        } else {
            // The first character is text even when it is a `<` that opens nothing.
            let first = rest.chars().next().map_or(1, char::len_utf8);
            let end = rest[first..].find('<').map_or(rest.len(), |at| at + first);
            text(&mut stack, &rest[..end]);
            rest = &rest[end..];
        }
    }
    while stack.len() > 1 {
        let element = stack.pop().unwrap();
        stack.last_mut().unwrap().children.push(node(&element));
    }
    let root = stack.pop().unwrap();
    json!(root.children)
}

/// Parses a start tag after its `<`: the lowercased name, its attributes, whether it closes itself and the rest.
fn start_tag(text: &str) -> (String, Vec<(String, String)>, bool, &str) {
    let name_end = text
        .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
        .unwrap_or(text.len());
    let tag = text[..name_end].to_ascii_lowercase();
    let mut attributes = vec![];
    let mut rest = &text[name_end..];
    loop {
        rest = rest.trim_start();
        if let Some(after) = rest.strip_prefix("/>") {
            return (tag, attributes, true, after);
        }
        if let Some(after) = rest.strip_prefix('>') {
            return (tag, attributes, false, after);
        }
        if rest.is_empty() {
            return (tag, attributes, false, rest);
        }
        if let Some(after) = rest.strip_prefix('/') {
            rest = after;
            continue;
        }
        let name_end = rest
            .find(|c: char| c.is_whitespace() || c == '>' || c == '=' || c == '/')
            .unwrap_or(rest.len())
            .max(1);
        let name = rest[..name_end].to_ascii_lowercase();
        rest = rest[name_end..].trim_start();
        let value = if let Some(after) = rest.strip_prefix('=') {
            let after = after.trim_start();
            if let Some(quoted) = after.strip_prefix('"') {
                let end = quoted.find('"').unwrap_or(quoted.len());
                rest = quoted.get(end + 1..).unwrap_or("");
                unescape(&quoted[..end])
            } else if let Some(quoted) = after.strip_prefix('\'') {
                let end = quoted.find('\'').unwrap_or(quoted.len());
                rest = quoted.get(end + 1..).unwrap_or("");
                unescape(&quoted[..end])
            } else {
                let end = after
                    .find(|c: char| c.is_whitespace() || c == '>')
                    .unwrap_or(after.len());
                rest = &after[end..];
                unescape(&after[..end])
            }
        } else {
            String::new()
        };
        let value = if BOOLEAN_ATTRIBUTES.contains(&name.as_str()) {
            String::new()
        } else {
            value.replace('\0', "\u{fffd}")
        };
        attributes.push((name, value));
    }
}

/// Adds a text node to the open element, unless it is whitespace outside preformatted elements or the text of a
/// `\0` character only (an HTML5 parser drops a NUL outside preformatted elements).
fn text(stack: &mut [Element], raw: &str) {
    if raw.is_empty() {
        return;
    }
    let preserve = stack
        .iter()
        .any(|element| PRESERVE.contains(&element.tag.as_str()));
    let mut data = unescape(raw);
    if !preserve {
        data = data.replace('\0', "");
        if data.trim().is_empty() {
            return;
        }
    }
    stack
        .last_mut()
        .unwrap()
        .children
        .push(json!({ "text": data }));
}

/// Closes the innermost open element with the tag, and the elements opened after it; an unmatched end tag is ignored.
fn close(stack: &mut Vec<Element>, tag: &str) {
    if !stack.iter().skip(1).any(|element| element.tag == tag) {
        return;
    }
    while stack.len() > 1 {
        let element = stack.pop().unwrap();
        let done = element.tag == tag;
        stack.last_mut().unwrap().children.push(node(&element));
        if done {
            return;
        }
    }
}

/// The normalized node of an element: sorted attributes, a canonical style and no empty class or style.
fn node(element: &Element) -> Value {
    let mut attributes: Vec<(String, String)> = element.attributes.clone();
    attributes.sort_by(|a, b| a.0.cmp(&b.0));
    let mut out = serde_json::Map::new();
    for (name, value) in attributes {
        let value = if name == "style" {
            canonical_style(&value)
        } else {
            value
        };
        if (name == "class" || name == "style") && value.is_empty() {
            continue;
        }
        out.insert(name, Value::String(value));
    }
    json!({ "tag": element.tag, "attributes": out, "children": element.children })
}

/// Declarations split on `;`, each property and value trimmed, joined with `; `; an empty style is empty.
fn canonical_style(style: &str) -> String {
    style
        .split(';')
        .map(str::trim)
        .filter(|declaration| !declaration.is_empty())
        .map(|declaration| match declaration.split_once(':') {
            Some((property, value)) => format!("{}: {}", property.trim(), value.trim()),
            None => declaration.to_owned(),
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// The path and the two nodes of the first difference between two normalized trees, or `None` when they are equal.
pub fn first_difference(actual: &Value, expected: &Value) -> Option<String> {
    fn walk(actual: &Value, expected: &Value, path: &str) -> Option<String> {
        match (actual, expected) {
            (Value::Array(a), Value::Array(e)) => {
                for index in 0..a.len().max(e.len()) {
                    match (a.get(index), e.get(index)) {
                        (Some(x), Some(y)) => {
                            if let Some(found) = walk(x, y, &format!("{path}.{index}")) {
                                return Some(found);
                            }
                        }
                        _ => return Some(format!("{path}: child count differs at {index}")),
                    }
                }
                None
            }
            (Value::Object(a), Value::Object(e))
                if a.contains_key("tag") && e.contains_key("tag") =>
            {
                if a["tag"] != e["tag"] || a["attributes"] != e["attributes"] {
                    return Some(format!(
                        "{path}: got {} {}, expected {} {}",
                        a["tag"], a["attributes"], e["tag"], e["attributes"]
                    ));
                }
                walk(
                    &a["children"],
                    &e["children"],
                    &format!("{path}/{}", a["tag"]),
                )
            }
            _ if actual == expected => None,
            _ => Some(format!("{path}: got {actual}, expected {expected}")),
        }
    }
    walk(actual, expected, "")
}
