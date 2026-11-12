use crate::choice_list::{
    choice_appearances, choice_groups, choice_label, choice_pairs, is_choice_list,
};
use crate::condition_editor::condition_editor;
use crate::messages::form_messages;
use crate::util::OrNoText;
use crate::util::*;
use serde_json::{json, Map, Value};

pub(crate) struct WidgetContext<'a> {
    pub spec: &'a Value,
    pub value: Option<&'a Value>,
    pub path: &'a str,
    pub design: &'a Value,
    pub key_prefix: Option<&'a str>,
    pub id: &'a str,
    pub language: &'a str,
    pub row_segments: &'a [usize],
}

impl WidgetContext<'_> {
    fn name(&self) -> String {
        bracket(self.path, self.key_prefix)
    }
    fn class(&self, base: &str) -> String {
        join_class(&[base, self.design["main"]["class"].as_str().or_no_text()])
    }
    fn style(&self) -> String {
        style(self.design["main"]["style"].as_str().or_no_text())
    }
    fn option(&self, key: &str) -> Option<String> {
        self.spec["options"]
            .get(key)
            .filter(|v| !v.is_null())
            .map(|v| scalar(Some(v)))
    }
    fn opt(&self, key: &str, default: &str) -> String {
        // CUSC-029: an option that the field does not declare takes the default of its widget.
        match self.option(key) {
            Some(value) => value,
            None => default.into(),
        }
    }
    fn text(&self, key: &str) -> String {
        translate(self.spec.get(key), self.language)
    }
    fn value(&self) -> String {
        default_string(self.value, self.spec)
    }
    fn script(&self, action: &str) -> String {
        let value = &self.spec["behavior"][action];
        value
            .as_str()
            .or_else(|| value["script"].as_str())
            .or_no_text()
            .into()
    }
    fn behavior(&self, attrs: &mut Map<String, Value>) {
        if let Some(map) = self.spec["behavior"].as_object() {
            for (action, _) in map {
                put_nonempty(attrs, action, self.script(action));
            }
        }
    }
    fn data_attrs(&self, attrs: &mut Map<String, Value>) {
        put_string(attrs, "data-name", leaf_name(self.path, self.row_segments));
        put_string(
            attrs,
            "data-rule-name",
            rule_name(self.path, self.row_segments),
        );
        put_string(attrs, "data-default", scalar(self.spec.get("default")));
    }
    fn affixes(&self, model: &mut Value, append: bool) {
        let text = self.text("prepend");
        if !text.is_empty() {
            let mut affix = json!({"text":text,"class":join_class(&["crudui-widget__affix",self.design["prepend"]["class"].as_str().or_no_text()])});
            let style = style(self.design["prepend"]["style"].as_str().or_no_text());
            if !style.is_empty() {
                affix["style"] = style.into();
            }
            model["prepend"] = affix;
        }
        let text = self.text("append");
        if append && !text.is_empty() {
            model["append"] = json!({"text":text,"class":"crudui-widget__affix"});
        }
    }
}

/// The widget kind of a lowercase field type, or `None` for a type without a widget.
pub(crate) fn widget_kind(name: &str) -> Option<&str> {
    Some(match name {
        "text" | "string" => "text",
        "integer" | "float" | "decimal" | "number" => "number",
        "select" | "dropdown" | "selectbox" => "select",
        "choice" | "radio" => "choice",
        "multichoice" | "checkboxes" | "checkcontainer" => "multichoice",
        "datetime-local" | "datetime" => "datetime",
        "html" | "static" | "dummy" => "dummy",
        "cover-simple" | "cover" => "cover",
        "search" | "autocomplete" => "search",
        "tinymce" | "wysiwyg" => "tinymce",
        "button" | "action" => "button",
        "range" => "range",
        "condition" => "condition",
        "email" | "password" | "textarea" | "hidden" | "date" | "dummy-input" | "image"
        | "file" | "image-viewer" | "summernote" | "editorjs" | "tui" | "tagify" | "tagify2" => {
            name
        }
        _ => return None,
    })
}

#[allow(
    clippy::expect_used,
    reason = "R-1: a constant expression, which the tests compile"
)]
static NEWLINE: std::sync::LazyLock<regex::Regex> =
    std::sync::LazyLock::new(|| regex::Regex::new(r"\r\n|\n\r|\r|\n").expect("newline pattern"));

fn source(items: &Value) -> Option<Map<String, Value>> {
    let items = items.as_object().filter(|m| m.contains_key("model"))?;
    // A source without relations writes the empty list of relations.
    let relations = match items.get("relations").filter(|v| !v.is_null()) {
        Some(relations) => json_text(relations),
        None => "[]".to_owned(),
    };
    Some(literal_members(
        json!({"data-source-model":scalar(items.get("model")),"data-source-method":scalar(items.get("method")),
        "data-source-table":scalar(items.get("table")),
        "data-source-relations":relations}),
    ))
}

fn entries(items: &Value) -> Vec<(String, &Value)> {
    if is_choice_list(items) {
        #[allow(
            clippy::disallowed_methods,
            reason = "CUSC-080: a choice list that gives no pair lists no entry"
        )]
        return choice_pairs(items, true, true).unwrap_or_default();
    }
    match items {
        Value::Array(a) => a
            .iter()
            .enumerate()
            .map(|(i, v)| (i.to_string(), v))
            .collect(),
        Value::Object(m) if !m.contains_key("model") => {
            m.iter().map(|(k, v)| (k.clone(), v)).collect()
        }
        _ => Vec::new(),
    }
}

fn options(ctx: &WidgetContext<'_>, multi: bool, choice: bool) -> Vec<Value> {
    let items = &ctx.spec["items"];
    let selected = match ctx.value.or_else(|| ctx.spec.get("default")) {
        Some(Value::Array(a)) if multi => a
            .iter()
            .map(|v| {
                if ctx.value.is_some() {
                    js_string(v)
                } else {
                    scalar(Some(v))
                }
            })
            .collect::<Vec<_>>(),
        Some(v) if multi && polyspec_crudui_validator::expr::is_truthy(v) => vec![js_string(v)],
        _ if multi => Vec::new(),
        _ => vec![ctx.value()],
    };
    let default = ctx
        .spec
        .get("default")
        .filter(|v| !v.is_array() && !v.is_null())
        .map(|v| scalar(Some(v)));
    entries(items).into_iter().map(|(key,value)| {
        let label = translate(Some(value),ctx.language);
        json!({"value":key,"label":if label.is_empty(){scalar(Some(value))}else{label},
            "selected":selected.contains(&key),"isDefault":choice && default.as_ref().is_some_and(|d| d == &key)})
    }).collect()
}

/// The one option of a select or search field with no option: value "" and the untranslated text select (CUSC-080).
fn placeholder_option() -> Value {
    json!({"value":"","label":"select","selected":false,"isDefault":false})
}

/// A string literal of a script: the string token of ordered-json with `<`, U+2028 and U+2029
/// escaped, so the literal cannot end a script element or a line of the script.
fn script_string(value: &str) -> String {
    string_token(value)
        .replace('<', "\\u003c")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}

fn format_date(value: &str, datetime: bool) -> String {
    crate::date::format(
        value,
        if datetime {
            "YYYY-MM-DDTHH:mm:ss"
        } else {
            "YYYY-MM-DD"
        },
    )
}

fn text_control(kind: &str, ctx: &WidgetContext<'_>) -> Value {
    let textarea = kind == "textarea";
    let hidden = kind == "hidden";
    let password = kind == "password";
    let dummy = kind == "dummy-input";
    let date = kind == "date" || kind == "datetime";
    let mut attrs = Map::new();
    if !textarea {
        put_string(
            &mut attrs,
            "type",
            match kind {
                "dummy-input" => "text",
                "datetime" => "datetime-local",
                _ => kind,
            },
        );
    }
    put_string(&mut attrs, "name", ctx.name());
    if !textarea {
        put_string(
            &mut attrs,
            "value",
            if date {
                format_date(&ctx.value(), kind == "datetime")
            } else if password {
                scalar(ctx.value)
            } else {
                ctx.value()
            },
        );
    }
    if kind == "number" {
        put_string(&mut attrs, "step", "any");
    }
    if dummy {
        put_string(&mut attrs, "readonly", "");
    }
    put_string(
        &mut attrs,
        "class",
        ctx.class(if hidden {
            "valid-target"
        } else if dummy {
            "crudui-input"
        } else {
            "valid-target crudui-input"
        }),
    );
    if textarea {
        put_string(&mut attrs, "rows", "5");
    }
    if !textarea && !hidden && !password && !date {
        put_nonempty(&mut attrs, "placeholder", ctx.text("placeholder"));
    }
    if !hidden {
        put_nonempty(&mut attrs, "style", ctx.style());
    }
    if !password && !hidden && !dummy {
        ctx.behavior(&mut attrs);
    }
    if dummy {
        put_string(&mut attrs, "data-default", scalar(ctx.spec.get("default")));
    } else {
        ctx.data_attrs(&mut attrs);
    }
    let layout = if hidden || password || kind == "datetime" {
        "bare"
    } else {
        "widget"
    };
    let mut model = json!({"kind":kind,"layout":layout,"tag":if textarea{"textarea"}else{"input"},"attrs":attrs});
    if textarea {
        model["text"] = ctx.value().into();
    }
    if layout == "widget" {
        ctx.affixes(&mut model, true);
    }
    model
}

fn select_control(ctx: &WidgetContext<'_>) -> Value {
    let source = source(&ctx.spec["items"]);
    let mut attrs = literal_members(
        json!({"name":ctx.name(),"class":ctx.class(if source.is_some(){"valid-target crudui-input crudui-input--select valid-target-async"}else{"valid-target crudui-input crudui-input--select"})}),
    );
    if let Some(ref source) = source {
        attrs.extend(source.clone());
    }
    put_nonempty(&mut attrs, "style", ctx.style());
    ctx.behavior(&mut attrs);
    ctx.data_attrs(&mut attrs);
    let mut options = options(ctx, false, false);
    if options.is_empty() {
        options.push(placeholder_option());
    } else if is_choice_list(&ctx.spec["items"]) {
        // An option inside a group has the position of the group in the list and its label.
        for (option, group) in options.iter_mut().zip(choice_groups(&ctx.spec["items"])) {
            if let Some((index, label)) = group {
                let text = translate(Some(label), ctx.language);
                option["group"] = json!({"index": index, "label": if text.is_empty() { scalar(Some(label)) } else { text }});
            }
        }
    }
    let mut model = json!({"kind":"select","layout":"widget","tag":"select","attrs":attrs,"source":source,"options":options});
    ctx.affixes(&mut model, true);
    model
}

fn choices(kind: &str, ctx: &WidgetContext<'_>) -> Value {
    let multi = kind == "multichoice";
    let source = source(&ctx.spec["items"]);
    // The choices element: its classes, then the class and style of `design.group`.
    let mut attrs = Map::new();
    put_string(
        &mut attrs,
        "class",
        join_class(&[
            if multi {
                "crudui-choices crudui-choices--multiple"
            } else {
                "crudui-choices"
            },
            ctx.design["group"]["class"].as_str().or_no_text(),
        ]),
    );
    put_nonempty(
        &mut attrs,
        "style",
        style(ctx.design["group"]["style"].as_str().or_no_text()),
    );
    if let Some(ref source) = source {
        attrs.extend(source.clone());
    }
    let mut model = json!({"kind":kind,"layout":"choices","attrs":attrs,"source":source,"options":options(ctx,multi,!multi),
        "itemLabelClass":ctx.class("crudui-choices__label")});
    if source.is_none() {
        let mut input = literal_members(
            json!({"name":ctx.name()+if multi{"[]"}else{""},"data-name":leaf_name(ctx.path,ctx.row_segments),"data-rule-name":rule_name(ctx.path,ctx.row_segments)}),
        );
        put_nonempty(&mut input, "onchange", ctx.script("onchange"));
        if !multi {
            put_nonempty(&mut input, "onclick", ctx.script("onclick"));
        }
        model["extra"] = json!({"input":input});
    }
    model
}

fn file_control(kind: &str, ctx: &WidgetContext<'_>) -> Value {
    let base = "valid-target crudui-input crudui-input--file";
    let mut file = literal_members(json!({"type":"file","class":ctx.class(base)}));
    for key in [
        "max_width",
        "min_width",
        "max_height",
        "min_height",
        "preview_max_width",
        "preview_max_height",
    ] {
        put_string(
            &mut file,
            &format!("data-{}", key.replace('_', "-")),
            ctx.opt(key, "0"),
        );
    }
    put_string(
        &mut file,
        "name",
        ctx.name() + if kind == "cover" { "[name]" } else { "" },
    );
    put_string(
        &mut file,
        "data-name",
        leaf_name(ctx.path, ctx.row_segments),
    );
    put_string(
        &mut file,
        "data-rule-name",
        rule_name(ctx.path, ctx.row_segments),
    );
    ctx.behavior(&mut file);
    if kind != "cover" {
        put_string(&mut file, "value", "");
    }
    let accept = ctx.spec["validate"]["accept"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    // CUSC-029: without `validate.accept` the control accepts its `accept` option or every file
    // of its kind.
    let accept = match accept {
        Some(accept) => accept,
        None => ctx.opt("accept", if kind == "file" { "*/*" } else { "image/*" }),
    };
    put_string(&mut file, "accept", accept);
    // `display` precedes `file` in the model.
    let mut extra = Map::new();
    if kind != "cover" {
        extra.insert(
            "display".into(),
            json!({"type":"text","class":"crudui-input","value":"","readonly":""}),
        );
    }
    extra.insert("file".into(), Value::Object(file));
    let mut model = json!({"kind":kind,"layout":"file","attrs":{},"extra":extra});
    ctx.affixes(&mut model, false);
    model
}

fn display(kind: &str, ctx: &WidgetContext<'_>) -> Value {
    let mut attrs = Map::new();
    put_nonempty(
        &mut attrs,
        "class",
        ctx.design["main"]["class"].as_str().or_no_text().into(),
    );
    let raw = if kind == "image-viewer" {
        match ctx
            .value
            .and_then(Value::as_array)
            .filter(|a| !a.is_empty())
        {
            Some(images) => {
                let height = ctx.opt("height", "");
                let height = if height.is_empty() {
                    String::new()
                } else {
                    format!(" height=\"{height}\"")
                };
                images
                    .iter()
                    .map(|v| format!("<img src=\"{}\"{height}>", scalar(Some(v))))
                    .collect()
            }
            None => "이미지가 없습니다.".into(),
        }
    } else {
        put_nonempty(&mut attrs, "style", ctx.style());
        let mut value = ctx.value.or_else(|| ctx.spec.get("default"));
        if is_choice_list(&ctx.spec["items"]) {
            value = choice_label(&ctx.spec["items"], &scalar(value)).or(value);
        } else if source(&ctx.spec["items"]).is_none() {
            if let Some(items) = ctx.spec["items"].as_object() {
                value = items.get(&scalar(value)).or(value);
            }
        }
        let text = scalar(value);
        NEWLINE.replace_all(&text, "<br />$0").into_owned()
    };
    json!({"kind":kind,"layout":"display","tag":"div","rawHtml":raw,"attrs":attrs})
}

fn search(ctx: &WidgetContext<'_>) -> Value {
    let id = ctx.id;
    let min = ctx.opt("keyword_min_length", "2");
    let delay = ctx.opt("delay", "250");
    let source = source(&ctx.spec["items"]);
    let mut attrs = literal_members(
        json!({"class":ctx.class(if source.is_some(){"valid-target crudui-input crudui-input--select valid-target-async"}else{"valid-target crudui-input crudui-input--select"})}),
    );
    put_nonempty(&mut attrs, "style", ctx.style());
    for (key, value) in [
        ("name", ctx.name()),
        ("data-keyword-min-length", min.clone()),
        ("data-delay", delay.clone()),
        ("data-api-server", ctx.opt("api_server", "")),
    ] {
        put_string(&mut attrs, key, value);
    }
    if let Some(ref source) = source {
        attrs.extend(source.clone());
    }
    put_string(
        &mut attrs,
        "data-name",
        leaf_name(ctx.path, ctx.row_segments),
    );
    put_string(
        &mut attrs,
        "data-rule-name",
        rule_name(ctx.path, ctx.row_segments),
    );
    put_string(&mut attrs, "id", id);
    put_nonempty(&mut attrs, "onchange", ctx.script("onchange"));
    put_string(&mut attrs, "data-default", scalar(ctx.spec.get("default")));
    let callback = ctx.opt("callback", "");
    let callback = if callback.is_empty() {
        String::new()
    } else {
        format!(
            "$(document.getElementById({})).on('select2:select', {callback});",
            script_string(id)
        )
    };
    let dropdown_class = format!("{id}_select2");
    let style = if ctx.option("hide_searching").as_deref() != Some("") {
        format!(
            "[class~={}] .loading-results {{ display: none; }}",
            script_string(&dropdown_class)
        )
    } else {
        String::new()
    };
    let mut options = options(ctx, false, false);
    if options.is_empty() {
        options.push(placeholder_option());
    }
    let mut model = json!({"kind":"search","layout":"search","tag":"select","attrs":attrs,"source":source,"options":options,
        "script":format!("$(function() {{select2(CSS.escape({}), {}, {}, {});{callback}}});",script_string(id),script_string(&min),script_string(&delay),script_string(&dropdown_class)),"styleChrome":style});
    ctx.affixes(&mut model, true);
    model
}

fn editor(kind: &str, ctx: &WidgetContext<'_>) -> Value {
    let tagify = kind.starts_with("tagify");
    let id = ctx.id;
    let selector = format!("'#'+CSS.escape({})", script_string(id));
    let base = match kind {
        "tinymce" => "valid-target crudui-input tinymcearea",
        "summernote" => "valid-target crudui-input summernote",
        "editorjs" => "valid-target crudui-input contentjs",
        "tui" => "valid-target crudui-input tuiarea",
        _ => "valid-target crudui-input",
    };
    let mut attrs = Map::new();
    if tagify {
        put_string(&mut attrs, "type", "text");
    }
    put_string(&mut attrs, "id", id);
    put_string(&mut attrs, "class", ctx.class(base));
    put_string(&mut attrs, "name", ctx.name());
    if tagify {
        put_string(&mut attrs, "value", ctx.value());
    } else {
        put_string(
            &mut attrs,
            "rows",
            ctx.opt("rows", if kind == "summernote" { "5" } else { "3" }),
        );
    }
    let script = match kind {
        "tinymce" => {
            let height = ctx.opt("height", "300");
            let upload = ctx.opt("fileserver", "upload");
            put_string(
                &mut attrs,
                "data-type",
                // An editor field always names its type.
                ctx.spec["type"].as_str().or_no_text(),
            );
            put_string(&mut attrs, "data-height", &height);
            put_string(&mut attrs, "data-upload-server", &upload);
            format!(
                "$(function() {{editor_tinymce({selector}, {height}, {}, false);}});",
                script_string(&upload)
            )
        }
        "summernote" => format!(
            "$(function() {{editor_summernote({selector}, {});}});",
            script_string(&ctx.opt("upload", "upload"))
        ),
        "editorjs" | "tui" => {
            let server = ctx.opt("fileserver", "");
            put_string(&mut attrs, "data-fileserver", &server);
            format!(
                "$(function() {{editor_{kind}({selector}, {});}});",
                script_string(&server)
            )
        }
        _ => {
            let max = ctx.opt("max_tags", "0");
            put_string(&mut attrs, "data-max-tags", &max);
            let server = if kind == "tagify2" {
                let server = ctx.opt("server", "");
                put_string(&mut attrs, "data-server", &server);
                format!(", {}", script_string(&server))
            } else {
                String::new()
            };
            put_nonempty(&mut attrs, "placeholder", ctx.text("placeholder"));
            format!("$(function() {{editor_{kind}({selector}, {max}{server});}});")
        }
    };
    ctx.behavior(&mut attrs);
    ctx.data_attrs(&mut attrs);
    let mut model = json!({"kind":kind,"layout":"host-script","tag":if tagify{"input"}else{"textarea"},"attrs":attrs,"script":script});
    if !tagify {
        model["text"] = ctx.value().into();
    }
    model
}

/// A range input with the bounds and the step of its required `validate.range` and
/// `validate.step`; compilation has checked them.
fn range(ctx: &WidgetContext<'_>) -> Value {
    let validate = &ctx.spec["validate"];
    let value = ctx.value();
    let mut attrs = Map::new();
    put_string(&mut attrs, "type", "range");
    put_string(&mut attrs, "name", ctx.name());
    put_string(&mut attrs, "value", &value);
    put_string(&mut attrs, "min", scalar(Some(&validate["range"][0])));
    put_string(&mut attrs, "max", scalar(Some(&validate["range"][1])));
    put_string(&mut attrs, "step", scalar(Some(&validate["step"])));
    put_string(
        &mut attrs,
        "class",
        ctx.class("valid-target crudui-input crudui-input--range"),
    );
    put_nonempty(&mut attrs, "style", ctx.style());
    ctx.behavior(&mut attrs);
    ctx.data_attrs(&mut attrs);
    let mut model =
        json!({"kind":"range","layout":"range","tag":"input","attrs":attrs,"text":value});
    ctx.affixes(&mut model, true);
    model
}

/// A condition field: a textarea holding the condition text of its tree, marked for the browser
/// bindings that decode it (docs/spec/form-markup.md, Condition fields).
fn condition(ctx: &WidgetContext<'_>) -> Value {
    let default = ctx.spec.get("default");
    let mut attrs = Map::new();
    put_string(&mut attrs, "name", ctx.name());
    put_string(
        &mut attrs,
        "class",
        ctx.class("valid-target crudui-input crudui-input--condition"),
    );
    put_string(&mut attrs, "rows", "5");
    put_string(&mut attrs, "data-crudui-value", "json");
    put_nonempty(&mut attrs, "style", ctx.style());
    ctx.behavior(&mut attrs);
    ctx.data_attrs(&mut attrs);
    put_string(&mut attrs, "data-default", condition_text(default));
    let value = ctx.value.or(default);
    let text = condition_text(value);
    let structured = ctx.spec["design"]["editor"].as_str() == Some("structured");
    // A structured editor (docs/spec/form-markup.md, Structured condition editor): the textarea keeps the value,
    // hidden while the editor shows it (CUMK-067), visible with a named error otherwise (CUMK-068).
    let editor = structured.then(|| {
        #[allow(
            clippy::expect_used,
            reason = "R-1: binding checked the language before it evaluates a field"
        )]
        let messages = form_messages(ctx.language).expect("a bound form has a supported language");
        condition_editor(value, ctx.id, ctx.spec, ctx.path, messages)
    });
    if editor
        .as_ref()
        .is_some_and(|editor| editor.get("error").is_none())
    {
        put_string(&mut attrs, "hidden", "");
    }
    let layout = if structured { "condition" } else { "widget" };
    let mut model =
        json!({"kind":"condition","layout":layout,"tag":"textarea","attrs":attrs,"text":text});
    ctx.affixes(&mut model, true);
    if let Some(editor) = editor {
        model["condition"] = editor;
    }
    model
}

/// A button element with the content text; behavior scripts are its event attributes.
fn button(ctx: &WidgetContext<'_>) -> Value {
    let mut attrs = Map::new();
    put_string(&mut attrs, "type", "button");
    put_string(
        &mut attrs,
        "class",
        ctx.class("crudui-action crudui-action--text"),
    );
    put_nonempty(&mut attrs, "style", ctx.style());
    put_string(&mut attrs, "id", ctx.id);
    ctx.behavior(&mut attrs);
    let text = if ctx.spec.get("content").is_some() {
        ctx.text("content")
    } else {
        String::new()
    };
    json!({"kind":"button","layout":"button","tag":"button","attrs":attrs,"text":text})
}

pub(crate) fn evaluate_widget(field_type: &str, ctx: &WidgetContext<'_>) -> Option<Value> {
    let lower = field_type.to_lowercase();
    let kind = widget_kind(&lower)?;
    let mut model = match kind {
        "select" => select_control(ctx),
        "choice" | "multichoice" => choices(kind, ctx),
        "image" | "file" | "cover" => file_control(kind, ctx),
        "dummy" | "image-viewer" => display(kind, ctx),
        "search" => search(ctx),
        "tinymce" | "summernote" | "editorjs" | "tui" | "tagify" | "tagify2" => editor(kind, ctx),
        "button" => button(ctx),
        "range" => range(ctx),
        "condition" => condition(ctx),
        _ => text_control(kind, ctx),
    };
    let id = ctx.id.to_owned();
    if model["tag"]
        .as_str()
        .is_some_and(|t| ["input", "select", "textarea"].contains(&t))
    {
        model["attrs"]["id"] = id.clone().into();
    }
    if model["extra"].get("file").is_some() {
        model["extra"]["file"]["id"] = id.clone().into();
    }
    if model["layout"] == "choices" {
        for (i, option) in model["options"]
            .as_array_mut()
            .into_iter()
            .flatten()
            .enumerate()
        {
            option["id"] = format!("{id}:{i}").into();
        }
        // The appearance of each choice follows its id.
        if is_choice_list(&ctx.spec["items"]) {
            let appearances = choice_appearances(&ctx.spec["items"]);
            for (option, appearance) in model["options"]
                .as_array_mut()
                .into_iter()
                .flatten()
                .zip(appearances)
            {
                if let Some(option) = option.as_object_mut() {
                    option.extend(appearance);
                }
            }
        }
    }
    // Declared control attributes follow the attributes crudui writes on the control.
    if let Some(attributes) = declared_attributes(ctx.spec, false) {
        if model["layout"] == "choices" {
            if model["extra"].get("input").is_some() {
                model["extra"]["option"] = attributes.into();
            }
        } else if let Some(file) = model
            .get_mut("extra")
            .and_then(|extra| extra.get_mut("file"))
            .and_then(Value::as_object_mut)
        {
            file.extend(attributes);
        } else if let Some(attrs) = model["attrs"].as_object_mut() {
            attrs.extend(attributes);
        }
    }
    Some(ordered_widget(model))
}

/// The declared control attributes (`design.attributes`) or, with `wrapper`, the node root
/// attributes (`design.wrapper.attributes`) of a field; `None` when none is declared.
pub(crate) fn declared_attributes(spec: &Value, wrapper: bool) -> Option<Map<String, Value>> {
    let design = &spec["design"];
    let attributes = if wrapper {
        &design["wrapper"]["attributes"]
    } else {
        &design["attributes"]
    };
    attributes.as_object().filter(|a| !a.is_empty()).cloned()
}

/// Widget model members in output order.
pub(crate) const WIDGET_MEMBERS: [&str; 15] = [
    "kind",
    "layout",
    "tag",
    "attrs",
    "text",
    "rawHtml",
    "source",
    "options",
    "itemLabelClass",
    "script",
    "styleChrome",
    "prepend",
    "append",
    "extra",
    "condition",
];

/// The widget with its members in output order.
fn ordered_widget(model: Value) -> Value {
    let Value::Object(mut members) = model else {
        return model;
    };
    let mut ordered = Map::new();
    for key in WIDGET_MEMBERS {
        if let Some(value) = members.remove(key) {
            ordered.insert(key.into(), value);
        }
    }
    debug_assert!(members.is_empty(), "unordered widget members: {members:?}");
    ordered.extend(members);
    Value::Object(ordered)
}
