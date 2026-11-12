#include "engine_internal.h"

#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static ps_result input_error(const char *message)
{
    return ps_fail("form", "INVALID_FORM_INPUT", message, "");
}

static const ps_value *option(const ps_value *options, const char *name)
{
    return options && options->kind == PS_OBJECT ? ps_get(options, name) : NULL;
}

/* A string option; an absent option has NULL bytes. */
static bool option_string(const ps_value *options, const char *name,
                          ps_text *value, ps_result *error)
{
    const ps_value *item = option(options, name);
    if (!item) { *value = (ps_text){NULL, 0}; return true; }
    if (item->kind != PS_STRING) {
        char message[160];
        snprintf(message, sizeof(message), "%s must be a string", name);
        *error = input_error(message); return false;
    }
    *value = ps_string(item); return true;
}

/* A string equal to one of the allowed values. */
static bool one_of(const ps_value *value, const char *const *allowed, size_t count)
{
    for (size_t i = 0; i < count; ++i)
        if (ps_is_string(value, allowed[i])) return true;
    return false;
}

/* A finite number of a literal declaration. */
static bool finite_number(const ps_value *value, double *number)
{
    if (value && value->kind == PS_INT) { *number = (double)value->data.integer; return true; }
    if (value && value->kind == PS_FLOAT) { *number = value->data.number; return isfinite(*number); }
    return false;
}

/* The range type, in any letter case. */
static bool range_type(const ps_value *type)
{
    if (!type || type->kind != PS_STRING) return false;
    ps_text text = ps_string(type);
    if (text.length != 5) return false;
    for (size_t i = 0; i < 5; ++i)
        if (tolower((unsigned char)text.bytes[i]) != "range"[i]) return false;
    return true;
}

/* Reject a range field without literal bounds and a literal step whose multiple the minimum is:
   the slider moves from the minimum in steps. */
static bool range_declaration_valid(const ps_value *spec, ps_text path, ps_value **error)
{
    const ps_value *validate = ps_get(spec, "validate");
    if (validate && validate->kind != PS_OBJECT) validate = NULL;
    const ps_value *bounds = validate ? ps_get(validate, "range") : NULL;
    double minimum = 0, maximum = 0, step = 0;
    if (!bounds || bounds->kind != PS_ARRAY || ps_size(bounds) != 2 ||
        !finite_number(ps_at(bounds, 0), &minimum) || !finite_number(ps_at(bounds, 1), &maximum) ||
        minimum > maximum)
        return ps_declaration_error(PS_TEXT("validate.range"), path,
            "[minimum, maximum] finite numbers with minimum not above maximum", error);
    if (!finite_number(validate ? ps_get(validate, "step") : NULL, &step) || step <= 0)
        return ps_declaration_error(PS_TEXT("validate.step"), path, "a finite number above 0", error);
    int multiple = ps_step_multiple(minimum, step);
    if (multiple < 0) { *error = NULL; return false; }
    if (!multiple)
        return ps_declaration_error(PS_TEXT("validate.range"), path,
            "a minimum that is a multiple of validate.step", error);
    return true;
}

/* The condition type, in any letter case. */
static bool condition_type(const ps_value *type)
{
    if (!type || type->kind != PS_STRING) return false;
    ps_text text = ps_string(type);
    if (text.length != 9) return false;
    for (size_t i = 0; i < 9; ++i)
        if (tolower((unsigned char)text.bytes[i]) != "condition"[i]) return false;
    return true;
}

/* The error of an options.fields that breaks its rule (docs/spec/schema.md, CUSC-084). */
static bool condition_fields_error(ps_text path, ps_value **error)
{
    return ps_declaration_error(PS_TEXT("options.fields"), path, "distinct field names of a structured condition editor", error);
}

/*
 * Reject a design.editor of a condition field other than text or structured (CUSC-083), and an
 * options.fields outside a structured editor or with names that break its rule (CUSC-084).
 */
static bool condition_editor_valid(const ps_value *spec, ps_text path, ps_value **error)
{
    const ps_value *editor = member(member(spec, "design"), "editor");
    if (editor && !ps_is_string(editor, "text") && !ps_is_string(editor, "structured"))
        return ps_declaration_error(PS_TEXT("design.editor"), path, "text or structured", error);
    const ps_value *fields = member(member(spec, "options"), "fields");
    if (!fields) return true;
    bool valid = ps_is_string(editor, "structured") && fields->kind == PS_ARRAY;
    for (size_t i = 0; valid && i < ps_size(fields); ++i) {
        const ps_value *name = ps_at(fields, i);
        valid = name->kind == PS_STRING && !ps_empty_value(name);
        for (size_t j = 0; valid && j < i; ++j) valid = !ps_equal(name, ps_at(fields, j));
    }
    return valid || condition_fields_error(path, error);
}

/* Reject a condition field whose validate.conditionTree is not the literal true or judge: every
   value of the field is checked as a condition tree. */
static bool condition_declaration_valid(const ps_value *spec, ps_text path, ps_value **error)
{
    const ps_value *validate = ps_get(spec, "validate");
    const ps_value *parameter = validate && validate->kind == PS_OBJECT ? ps_get(validate, "conditionTree") : NULL;
    if ((parameter && parameter->kind == PS_BOOL && parameter->data.boolean) || ps_is_string(parameter, "judge"))
        return true;
    return ps_declaration_error(PS_TEXT("validate.conditionTree"), path, "true or judge", error);
}

/* Reject a wrong value type or an unknown key in one field's multiple, lang, design and behavior declarations;
   only a form field (field) accepts declared attributes. */
static bool declarations_valid(const ps_value *spec, ps_text path, bool field, ps_value **error)
{
    /* Buttons and the submission target belong to the form, not to a field. */
    static const char *const form_keys[] = {"buttons", "action"};
    for (size_t i = 0; i < 2; ++i)
        if (ps_has(spec, form_keys[i]))
            return ps_declaration_error(ps_fixed(form_keys[i]), path, "the form root", error);
    static const char *const placements[] = {"header", "footer", "outline"};
    static const char *const headers[] = {"static", "sticky"};
    static const char *const numbers[][2] = {{"min", "multiple.min"}, {"max", "multiple.max"}};
    static const char *const booleans[][2] = {{"copy", "multiple.copy"}, {"sortable", "multiple.sortable"}};
    static const char *const multiple_keys[] = {"only", "min", "max", "copy", "sortable", "title", "controls", "header", "onclick", "keys"};
    /* Rows of a data-only collection come from the data: row limits and row controls do not apply. */
    static const char *const only_keys[] = {"only", "title", "header", "keys"};
    static const char *const lang_keys[] = {"mode", "only", "name", "key", "frame", "title", "group_class"};
    static const char *const behavior_keys[] = {"onchange", "onclick", "onload"};
    const ps_value *multiple = ps_get(spec, "multiple");
    if (multiple) {
        if (multiple->kind != PS_BOOL && multiple->kind != PS_OBJECT && !ps_is_string(multiple, "only"))
            return ps_declaration_error(PS_TEXT("multiple"), path, "a boolean, only or an object", error);
        if (multiple->kind == PS_OBJECT && !ps_known_keys(multiple, "multiple", multiple_keys, 10, path, error))
            return false;
        const ps_value *only = multiple->kind == PS_OBJECT ? ps_get(multiple, "only") : NULL;
        if (only && only->kind != PS_BOOL)
            return ps_declaration_error(PS_TEXT("multiple.only"), path, "a boolean", error);
        if (only && only->data.boolean && !ps_known_keys(multiple, "multiple", only_keys, 4, path, error))
            return false;
        /* A keyed map is a data-only collection; validation resolves its reference. */
        const ps_value *keys = multiple->kind == PS_OBJECT ? ps_get(multiple, "keys") : NULL;
        if (keys && !(only && only->data.boolean))
            return ps_declaration_error(PS_TEXT("multiple.keys"), path, "multiple.only: true", error);
        if (keys && keys->kind != PS_STRING)
            return ps_declaration_error(PS_TEXT("multiple.keys"), path, "a reference to a repeated group", error);
        for (size_t i = 0; multiple->kind == PS_OBJECT && i < 2; ++i) {
            const ps_value *value = ps_get(multiple, numbers[i][0]);
            if (value && value->kind != PS_INT && value->kind != PS_FLOAT)
                return ps_declaration_error(ps_fixed(numbers[i][1]), path, "a number", error);
        }
        for (size_t i = 0; multiple->kind == PS_OBJECT && i < 2; ++i) {
            const ps_value *value = ps_get(multiple, booleans[i][0]);
            if (value && value->kind != PS_BOOL)
                return ps_declaration_error(ps_fixed(booleans[i][1]), path, "a boolean", error);
        }
        if (multiple->kind == PS_OBJECT && ps_has(multiple, "title")) {
            if (!ps_is_string(ps_get(spec, "type"), "group"))
                return ps_declaration_error(PS_TEXT("multiple.title"), path, "a repeated group", error);
            const ps_value *title = ps_get(multiple, "title");
            const ps_value *properties = ps_get(spec, "properties");
            const ps_value *child = title->kind == PS_STRING && properties &&
                properties->kind == PS_OBJECT ? ps_get_text(properties, ps_string(title)) : NULL;
            if (!scalar_child(child))
                return ps_declaration_error(PS_TEXT("multiple.title"), path,
                    "the name of a direct child field without multiple, properties or lang", error);
        }
        if (multiple->kind == PS_OBJECT && ps_has(multiple, "controls") &&
            !one_of(ps_get(multiple, "controls"), placements, 3))
            return ps_declaration_error(PS_TEXT("multiple.controls"), path, "header, footer or outline", error);
        if (multiple->kind == PS_OBJECT && ps_has(multiple, "header") &&
            !one_of(ps_get(multiple, "header"), headers, 2))
            return ps_declaration_error(PS_TEXT("multiple.header"), path, "static or sticky", error);
    }
    const ps_value *lang = ps_get(spec, "lang");
    if (lang && lang->kind != PS_BOOL && lang->kind != PS_OBJECT)
        return ps_declaration_error(PS_TEXT("lang"), path, "a boolean or an object", error);
    if (lang && lang->kind == PS_OBJECT && !ps_known_keys(lang, "lang", lang_keys, 7, path, error))
        return false;
    const ps_value *only = lang && lang->kind == PS_OBJECT ? ps_get(lang, "only") : NULL;
    if (only && only->kind != PS_OBJECT) {
        bool codes = only->kind == PS_ARRAY;
        for (size_t i = 0; codes && i < ps_size(only); ++i)
            codes = ps_at(only, i)->kind == PS_STRING;
        if (!codes)
            return ps_declaration_error(PS_TEXT("lang.only"), path, "a list of language codes or an object", error);
    }
    /* Only a group field declares a layout, and a repeated group has no line. */
    size_t layouts = 0;
    if (field && ps_is_string(ps_get(spec, "type"), "group"))
        layouts = multiple && ((multiple->kind == PS_BOOL && multiple->data.boolean) ||
                               multiple->kind == PS_OBJECT || ps_is_string(multiple, "only")) ? 2 : 3;
    const ps_value *design = ps_get(spec, "design");
    if (design && !ps_design_declaration_valid(design, path, field, layouts, field && condition_type(ps_get(spec, "type")), error)) return false;
    const ps_value *behavior = ps_get(spec, "behavior");
    if (behavior && behavior->kind == PS_OBJECT &&
        !ps_known_keys(behavior, "behavior", behavior_keys, 3, path, error)) return false;
    if (field && range_type(ps_get(spec, "type")) && !range_declaration_valid(spec, path, error)) return false;
    if (field && condition_type(ps_get(spec, "type")))
        return condition_declaration_valid(spec, path, error) && condition_editor_valid(spec, path, error);
    return !field || !ps_has(member(spec, "options"), "fields") || condition_fields_error(path, error);
}

/* Reject a wrong root action or buttons declaration. */
static bool form_declarations_valid(const ps_value *spec, ps_value **error)
{
    static const char *const types[] = {"submit", "reset", "button", "link"};
    /* Button types with interface text (the submit and reset messages); template.c
       links only value, engine_error, compose and declaration, so it cannot read the messages table. */
    static const char *const texts[] = {"submit", "reset"};
    static const char *const action_keys[][2] = {
        {"method", "action.method"}, {"url", "action.url"}, {"enctype", "action.enctype"},
    };
    static const char *const strings[] = {"name", "value", "href"};
    const ps_value *action = ps_get(spec, "action");
    if (action) {
        if (action->kind != PS_OBJECT) return ps_declaration_error(PS_TEXT("action"), PS_TEXT("form"), "an object", error);
        for (size_t i = 0; i < 3; ++i) {
            const ps_value *value = ps_get(action, action_keys[i][0]);
            if (value && value->kind != PS_STRING)
                return ps_declaration_error(ps_fixed(action_keys[i][1]), PS_TEXT("form"), "a string", error);
        }
    }
    const ps_value *buttons = ps_get(spec, "buttons");
    if (!buttons) return true;
    if (buttons->kind != PS_ARRAY) return ps_declaration_error(PS_TEXT("buttons"), PS_TEXT("form"), "a list of buttons", error);
    for (size_t i = 0; i < ps_size(buttons); ++i) {
        const ps_value *button = ps_at(buttons, i);
        char key[64], path[64];
        snprintf(key, sizeof(key), "buttons.%zu", i);
        if (!button || button->kind != PS_OBJECT) return ps_declaration_error(ps_fixed(key), PS_TEXT("form"), "an object", error);
        const ps_value *type = ps_get(button, "type");
        snprintf(key, sizeof(key), "buttons.%zu.type", i);
        if (!one_of(type, types, 4))
            return ps_declaration_error(ps_fixed(key), PS_TEXT("form"), "submit, reset, button or link", error);
        for (size_t j = 0; j < 3; ++j) {
            const ps_value *value = ps_get(button, strings[j]);
            snprintf(key, sizeof(key), "buttons.%zu.%s", i, strings[j]);
            if (value && value->kind != PS_STRING) return ps_declaration_error(ps_fixed(key), PS_TEXT("form"), "a string", error);
        }
        snprintf(key, sizeof(key), "buttons.%zu.text", i);
        if (!one_of(type, texts, 2) && !ps_has(button, "text"))
            return ps_declaration_error(ps_fixed(key), PS_TEXT("form"), "content for this button type", error);
        snprintf(key, sizeof(key), "buttons.%zu.href", i);
        if (ps_is_string(type, "link") && !ps_has(button, "href"))
            return ps_declaration_error(ps_fixed(key), PS_TEXT("form"), "a link target", error);
        snprintf(path, sizeof(path), "form.buttons.%zu", i);
        if (!declarations_valid(button, ps_fixed(path), false, error)) return false;
    }
    return true;
}

/* The buttons of a form whose spec declares none: one submit button. */
static ps_value *default_buttons(void)
{
    ps_value *buttons = ps_array_value();
    ps_value *submit = ps_object_value();
    if (!buttons || !submit || !ps_set(submit, "type", ps_string_value("submit")) || !ps_append(buttons, submit)) {
        ps_value_free(buttons); ps_value_free(submit); return NULL;
    }
    return buttons;
}

/* The fields of a properties object; root holds the composed root properties that a group source reads. */
static ps_value *compile_fields(const ps_value *properties, const ps_value *root, ps_text parent,
                                ps_value **error)
{
    ps_value *fields = ps_array_value();
    if (!fields) return NULL;
    for (size_t i = 0; i < ps_size(properties); ++i) {
        const ps_value *raw = ps_at(properties, i);
        if (!raw || raw->kind != PS_OBJECT) continue;
        ps_text name = ps_key(properties, i);
        ps_chars path = parent.length ? PS_CONCAT(parent, PS_TEXT("."), name) : ps_copy(name);
        if (!path.bytes || !declarations_valid(raw, ps_view(path), true, error)) { free(path.bytes); goto fail; }
        /* A group source is checked after the other declarations of its field (schema.md, "Choices from a repeated group"). */
        ps_chars source_failure = {NULL, 0};
        int source_state = ps_group_source_failure(raw, ps_view(path), root, &source_failure);
        if (source_state != 0) {
            if (source_state > 0) *error = ps_error_text("form", "INVALID_FORM_INPUT", ps_view(source_failure), PS_TEXT(""), NULL);
            free(source_failure.bytes); free(path.bytes); goto fail;
        }
        ps_value *field = ps_object_value();
        ps_value *spec = ps_object_value();
        if (!field || !spec) { free(path.bytes); ps_value_free(field); ps_value_free(spec); goto fail; }
        for (size_t j = 0; j < ps_size(raw); ++j) {
            ps_text key = ps_key(raw, j);
            if (!ps_text_is(key, "properties") &&
                !ps_set_text(spec, key, ps_value_clone(ps_at(raw, j)))) {
                free(path.bytes); ps_value_free(field); ps_value_free(spec); goto fail;
            }
        }
        const ps_value *children_input = ps_get(raw, "properties");
        ps_value *children = children_input && children_input->kind == PS_OBJECT
            ? compile_fields(children_input, root, ps_view(path), error) : ps_array_value();
        free(path.bytes);
        if (!children ||
            !ps_set(field, "name", ps_text_value(name)) ||
            !ps_set(field, "spec", spec) ||
            !ps_set(field, "children", children) || !ps_append(fields, field)) {
            ps_value_free(field); goto fail;
        }
    }
    return fields;
fail:
    ps_value_free(fields); return NULL;
}

static ps_result compile_form(const ps_value *spec, const ps_value *options);

/* A specification and its composition files are compiled in specification member order. */
ps_result ps_compile_form(const ps_value *spec, const ps_value *options)
{
    ps_value *ordered_spec = NULL, *ordered_options = NULL;
    if (!ps_order_specification(spec, options, &ordered_spec, &ordered_options))
        return ps_fail("internal", "INTERNAL_ERROR", "C form compilation failed", "");
    ps_result result = compile_form(ordered_spec, ordered_options);
    ps_value_free(ordered_spec); ps_value_free(ordered_options);
    return result;
}

static ps_result compile_form(const ps_value *spec, const ps_value *options)
{
    if (!spec || spec->kind != PS_OBJECT || !ps_is_string(ps_get(spec, "type"), "group") ||
        !ps_get(spec, "properties") || ps_get(spec, "properties")->kind != PS_OBJECT)
        return input_error("A form spec must be a group with properties");
    ps_value *form_failure = NULL;
    if (!form_declarations_valid(spec, &form_failure))
        return form_failure ? (ps_result){NULL, form_failure}
                            : ps_fail("internal", "INTERNAL_ERROR", "C form compilation failed", "");
    /* The form root takes no layout; a group field declares it. */
    const ps_value *root_design = ps_get(spec, "design");
    if (root_design && root_design->kind == PS_OBJECT && ps_has(root_design, "layout"))
        return input_error("Invalid design.layout at form: unknown key");
    if (!options || options->kind != PS_OBJECT) return input_error("Expected an object");

    const ps_value *files = option(options, "files");
    ps_value *empty_files = NULL;
    if (!files || (files->kind == PS_ARRAY && ps_size(files) == 0))
        files = empty_files = ps_object_value();
    if (!files || files->kind != PS_OBJECT) {
        ps_value_free(empty_files); return input_error("files must be an object");
    }
    ps_text basepath = {NULL, 0};
    ps_text key_prefix = {NULL, 0};
    ps_result error = {0};
    if (!option_string(options, "basepath", &basepath, &error) ||
        !option_string(options, "keyPrefix", &key_prefix, &error)) {
        ps_value_free(empty_files); return error;
    }

    ps_value *composition_error_value = NULL;
    ps_value *properties = ps_compose_properties(ps_get(spec, "properties"), files,
        basepath, &composition_error_value);
    ps_value_free(empty_files);
    if (!properties) {
        if (composition_error_value) return (ps_result){NULL, composition_error_value};
        return ps_fail("internal", "INTERNAL_ERROR", "C form compilation failed", "");
    }
    ps_value *declaration_failure = NULL;
    ps_value *fields = compile_fields(properties, properties, PS_TEXT(""), &declaration_failure);
    ps_value_free(properties);
    if (!fields && declaration_failure) return (ps_result){NULL, declaration_failure};
    ps_value *template = ps_object_value();
    const ps_value *declared_buttons = ps_get(spec, "buttons");
    const ps_value *action = ps_get(spec, "action");
    const ps_value *description = ps_get(spec, "description");
    ps_value *buttons = declared_buttons ? ps_value_clone(declared_buttons) : default_buttons();
    if (!template || !fields || !buttons ||
        !ps_set(template, "kind", ps_string_value("crudui/form-template")) ||
        (key_prefix.bytes && !ps_set(template, "keyPrefix", ps_text_value(key_prefix))) ||
        !ps_set(template, "fields", fields) ||
        !ps_set(template, "buttons", buttons) ||
        (action && action->kind == PS_OBJECT && !ps_set(template, "action", ps_value_clone(action))) ||
        /* The root description as declared, translated when the form is rendered. */
        (description && !ps_set(template, "description", ps_value_clone(description)))) {
        ps_value_free(template);
        return ps_fail("internal", "INTERNAL_ERROR", "C form compilation failed", "");
    }
    return ps_ok(template);
}
