use crate::form_render::{render_model, NodeErrors, RenderModel};
use crate::util::OrNoList;
use crate::util::OrNoMembers;
use crate::util::OrNoText;
use serde_json::{json, Map, Value};

use crate::util::{join_class, js_string, scalar, style};
use crate::{Form, FormResult};

pub(crate) fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

pub(crate) fn raw_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

pub(crate) fn raw_attribute(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
}

fn attributes(attrs: &Value, raw: bool) -> String {
    let Some(attrs) = attrs.as_object() else {
        return String::new();
    };
    attrs
        .iter()
        .map(|(key, value)| {
            let value = scalar(Some(value));
            let value = if raw {
                raw_attribute(&value)
            } else {
                escape(&value)
            };
            let key = if raw {
                key.as_str()
            } else {
                match key.as_str() {
                    "autocomplete" => "autoComplete",
                    "readonly" => "readOnly",
                    "maxlength" => "maxLength",
                    "minlength" => "minLength",
                    "colspan" => "colSpan",
                    "rowspan" => "rowSpan",
                    _ => key.as_str(),
                }
            };
            format!(" {key}=\"{value}\"")
        })
        .collect()
}

#[allow(
    clippy::expect_used,
    reason = "R-1: a constant expression, which the tests compile"
)]
static JAVASCRIPT_URL: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
    regex::RegexBuilder::new(r"^[\x00-\x1f ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:")
        .case_insensitive(true)
        .unicode(false)
        .build()
        .expect("URL scheme pattern")
});

pub(crate) fn sanitize_url(url: &str) -> String {
    let pattern = &*JAVASCRIPT_URL;
    if pattern.is_match(url) {
        "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')".into()
    } else {
        url.into()
    }
}

pub(crate) fn element(tag: &str, attrs: &Value, content: &str) -> String {
    let mut attrs = attrs.as_object().cloned().or_no_members();
    if let Some(value) = attrs.get("style").and_then(Value::as_str) {
        let value = crate::css::render_style(value);
        if value.is_empty() {
            attrs.shift_remove("style");
        } else {
            attrs.insert("style".into(), value.into());
        }
    }
    for key in ["href", "src"] {
        if let Some(value) = attrs.get(key).and_then(Value::as_str) {
            if key == "src" && value.is_empty() {
                attrs.shift_remove(key);
            } else {
                attrs.insert(key.into(), sanitize_url(value).into());
            }
        }
    }
    for key in ["readonly", "disabled", "required", "multiple", "autofocus"] {
        if attrs.contains_key(key) {
            attrs.insert(key.into(), "".into());
        }
    }
    if tag == "input" {
        for key in ["name", "checked", "value"] {
            if let Some(value) = attrs.shift_remove(key) {
                attrs.insert(key.into(), value);
            }
        }
    } else if matches!(tag, "select" | "textarea") {
        attrs.shift_remove("value");
    }
    let attributes = attributes(&attrs.into(), false);
    if matches!(tag, "input" | "img" | "br" | "hr" | "link") {
        format!("<{tag}{attributes}/>")
    } else {
        let leading_newline = if tag == "textarea" && content.starts_with('\n') {
            "\n"
        } else {
            ""
        };
        format!("<{tag}{attributes}>{leading_newline}{content}</{tag}>")
    }
}

pub(crate) fn raw_element(tag: &str, attrs: &Value, content: &str) -> String {
    let attributes = attributes(attrs, true);
    if matches!(tag, "input" | "img" | "br" | "hr" | "link") {
        format!("<{tag}{attributes}>")
    } else {
        format!("<{tag}{attributes}>{content}</{tag}>")
    }
}

fn has_events(attrs: &Value) -> bool {
    attrs.as_object().into_iter().flatten().any(|(key, _)| {
        key.strip_prefix("on")
            .and_then(|rest| rest.bytes().next())
            .is_some_and(|byte| byte.is_ascii_lowercase())
    })
}

fn str_at<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().or_no_text()
}

pub(crate) fn appearance_attrs(class: String, inline: &str) -> Value {
    let mut attrs = Map::new();
    if !class.is_empty() {
        attrs.insert("class".into(), class.into());
    }
    let inline = style(inline);
    if !inline.is_empty() {
        attrs.insert("style".into(), inline.into());
    }
    attrs.into()
}

fn affix(affix: &Value, raw: bool) -> String {
    if !affix.is_object() {
        return String::new();
    }
    let element = if raw { raw_element } else { element };
    let text = if raw { raw_text } else { escape };
    element(
        "span",
        &appearance_attrs(str_at(affix, "class").into(), str_at(affix, "style")),
        &text(str_at(affix, "text")),
    )
}

fn control(widget: &Value, search: bool) -> String {
    #[allow(
        clippy::disallowed_methods,
        reason = "CURP-024: a widget model without a tag is an input, as every renderer reads the model"
    )]
    let tag = widget["tag"].as_str().unwrap_or("input");
    let raw = search || widget["layout"] == "condition" || has_events(&widget["attrs"]);
    let text = if raw { raw_text } else { escape };
    let render = if raw { raw_element } else { element };
    let content = if tag == "select" {
        let option = |option: &Value| {
            let mut attrs = json!({"value":option["value"]});
            if option["selected"] == true {
                attrs["selected"] = if search { "selected" } else { "" }.into();
            }
            render("option", &attrs, &text(str_at(option, "label")))
        };
        // The options of one group run inside one optgroup element.
        let mut content = String::new();
        let options = widget["options"].as_array().or_no_list();
        let mut start = 0;
        while start < options.len() {
            let group = options[start].get("group");
            let end = start
                + options[start..]
                    .iter()
                    .take_while(|o| {
                        o.get("group").map(|g| &g["index"]) == group.map(|g| &g["index"])
                    })
                    .count();
            let run: String = options[start..end].iter().map(option).collect();
            content += &match group {
                Some(group) => render("optgroup", &json!({"label":group["label"]}), &run),
                None => run,
            };
            start = end;
        }
        content
    } else {
        text(str_at(widget, "text"))
    };
    let attrs = if raw {
        widget["attrs"].clone()
    } else {
        style_last(&widget["attrs"])
    };
    render(tag, &attrs, &content)
}

/// The attributes with `style` moved last, as an ordinary control writes them.
fn style_last(attrs: &Value) -> Value {
    let mut attrs = attrs.clone();
    if let Some(style) = attrs
        .as_object_mut()
        .and_then(|attrs| attrs.shift_remove("style"))
    {
        attrs["style"] = style;
    }
    attrs
}

fn script(text: &str) -> String {
    element("script", &json!({"nonce":""}), text)
}

fn widget(model: &Value) -> String {
    if model["unsupported"] == true {
        return element(
            "div",
            &json!({"class":"crudui-widget crudui-widget--unsupported","data-unsupported-type":model["type"]}),
            "",
        );
    }
    match str_at(model, "layout") {
        "widget" => element(
            "div",
            &json!({"class":"crudui-widget"}),
            &(affix(&model["prepend"], has_events(&model["attrs"]))
                + &control(model, false)
                + &affix(&model["append"], has_events(&model["attrs"]))),
        ),
        "bare" => control(model, false),
        "range" => {
            let raw = has_events(&model["attrs"]);
            let mut attrs = json!({"class":"crudui-widget__output"});
            if let Some(id) = model["attrs"].get("id") {
                attrs["for"] = id.clone();
            }
            let label = str_at(model, "text");
            let output = if raw {
                raw_element("output", &attrs, &raw_text(label))
            } else {
                element("output", &attrs, &escape(label))
            };
            element(
                "div",
                &json!({"class":"crudui-widget crudui-widget--range"}),
                &(affix(&model["prepend"], raw)
                    + &control(model, false)
                    + &output
                    + &affix(&model["append"], raw)),
            )
        }
        "host-script" => control(model, false) + &script(str_at(model, "script")),
        "choices" => {
            let radio = model["kind"] == "choice";
            let content = model["options"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|option| {
                    let mut attrs = model["extra"]["input"].as_object().cloned().or_no_members();
                    attrs.insert(
                        "type".into(),
                        if radio { "radio" } else { "checkbox" }.into(),
                    );
                    attrs.insert("value".into(), option["value"].clone());
                    attrs.insert("autocomplete".into(), "off".into());
                    attrs.insert("class".into(), "valid-target crudui-choices__input".into());
                    if option["id"].is_string() {
                        attrs.insert("id".into(), option["id"].clone());
                    }
                    if radio {
                        attrs.insert(
                            "data-is-default".into(),
                            if option["isDefault"] == true { "1" } else { "" }.into(),
                        );
                    }
                    if option["selected"] == true {
                        attrs.insert("checked".into(), "".into());
                    }
                    if let Some(declared) = model["extra"]["option"].as_object() {
                        attrs.extend(declared.clone());
                    }
                    // A choice attribute named like a control attribute keeps that position.
                    if let Some(declared) = option["attributes"].as_object() {
                        attrs.extend(declared.clone());
                    }
                    let mut label = json!({"for":option["id"],"class":join_class(&[
                        str_at(model, "itemLabelClass"),
                        str_at(option, "className"),
                    ])});
                    if let Some(inline) = option.get("style") {
                        label["style"] = inline.clone();
                    }
                    let raw = has_events(&model["extra"]["input"]);
                    let input = if raw { raw_element } else { element };
                    let text = if raw { raw_text } else { escape };
                    input("input", &attrs.into(), "")
                        + &input(
                            "label",
                            &label,
                            &input("span", &json!({}), &text(str_at(option, "label"))),
                        )
                })
                .collect::<String>();
            element("div", &model["attrs"], &content)
        }
        "file" => {
            let raw = has_events(&model["extra"]["file"]);
            let input = if raw { raw_element } else { element };
            let mut content = affix(&model["prepend"], raw);
            if model["extra"]["display"].is_object() {
                let display = if raw {
                    json!({"class":model["extra"]["display"]["class"],"readonly":"","type":"text","value":""})
                } else {
                    model["extra"]["display"].clone()
                };
                content += &input("input", &display, "");
            }
            content += &input("input", &model["extra"]["file"], "");
            if model["extra"]["display"].is_object() {
                content += &element(
                    "button",
                    &json!({"class":"crudui-widget__button","type":"button"}),
                    "&nbsp;",
                );
            }
            element("div", &json!({"class":"crudui-widget"}), &content)
        }
        "display" => element(
            "div",
            &style_last(&model["attrs"]),
            str_at(model, "rawHtml"),
        ),
        "search" => {
            let mut content = String::new();
            if !str_at(model, "styleChrome").is_empty() {
                content += &element("style", &json!({"nonce":""}), str_at(model, "styleChrome"));
            }
            content += &script(str_at(model, "script"));
            content
                + &element(
                    "div",
                    &json!({"class":"crudui-widget crudui-widget--search"}),
                    &(affix(&model["prepend"], true)
                        + &control(model, true)
                        + &affix(&model["append"], true)),
                )
        }
        "button" => {
            if has_events(&model["attrs"]) {
                raw_element("button", &model["attrs"], &raw_text(str_at(model, "text")))
            } else {
                element(
                    "button",
                    &style_last(&model["attrs"]),
                    &escape(str_at(model, "text")),
                )
            }
        }
        "condition" => condition_widget(model),
        _ => String::new(),
    }
}

/// A structured condition widget (docs/spec/form-markup.md, Structured condition editor): the prepend affix, the
/// named error of a value that the editor does not show, the textarea, the editor of a value that it shows and the
/// append affix.
fn condition_widget(model: &Value) -> String {
    let raw = true;
    let editor = &model["condition"];
    let mut content = affix(&model["prepend"], raw);
    if let Some(error) = editor.get("error") {
        content += &raw_element(
            "p",
            &json!({"class":"crudui-condition__error","role":"alert"}),
            &raw_text(error.as_str().or_no_text()),
        );
    }
    content += &control(model, false);
    if editor.get("error").is_none() {
        content += &raw_element(
            "div",
            &json!({"class":"crudui-condition","data-condition-for":editor["for"]}),
            &condition_node(&editor["root"], editor),
        );
    }
    raw_element(
        "div",
        &json!({"class":"crudui-widget crudui-widget--condition"}),
        &(content + &affix(&model["append"], raw)),
    )
}

fn condition_button(action: &str, label: &Value) -> String {
    raw_element(
        "button",
        &json!({"type":"button","class":"crudui-action crudui-action--text","data-condition-action":action}),
        &raw_text(label.as_str().or_no_text()),
    )
}

fn condition_select(attrs: &Value, choices: &[&str], selected: &str) -> String {
    let options: String = choices
        .iter()
        .map(|choice| {
            let mut option = json!({"value":choice});
            if *choice == selected {
                option["selected"] = "".into();
            }
            raw_element("option", &option, &raw_text(choice))
        })
        .collect();
    raw_element("select", attrs, &options)
}

/// One condition of the editor: a group, a field comparison or a judged text (CUMK-067).
fn condition_node(node: &Value, editor: &Value) -> String {
    let labels = &editor["labels"];
    let path = str_at(node, "path");
    let remove = if path.is_empty() {
        String::new()
    } else {
        condition_button("remove", &labels["remove"])
    };
    match str_at(node, "kind") {
        "group" => {
            let items: String = node["items"]
                .as_array()
                .or_no_list()
                .iter()
                .map(|item| {
                    raw_element(
                        "li",
                        &json!({"class":"crudui-condition__item"}),
                        &condition_node(item, editor),
                    )
                })
                .collect();
            let judge = if editor["judge"] == true {
                condition_button("add-judge", &labels["addJudge"])
            } else {
                String::new()
            };
            raw_element(
                "fieldset",
                &json!({"class":"crudui-condition__group","data-condition-path":path}),
                &(condition_select(
                    &json!({"class":"crudui-condition__mode","data-condition-part":"mode","aria-label":labels["mode"]}),
                    &["all", "any"],
                    str_at(node, "mode"),
                ) + &raw_element("ol", &json!({"class":"crudui-condition__list"}), &items)
                    + &condition_button("add-comparison", &labels["addComparison"])
                    + &condition_button("add-group", &labels["addGroup"])
                    + &judge
                    + &remove),
            )
        }
        "judge" => raw_element(
            "div",
            &json!({"class":"crudui-condition__judge","data-condition-path":path}),
            &(raw_element(
                "input",
                &json!({"class":"crudui-condition__text","data-condition-part":"judge","value":node["text"]}),
                "",
            ) + &remove),
        ),
        _ => {
            let field = str_at(node, "field");
            let control = match editor["fields"].as_array() {
                Some(names) => {
                    let mut choices: Vec<&str> = names.iter().filter_map(Value::as_str).collect();
                    if !choices.contains(&field) {
                        choices.insert(0, field);
                    }
                    condition_select(
                        &json!({"class":"crudui-condition__field","data-condition-part":"field"}),
                        &choices,
                        field,
                    )
                }
                None => raw_element(
                    "input",
                    &json!({"class":"crudui-condition__field","data-condition-part":"field","value":field}),
                    "",
                ),
            };
            raw_element(
                "div",
                &json!({"class":"crudui-condition__comparison","data-condition-path":path}),
                &(control
                    + &condition_select(
                        &json!({"class":"crudui-condition__op","data-condition-part":"op"}),
                        &crate::condition_editor::CONDITION_OPS,
                        str_at(node, "op"),
                    )
                    + &raw_element(
                        "input",
                        &json!({"class":"crudui-condition__value","data-condition-part":"value","value":node["value"]}),
                        "",
                    )
                    + &remove),
            )
        }
    }
}

fn classes(parts: &[&str]) -> String {
    parts
        .iter()
        .filter(|part| !part.is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join(" ")
}

/// A present model part as text: strings verbatim, other values as JavaScript strings.
fn part_text(value: &Value) -> String {
    escape(&js_string(value))
}

/// One control group of `data-crudui-action` buttons.
pub(crate) fn controls(controls: &Value) -> String {
    let buttons = controls["actions"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|action| {
            let mut attrs = json!({"type":"button","class":"crudui-action","data-crudui-action":action["name"],"aria-label":action["label"]});
            if action["disabled"] == true {
                attrs["aria-disabled"] = "true".into();
            }
            element("button", &attrs, "")
        })
        .collect::<String>();
    element(
        "div",
        &json!({"class":"crudui-controls","role":"group","aria-label":controls["label"]}),
        &buttons,
    )
}

fn header(node: &Value) -> String {
    let header = &node["header"];
    let mut parts = String::new();
    if node["collapsible"] == true {
        let mut attrs = json!({"type":"button","class":"crudui-action","data-crudui-action":"toggle-row",
            "aria-expanded": (node["expanded"] == true).to_string()});
        if let Some(id) = node["body"]["id"].as_str() {
            attrs["aria-controls"] = id.into();
        }
        if let Some(label) = node["toggleLabel"].as_str() {
            attrs["aria-label"] = label.into();
        }
        parts += &element("button", &attrs, "");
    }
    if let Some(label) = header.get("label") {
        parts += &match header.get("labelFor").and_then(Value::as_str) {
            Some(target) if !target.is_empty() => element(
                "label",
                &json!({"class":"crudui-node__label","for":target}),
                &part_text(label),
            ),
            _ => element(
                "span",
                &json!({"class":"crudui-node__label"}),
                &part_text(label),
            ),
        };
    }
    if let Some(description) = header.get("description") {
        parts += &element(
            "p",
            &json!({"class":"crudui-node__description"}),
            &part_text(description),
        );
    }
    for key in ["number", "title"] {
        if let Some(value) = header.get(key) {
            parts += &element(
                "span",
                &json!({"class":format!("crudui-node__{key}")}),
                &part_text(value),
            );
        }
    }
    if let Some(summary) = header.get("summary") {
        let mut attrs = json!({"class":"crudui-node__summary"});
        if node["expanded"] == true {
            attrs["hidden"] = "".into();
        }
        parts += &element("span", &attrs, &part_text(summary));
    }
    if let Some(count) = header.get("count") {
        parts += &element(
            "span",
            &json!({"class":"crudui-node__count"}),
            &part_text(count),
        );
    }
    if node["controls"]["placement"] == "header" {
        parts += &controls(&node["controls"]);
    }
    if parts.is_empty() {
        return String::new();
    }
    element(
        "div",
        &json!({"class":classes(&["crudui-node__header", str_at(header, "className")]),"style":str_at(header, "style")}),
        &parts,
    )
}

fn body(node: &Value, errors: &NodeErrors) -> String {
    let body = &node["body"];
    let mut attrs = json!({"class":classes(&["crudui-node__body", str_at(body, "className")]),"style":str_at(body, "style")});
    if let Some(id) = body["id"].as_str().filter(|id| !id.is_empty()) {
        attrs["id"] = id.into();
    }
    if node["collapsible"] == true && node["expanded"] != true {
        attrs["hidden"] = "".into();
    }
    let content = if node["checkbox"].is_object() {
        let checkbox = &node["checkbox"];
        let mut input = json!({"class":checkbox["className"],"id":checkbox["id"],"name":checkbox["name"],"type":"checkbox"});
        if let Some(role) = checkbox.get("role") {
            input["role"] = role.clone();
        }
        input["value"] = "1".into();
        if checkbox["checked"] == true {
            input["checked"] = "".into();
        }
        if let (Some(input), Some(declared)) =
            (input.as_object_mut(), checkbox["attributes"].as_object())
        {
            input.extend(declared.clone());
        }
        // An inline layout writes the label in the header, so the checkbox has no caption.
        let caption = match checkbox.get("caption") {
            Some(caption) => element(
                "label",
                &json!({"for":checkbox["id"]}),
                &escape(caption.as_str().or_no_text()),
            ),
            None => String::new(),
        };
        element("input", &input, "") + &caption
    } else if node.get("widget").is_some() {
        widget(&node["widget"])
    } else {
        nodes(&node["children"], errors)
    };
    element("div", &attrs, &content)
}

/// The errors slot of a block: one paragraph per message, present only with messages.
fn errors_html(block: &str, messages: Option<&Vec<String>>) -> String {
    let Some(messages) = messages.filter(|messages| !messages.is_empty()) else {
        return String::new();
    };
    let paragraphs: String = messages
        .iter()
        .map(|text| {
            element(
                "p",
                &json!({"class": format!("{block}__error")}),
                &escape(text),
            )
        })
        .collect();
    element(
        "div",
        &json!({"class": format!("{block}__errors")}),
        &paragraphs,
    )
}

/// Render one node of the recursive form grammar; `errors` holds the node errors.
fn node(node: &Value, errors: &NodeErrors) -> String {
    let kind = str_at(node, "kind");
    let modifier = format!("crudui-node--{kind}");
    let sticky = if node["sticky"] == true {
        "crudui-node--sticky"
    } else {
        ""
    };
    // A sticky row carries its depth on the root; the stylesheet derives its sticky line from it.
    let depth = if node["sticky"] == true {
        format!("--crudui-sticky-depth: {}", node["stickyDepth"])
    } else {
        String::new()
    };
    let style = [str_at(node, "style"), depth.as_str()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("; ");
    let mut attrs = json!({"class":classes(&["crudui-node", &modifier, sticky, str_at(node, "className")]),"style":style});
    if kind != "row" && kind != "lang-item" {
        if let Some(path) = node.get("path") {
            attrs["data-field-path"] = js_string(path).into();
        }
    }
    if let Some(key) = node.get("key") {
        attrs["data-crudui-row-key"] = js_string(key).into();
    }
    if let Some(lang) = node.get("lang") {
        attrs["data-lang"] = js_string(lang).into();
    }
    if node["hidden"] == true {
        attrs["hidden"] = "".into();
    }
    if let (Some(attrs), Some(declared)) = (attrs.as_object_mut(), node["attributes"].as_object()) {
        attrs.extend(declared.clone());
    }
    let footer = if node["controls"]["placement"] == "footer" {
        element(
            "div",
            &json!({"class":"crudui-node__footer"}),
            &controls(&node["controls"]),
        )
    } else {
        String::new()
    };
    let header_html = header(node);
    let header_slot = if node["sticky"] == true && !header_html.is_empty() {
        element(
            "div",
            &json!({"class":"crudui-node__header-container"}),
            &header_html,
        )
    } else {
        header_html
    };
    let errors_slot = errors_html("crudui-node", errors.get(&(node as *const Value)));
    element(
        "div",
        &attrs,
        &(header_slot + &body(node, errors) + &errors_slot + &footer),
    )
}

fn nodes(nodes: &Value, errors: &NodeErrors) -> String {
    nodes
        .as_array()
        .into_iter()
        .flatten()
        .map(|child| node(child, errors))
        .collect()
}

/// Render the `crudui-form` block without its footer: the translated root description when it
/// is not empty, form errors and the top-level nodes.
pub(crate) fn render_fields(fields: &[Value], model: &RenderModel, description: &str) -> String {
    let description = if description.is_empty() {
        String::new()
    } else {
        element(
            "p",
            &json!({"class":"crudui-form__description"}),
            &escape(description),
        )
    };
    element(
        "div",
        &json!({"class":"crudui-form"}),
        &(description
            + &errors_html("crudui-form", Some(&model.form_errors))
            + &element(
                "div",
                &json!({"class":"crudui-form__body"}),
                &fields
                    .iter()
                    .map(|field| node(field, &model.node_errors))
                    .collect::<String>(),
            )),
    )
}

/// Render fields and the form buttons for a record as the complete form of `model`.
pub(crate) fn render_form_html(
    fields: &[Value],
    buttons: &[Value],
    description: &str,
    language: &str,
    model: &RenderModel,
) -> FormResult<String> {
    let messages = crate::messages::form_messages(language)?;
    let body = render_fields(fields, model, description);
    let footer = element(
        "div",
        &json!({"class":"crudui-form__footer"}),
        &element(
            "div",
            &json!({"class":"crudui-controls","role":"group","aria-label":messages.form_actions}),
            &crate::buttons::buttons_markup(buttons)?,
        ),
    );
    // render_fields writes an element, which ends with its closing tag.
    let body = match body.strip_suffix("</div>") {
        Some(open) => open,
        None => body.as_str(),
    };
    let block = format!("{body}{footer}</div>");
    let Some(attrs) = &model.form else {
        return Ok(block);
    };
    let hidden: String = model
        .hidden
        .iter()
        .map(|(name, value)| {
            element(
                "input",
                &json!({"type":"hidden","name":name,"value":value}),
                "",
            )
        })
        .collect();
    Ok(element(
        "form",
        &Value::Object(attrs.clone()),
        &(hidden + &block),
    ))
}

/// Render an instance as the complete form without executing scripts or browser operations
/// (form-runtime.md, "Complete form"). `options` is `None` or an object with the optional members
/// `action`, `hidden`, `formErrors` and `errors`; `None` writes the `crudui-form` block alone.
pub fn render_form(form: &Form, options: Option<&Value>) -> FormResult<String> {
    let model = render_model(form.fields(), form.template().action.as_ref(), options)?;
    render_form_html(
        form.fields(),
        form.buttons(),
        &form.description(),
        form.language(),
        &model,
    )
}

/// Render the complete form of evaluated nodes and form buttons, as `bind_form`, `bind_buttons`
/// and the translated root description give them, for data owned outside an instance (CUMK-073).
/// `options` is as for [`render_form`]; its `action` has no template action here.
pub fn render_form_view(
    fields: &[Value],
    buttons: &[Value],
    language: &str,
    options: Option<&Value>,
    description: &str,
) -> FormResult<String> {
    let model = render_model(fields, None, options)?;
    render_form_html(fields, buttons, description, language, &model)
}
