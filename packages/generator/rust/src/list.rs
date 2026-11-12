use crate::util::{OrNoList, OrNoText};
use polyspec_crudui_validator::compose::{
    compose_properties, member_ordered, ComposeOptions, FileLoader, MemoryLoader,
};
use polyspec_crudui_validator::scan_forbidden_keys;
use serde_json::{json, Map, Value};

use crate::choice_list::{choice_label, is_choice_list};
use crate::design::{appearance, flag, resolve_design};
use crate::display_declaration::check_display_declarations;
use crate::messages::{format_page, list_messages};
use crate::render::{appearance_attrs, element, escape, raw_element, raw_text};
use crate::template::check_known_keys;
use crate::util::{join_class, scalar, segments, translate, value_at};
use crate::{FormError, FormResult};

/// Composition, language, display context and pagination inputs for a list.
pub struct ListOptions<'a> {
    /// Parsed documents available to composition.
    pub files: Map<String, Value>,
    /// Optional explicit composition loader.
    pub loader: Option<&'a dyn FileLoader>,
    /// Base directory for relative document references.
    pub basepath: String,
    /// Content language.
    pub language: String,
    /// List-level data used by column visibility expressions: null or an object.
    pub data: Value,
    /// Current page: null for none, otherwise an integer from 1 to 9007199254740991.
    pub page: Value,
    /// Total item count: null for none, otherwise an integer from 0 to 9007199254740991;
    /// no total is derived from display rows.
    pub total: Value,
    /// Output layout: null (`table`), `table` or `card`.
    pub layout: Value,
}

impl Default for ListOptions<'_> {
    fn default() -> Self {
        Self {
            files: Map::new(),
            loader: None,
            basepath: String::new(),
            language: "ko".into(),
            data: Value::Null,
            page: Value::Null,
            total: Value::Null,
            layout: Value::Null,
        }
    }
}

/// Read decoded JSON list rows: absent means no rows, and any value other than an array fails.
pub fn list_rows(rows: Option<&Value>) -> FormResult<&[Value]> {
    match rows {
        None => Ok(&[]),
        Some(Value::Array(rows)) => Ok(rows),
        Some(_) => Err(FormError::input("List rows must be an array")),
    }
}

#[allow(
    clippy::expect_used,
    reason = "R-1: a constant expression, which the tests compile"
)]
static INTERPOLATION: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
    regex::Regex::new(r"\{=[A-Za-z_][\w.]*\}").expect("field interpolation pattern")
});

#[allow(
    clippy::expect_used,
    reason = "R-1: a constant expression, which the tests compile"
)]
static DIGITS: std::sync::LazyLock<regex::Regex> =
    std::sync::LazyLock::new(|| regex::Regex::new(r"[0-9]+").expect("digit grouping pattern"));

#[allow(
    clippy::disallowed_methods,
    reason = "CUDF-005: a format without a type is text"
)]
fn format(value: Option<&Value>) -> Value {
    match value {
        Some(Value::String(kind)) if !kind.is_empty() => json!({"type":kind,"options":{}}),
        Some(Value::Object(options)) => {
            json!({"type":options.get("type").and_then(Value::as_str).filter(|s| !s.is_empty()).unwrap_or("text"),"options":options})
        }
        _ => json!({"type":"text","options":{}}),
    }
}

fn interpolate(template: &str, row: &Value, value: Option<&Value>) -> String {
    INTERPOLATION
        .replace_all(template, |capture: &regex::Captures<'_>| {
            let path = &capture[0][2..capture[0].len() - 1];
            scalar(if path == "field" {
                value
            } else {
                value_at(row, path).or(value)
            })
        })
        .into_owned()
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(value)) => *value,
        Some(Value::Number(value)) => value.as_f64().is_some_and(|v| v != 0.0),
        Some(Value::String(value)) => !["", "0", "false"].contains(&value.as_str()),
        _ => true,
    }
}

#[allow(
    clippy::disallowed_methods,
    reason = "display-formats.md: a format option that the column omits takes its default, and a label that it omits is the value"
)]
fn cell_display(
    format: &Value,
    value: Option<&Value>,
    row: &Value,
    path: &str,
    language: &str,
) -> FormResult<Value> {
    let kind = format["type"].as_str().unwrap_or("text");
    let options = &format["options"];
    let text = scalar(value);
    let display = match kind {
        "date" => {
            let pattern = options["pattern"]
                .as_str()
                .filter(|s| !s.is_empty())
                .unwrap_or("YYYY-MM-DD");
            crate::date::format(&text, pattern).into()
        }
        "number" => {
            let number = crate::number::parse(&text);
            let Some(number) = number.filter(|v| v.is_finite()) else {
                return Ok(text.into());
            };
            let mut buffer = ryu_js::Buffer::new();
            let mut body = match options["decimals"].as_f64() {
                Some(decimals) if (0.0..=100.0).contains(&decimals.trunc()) => {
                    #[allow(
                        clippy::cast_possible_truncation,
                        clippy::cast_sign_loss,
                        reason = "R-1: the decimals are an integer from 0 to 100 here"
                    )]
                    let decimals = decimals.trunc() as u8;
                    buffer.format_to_fixed(number, decimals).to_owned()
                }
                Some(_) => {
                    return Err(FormError::input(
                        "Number decimals must be between 0 and 100",
                    ))
                }
                _ => polyspec_crudui_validator::validate::canonical::number_text(number),
            };
            if truthy(options.get("thousands")) {
                let (integer, fraction) = match body.split_once('.') {
                    Some((integer, fraction)) => (integer, Some(fraction)),
                    None => (body.as_str(), None),
                };
                let grouped = DIGITS
                    .replace_all(integer, |capture: &regex::Captures<'_>| {
                        let digits = &capture[0];
                        let mut grouped = String::new();
                        for (index, character) in digits.chars().enumerate() {
                            if index > 0 && (digits.len() - index).is_multiple_of(3) {
                                grouped.push(',');
                            }
                            grouped.push(character);
                        }
                        grouped
                    })
                    .into_owned();
                body = match fraction {
                    Some(fraction) => format!("{grouped}.{fraction}"),
                    None => grouped,
                };
            }
            (translate(options.get("prefix"), language)
                + &body
                + &translate(options.get("suffix"), language))
                .into()
        }
        "badge" => {
            let raw = options["map"].get(&text);
            if raw.is_some_and(|v| v.is_object() || v.is_array()) {
                let resolved = translate(raw, language);
                json!({"kind":"badge","variant":resolved,"label":resolved})
            } else {
                json!({"kind":"badge","variant":scalar(raw),"label":text})
            }
        }
        "link" => {
            let href = match options.get("href") {
                Some(Value::String(template)) => template.clone(),
                Some(value @ Value::Object(_)) => {
                    appearance(Some(value), row, &segments(path), &[])
                }
                _ => String::new(),
            };
            let caption = options.get("text").filter(|v| !v.is_null() && **v != "");
            let mut result = json!({"kind":"link","href":interpolate(&href,row,value),"text":caption.map(|v|translate(Some(v),language)).unwrap_or(text)});
            if let Some(target) = options["target"].as_str().filter(|s| !s.is_empty()) {
                result["target"] = target.into();
            }
            result
        }
        "choice-label" => {
            let items = &options["items"];
            let raw = if is_choice_list(items) {
                choice_label(items, &text)
            } else if items.get("model").is_some() {
                None
            } else if let Some(array) = items.as_array() {
                // A text that is no position selects no choice, and the label is the text itself.
                #[allow(
                    clippy::disallowed_methods,
                    reason = "no position: a label, not an error"
                )]
                let position = text.parse::<usize>().ok();
                position.and_then(|i| array.get(i))
            } else {
                items.get(&text)
            };
            // A choice label is content: a string or a language map.
            raw.map(|v| translate(Some(v), language))
                .unwrap_or(text)
                .into()
        }
        "bool" => {
            let value = truthy(value);
            let source = options
                .get(if value { "true" } else { "false" })
                .filter(|v| !v.is_null());
            json!({"kind":"bool","value":value,"label":source.map(|v|translate(Some(v),language)).unwrap_or_else(||value.to_string()),"as":options["as"].as_str().filter(|s|!s.is_empty()).unwrap_or("text")})
        }
        "image" => {
            let mut result = json!({"kind":"image","src":text,"alt":interpolate(&translate(options.get("alt"),language),row,value)});
            for key in ["width", "height"] {
                if let Some(value) = options.get(key) {
                    result[key] = scalar(Some(value)).into();
                }
            }
            result
        }
        "html" => json!({"kind":"html","html":text}),
        _ => {
            // Only a number truncates; its integer part counts Unicode code points.
            let limit = options["truncate"]
                .as_f64()
                .map(f64::trunc)
                .filter(|limit| *limit >= 1.0 && text.chars().count() as f64 > *limit);
            match limit {
                Some(limit) => {
                    #[allow(
                        clippy::cast_possible_truncation,
                        clippy::cast_sign_loss,
                        reason = "R-1: the limit is an integer from 1 below the length of the text"
                    )]
                    let limit = limit as usize;
                    (text.chars().take(limit).collect::<String>() + "…").into()
                }
                None => text.into(),
            }
        }
    };
    Ok(display)
}

/// Largest integer a JSON number carries exactly in every runtime.
const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

/// Read an optional integer option: null means none, and any other value must be a number whose
/// value is an integer from `minimum` to the largest safe integer, so an integral float such as
/// 2.0 is 2 and negative zero is 0.
fn list_integer(value: &Value, minimum: u64, message: &str) -> FormResult<Option<u64>> {
    let integer = match value {
        Value::Null => return Ok(None),
        Value::Number(number) => number.as_u64().or_else(|| {
            number
                .as_f64()
                .filter(|v| v.fract() == 0.0 && *v >= 0.0 && *v <= MAX_SAFE_INTEGER as f64)
                .map(|v| {
                    #[allow(
                        clippy::cast_possible_truncation,
                        clippy::cast_sign_loss,
                        reason = "R-1: the value is an integer from 0 to 2^53 - 1, which a u64 holds exactly"
                    )]
                    let integer = v as u64;
                    integer
                })
        }),
        _ => None,
    };
    match integer {
        Some(integer) if (minimum..=MAX_SAFE_INTEGER).contains(&integer) => Ok(Some(integer)),
        _ => Err(FormError::input(message)),
    }
}

/// Checked display inputs: the context, where null means empty, and the supplied page and total.
pub(crate) struct ListContext {
    pub(crate) data: Value,
    pub(crate) page: Option<u64>,
    pub(crate) total: Option<u64>,
}

/// Check list inputs in contract order: specification, rows, the columns declaration, context,
/// page, then total.
fn list_context(
    spec: &Value,
    rows: &[Value],
    options: &ListOptions<'_>,
) -> FormResult<ListContext> {
    if !spec.is_object() {
        return Err(FormError::input("List specification must be an object"));
    }
    if rows.iter().any(|row| !row.is_object()) {
        return Err(FormError::input("List rows must be objects"));
    }
    if spec.get("columns").is_none() {
        return Err(FormError::input("List specification must declare columns"));
    }
    let context = match &options.data {
        Value::Null => json!({}),
        data @ Value::Object(_) => data.clone(),
        _ => return Err(FormError::input("List context must be an object")),
    };
    let page = list_integer(&options.page, 1, "List page must be a positive integer")?;
    let total = list_integer(
        &options.total,
        0,
        "List total must be a nonnegative integer",
    )?;
    Ok(ListContext {
        data: context,
        page,
        total,
    })
}

/// Compose a list and bind display rows without modifying the inputs.
pub fn build_list(spec: &Value, rows: &[Value], options: &ListOptions<'_>) -> FormResult<Value> {
    // The specification is read in member order; rows and the context keep their own order.
    let spec = &member_ordered(spec);
    let checked = list_context(spec, rows, options)?;
    build_display(spec, rows, options, &checked, "list", "columns")
}

/// Build a list or detail display model from checked input. `own` is `list` or `detail` and
/// `members` names the member map, `columns` or `fields`. The member map and a list `search` with
/// `$ref` or `$patch` are composed, the composed specification is scanned for forbidden keys, and
/// its declarations are checked.
#[allow(
    clippy::disallowed_methods,
    reason = "display-formats.md: a column or an action without a label is labelled by its key, and a cell of an absent path holds null (CURP-024)"
)]
pub(crate) fn build_display(
    spec: &Value,
    rows: &[Value],
    options: &ListOptions<'_>,
    checked: &ListContext,
    own: &str,
    members: &str,
) -> FormResult<Value> {
    let context = &checked.data;
    let memory = MemoryLoader::new(options.files.clone());
    // Without a loader, composition reads the files of the options.
    let loader: &dyn FileLoader = match options.loader {
        Some(loader) => loader,
        None => &memory,
    };
    let compose_options = ComposeOptions::with_basepath(&options.basepath);
    let Some(declared) = spec[members].as_object() else {
        return Err(FormError::input(format!(
            "Invalid {members} at {own}: expected an object"
        )));
    };
    let columns = compose_properties(declared.clone(), loader, &compose_options)?;
    let search = match spec.get("search").and_then(Value::as_object) {
        Some(search)
            if own == "list" && (search.contains_key("$ref") || search.contains_key("$patch")) =>
        {
            Some(compose_properties(
                search.clone(),
                loader,
                &compose_options,
            )?)
        }
        _ => None,
    };
    // The composed specification keeps the member order of the declared one.
    let mut composed = Map::new();
    for (key, value) in spec.as_object().into_iter().flatten() {
        let value = match &search {
            _ if key == members => Value::Object(columns.clone()),
            Some(search) if key == "search" => Value::Object(search.clone()),
            _ => value.clone(),
        };
        composed.insert(key.clone(), value);
    }
    // The forbidden-key scan and then the declarations, as the display format specification orders them.
    let spec = &Value::Object(composed);
    scan_forbidden_keys(spec, &[])?;
    check_display_declarations(spec, own, members)?;
    let mut visible = Vec::new();
    for (key, raw) in &columns {
        let design = resolve_design(raw.get("design"), context, "", &[]);
        if design["show"] == false {
            continue;
        }
        visible.push(json!({"key":key,"field":raw["field"].as_str().or_no_text(),"label":raw.get("label").map(|v|translate(Some(v),&options.language)).unwrap_or_else(||key.clone()),"format":format(raw.get("format")),"sortable":raw.get("sortable").filter(|v|!v.is_null()).is_some_and(|v|flag(Some(v),context,&[],&[])),"design":design}));
    }
    let bound_rows = rows.iter().map(|row| {
        let cells = visible.iter().map(|column| {
            let path = column["field"].as_str().or_no_text();
            let value = if path.is_empty() {None} else {value_at(row,path)};
            let raw = &columns[column["key"].as_str().or_no_text()];
            // A model is JSON: a path absent from the row is null, and the member is always present.
            Ok(json!({"format":column["format"],"value":value.cloned().unwrap_or(Value::Null),"display":cell_display(&column["format"],value,row,path,&options.language)?,"design":resolve_design(raw.get("design"),row,path,&[])}))
        }).collect::<FormResult<Vec<_>>>()?;
        Ok(json!({"cells":cells}))
    }).collect::<FormResult<Vec<_>>>()?;
    let pagination = pagination_model(
        &spec["pagination"],
        checked.page,
        checked.total,
        &options.language,
    )?;
    let mut actions = Vec::new();
    for (key, raw) in spec["actions"].as_object().into_iter().flatten() {
        // A script string: a button that runs the script when it is clicked.
        if let Some(script) = raw.as_str() {
            actions.push(json!({"key":key,"label":key,"behavior":{"onclick":script}}));
            continue;
        }
        let label = raw
            .get("label")
            .map(|v| translate(Some(v), &options.language))
            .unwrap_or_else(|| key.clone());
        // An action object with a script is the object form of a script action.
        if let Some(script) = raw["script"].as_str() {
            actions.push(json!({"key":key,"label":label,"behavior":{"onclick":script}}));
            continue;
        }
        let mut action = json!({"key":key,"label":label});
        if raw.get("format").is_some() {
            action["format"] = format(raw.get("format"));
        }
        let mut behavior = Map::new();
        for (event, script) in raw["behavior"].as_object().into_iter().flatten() {
            if let Some(script) = script.as_str().or_else(|| script["script"].as_str()) {
                behavior.insert(event.clone(), script.into());
            }
        }
        if !behavior.is_empty() {
            action["behavior"] = behavior.into();
        }
        actions.push(action);
    }
    let mut result = json!({"columns":visible,"rows":bound_rows,"pagination":pagination});
    if let Some(field) = spec["sort"]["field"].as_str().filter(|s| !s.is_empty()) {
        result["sort"] =
            json!({"field":field,"dir":if spec["sort"]["dir"]=="desc" {"desc"} else {"asc"}});
    }
    result["actions"] = actions.into();
    // A list with no rows shows the declared empty text; absent or null empty shows the
    // table's emptyList for the display language (same en fallback). A declared text, even "",
    // is used as declared.
    let empty_text = if spec.get("empty").is_some_and(|empty| !empty.is_null()) {
        translate(spec.get("empty"), &options.language)
    } else if own == "list" {
        list_messages(&options.language).empty_list.to_string()
    } else {
        String::new()
    };
    result["empty"] = empty_text.into();
    result["description"] = translate(spec.get("description"), &options.language).into();
    result["design"] = resolve_design(spec.get("design"), context, "", &[]);
    Ok(result)
}

fn str_at<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().or_no_text()
}

fn cell_body(display: &Value) -> String {
    if let Some(text) = display.as_str() {
        return escape(text);
    }
    match str_at(display, "kind") {
        "badge" => element(
            "span",
            &if str_at(display, "variant").is_empty() {
                json!({"class":"crudui-badge"})
            } else {
                json!({"class":"crudui-badge", "data-crudui-variant":str_at(display,"variant")})
            },
            &escape(str_at(display, "label")),
        ),
        "link" => {
            let mut attrs = json!({"href":display["href"]});
            if let Some(target) = display.get("target") {
                attrs["target"] = target.clone();
            }
            element("a", &attrs, &escape(str_at(display, "text")))
        }
        "image" => {
            let mut attrs = json!({"src":display["src"],"alt":display["alt"]});
            for key in ["width", "height"] {
                if let Some(value) = display.get(key) {
                    attrs[key] = value.clone();
                }
            }
            element("img", &attrs, "")
        }
        "bool" => match str_at(display, "as") {
            "check" => element(
                "span",
                &json!({"class":"crudui-bool crudui-bool--check","data-crudui-state":display["value"].to_string(),"aria-label":display["label"]}),
                if display["value"] == true {
                    "✔"
                } else {
                    "✘"
                },
            ),
            "icon" => element(
                "span",
                &json!({"class":"crudui-bool crudui-bool--icon","data-crudui-state":display["value"].to_string(),"aria-label":display["label"]}),
                "",
            ),
            _ => element(
                "span",
                &json!({"class":"crudui-bool crudui-bool--text","data-crudui-state":display["value"].to_string()}),
                &escape(str_at(display, "label")),
            ),
        },
        "html" => str_at(display, "html").into(),
        _ => String::new(),
    }
}

pub(crate) fn cell_html(cell: &Value, tag: &str, base: &str) -> String {
    let main = &cell["design"]["main"];
    element(
        tag,
        &appearance_attrs(
            join_class(&[base, str_at(main, "class")]),
            str_at(main, "style"),
        ),
        &cell_body(&cell["display"]),
    )
}

/// The actions of a list or detail: `{block}__actions` with one `{block}__action` span per
/// action holding a link or button with its behavior attributes; nothing without actions.
#[allow(
    clippy::disallowed_methods,
    reason = "CURP-024: a link action without a href writes #, as every renderer reads the model"
)]
pub(crate) fn actions_html(actions: &Value, block: &str) -> String {
    let mut toolbar = String::new();
    for action in actions.as_array().into_iter().flatten() {
        let link = action["format"]["type"] == "link";
        let mut attrs = if link {
            json!({"href":action["format"]["options"]["href"].as_str().unwrap_or("#")})
        } else {
            json!({"type":"button"})
        };
        if link {
            if let Some(target) = action["format"]["options"]["target"].as_str() {
                attrs["target"] = target.into();
            }
        }
        for (attribute, script) in action["behavior"].as_object().into_iter().flatten() {
            attrs[attribute.as_str()] = script.clone();
        }
        toolbar += &element(
            "span",
            &json!({"class":format!("{block}__action"),"data-action":action["key"]}),
            &raw_element(
                if link { "a" } else { "button" },
                &attrs,
                &raw_text(str_at(action, "label")),
            ),
        );
    }
    if toolbar.is_empty() {
        return toolbar;
    }
    element(
        "div",
        &json!({"class":format!("{block}__actions")}),
        &toolbar,
    )
}

/// Render a list with supplied display rows in table or card layout.
#[allow(
    clippy::disallowed_methods,
    reason = "CURP-024: a pagination button without a page is page 1, as every renderer reads the model"
)]
pub fn render_list(spec: &Value, rows: &[Value], options: &ListOptions<'_>) -> FormResult<String> {
    list_context(spec, rows, options)?;
    let layout = match &options.layout {
        Value::Null => "table",
        Value::String(layout) if layout == "table" || layout == "card" => layout.as_str(),
        _ => return Err(FormError::input("List layout must be table or card")),
    };
    let model = build_list(spec, rows, options)?;
    let mut content = String::new();
    let description = str_at(&model, "description");
    if !description.is_empty() {
        content += &element(
            "p",
            &json!({"class":"crudui-list__description"}),
            &escape(description),
        );
    }
    content += &actions_html(&model["actions"], "crudui-list");
    let columns = model["columns"].as_array().or_no_list();
    let rows = model["rows"].as_array().or_no_list();
    if rows.is_empty() {
        content += &element(
            "div",
            &json!({"class":"crudui-list__empty"}),
            &escape(str_at(&model, "empty")),
        );
    } else if layout == "card" {
        let cards = rows
            .iter()
            .map(|row| {
                let cells = row["cells"]
                    .as_array()
                    .or_no_list()
                    .iter()
                    .enumerate()
                    .map(|(index, cell)| {
                        let class = join_class(&[
                            &format!(
                                "crudui-list__cell crudui-value crudui-value--{}",
                                str_at(&cell["format"], "type")
                            ),
                            str_at(&cell["design"]["main"], "class"),
                        ]);
                        element(
                            "div",
                            &json!({"class":class}),
                            &(element(
                                "span",
                                &json!({"class":"crudui-list__card-label"}),
                                &escape(str_at(&columns[index], "label")),
                            ) + &cell_html(cell, "span", "crudui-list__card-value")),
                        )
                    })
                    .collect::<String>();
                element("article", &json!({"class":"crudui-list__card"}), &cells)
            })
            .collect::<String>();
        content += &element("div", &json!({"class":"crudui-list__cards"}), &cards);
    } else {
        let header = columns
            .iter()
            .map(|column| {
                let main = &column["design"]["main"];
                let mut attrs = appearance_attrs(
                    join_class(&["crudui-list__heading", str_at(main, "class")]),
                    str_at(main, "style"),
                );
                if !str_at(column, "field").is_empty() {
                    attrs["data-field"] = column["field"].clone();
                }
                if column["sortable"] == true {
                    attrs["data-sortable"] = "true".into();
                }
                if model.get("sort").is_some()
                    && (model["sort"]["field"] == column["field"]
                        || model["sort"]["field"] == column["key"])
                {
                    attrs["data-sort-dir"] = model["sort"]["dir"].clone();
                }
                let mut body = element(
                    "span",
                    &json!({"class":"crudui-list__heading-label"}),
                    &escape(str_at(column, "label")),
                );
                if column["sortable"] == true {
                    body += &element("span", &json!({"class":"crudui-list__sort"}), "↕");
                }
                element("th", &attrs, &body)
            })
            .collect::<String>();
        let body = rows
            .iter()
            .map(|row| {
                element(
                    "tr",
                    &json!({}),
                    &row["cells"]
                        .as_array()
                        .or_no_list()
                        .iter()
                        .map(|cell| {
                            cell_html(
                                cell,
                                "td",
                                &format!(
                                    "crudui-list__cell crudui-value crudui-value--{}",
                                    str_at(&cell["format"], "type")
                                ),
                            )
                        })
                        .collect::<String>(),
                )
            })
            .collect::<String>();
        content += &element(
            "table",
            &json!({"class":"crudui-list__table"}),
            &(element("thead", &json!({}), &element("tr", &json!({}), &header))
                + &element("tbody", &json!({}), &body)),
        );
    }
    let pagination = &model["pagination"];
    if pagination["enabled"] == true {
        let mut attrs = json!({"class":"crudui-list__pagination"});
        for (input, output) in [
            ("mode", "data-mode"),
            ("perPage", "data-per-page"),
            ("page", "data-page"),
            ("total", "data-total"),
        ] {
            if let Some(value) = pagination.get(input) {
                attrs[output] = scalar(Some(value)).into();
            }
        }
        // Render buttons from the pagination model
        let mut controls = String::new();
        if let Some(buttons) = pagination.get("buttons").and_then(Value::as_array) {
            for button_data in buttons {
                let role = button_data["role"].as_str().or_no_text();
                let page_num = button_data["page"].as_u64().unwrap_or(1);
                let label = button_data["label"].as_str().or_no_text();
                let current = button_data["current"] == true;
                let disabled = button_data["disabled"] == true;

                let class = match role {
                    "previous" => "crudui-list__pagination-prev",
                    "next" => "crudui-list__pagination-next",
                    _ => "crudui-list__pagination-page",
                };

                let text = match role {
                    "previous" => "‹".to_string(),
                    "next" => "›".to_string(),
                    _ => page_num.to_string(),
                };

                let mut button_attrs = json!({"type":"button", "class":class, "data-page":page_num.to_string(), "aria-label":label});
                if current {
                    button_attrs["aria-current"] = "page".into();
                }
                if disabled {
                    button_attrs["disabled"] = true.into();
                }

                controls += &element("button", &button_attrs, &text);
            }
        }
        content += &element("nav", &attrs, &controls);
    }
    let wrapper = &model["design"]["wrapper"];
    let mut sources = Vec::new();
    for row in rows {
        for cell in row["cells"].as_array().into_iter().flatten() {
            let display = &cell["display"];
            if display["kind"] != "image" {
                continue;
            }
            let source = str_at(display, "src");
            if source.is_empty()
                || source
                    .get(..5)
                    .is_some_and(|prefix| prefix.eq_ignore_ascii_case("data:"))
                || sources.contains(&source)
            {
                continue;
            }
            sources.push(source);
        }
    }
    let preloads = sources
        .iter()
        .map(|source| {
            element(
                "link",
                &json!({"rel":"preload","as":"image","href":source}),
                "",
            )
        })
        .collect::<String>();
    Ok(preloads
        + &element(
            "div",
            &appearance_attrs(
                join_class(&["crudui-list", str_at(wrapper, "class")]),
                str_at(wrapper, "style"),
            ),
            &content,
        ))
}

/// Reject a wrong value type or an unknown key in the pagination declaration at `path`.
pub(crate) fn check_pagination_declaration(pagination: &Value, path: &str) -> FormResult<()> {
    let fail = |key: &str, expected: &str| {
        Err(FormError::input(format!(
            "Invalid {key} at {path}: expected {expected}"
        )))
    };
    if !pagination.is_boolean() && !pagination.is_object() {
        return fail("pagination", "a boolean or an object");
    }
    let Some(pagination) = pagination.as_object() else {
        return Ok(());
    };
    check_known_keys("pagination", pagination, &["per_page", "mode"], path)?;
    if let Some(per_page) = pagination.get("per_page") {
        if per_page.is_null() || list_integer(per_page, 1, "").is_err() {
            return fail("pagination.per_page", "a positive integer");
        }
    }
    if let Some(mode) = pagination.get("mode") {
        if !mode
            .as_str()
            .is_some_and(|mode| ["pages", "offset", "cursor", "none"].contains(&mode))
        {
            return fail("pagination.mode", "pages, offset, cursor or none");
        }
    }
    Ok(())
}

/// The pagination model, in member order: enabled, then for enabled paging perPage, mode and
/// page with their defaults, the supplied total and pageCount. Disabled paging keeps only the
/// supplied page and total.
#[allow(
    clippy::disallowed_methods,
    reason = "display-formats.md, pagination: perPage 20, mode pages and page 1 are the defaults, and an unknown total has no page"
)]
fn pagination_model(
    declared: &Value,
    page: Option<u64>,
    total: Option<u64>,
    language: &str,
) -> FormResult<Value> {
    let enabled = *declared == true || declared.is_object();
    let mut pagination = json!({"enabled":enabled});
    let per_page = match declared.get("per_page") {
        Some(value) => {
            list_integer(value, 1, "pagination.per_page must be a positive integer")?.unwrap_or(20)
        }
        None => 20,
    };
    if enabled {
        pagination["perPage"] = per_page.into();
        pagination["mode"] = declared
            .get("mode")
            .and_then(Value::as_str)
            .unwrap_or("pages")
            .into();
        pagination["page"] = page.unwrap_or(1).into();
    } else if let Some(page) = page {
        pagination["page"] = page.into();
    }
    if let Some(total) = total {
        pagination["total"] = total.into();
    }
    if enabled {
        let page_count = total
            .map(|total| total.div_ceil(per_page).max(1))
            .unwrap_or(0);
        pagination["pageCount"] = page_count.into();

        // Generate buttons for pagination
        let current_page = if page_count > 0 {
            page.unwrap_or(1).min(page_count)
        } else {
            1
        };
        let messages = list_messages(language);
        let mut buttons = Vec::new();

        // Previous button
        buttons.push(json!({
            "role": "previous",
            "page": (current_page - 1).max(1),
            "label": messages.previous_page,
            "current": false,
            "disabled": current_page <= 1 || page_count == 0
        }));

        // Page number buttons
        for value in pagination_pages(current_page, page_count) {
            buttons.push(json!({
                "role": "page",
                "page": value,
                "label": format_page(messages.page, value),
                "current": value == current_page,
                "disabled": value == current_page
            }));
        }

        // Next button
        buttons.push(json!({
            "role": "next",
            "page": if page_count > 0 { (current_page + 1).min(page_count) } else { 1 },
            "label": messages.next_page,
            "current": false,
            "disabled": page_count == 0 || current_page >= page_count
        }));

        pagination["buttons"] = buttons.into();
    }
    Ok(pagination)
}

/// The bounded page-number window: every page up to seven pages, otherwise the first,
/// previous, current, next and last page.
fn pagination_pages(page: u64, page_count: u64) -> Vec<u64> {
    if page_count <= 7 {
        return (1..=page_count).collect();
    }
    let mut pages: Vec<u64> = Vec::new();
    for value in [
        1,
        page.saturating_sub(1).max(1),
        page,
        page.saturating_add(1).min(page_count),
        page_count,
    ] {
        if pages.last().is_none_or(|last| *last < value) {
            pages.push(value);
        }
    }
    pages
}
