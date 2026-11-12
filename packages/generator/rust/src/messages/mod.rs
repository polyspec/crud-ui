//! Runtime interface text shared by every renderer and implementation.

use crate::{FormError, FormResult};

// The table is written by its generator from contracts/interface-messages.json; its layout is the generator's.
#[rustfmt::skip]
mod interface_messages;
pub(crate) use interface_messages::{EN, EN_LIST, JA, JA_LIST, KO, KO_LIST, ZH, ZH_LIST};

/// Interface labels for row, collection and form controls. `{count}` is replaced by a number.
#[allow(dead_code, reason = "generated whole; the renderer reads its labels")]
pub(crate) struct Messages {
    /// Move a row up.
    pub move_up: &'static str,
    /// Move a row down.
    pub move_down: &'static str,
    /// Add a row.
    pub add_row: &'static str,
    /// Copy a row.
    pub copy_row: &'static str,
    /// Remove a row.
    pub remove_row: &'static str,
    /// Expand or collapse a row.
    pub toggle_row: &'static str,
    /// Expand every row.
    pub expand_all: &'static str,
    /// Collapse every row.
    pub collapse_all: &'static str,
    /// Undo the last change.
    pub undo: &'static str,
    /// Redo the last undo.
    pub redo: &'static str,
    /// Accessible name of a row's controls.
    pub row_controls: &'static str,
    /// Accessible name of an empty collection's controls.
    pub collection_controls: &'static str,
    /// Accessible name of the form controls.
    pub form_controls: &'static str,
    /// Accessible name of the form buttons in the form footer.
    pub form_actions: &'static str,
    /// Default text of a submit button.
    pub submit: &'static str,
    /// Default text of a reset button.
    pub reset: &'static str,
    /// Structure map heading.
    pub outline: &'static str,
    /// Current data heading.
    pub data: &'static str,
    /// Row title when the title field is empty.
    pub untitled: &'static str,
    /// Collapsed row summary without nested collections.
    pub collapsed: &'static str,
    /// Collection row count.
    pub count: &'static str,
    /// Collapsed row summary with nested rows.
    pub children: &'static str,
    /// Accessible name of the mode select of a condition group.
    pub condition_mode: &'static str,
    /// Add a field comparison to a condition group.
    pub condition_add_comparison: &'static str,
    /// Add a nested group to a condition group.
    pub condition_add_group: &'static str,
    /// Add a judged text to a condition group.
    pub condition_add_judge: &'static str,
    /// Remove a condition from its group.
    pub condition_remove: &'static str,
    /// Error of a value that the structured editor does not show; `{path}` is the data path of the field.
    pub condition_invalid: &'static str,
}

/// Interface labels for list pagination. `{page}` is replaced by a page number.
#[allow(dead_code, reason = "generated whole; the renderer reads its labels")]
pub(crate) struct ListMessages {
    /// Previous page button label.
    pub previous_page: &'static str,
    /// Next page button label.
    pub next_page: &'static str,
    /// Page number button label. `{page}` is replaced by the page number.
    pub page: &'static str,
    /// Text shown when a list has no rows.
    pub empty_list: &'static str,
}

/// Return the interface text for a supported language.
pub(crate) fn form_messages(language: &str) -> FormResult<&'static Messages> {
    match language {
        "ko" => Ok(&KO),
        "en" => Ok(&EN),
        "ja" => Ok(&JA),
        "zh" => Ok(&ZH),
        _ => Err(FormError::input(format!(
            "Unsupported language: {language}"
        ))),
    }
}

/// Return the list interface text for a supported language.
pub(crate) fn list_messages(language: &str) -> &'static ListMessages {
    match language {
        "ko" => &KO_LIST,
        "en" => &EN_LIST,
        "ja" => &JA_LIST,
        "zh" => &ZH_LIST,
        _ => &EN_LIST, // Default to English for unsupported languages
    }
}

/// Replace `{count}` in a counted message.
pub(crate) fn format_count(template: &str, count: usize) -> String {
    template.replacen("{count}", &count.to_string(), 1)
}

/// Replace `{page}` in a page number message.
pub(crate) fn format_page(template: &str, page: u64) -> String {
    template.replacen("{page}", &page.to_string(), 1)
}

#[cfg(test)]
#[allow(
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths; a test fails by a panic"
)]
mod tests {
    use super::*;
    use serde_json::Value;

    // Convert camelCase to snake_case for matching
    fn to_snake_case(s: &str) -> String {
        let mut result = String::new();
        for c in s.chars() {
            if c.is_uppercase() {
                result.push('_');
                result.extend(c.to_lowercase());
            } else {
                result.push(c);
            }
        }
        result
    }

    /// The embedded messages equal contracts/interface-messages.json (CUMK-065).
    #[test]
    fn embedded_messages_match_the_contract() {
        let contract: Value = match serde_json::from_str(include_str!(
            "../../../../../contracts/interface-messages.json"
        )) {
            Ok(value) => value,
            Err(error) => panic!("parse contracts/interface-messages.json: {error}"),
        };
        let hint = "src/interface_messages.rs differs from the contract; \
                    run `node tools/generate-interface-messages.mjs` in packages/generator/rust";

        let messages_list = [("ko", &KO), ("en", &EN), ("ja", &JA), ("zh", &ZH)];

        for (lang, messages) in &messages_list {
            let contract_msgs = &contract["form"][lang];
            assert!(
                contract_msgs.is_object(),
                "{}: missing form.{} in contract",
                hint,
                lang
            );

            let contract_obj = contract_msgs.as_object().expect("form messages object");
            for (key, value) in contract_obj {
                let snake_key = to_snake_case(key);
                let contract_value = value
                    .as_str()
                    .unwrap_or_else(|| panic!("form.{}.{} should be a string", lang, key));

                let embedded_value = match snake_key.as_str() {
                    "move_up" => messages.move_up,
                    "move_down" => messages.move_down,
                    "add_row" => messages.add_row,
                    "copy_row" => messages.copy_row,
                    "remove_row" => messages.remove_row,
                    "toggle_row" => messages.toggle_row,
                    "expand_all" => messages.expand_all,
                    "collapse_all" => messages.collapse_all,
                    "undo" => messages.undo,
                    "redo" => messages.redo,
                    "row_controls" => messages.row_controls,
                    "collection_controls" => messages.collection_controls,
                    "form_controls" => messages.form_controls,
                    "form_actions" => messages.form_actions,
                    "submit" => messages.submit,
                    "reset" => messages.reset,
                    "outline" => messages.outline,
                    "data" => messages.data,
                    "untitled" => messages.untitled,
                    "collapsed" => messages.collapsed,
                    "count" => messages.count,
                    "children" => messages.children,
                    "condition_mode" => messages.condition_mode,
                    "condition_add_comparison" => messages.condition_add_comparison,
                    "condition_add_group" => messages.condition_add_group,
                    "condition_add_judge" => messages.condition_add_judge,
                    "condition_remove" => messages.condition_remove,
                    "condition_invalid" => messages.condition_invalid,
                    _ => panic!("unknown field: {}", snake_key),
                };

                assert_eq!(
                    embedded_value, contract_value,
                    "{}[{}][{}] mismatch: expected {}, got {}",
                    lang, key, snake_key, contract_value, embedded_value
                );
            }
        }

        // Test list messages
        let list_messages_list = [
            ("ko", &KO_LIST),
            ("en", &EN_LIST),
            ("ja", &JA_LIST),
            ("zh", &ZH_LIST),
        ];

        for (lang, list_messages) in &list_messages_list {
            let contract_msgs = &contract["list"][lang];
            assert!(
                contract_msgs.is_object(),
                "{}: missing list.{} in contract",
                hint,
                lang
            );

            let contract_obj = contract_msgs.as_object().expect("list messages object");
            for (key, value) in contract_obj {
                let snake_key = to_snake_case(key);
                let contract_value = value
                    .as_str()
                    .unwrap_or_else(|| panic!("list.{}.{} should be a string", lang, key));

                let embedded_value = match snake_key.as_str() {
                    "previous_page" => list_messages.previous_page,
                    "next_page" => list_messages.next_page,
                    "page" => list_messages.page,
                    "empty_list" => list_messages.empty_list,
                    _ => panic!("unknown field: {}", snake_key),
                };

                assert_eq!(
                    embedded_value, contract_value,
                    "{}[{}][{}] mismatch: expected {}, got {}",
                    lang, key, snake_key, contract_value, embedded_value
                );
            }
        }
    }
}
