#include "engine_internal.h"

#include <stdlib.h>
#include <string.h>

static ps_chars empty_string(void)
{
    return ps_copy(PS_TEXT(""));
}

/* Only a design.show that resolves to false hides a field; *failed reports an allocation failure. */
static bool show_value(const ps_value *value, const ps_value *data,
                       const ps_text *path, const bool *row_keys, size_t path_length, bool *failed)
{
    return ps_shown(value, data, path, row_keys, path_length, failed);
}

static bool ternary_text(ps_text value)
{
    size_t question = ps_text_find_byte(value, '?', 0);
    return question != SIZE_MAX && ps_text_find_byte(value, ':', question + 1) != SIZE_MAX;
}

static ps_chars appearance(const ps_value *value, const ps_value *data,
                           const ps_text *path, const bool *row_keys, size_t path_length)
{
    if (!value || value->kind == PS_NULL) return empty_string();
    if (value->kind == PS_OBJECT) {
        ps_value *selected = ps_condition_value(value, data, path, row_keys, path_length);
        if (!selected) return (ps_chars){NULL, 0};
        ps_chars result = selected->kind == PS_NULL ? empty_string() : ps_js_string(selected);
        ps_value_free(selected); return result;
    }
    if (value->kind == PS_STRING) {
        ps_text text = ps_string(value);
        if (ternary_text(text)) {
            bool parsed = false;
            ps_value *selected = ps_expression_value(text, data, path, row_keys, path_length, &parsed);
            if (parsed) {
                ps_chars result = !selected || selected->kind == PS_NULL
                    ? empty_string() : ps_js_string(selected);
                ps_value_free(selected); return result;
            }
            ps_value_free(selected);
        }
        if (ps_condition_expression(text) && !ternary_text(text)) {
            bool parsed = false;
            ps_value *selected = ps_expression_value(text, data, path, row_keys, path_length, &parsed);
            /* A string that does not parse completely is literal text. */
            if (!parsed) { ps_value_free(selected); return ps_copy(text); }
            if (!selected || selected->kind == PS_NULL ||
                (selected->kind == PS_BOOL && !selected->data.boolean)) {
                ps_value_free(selected); return empty_string();
            }
            ps_chars result = ps_js_string(selected);
            ps_value_free(selected); return result;
        }
        return ps_copy(text);
    }
    return ps_js_string(value);
}

static ps_value *design_node(const ps_value *value, const ps_value *data,
                             const ps_text *path, const bool *row_keys, size_t path_length)
{
    const ps_value *object = value && value->kind == PS_OBJECT ? value : NULL;
    ps_chars class_name = appearance(object ? ps_get(object, "class") : NULL,
                                     data, path, row_keys, path_length);
    ps_chars style = appearance(object ? ps_get(object, "style") : NULL,
                                data, path, row_keys, path_length);
    ps_value *node = ps_object_value();
    if (!class_name.bytes || !style.bytes || !node ||
        !ps_set(node, "class", ps_text_value(ps_view(class_name))) ||
        !ps_set(node, "style", ps_text_value(ps_view(style)))) {
        ps_value_free(node); node = NULL;
    }
    free(class_name.bytes); free(style.bytes); return node;
}

ps_value *ps_design(const ps_value *design, const ps_value *data, ps_text path,
                    const size_t *rows, size_t row_count)
{
    const ps_value *object = design && design->kind == PS_OBJECT ? design : NULL;
    size_t path_length = 0;
    ps_text *path_parts = NULL;
    if (!ps_path_parts(path, &path_parts, &path_length)) return NULL;
    bool *row_keys = calloc(path_length ? path_length : 1, sizeof(*row_keys));
    if (!row_keys) { free(path_parts); return NULL; }
    for (size_t i = 0; i < row_count; ++i) if (rows[i] < path_length) row_keys[rows[i]] = true;
    ps_value *result = ps_object_value();
    ps_value *main = design_node(object, data, path_parts, row_keys, path_length);
    ps_value *label = design_node(object ? ps_get(object, "label") : NULL, data,
                                  path_parts, row_keys, path_length);
    ps_value *wrapper = design_node(object ? ps_get(object, "wrapper") : NULL, data,
                                    path_parts, row_keys, path_length);
    ps_value *group = design_node(object ? ps_get(object, "group") : NULL, data,
                                  path_parts, row_keys, path_length);
    ps_value *prepend = design_node(object ? ps_get(object, "prepend") : NULL, data,
                                    path_parts, row_keys, path_length);
    bool failed = false;
    ps_value *show = ps_bool_value(show_value(object ? ps_get(object, "show") : NULL,
                                              data, path_parts, row_keys, path_length, &failed));
    bool ok = !failed && result && main && label && wrapper && group && prepend && show;
    if (ok) ok = set_owned_value(result, "show", &show);
    if (ok) ok = set_owned_value(result, "main", &main);
    if (ok) ok = set_owned_value(result, "label", &label);
    if (ok) ok = set_owned_value(result, "wrapper", &wrapper);
    if (ok) ok = set_owned_value(result, "group", &group);
    if (ok) ok = set_owned_value(result, "prepend", &prepend);
    if (!ok) {
        ps_value_free(result);
        ps_value_free(show); ps_value_free(main); ps_value_free(label);
        ps_value_free(wrapper); ps_value_free(group); ps_value_free(prepend);
        result = NULL;
    }
    free(path_parts); free(row_keys); return result;
}
