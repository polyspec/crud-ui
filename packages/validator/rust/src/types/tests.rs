use super::*;

fn parse(s: &str) -> FieldSpec {
    serde_json::from_str(s).expect("valid field spec")
}

#[test]
fn minimal_type_only() {
    let f = parse(r#"{ "type": "email" }"#);
    assert_eq!(f.field_type.as_deref(), Some("email"));
}

#[test]
fn slot_polymorphic_toggle() {
    // behavior:false suppresses composed inheritance (G2).
    let f = parse(r#"{ "type": "text", "behavior": false }"#);
    assert_eq!(f.behavior, Some(Polymorphic::Toggle(false)));

    // validate:true is the short form of an empty configuration (G2).
    let f = parse(r#"{ "type": "text", "validate": true }"#);
    assert_eq!(f.validate, Some(Polymorphic::Toggle(true)));
}

#[test]
fn slot_polymorphic_config() {
    let f = parse(
        r#"{ "type": "email",
             "validate": { "required": ".subscribe", "email": true } }"#,
    );
    match f.validate {
        Some(Polymorphic::Config(v)) => {
            assert_eq!(
                v.required,
                Some(ConditionValue::Single(Value::String(".subscribe".into())))
            );
            assert_eq!(v.email, Some(ConditionValue::Single(Value::Bool(true))));
        }
        other => panic!("expected validate config, got {other:?}"),
    }
}

/// Declared attributes (docs/spec/schema.md, Declared attributes): `design.attributes` and
/// `design.wrapper.attributes` keep their order; other nodes and non-string values fail.
#[test]
fn design_declared_attributes() {
    let text = r#"{"type":"text","design":{"attributes":{"data-setting":"theme","aria-describedby":"help"},"wrapper":{"class":"row","attributes":{"data-section":"look"}}}}"#;
    let f = parse(text);
    assert_eq!(serde_json::to_string(&f).unwrap(), text);
    for invalid in [
        r#"{"design":{"label":{"attributes":{"data-x":"1"}}}}"#,
        r#"{"design":{"attributes":{"data-x":1}}}"#,
        r#"{"design":{"wrapper":{"attributes":"data-x"}}}"#,
    ] {
        assert!(
            serde_json::from_str::<FieldSpec>(invalid).is_err(),
            "accepted {invalid}"
        );
    }
}

/// Layout (docs/spec/schema.md, Layout): `design.layout` is stacked, inline or line.
#[test]
fn design_layout() {
    let text = r#"{"type":"group","design":{"layout":"inline","wrapper":{"class":"section"}}}"#;
    let f = parse(text);
    assert_eq!(serde_json::to_string(&f).unwrap(), text);
    for invalid in [
        r#"{"design":{"layout":"grid"}}"#,
        r#"{"design":{"layout":{".wide":"inline"}}}"#,
    ] {
        assert!(
            serde_json::from_str::<FieldSpec>(invalid).is_err(),
            "accepted {invalid}"
        );
    }
}

#[test]
fn design_node_map() {
    let f = parse(
        r#"{ "type": "text",
             "design": {
               "show": ".subscribe",
               "class": { ".vip": "gold", "true": "plain" },
               "label": { "class": "lbl" }
             } }"#,
    );
    match f.design {
        Some(Polymorphic::Config(d)) => {
            assert!(d.show.is_some());
            // Condition maps preserve declaration order and the true default.
            match d.class {
                Some(ConditionValue::Map(m)) => {
                    let keys: Vec<&String> = m.keys().collect();
                    assert_eq!(keys, vec![".vip", DEFAULT_KEY]);
                }
                other => panic!("expected class condition map, got {other:?}"),
            }
            assert_eq!(
                d.label.and_then(|n| n.class),
                Some(ConditionValue::Single(Value::String("lbl".into())))
            );
        }
        other => panic!("expected design config, got {other:?}"),
    }
}

#[test]
fn type_dependency_isolated_to_options() {
    let f = parse(r#"{ "type": "checkbox", "options": { "checkbox_label": "agree" } }"#);
    match f.options {
        Some(Polymorphic::Config(o)) => {
            assert_eq!(o.checkbox_label, Some(Value::String("agree".into())))
        }
        other => panic!("expected options config, got {other:?}"),
    }
}

#[test]
fn multiple_dependency_isolated_under_multiple() {
    let f = parse(
        r#"{ "type": "group", "multiple": { "min": 1, "max": 5, "sortable": true, "title": "name", "controls": "footer", "header": "sticky" } }"#,
    );
    match f.multiple {
        Some(Multiple::Config(m)) => {
            assert_eq!(m.min, Some(Value::from(1)));
            assert_eq!(m.max, Some(Value::from(5)));
            assert_eq!(m.title, Some(Value::from("name")));
            assert_eq!(m.controls, Some(Value::from("footer")));
            assert_eq!(m.header, Some(Value::from("sticky")));
        }
        other => panic!("expected multiple config, got {other:?}"),
    }
}

// A keyed map declares only and keys under multiple; keys is a reference string.
#[test]
fn multiple_keyed_map_under_multiple() {
    let f = parse(r#"{ "type": "text", "multiple": { "only": true, "keys": "..characters" } }"#);
    match f.multiple {
        Some(Multiple::Config(m)) => {
            assert_eq!(m.only, Some(true));
            assert_eq!(m.keys.as_deref(), Some("..characters"));
        }
        other => panic!("expected multiple config, got {other:?}"),
    }
    assert_eq!(
        parse(r#"{ "type": "text", "multiple": "only" }"#).multiple,
        Some(Multiple::Only(OnlyKeyword::Only))
    );
    for src in [
        r#"{ "type": "text", "multiple": "ONLY" }"#,
        r#"{ "type": "text", "multiple": { "only": true, "keys": 5 } }"#,
        r#"{ "type": "text", "multiple": { "only": "yes", "keys": "..characters" } }"#,
        r#"{ "type": "text", "multiple": { "keys": "..characters" } }"#,
        r#"{ "type": "text", "multiple": { "only": false, "keys": "..characters" } }"#,
    ] {
        let r: Result<FieldSpec, _> = serde_json::from_str(src);
        assert!(r.is_err(), "an invalid keyed map must be rejected: {src}");
    }
}

#[test]
fn lang_dependency_isolated_under_lang() {
    let f = parse(r#"{ "type": "text", "lang": { "mode": "append", "only": ["ko","en"] } }"#);
    match f.lang {
        Some(Polymorphic::Config(l)) => {
            assert_eq!(l.mode, Some(Value::String("append".into())))
        }
        other => panic!("expected lang config, got {other:?}"),
    }
}

#[test]
fn items_dynamic_source() {
    let f = parse(r#"{ "type": "select", "items": { "model": "User", "method": "all" } }"#);
    match f.items {
        Some(Items::Dynamic(s)) => assert_eq!(s.model, Some(Value::String("User".into()))),
        other => panic!("expected dynamic items, got {other:?}"),
    }
}

#[test]
fn items_static_array() {
    let f = parse(r#"{ "type": "select", "items": ["a","b"] }"#);
    assert!(matches!(f.items, Some(Items::Static(_))));
}

// A search source preserves an API callback and placeholder items together.
#[test]
fn items_dynamic_source_api_server_and_placeholder() {
    let f = parse(
        r#"{ "type": "search",
             "items": {
               "api_server": "function() { return '../search'; }",
               "items": []
             } }"#,
    );
    match f.items {
        Some(Items::Dynamic(s)) => {
            assert_eq!(
                s.api_server,
                Some(Value::String("function() { return '../search'; }".into()))
            );
            assert_eq!(s.items, Some(Value::Array(vec![])));
        }
        other => panic!("expected dynamic items, got {other:?}"),
    }
}

// A source preserves a nested model, API callback and placeholder label map.
#[test]
fn items_dynamic_source_nested_model() {
    let f = parse(
        r#"{ "type": "search",
             "items": {
               "model": { "table": "service_member",
                          "relations": [ { "table": "user", "left": "user_seq", "right": "seq" } ],
                          "keys": [ { "table": "service_member", "field": "seq", "append": ". " } ] },
               "api_server": "function() { return '/admin/user/search'; }",
               "items": { "": "선택하세요" }
             } }"#,
    );
    match f.items {
        Some(Items::Dynamic(s)) => {
            // The model remains a nested object.
            match s.model {
                Some(Value::Object(m)) => {
                    assert_eq!(
                        m.get("table"),
                        Some(&Value::String("service_member".into()))
                    );
                    assert!(m.get("relations").unwrap().is_array());
                    assert!(m.get("keys").unwrap().is_array());
                }
                other => panic!("expected nested model object, got {other:?}"),
            }
            assert!(s.api_server.is_some());
            assert!(s.items.is_some());
        }
        other => panic!("expected dynamic items, got {other:?}"),
    }
}

#[test]
fn label_language_map() {
    let f = parse(r#"{ "type": "text", "label": { "ko": "이메일", "en": "Email" } }"#);
    assert!(matches!(f.label, Some(Content::Lang(_))));
}

#[test]
fn composition_ref_and_patch() {
    let f = parse(
        r#"{ "$ref": "Base.yml",
             "$patch": { "field.validate.required": ".other" } }"#,
    );
    assert!(f.ref_.is_some());
    assert!(f.patch.is_some());
}

// deny_unknown_fields rejects forbidden, unrecognized and x-prefixed keys.
#[test]
fn forbidden_meta_keys_rejected_top_level() {
    let mut keys: Vec<String> = FORBIDDEN_META_KEYS.iter().map(|s| s.to_string()).collect();
    keys.push("xclassname".to_string()); // x{key} comment
                                         // Unrecognized names are also invalid at the top level.
    keys.push("multiple_max".to_string());
    keys.push("langs".to_string());
    for k in keys {
        let json = format!(r#"{{ "type": "text", "{k}": true }}"#);
        let r: Result<FieldSpec, _> = serde_json::from_str(&json);
        assert!(
            r.is_err(),
            "forbidden/non-canonical top key must be rejected: {k}"
        );
    }
}

// Open buckets accept extensions but reject every forbidden meta key; closed
// buckets reject a forbidden key as an unknown key.
#[test]
fn forbidden_meta_keys_rejected_one_level_below() {
    for k in FORBIDDEN_META_KEYS {
        // Open options bucket.
        let json = format!(r#"{{ "type": "text", "options": {{ "{k}": true }} }}"#);
        let r: Result<FieldSpec, _> = serde_json::from_str(&json);
        assert!(
            r.is_err(),
            "forbidden key in options bucket must be rejected: {k}"
        );

        // Closed multiple dependency bucket.
        let json = format!(r#"{{ "type": "group", "multiple": {{ "{k}": true }} }}"#);
        let r: Result<FieldSpec, _> = serde_json::from_str(&json);
        assert!(
            r.is_err(),
            "forbidden key in multiple bucket must be rejected: {k}"
        );
    }
    // An x-prefixed comment is invalid inside a canonical bucket.
    let json = r#"{ "type": "text", "options": { "xnote": "comment" } }"#;
    let r: Result<FieldSpec, _> = serde_json::from_str(json);
    assert!(r.is_err(), "x{{key}} comment in bucket must be rejected");
}

// Open buckets preserve widget extension keys.
#[test]
fn open_bucket_allows_extension_keys() {
    let f = parse(r#"{ "type": "widget", "options": { "future_widget_opt": 42 } }"#);
    match f.options {
        Some(Polymorphic::Config(o)) => {
            assert_eq!(
                o.extra.as_map().get("future_widget_opt"),
                Some(&Value::from(42))
            );
        }
        other => panic!("expected options config, got {other:?}"),
    }
}

// Parsing, serializing and parsing again preserves value and declaration order.
#[test]
fn round_trip_preserves_value_and_order() {
    let inputs = [
        r#"{"type":"email","name":"e","validate":{"required":".subscribe","email":true}}"#,
        r#"{"type":"text","design":{"show":".s","class":{".vip":"gold","true":"plain"},"label":{"class":"lbl"}}}"#,
        r#"{"type":"group","multiple":{"max":5,"sortable":true},"properties":{"a":{"type":"text"},"b":{"type":"email"}}}"#,
        r#"{"type":"select","items":{"model":"User","method":"all"},"label":{"ko":"선택","en":"Select"}}"#,
        r#"{"type":"search","items":{"api_server":"function() { return '../search'; }","items":[]}}"#,
        r#"{"type":"search","items":{"model":{"table":"service_member","relations":[{"table":"user","left":"user_seq","right":"seq"}],"keys":[{"table":"service_member","field":"seq","append":". "}]},"api_server":"function() { return '/admin/user/search'; }","items":{"":"선택하세요"}}}"#,
        r#"{"type":"text","behavior":false,"lang":true}"#,
        r#"{"$ref":"Base.yml","$patch":{"field.validate.required":".other"}}"#,
        r#"{"type":"widget","options":{"future_widget_opt":42,"max_tags":3}}"#,
    ];
    for src in inputs {
        let original: Value = serde_json::from_str(src).unwrap();
        let spec: FieldSpec = serde_json::from_value(original.clone()).unwrap();
        let reser = serde_json::to_value(&spec).unwrap();
        assert_eq!(reser, original, "round-trip mismatch for: {src}");
        // A second parse preserves the same typed value.
        let spec2: FieldSpec = serde_json::from_value(reser).unwrap();
        assert_eq!(spec, spec2, "double round-trip mismatch for: {src}");
    }
}

// validate and messages keys are registered rule names.
#[test]
fn rule_keys_are_registered_rules() {
    for src in [
        r#"{"type":"text","validate":{"future_rule":1}}"#,
        r#"{"type":"text","validate":{"required":true,"equalto":".a"}}"#,
        r#"{"type":"text","messages":{"requird":"x"}}"#,
        r#"{"type":"text","messages":{"required":1}}"#,
    ] {
        let r: Result<FieldSpec, _> = serde_json::from_str(src);
        assert!(r.is_err(), "unknown rule key must be rejected: {src}");
    }
    let src = r#"{"type":"text","validate":{"required":true,"minlength":2,"dateISO":true,"step":0.5},"messages":{"number":"n","required":"r"}}"#;
    let original: Value = serde_json::from_str(src).unwrap();
    let spec: FieldSpec = serde_json::from_value(original.clone()).unwrap();
    assert_eq!(serde_json::to_value(&spec).unwrap(), original);
}

// The model has a field for every top-level key of the schema's field definition.
#[test]
fn top_level_keys_are_the_schema_field_keys() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../contracts/schema/crudui.schema.json"
    );
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) => panic!("read {path}: {error}"),
    };
    let schema: Value = match serde_json::from_str(&text) {
        Ok(schema) => schema,
        Err(error) => panic!("parse {path}: {error}"),
    };
    let samples = serde_json::json!({
        "type": "button", "name": "n", "default": 1, "properties": {}, "items": {"model": "m"},
        "multiple": true, "lang": true, "label": "l", "description": "d", "placeholder": "p",
        "prepend": "p", "append": "a", "help": "h", "content": "c", "validate": true,
        "messages": {"required": "r"}, "design": true, "behavior": true, "options": true,
        "buttons": [], "action": {"method": "post"}, "dataLimits": {"depth": 64, "values": 100000},
        "$ref": "Base.yml", "$patch": {},
    });
    let keys: Vec<&String> = schema["definitions"]["Field"]["properties"]
        .as_object()
        .unwrap()
        .keys()
        .collect();
    let sample_keys: Vec<&String> = samples.as_object().unwrap().keys().collect();
    assert_eq!(keys, sample_keys);
    for key in keys {
        let field = serde_json::json!({ key.as_str(): samples[key.as_str()].clone() });
        let r: Result<FieldSpec, _> = serde_json::from_value(field);
        assert!(r.is_ok(), "{key}: {r:?}");
    }
}

#[test]
fn form_data_limits_preserve_numeric_values_and_closed_members() {
    for text in [
        r#"{"dataLimits":{}}"#,
        r#"{"dataLimits":{"depth":2.0}}"#,
        r#"{"dataLimits":{"values":1000000}}"#,
        r#"{"dataLimits":{"depth":256,"values":1}}"#,
    ] {
        let value: Value = serde_json::from_str(text).unwrap();
        let field: FieldSpec = serde_json::from_value(value.clone()).unwrap();
        assert!(field.data_limits.is_some());
        assert_eq!(serde_json::to_value(&field).unwrap(), value);
    }
    for text in [
        r#"{"dataLimits":null}"#,
        r#"{"dataLimits":[]}"#,
        r#"{"dataLimits":{"depth":null}}"#,
        r#"{"dataLimits":{"values":true}}"#,
        r#"{"dataLimits":{"depth":"2"}}"#,
        r#"{"dataLimits":{"maximum":3}}"#,
    ] {
        assert!(
            serde_json::from_str::<FieldSpec>(text).is_err(),
            "accepted {text}"
        );
    }
}

// Closed buckets reject every unknown key, including a design node key.
#[test]
fn closed_buckets_reject_unknown_keys() {
    for src in [
        r#"{"type":"text","design":{"label":{"class":"lbl","text":"Name","style":"x"}}}"#,
        r#"{"type":"text","design":{"class":"a","text":"Name"}}"#,
        r#"{"type":"text","behavior":{"onsubmit":"x"}}"#,
        r#"{"type":"group","multiple":{"min":1,"foo":1}}"#,
        r#"{"type":"text","lang":{"mode":"append","langs":["ko"]}}"#,
    ] {
        let r: Result<FieldSpec, _> = serde_json::from_str(src);
        assert!(
            r.is_err(),
            "unknown key in closed bucket must be rejected: {src}"
        );
    }
    // An open bucket keeps accepting unknown keys.
    let src = r#"{"type":"search","items":{"model":"User","method":"all"}}"#;
    let r: Result<FieldSpec, _> = serde_json::from_str(src);
    assert!(r.is_ok(), "open bucket must accept: {src}");
}

// Condition-map serialization preserves declaration order.
#[test]
fn condition_map_order_preserved_through_serialize() {
    let src = r#"{"type":"text","design":{"class":{".a":"1",".b":"2","true":"d"}}}"#;
    let spec: FieldSpec = serde_json::from_str(src).unwrap();
    let out = serde_json::to_string(&spec).unwrap();
    assert!(
        out.contains(r#"".a":"1",".b":"2","true":"d""#),
        "order lost: {out}"
    );
}
