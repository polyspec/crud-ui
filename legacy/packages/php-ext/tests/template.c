#include "engine_internal.h"

#include <assert.h>
#include <string.h>

static ps_value *object(void) { ps_value *v = ps_object_value(); assert(v); return v; }
static ps_value *array(void) { ps_value *v = ps_array_value(); assert(v); return v; }
static void set(ps_value *v, const char *k, ps_value *x) { assert(x && ps_set(v, k, x)); }

static ps_value *field(const char *type)
{
    ps_value *value = object(); set(value, "type", ps_string_value(type)); return value;
}

int main(void)
{
    ps_value *files = object();
    ps_value *base_doc = object();
    ps_value *base_properties = object();
    ps_value *first = field("text");
    ps_value *validate = object(); set(validate, "required", ps_bool_value(false));
    set(first, "validate", validate);
    set(base_properties, "first", first);
    set(base_properties, "removed", field("email"));
    set(base_doc, "properties", base_properties);
    set(files, "base.yml", base_doc);

    ps_value *spec = object(); set(spec, "type", ps_string_value("group"));
    ps_value *properties = object();
    set(properties, "$ref", ps_string_value("base.yml"));
    ps_value *patch = object();
    set(patch, "first.validate.required", ps_bool_value(true));
    ps_value *remove = array(); assert(ps_append(remove, ps_string_value("removed")));
    set(patch, "remove", remove); set(properties, "$patch", patch);
    ps_value *group = field("group");
    ps_value *children = object(); set(children, "child", field("integer"));
    set(group, "properties", children); set(properties, "group", group);
    set(spec, "properties", properties);

    ps_value *options = object(); set(options, "files", files);
    set(options, "keyPrefix", ps_string_value("form"));
    ps_result result = ps_compile_form(spec, options);
    assert(result.value && !result.error);
    assert(ps_is_string(ps_get(result.value, "kind"), "crudui/form-template"));
    assert(ps_is_string(ps_get(result.value, "keyPrefix"), "form"));
    const ps_value *fields = ps_get(result.value, "fields");
    assert(fields && fields->kind == PS_ARRAY && ps_size(fields) == 2);
    assert(ps_is_string(ps_get(ps_at(fields, 0), "name"), "first"));
    assert(ps_get(ps_get(ps_at(fields, 0), "spec"), "validate"));
    assert(ps_truthy(ps_get(ps_get(ps_get(ps_at(fields, 0), "spec"), "validate"), "required")));
    assert(ps_is_string(ps_get(ps_at(fields, 1), "name"), "group"));
    assert(ps_size(ps_get(ps_at(fields, 1), "children")) == 1);
    assert(!ps_get(ps_get(ps_at(fields, 1), "spec"), "properties"));
    ps_value_free(result.value);

    ps_value *bad = object(); set(bad, "type", ps_string_value("group"));
    ps_value *bad_properties = object(); set(bad_properties, "$ref", ps_string_value("missing.yml"));
    set(bad, "properties", bad_properties);
    result = ps_compile_form(bad, options);
    assert(!result.value && result.error);
    assert(ps_is_string(ps_get(result.error, "kind"), "compose"));
    assert(ps_is_string(ps_get(result.error, "code"), "REF_FILE_NOT_FOUND"));
    assert(ps_is_string(ps_get(result.error, "at"), "missing.yml"));
    ps_value_free(result.error);
    ps_value_free(bad);

    /* multiple.title, multiple.controls and multiple.header declarations. */
    const struct { const char *type; const char *key; ps_value *value; const char *message; } rejected[] = {
        {"text", "title", ps_string_value("name"),
         "Invalid multiple.title at rows: expected a repeated group"},
        {"group", "title", ps_string_value("missing"),
         "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang"},
        {"group", "title", ps_string_value("nested"),
         "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang"},
        {"group", "controls", ps_string_value("side"),
         "Invalid multiple.controls at rows: expected header, footer or outline"},
        {"group", "header", ps_bool_value(true),
         "Invalid multiple.header at rows: expected static or sticky"},
    };
    for (size_t i = 0; i < sizeof(rejected) / sizeof(rejected[0]); ++i) {
        ps_value *rows = field(rejected[i].type);
        ps_value *multiple = object(); set(multiple, rejected[i].key, rejected[i].value);
        set(rows, "multiple", multiple);
        ps_value *row_properties = object(); set(row_properties, "name", field("text"));
        set(row_properties, "nested", field("group"));
        set(rows, "properties", row_properties);
        ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
        ps_value *declared_properties = object(); set(declared_properties, "rows", rows);
        set(declared, "properties", declared_properties);
        result = ps_compile_form(declared, options);
        assert(!result.value && result.error);
        assert(ps_is_string(ps_get(result.error, "code"), "INVALID_FORM_INPUT"));
        assert(ps_is_string(ps_get(result.error, "message"), rejected[i].message));
        ps_value_free(result.error); ps_value_free(declared);
    }
    /* lang must be a boolean or an object, checked after multiple and before design. */
    const struct { ps_value *multiple; ps_value *lang; const char *message; } languages[] = {
        {NULL, ps_null_value(), "Invalid lang at rows: expected a boolean or an object"},
        {NULL, ps_string_value("ko"), "Invalid lang at rows: expected a boolean or an object"},
        {NULL, array(), "Invalid lang at rows: expected a boolean or an object"},
        {ps_string_value("yes"), ps_null_value(), "Invalid multiple at rows: expected a boolean, only or an object"},
    };
    for (size_t i = 0; i < sizeof(languages) / sizeof(languages[0]); ++i) {
        ps_value *rows = field("text");
        if (languages[i].multiple) set(rows, "multiple", languages[i].multiple);
        set(rows, "lang", languages[i].lang);
        ps_value *invalid_design = object(); set(invalid_design, "show", ps_int_value(1));
        set(rows, "design", invalid_design);
        ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
        ps_value *declared_properties = object(); set(declared_properties, "rows", rows);
        set(declared, "properties", declared_properties);
        result = ps_compile_form(declared, options);
        assert(!result.value && result.error);
        assert(ps_is_string(ps_get(result.error, "message"), languages[i].message));
        ps_value_free(result.error); ps_value_free(declared);
    }
    /* lang.only must be a list of string codes (empty allowed) or an object. */
    ps_value *mixed = array(); assert(ps_append(mixed, ps_string_value("ko")) && ps_append(mixed, ps_int_value(3)));
    ps_value *many = array();
    for (size_t i = 0; i < 6; ++i) assert(ps_append(many, ps_string_value(i % 2 ? "en" : "ko")));
    const struct { ps_value *only; bool valid; } codes[] = {
        {mixed, false}, {ps_string_value("ko"), false}, {ps_null_value(), false},
        {array(), true}, {object(), true}, {many, true},
    };
    for (size_t i = 0; i < sizeof(codes) / sizeof(codes[0]); ++i) {
        ps_value *rows = field("text");
        ps_value *language = object(); set(language, "only", codes[i].only);
        set(rows, "lang", language);
        ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
        ps_value *declared_properties = object(); set(declared_properties, "rows", rows);
        set(declared, "properties", declared_properties);
        result = ps_compile_form(declared, options);
        if (codes[i].valid) {
            assert(result.value && !result.error);
            ps_value_free(result.value);
        } else {
            assert(!result.value && result.error);
            assert(ps_is_string(ps_get(result.error, "message"),
                "Invalid lang.only at rows: expected a list of language codes or an object"));
            ps_value_free(result.error);
        }
        ps_value_free(declared);
    }
    /* Closed buckets: the first unknown key in member order, after the bucket type check
       and before the value checks; multiple, lang, design, design nodes, then behavior. */
    {
        ps_value *m1 = object(); set(m1, "min", ps_string_value("x")); set(m1, "foo", ps_int_value(1)); set(m1, "bar", ps_int_value(2));
        ps_value *l1 = object(); set(l1, "only", ps_string_value("ko")); set(l1, "append", ps_bool_value(true));
        ps_value *d1 = object(); set(d1, "show", ps_int_value(1)); set(d1, "text", ps_int_value(1));
        ps_value *n1 = object(); set(n1, "class", ps_int_value(1)); set(n1, "text", ps_string_value("x"));
        ps_value *d2 = object(); set(d2, "label", n1);
        ps_value *n2 = object(); set(n2, "text", ps_string_value("x"));
        ps_value *n3 = object(); set(n3, "style", ps_int_value(1));
        ps_value *d3 = object(); set(d3, "prepend", n2); set(d3, "label", n3);
        ps_value *b1 = object(); set(b1, "onclick", ps_string_value("go()")); set(b1, "onsubmit", ps_string_value("x"));
        set(b1, "onblur", ps_string_value("y"));
        ps_value *m2 = object(); set(m2, "foo", ps_int_value(1));
        ps_value *d4 = object(); set(d4, "text", ps_int_value(1));
        ps_value *l2 = object(); set(l2, "langs", array());
        ps_value *b2 = object(); set(b2, "onsubmit", ps_string_value("x"));
        const struct { const char *key; ps_value *value; const char *key2; ps_value *value2; const char *message; } closed[] = {
            {"multiple", m1, NULL, NULL, "Invalid multiple.foo at rows: unknown key"},
            {"multiple", m2, "lang", ps_null_value(), "Invalid multiple.foo at rows: unknown key"},
            {"lang", l1, NULL, NULL, "Invalid lang.append at rows: unknown key"},
            {"lang", l2, "design", d4, "Invalid lang.langs at rows: unknown key"},
            {"design", d1, NULL, NULL, "Invalid design.text at rows: unknown key"},
            {"design", d2, NULL, NULL, "Invalid design.label.text at rows: unknown key"},
            {"design", d3, NULL, NULL, "Invalid design.label.style at rows: expected a string or a condition map"},
            {"behavior", b1, NULL, NULL, "Invalid behavior.onsubmit at rows: unknown key"},
            {"design", ps_value_clone(d4), "behavior", b2, "Invalid design.text at rows: unknown key"},
        };
        for (size_t i = 0; i < sizeof(closed) / sizeof(closed[0]); ++i) {
            ps_value *rows = field("text");
            set(rows, closed[i].key, closed[i].value);
            if (closed[i].key2) set(rows, closed[i].key2, closed[i].value2);
            ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
            ps_value *declared_properties = object(); set(declared_properties, "rows", rows);
            set(declared, "properties", declared_properties);
            result = ps_compile_form(declared, options);
            assert(!result.value && result.error);
            assert(ps_is_string(ps_get(result.error, "code"), "INVALID_FORM_INPUT"));
            assert(ps_is_string(ps_get(result.error, "message"), closed[i].message));
            ps_value_free(result.error); ps_value_free(declared);
        }
        /* Every allowed key, and open validate/options buckets, compile. */
        ps_value *rows = field("text");
        ps_value *multiple = object();
        static const char *const multiple_keys[] = {"min", "max", "copy", "sortable", "controls", "header", "onclick"};
        ps_value *const multiple_values[] = {ps_int_value(1), ps_int_value(2), ps_bool_value(true), ps_bool_value(false),
            ps_string_value("footer"), ps_string_value("static"), ps_string_value("add()")};
        for (size_t i = 0; i < 7; ++i) set(multiple, multiple_keys[i], multiple_values[i]);
        ps_value *lang = object();
        static const char *const lang_keys[] = {"mode", "name", "key", "frame", "title", "group_class"};
        for (size_t i = 0; i < 6; ++i) set(lang, lang_keys[i], ps_string_value("x"));
        set(lang, "only", array());
        ps_value *design = object(); set(design, "show", ps_bool_value(true));
        set(design, "class", ps_string_value("a")); set(design, "style", ps_string_value("b"));
        static const char *const node_names[] = {"label", "wrapper", "group", "prepend"};
        for (size_t i = 0; i < 4; ++i) {
            ps_value *node = object(); set(node, "class", ps_string_value("c")); set(node, "style", ps_string_value("d"));
            set(design, node_names[i], node);
        }
        ps_value *behavior = object();
        set(behavior, "onchange", ps_string_value("a")); set(behavior, "onclick", ps_string_value("b"));
        set(behavior, "onload", ps_string_value("c"));
        ps_value *open_validate = object(); set(open_validate, "custom", ps_int_value(1));
        ps_value *open_options = object(); set(open_options, "custom", ps_int_value(1));
        set(rows, "multiple", multiple); set(rows, "lang", lang); set(rows, "design", design);
        set(rows, "behavior", behavior); set(rows, "validate", open_validate); set(rows, "options", open_options);
        ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
        ps_value *declared_properties = object(); set(declared_properties, "rows", rows);
        set(declared, "properties", declared_properties);
        result = ps_compile_form(declared, options);
        assert(result.value && !result.error);
        ps_value_free(result.value); ps_value_free(declared);
    }
    /* Root buttons and action: copied after the fields, or one submit button by default. */
    ps_value *plain = object(); set(plain, "type", ps_string_value("group"));
    ps_value *plain_properties = object(); set(plain_properties, "name", field("text"));
    set(plain, "properties", plain_properties);
    result = ps_compile_form(plain, options);
    assert(result.value && !result.error);
    assert(ps_text_is(ps_key(result.value, 3), "buttons") && !ps_has(result.value, "action"));
    const ps_value *defaults = ps_get(result.value, "buttons");
    assert(defaults && defaults->kind == PS_ARRAY && ps_size(defaults) == 1 && ps_size(ps_at(defaults, 0)) == 1);
    assert(ps_is_string(ps_get(ps_at(defaults, 0), "type"), "submit"));
    ps_value_free(result.value);
    ps_value *link = field("link"); set(link, "text", ps_string_value("List")); set(link, "href", ps_string_value("../"));
    ps_value *declared_buttons = array(); assert(ps_append(declared_buttons, field("reset")) && ps_append(declared_buttons, link));
    ps_value *action = object(); set(action, "method", ps_string_value("post"));
    set(plain, "buttons", declared_buttons); set(plain, "action", action);
    result = ps_compile_form(plain, options);
    assert(result.value && !result.error);
    assert(ps_text_is(ps_key(result.value, 3), "buttons") && ps_text_is(ps_key(result.value, 4), "action"));
    assert(ps_equal(ps_get(result.value, "buttons"), ps_get(plain, "buttons")));
    assert(ps_equal(ps_get(result.value, "action"), ps_get(plain, "action")));
    ps_value_free(result.value); ps_value_free(plain);

    ps_value *untitled = field("button");
    ps_value *unnamed = field("submit"); set(unnamed, "name", ps_int_value(1));
    ps_value *unlinked = field("link"); set(unlinked, "text", ps_string_value("List"));
    ps_value *styled = field("submit"); set(styled, "design", ps_string_value("x"));
    ps_value *nested = field("submit"); set(nested, "buttons", array());
    ps_value *unknown = field("image");
    ps_value *wrong_action = object(); set(wrong_action, "enctype", ps_int_value(1));
    const struct { const char *key; ps_value *value; const char *message; } forms[] = {
        {"action", ps_string_value("post"), "Invalid action at form: expected an object"},
        {"action", wrong_action, "Invalid action.enctype at form: expected a string"},
        {"buttons", object(), "Invalid buttons at form: expected a list of buttons"},
        {"buttons", ps_int_value(1), "Invalid buttons.0 at form: expected an object"},
        {"buttons", unknown, "Invalid buttons.0.type at form: expected submit, reset, button or link"},
        {"buttons", unnamed, "Invalid buttons.0.name at form: expected a string"},
        {"buttons", untitled, "Invalid buttons.0.text at form: expected content for this button type"},
        {"buttons", unlinked, "Invalid buttons.0.href at form: expected a link target"},
        {"buttons", styled, "Invalid design at form.buttons.0: expected a boolean or an object"},
        {"buttons", nested, "Invalid buttons at form.buttons.0: expected the form root"},
    };
    for (size_t i = 0; i < sizeof(forms) / sizeof(forms[0]); ++i) {
        ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
        ps_value *declared_properties = object(); set(declared_properties, "name", field("text"));
        set(declared, "properties", declared_properties);
        ps_value *value = forms[i].value;
        /* Entries after the list check hold one button declaration. */
        if (i > 2) { ps_value *list = array(); assert(ps_append(list, value)); value = list; }
        set(declared, forms[i].key, value);
        result = ps_compile_form(declared, options);
        assert(!result.value && result.error);
        assert(ps_is_string(ps_get(result.error, "code"), "INVALID_FORM_INPUT"));
        assert(ps_is_string(ps_get(result.error, "message"), forms[i].message));
        ps_value_free(result.error); ps_value_free(declared);
    }
    /* The action is checked before the buttons. */
    ps_value *both = object(); set(both, "type", ps_string_value("group"));
    ps_value *both_properties = object(); set(both_properties, "name", field("text"));
    set(both, "properties", both_properties);
    set(both, "buttons", object()); set(both, "action", ps_int_value(1));
    result = ps_compile_form(both, options);
    assert(!result.value && result.error);
    assert(ps_is_string(ps_get(result.error, "message"), "Invalid action at form: expected an object"));
    ps_value_free(result.error); ps_value_free(both);
    ps_value *rows = field("text"); set(rows, "action", object());
    ps_value *declared = object(); set(declared, "type", ps_string_value("group"));
    ps_value *declared_properties = object(); set(declared_properties, "rows", rows);
    set(declared, "properties", declared_properties);
    result = ps_compile_form(declared, options);
    assert(!result.value && result.error);
    assert(ps_is_string(ps_get(result.error, "message"), "Invalid action at rows: expected the form root"));
    ps_value_free(result.error); ps_value_free(declared);

    ps_value_free(options); ps_value_free(spec);
    return 0;
}
