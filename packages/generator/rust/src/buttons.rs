//! Form buttons: the actions a spec declares with root `buttons`, rendered in the form footer.

use crate::css::style_string;
use crate::design::resolve_design;
use crate::messages::Messages;
use crate::render::{raw_attribute, raw_text};
use crate::util::translate;
use crate::util::OrNoText;
use crate::{FormError, FormResult};
use serde_json::{Map, Value};

/// Button types a spec can declare. A link renders an anchor.
pub(crate) const FORM_BUTTON_TYPES: [&str; 4] = ["submit", "reset", "button", "link"];

/// The interface text of a button type; only submit and reset have one.
pub(crate) fn button_text(messages: &Messages, kind: &str) -> &'static str {
    match kind {
        "submit" => messages.submit,
        "reset" => messages.reset,
        _ => "",
    }
}

/// The declared content, or the interface text when there is none.
fn button_label(button: &Map<String, Value>, language: &str, fallback: &str) -> String {
    match button.get("text") {
        Some(Value::String(text)) => text.clone(),
        Some(text @ Value::Object(_)) => {
            let label = translate(Some(text), language);
            if label.is_empty() {
                fallback.into()
            } else {
                label
            }
        }
        _ => fallback.into(),
    }
}

/// A non-empty behavior script: a string or the script of a `{ label, script }` action.
fn button_script(button: &Map<String, Value>, action: &str) -> String {
    let Some(behavior) = button.get("behavior") else {
        return String::new();
    };
    let value = &behavior[action];
    value
        .as_str()
        .or_else(|| value["script"].as_str())
        .or_no_text()
        .into()
}

/// Evaluate form buttons for a record: ordered `type, tag, text, attrs` objects whose
/// attributes keep the output order type, class, style, name, value, href, onclick.
pub(crate) fn button_models(
    buttons: &[Map<String, Value>],
    data: &Value,
    language: &str,
    messages: &Messages,
) -> Vec<Value> {
    buttons
        .iter()
        .map(|button| {
            let kind = button.get("type").and_then(Value::as_str).or_no_text();
            let design = resolve_design(button.get("design"), data, "", &[]);
            let tag = if kind == "link" { "a" } else { "button" };
            let mut attrs = Map::new();
            if kind != "link" {
                attrs.insert("type".into(), kind.into());
            }
            let class = design["main"]["class"].as_str().or_no_text();
            attrs.insert(
                "class".into(),
                if class.is_empty() {
                    "crudui-action crudui-action--text".into()
                } else {
                    format!("crudui-action crudui-action--text {class}").into()
                },
            );
            let style = style_string(design["main"]["style"].as_str().or_no_text());
            if !style.is_empty() {
                attrs.insert("style".into(), style.into());
            }
            for name in ["name", "value", "href"] {
                if let Some(value) = button.get(name).and_then(Value::as_str) {
                    attrs.insert(name.into(), value.into());
                }
            }
            let script = button_script(button, "onclick");
            if !script.is_empty() {
                attrs.insert("onclick".into(), script.into());
            }
            let mut model = Map::new();
            model.insert("type".into(), kind.into());
            model.insert("tag".into(), tag.into());
            model.insert(
                "text".into(),
                button_label(button, language, button_text(messages, kind)).into(),
            );
            model.insert("attrs".into(), Value::Object(attrs));
            Value::Object(model)
        })
        .collect()
}

/// Markup of evaluated form buttons; every implementation emits this markup.
pub(crate) fn buttons_markup(buttons: &[Value]) -> FormResult<String> {
    let invalid = || FormError::input("Form buttons must be evaluated button objects");
    buttons
        .iter()
        .map(|button| {
            let tag = match button["tag"].as_str() {
                Some(tag @ ("a" | "button")) => tag,
                _ => return Err(invalid()),
            };
            let text = button["text"].as_str().ok_or_else(invalid)?;
            let attrs = button["attrs"].as_object().ok_or_else(invalid)?;
            let mut attributes = String::new();
            for (name, value) in attrs {
                let value = value.as_str().ok_or_else(invalid)?;
                if !BUTTON_ATTRIBUTES.contains(&name.as_str()) {
                    return Err(invalid());
                }
                attributes.push_str(&format!(" {name}=\"{}\"", raw_attribute(value)));
            }
            Ok(format!("<{tag}{attributes}>{}</{tag}>", raw_text(text)))
        })
        .collect()
}

/// The attribute names an evaluated button can carry, in output order.
const BUTTON_ATTRIBUTES: [&str; 7] = ["type", "class", "style", "name", "value", "href", "onclick"];
