#include "engine_internal.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const ps_value *data;
    ps_text key_prefix;
    ps_text id_prefix;
    ps_text language;
    const ps_form_messages *messages;
    bool unsupported_marker;
    /* The collapsed option: a list of row paths rendered collapsed, NULL when absent. */
    const ps_value *collapsed;
} bind_context;

/* Enclosing repeated rows: path segment positions, one-based numbers and sticky headers. */
typedef struct {
    const size_t *segments;
    const size_t *numbers;
    size_t count;
    size_t sticky_depth;
    /* The fields are laid out inline: a design.layout inline of an enclosing group. */
    bool inline_layout;
} row_scope;

/* Evaluated controls and limits for a repeated field. */
typedef struct {
    bool has_min, has_max;
    double min, max;
    bool copy, sortable, sticky;
    /* Rows come only from the data: missing data is zero rows and no row control renders. */
    bool only;
    ps_text title;
    const char *controls;
} multiple_settings;

static bool append_owned(ps_value *array, ps_value **value)
{
    ps_value *owned = *value;
    *value = NULL;
    return ps_append(array, owned);
}

static ps_chars field_type(const ps_value *spec)
{
    const ps_value *value = member(spec, "type");
    if (!value || value->kind == PS_NULL) return ps_copy(PS_TEXT(""));
    return ps_js_string(value);
}

static bool enabled_bool(const ps_value *object, const char *key)
{
    const ps_value *value = member(object, key);
    return value && value->kind == PS_BOOL && value->data.boolean;
}

static bool number_value(const ps_value *value, double *output)
{
    if (value && value->kind == PS_INT) { *output = (double)value->data.integer; return true; }
    if (value && value->kind == PS_FLOAT) { *output = value->data.number; return true; }
    return false;
}

/* Settings of a repeated field; false when the field does not repeat. */
static bool resolve_multiple(const ps_value *multiple, multiple_settings *settings)
{
    *settings = (multiple_settings){0};
    settings->controls = "header";
    if (multiple && multiple->kind == PS_BOOL && multiple->data.boolean) return true;
    if (ps_is_string(multiple, "only")) { settings->only = true; return true; }
    if (!multiple || multiple->kind != PS_OBJECT) return false;
    settings->only = enabled_bool(multiple, "only");
    settings->has_min = number_value(member(multiple, "min"), &settings->min);
    settings->has_max = number_value(member(multiple, "max"), &settings->max);
    settings->copy = enabled_bool(multiple, "copy");
    settings->sortable = enabled_bool(multiple, "sortable");
    const ps_value *title = member(multiple, "title");
    if (title && title->kind == PS_STRING) settings->title = ps_string(title);
    const ps_value *controls = member(multiple, "controls");
    if (ps_is_string(controls, "footer")) settings->controls = "footer";
    else if (ps_is_string(controls, "outline")) settings->controls = "outline";
    settings->sticky = ps_is_string(member(multiple, "header"), "sticky");
    return true;
}

static bool checked_value(const ps_value *value)
{
    if (!value) return false;
    if (value->kind == PS_BOOL) return value->data.boolean;
    if (value->kind == PS_INT) return value->data.integer == 1;
    if (value->kind == PS_FLOAT) return value->data.number == 1;
    return ps_is_string(value, "1");
}

/* Translated text of a truthy declaration; an empty translation is absent (NULL bytes). */
static bool translated(const ps_value *value, ps_text language, ps_chars *text)
{
    *text = (ps_chars){NULL, 0};
    if (!ps_truthy(value)) return true;
    *text = ps_translate(value, language);
    if (!text->bytes) return false;
    if (!text->length) { free(text->bytes); *text = (ps_chars){NULL, 0}; }
    return true;
}

static ps_value *unsupported_widget(ps_text type)
{
    ps_value *widget = ps_object_value();
    if (!widget || !ps_set(widget, "unsupported", ps_bool_value(true)) ||
        !set_text(widget, "type", type)) {
        ps_value_free(widget); return NULL;
    }
    return widget;
}

/* Reject a class or style of a choice that is not a string and choice attributes that break the
   declared attribute rules, choice by choice in list order. */
static bool choice_appearance_valid(const ps_value *items, ps_text path, ps_value **error)
{
    static const char *const strings[] = {"class", "style"};
    for (size_t i = 0; i < ps_size(items); ++i) {
        const ps_value *choice = ps_at(items, i);
        char key[64];
        for (size_t j = 0; j < 2; ++j) {
            const ps_value *member_value = ps_get(choice, strings[j]);
            snprintf(key, sizeof(key), "items.%zu.%s", i, strings[j]);
            if (member_value && member_value->kind != PS_STRING)
                return ps_declaration_error(ps_fixed(key), path, "a string", error);
        }
        const ps_value *attributes = ps_get(choice, "attributes");
        snprintf(key, sizeof(key), "items.%zu.attributes", i);
        if (attributes && !ps_declared_attributes_valid(attributes, key, path, error)) return false;
    }
    return true;
}

static ps_value *build_declared_widget(const ps_value *spec, const ps_value *value,
                                       ps_text path, const ps_value *design,
                                       const bind_context *context, const row_scope *scope,
                                       ps_value **error)
{
    const ps_value *items = ps_get(spec, "items");
    ps_chars type = field_type(spec);
    if (!type.bytes) return NULL;
    if (ps_is_choice_list(items)) {
        /* Only the choices of a choice or multichoice field declare their appearance, and only the
           choice list of a select field has groups. */
        bool appearance = ps_widget_choices(ps_view(type));
        int valid = ps_choice_list_valid(items, appearance, ps_widget_select(ps_view(type)));
        if (valid < 0) { free(type.bytes); return NULL; }
        if (!valid) {
            ps_chars message = PS_CONCAT(PS_TEXT("Invalid items at "), path,
                                         PS_TEXT(": expected value and label pairs with distinct string or number values"));
            *error = message.bytes
                ? ps_error_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL) : NULL;
            free(message.bytes); free(type.bytes);
            return NULL;
        }
        if (appearance && !choice_appearance_valid(items, path, error)) { free(type.bytes); return NULL; }
    }
    if (!ps_widget_supported(ps_view(type))) {
        if (context->unsupported_marker) {
            ps_value *widget = unsupported_widget(ps_view(type));
            free(type.bytes);
            return widget;
        }
        ps_chars message = PS_CONCAT(PS_TEXT("Unsupported field type \""), ps_view(type),
                                     PS_TEXT("\" at \""), path, PS_TEXT("\""));
        *error = message.bytes
            ? ps_error_text("form", "UNSUPPORTED_FIELD_TYPE", ps_view(message), path, NULL) : NULL;
        free(message.bytes);
        free(type.bytes); return NULL;
    }
    free(type.bytes);
    return ps_widget(spec, value, value != NULL, path, design,
                     context->key_prefix, context->id_prefix,
                     context->language, scope->segments, scope->count);
}

/*
 * A field whose items is a group source takes its choices from the rows of its group in the root
 * data (group_source.c); the field then renders as a choice list of those pairs. The copy keeps
 * the declared members in their order and replaces only items.
 */
static ps_value *build_widget(const ps_value *spec, const ps_value *value,
                              ps_text path, const ps_value *design,
                              const bind_context *context, const row_scope *scope,
                              ps_value **error)
{
    const ps_value *items = ps_get(spec, "items");
    if (!ps_is_group_source(items))
        return build_declared_widget(spec, value, path, design, context, scope, error);
    ps_chars repeated = {NULL, 0};
    ps_value *choices = ps_group_source_choices(items, context->data, &repeated);
    if (!choices && repeated.bytes) {
        /* A row that repeats a literal choice is the input failure of the validator (CUSC-089), its cause. */
        ps_value *cause = ps_error_text("input", "INVALID_FORM_INPUT", ps_view(repeated), PS_TEXT(""), NULL);
        *error = ps_error_with_cause(
            ps_error_text("form", "INVALID_FORM_INPUT", ps_view(repeated), PS_TEXT(""), NULL), cause);
        free(repeated.bytes);
        return NULL;
    }
    ps_value *source = ps_object_value();
    bool ok = choices && source;
    for (size_t i = 0; ok && i < ps_size(spec); ++i) {
        ps_text key = ps_key(spec, i);
        ps_value *member_copy = ps_text_is(key, "items") ? choices : ps_value_clone(ps_at(spec, i));
        if (ps_text_is(key, "items")) choices = NULL;
        ok = member_copy && ps_set_text(source, key, member_copy);
    }
    ps_value_free(choices);
    if (!ok) { ps_value_free(source); return NULL; }
    ps_value *widget = build_declared_widget(source, value, path, design, context, scope, error);
    ps_value_free(source);
    return widget;
}

/* Input failure for present group data, including a repeated group row, that is not an object. */
static ps_value *input_error_with(const char *prefix, ps_text path)
{
    ps_chars message = PS_CONCAT(ps_fixed(prefix), path);
    ps_value *error = message.bytes
        ? ps_error_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL) : NULL;
    free(message.bytes);
    return error;
}

static ps_value *group_data_error(ps_text path)
{
    return input_error_with("Group data must be an object: ", path);
}

/* Node parts. */

/* kind, path, className, style, attributes and hidden from the node's design.wrapper, its declared
   wrapper attributes and design.show. */
static ps_value *node_root(const char *kind, ps_text path, const ps_value *design, const ps_value *spec)
{
    const ps_value *wrapper = member(design, "wrapper");
    const ps_value *attributes = ps_declared_attributes(spec, true);
    ps_chars style = ps_style_string(text_member(wrapper, "style"));
    ps_value *node = ps_object_value();
    bool ok = style.bytes && node && set_string(node, "kind", kind) &&
        set_text(node, "path", path) &&
        set_text(node, "className", text_member(wrapper, "class")) &&
        (!style.length || set_text(node, "style", ps_view(style))) &&
        (!attributes || ps_set(node, "attributes", ps_value_clone(attributes))) &&
        ps_set(node, "hidden", ps_bool_value(!enabled_bool(design, "show")));
    free(style.bytes);
    if (!ok) { ps_value_free(node); return NULL; }
    return node;
}

/* A header member; text with NULL bytes is absent. */
typedef struct {
    const char *key;
    ps_text text;
} header_part;

/* Attach a header with design.label appearance when any part has text. */
static bool attach_header(ps_value *node, const ps_value *design,
                          const header_part *parts, size_t count)
{
    bool present = false;
    for (size_t i = 0; i < count; ++i) if (parts[i].text.bytes && parts[i].text.length) present = true;
    if (!present) return true;
    const ps_value *label = member(design, "label");
    ps_chars style = ps_style_string(text_member(label, "style"));
    ps_value *header = ps_object_value();
    bool ok = style.bytes && header && set_text(header, "className", text_member(label, "class")) &&
        (!style.length || set_text(header, "style", ps_view(style)));
    for (size_t i = 0; ok && i < count; ++i)
        if (parts[i].text.bytes && parts[i].text.length) ok = set_text(header, parts[i].key, parts[i].text);
    if (ok) ok = set_owned_value(node, "header", &header);
    free(style.bytes); ps_value_free(header);
    return ok;
}

static bool attach_body(ps_value *node, ps_text class_name, ps_text style_source, ps_text id)
{
    ps_chars style = ps_style_string(style_source);
    ps_value *body = ps_object_value();
    bool ok = style.bytes && body && set_text(body, "className", class_name) &&
        (!style.length || set_text(body, "style", ps_view(style))) &&
        (!id.length || set_text(body, "id", id)) && set_owned_value(node, "body", &body);
    free(style.bytes); ps_value_free(body);
    return ok;
}

static bool append_action(ps_value *actions, const char *name, const char *label, bool disabled)
{
    ps_value *action = ps_object_value();
    bool ok = action && set_string(action, "name", name) && set_string(action, "label", label) &&
        ps_set(action, "disabled", ps_bool_value(disabled)) && append_owned(actions, &action);
    ps_value_free(action);
    return ok;
}

static bool attach_controls(ps_value *node, const char *placement, const char *label,
                            ps_value **actions)
{
    ps_value *controls = ps_object_value();
    bool ok = controls && set_string(controls, "placement", placement) &&
        set_string(controls, "label", label) && set_owned_value(controls, "actions", actions) &&
        set_owned_value(node, "controls", &controls);
    ps_value_free(controls); ps_value_free(*actions); *actions = NULL;
    return ok;
}

/* Control the label targets: the file input, else the widget control; NULL bytes for none. */
static ps_text label_target(const ps_value *widget)
{
    if (enabled_bool(widget, "unsupported")) return (ps_text){NULL, 0};
    const ps_value *id = member(member(member(widget, "extra"), "file"), "id");
    if (!id || id->kind == PS_NULL) id = member(member(widget, "attrs"), "id");
    return id && id->kind == PS_STRING && id->data.string.length ? ps_string(id) : (ps_text){NULL, 0};
}

/* The design.layout a group declares; compilation has checked the value. */
static ps_text declared_layout(const ps_value *spec)
{
    const ps_value *layout = member(member(spec, "design"), "layout");
    return layout && layout->kind == PS_STRING ? ps_string(layout) : (ps_text){NULL, 0};
}

/* The scope of a group's children: a declared layout replaces the inherited one, and a line ends it. */
static row_scope layout_scope(const row_scope *scope, ps_text layout)
{
    row_scope next = *scope;
    if (layout.bytes) next.inline_layout = ps_text_is(layout, "inline");
    return next;
}

/* Prepend layout modifiers to the root class of a node. */
static bool prepend_class(ps_value *node, ps_text first, ps_text second)
{
    ps_chars joined = ps_join_classes(first, second, text_member(node, "className"));
    bool ok = joined.bytes && set_text(node, "className", ps_view(joined));
    free(joined.bytes);
    return ok;
}

/* Node tree builder. */

static ps_value *build_field(const ps_value *field, ps_text path,
                             const bind_context *context, const row_scope *scope,
                             ps_value **error);

static ps_value *build_children(const ps_value *field, ps_text path,
                                const bind_context *context, const row_scope *scope,
                                ps_value **error)
{
    const ps_value *templates = member(field, "children");
    ps_value *children = ps_array_value();
    if (!children || !templates || templates->kind != PS_ARRAY) {
        ps_value_free(children); return NULL;
    }
    for (size_t i = 0; i < ps_size(templates); ++i) {
        const ps_value *child = ps_at(templates, i);
        const ps_value *name = member(child, "name");
        if (!name || name->kind != PS_STRING) { ps_value_free(children); return NULL; }
        ps_chars child_path = ps_join_path(path, ps_string(name));
        ps_value *model = child_path.bytes
            ? build_field(child, ps_view(child_path), context, scope, error) : NULL;
        free(child_path.bytes);
        if (!model || !append_owned(children, &model)) {
            ps_value_free(model);
            ps_value_free(children); return NULL;
        }
    }
    return children;
}

static ps_value *build_leaf(const ps_value *spec, ps_text type, ps_text path,
                            const ps_value *design, ps_text label,
                            ps_text description, const bind_context *context,
                            const row_scope *scope, ps_value **error)
{
    const ps_value *value = ps_path(context->data, path);
    ps_value *node = node_root("field", path, design, spec);
    if (!node) return NULL;
    /* A field node of an inline layout is one row of a label column and a control column. */
    if (scope->inline_layout && !prepend_class(node, PS_TEXT("crudui-node--inline"), PS_TEXT(""))) {
        ps_value_free(node); return NULL;
    }
    if (ps_text_is(type, "checkbox") || ps_text_is(type, "switcher")) {
        ps_chars id = ps_control_id(context->id_prefix, path);
        ps_chars name = ps_bracket_name(path, context->key_prefix);
        /* A switcher is a checkbox input announced and drawn as a switch. */
        bool switcher = ps_text_is(type, "switcher");
        ps_chars class_name = ps_join_classes(PS_TEXT("valid-target"),
            switcher ? PS_TEXT("crudui-input crudui-input--switch") : PS_TEXT(""),
            text_member(member(design, "main"), "class"));
        ps_value *checkbox = ps_object_value();
        /* An inline layout writes the label in the label column of the header instead of the caption. */
        bool header_label = scope->inline_layout && label.length;
        header_part parts[] = {{"label", header_label ? label : (ps_text){NULL, 0}},
                               {"labelFor", header_label && id.bytes ? ps_view(id) : (ps_text){NULL, 0}},
                               {"description", description}};
        bool ok = id.bytes && name.bytes && class_name.bytes && checkbox &&
            attach_header(node, design, parts, 3) &&
            attach_body(node, PS_TEXT(""), PS_TEXT(""), (ps_text){NULL, 0}) &&
            set_text(checkbox, "id", ps_view(id)) && set_text(checkbox, "name", ps_view(name)) &&
            set_text(checkbox, "className", ps_view(class_name)) &&
            ps_set(checkbox, "checked", ps_bool_value(checked_value(value) ||
                (!value && checked_value(member(spec, "default"))))) &&
            (!switcher || set_text(checkbox, "role", PS_TEXT("switch"))) &&
            (header_label || set_text(checkbox, "caption", label.bytes ? label : PS_TEXT(""))) &&
            (!ps_declared_attributes(spec, false) ||
             ps_set(checkbox, "attributes", ps_value_clone(ps_declared_attributes(spec, false)))) &&
            set_owned_value(node, "checkbox", &checkbox);
        free(id.bytes); free(name.bytes); free(class_name.bytes); ps_value_free(checkbox);
        if (!ok) { ps_value_free(node); return NULL; }
        return node;
    }
    ps_value *widget = build_widget(spec, value, path, design, context, scope, error);
    bool ok = widget != NULL;
    if (ok && !ps_text_is(type, "hidden")) {
        ps_text label_for = label.bytes ? label_target(widget) : (ps_text){NULL, 0};
        header_part parts[] = {{"label", label}, {"labelFor", label_for}, {"description", description}};
        ok = attach_header(node, design, parts, 3);
    }
    ok = ok && attach_body(node, PS_TEXT(""), PS_TEXT(""), (ps_text){NULL, 0}) &&
        set_owned_value(node, "widget", &widget);
    ps_value_free(widget);
    if (!ok) { ps_value_free(node); return NULL; }
    return node;
}

static ps_value *build_group(const ps_value *field, ps_text path, const ps_value *design,
                             ps_text label, ps_text description,
                             const bind_context *context, const row_scope *scope,
                             ps_value **error)
{
    const ps_value *value = ps_path(context->data, path);
    if (value && value->kind != PS_OBJECT) {
        *error = group_data_error(path);
        return NULL;
    }
    const ps_value *group = member(design, "group");
    ps_text layout = declared_layout(member(field, "spec"));
    ps_value *node = node_root("group", path, design, member(field, "spec"));
    header_part parts[] = {{"label", label}, {"description", description}};
    /* A line group is one row in an inline layout, and its children take no inline layout. */
    bool line = ps_text_is(layout, "line");
    bool ok = node &&
        (!line || prepend_class(node, scope->inline_layout ? PS_TEXT("crudui-node--inline") : PS_TEXT(""),
                                PS_TEXT("crudui-node--line"))) &&
        attach_header(node, design, parts, 2) &&
        attach_body(node, text_member(group, "class"), text_member(group, "style"), (ps_text){NULL, 0});
    row_scope inner = layout_scope(scope, layout);
    ps_value *children = ok ? build_children(field, path, context, &inner, error) : NULL;
    ok = children && set_owned_value(node, "children", &children);
    ps_value_free(children);
    if (!ok) { ps_value_free(node); return NULL; }
    return node;
}

/* "1.2.3" from the one-based row numbers. */
static ps_chars row_number(const size_t *numbers, size_t count)
{
    ps_html_buffer out = {0};
    for (size_t i = 0; i < count; ++i) {
        ps_chars number = ps_decimal(numbers[i]);
        if (!number.bytes) out.failed = true;
        if (i) ps_html_character(&out, '.');
        ps_html_append(&out, ps_view(number));
        free(number.bytes);
    }
    return ps_html_take(&out);
}

/* Whether a row path is listed in the collapsed option. */
static bool row_collapsed(ps_text row_path, const bind_context *context)
{
    for (size_t i = 0; context->collapsed && i < ps_size(context->collapsed); ++i)
        if (ps_text_equal(ps_string(ps_at(context->collapsed, i)), row_path)) return true;
    return false;
}

/* Title of a group row: the title child's value, or the untitled message when empty. */
static ps_chars row_title(ps_text row_path, ps_text title, const bind_context *context)
{
    ps_chars title_path = ps_join_path(row_path, title);
    if (!title_path.bytes) return title_path;
    const ps_value *value = ps_path(context->data, ps_view(title_path));
    free(title_path.bytes);
    if (!value || value->kind == PS_NULL || (value->kind == PS_STRING && !value->data.string.length))
        return ps_copy(ps_fixed(context->messages->untitled));
    return ps_js_string(value);
}

static ps_value *build_row(const ps_value *field, const ps_value *spec,
                           ps_text collection_path, ps_text key, size_t index,
                           size_t count, bool group, ps_text label,
                           const multiple_settings *settings, const bind_context *context,
                           const row_scope *scope, size_t *numbers, const size_t *segments,
                           ps_value **error)
{
    const ps_form_messages *messages = context->messages;
    ps_chars row_path = ps_join_path(collection_path, key);
    ps_value *row_design = row_path.bytes
        ? ps_design(member(spec, "design"), context->data, ps_view(row_path), segments, scope->count + 1) : NULL;
    numbers[scope->count] = index + 1;
    row_scope inner = {segments, numbers, scope->count + 1,
                       scope->sticky_depth + (settings->sticky ? 1 : 0), scope->inline_layout};
    bool full = settings->has_max && (double)count >= settings->max;
    ps_chars number = row_number(numbers, scope->count + 1);
    ps_value *actions = ps_array_value();
    ps_value *row = ps_object_value();
    bool ok = row_path.bytes && row_design && number.bytes && actions && row;
    /* Rows of a data-only collection have no row controls. */
    if (ok && settings->only) {
        ps_value_free(actions);
        actions = NULL;
    }
    if (ok && actions && settings->sortable)
        ok = append_action(actions, "move-up", messages->move_up, index == 0) &&
            append_action(actions, "move-down", messages->move_down, index + 1 == count);
    if (ok && actions) ok = append_action(actions, "add-row", messages->add_row, full);
    if (ok && actions && settings->copy) ok = append_action(actions, "copy-row", messages->copy_row, full);
    if (ok && actions) ok = append_action(actions, "remove-row", messages->remove_row,
                                          settings->has_min && (double)count <= settings->min);
    ok = ok && set_string(row, "kind", "row") && set_text(row, "key", key) &&
        set_string(row, "className", "") && ps_set(row, "hidden", ps_bool_value(false)) &&
        (!actions || attach_controls(row, settings->controls, messages->row_controls, &actions));
    if (ok && settings->sticky)
        ok = ps_set(row, "sticky", ps_bool_value(true)) &&
            ps_set(row, "stickyDepth", ps_int_value((int64_t)scope->sticky_depth));
    ps_value *header = ok ? ps_object_value() : NULL;
    ok = header && set_string(header, "className", "") &&
        (!label.bytes || set_text(header, "label", label)) && set_text(header, "number", ps_view(number));
    if (ok && !group) {
        const ps_value *value = ps_path(context->data, ps_view(row_path));
        ps_value *widget = build_widget(spec, value, ps_view(row_path), row_design, context, &inner, error);
        ok = widget && set_owned_value(row, "header", &header) &&
            attach_body(row, PS_TEXT(""), PS_TEXT(""), (ps_text){NULL, 0}) &&
            set_owned_value(row, "widget", &widget);
        ps_value_free(widget);
    } else if (ok) {
        const ps_value *value = ps_path(context->data, ps_view(row_path));
        if (value && value->kind != PS_OBJECT) {
            *error = group_data_error(ps_view(row_path));
            ok = false;
        }
        ps_value *children = ok ? build_children(field, ps_view(row_path), context, &inner, error) : NULL;
        size_t nested = 0, nested_rows = 0;
        for (size_t i = 0; children && i < ps_size(children); ++i) {
            const ps_value *child = ps_at(children, i);
            if (!ps_is_string(member(child, "kind"), "collection")) continue;
            nested++;
            nested_rows += ps_size(member(child, "children"));
        }
        ps_chars summary = !children ? (ps_chars){NULL, 0} : nested
            ? ps_format_count(messages->children, nested_rows)
            : ps_copy(ps_fixed(messages->collapsed));
        ps_chars title = children && settings->title.bytes
            ? row_title(ps_view(row_path), settings->title, context) : (ps_chars){NULL, 0};
        ps_chars control = children ? ps_control_id(context->id_prefix, ps_view(row_path)) : (ps_chars){NULL, 0};
        ps_chars body_id = control.bytes ? PS_CONCAT(ps_view(control), PS_TEXT(":body")) : control;
        const ps_value *design_group = member(row_design, "group");
        ok = children && summary.bytes && (!settings->title.bytes || title.bytes) && body_id.bytes &&
            (!settings->title.bytes || set_text(header, "title", ps_view(title))) &&
            set_text(header, "summary", ps_view(summary)) && set_owned_value(row, "header", &header) &&
            attach_body(row, text_member(design_group, "class"),
                        text_member(design_group, "style"), ps_view(body_id)) &&
            ps_set(row, "collapsible", ps_bool_value(true)) &&
            ps_set(row, "expanded", ps_bool_value(!row_collapsed(ps_view(row_path), context))) &&
            set_string(row, "toggleLabel", messages->toggle_row) &&
            set_owned_value(row, "children", &children);
        ps_value_free(children); free(summary.bytes); free(title.bytes);
        free(control.bytes); free(body_id.bytes);
    }
    ps_value_free(header); ps_value_free(actions);
    free(number.bytes); free(row_path.bytes); ps_value_free(row_design);
    if (!ok) { ps_value_free(row); return NULL; }
    return row;
}

static ps_value *build_collection(const ps_value *field, const ps_value *spec,
                                  ps_text type, ps_text path,
                                  const ps_value *design, ps_text label,
                                  ps_text description, const multiple_settings *settings,
                                  const bind_context *context, const row_scope *scope,
                                  ps_value **error)
{
    const ps_value *value = ps_path(context->data, path);
    if (value && value->kind != PS_OBJECT) {
        *error = input_error_with("Repeated data must be a keyed object: ", path);
        return NULL;
    }
    size_t path_length = 0;
    ps_text *parts = NULL;
    if (!ps_path_parts(path, &parts, &path_length)) return NULL;
    free(parts);
    size_t *segments = malloc((scope->count + 1) * sizeof(*segments));
    size_t *numbers = malloc((scope->count + 1) * sizeof(*numbers));
    ps_value *rows = ps_array_value();
    bool ok = segments && numbers && rows;
    if (ok) {
        if (scope->count) {
            memcpy(segments, scope->segments, scope->count * sizeof(*segments));
            memcpy(numbers, scope->numbers, scope->count * sizeof(*numbers));
        }
        segments[scope->count] = path_length;
    }
    bool group = ps_text_is(type, "group");
    /* A repeated group applies its declared layout to the fields of its rows. */
    row_scope rows_scope = group ? layout_scope(scope, declared_layout(spec)) : *scope;
    size_t count = value ? ps_size(value) : settings->only ? 0 : 1;
    for (size_t i = 0; ok && i < count; ++i) {
        ps_text key = value ? ps_key(value, i) : PS_TEXT("__0000000000000__");
        ps_value *row = build_row(field, spec, path, key, i, count, group, label, settings,
                                  context, &rows_scope, numbers, segments, error);
        ok = row && append_owned(rows, &row);
        ps_value_free(row);
    }
    free(segments); free(numbers);
    ps_chars count_text = ok ? ps_format_count(context->messages->count, count) : (ps_chars){NULL, 0};
    ps_value *node = count_text.bytes ? node_root("collection", path, design, spec) : NULL;
    header_part header[] = {{"label", label}, {"description", description}, {"count", ps_view(count_text)}};
    ok = node && attach_header(node, design, header, 3) &&
        attach_body(node, PS_TEXT(""), PS_TEXT(""), (ps_text){NULL, 0}) &&
        set_string(node, "item", group ? "group" : "field");
    if (ok && !count && !settings->only) {
        ps_value *actions = ps_array_value();
        bool full = settings->has_max && 0 >= settings->max;
        ok = actions && append_action(actions, "add-row", context->messages->add_row, full) &&
            attach_controls(node, "footer",
                            context->messages->collection_controls, &actions);
        ps_value_free(actions);
    }
    ok = ok && set_owned_value(node, "children", &rows);
    free(count_text.bytes); ps_value_free(rows);
    if (!ok) { ps_value_free(node); return NULL; }
    return node;
}

static ps_value *build_lang(const ps_value *spec, ps_text path, const ps_value *design,
                            ps_text label, ps_text description,
                            const bind_context *context, const row_scope *scope,
                            ps_value **error)
{
    const ps_value *lang = member(spec, "lang");
    const ps_value *settings = lang && lang->kind == PS_OBJECT ? lang : NULL;
    const ps_value *frame = member(settings, "frame");
    /* A framed language group is a node modifier; the stylesheet draws the frame around its body. */
    ps_text frame_class = frame && frame->kind == PS_BOOL && !frame->data.boolean
        ? PS_TEXT("") : PS_TEXT("crudui-node--framed");
    ps_chars title = {NULL, 0};
    bool ok = translated(member(settings, "title"), context->language, &title);
    ps_chars root_class = ok ? ps_join_classes(frame_class,
        text_member(member(design, "wrapper"), "class"), PS_TEXT("")) : (ps_chars){NULL, 0};
    ps_chars group_class = root_class.bytes
        ? ps_join_classes(text_member(settings, "group_class"), PS_TEXT(""), PS_TEXT("")) : root_class;
    ps_value *node = group_class.bytes ? node_root("lang", path, design, spec) : NULL;
    header_part header[] = {{"label", label}, {"description", description}, {"title", ps_view(title)}};
    if (!title.bytes) header[2].text = (ps_text){NULL, 0};
    ok = node && set_text(node, "className", ps_view(root_class)) &&
        attach_header(node, design, header, 3) &&
        attach_body(node, ps_view(group_class), PS_TEXT(""), (ps_text){NULL, 0});
    free(title.bytes); free(root_class.bytes); free(group_class.bytes);
    ps_value *children = ok ? ps_array_value() : NULL;
    ok = children != NULL;
    const ps_value *only = member(settings, "only");
    static const char *const defaults[] = {"ko", "en", "ja", "zh"};
    bool listed = only && only->kind == PS_ARRAY && ps_size(only);
    size_t count = listed ? ps_size(only) : 4;
    for (size_t i = 0; ok && i < count; ++i) {
        /* Compilation admits only string codes; a listed non-string is an invalid template. */
        const ps_value *code_value = listed ? ps_at(only, i) : NULL;
        if (listed && code_value->kind != PS_STRING) { ok = false; break; }
        ps_text code = listed ? ps_string(code_value) : ps_fixed(defaults[i]);
        ps_chars lang_path = ps_join_path(path, code);
        ps_value *lang_design = lang_path.bytes
            ? ps_design(member(spec, "design"), context->data, ps_view(lang_path), scope->segments, scope->count) : NULL;
        const ps_value *value = lang_path.bytes ? ps_path(context->data, ps_view(lang_path)) : NULL;
        ps_value *widget = lang_design
            ? build_widget(spec, value, ps_view(lang_path), lang_design, context, scope, error) : NULL;
        ps_value *child = ps_object_value();
        ps_value *child_header = ps_object_value();
        ok = widget && child && child_header &&
            set_string(child, "kind", "lang-item") && set_text(child, "lang", code) &&
            set_string(child, "className", "") && ps_set(child, "hidden", ps_bool_value(false)) &&
            set_string(child_header, "className", "") && set_text(child_header, "label", code) &&
            set_owned_value(child, "header", &child_header) &&
            attach_body(child, PS_TEXT(""), PS_TEXT(""), (ps_text){NULL, 0}) &&
            set_owned_value(child, "widget", &widget) && append_owned(children, &child);
        free(lang_path.bytes); ps_value_free(lang_design);
        ps_value_free(widget); ps_value_free(child); ps_value_free(child_header);
    }
    ok = ok && set_owned_value(node, "children", &children);
    ps_value_free(children);
    if (!ok) { ps_value_free(node); return NULL; }
    return node;
}

static ps_value *build_field(const ps_value *field, ps_text path,
                             const bind_context *context, const row_scope *scope,
                             ps_value **error)
{
    const ps_value *spec = member(field, "spec");
    if (!spec || spec->kind != PS_OBJECT) return NULL;
    ps_chars type = field_type(spec);
    ps_value *design = type.bytes ? ps_design(member(spec, "design"), context->data, path, scope->segments, scope->count) : NULL;
    ps_chars label = {NULL, 0}, description = {NULL, 0};
    ps_value *model = NULL;
    if (type.bytes && design && translated(member(spec, "label"), context->language, &label) &&
        translated(member(spec, "description"), context->language, &description)) {
        multiple_settings settings;
        const ps_value *lang = member(spec, "lang");
        ps_text label_text = label.bytes ? ps_view(label) : (ps_text){NULL, 0};
        ps_text description_text = description.bytes ? ps_view(description) : (ps_text){NULL, 0};
        if (resolve_multiple(member(spec, "multiple"), &settings))
            model = build_collection(field, spec, ps_view(type), path, design, label_text,
                                     description_text, &settings, context, scope, error);
        else if (ps_text_is(ps_view(type), "group"))
            model = build_group(field, path, design, label_text, description_text, context, scope, error);
        else if (lang && ((lang->kind == PS_BOOL && lang->data.boolean) || lang->kind == PS_OBJECT))
            model = build_lang(spec, path, design, label_text, description_text, context, scope, error);
        else
            model = build_leaf(spec, ps_view(type), path, design, label_text, description_text,
                               context, scope, error);
    }
    free(label.bytes); free(description.bytes);
    ps_value_free(design); free(type.bytes); return model;
}

/* Whether every item of a list is a string. */
static bool string_list(const ps_value *list)
{
    for (size_t i = 0; i < ps_size(list); ++i) {
        const ps_value *item = ps_at(list, i);
        if (!item || item->kind != PS_STRING) return false;
    }
    return true;
}

/* A string option; absent or null has NULL bytes. */
static bool string_option(const ps_value *options, const char *name,
                          ps_text *output, ps_value **error)
{
    const ps_value *value = member(options, name);
    if (!value || value->kind == PS_NULL) { *output = (ps_text){NULL, 0}; return true; }
    if (value->kind == PS_STRING) { *output = ps_string(value); return true; }
    char message[128];
    snprintf(message, sizeof(message), "%s must be a string", name);
    *error = ps_error("form", "INVALID_FORM_INPUT", message, "", NULL);
    return false;
}

static ps_result bind_form(const ps_value *template, const ps_value *data,
                           const ps_value *options);

/* A compiled template is bound in specification member order; the data keeps its order. */
ps_result ps_bind_form(const ps_value *template, const ps_value *data,
                       const ps_value *options)
{
    ps_value *ordered = NULL;
    if (!ps_order_specification(template, NULL, &ordered, NULL))
        return ps_fail("internal", "INTERNAL_ERROR", "C form binding failed", "");
    ps_result result = bind_form(ordered, data, options);
    ps_value_free(ordered);
    return result;
}

/* Template, data, options and language checks shared by form and button binding. */
/* Every member of an object is one of the allowed names. */
static bool only_members(const ps_value *object, const char *const *allowed, size_t count)
{
    for (size_t index = 0; index < ps_size(object); index++) {
        ps_text key = ps_key(object, index);
        bool known = false;
        for (size_t name = 0; name < count && !known; name++)
            known = ps_text_is(key, allowed[name]);
        if (!known) return false;
    }
    return true;
}

/* A list of field templates, each with exactly a string name, an object spec and a list children. */
static bool field_template_list(const ps_value *fields)
{
    static const char *const names[] = {"name", "spec", "children"};
    if (!fields || fields->kind != PS_ARRAY) return false;
    for (size_t index = 0; index < ps_size(fields); index++) {
        const ps_value *field = ps_at(fields, index);
        const ps_value *name = member(field, "name"), *spec = member(field, "spec");
        if (!field || field->kind != PS_OBJECT || ps_size(field) != 3 ||
            !only_members(field, names, 3) || !name || name->kind != PS_STRING ||
            !spec || spec->kind != PS_OBJECT || !field_template_list(member(field, "children")))
            return false;
    }
    return true;
}

bool ps_form_template_shape(const ps_value *template)
{
    static const char *const names[] = {"kind", "keyPrefix", "fields", "buttons", "action", "description"};
    if (!template || template->kind != PS_OBJECT || !only_members(template, names, 6) ||
        !ps_is_string(member(template, "kind"), "crudui/form-template") ||
        !field_template_list(member(template, "fields")))
        return false;
    const ps_value *buttons = member(template, "buttons");
    if (!buttons || buttons->kind != PS_ARRAY) return false;
    for (size_t index = 0; index < ps_size(buttons); index++) {
        const ps_value *button = ps_at(buttons, index);
        if (!button || button->kind != PS_OBJECT) return false;
    }
    const ps_value *key_prefix = member(template, "keyPrefix"), *action = member(template, "action");
    return (!key_prefix || key_prefix->kind == PS_STRING) && (!action || action->kind == PS_OBJECT);
}

static ps_result check_bind_input(const ps_value *template, const ps_value *data,
                                  const ps_value *options, ps_text *language_output)
{
    if (!ps_form_template_shape(template))
        return ps_fail("form", "INVALID_FORM_INPUT", "Unsupported form template", "");
    if (!data || data->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "Form data must be an object", "");
    if (!options || options->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "Options must be an object", "");
    /* An absent or null language is Korean; any other non-string is rejected before text conversion. */
    const ps_value *language_value = member(options, "language");
    if (language_value && language_value->kind != PS_NULL && language_value->kind != PS_STRING)
        return ps_fail("form", "INVALID_FORM_INPUT", "Language must be a string", "");
    *language_output = language_value && language_value->kind == PS_STRING
        ? ps_string(language_value) : PS_TEXT("ko");
    return (ps_result){NULL, NULL};
}

static ps_result unsupported_language(ps_text language)
{
    ps_chars message = PS_CONCAT(PS_TEXT("Unsupported language: "), language);
    if (!message.bytes) return ps_fail("internal", "INTERNAL_ERROR", "C form binding failed", "");
    ps_result failure = ps_fail_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""));
    free(message.bytes);
    return failure;
}

/* Public button binding: form binding input checks, then the buttons in specification order. */
/* The declared button types are link, submit, button and reset; another type is an input error (CURP-008). */
static ps_result invalid_button_type(const ps_value *template)
{
    const ps_value *declared = member(template, "buttons");
    for (size_t i = 0; declared && declared->kind == PS_ARRAY && i < ps_size(declared); ++i) {
        ps_text type = text_member(ps_at(declared, i), "type");
        if (ps_text_is(type, "link") || ps_text_is(type, "submit") || ps_text_is(type, "button") ||
            ps_text_is(type, "reset"))
            continue;
        ps_chars message = PS_CONCAT(ps_fixed("Invalid button type: "), type);
        if (!message.bytes) return ps_fail("internal", "INTERNAL_ERROR", "C button binding failed", "");
        ps_result failure = ps_fail_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""));
        free(message.bytes);
        return failure;
    }
    ps_result none = {NULL, NULL};
    return none;
}

ps_result ps_bind_form_buttons(const ps_value *template, const ps_value *data,
                               const ps_value *options)
{
    ps_value *ordered = NULL;
    if (!ps_order_specification(template, NULL, &ordered, NULL))
        return ps_fail("internal", "INTERNAL_ERROR", "C button binding failed", "");
    ps_text language = {NULL, 0};
    ps_result result = check_bind_input(ordered, data, options, &language);
    if (!result.error) result = invalid_button_type(ordered);
    if (!result.error) {
        if (!ps_form_messages_for(language)) result = unsupported_language(language);
        else {
            ps_value *buttons = ps_bind_buttons(ordered, data, language);
            result = buttons ? ps_ok(buttons)
                : ps_fail("internal", "INTERNAL_ERROR", "C button binding failed", "");
        }
    }
    ps_value_free(ordered);
    return result;
}

static ps_result bind_form(const ps_value *template, const ps_value *data,
                           const ps_value *options)
{
    ps_text language = {NULL, 0};
    ps_result checked = check_bind_input(template, data, options, &language);
    if (checked.error) return checked;
    ps_value *error = NULL;
    ps_text key_prefix = {NULL, 0}, id_prefix = {NULL, 0};
    if (!string_option(options, "keyPrefix", &key_prefix, &error) ||
        !string_option(options, "idPrefix", &id_prefix, &error))
        return (ps_result){NULL, error};
    /* An absent or null mode throws; any other value must name a mode exactly. */
    const ps_value *unsupported = member(options, "unsupported");
    if (unsupported && unsupported->kind != PS_NULL &&
        !ps_is_string(unsupported, "throw") && !ps_is_string(unsupported, "marker"))
        return ps_fail("form", "INVALID_FORM_INPUT", "unsupported must be throw or marker", "");
    /* An absent or null collapsed option has no collapsed row; any other value is a list of row paths. */
    const ps_value *collapsed = member(options, "collapsed");
    if (collapsed && collapsed->kind == PS_NULL) collapsed = NULL;
    if (collapsed && (collapsed->kind != PS_ARRAY || !string_list(collapsed)))
        return ps_fail("form", "INVALID_FORM_INPUT", "collapsed must be a list of strings", "");
    const ps_form_messages *messages = ps_form_messages_for(language);
    if (!messages) return unsupported_language(language);
    if (!key_prefix.bytes) {
        const ps_value *stored = member(template, "keyPrefix");
        if (stored && stored->kind == PS_STRING) key_prefix = ps_string(stored);
    }
    bind_context context = {
        data, key_prefix, id_prefix.bytes ? id_prefix : PS_TEXT("crudui"), language, messages,
        ps_is_string(unsupported, "marker"), collapsed
    };
    row_scope root = {NULL, NULL, 0, 0, false};
    ps_value *fields = ps_array_value();
    const ps_value *templates = member(template, "fields");
    for (size_t i = 0; fields && i < ps_size(templates); ++i) {
        const ps_value *field = ps_at(templates, i);
        const ps_value *name = member(field, "name");
        ps_value *model = name && name->kind == PS_STRING
            ? build_field(field, ps_string(name), &context, &root, &error) : NULL;
        if (!model || !append_owned(fields, &model)) {
            ps_value_free(model); ps_value_free(fields); fields = NULL; break;
        }
    }
    if (!fields) {
        if (error) return (ps_result){NULL, error};
        return ps_fail("internal", "INTERNAL_ERROR", "C form binding failed", "");
    }
    return ps_ok(fields);
}

/* A behavior script: a string, or the script of a label and script action; NULL bytes for none. */
static ps_text behavior_script(const ps_value *behavior, const char *action)
{
    const ps_value *entry = member(behavior, action);
    const ps_value *script = entry && entry->kind == PS_OBJECT ? ps_get(entry, "script") : entry;
    return script && script->kind == PS_STRING && script->data.string.length
        ? ps_string(script) : (ps_text){NULL, 0};
}

/* Declared content, or the interface text of the button type when nothing translates. */
static ps_chars button_text(const ps_value *declared, ps_text language, const char *fallback)
{
    if (declared && (declared->kind == PS_STRING || declared->kind == PS_OBJECT)) {
        ps_chars text = ps_translate(declared, language);
        if (!text.bytes || text.length || declared->kind == PS_STRING) return text;
        free(text.bytes);
    }
    return ps_copy(ps_fixed(fallback));
}

ps_value *ps_bind_buttons(const ps_value *template, const ps_value *data, ps_text language)
{
    static const char *const optional[] = {"name", "value", "href"};
    const ps_form_messages *messages = ps_form_messages_for(language);
    const ps_value *declared = member(template, "buttons");
    ps_value *buttons = ps_array_value();
    if (!messages || !buttons) { ps_value_free(buttons); return NULL; }
    for (size_t i = 0; declared && declared->kind == PS_ARRAY && i < ps_size(declared); ++i) {
        const ps_value *spec = ps_at(declared, i);
        ps_text type = text_member(spec, "type");
        bool link = ps_text_is(type, "link");
        const char *fallback = ps_text_is(type, "submit") ? messages->submit
            : ps_text_is(type, "reset") ? messages->reset : "";
        ps_value *design = ps_design(member(spec, "design"), data, PS_TEXT(""), NULL, 0);
        const ps_value *main_node = member(design, "main");
        ps_text extra = text_member(main_node, "class");
        ps_chars style = ps_style_string(text_member(main_node, "style"));
        ps_chars class_name = PS_CONCAT(PS_TEXT("crudui-action crudui-action--text"),
                                        extra.length ? PS_TEXT(" ") : PS_TEXT(""), extra);
        ps_chars text = button_text(member(spec, "text"), language, fallback);
        ps_text script = behavior_script(member(spec, "behavior"), "onclick");
        ps_value *attrs = ps_object_value();
        ps_value *button = ps_object_value();
        bool ok = design && main_node && style.bytes && class_name.bytes && text.bytes && attrs && button &&
            (link || set_text(attrs, "type", type)) &&
            set_text(attrs, "class", ps_view(class_name)) &&
            (!style.length || set_text(attrs, "style", ps_view(style)));
        for (size_t j = 0; ok && j < 3; ++j) {
            const ps_value *value = member(spec, optional[j]);
            if (value && value->kind == PS_STRING) ok = ps_set(attrs, optional[j], ps_value_clone(value));
        }
        ok = ok && (!script.bytes || set_text(attrs, "onclick", script)) &&
            set_text(button, "type", type) &&
            ps_set(button, "tag", ps_string_value(link ? "a" : "button")) &&
            set_text(button, "text", ps_view(text));
        if (ok) { ok = ps_set(button, "attrs", attrs); attrs = NULL; }
        if (ok) { ok = ps_append(buttons, button); button = NULL; }
        ps_value_free(design); ps_value_free(attrs); ps_value_free(button);
        free(style.bytes); free(class_name.bytes); free(text.bytes);
        if (!ok) { ps_value_free(buttons); return NULL; }
    }
    return buttons;
}
