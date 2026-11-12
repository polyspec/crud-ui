#include "engine_internal.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const ps_value *spec;
    const ps_value *value;
    bool value_present;
    ps_text path;
    const ps_value *design;
    ps_text key_prefix;
    ps_text id;
    ps_text language;
    const size_t *rows;
    size_t row_count;
} widget_context;

/* Set owned text and free it. */
static bool set_owned(ps_value *object, const char *key, ps_chars value)
{
    bool result = value.bytes && set_text(object, key, ps_view(value));
    free(value.bytes); return result;
}

/* Set owned text unless it is empty, and free it. */
static bool set_nonempty(ps_value *object, const char *key, ps_chars value)
{
    if (!value.bytes) return false;
    bool result = !value.length || set_text(object, key, ps_view(value));
    free(value.bytes); return result;
}

/* A new owned copy: the texts joined, or NULL bytes when a part is missing. */
static ps_chars joined(ps_chars first, ps_text second, ps_text third)
{
    return first.bytes ? PS_CONCAT(ps_view(first), second, third) : (ps_chars){NULL, 0};
}

static const ps_value *design_node(const widget_context *context, const char *name)
{
    const ps_value *node = *name ? member(context->design, name) : context->design;
    return node && node->kind == PS_OBJECT ? node : NULL;
}

static ps_chars context_class(const widget_context *context, const char *base)
{
    return ps_join_classes(ps_fixed(base), text_member(design_node(context, "main"), "class"), PS_TEXT(""));
}

static ps_chars context_style(const widget_context *context)
{
    return ps_style_string(text_member(design_node(context, "main"), "style"));
}

static ps_chars context_name(const widget_context *context)
{
    return ps_bracket_name(context->path, context->key_prefix);
}

static ps_chars context_text(const widget_context *context, const char *key)
{
    return ps_translate(member(context->spec, key), context->language);
}

static ps_chars context_option(const widget_context *context, const char *key,
                               const char *default_value)
{
    const ps_value *options = member(context->spec, "options");
    const ps_value *value = member(options, key);
    return value && value->kind != PS_NULL ? ps_scalar_string(value) : ps_copy(ps_fixed(default_value));
}

static ps_chars context_value(const widget_context *context)
{
    const ps_value *value = context->value_present ? context->value
        : member(context->spec, "default");
    return ps_scalar_string(value);
}

static ps_chars behavior_script(const widget_context *context, ps_text action)
{
    const ps_value *behavior = member(context->spec, "behavior");
    const ps_value *entry = behavior && behavior->kind == PS_OBJECT ? ps_get_text(behavior, action) : NULL;
    if (entry && entry->kind == PS_STRING) return ps_copy(ps_string(entry));
    const ps_value *script = member(entry, "script");
    return ps_copy(script && script->kind == PS_STRING ? ps_string(script) : PS_TEXT(""));
}

static bool add_behavior(const widget_context *context, ps_value *attrs)
{
    const ps_value *behavior = member(context->spec, "behavior");
    if (!behavior || behavior->kind != PS_OBJECT) return true;
    for (size_t i = 0; i < ps_size(behavior); ++i) {
        ps_text name = ps_key(behavior, i);
        ps_chars script = behavior_script(context, name);
        if (!script.bytes) return false;
        if (script.length && !ps_set_text(attrs, name, ps_text_value(ps_view(script)))) {
            free(script.bytes); return false;
        }
        free(script.bytes);
    }
    return true;
}

static bool add_data(const widget_context *context, ps_value *attrs)
{
    return set_owned(attrs, "data-name", ps_leaf_name(context->path, context->rows, context->row_count)) &&
        set_owned(attrs, "data-rule-name", ps_rule_name(context->path, context->rows, context->row_count)) &&
        set_owned(attrs, "data-default", ps_scalar_string(member(context->spec, "default")));
}

static bool set_affix(const widget_context *context, ps_value *model,
                      const char *kind, bool enabled)
{
    if (!enabled) return true;
    ps_chars text = context_text(context, kind);
    if (!text.bytes) return false;
    if (!text.length) { free(text.bytes); return true; }
    bool prepend = !strcmp(kind, "prepend");
    ps_value *affix = ps_object_value();
    ps_chars class_name = prepend
        ? ps_join_classes(PS_TEXT("crudui-widget__affix"),
            text_member(design_node(context, "prepend"), "class"), PS_TEXT(""))
        : ps_copy(PS_TEXT("crudui-widget__affix"));
    ps_chars style = prepend
        ? ps_style_string(text_member(design_node(context, "prepend"), "style")) : ps_copy(PS_TEXT(""));
    bool result = affix && class_name.bytes && style.bytes && set_text(affix, "text", ps_view(text)) &&
        set_text(affix, "class", ps_view(class_name)) &&
        (!style.length || set_text(affix, "style", ps_view(style))) &&
        ps_set(model, kind, affix);
    if (!result) ps_value_free(affix);
    free(text.bytes); free(class_name.bytes); free(style.bytes); return result;
}

/* ASCII case-insensitive equality of a type name and a fixed kind. */
static bool same_type(ps_text left, const char *right)
{
    size_t length = strlen(right);
    if (left.length != length) return false;
    for (size_t i = 0; i < length; ++i) {
        unsigned char a = (unsigned char)left.bytes[i];
        unsigned char b = (unsigned char)right[i];
        if (a >= 'A' && a <= 'Z') a = (unsigned char)(a - 'A' + 'a');
        if (b >= 'A' && b <= 'Z') b = (unsigned char)(b - 'A' + 'a');
        if (a != b) return false;
    }
    return true;
}

static const char *canonical_kind(ps_text name)
{
    if (same_type(name, "text") || same_type(name, "string")) return "text";
    if (same_type(name, "integer") || same_type(name, "float") ||
        same_type(name, "decimal") || same_type(name, "number")) return "number";
    if (same_type(name, "select") || same_type(name, "dropdown") ||
        same_type(name, "selectbox")) return "select";
    if (same_type(name, "choice") || same_type(name, "radio")) return "choice";
    if (same_type(name, "multichoice") || same_type(name, "checkboxes") ||
        same_type(name, "checkcontainer")) return "multichoice";
    if (same_type(name, "datetime-local") || same_type(name, "datetime")) return "datetime";
    if (same_type(name, "html") || same_type(name, "static") || same_type(name, "dummy")) return "dummy";
    if (same_type(name, "cover-simple") || same_type(name, "cover")) return "cover";
    if (same_type(name, "search") || same_type(name, "autocomplete")) return "search";
    if (same_type(name, "tinymce") || same_type(name, "wysiwyg")) return "tinymce";
    if (same_type(name, "button") || same_type(name, "action")) return "button";
    if (same_type(name, "range")) return "range";
    if (same_type(name, "condition")) return "condition";
    static const char *const direct[] = {"email","password","textarea","hidden","date",
        "dummy-input","image","file","image-viewer","summernote",
        "editorjs","tui","tagify","tagify2"};
    for (size_t i = 0; i < sizeof(direct) / sizeof(direct[0]); ++i)
        if (same_type(name, direct[i])) return direct[i];
    return NULL;
}

bool ps_widget_supported(ps_text type)
{
    return type.bytes && canonical_kind(type) != NULL;
}

bool ps_widget_select(ps_text type)
{
    const char *kind = type.bytes ? canonical_kind(type) : NULL;
    return kind && !strcmp(kind, "select");
}

bool ps_widget_choices(ps_text type)
{
    const char *kind = type.bytes ? canonical_kind(type) : NULL;
    return kind && (!strcmp(kind, "choice") || !strcmp(kind, "multichoice"));
}

static ps_value *source_model(const ps_value *items)
{
    if (!items || items->kind != PS_OBJECT || !ps_has(items, "model")) return NULL;
    ps_value *source = ps_object_value();
    const ps_value *relations_value = member(items, "relations");
    bool ok = source &&
        set_owned(source, "data-source-model", ps_scalar_string(member(items, "model"))) &&
        set_owned(source, "data-source-method", ps_scalar_string(member(items, "method"))) &&
        set_owned(source, "data-source-table", ps_scalar_string(member(items, "table"))) &&
        set_owned(source, "data-source-relations", relations_value && relations_value->kind != PS_NULL
            ? ps_json_string(relations_value) : ps_copy(PS_TEXT("[]")));
    if (!ok) { ps_value_free(source); source = NULL; }
    return source;
}

static bool extend_object(ps_value *target, const ps_value *source)
{
    if (!source) return true;
    for (size_t i = 0; i < ps_size(source); ++i)
        if (!ps_set_text(target, ps_key(source, i), ps_value_clone(ps_at(source, i)))) return false;
    return true;
}

/* Whether the candidate text equals the key; *failed is set when the candidate is missing. */
static bool same_candidate(ps_chars candidate, ps_text key, bool *failed)
{
    if (!candidate.bytes) { *failed = true; return false; }
    bool match = ps_text_equal(ps_view(candidate), key);
    free(candidate.bytes);
    return match;
}

static bool selected_value(const widget_context *context, ps_text key, bool multiple, bool *failed)
{
    const ps_value *value = context->value_present ? context->value : member(context->spec, "default");
    if (multiple && value && value->kind == PS_ARRAY) {
        for (size_t i = 0; i < ps_size(value); ++i) {
            ps_chars candidate = context->value_present ? ps_js_string(ps_at(value, i))
                                                        : ps_scalar_string(ps_at(value, i));
            if (same_candidate(candidate, key, failed)) return true;
        }
        return false;
    }
    if (multiple && !ps_truthy(value)) return false;
    return same_candidate(multiple ? ps_js_string(value) : context_value(context), key, failed);
}

/* The group of a select option: its position in the choice list and its translated label. */
static bool set_group(ps_value *option, const ps_value *item, size_t index, ps_text language)
{
    const ps_value *label_value = member(item, "label");
    ps_chars label = ps_translate(label_value, language);
    if (label.bytes && !label.length) { free(label.bytes); label = ps_scalar_string(label_value); }
    ps_value *group = ps_object_value();
    bool ok = label.bytes && group && ps_set(group, "index", ps_int_value((int64_t)index)) &&
        set_text(group, "label", ps_view(label));
    free(label.bytes);
    if (!ok) { ps_value_free(group); return false; }
    return ps_set(option, "group", group);
}

static ps_value *option_models(const widget_context *context, bool multiple, bool choice)
{
    const ps_value *items = member(context->spec, "items");
    ps_value *options = ps_array_value();
    if (!options) return NULL;
    if (!items || (items->kind != PS_ARRAY && items->kind != PS_OBJECT) ||
        (items->kind == PS_OBJECT && ps_has(items, "model"))) return options;
    const ps_value *default_value = member(context->spec, "default");
    bool has_default = default_value && default_value->kind != PS_ARRAY && default_value->kind != PS_NULL;
    ps_chars default_text = has_default ? ps_scalar_string(default_value) : (ps_chars){NULL, 0};
    if (has_default && !default_text.bytes) { ps_value_free(options); return NULL; }
    bool choices = ps_is_choice_list(items);
    /* A choice list gives its choices in written order, the choices of each group in place. */
    ps_choice_cursor cursor = {items, 0, 0};
    const ps_value *choice_item = NULL;
    size_t group = SIZE_MAX;
    for (size_t i = 0; choices ? (choice_item = ps_choice_next(&cursor, &group)) != NULL : i < ps_size(items); ++i) {
        ps_chars index = {NULL, 0};
        if (choices) index = ps_choice_value_text(choice_item);
        else if (items->kind != PS_OBJECT) index = ps_decimal(i);
        ps_text key = items->kind == PS_OBJECT ? ps_key(items, i) : ps_view(index);
        const ps_value *entry = choices ? ps_get(choice_item, "label") : ps_at(items, i);
        ps_chars label = ps_translate(entry, context->language);
        if (label.bytes && !label.length) { free(label.bytes); label = ps_scalar_string(entry); }
        bool failed = false;
        bool selected = selected_value(context, key, multiple, &failed);
        ps_value *option = ps_object_value();
        bool ok = !failed && label.bytes && option && (items->kind == PS_OBJECT || index.bytes) &&
            set_text(option, "value", key) &&
            set_text(option, "label", ps_view(label)) &&
            ps_set(option, "selected", ps_bool_value(selected)) &&
            ps_set(option, "isDefault", ps_bool_value(choice && default_text.bytes &&
                                                      ps_text_equal(ps_view(default_text), key))) &&
            (group == SIZE_MAX || set_group(option, ps_at(items, group), group, context->language)) &&
            ps_append(options, option);
        free(label.bytes); free(index.bytes);
        if (!ok) { ps_value_free(option); ps_value_free(options); free(default_text.bytes); return NULL; }
    }
    free(default_text.bytes); return options;
}

/* The one option of a select or search field with no option: value "" and the untranslated text select (CUSC-080). */
static ps_value *placeholder_option(void)
{
    ps_value *option = ps_object_value();
    if (!option || !set_string(option, "value", "") ||
        !set_string(option, "label", "select") ||
        !ps_set(option, "selected", ps_bool_value(false)) ||
        !ps_set(option, "isDefault", ps_bool_value(false))) {
        ps_value_free(option); return NULL;
    }
    return option;
}

/* A JSON string literal that is safe inside a script element: every < is <. */
static ps_chars script_quote(ps_text value)
{
    ps_chars quoted = ps_json_quote(value);
    if (!quoted.bytes) return quoted;
    ps_html_buffer out = {0};
    for (size_t i = 0; i < quoted.length; ++i) {
        if (quoted.bytes[i] == '<') ps_html_text(&out, "\\u003c");
        else ps_html_character(&out, quoted.bytes[i]);
    }
    free(quoted.bytes);
    return ps_html_take(&out);
}

static ps_value *text_control(const char *kind, const widget_context *context)
{
    bool textarea = !strcmp(kind, "textarea"), hidden = !strcmp(kind, "hidden");
    bool password = !strcmp(kind, "password"), dummy = !strcmp(kind, "dummy-input");
    bool date = !strcmp(kind, "date") || !strcmp(kind, "datetime");
    ps_value *attrs = ps_object_value();
    ps_chars name = context_name(context);
    ps_chars value = password ? ps_scalar_string(context->value_present ? context->value : NULL)
                              : context_value(context);
    if (date && value.bytes) {
        ps_chars formatted = ps_format_date(ps_view(value), !strcmp(kind, "datetime"));
        free(value.bytes); value = formatted;
    }
    ps_chars class_name = context_class(context, hidden ? "valid-target" :
        dummy ? "crudui-input" : "valid-target crudui-input");
    bool ok = attrs && name.bytes && value.bytes && class_name.bytes;
    if (ok && !textarea) ok = set_string(attrs, "type", dummy ? "text" :
        !strcmp(kind, "datetime") ? "datetime-local" : kind);
    if (ok) ok = set_text(attrs, "name", ps_view(name));
    if (ok && !textarea) ok = set_text(attrs, "value", ps_view(value));
    if (ok && !strcmp(kind, "number")) ok = set_string(attrs, "step", "any");
    if (ok && dummy) ok = set_string(attrs, "readonly", "");
    if (ok) ok = set_text(attrs, "class", ps_view(class_name));
    if (ok && textarea) ok = set_string(attrs, "rows", "5");
    if (ok && !textarea && !hidden && !password && !date)
        ok = set_nonempty(attrs, "placeholder", context_text(context, "placeholder"));
    if (ok && !hidden) ok = set_nonempty(attrs, "style", context_style(context));
    if (ok && !password && !hidden && !dummy) ok = add_behavior(context, attrs);
    if (ok && dummy) ok = set_owned(attrs, "data-default", ps_scalar_string(member(context->spec, "default")));
    else if (ok) ok = add_data(context, attrs);
    ps_value *model = ps_object_value();
    const char *layout = hidden || password || !strcmp(kind, "datetime") ? "bare" : "widget";
    if (ok) ok = model && set_string(model, "kind", kind) && set_string(model, "layout", layout) &&
        set_string(model, "tag", textarea ? "textarea" : "input") &&
        (!textarea || set_text(model, "text", ps_view(value))) && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    if (ok && !strcmp(layout, "widget"))
        ok = set_affix(context, model, "prepend", true) && set_affix(context, model, "append", true);
    free(name.bytes); free(value.bytes); free(class_name.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(model); return NULL; }
    return model;
}

/* Give the source and the options to a model they belong to; each is released only when it was set. */
static bool attach_source_options(ps_value *model, bool ok, ps_value **source, ps_value **options)
{
    if (ok) ok = ps_set(model, "source", *source ? *source : ps_null_value());
    if (ok) *source = NULL;
    if (ok) ok = ps_set(model, "options", *options);
    if (ok) *options = NULL;
    return ok;
}

static ps_value *select_control(const widget_context *context)
{
    ps_value *source = source_model(member(context->spec, "items"));
    ps_value *attrs = ps_object_value();
    ps_chars name = context_name(context);
    ps_chars class_name = context_class(context, source ? "valid-target crudui-input crudui-input--select valid-target-async" : "valid-target crudui-input crudui-input--select");
    bool ok = attrs && name.bytes && class_name.bytes && set_text(attrs, "name", ps_view(name)) &&
        set_text(attrs, "class", ps_view(class_name)) && extend_object(attrs, source) &&
        set_nonempty(attrs, "style", context_style(context)) && add_behavior(context, attrs) &&
        add_data(context, attrs);
    ps_value *options = ok ? option_models(context, false, false) : NULL;
    if (options && !ps_size(options) && !ps_append(options, placeholder_option())) ok = false;
    ps_value *model = ps_object_value();
    if (ok) ok = options && model && set_string(model, "kind", "select") &&
        set_string(model, "layout", "widget") && set_string(model, "tag", "select") &&
        ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    ok = attach_source_options(model, ok, &source, &options);
    if (ok) ok = set_affix(context, model, "prepend", true) && set_affix(context, model, "append", true);
    free(name.bytes); free(class_name.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(source); ps_value_free(options); ps_value_free(model); return NULL; }
    return model;
}

static ps_value *choices(const char *kind, const widget_context *context)
{
    bool multiple = !strcmp(kind, "multichoice");
    ps_value *source = source_model(member(context->spec, "items"));
    ps_value *attrs = ps_object_value();
    /* The choices element: its classes, then the class and style of design.group. */
    ps_chars choices_class = ps_join_classes(multiple ? PS_TEXT("crudui-choices crudui-choices--multiple")
        : PS_TEXT("crudui-choices"), text_member(design_node(context, "group"), "class"), PS_TEXT(""));
    bool ok = attrs && choices_class.bytes && set_text(attrs, "class", ps_view(choices_class)) &&
        set_nonempty(attrs, "style", ps_style_string(text_member(design_node(context, "group"), "style")));
    free(choices_class.bytes);
    if (ok) ok = extend_object(attrs, source);
    ps_value *options = ok ? option_models(context, multiple, !multiple) : NULL;
    ps_chars label_class = context_class(context, "crudui-choices__label");
    ps_value *model = ps_object_value();
    if (ok) ok = options && label_class.bytes && model && set_string(model, "kind", kind) &&
        set_string(model, "layout", "choices") && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    ok = attach_source_options(model, ok, &source, &options);
    if (ok) ok = set_text(model, "itemLabelClass", ps_view(label_class));
    if (ok && !member(model, "source")) ok = false;
    if (ok && ps_get(model, "source")->kind == PS_NULL) {
        ps_value *extra = ps_object_value(), *input = ps_object_value();
        ps_chars name = context_name(context);
        ps_chars full_name = joined(name, multiple ? PS_TEXT("[]") : PS_TEXT(""), PS_TEXT(""));
        ps_chars onchange = behavior_script(context, PS_TEXT("onchange"));
        ps_chars onclick = behavior_script(context, PS_TEXT("onclick"));
        ok = extra && input && full_name.bytes && onchange.bytes && onclick.bytes &&
            set_text(input, "name", ps_view(full_name)) &&
            set_owned(input, "data-name", ps_leaf_name(context->path, context->rows, context->row_count)) &&
            set_owned(input, "data-rule-name", ps_rule_name(context->path, context->rows, context->row_count));
        if (ok && onchange.length) ok = set_text(input, "onchange", ps_view(onchange));
        if (ok && !multiple && onclick.length) ok = set_text(input, "onclick", ps_view(onclick));
        if (ok) ok = ps_set(extra, "input", input);
        if (ok) input = NULL;
        if (ok) ok = ps_set(model, "extra", extra);
        if (ok) extra = NULL;
        free(name.bytes); free(full_name.bytes); free(onchange.bytes); free(onclick.bytes);
        ps_value_free(input); ps_value_free(extra);
    }
    free(label_class.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(source); ps_value_free(options); ps_value_free(model); return NULL; }
    return model;
}

static ps_value *file_control(const char *kind, const widget_context *context)
{
    bool cover = !strcmp(kind, "cover");
    const char *base = "valid-target crudui-input crudui-input--file";
    ps_value *file = ps_object_value();
    ps_chars class_name = context_class(context, base);
    bool ok = file && class_name.bytes && set_string(file, "type", "file") &&
        set_text(file, "class", ps_view(class_name));
    static const char *const sizes[][2] = {
        {"max_width", "data-max-width"}, {"min_width", "data-min-width"},
        {"max_height", "data-max-height"}, {"min_height", "data-min-height"},
        {"preview_max_width", "data-preview-max-width"},
        {"preview_max_height", "data-preview-max-height"},
    };
    for (size_t i = 0; ok && i < sizeof(sizes) / sizeof(sizes[0]); ++i)
        ok = set_owned(file, sizes[i][1], context_option(context, sizes[i][0], "0"));
    ps_chars name = context_name(context);
    ps_chars field_name = joined(name, cover ? PS_TEXT("[name]") : PS_TEXT(""), PS_TEXT(""));
    if (ok) ok = field_name.bytes && set_text(file, "name", ps_view(field_name)) &&
        set_owned(file, "data-name", ps_leaf_name(context->path, context->rows, context->row_count)) &&
        set_owned(file, "data-rule-name", ps_rule_name(context->path, context->rows, context->row_count)) &&
        add_behavior(context, file);
    if (ok && !cover) ok = set_string(file, "value", "");
    const ps_value *accept_value = member(member(context->spec, "validate"), "accept");
    if (!accept_value || accept_value->kind != PS_STRING || !accept_value->data.string.length)
        accept_value = member(member(context->spec, "options"), "accept");
    ps_chars accept = accept_value ? ps_scalar_string(accept_value)
        : ps_copy(!strcmp(kind, "file") ? PS_TEXT("*/*") : PS_TEXT("image/*"));
    if (ok) ok = accept.bytes && set_text(file, "accept", ps_view(accept));
    ps_value *extra = ps_object_value();
    if (ok && !cover) {
        ps_value *display = ps_object_value();
        ok = extra && display && set_string(display, "type", "text") &&
            set_string(display, "class", "crudui-input") &&
            set_string(display, "value", "") && set_string(display, "readonly", "") &&
            ps_set(extra, "display", display);
        if (!ok) ps_value_free(display);
    }
    if (ok) ok = extra && ps_set(extra, "file", file);
    if (ok) file = NULL;
    ps_value *model = ps_object_value(), *empty_attrs = ps_object_value();
    if (ok) ok = model && empty_attrs && set_string(model, "kind", kind) &&
        set_string(model, "layout", "file") && ps_set(model, "attrs", empty_attrs);
    if (ok) empty_attrs = NULL;
    if (ok) ok = set_affix(context, model, "prepend", true);
    if (ok) ok = ps_set(model, "extra", extra);
    if (ok) extra = NULL;
    free(class_name.bytes); free(name.bytes); free(field_name.bytes); free(accept.bytes);
    if (!ok) { ps_value_free(file); ps_value_free(extra); ps_value_free(empty_attrs); ps_value_free(model); return NULL; }
    return model;
}

static ps_chars display_html(const widget_context *context, const char *kind)
{
    if (!strcmp(kind, "image-viewer")) {
        if (!context->value_present || !context->value || context->value->kind != PS_ARRAY || !ps_size(context->value))
            return ps_copy(PS_TEXT("이미지가 없습니다."));
        ps_chars height = context_option(context, "height", "");
        if (!height.bytes) return height;
        ps_html_buffer out = {0};
        for (size_t i = 0; i < ps_size(context->value); ++i) {
            ps_chars source = ps_scalar_string(ps_at(context->value, i));
            if (!source.bytes) { out.failed = true; break; }
            ps_html_text(&out, "<img src=\"");
            ps_html_append(&out, ps_view(source));
            ps_html_text(&out, "\"");
            if (height.length) {
                ps_html_text(&out, " height=\"");
                ps_html_append(&out, ps_view(height));
                ps_html_text(&out, "\">");
            } else ps_html_text(&out, ">");
            free(source.bytes);
        }
        free(height.bytes);
        return ps_html_take(&out);
    }
    const ps_value *value = context->value_present ? context->value : member(context->spec, "default");
    const ps_value *items = member(context->spec, "items");
    if (ps_is_choice_list(items)) {
        ps_chars key = ps_scalar_string(value);
        if (!key.bytes) return key;
        bool failed = false;
        const ps_value *found = ps_choice_label(items, ps_view(key), &failed);
        free(key.bytes);
        if (failed) return (ps_chars){NULL, 0};
        if (found) value = found;
    } else if (items && items->kind == PS_OBJECT && !ps_has(items, "model")) {
        ps_chars key = ps_scalar_string(value);
        if (!key.bytes) return key;
        const ps_value *found = ps_get_text(items, ps_view(key));
        free(key.bytes);
        if (found) value = found;
    }
    ps_chars text = ps_scalar_string(value);
    if (!text.bytes) return text;
    ps_html_buffer out = {0};
    for (size_t i = 0; i < text.length; ++i) {
        if (text.bytes[i] == '\r' || text.bytes[i] == '\n') ps_html_text(&out, "<br />");
        ps_html_character(&out, text.bytes[i]);
    }
    free(text.bytes);
    return ps_html_take(&out);
}

static ps_value *display_control(const char *kind, const widget_context *context)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs != NULL;
    ps_text main_class = text_member(design_node(context, "main"), "class");
    if (ok && main_class.length) ok = set_text(attrs, "class", main_class);
    if (ok && strcmp(kind, "image-viewer")) ok = set_nonempty(attrs, "style", context_style(context));
    ps_chars raw = ok ? display_html(context, kind) : (ps_chars){NULL, 0};
    ps_value *model = ps_object_value();
    if (ok) ok = raw.bytes && model && set_string(model, "kind", kind) &&
        set_string(model, "layout", "display") && set_string(model, "tag", "div") &&
        set_text(model, "rawHtml", ps_view(raw)) && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    free(raw.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(model); return NULL; }
    return model;
}

static ps_value *search_control(const widget_context *context)
{
    ps_value *source = source_model(member(context->spec, "items"));
    ps_value *attrs = ps_object_value();
    ps_chars class_name = context_class(context, source ? "valid-target crudui-input crudui-input--select valid-target-async" : "valid-target crudui-input crudui-input--select");
    ps_chars name = context_name(context), minimum = context_option(context, "keyword_min_length", "2");
    ps_chars delay = context_option(context, "delay", "250"), server = context_option(context, "api_server", "");
    bool ok = attrs && class_name.bytes && name.bytes && minimum.bytes && delay.bytes && server.bytes &&
        set_text(attrs, "class", ps_view(class_name)) && set_nonempty(attrs, "style", context_style(context)) &&
        set_text(attrs, "name", ps_view(name)) && set_text(attrs, "data-keyword-min-length", ps_view(minimum)) &&
        set_text(attrs, "data-delay", ps_view(delay)) && set_text(attrs, "data-api-server", ps_view(server)) &&
        extend_object(attrs, source);
    if (ok) ok = set_owned(attrs, "data-name", ps_leaf_name(context->path, context->rows, context->row_count)) &&
        set_owned(attrs, "data-rule-name", ps_rule_name(context->path, context->rows, context->row_count)) &&
        set_text(attrs, "id", context->id);
    ps_chars onchange = behavior_script(context, PS_TEXT("onchange"));
    if (ok) ok = onchange.bytes && (!onchange.length || set_text(attrs, "onchange", ps_view(onchange)));
    if (ok) ok = set_owned(attrs, "data-default", ps_scalar_string(member(context->spec, "default")));
    ps_chars callback = context_option(context, "callback", "");
    ps_chars quoted_id = script_quote(context->id);
    ps_chars quoted_min = script_quote(ps_view(minimum));
    ps_chars quoted_delay = script_quote(ps_view(delay));
    ps_chars container = PS_CONCAT(context->id, PS_TEXT("_select2"));
    ps_chars quoted_container = container.bytes ? script_quote(ps_view(container)) : container;
    ps_html_buffer script_out = {0};
    if (!callback.bytes || !quoted_id.bytes || !quoted_min.bytes || !quoted_delay.bytes || !quoted_container.bytes)
        script_out.failed = true;
    ps_html_text(&script_out, "$(function() {select2(CSS.escape(");
    ps_html_append(&script_out, ps_view(quoted_id));
    ps_html_text(&script_out, "), ");
    ps_html_append(&script_out, ps_view(quoted_min));
    ps_html_text(&script_out, ", ");
    ps_html_append(&script_out, ps_view(quoted_delay));
    ps_html_text(&script_out, ", ");
    ps_html_append(&script_out, ps_view(quoted_container));
    ps_html_text(&script_out, ");");
    if (callback.length) {
        ps_html_text(&script_out, "$(document.getElementById(");
        ps_html_append(&script_out, ps_view(quoted_id));
        ps_html_text(&script_out, ")).on('select2:select', ");
        ps_html_append(&script_out, ps_view(callback));
        ps_html_text(&script_out, ");");
    }
    ps_html_text(&script_out, "});");
    ps_chars script = ps_html_take(&script_out);
    const ps_value *hide = member(member(context->spec, "options"), "hide_searching");
    ps_chars style = (!hide || hide->kind == PS_NULL || (hide->kind == PS_STRING && hide->data.string.length)) && quoted_container.bytes
        ? PS_CONCAT(PS_TEXT("[class~="), ps_view(quoted_container), PS_TEXT("] .loading-results { display: none; }"))
        : ps_copy(PS_TEXT(""));
    ps_value *options = ok ? option_models(context, false, false) : NULL;
    if (options && !ps_size(options) && !ps_append(options, placeholder_option())) ok = false;
    ps_value *model = ps_object_value();
    if (ok) ok = script.bytes && style.bytes && options && model && set_string(model, "kind", "search") &&
        set_string(model, "layout", "search") && set_string(model, "tag", "select") && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    ok = attach_source_options(model, ok, &source, &options);
    if (ok) ok = set_text(model, "script", ps_view(script)) && set_text(model, "styleChrome", ps_view(style)) &&
        set_affix(context, model, "prepend", true) && set_affix(context, model, "append", true);
    free(class_name.bytes); free(name.bytes); free(minimum.bytes); free(delay.bytes); free(server.bytes);
    free(onchange.bytes); free(callback.bytes); free(quoted_id.bytes); free(quoted_min.bytes);
    free(quoted_delay.bytes); free(container.bytes); free(quoted_container.bytes);
    free(script.bytes); free(style.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(source); ps_value_free(options); ps_value_free(model); return NULL; }
    return model;
}

static ps_value *editor_control(const char *kind, const widget_context *context)
{
    bool tagify = !strncmp(kind, "tagify", 6);
    const char *base = !strcmp(kind, "tinymce") ? "valid-target crudui-input tinymcearea"
        : !strcmp(kind, "summernote") ? "valid-target crudui-input summernote"
        : !strcmp(kind, "editorjs") ? "valid-target crudui-input contentjs"
        : !strcmp(kind, "tui") ? "valid-target crudui-input tuiarea" : "valid-target crudui-input";
    ps_value *attrs = ps_object_value();
    ps_chars class_name = context_class(context, base), name = context_name(context);
    bool ok = attrs && class_name.bytes && name.bytes;
    if (ok && tagify) ok = set_string(attrs, "type", "text");
    if (ok) ok = set_text(attrs, "id", context->id) && set_text(attrs, "class", ps_view(class_name)) &&
        set_text(attrs, "name", ps_view(name));
    if (ok && tagify) ok = set_owned(attrs, "value", context_value(context));
    else if (ok) ok = set_owned(attrs, "rows", context_option(context, "rows", !strcmp(kind, "summernote") ? "5" : "3"));
    ps_chars quoted_id = script_quote(context->id);
    if (!quoted_id.bytes) ok = false;
    /* The selector expression of the editor host. */
    ps_text selector_parts[] = {PS_TEXT("'#'+CSS.escape("), ps_view(quoted_id), PS_TEXT(")")};
    ps_html_buffer script = {0};
    if (ok) {
        ps_html_text(&script, "$(function() {editor_");
        ps_html_text(&script, kind);
        ps_html_character(&script, '(');
        for (size_t i = 0; i < 3; ++i) ps_html_append(&script, selector_parts[i]);
        ps_html_text(&script, ", ");
    }
    if (ok && !strcmp(kind, "tinymce")) {
        ps_chars height = context_option(context, "height", "300"), upload = context_option(context, "fileserver", "upload");
        ps_chars quoted_upload = upload.bytes ? script_quote(ps_view(upload)) : upload;
        ok = height.bytes && upload.bytes && quoted_upload.bytes &&
            set_text(attrs, "data-type", text_member(context->spec, "type")) &&
            set_text(attrs, "data-height", ps_view(height)) && set_text(attrs, "data-upload-server", ps_view(upload));
        ps_html_append(&script, ps_view(height));
        ps_html_text(&script, ", ");
        ps_html_append(&script, ps_view(quoted_upload));
        ps_html_text(&script, ", false);});");
        free(height.bytes); free(upload.bytes); free(quoted_upload.bytes);
    } else if (ok && !strcmp(kind, "summernote")) {
        ps_chars upload = context_option(context, "upload", "upload");
        ps_chars quoted = upload.bytes ? script_quote(ps_view(upload)) : upload;
        ok = quoted.bytes != NULL;
        ps_html_append(&script, ps_view(quoted));
        ps_html_text(&script, ");});");
        free(upload.bytes); free(quoted.bytes);
    } else if (ok && (!strcmp(kind, "editorjs") || !strcmp(kind, "tui"))) {
        ps_chars server = context_option(context, "fileserver", "");
        ps_chars quoted = server.bytes ? script_quote(ps_view(server)) : server;
        ok = server.bytes && quoted.bytes && set_text(attrs, "data-fileserver", ps_view(server));
        ps_html_append(&script, ps_view(quoted));
        ps_html_text(&script, ");});");
        free(server.bytes); free(quoted.bytes);
    } else if (ok) {
        ps_chars maximum = context_option(context, "max_tags", "0");
        ok = maximum.bytes && set_text(attrs, "data-max-tags", ps_view(maximum));
        ps_chars server = {NULL, 0}, quoted_server = {NULL, 0};
        bool second = !strcmp(kind, "tagify2");
        if (ok && second) {
            server = context_option(context, "server", "");
            quoted_server = server.bytes ? script_quote(ps_view(server)) : server;
            ok = server.bytes && quoted_server.bytes && set_text(attrs, "data-server", ps_view(server));
        }
        if (ok) ok = set_nonempty(attrs, "placeholder", context_text(context, "placeholder"));
        ps_html_append(&script, ps_view(maximum));
        if (second) {
            ps_html_text(&script, ", ");
            ps_html_append(&script, ps_view(quoted_server));
        }
        ps_html_text(&script, ");});");
        free(maximum.bytes); free(server.bytes); free(quoted_server.bytes);
    }
    ps_chars script_text = ps_html_take(&script);
    if (ok) ok = script_text.bytes && add_behavior(context, attrs) && add_data(context, attrs);
    ps_value *model = ps_object_value();
    if (ok) ok = model && set_string(model, "kind", kind) && set_string(model, "layout", "host-script") &&
        set_string(model, "tag", tagify ? "input" : "textarea") &&
        (tagify || set_owned(model, "text", context_value(context))) && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    if (ok) ok = set_text(model, "script", ps_view(script_text));
    free(class_name.bytes); free(name.bytes); free(quoted_id.bytes); free(script_text.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(model); return NULL; }
    return model;
}

/* A range input with the bounds and the step of its required validate.range and validate.step;
   compilation has checked them. The output shows the value. */
static ps_value *range_control(const widget_context *context)
{
    const ps_value *validate = member(context->spec, "validate");
    const ps_value *bounds = member(validate, "range");
    ps_chars name = context_name(context), value = context_value(context);
    ps_chars class_name = context_class(context, "valid-target crudui-input crudui-input--range");
    ps_chars minimum = bounds && bounds->kind == PS_ARRAY && ps_size(bounds) == 2
        ? ps_scalar_string(ps_at(bounds, 0)) : (ps_chars){NULL, 0};
    ps_chars maximum = minimum.bytes ? ps_scalar_string(ps_at(bounds, 1)) : (ps_chars){NULL, 0};
    ps_chars step = maximum.bytes ? ps_scalar_string(member(validate, "step")) : (ps_chars){NULL, 0};
    ps_value *attrs = ps_object_value();
    bool ok = attrs && name.bytes && value.bytes && class_name.bytes && step.bytes &&
        set_string(attrs, "type", "range") && set_text(attrs, "name", ps_view(name)) &&
        set_text(attrs, "value", ps_view(value)) && set_text(attrs, "min", ps_view(minimum)) &&
        set_text(attrs, "max", ps_view(maximum)) && set_text(attrs, "step", ps_view(step)) &&
        set_text(attrs, "class", ps_view(class_name)) &&
        set_nonempty(attrs, "style", context_style(context)) &&
        add_behavior(context, attrs) && add_data(context, attrs);
    ps_value *model = ps_object_value();
    if (ok) ok = model && set_string(model, "kind", "range") && set_string(model, "layout", "range") &&
        set_string(model, "tag", "input") && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    if (ok) ok = set_text(model, "text", ps_view(value)) &&
        set_affix(context, model, "prepend", true) && set_affix(context, model, "append", true);
    free(name.bytes); free(value.bytes); free(class_name.bytes);
    free(minimum.bytes); free(maximum.bytes); free(step.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(model); return NULL; }
    return model;
}

/* The JSON.stringify text of a JSON value: members in order, no whitespace, ECMAScript numbers. */
static bool append_condition_json(ps_html_buffer *out, const ps_value *value)
{
    if (!value || value->kind == PS_NULL) return ps_html_text(out, "null");
    if (value->kind == PS_BOOL) return ps_html_text(out, value->data.boolean ? "true" : "false");
    if (value->kind == PS_INT || value->kind == PS_FLOAT) {
        ps_chars text = ps_number_text(value->kind == PS_INT ? (double)value->data.integer : value->data.number);
        bool ok = text.bytes && ps_html_append(out, ps_view(text));
        free(text.bytes);
        return ok;
    }
    if (value->kind == PS_STRING) {
        ps_chars quoted = ps_json_quote(ps_string(value));
        bool ok = quoted.bytes && ps_html_append(out, ps_view(quoted));
        free(quoted.bytes);
        return ok;
    }
    bool object = value->kind == PS_OBJECT;
    if (!object && value->kind != PS_ARRAY) return false;
    if (!ps_html_character(out, object ? '{' : '[')) return false;
    for (size_t i = 0; i < ps_size(value); ++i) {
        if (i && !ps_html_character(out, ',')) return false;
        if (object) {
            ps_chars key = ps_json_quote(ps_key(value, i));
            bool ok = key.bytes && ps_html_append(out, ps_view(key)) && ps_html_character(out, ':');
            free(key.bytes);
            if (!ok) return false;
        }
        if (!append_condition_json(out, ps_at(value, i))) return false;
    }
    return ps_html_character(out, object ? '}' : ']');
}

/* The condition text of a condition field value (docs/spec/form-markup.md, Condition fields): a
   string is itself, null and an absent value are empty, and any other value is its JSON text. */
static ps_chars condition_text(const ps_value *value)
{
    if (!value || value->kind == PS_NULL) return ps_copy(PS_TEXT(""));
    if (value->kind == PS_STRING) return ps_copy(ps_string(value));
    ps_html_buffer out = {0};
    if (!append_condition_json(&out, value)) out.failed = true;
    return ps_html_take(&out);
}

/* The comparison operators that the structured editor offers, in their order (CUSC-073, CUSC-085). */
const char *const ps_condition_ops[8] = {"eq", "ne", "lt", "le", "gt", "ge", "in", "has"};

/* A new object with the kind and path of an editor node, or NULL on allocation failure. */
static ps_value *condition_node_start(const char *kind, ps_text path)
{
    ps_value *node = ps_object_value();
    if (node && set_string(node, "kind", kind) && ps_set(node, "path", ps_text_value(path))) return node;
    ps_value_free(node);
    return NULL;
}

/*
 * The editor node of a condition at path and depth (docs/spec/schema.md, CUSC-086), or NULL when the
 * editor does not show it; an allocation failure sets *failed.
 */
static ps_value *condition_node(const ps_value *value, ps_text path, size_t depth, bool judge, bool *failed)
{
    if (depth > 32 || !value || value->kind != PS_OBJECT) return NULL;
    size_t count = ps_size(value);
    ps_text key = ps_key(value, 0);
    if (count == 1 && (ps_text_is(key, "all") || ps_text_is(key, "any"))) {
        const ps_value *list = ps_at(value, 0);
        if (!list || list->kind != PS_ARRAY) return NULL;
        ps_value *items = ps_array_value();
        if (!items) { *failed = true; return NULL; }
        for (size_t i = 0; i < ps_size(list); ++i) {
            ps_chars index = ps_decimal(i);
            ps_chars child_path = index.bytes ? PS_CONCAT(path, PS_TEXT("/"), key, PS_TEXT("/"), ps_view(index)) : (ps_chars){NULL, 0};
            free(index.bytes);
            if (!child_path.bytes) { *failed = true; ps_value_free(items); return NULL; }
            ps_value *child = condition_node(ps_at(list, i), ps_view(child_path), depth + 1, judge, failed);
            free(child_path.bytes);
            if (!child) { ps_value_free(items); return NULL; }
            if (!ps_append(items, child)) { *failed = true; ps_value_free(items); return NULL; }
        }
        ps_value *node = condition_node_start("group", path);
        if (node && ps_set(node, "mode", ps_text_value(key)) && set_owned_value(node, "items", &items)) return node;
        ps_value_free(items); ps_value_free(node); *failed = true;
        return NULL;
    }
    if (count == 1 && ps_text_is(key, "judge")) {
        const ps_value *text = ps_at(value, 0);
        if (!judge || !text || text->kind != PS_STRING) return NULL;
        ps_value *node = condition_node_start("judge", path);
        if (node && ps_set(node, "text", ps_text_value(ps_string(text)))) return node;
        ps_value_free(node); *failed = true;
        return NULL;
    }
    const ps_value *field = ps_get(value, "field"), *op = ps_get(value, "op"), *operand = ps_get(value, "value");
    if (count != 3 || !field || !op || !operand || field->kind != PS_STRING || op->kind != PS_STRING) return NULL;
    bool known = false;
    for (size_t i = 0; i < 8; ++i) known = known || ps_text_is(ps_string(op), ps_condition_ops[i]);
    if (!known) return NULL;
    bool valid = ps_condition_scalar(operand);
    if (ps_text_is(ps_string(op), "in")) {
        valid = operand->kind == PS_ARRAY;
        for (size_t i = 0; valid && i < ps_size(operand); ++i) valid = ps_condition_scalar(ps_at(operand, i));
    }
    if (!valid) return NULL;
    ps_chars text = condition_text(operand);
    ps_value *node = text.bytes ? condition_node_start("comparison", path) : NULL;
    bool ok = node && ps_set(node, "field", ps_text_value(ps_string(field))) &&
        ps_set(node, "op", ps_text_value(ps_string(op))) && ps_set(node, "value", ps_text_value(ps_view(text)));
    free(text.bytes);
    if (ok) return node;
    ps_value_free(node); *failed = true;
    return NULL;
}

/* The text of a message with its first {path} replaced by path. */
static ps_chars message_with_path(const char *message, ps_text path)
{
    ps_text text = ps_fixed(message);
    size_t at = ps_text_find(text, PS_TEXT("{path}"), 0);
    if (at == SIZE_MAX) return ps_copy(text);
    return PS_CONCAT(ps_text_slice(text, 0, at), path, ps_text_slice(text, at + 6, text.length));
}

/*
 * The editor model of a structured condition field (docs/spec/form-markup.md, Structured condition editor):
 * its root node when the editor shows the value (CUMK-067), an empty value being an empty all group, and
 * otherwise the error text of the field (CUMK-068). NULL on allocation failure.
 */
static ps_value *condition_editor(const widget_context *context, const ps_value *value)
{
    const ps_form_messages *messages = ps_form_messages_for(context->language);
    if (!messages) return NULL;
    bool judge = ps_is_string(member(member(context->spec, "validate"), "conditionTree"), "judge");
    bool failed = false;
    ps_value *root = NULL;
    if (ps_empty_value(value)) {
        root = condition_node_start("group", PS_TEXT(""));
        ps_value *items = ps_array_value();
        if (!root || !set_string(root, "mode", "all") || !set_owned_value(root, "items", &items)) {
            ps_value_free(items); ps_value_free(root); return NULL;
        }
    } else {
        root = condition_node(value, PS_TEXT(""), 1, judge, &failed);
        if (failed) return NULL;
    }
    ps_value *editor = ps_object_value();
    if (!editor || !ps_set(editor, "for", ps_text_value(context->id))) { ps_value_free(root); ps_value_free(editor); return NULL; }
    if (!root) {
        if (set_owned(editor, "error", message_with_path(messages->condition_invalid, context->path))) return editor;
        ps_value_free(editor); return NULL;
    }
    const ps_value *fields = member(member(context->spec, "options"), "fields");
    ps_value *labels = ps_object_value();
    bool ok = labels && set_string(labels, "mode", messages->condition_mode) &&
        set_string(labels, "addComparison", messages->condition_add_comparison) &&
        set_string(labels, "addGroup", messages->condition_add_group) &&
        set_string(labels, "addJudge", messages->condition_add_judge) &&
        set_string(labels, "remove", messages->condition_remove) &&
        ps_set(editor, "judge", ps_bool_value(judge)) &&
        ps_set(editor, "fields", fields && fields->kind == PS_ARRAY ? ps_value_clone(fields) : ps_null_value()) &&
        set_owned_value(editor, "labels", &labels) && set_owned_value(editor, "root", &root);
    ps_value_free(labels); ps_value_free(root);
    if (ok) return editor;
    ps_value_free(editor);
    return NULL;
}

/* A condition field: a textarea holding the condition text of its tree, marked for the browser
   bindings that decode it (docs/spec/form-markup.md, Condition fields). */
static ps_value *condition_control(const widget_context *context)
{
    const ps_value *fallback = member(context->spec, "default");
    ps_chars name = context_name(context);
    ps_chars text = condition_text(context->value_present ? context->value : fallback);
    ps_chars class_name = context_class(context, "valid-target crudui-input crudui-input--condition");
    ps_value *attrs = ps_object_value();
    bool ok = attrs && name.bytes && text.bytes && class_name.bytes &&
        set_text(attrs, "name", ps_view(name)) && set_text(attrs, "class", ps_view(class_name)) &&
        set_string(attrs, "rows", "5") && set_string(attrs, "data-crudui-value", "json") &&
        set_nonempty(attrs, "style", context_style(context)) &&
        add_behavior(context, attrs) && add_data(context, attrs) &&
        set_owned(attrs, "data-default", condition_text(fallback));
    /* A structured editor: the textarea keeps the value, hidden while the editor shows it (CUMK-067), visible
       with a named error otherwise (CUMK-068). */
    bool structured = ps_is_string(member(member(context->spec, "design"), "editor"), "structured");
    ps_value *editor = ok && structured ? condition_editor(context, context->value_present ? context->value : fallback) : NULL;
    if (structured && !editor) ok = false;
    if (ok && editor && !ps_has(editor, "error")) ok = set_string(attrs, "hidden", "");
    ps_value *model = ps_object_value();
    if (ok) ok = model && set_string(model, "kind", "condition") && set_string(model, "layout", structured ? "condition" : "widget") &&
        set_string(model, "tag", "textarea") && set_text(model, "text", ps_view(text)) &&
        set_owned_value(model, "attrs", &attrs);
    if (ok) ok = set_affix(context, model, "prepend", true) && set_affix(context, model, "append", true);
    if (ok && editor) ok = set_owned_value(model, "condition", &editor);
    ps_value_free(editor);
    free(name.bytes); free(text.bytes); free(class_name.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(model); return NULL; }
    return model;
}

/* A button field: one button element with its content; it submits no value. */
static ps_value *button_control(const widget_context *context)
{
    ps_chars text = ps_has(context->spec, "content") ? context_text(context, "content") : ps_copy(PS_TEXT(""));
    ps_chars class_name = context_class(context, "crudui-action crudui-action--text");
    ps_value *attrs = ps_object_value();
    bool ok = text.bytes && class_name.bytes && attrs &&
        set_string(attrs, "type", "button") && set_text(attrs, "class", ps_view(class_name)) &&
        set_nonempty(attrs, "style", context_style(context)) &&
        set_text(attrs, "id", context->id) && add_behavior(context, attrs);
    ps_value *model = ps_object_value();
    if (ok) ok = model && set_string(model, "kind", "button") && set_string(model, "layout", "button") &&
        set_string(model, "tag", "button") && ps_set(model, "attrs", attrs);
    if (ok) attrs = NULL;
    if (ok) ok = set_text(model, "text", ps_view(text));
    free(text.bytes); free(class_name.bytes);
    if (!ok) { ps_value_free(attrs); ps_value_free(model); return NULL; }
    return model;
}

/* Widget model members in output order. */
static const char *const widget_members[] = {
    "kind", "layout", "tag", "attrs", "text", "rawHtml", "source", "options", "itemLabelClass",
    "script", "styleChrome", "prepend", "append", "extra", "condition",
};

/* Reorder the widget's members in place to the output order; unlisted members keep their order after. */
static ps_value *ordered_widget(ps_value *model)
{
    if (!model || model->kind != PS_OBJECT) return model;
    ps_member *items = model->data.children.items;
    size_t length = model->data.children.length, placed = 0;
    for (size_t name = 0; name < sizeof(widget_members) / sizeof(*widget_members); ++name) {
        for (size_t i = placed; i < length; ++i) {
            if (!ps_text_is((ps_text){items[i].key, items[i].key_length}, widget_members[name])) continue;
            ps_member found = items[i];
            memmove(&items[placed + 1], &items[placed], (i - placed) * sizeof(*items));
            items[placed++] = found;
            break;
        }
    }
    ps_value_reindex(model);
    return model;
}

const ps_value *ps_declared_attributes(const ps_value *spec, bool wrapper)
{
    const ps_value *design = member(spec, "design");
    const ps_value *attributes = member(wrapper ? member(design, "wrapper") : design, "attributes");
    return attributes && attributes->kind == PS_OBJECT && ps_size(attributes) ? attributes : NULL;
}

bool ps_append_attributes(ps_value *object, const ps_value *attributes)
{
    for (size_t i = 0; attributes && i < ps_size(attributes); ++i)
        if (!ps_set_text(object, ps_key(attributes, i), ps_value_clone(ps_at(attributes, i)))) return false;
    return true;
}

/* The appearance of the choice at index of a checked choice list after the option id: the label
   class and style and the input attributes, each only when declared. */
static bool set_appearance(ps_value *option, const ps_value *items, size_t index)
{
    if (!ps_is_choice_list(items)) return true;
    const ps_value *choice = ps_at(items, index);
    ps_text class_name = text_member(choice, "class");
    const ps_value *attributes = member(choice, "attributes");
    return (!class_name.length || set_text(option, "className", class_name)) &&
        set_nonempty(option, "style", ps_style_string(text_member(choice, "style"))) &&
        (!attributes || attributes->kind != PS_OBJECT || !ps_size(attributes) ||
         ps_set(option, "attributes", ps_value_clone(attributes)));
}

/* Add the declared control attributes after the attributes crudui writes on the control: attrs,
   extra.file of a file layout, or extra.option of a choices layout with option inputs. */
static bool append_declared(ps_value *model, const ps_value *spec)
{
    const ps_value *attributes = ps_declared_attributes(spec, false);
    if (!attributes) return true;
    ps_value *extra = ps_get_mut(model, "extra");
    if (ps_is_string(member(model, "layout"), "choices")) {
        if (!member(extra, "input")) return true;
        ps_value *option = ps_value_clone(attributes);
        return option && ps_set(extra, "option", option);
    }
    ps_value *file = ps_get_mut(extra, "file");
    return ps_append_attributes(file ? file : ps_get_mut(model, "attrs"), attributes);
}

ps_value *ps_widget(const ps_value *spec, const ps_value *value, bool value_present,
                    ps_text path, const ps_value *design, ps_text key_prefix,
                    ps_text id_prefix, ps_text language,
                    const size_t *row_segments, size_t row_count)
{
    const char *kind = canonical_kind(text_member(spec, "type"));
    if (!kind) return NULL;
    ps_chars id = ps_control_id(id_prefix, path);
    if (!id.bytes) return NULL;
    widget_context context = {spec, value, value_present, path, design, key_prefix, ps_view(id),
                              language, row_segments, row_count};
    ps_value *model;
    if (!strcmp(kind, "select")) model = select_control(&context);
    else if (!strcmp(kind, "choice") || !strcmp(kind, "multichoice")) model = choices(kind, &context);
    else if (!strcmp(kind, "image") || !strcmp(kind, "file") || !strcmp(kind, "cover")) model = file_control(kind, &context);
    else if (!strcmp(kind, "dummy") || !strcmp(kind, "image-viewer")) model = display_control(kind, &context);
    else if (!strcmp(kind, "search")) model = search_control(&context);
    else if (!strcmp(kind, "tinymce") || !strcmp(kind, "summernote") ||
             !strcmp(kind, "editorjs") || !strcmp(kind, "tui") ||
             !strcmp(kind, "tagify") || !strcmp(kind, "tagify2")) model = editor_control(kind, &context);
    else if (!strcmp(kind, "button")) model = button_control(&context);
    else if (!strcmp(kind, "range")) model = range_control(&context);
    else if (!strcmp(kind, "condition")) model = condition_control(&context);
    else model = text_control(kind, &context);
    if (model) {
        ps_text tag = text_member(model, "tag");
        if ((ps_text_is(tag, "input") || ps_text_is(tag, "select") || ps_text_is(tag, "textarea")) &&
            !set_text(ps_get_mut(model, "attrs"), "id", ps_view(id))) { ps_value_free(model); model = NULL; }
        ps_value *file = ps_get_mut(ps_get_mut(model, "extra"), "file");
        if (model && file && !set_text(file, "id", ps_view(id))) { ps_value_free(model); model = NULL; }
        if (model && ps_is_string(member(model, "layout"), "choices")) {
            ps_value *options = ps_get_mut(model, "options");
            for (size_t i = 0; options && i < ps_size(options); ++i) {
                ps_chars index = ps_decimal(i);
                ps_chars option_id = index.bytes
                    ? PS_CONCAT(ps_view(id), PS_TEXT(":"), ps_view(index)) : index;
                bool ok = option_id.bytes && set_text((ps_value *)ps_at(options, i), "id", ps_view(option_id)) &&
                    set_appearance((ps_value *)ps_at(options, i), member(spec, "items"), i);
                free(index.bytes); free(option_id.bytes);
                if (!ok) { ps_value_free(model); model = NULL; break; }
            }
        }
        if (model && !append_declared(model, spec)) { ps_value_free(model); model = NULL; }
    }
    free(id.bytes); return ordered_widget(model);
}
