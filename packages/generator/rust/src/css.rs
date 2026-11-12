use crate::util::OrNoText;
use serde_json::{Map, Value};

#[allow(
    clippy::expect_used,
    reason = "R-1: a constant expression, which the tests compile"
)]
static COMMENTS: std::sync::LazyLock<regex::Regex> =
    std::sync::LazyLock::new(|| regex::Regex::new(r"/\*[\s\S]*?\*/").expect("CSS comment pattern"));

pub(crate) fn declarations(source: &str) -> Vec<(String, String)> {
    if source.trim().is_empty() {
        return Vec::new();
    }
    let mut result = Vec::new();
    let mut blocks = Vec::new();
    let mut quote = None;
    let mut escaped = false;
    let mut comment = false;
    let mut skip = false;
    let mut start = 0;
    let mut colon = None;
    let comments = &*COMMENTS;
    let finish =
        |end: usize, start: usize, colon: Option<usize>, result: &mut Vec<(String, String)>| {
            if let Some(colon) = colon {
                let property = comments
                    .replace_all(&source[start..colon], " ")
                    .trim()
                    .to_owned();
                let value = source[colon + 1..end].trim().to_owned();
                if !property.is_empty() && !value.is_empty() {
                    result.push((property, value));
                }
            }
        };
    for (index, character) in source.char_indices() {
        if skip {
            skip = false;
            continue;
        }
        if comment {
            if character == '*' && source.as_bytes().get(index + 1) == Some(&b'/') {
                comment = false;
                skip = true;
            }
            continue;
        }
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if quote.is_some() {
            if quote == Some(character) {
                quote = None;
            }
            continue;
        }
        if character == '/' && source.as_bytes().get(index + 1) == Some(&b'*') {
            comment = true;
            skip = true;
            continue;
        }
        if character == '\'' || character == '"' {
            quote = Some(character);
            continue;
        }
        if ['(', '[', '{'].contains(&character) {
            blocks.push(character);
            continue;
        }
        let closing = match character {
            ')' => Some('('),
            ']' => Some('['),
            '}' => Some('{'),
            _ => None,
        };
        if let Some(closing) = closing {
            if blocks.last() == Some(&closing) {
                blocks.pop();
            }
            continue;
        }
        if !blocks.is_empty() {
            continue;
        }
        if character == ':' && colon.is_none() {
            colon = Some(index);
        } else if character == ';' {
            finish(index, start, colon, &mut result);
            start = index + 1;
            colon = None;
        }
    }
    finish(source.len(), start, colon, &mut result);
    result
}

pub(crate) fn style_string(source: &str) -> String {
    declarations(source)
        .into_iter()
        .map(|(property, value)| format!("{property}: {value}"))
        .collect::<Vec<_>>()
        .join("; ")
}

pub(crate) fn render_style(source: &str) -> String {
    let mut properties = Map::new();
    for (property, value) in declarations(source) {
        properties.insert(property, Value::String(value));
    }
    properties
        .iter()
        .map(|(property, value)| format!("{property}:{}", value.as_str().or_no_text()))
        .collect::<Vec<_>>()
        .join(";")
}
