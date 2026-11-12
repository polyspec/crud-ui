//! Choice lists: `items` arrays of value and label pairs kept in list order.

use crate::template::check_declared_attributes;
use crate::util::OrNoList;
use crate::util::OrNoText;
use crate::util::{scalar, style};
use crate::{FormError, FormResult};
use polyspec_crudui_validator::validate::group_source::{group_choices, GroupChoicesError};
use serde_json::{json, Map, Value};
use std::collections::HashSet;

/// The expected-value text of a choice list declaration failure.
pub(crate) const CHOICE_LIST_EXPECTED: &str =
    "value and label pairs with distinct string or number values";

/// Whether `items` is a choice list: an array with an object element that has a `value` or a
/// `choices` member.
pub(crate) fn is_choice_list(items: &Value) -> bool {
    items.as_array().is_some_and(|array| {
        array.iter().any(|item| {
            item.as_object()
                .is_some_and(|o| o.contains_key("value") || o.contains_key("choices"))
        })
    })
}

/// Whether a choice list element is a group: an object that has a `choices` member.
fn is_group(item: &Value) -> bool {
    item.as_object().is_some_and(|o| o.contains_key("choices"))
}

/// The members a choice of a choice or multichoice field may declare besides `value` and
/// `label`.
const APPEARANCE_MEMBERS: [&str; 3] = ["class", "style", "attributes"];

/// The canonical value text and label of each pair in list order, the choices of each group in
/// place of the group, or `None` when an element has another member (an appearance member is
/// accepted with `appearance`), lacks `value` or `label`, has a value that is not a string or a
/// finite number, or repeats the canonical text of an earlier value, or when the list has a
/// group without `groups` or a group that is not `label` and a non-empty list of choices
/// without appearance members.
pub(crate) fn choice_pairs(
    items: &Value,
    appearance: bool,
    groups: bool,
) -> Option<Vec<(String, &Value)>> {
    let mut seen = HashSet::new();
    let mut pairs = Vec::new();
    for item in items.as_array()? {
        if groups && is_group(item) {
            let group = item.as_object()?;
            let choices = group["choices"].as_array().filter(|c| !c.is_empty())?;
            if group.len() != 2 || !group.contains_key("label") {
                return None;
            }
            for choice in choices {
                pairs.push(pair(choice, &[], &mut seen)?);
            }
        } else {
            let members: &[&str] = if appearance { &APPEARANCE_MEMBERS } else { &[] };
            pairs.push(pair(item, members, &mut seen)?);
        }
    }
    Some(pairs)
}

/// One checked pair: an object of `value`, `label` and `members`, with a string or finite
/// number value whose canonical text is not in `seen`.
fn pair<'a>(
    item: &'a Value,
    members: &[&str],
    seen: &mut HashSet<String>,
) -> Option<(String, &'a Value)> {
    let object = item.as_object()?;
    if object
        .keys()
        .any(|key| key != "value" && key != "label" && !members.contains(&key.as_str()))
    {
        return None;
    }
    let (value, label) = (object.get("value")?, object.get("label")?);
    if !value.is_string() && !value.is_number() {
        return None;
    }
    let text = scalar(Some(value));
    if !seen.insert(text.clone()) {
        return None;
    }
    Some((text, label))
}

/// The group of each pair of a checked choice list in the order of [`choice_pairs`]: the
/// position of the group in the list and its declared label, `None` outside groups.
pub(crate) fn choice_groups(items: &Value) -> Vec<Option<(usize, &Value)>> {
    items
        .as_array()
        .into_iter()
        .flatten()
        .enumerate()
        .flat_map(|(index, item)| {
            if is_group(item) {
                let count = item["choices"].as_array().or_no_list().len();
                vec![Some((index, &item["label"])); count]
            } else {
                vec![None]
            }
        })
        .collect()
}

/// The label of the pair whose value has the canonical text `text`.
pub(crate) fn choice_label<'a>(items: &'a Value, text: &str) -> Option<&'a Value> {
    choice_pairs(items, false, false)?
        .into_iter()
        .find(|(value, _)| value == text)
        .map(|(_, label)| label)
}

/// Reject the appearance of a valid choice list whose `class` or `style` is not a string or
/// whose `attributes` break the declared attribute rules, choice by choice in list order.
pub(crate) fn check_choice_appearance(items: &Value, path: &str) -> FormResult<()> {
    for (index, choice) in items.as_array().into_iter().flatten().enumerate() {
        for member in ["class", "style"] {
            if choice.get(member).is_some_and(|value| !value.is_string()) {
                return Err(FormError::input(format!(
                    "Invalid items.{index}.{member} at {path}: expected a string"
                )));
            }
        }
        if let Some(attributes) = choice.get("attributes") {
            check_declared_attributes(attributes, &format!("items.{index}.attributes"), path)?;
        }
    }
    Ok(())
}

/// The appearance members of each choice of a checked choice list in list order: the label
/// class (`className`) and style and the input attributes, each only when declared.
pub(crate) fn choice_appearances(items: &Value) -> Vec<Map<String, Value>> {
    items
        .as_array()
        .into_iter()
        .flatten()
        .map(|choice| {
            let mut appearance = Map::new();
            if let Some(class) = choice["class"].as_str().filter(|class| !class.is_empty()) {
                appearance.insert("className".into(), class.into());
            }
            let inline = style(choice["style"].as_str().or_no_text());
            if !inline.is_empty() {
                appearance.insert("style".into(), inline.into());
            }
            if let Some(attributes) = choice["attributes"].as_object().filter(|a| !a.is_empty()) {
                appearance.insert("attributes".into(), attributes.clone().into());
            }
            appearance
        })
        .collect()
}

/// The spec of a field whose `items` is a group source, with the items replaced by the choice
/// list of the group's rows in the root `data` (schema.md, "Choices from a repeated group").
pub(crate) fn with_group_choices(spec: &Value, data: &Value, path: &str) -> FormResult<Value> {
    let choices = group_choices(&spec["items"], data, path).map_err(|error| match error {
        GroupChoicesError::Declaration(message) | GroupChoicesError::Repeated(message) => {
            FormError::input(message)
        }
    })?;
    let items: Vec<Value> = choices
        .into_iter()
        .map(|choice| json!({"value": choice.value, "label": choice.label}))
        .collect();
    let mut grouped = spec.clone();
    grouped["items"] = Value::Array(items);
    Ok(grouped)
}
