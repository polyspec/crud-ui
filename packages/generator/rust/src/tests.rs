use super::*;
use serde_json::{json, Value};

fn template() -> FormTemplate {
    compile_form(&json!({"type":"group","properties":{
        "enabled":{"type":"checkbox"},
        "memo":{"type":"textarea","default":"initial","design":{"show":".enabled"}},
        "companies":{"type":"group","multiple":{"copy":true,"sortable":true},"properties":{
            "name":{"type":"text"},
            "stores":{"type":"group","multiple":true,"properties":{"name":{"type":"text"},"tags":{"type":"multichoice","items":{"a":"A","b":"B"}}}}
        }}
    }}),&CompileOptions {key_prefix:Some("form".into()),..Default::default()}).unwrap()
}

fn record() -> Value {
    json!({"enabled":true,"memo":"saved","companies":{
        "__0000000000005__":{"name":"Five","stores":{"__0000000000005__":{"name":"Store","tags":["a","b"]}}},
        "__0000000000007__":{"name":"Seven","stores":{}},
        "__0000000000001__":{"name":"One","stores":{}}
    }})
}

#[test]
fn initial_injection_repeated_injection_and_restoration_are_exact() {
    let template = template();
    let cached = serde_json::to_string(&template).unwrap();
    let data = record();
    let initial = Form::new(template.clone(), &data, BindOptions::default()).unwrap();
    let html = render_form(&initial, None).unwrap();
    let mut injected = Form::new(
        serde_json::from_str(&cached).unwrap(),
        &json!({"companies":{}}),
        BindOptions::default(),
    )
    .unwrap();
    for next in [
        data.clone(),
        data.clone(),
        json!({"enabled":false,"memo":"other","companies":{}}),
        data.clone(),
    ] {
        injected.set_data(&next).unwrap();
        if next == data {
            assert_eq!(html, render_form(&injected, None).unwrap());
            assert_eq!(initial.get_data(), injected.get_data());
            assert_eq!(initial.fields(), injected.fields());
        }
    }
    assert_eq!(cached, serde_json::to_string(&template).unwrap());
    assert_eq!(cached, serde_json::to_string(injected.template()).unwrap());
    assert!(html.contains("form[companies][__0000000000005__][stores][__0000000000005__][name]"));
    assert!(html.contains("companies[][stores][][name]"));
}

#[test]
fn utc_date_controls_and_lists_preserve_data_and_injected_html() {
    let template = compile_form(
        &json!({"type":"group","properties":{"day":{"type":"date"},"time":{"type":"datetime"}}}),
        &CompileOptions::default(),
    )
    .unwrap();
    let list_spec = json!({"columns":{"time":{"field":"time","format":{"type":"date","pattern":"YYYY-MM-DDTHH:mm:ss"}}}});
    for (input, day, time) in [
        (
            "2026-09-09T03:04:05+09:00",
            "2026-09-08",
            "2026-09-08T18:04:05",
        ),
        (
            "2026-09-09T23:04:05-07:00",
            "2026-09-10",
            "2026-09-10T06:04:05",
        ),
        (
            "2026-09-09 03:04:05.999",
            "2026-09-09",
            "2026-09-09T03:04:05",
        ),
        (
            "2026-02-29T03:04:05",
            "2026-02-29T03:04:05",
            "2026-02-29T03:04:05",
        ),
    ] {
        let data = json!({"day":input,"time":input});
        let initial = Form::new(template.clone(), &data, BindOptions::default()).unwrap();
        let mut injected = Form::new(template.clone(), &json!({}), BindOptions::default()).unwrap();
        injected.set_data(&data).unwrap();
        assert_eq!(initial.get_data(), data);
        assert_eq!(injected.get_data(), data);
        assert_eq!(initial.fields(), injected.fields());
        assert_eq!(
            render_form(&initial, None).unwrap(),
            render_form(&injected, None).unwrap()
        );
        assert_eq!(initial.fields()[0]["widget"]["attrs"]["value"], day);
        assert_eq!(initial.fields()[1]["widget"]["attrs"]["value"], time);
        let list = build_list(&list_spec, &[data], &ListOptions::default()).unwrap();
        assert_eq!(list["rows"][0]["cells"][0]["display"], time);
        assert_eq!(list["rows"][0]["cells"][0]["value"], input);
    }
}

#[test]
fn copied_nested_rows_have_new_keys_and_operations_preserve_order() {
    let mut form = Form::new(template(), &record(), BindOptions::default()).unwrap();
    let key = form
        .copy_row(
            "companies",
            "__0000000000005__",
            AddRowOptions {
                key: Some("__a000000000001__".into()),
                ..Default::default()
            },
        )
        .unwrap();
    let data = form.get_data();
    let original = &data["companies"]["__0000000000005__"];
    let copied = &data["companies"][&key];
    assert_eq!(original["name"], copied["name"]);
    assert_ne!(
        original["stores"]
            .as_object()
            .unwrap()
            .keys()
            .collect::<Vec<_>>(),
        copied["stores"]
            .as_object()
            .unwrap()
            .keys()
            .collect::<Vec<_>>()
    );
    assert_eq!(
        original["stores"]
            .as_object()
            .unwrap()
            .values()
            .collect::<Vec<_>>(),
        copied["stores"]
            .as_object()
            .unwrap()
            .values()
            .collect::<Vec<_>>()
    );
    form.move_row("companies", &key, 0).unwrap();
    let saved = sequence_row_key("42").unwrap();
    form.rekey_row("companies", &key, &saved).unwrap();
    assert_eq!(
        form.get_data()["companies"]
            .as_object()
            .unwrap()
            .keys()
            .next(),
        Some(&saved)
    );
    form.remove_row("companies", &saved).unwrap();
    assert_eq!(form.get_data(), record());
}

#[test]
fn failed_operations_are_atomic_and_empty_collections_remain_empty() {
    let mut form = Form::new(template(), &record(), BindOptions::default()).unwrap();
    let before = form.get_data();
    let html = render_form(&form, None).unwrap();
    assert!(form
        .add_row(
            "companies",
            AddRowOptions {
                key: Some("__0000000000005__".into()),
                ..Default::default()
            }
        )
        .is_err());
    assert!(form
        .add_row(
            "companies",
            AddRowOptions {
                key: Some("1".into()),
                ..Default::default()
            }
        )
        .is_err());
    assert!(form
        .add_row(
            "companies",
            AddRowOptions {
                after_key: Some("missing".into()),
                ..Default::default()
            }
        )
        .is_err());
    assert!(form.remove_row("companies", "missing").is_err());
    assert!(form.move_row("companies", "__0000000000005__", 3).is_err());
    assert!(form
        .rekey_row("companies", "__0000000000005__", "__0000000000007__")
        .is_err());
    assert!(form.set_data(&json!({"companies":[]})).is_err());
    assert!(form.set_data(&json!({"companies":null})).is_err());
    assert_eq!(before, form.get_data());
    assert_eq!(html, render_form(&form, None).unwrap());
    form.set_data(&json!({"companies":{}})).unwrap();
    assert!(form.get_data()["companies"].as_object().unwrap().is_empty());
    assert!(render_form(&form, None).unwrap().contains("<div class=\"crudui-node__footer\"><div class=\"crudui-controls\" role=\"group\" aria-label=\"컬렉션 컨트롤\"><button type=\"button\" class=\"crudui-action\" data-crudui-action=\"add-row\" aria-label=\"추가\"></button></div></div>"));
    form.add_row("companies", AddRowOptions::default()).unwrap();
    assert_eq!(form.get_data()["companies"].as_object().unwrap().len(), 1);
}

#[test]
fn null_and_omitted_values_have_different_defaults() {
    let template=compile_form(&json!({"type":"group","properties":{"tags":{"type":"text","multiple":true,"default":"default"},"value":{"type":"text","default":"default"}}}),&CompileOptions::default()).unwrap();
    let mut form = Form::new(
        template,
        &json!({"tags":{},"value":null}),
        BindOptions::default(),
    )
    .unwrap();
    let supplied: AddRowOptions =
        serde_json::from_value(json!({"key":"null_row","value":null})).unwrap();
    assert_eq!(supplied.value, Some(Value::Null));
    form.add_row("tags", supplied).unwrap();
    form.add_row(
        "tags",
        serde_json::from_value(json!({"key":"default_row"})).unwrap(),
    )
    .unwrap();
    assert!(form.get_data()["value"].is_null());
    assert!(form.get_data()["tags"]["null_row"].is_null());
    assert_eq!(form.get_data()["tags"]["default_row"], "default");
}

#[test]
fn bracket_paths_preserve_literal_dots_in_object_keys() {
    let template = compile_form(
        &json!({"type":"group","properties":{"name":{"type":"text"}}}),
        &CompileOptions::default(),
    )
    .unwrap();
    let mut form = Form::new(
        template,
        &json!({"meta":{"a.b":"old"}}),
        BindOptions::default(),
    )
    .unwrap();
    assert_eq!(form.get_value("meta[a.b]").unwrap(), Some(json!("old")));
    form.set_value("meta[a.b]", json!("new")).unwrap();
    assert_eq!(form.get_data()["meta"], json!({"a.b":"new"}));
}

#[test]
fn appearance_uses_the_validator_expression_recognizer() {
    let template=compile_form(&json!({"type":"group","properties":{"value":{"type":"text","design":{"class":"flags.active","style":"color: red!important"}}}}),&CompileOptions::default()).unwrap();
    let fields = bind_form(
        &template,
        &json!({"flags":{"active":"active"}}),
        &BindOptions::default(),
    )
    .unwrap();
    let attrs = &fields[0]["widget"]["attrs"];
    assert!(attrs["class"]
        .as_str()
        .unwrap()
        .split(' ')
        .any(|class| class == "true"));
    assert_eq!(attrs["style"], "color: red!important");
    assert!(fields[0].get("design").is_none());
}

#[test]
fn data_only_collections_hold_exactly_the_data_rows() {
    for multiple in [json!("only"), json!({"only":true,"title":"name"})] {
        let template = compile_form(&json!({"type":"group","properties":{
            "variants":{"type":"group","multiple":multiple,"properties":{"name":{"type":"text"}}},
            "tags":{"type":"text","multiple":"only"}
        }}), &CompileOptions::default()).unwrap();
        let empty = Form::new(template.clone(), &json!({}), BindOptions::default()).unwrap();
        assert_eq!(empty.get_data(), json!({"variants":{},"tags":{}}));
        for node in empty.fields() {
            assert_eq!(node["children"], json!([]));
            assert!(node.get("controls").is_none(), "{node}");
        }
        let data = json!({"variants":{"b":{"name":"B"},"a":{"name":"A"}},"tags":{"t":"x"}});
        let mut form = Form::new(template, &data, BindOptions::default()).unwrap();
        let rows = form.fields()[0]["children"].as_array().unwrap().clone();
        assert_eq!(
            rows.iter()
                .map(|row| row["key"].clone())
                .collect::<Vec<_>>(),
            ["b", "a"]
        );
        assert!(rows.iter().all(|row| row.get("controls").is_none()));
        let before = (form.get_data(), form.fields().to_vec(), form.revision());
        let results = [
            form.add_row("variants", AddRowOptions::default())
                .map(|_| ()),
            form.copy_row("variants", "a", AddRowOptions::default())
                .map(|_| ()),
            form.remove_row("variants", "a"),
            form.move_row("variants", "a", 0),
            form.rekey_row("variants", "a", "c"),
            form.add_row("tags", AddRowOptions::default()).map(|_| ()),
        ];
        for (index, result) in results.into_iter().enumerate() {
            let error = result.unwrap_err();
            let path = if index == 5 { "tags" } else { "variants" };
            assert_eq!(
                (error.code.as_str(), error.message),
                (
                    "INVALID_FORM_INPUT",
                    format!("Rows of {path} come only from data")
                )
            );
        }
        assert_eq!(
            (form.get_data(), form.fields().to_vec(), form.revision()),
            before
        );
    }
}

#[test]
fn rows_have_ordered_controls_titles_and_sticky_headers() {
    let template = compile_form(&json!({"type":"group","properties":{
        "items":{"type":"group","label":"Items","multiple":{"min":1,"max":2,"copy":true,"sortable":true,"title":"name","header":"sticky"},"properties":{
            "name":{"type":"text"},
            "tags":{"type":"text","multiple":{"controls":"footer","header":"sticky"}}
        }}
    }}), &CompileOptions::default()).unwrap();
    let data = json!({"items":{"first":{"name":"One","tags":{"a":"x","b":"y"}},"second":{"name":"","tags":{}}}});
    let options = BindOptions {
        language: "en".into(),
        ..Default::default()
    };
    let fields = bind_form(&template, &data, &options).unwrap();
    let collection = &fields[0];
    assert_eq!(collection["kind"], "collection");
    assert_eq!(
        collection["header"],
        json!({"className":"","label":"Items","count":"Rows: 2"})
    );
    let first = &collection["children"][0];
    let names = first["controls"]["actions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|action| (action["name"].as_str().unwrap(), action["disabled"] == true))
        .collect::<Vec<_>>();
    assert_eq!(
        names,
        [
            ("move-up", true),
            ("move-down", false),
            ("add-row", true),
            ("copy-row", true),
            ("remove-row", false)
        ]
    );
    assert_eq!(
        first["header"],
        json!({"className":"","label":"Items","number":"1","title":"One","summary":"Nested rows: 2"})
    );
    assert_eq!(
        (first["sticky"].clone(), first["stickyDepth"].clone()),
        (json!(true), json!(0))
    );
    assert_eq!(first["body"]["id"], "crudui:items.first:body");
    assert_eq!(collection["children"][1]["header"]["title"], "(untitled)");
    let tag = &first["children"][1]["children"][1];
    assert_eq!(
        (tag["header"]["number"].clone(), tag["stickyDepth"].clone()),
        (json!("1.2"), json!(1))
    );
    let empty = &collection["children"][1]["children"][1];
    assert_eq!(empty["controls"]["placement"], "footer");
    let html =
        crate::render::render_fields(&fields, &crate::form_render::RenderModel::default(), "");
    assert!(html.starts_with("<div class=\"crudui-form\"><div class=\"crudui-form__body\"><div class=\"crudui-node crudui-node--collection\" data-field-path=\"items\">"));
    assert!(html.contains("<div class=\"crudui-node crudui-node--row crudui-node--sticky\" style=\"--crudui-sticky-depth:0\" data-crudui-row-key=\"first\"><div class=\"crudui-node__header-container\"><div class=\"crudui-node__header\"><button type=\"button\" class=\"crudui-action\" data-crudui-action=\"toggle-row\" aria-expanded=\"true\" aria-controls=\"crudui:items.first:body\" aria-label=\"Expand or collapse\"></button>"));
    assert!(html.contains("<span class=\"crudui-node__summary\" hidden=\"\">Nested rows: 2</span>"));
    let error = bind_form(
        &template,
        &data,
        &BindOptions {
            language: "fr".into(),
            ..Default::default()
        },
    )
    .unwrap_err();
    assert_eq!(error.message, "Unsupported language: fr");
    for (language, message) in [
        (json!(5), "Language must be a string"),
        (json!(true), "Language must be a string"),
        (json!(["en"]), "Language must be a string"),
        (json!({"en": 1}), "Language must be a string"),
        (json!(""), "Unsupported language: "),
    ] {
        let options = BindOptions {
            language,
            ..Default::default()
        };
        let error = Form::new(template.clone(), &data, options).err().unwrap();
        assert_eq!(
            (
                error.code.as_str(),
                error.message.as_str(),
                error.at.as_str()
            ),
            ("INVALID_FORM_INPUT", message, "")
        );
    }
    let options = BindOptions {
        language: Value::Null,
        ..Default::default()
    };
    assert_eq!(
        bind_form(&template, &data, &options).unwrap()[0]["header"]["count"],
        "2개"
    );
    for (options, message) in [
        (
            json!({"language":5,"keyPrefix":5}),
            "Language must be a string",
        ),
        (
            json!({"language":"fr","keyPrefix":5,"idPrefix":5}),
            "keyPrefix must be a string",
        ),
        (
            json!({"language":"fr","idPrefix":[],"unsupported":true}),
            "idPrefix must be a string",
        ),
        (
            json!({"language":"fr","unsupported":true}),
            "unsupported must be throw or marker",
        ),
        (
            json!({"language":"fr","unsupported":"other"}),
            "unsupported must be throw or marker",
        ),
        (
            json!({"language":"fr","idPrefix":null,"keyPrefix":null,"unsupported":null}),
            "Unsupported language: fr",
        ),
    ] {
        let options: BindOptions = serde_json::from_value(options).unwrap();
        for error in [
            bind_form(&template, &data, &options).unwrap_err(),
            Form::new(template.clone(), &data, options.clone())
                .err()
                .unwrap(),
        ] {
            assert_eq!(
                (
                    error.code.as_str(),
                    error.message.as_str(),
                    error.at.as_str()
                ),
                ("INVALID_FORM_INPUT", message, "")
            );
        }
    }
    let nulls: BindOptions = serde_json::from_value(
        json!({"idPrefix":null,"keyPrefix":null,"unsupported":null,"language":null}),
    )
    .unwrap();
    assert_eq!(
        bind_form(&template, &data, &nulls).unwrap(),
        bind_form(&template, &data, &BindOptions::default()).unwrap()
    );
    let error = Form::new(
        template.clone(),
        &json!({"items":[]}),
        BindOptions {
            key_prefix: json!(5),
            ..Default::default()
        },
    )
    .err()
    .unwrap();
    assert_eq!(error.message, "Repeated data must be a keyed object: items");
}

#[test]
fn repeated_declarations_reject_titles_controls_and_headers() {
    for (field, message) in [
        (json!({"type":"text","multiple":{"title":"name"}}), "Invalid multiple.title at rows: expected a repeated group"),
        (json!({"type":"group","multiple":{"title":"missing"},"properties":{"name":{"type":"text"}}}), "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang"),
        (json!({"type":"group","multiple":{"title":"name"},"properties":{"name":{"type":"text","lang":true}}}), "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang"),
        (json!({"type":"text","multiple":{"controls":"side","header":"fixed"}}), "Invalid multiple.controls at rows: expected header, footer or outline"),
        (json!({"type":"text","multiple":{"header":"fixed"}}), "Invalid multiple.header at rows: expected static or sticky"),
        (json!({"type":"text","lang":null}), "Invalid lang at rows: expected a boolean or an object"),
        (json!({"type":"text","lang":"ko"}), "Invalid lang at rows: expected a boolean or an object"),
        (json!({"type":"text","lang":["ko"]}), "Invalid lang at rows: expected a boolean or an object"),
        (json!({"type":"text","multiple":"yes","lang":null}), "Invalid multiple at rows: expected a boolean, only or an object"),
        (json!({"type":"group","multiple":"ONLY","properties":{"name":{"type":"text"}}}), "Invalid multiple at rows: expected a boolean, only or an object"),
        (json!({"type":"group","multiple":{"only":"yes"},"properties":{"name":{"type":"text"}}}), "Invalid multiple.only at rows: expected a boolean"),
        (json!({"type":"group","multiple":{"only":true,"title":"name","max":3},"properties":{"name":{"type":"text"}}}), "Invalid multiple.max at rows: unknown key"),
        (json!({"type":"group","multiple":{"sortable":true,"only":true},"properties":{"name":{"type":"text"}}}), "Invalid multiple.sortable at rows: unknown key"),
        (json!({"type":"group","multiple":{"only":true,"controls":"footer"},"properties":{"name":{"type":"text"}}}), "Invalid multiple.controls at rows: unknown key"),
        (json!({"type":"group","multiple":{"only":true,"onclick":"x()"},"properties":{"name":{"type":"text"}}}), "Invalid multiple.onclick at rows: unknown key"),
        (json!({"type":"group","multiple":{"only":true,"copy":false},"properties":{"name":{"type":"text"}}}), "Invalid multiple.copy at rows: unknown key"),
        (json!({"type":"group","multiple":{"only":true,"min":0},"properties":{"name":{"type":"text"}}}), "Invalid multiple.min at rows: unknown key"),
        (json!({"type":"group","multiple":{"title":"tags"},"properties":{"tags":{"type":"text","multiple":"only"}}}), "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang"),
        (json!({"type":"text","lang":null,"design":[]}), "Invalid lang at rows: expected a boolean or an object"),
        (json!({"type":"text","lang":{"only":"ko"}}), "Invalid lang.only at rows: expected a list of language codes or an object"),
        (json!({"type":"text","lang":{"only":null}}), "Invalid lang.only at rows: expected a list of language codes or an object"),
        (json!({"type":"text","lang":{"only":["ko",3]},"design":[]}), "Invalid lang.only at rows: expected a list of language codes or an object"),
    ] {
        let spec = json!({"type":"group","properties":{"rows":field}});
        assert_eq!(compile_form(&spec, &CompileOptions::default()).unwrap_err().message, message);
    }
}

#[test]
fn closed_declaration_buckets_reject_unknown_keys() {
    for (field, message) in [
        (
            json!({"type":"group","multiple":{"min":1,"foo":1,"bar":2}}),
            "Invalid multiple.foo at items: unknown key",
        ),
        (
            json!({"type":"group","multiple":{"min":"x","foo":1}}),
            "Invalid multiple.foo at items: unknown key",
        ),
        (
            json!({"type":"group","multiple":{"title":"missing","foo":1}}),
            "Invalid multiple.foo at items: unknown key",
        ),
        (
            json!({"type":"group","multiple":"yes"}),
            "Invalid multiple at items: expected a boolean, only or an object",
        ),
        (
            json!({"type":"text","lang":{"mode":"append","langs":["ko"],"only":"ko"}}),
            "Invalid lang.langs at items: unknown key",
        ),
        (
            json!({"type":"text","lang":{"only":"ko","langs":["ko"]}}),
            "Invalid lang.langs at items: unknown key",
        ),
        (
            json!({"type":"text","multiple":{"foo":1},"lang":{"bar":1}}),
            "Invalid multiple.foo at items: unknown key",
        ),
        (
            json!({"type":"text","lang":{"bar":1},"design":{"baz":1}}),
            "Invalid lang.bar at items: unknown key",
        ),
        (
            json!({"type":"text","design":{"class":"a","text":"x","show":[]}}),
            "Invalid design.text at items: unknown key",
        ),
        (
            json!({"type":"text","design":{"show":[],"text":"x"}}),
            "Invalid design.text at items: unknown key",
        ),
        (
            json!({"type":"text","design":{"label":{"class":"lbl","text":"Name","style":[]}}}),
            "Invalid design.label.text at items: unknown key",
        ),
        (
            json!({"type":"text","design":{"prepend":{"style":[],"text":"Name"}}}),
            "Invalid design.prepend.text at items: unknown key",
        ),
        (
            json!({"type":"text","design":{"wrapper":{"class":[]},"group":{"text":"x"}}}),
            "Invalid design.wrapper.class at items: expected a string or a condition map",
        ),
        (
            json!({"type":"text","design":{"wrapper":{"text":"x"},"label":{"class":[]}}}),
            "Invalid design.label.class at items: expected a string or a condition map",
        ),
        (
            json!({"type":"text","design":{"group":"x","wrapper":{"text":"x"}}}),
            "Invalid design.wrapper.text at items: unknown key",
        ),
        (
            json!({"type":"text","design":{"class":[]},"behavior":{"onsubmit":"x"}}),
            "Invalid design.class at items: expected a string or a condition map",
        ),
        (
            json!({"type":"text","behavior":{"onchange":"a","onsubmit":"x","onblur":"y"}}),
            "Invalid behavior.onsubmit at items: unknown key",
        ),
    ] {
        let spec = json!({"type":"group","properties":{"items":field}});
        let error = compile_form(&spec, &CompileOptions::default()).unwrap_err();
        assert_eq!(
            (
                error.code.as_str(),
                error.message.as_str(),
                error.at.as_str()
            ),
            ("INVALID_FORM_INPUT", message, "")
        );
    }
    let spec = json!({"type":"group","properties":{"name":{"type":"text","design":{"label":{"text":"Name"}}}}});
    assert_eq!(
        compile_form(&spec, &CompileOptions::default())
            .unwrap_err()
            .message,
        "Invalid design.label.text at name: unknown key"
    );
    let spec =
        json!({"type":"group","properties":{"name":{"type":"text","behavior":{"onsubmit":"x"}}}});
    assert_eq!(
        compile_form(&spec, &CompileOptions::default())
            .unwrap_err()
            .message,
        "Invalid behavior.onsubmit at name: unknown key"
    );
    let spec = json!({"type":"group","properties":{"name":{"type":"text"}},"buttons":[{"type":"submit","behavior":{"onsubmit":"x"}}]});
    assert_eq!(
        compile_form(&spec, &CompileOptions::default())
            .unwrap_err()
            .message,
        "Invalid behavior.onsubmit at form.buttons.0: unknown key"
    );
    let spec = json!({"type":"group","properties":{"name":{"type":"text","options":{"future":1},"validate":{"future":1}}}});
    assert!(compile_form(&spec, &CompileOptions::default()).is_ok());
}

#[test]
fn row_keys_are_bounded_and_random_keys_are_hexadecimal() {
    assert_eq!(sequence_row_key("0").unwrap(), "__0000000000000__");
    assert_eq!(
        sequence_row_key("9999999999999").unwrap(),
        "__9999999999999__"
    );
    for value in ["", "-1", "1.5", "10000000000000"] {
        assert!(sequence_row_key(value).is_err());
    }
    let keys = (0..100)
        .map(|_| create_row_key().unwrap())
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(keys.len(), 100);
    for key in keys {
        assert_eq!(key.len(), 17);
        assert!(key[2..15].bytes().all(|c| c.is_ascii_hexdigit()));
    }
}

/// The record of a fixture case: the result, or the error of a case that expects one, whose code must be the
/// expected code; an error in a case that expects none fails the test.
fn settled(case: &Value, result: FormResult<Value>) -> Value {
    if let Some(expected) = case.get("expectError") {
        assert_eq!(
            result.as_ref().unwrap_err().code,
            expected["code"].as_str().unwrap(),
            "{}",
            case["name"]
        );
    } else {
        assert!(
            result.is_ok(),
            "{}: {:?}",
            case["name"],
            result.as_ref().err()
        );
    }
    match result {
        Ok(value) => value,
        Err(error) => {
            json!({"name": case["name"], "error": {"code": error.code, "message": error.message, "at": error.at}})
        }
    }
}

#[test]
fn native_fixture_records() {
    let forms: Vec<Value> = serde_json::from_str(include_str!(
        "../../../../tests/fixtures/form-render/cases.json"
    ))
    .unwrap();
    let lists: Vec<Value> = serde_json::from_str(include_str!(
        "../../../../tests/fixtures/list-render/cases.json"
    ))
    .unwrap();
    let form_records = forms
        .iter()
        .map(|case| {
            let options = CompileOptions {
                files: case["options"]["files"]
                    .as_object()
                    .cloned()
                    .unwrap_or_default(),
                basepath: case["options"]["basepath"].as_str().unwrap_or("").into(),
                key_prefix: case["options"]["keyPrefix"].as_str().map(str::to_owned),
                ..Default::default()
            };
            let result = compile_form(&case["spec"], &options).and_then(|template| {
                let bind: BindOptions =
                    serde_json::from_value(case.get("options").cloned().unwrap_or(json!({})))
                        .unwrap();
                let fields = bind_form(&template, case.get("data").unwrap_or(&json!({})), &bind)?;
                let data = case.get("data").cloned().unwrap_or(json!({}));
                let language = case["options"]["language"].as_str().unwrap_or("ko");
                let html = crate::render::render_form_html(
                    &fields,
                    &template,
                    &data,
                    language,
                    &crate::form_render::RenderModel::default(),
                )?;
                Ok(json!({"name":case["name"],"template":template,"fields":fields,"html":html}))
            });
            settled(case, result)
        })
        .collect::<Vec<_>>();
    let list_records=lists.iter().map(|case| {
        let options=ListOptions {
            files:case["options"]["files"].as_object().cloned().unwrap_or_default(),
            basepath:case["options"]["basepath"].as_str().unwrap_or("").into(),
            language:case["options"]["language"].as_str().unwrap_or("ko").into(),
            data:case["options"].get("data").cloned().unwrap_or(Value::Null),
            page:case["options"].get("page").cloned().unwrap_or(Value::Null),
            total:case["options"].get("total").cloned().unwrap_or(Value::Null),
            layout:case["options"].get("layout").cloned().unwrap_or(Value::Null),
            ..Default::default()
        };
        // Rows arrive as decoded JSON, so the rows rule applies here exactly as in the generator command.
        let spec_rule=if case["spec"].is_object() {Ok(())} else {Err(FormError::input("List specification must be an object"))};
        // renderList checks the layout before composition and buildList does not read it, so the
        // HTML is rendered first.
        let result=spec_rule.and_then(|()|list_rows(case.get("rows"))).and_then(|rows|{
            let html=render_list(&case["spec"],rows,&options)?;
            Ok(json!({"name":case["name"],"model":build_list(&case["spec"],rows,&options)?,"html":html}))
        });
        settled(case, result)
    }).collect::<Vec<_>>();
    if let Ok(path) = std::env::var("CRUDUI_GENERATOR_FIXTURE_OUTPUT") {
        assert!(
            std::path::Path::new(&path).is_absolute(),
            "Fixture output requires an explicit absolute path"
        );
        std::fs::write(
            path,
            serde_json::to_vec(&json!({"forms":form_records,"lists":list_records})).unwrap(),
        )
        .unwrap();
    }
}

#[test]
fn number_cells_preserve_decimal_rounding_and_exponent_notation() {
    let rows = vec![
        json!({"number":2.5}),
        json!({"number":-2.5}),
        json!({"number":1.005}),
        json!({"number":1e21}),
        json!({"number":-0.0}),
        json!({"number":" 12.5 "}),
        json!({"number":"0x10"}),
    ];
    for (decimals, expected) in [
        (0, vec!["3", "-3", "1", "1e+21", "0", "13", "16"]),
        (
            2,
            vec!["2.50", "-2.50", "1.00", "1e+21", "0.00", "12.50", "16.00"],
        ),
    ] {
        let spec = json!({"columns":{"n":{"field":"number","format":{"type":"number","decimals":decimals}}}});
        let model = build_list(&spec, &rows, &ListOptions::default()).unwrap();
        let actual = model["rows"]
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["cells"][0]["display"].as_str().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(actual, expected);
    }
    for decimals in [json!(101), json!(-1)] {
        let spec = json!({"columns":{"n":{"field":"number","format":{"type":"number","decimals":decimals}}}});
        let error = build_list(&spec, &rows, &ListOptions::default()).unwrap_err();
        assert_eq!(error.code, "INVALID_FORM_INPUT");
        assert_eq!(error.message, "Number decimals must be between 0 and 100");
        assert_eq!(error.at, "");
    }
    let spec =
        json!({"columns":{"n":{"field":"number","format":{"type":"number","decimals":100}}}});
    let model = build_list(&spec, &[json!({"number":1})], &ListOptions::default()).unwrap();
    assert_eq!(
        model["rows"][0]["cells"][0]["display"],
        format!("1.{}", "0".repeat(100))
    );
}

#[test]
fn text_truncation_counts_code_points_of_a_numeric_limit() {
    for (truncate, value, expected) in [
        (json!(2), "a😀bc", "a😀…"),
        (json!(3), "가나다라마", "가나다…"),
        (json!("2"), "abcd", "abcd"),
        (json!(0.5), "abc", "abc"),
        (json!(2.9), "abcd", "ab…"),
        (json!(4), "abcd", "abcd"),
        (json!(-1), "abcd", "abcd"),
    ] {
        let spec = json!({"fields":{"v":{"field":"v","label":"V","format":{"type":"text","truncate":truncate}}}});
        let html =
            crate::render_detail(&spec, &json!({"v":value}), &ListOptions::default()).unwrap();
        assert!(
            html.contains(&format!(
                r#"<dd class="crudui-detail__value crudui-value crudui-value--text">{expected}</dd>"#
            )),
            "{truncate}: {html}"
        );
    }
}

#[test]
fn list_input_errors_follow_contract_order() {
    let valid = json!({"columns":{"n":{"field":"n"}}});
    let options = |data: Value, layout: &str| ListOptions {
        data,
        layout: layout.into(),
        ..Default::default()
    };
    let page_total = |page: Value, total: Value| ListOptions {
        page,
        total,
        layout: json!(5),
        ..Default::default()
    };
    let page_message = "List page must be a positive integer";
    let total_message = "List total must be a nonnegative integer";
    for (options, message) in [
        (
            ListOptions {
                data: json!([]),
                ..page_total(json!("2"), json!(-1))
            },
            "List context must be an object",
        ),
        (page_total(json!(0), json!(-1)), page_message),
        (page_total(json!("2"), Value::Null), page_message),
        (page_total(json!(true), Value::Null), page_message),
        (page_total(json!({}), Value::Null), page_message),
        (page_total(json!([1]), Value::Null), page_message),
        (page_total(json!(1.5), Value::Null), page_message),
        (page_total(json!(-1), Value::Null), page_message),
        (page_total(json!(-0.0), Value::Null), page_message),
        (
            page_total(json!(9007199254740992_u64), Value::Null),
            page_message,
        ),
        (
            page_total(json!(9007199254740992.0), Value::Null),
            page_message,
        ),
        (page_total(json!(1e300), Value::Null), page_message),
        (page_total(Value::Null, json!(-1)), total_message),
        (page_total(json!(1), json!(-1.0)), total_message),
        (page_total(Value::Null, json!(0.5)), total_message),
        (page_total(Value::Null, json!(false)), total_message),
        (page_total(Value::Null, json!("0")), total_message),
        (
            page_total(Value::Null, json!(9007199254740992_u64)),
            total_message,
        ),
    ] {
        for error in [
            render_list(&valid, &[], &options).unwrap_err(),
            build_list(&valid, &[], &options).unwrap_err(),
        ] {
            assert_eq!(
                (
                    error.code.as_str(),
                    error.message.as_str(),
                    error.at.as_str()
                ),
                ("INVALID_FORM_INPUT", message, "")
            );
        }
    }
    let paginated = json!({"columns":{"n":{"field":"n"}},"pagination":true});
    for (page, total, expected, attrs) in [
        (
            json!(2.0),
            json!(-0.0),
            json!({"enabled":true,"perPage":20,"mode":"pages","page":2,"total":0,"pageCount":1,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"page","page":1,"label":"1페이지","current":true,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}),
            r#"data-page="2" data-total="0""#,
        ),
        (
            json!(9007199254740991_u64),
            json!(9007199254740991.0),
            json!({"enabled":true,"perPage":20,"mode":"pages","page":9007199254740991_u64,"total":9007199254740991_u64,"pageCount":450359962737050_u64,"buttons":[{"role":"previous","page":450359962737049_u64,"label":"이전 페이지","current":false,"disabled":false},{"role":"page","page":1,"label":"1페이지","current":false,"disabled":false},{"role":"page","page":450359962737049_u64,"label":"450359962737049페이지","current":false,"disabled":false},{"role":"page","page":450359962737050_u64,"label":"450359962737050페이지","current":true,"disabled":true},{"role":"next","page":450359962737050_u64,"label":"다음 페이지","current":false,"disabled":true}]}),
            r#"data-page="9007199254740991" data-total="9007199254740991""#,
        ),
        (
            json!(1),
            Value::Null,
            json!({"enabled":true,"perPage":20,"mode":"pages","page":1,"pageCount":0,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}),
            r#"data-page="1""#,
        ),
        (
            Value::Null,
            Value::Null,
            json!({"enabled":true,"perPage":20,"mode":"pages","page":1,"pageCount":0,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}),
            "crudui-list__pagination",
        ),
    ] {
        let options = ListOptions {
            page,
            total,
            ..Default::default()
        };
        let model = build_list(&paginated, &[], &options).unwrap();
        assert_eq!(model["pagination"], expected);
        assert_eq!(
            serde_json::to_string(&model["pagination"]).unwrap(),
            serde_json::to_string(&expected).unwrap()
        );
        let html = render_list(&paginated, &[], &options).unwrap();
        assert!(html.contains(attrs), "{html}");
        assert!(!html.contains(".0\""), "{html}");
    }
    assert_eq!(
        list_rows(Some(&json!({}))).unwrap_err().message,
        "List rows must be an array"
    );
    assert!(list_rows(None).unwrap().is_empty());
    for (spec, rows, options, message) in [
        (
            json!([]),
            vec![json!(1)],
            options(json!("s"), "grid"),
            "List specification must be an object",
        ),
        (
            json!("list"),
            vec![],
            options(json!({}), "table"),
            "List specification must be an object",
        ),
        (
            valid.clone(),
            vec![json!(1)],
            options(json!("s"), "grid"),
            "List rows must be objects",
        ),
        (
            valid.clone(),
            vec![json!([])],
            options(json!({}), "table"),
            "List rows must be objects",
        ),
        (
            valid.clone(),
            vec![],
            options(json!([]), "grid"),
            "List context must be an object",
        ),
        (
            valid.clone(),
            vec![],
            options(json!("s"), "table"),
            "List context must be an object",
        ),
        (
            valid.clone(),
            vec![],
            options(json!({}), "grid"),
            "List layout must be table or card",
        ),
    ] {
        let error = render_list(&spec, &rows, &options).unwrap_err();
        assert_eq!(
            (
                error.code.as_str(),
                error.message.as_str(),
                error.at.as_str()
            ),
            ("INVALID_FORM_INPUT", message, "")
        );
        if message != "List layout must be table or card" {
            assert_eq!(
                build_list(&spec, &rows, &options).unwrap_err().message,
                message
            );
        }
    }
    assert!(render_list(&valid, &[json!({"n":1})], &options(Value::Null, "table")).is_ok());
}

#[test]
fn number_cells_parse_radix_strings_and_ecmascript_whitespace() {
    for (value, decimals, expected) in [
        (json!("0x10"), json!(2), "16.00"),
        (json!("0b101"), Value::Null, "5"),
        (json!("0o17"), Value::Null, "15"),
        (
            json!("0xbeddbd88a491d408d0415072f52b9a13fda"),
            Value::Null,
            "1.0391742914815888e+42",
        ),
        (json!("\u{feff}\u{a0} 16 \u{3000}"), json!(2), "16.00"),
        (json!("\u{85}16"), json!(2), "\u{85}16"),
        (json!("0x+10"), Value::Null, "0x+10"),
        (json!("0x1_0"), Value::Null, "0x1_0"),
        (json!(1.25), json!("1"), "1.25"),
        (json!(1.25), json!(2.9), "1.25"),
        (json!(1.25), json!(-0.9), "1"),
        (json!("1e999"), json!(2), "1e999"),
    ] {
        let spec = json!({"columns":{"number":{"field":"number","format":{"type":"number","decimals":decimals}}}});
        let model = build_list(&spec, &[json!({"number":value})], &ListOptions::default()).unwrap();
        assert_eq!(model["rows"][0]["cells"][0]["display"], expected);
    }
}

#[test]
fn clone_has_independent_data_models_and_revision() {
    let original = Form::new(template(), &record(), BindOptions::default()).unwrap();
    let mut cloned = original.clone();
    cloned.set_value("memo", json!("changed")).unwrap();
    assert_eq!(original.get_data()["memo"], "saved");
    assert_eq!(original.revision(), 0);
    assert_eq!(cloned.get_data()["memo"], "changed");
    assert_eq!(cloned.revision(), 1);
    assert_ne!(
        render_form(&original, None).unwrap(),
        render_form(&cloned, None).unwrap()
    );
}

#[test]
fn compilation_preserves_original_error_trace() {
    let spec = json!({"type":"group","properties":{"$ref":"missing.json"}});
    let error = compile_form(&spec, &CompileOptions::default()).unwrap_err();
    assert_eq!(error.code, "REF_FILE_NOT_FOUND");
    assert!(!error.trace.is_empty());
    assert_eq!(error.at, error.trace.join("."));
}

#[test]
fn css_values_preserve_nested_separators_comments_and_escapes() {
    let css="--caption: \"one;two:three\"; background-image: url(\"data:image/svg+xml;utf8,<svg></svg>\"); --payload: {key:value;items:[a;b]}; width: calc(100% - 2px)";
    assert_eq!(crate::css::style_string(css), css);
    assert_eq!(crate::css::style_string("/* first;: */ color/**/: red; --token: a\\;b; --note: \"/* text;: */\"; width: var(--size /* ;: */, 12px)"),"color: red; --token: a\\;b; --note: \"/* text;: */\"; width: var(--size /* ;: */, 12px)");
    let css = "color:red!important; color:blue; --name: \"a;b\"";
    let template = compile_form(
        &json!({"type":"group","properties":{
            "plain":{"type":"text","design":{"style":css}},
            "raw":{"type":"text","behavior":{"onchange":"changed()"},"design":{"style":css}}
        }}),
        &CompileOptions::default(),
    )
    .unwrap();
    let form = Form::new(template, &json!({}), BindOptions::default()).unwrap();
    let model_css = "color: red!important; color: blue; --name: \"a;b\"";
    for field in form.fields() {
        assert_eq!(field["widget"]["attrs"]["style"], model_css);
    }
    let html = render_form(&form, None).unwrap();
    assert!(html.contains("style=\"color:blue;--name:&quot;a;b&quot;\""));
    assert!(html.contains("style=\"color: red!important; color: blue; --name: &quot;a;b&quot;\""));
}

#[test]
fn lists_emit_ordered_image_preloads_and_preserve_raw_html_behavior() {
    let spec = json!({"columns":{
        "image":{"field":"image","format":"image"},
        "link":{"field":"image","format":{"type":"link","href":{"true":"javascript:alert(1)"}}},
        "raw":{"field":"raw","format":"html"}
    },"actions":{"raw":{"format":{"type":"link","href":"javascript:raw()"}}}});
    let rows = vec![
        json!({"image":"/first.png","raw":"<img src=\"/raw.png\">"}),
        json!({"image":"/first.png"}),
        json!({"image":"data:image/png;base64,AAAA"}),
        json!({"image":"/second.png"}),
        json!({"image":""}),
    ];
    let html = render_list(&spec, &rows, &ListOptions::default()).unwrap();
    assert!(html.starts_with("<link rel=\"preload\" as=\"image\" href=\"/first.png\"/><link rel=\"preload\" as=\"image\" href=\"/second.png\"/>"));
    assert_eq!(html.matches("rel=\"preload\"").count(), 2);
    assert!(html.contains("javascript:throw new Error(&#x27;React has blocked a javascript: URL as a security precaution.&#x27;)"));
    assert!(html.contains("href=\"javascript:raw()\""));
    assert!(html.contains("<img src=\"/raw.png\">"));
    assert!(!html.contains("src=\"\""));
}

#[test]
fn display_defaults_do_not_replace_explicit_null() {
    for kind in ["dummy", "html", "static"] {
        let template = compile_form(
            &json!({"type":"group","properties":{"display":{"type":kind,"default":"default"}}}),
            &CompileOptions::default(),
        )
        .unwrap();
        assert_eq!(
            bind_form(&template, &json!({}), &BindOptions::default()).unwrap()[0]["widget"]
                ["rawHtml"],
            "default"
        );
        assert_eq!(
            bind_form(&template, &json!({"display":null}), &BindOptions::default()).unwrap()[0]
                ["widget"]["rawHtml"],
            ""
        );
    }
}

#[test]
fn form_buttons_default_declared_and_rejected() {
    let plain = compile_form(
        &json!({"type":"group","properties":{"name":{"type":"text"}}}),
        &CompileOptions::default(),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(&plain.buttons).unwrap(),
        json!([{"type":"submit"}])
    );
    let form = Form::new(
        plain,
        &json!({}),
        BindOptions {
            language: "en".into(),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(render_form(&form, None).unwrap().ends_with("</div><div class=\"crudui-form__footer\"><div class=\"crudui-controls\" role=\"group\" aria-label=\"Form actions\"><button type=\"submit\" class=\"crudui-action crudui-action--text\">Save</button></div></div></div>"));
    let declared = compile_form(&json!({"type":"group","action":{"method":"post","url":"/save"},"buttons":[
        {"type":"submit","name":"__submitted__","value":"go","text":{"ko":"저장하기","en":"Save now"},"design":{"class":"primary"}},
        {"type":"reset"},
        {"type":"button","text":"Cancel","behavior":{"onclick":"history.back()"}},
        {"type":"link","text":"List","href":"../?a=1&b=\"2\""}],"properties":{"name":{"type":"text"}}}), &CompileOptions::default()).unwrap();
    assert_eq!(
        serde_json::to_value(&declared.action).unwrap(),
        json!({"method":"post","url":"/save"})
    );
    let form = Form::new(declared, &json!({}), BindOptions::default()).unwrap();
    assert!(render_form(&form, None).unwrap().contains("<button type=\"submit\" class=\"crudui-action crudui-action--text primary\" name=\"__submitted__\" value=\"go\">저장하기</button><button type=\"reset\" class=\"crudui-action crudui-action--text\">초기화</button><button type=\"button\" class=\"crudui-action crudui-action--text\" onclick=\"history.back()\">Cancel</button><a class=\"crudui-action crudui-action--text\" href=\"../?a=1&amp;b=&quot;2&quot;\">List</a>"));
    for (spec, message) in [
        (
            json!({"type":"group","buttons":{},"properties":{}}),
            "Invalid buttons at form: expected a list of buttons",
        ),
        (
            json!({"type":"group","buttons":[{"type":"image"}],"properties":{}}),
            "Invalid buttons.0.type at form: expected submit, reset, button or link",
        ),
        (
            json!({"type":"group","buttons":[{"type":"button"}],"properties":{}}),
            "Invalid buttons.0.text at form: expected content for this button type",
        ),
        (
            json!({"type":"group","buttons":[{"type":"link","text":"List"}],"properties":{}}),
            "Invalid buttons.0.href at form: expected a link target",
        ),
        (
            json!({"type":"group","buttons":[{"type":"submit","value":1}],"properties":{}}),
            "Invalid buttons.0.value at form: expected a string",
        ),
        (
            json!({"type":"group","action":"post","properties":{}}),
            "Invalid action at form: expected an object",
        ),
        (
            json!({"type":"group","properties":{"rows":{"type":"group","buttons":[],"properties":{}}}}),
            "Invalid buttons at rows: expected the form root",
        ),
    ] {
        assert_eq!(
            compile_form(&spec, &CompileOptions::default())
                .unwrap_err()
                .message,
            message
        );
    }
}

/// An object with members inserted in exactly the given order.
fn written(members: &[(&str, Value)]) -> Value {
    Value::Object(serde_json::Map::from_iter(
        members
            .iter()
            .map(|(name, value)| ((*name).to_string(), value.clone())),
    ))
}

fn member_names(value: &Value) -> Vec<&str> {
    value
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect()
}

#[test]
fn specifications_are_read_in_member_order_and_data_is_not() {
    let text = json!({"type":"text"});
    let properties = written(&[("b", text.clone()), ("10", text.clone()), ("a", text)]);
    let template = compile_form(
        &json!({"type":"group","properties":properties}),
        &CompileOptions::default(),
    )
    .unwrap();
    let names = template
        .fields
        .iter()
        .map(|field| field.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(names, vec!["10", "b", "a"]);

    // A template written in another order binds in member order, and the record keeps its order.
    let items = written(&[("b", json!("B")), ("10", json!("Ten"))]);
    let unordered = FormTemplate {
        kind: "crudui/form-template".into(),
        key_prefix: None,
        fields: vec![FieldTemplate {
            name: "choice".into(),
            spec: json!({"type":"select","items":items})
                .as_object()
                .cloned()
                .unwrap(),
            children: Vec::new(),
        }],
        buttons: Vec::new(),
        action: None,
        description: None,
    };
    let data = written(&[("choice", json!("b")), ("z", json!(1)), ("5", json!(2))]);
    let fields = bind_form(&unordered, &data, &BindOptions::default()).unwrap();
    let bound = serde_json::to_string(&fields).unwrap();
    assert!(
        bound.find("Ten").unwrap() < bound.find("\"B\"").unwrap(),
        "{bound}"
    );
    let form = Form::new(unordered.clone(), &data, BindOptions::default()).unwrap();
    assert_eq!(
        member_names(&form.template().fields[0].spec["items"]),
        vec!["10", "b"]
    );
    assert_eq!(member_names(&form.get_data()), vec!["choice", "z", "5"]);
    assert_eq!(
        member_names(&unordered.fields[0].spec["items"]),
        vec!["b", "10"]
    );

    let column = |field: &str| json!({"field":field});
    let columns = written(&[
        ("b", column(".b")),
        ("10", column(".ten")),
        ("a", column(".a")),
    ]);
    let row = written(&[("b", json!("y")), ("10", json!("z"))]);
    let list = build_list(
        &json!({"columns":columns.clone()}),
        std::slice::from_ref(&row),
        &ListOptions::default(),
    )
    .unwrap();
    let keys = list["columns"]
        .as_array()
        .unwrap()
        .iter()
        .map(|column| column["key"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(keys, vec!["10", "b", "a"]);
    let detail = build_detail(&json!({"fields":columns}), &row, &ListOptions::default()).unwrap();
    let keys = detail["fields"]
        .as_array()
        .unwrap()
        .iter()
        .map(|field| field["key"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(keys, vec!["10", "b", "a"]);
    assert_eq!(member_names(&row), vec!["b", "10"]);
}

#[test]
fn closed_buckets_report_unknown_keys_in_member_order() {
    let multiple = written(&[("z", json!(1)), ("5", json!(1))]);
    let error = compile_form(
        &json!({"type":"group","properties":{"rows":{"type":"text","multiple":multiple}}}),
        &CompileOptions::default(),
    )
    .unwrap_err();
    assert_eq!(error.message, "Invalid multiple.5 at rows: unknown key");
}

fn display_error(result: FormResult<Value>) -> (String, String, String) {
    let error = result.unwrap_err();
    (error.code, error.message, error.at)
}

fn invalid(message: &str) -> (String, String, String) {
    ("INVALID_FORM_INPUT".into(), message.into(), String::new())
}

#[test]
fn list_and_detail_designs_follow_the_form_declaration_rules() {
    let options = ListOptions::default();
    let list = |spec: Value| display_error(build_list(&spec, &[], &options));
    let detail = |spec: Value| display_error(build_detail(&spec, &json!({}), &options));
    assert_eq!(
        list(json!({"columns":{"name":{"field":"name","design":{"main":{"class":"x"}}}}})),
        invalid("Invalid design.main at columns.name: unknown key")
    );
    assert_eq!(
        list(json!({"design":{"color":"red"},"columns":{}})),
        invalid("Invalid design.color at list: unknown key")
    );
    assert_eq!(
        list(json!({"columns":{"name":{"design":{"show":1}}}})),
        invalid("Invalid design.show at columns.name: expected an expression, a boolean or a condition map")
    );
    assert_eq!(
        detail(json!({"fields":{"name":{"design":{"label":{"text":"x"}}}}})),
        invalid("Invalid design.label.text at fields.name: unknown key")
    );
    assert_eq!(
        detail(json!({"design":{"wrapper":"box"},"fields":{}})),
        invalid("Invalid design.wrapper at detail: expected an object")
    );
    assert_eq!(
        list(json!({"design":"x","columns":{}})),
        invalid("Invalid design at list: expected a boolean or an object")
    );
    assert_eq!(
        detail(json!({"fields":{"name":{"design":{"class":1}}}})),
        invalid("Invalid design.class at fields.name: expected a string or a condition map")
    );
    let valid = json!({"show":true,"class":"a","style":{"x":"y"},"label":{"class":"b"},"wrapper":{},"group":{"style":"c"},"prepend":{"class":"d"}});
    assert!(build_list(
        &json!({"design":valid.clone(),"columns":{"name":{"design":valid.clone()}}}),
        &[],
        &options
    )
    .is_ok());
    assert!(build_detail(
        &json!({"design":valid.clone(),"fields":{"name":{"design":valid}}}),
        &json!({}),
        &options
    )
    .is_ok());
}

#[test]
fn display_designs_are_checked_own_first_then_members_in_member_order() {
    let options = ListOptions::default();
    let bad = |key: &str| json!({"design":{key:1}});
    let members = written(&[("b", bad("zb")), ("10", bad("z10")), ("a", bad("za"))]);
    assert_eq!(
        display_error(build_list(
            &json!({"columns":members.clone()}),
            &[],
            &options
        )),
        invalid("Invalid design.z10 at columns.10: unknown key")
    );
    assert_eq!(
        display_error(build_detail(
            &json!({"fields":members.clone()}),
            &json!({}),
            &options
        )),
        invalid("Invalid design.z10 at fields.10: unknown key")
    );
    assert_eq!(
        display_error(build_list(
            &json!({"columns":members.clone(),"design":{"own":1}}),
            &[],
            &options
        )),
        invalid("Invalid design.own at list: unknown key")
    );
    assert_eq!(
        display_error(build_detail(
            &json!({"fields":members,"design":{"own":1}}),
            &json!({}),
            &options
        )),
        invalid("Invalid design.own at detail: unknown key")
    );
    // Keys of one design are reported in member order as well.
    let design = written(&[("y", json!(1)), ("7", json!(1))]);
    assert_eq!(
        display_error(build_list(
            &json!({"columns":{"n":{"design":design}}}),
            &[],
            &options
        )),
        invalid("Invalid design.7 at columns.n: unknown key")
    );
}

#[test]
fn display_designs_are_checked_after_input_rules_and_composition() {
    let spec = json!({"design":{"color":"red"},"columns":{}});
    assert_eq!(
        display_error(build_list(&spec, &[json!(1)], &ListOptions::default())),
        invalid("List rows must be objects")
    );
    let context = ListOptions {
        data: json!([]),
        ..Default::default()
    };
    assert_eq!(
        display_error(build_list(&spec, &[], &context)),
        invalid("List context must be an object")
    );
    assert_eq!(
        display_error(build_detail(
            &json!({"design":{"color":"red"}}),
            &json!({}),
            &ListOptions::default()
        )),
        invalid("Detail specification must declare fields")
    );
    let options = ListOptions {
        files: serde_json::Map::from_iter([(
            "columns.json".to_string(),
            json!({"properties":{"name":{"design":{"main":{}}}}}),
        )]),
        ..Default::default()
    };
    assert_eq!(
        display_error(build_list(
            &json!({"columns":{"$ref":"columns.json"}}),
            &[],
            &options
        )),
        invalid("Invalid design.main at columns.name: unknown key")
    );
    assert_eq!(
        display_error(build_detail(
            &json!({"fields":{"$ref":"columns.json"}}),
            &json!({}),
            &options
        )),
        invalid("Invalid design.main at fields.name: unknown key")
    );
}

#[test]
fn bind_buttons_and_form_buttons_html_match_the_javascript_output() {
    let template = compile_form(
        &json!({"type":"group","properties":{"title":{"type":"text"}},"buttons":[
            {"type":"link","text":{"ko":"목록","en":"List"},"href":"/list?a=1&b=\"2\""},
            {"type":"submit","name":"mode","value":"draft","text":"Save <draft>"},
            {"type":"button","text":"Preview","design":{"class":"primary","style":"color: red; font-weight: bold"},"behavior":{"onclick":"preview(\"x\")"}},
            {"type":"reset","behavior":{"onclick":{"label":"Clear","script":"clear()"}}}
        ]}),
        &CompileOptions::default(),
    )
    .unwrap();
    let options = BindOptions {
        language: "en".into(),
        ..Default::default()
    };
    let buttons = bind_buttons(&template, &json!({"title":"x"}), &options).unwrap();
    assert_eq!(
        serde_json::to_string(&buttons).unwrap(),
        r#"[{"type":"link","tag":"a","text":"List","attrs":{"class":"crudui-action crudui-action--text","href":"/list?a=1&b=\"2\""}},{"type":"submit","tag":"button","text":"Save <draft>","attrs":{"type":"submit","class":"crudui-action crudui-action--text","name":"mode","value":"draft"}},{"type":"button","tag":"button","text":"Preview","attrs":{"type":"button","class":"crudui-action crudui-action--text primary","style":"color: red; font-weight: bold","onclick":"preview(\"x\")"}},{"type":"reset","tag":"button","text":"Reset","attrs":{"type":"reset","class":"crudui-action crudui-action--text","onclick":"clear()"}}]"#
    );
    assert_eq!(
        form_buttons_html(&json!(buttons)).unwrap(),
        r#"<a class="crudui-action crudui-action--text" href="/list?a=1&amp;b=&quot;2&quot;">List</a><button type="submit" class="crudui-action crudui-action--text" name="mode" value="draft">Save &lt;draft&gt;</button><button type="button" class="crudui-action crudui-action--text primary" style="color: red; font-weight: bold" onclick="preview(&quot;x&quot;)">Preview</button><button type="reset" class="crudui-action crudui-action--text" onclick="clear()">Reset</button>"#
    );

    let default = compile_form(
        &json!({"type":"group","properties":{"title":{"type":"text"}}}),
        &CompileOptions::default(),
    )
    .unwrap();
    let buttons = bind_buttons(&default, &json!({}), &BindOptions::default()).unwrap();
    assert_eq!(
        serde_json::to_string(&buttons).unwrap(),
        r#"[{"type":"submit","tag":"button","text":"저장","attrs":{"type":"submit","class":"crudui-action crudui-action--text"}}]"#
    );
    assert_eq!(
        form_buttons_html(&json!(buttons)).unwrap(),
        r#"<button type="submit" class="crudui-action crudui-action--text">저장</button>"#
    );
    let english = bind_buttons(&default, &json!({}), &options).unwrap();
    assert_eq!(english[0]["text"], "Save");

    for (data, options, message) in [
        (
            json!([]),
            BindOptions::default(),
            "Form data must be an object",
        ),
        (
            json!({}),
            BindOptions {
                language: json!(1),
                ..Default::default()
            },
            "Language must be a string",
        ),
    ] {
        assert_eq!(
            bind_buttons(&default, &data, &options).unwrap_err().message,
            message
        );
    }
    for invalid in [
        json!(null),
        json!({"tag":"script","text":"","attrs":{}}),
        json!({"tag":"a","text":1,"attrs":{}}),
        json!({"tag":"a","text":"","attrs":{"href":1}}),
        json!({"tag":"a","text":"","attrs":{"x onload":"y"}}),
        json!({"tag":"a","text":"","attrs":{"id":"y"}}),
        json!({"tag":"a","text":""}),
        json!({"tag":"a","text":"","attrs":[]}),
    ] {
        let error = form_buttons_html(&json!([invalid])).unwrap_err();
        assert_eq!(
            (
                error.code.as_str(),
                error.message.as_str(),
                error.at.as_str()
            ),
            (
                "INVALID_FORM_INPUT",
                "Form buttons must be evaluated button objects",
                ""
            )
        );
    }
    assert_eq!(
        form_buttons_html(&json!([
            json!({"type":1,"tag":"button","text":"x","attrs":{"onclick":"go()"}})
        ]))
        .unwrap(),
        r#"<button onclick="go()">x</button>"#
    );
}

/// A template that is not exactly the compiled shape is rejected when it is read.
/// A declared template keeps its optional members, and a compiled template reads back as it was written.
#[test]
fn template_members_round_trip() {
    let declared = json!({"kind":"crudui/form-template","keyPrefix":"p","action":{"url":"/save"},
        "fields":[{"name":"name","spec":{"type":"text"},"children":[]}],"buttons":[{"type":"submit"}]});
    let template = FormTemplate::from_json(&declared).unwrap();
    assert_eq!(template.key_prefix.as_deref(), Some("p"));
    assert_eq!(serde_json::to_value(&template).unwrap(), declared);
    let compiled = self::template();
    let text = serde_json::to_value(&compiled).unwrap();
    assert_eq!(
        serde_json::from_value::<FormTemplate>(text).unwrap(),
        compiled
    );
}

/// Widget model members follow one output order; a file widget's `extra` has `display` before `file`.
#[test]
fn widget_members_follow_the_output_order() {
    let template = compile_form(
        &json!({"type":"group","properties":{
            "memo":{"type":"textarea","prepend":"P"},"note":{"type":"dummy"},"go":{"type":"button"},
            "pick":{"type":"choice","items":{"a":"A"}},"doc":{"type":"file"}
        }}),
        &CompileOptions::default(),
    )
    .unwrap();
    let nodes = bind_form(&template, &json!({}), &BindOptions::default()).unwrap();
    let mut checked = 0;
    for node in &nodes {
        let Some(widget) = node["widget"].as_object() else {
            continue;
        };
        checked += 1;
        let positions: Vec<usize> = widget
            .keys()
            .map(|key| {
                crate::widget::WIDGET_MEMBERS
                    .iter()
                    .position(|member| member == key)
                    .unwrap_or_else(|| panic!("unordered member {key}"))
            })
            .collect();
        assert!(
            positions.windows(2).all(|pair| pair[0] < pair[1]),
            "{:?}",
            widget.keys()
        );
        if widget["kind"] == "file" {
            assert_eq!(
                widget["extra"]
                    .as_object()
                    .unwrap()
                    .keys()
                    .collect::<Vec<_>>(),
                ["display", "file"]
            );
        }
    }
    assert_eq!(checked, 5);
}

/// The root description is kept in the template and written first in the `crudui-form` block;
/// a list description precedes the actions and a detail writes its actions before the `dl`.
#[test]
fn descriptions_and_detail_actions() {
    let template = compile_form(
        &json!({"type":"group","description":{"en":"A <b> & \"c\""},"properties":{"n":{"type":"text"}}}),
        &CompileOptions::default(),
    )
    .unwrap();
    let text = serde_json::to_string(&template).unwrap();
    assert!(
        text.ends_with(r#""buttons":[{"type":"submit"}],"description":{"en":"A <b> & \"c\""}}"#),
        "{text}"
    );
    assert_eq!(
        FormTemplate::from_json(&serde_json::to_value(&template).unwrap()).unwrap(),
        template
    );
    let options = BindOptions {
        language: "en".into(),
        ..Default::default()
    };
    let form = Form::new(template.clone(), &json!({}), options.clone()).unwrap();
    let html = render_form(&form, None).unwrap();
    assert!(html.starts_with(r#"<div class="crudui-form"><p class="crudui-form__description">A &lt;b&gt; &amp; &quot;c&quot;</p><div class="crudui-form__body">"#), "{html}");
    let empty = compile_form(
        &json!({"type":"group","description":null,"properties":{}}),
        &CompileOptions::default(),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(&empty).unwrap()["description"],
        Value::Null
    );
    let html = render_form(&Form::new(empty, &json!({}), options).unwrap(), None).unwrap();
    assert!(
        html.starts_with(r#"<div class="crudui-form"><div class="crudui-form__body">"#),
        "{html}"
    );

    let list_options = ListOptions {
        language: "en".into(),
        ..Default::default()
    };
    let spec =
        json!({"columns":{"n":{"field":"n"}},"description":"Members","actions":{"go":"go()"}});
    let model = build_list(&spec, &[], &list_options).unwrap();
    let keys = model
        .as_object()
        .unwrap()
        .keys()
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(
        keys,
        [
            "columns",
            "rows",
            "pagination",
            "actions",
            "empty",
            "description",
            "design"
        ]
    );
    let html = render_list(&spec, &[], &list_options).unwrap();
    assert!(html.starts_with(r#"<div class="crudui-list"><p class="crudui-list__description">Members</p><div class="crudui-list__actions">"#), "{html}");
    let rejected = build_list(
        &json!({"columns":{},"description":5,"pagination":"x"}),
        &[],
        &list_options,
    );
    assert_eq!(
        rejected.unwrap_err().message,
        "Invalid description at list: expected a string, a language map or null"
    );

    let detail = json!({"fields":{"n":{"field":"n","label":"N"}},"actions":{"edit":{"label":"Edit","format":{"type":"link","href":"/e"}}}});
    let model = build_detail(&detail, &json!({"n":"x"}), &list_options).unwrap();
    let keys = model
        .as_object()
        .unwrap()
        .keys()
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(keys, ["fields", "actions", "design"]);
    let html = render_detail(&detail, &json!({"n":"x"}), &list_options).unwrap();
    assert!(html.starts_with(r#"<div class="crudui-detail__actions"><span class="crudui-detail__action" data-action="edit"><a href="/e">Edit</a></span></div><dl class="crudui-detail">"#), "{html}");
    let rejected = build_detail(
        &json!({"fields":{},"actions":[]}),
        &json!({}),
        &list_options,
    );
    assert_eq!(
        rejected.unwrap_err().message,
        "Invalid actions at detail: expected an object"
    );
}

#[test]
fn pagination_per_page_that_is_no_integer_is_an_error() {
    let spec = json!({"columns":{"n":{"field":"number"}},"pagination":{"per_page":"ten"}});
    let error = build_list(&spec, &[json!({"number":1})], &ListOptions::default()).unwrap_err();
    assert_eq!(error.code, "INVALID_FORM_INPUT");
    assert_eq!(
        error.message,
        "Invalid pagination.per_page at list: expected a positive integer"
    );
}

#[test]
fn appearance_string_that_does_not_parse_stays_literal_text() {
    let text = "(1 / 0) > 0 ? 'btn-a' : 'btn-b'";
    let data = json!({});
    let path = vec!["tier".to_owned()];
    assert_eq!(
        crate::design::appearance(Some(&json!(text)), &data, &path, &[]),
        text
    );
}

#[test]
fn appearance_ternary_gives_the_branch_value() {
    let data = json!({"tier": 2});
    let path = vec!["tier".to_owned()];
    let class = json!("tier == 2 ? 'btn-a' : 'btn-b'");
    assert_eq!(
        crate::design::appearance(Some(&class), &data, &path, &[]),
        "btn-a"
    );
}

/// CURT-093: a path without a value is absent, a null member is null, and a list item is named by a
/// decimal index without a sign or a leading zero.
#[test]
fn get_value_tells_absence_from_null() {
    let template = compile_form(
        &json!({"type":"group","properties":{
            "memo":{"type":"text"},
            "tags":{"type":"multichoice","items":{"a":"A","b":"B"}}
        }}),
        &CompileOptions::default(),
    )
    .unwrap();
    let form = Form::new(
        template,
        &json!({"memo":null,"tags":["a","b"]}),
        BindOptions::default(),
    )
    .unwrap();
    assert_eq!(form.get_value("memo").unwrap(), Some(Value::Null));
    assert_eq!(form.get_value("missing").unwrap(), None);
    assert_eq!(form.get_value("memo.inner").unwrap(), None);
    assert_eq!(form.get_value("tags.1").unwrap(), Some(json!("b")));
    for segment in ["01", "+1", "-1", "2", "x"] {
        assert_eq!(form.get_value(&format!("tags.{segment}")).unwrap(), None, "{segment}");
    }
}

/// CURP-029: the snapshot holds the fields, the buttons, the revision and the history state; a view
/// change keeps the revision (CURT-067).
#[test]
fn snapshot_reports_the_state_of_the_instance() {
    let mut form = Form::new(template(), &record(), BindOptions::default()).unwrap();
    let first = form.snapshot();
    assert_eq!(first.fields, form.fields());
    assert_eq!(first.buttons, form.buttons());
    assert_eq!((first.revision, first.can_undo, first.can_redo), (0, false, false));
    form.set_value("memo", json!("edited")).unwrap();
    let edited = form.snapshot();
    assert_eq!((edited.revision, edited.can_undo, edited.can_redo), (1, true, false));
    form.set_all_expanded(false).unwrap();
    let collapsed = form.snapshot();
    assert_eq!(collapsed.revision, 1);
    assert_ne!(collapsed.fields, edited.fields);
    form.undo().unwrap();
    let undone = form.snapshot();
    assert_eq!((undone.revision, undone.can_undo, undone.can_redo), (2, false, true));
}
