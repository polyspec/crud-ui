#include "engine_internal.h"

#include <stdlib.h>
#include <string.h>

/* Set an INVALID_FORM_INPUT error with the message; returns false. */
static bool invalid(ps_value **error, ps_chars message)
{
    *error = message.bytes
        ? ps_error_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL) : NULL;
    free(message.bytes);
    return false;
}

bool ps_declaration_error(ps_text key, ps_text path, const char *expected, ps_value **error)
{
    return invalid(error, PS_CONCAT(PS_TEXT("Invalid "), key, PS_TEXT(" at "), path,
                                    PS_TEXT(": expected "), ps_fixed(expected)));
}

bool ps_known_keys(const ps_value *bucket, const char *name, const char *const *allowed,
                   size_t count, ps_text path, ps_value **error)
{
    for (size_t i = 0; i < ps_size(bucket); ++i) {
        ps_text key = ps_key(bucket, i);
        bool known = false;
        for (size_t j = 0; !known && j < count; ++j) known = ps_text_is(key, allowed[j]);
        if (!known)
            return invalid(error, PS_CONCAT(PS_TEXT("Invalid "), ps_fixed(name), PS_TEXT("."), key,
                                            PS_TEXT(" at "), path, PS_TEXT(": unknown key")));
    }
    return true;
}

/* A string, or a condition map: a non-empty object. */
static bool condition_value(const ps_value *value)
{
    return value->kind == PS_STRING || (value->kind == PS_OBJECT && ps_size(value) > 0);
}

/* Attribute names crudui writes on a control or a node root. */
static const char *const owned_attribute_names[] = {
    "data-field-path", "data-lang", "data-name", "data-rule-name", "data-default", "data-is-default",
    "data-type", "data-height", "data-upload-server", "data-fileserver", "data-server", "data-max-tags",
    "data-keyword-min-length", "data-delay", "data-api-server", "data-max-width", "data-min-width",
    "data-max-height", "data-min-height", "data-preview-max-width", "data-preview-max-height",
    "data-unsupported-type",
};
/* Prefixes of attribute names crudui writes on a control or a node root. */
static const char *const owned_attribute_prefixes[] = {"data-crudui-", "data-source-"};

/* A data-* or aria-* name crudui does not write: lowercase letters, digits, "-", "_" and "." after
   the prefix, starting with a letter or a digit. */
static bool declared_attribute_name(ps_text name)
{
    if (!ps_text_starts(name, "data-") && !ps_text_starts(name, "aria-")) return false;
    if (name.length == 5) return false;
    for (size_t i = 5; i < name.length; ++i) {
        char c = name.bytes[i];
        bool alphanumeric = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
        if (!alphanumeric && (i == 5 || (c != '-' && c != '_' && c != '.'))) return false;
    }
    for (size_t i = 0; i < sizeof owned_attribute_names / sizeof *owned_attribute_names; ++i)
        if (ps_text_is(name, owned_attribute_names[i])) return false;
    for (size_t i = 0; i < sizeof owned_attribute_prefixes / sizeof *owned_attribute_prefixes; ++i)
        if (ps_text_starts(name, owned_attribute_prefixes[i])) return false;
    return true;
}

/* Reject declared attributes at key that are not an object of permitted names to strings; every
   name is checked before any value. */
bool ps_declared_attributes_valid(const ps_value *attributes, const char *key, ps_text path, ps_value **error)
{
    if (attributes->kind != PS_OBJECT) return ps_declaration_error(ps_fixed(key), path, "an object", error);
    for (size_t i = 0; i < ps_size(attributes); ++i) {
        ps_text name = ps_key(attributes, i);
        if (!declared_attribute_name(name))
            return invalid(error, PS_CONCAT(PS_TEXT("Invalid "), ps_fixed(key), PS_TEXT("."), name, PS_TEXT(" at "), path,
                                            PS_TEXT(": expected a data-* or aria-* name that crudui does not write")));
    }
    for (size_t i = 0; i < ps_size(attributes); ++i) {
        if (ps_at(attributes, i)->kind != PS_STRING)
            return invalid(error, PS_CONCAT(PS_TEXT("Invalid "), ps_fixed(key), PS_TEXT("."), ps_key(attributes, i),
                                            PS_TEXT(" at "), path, PS_TEXT(": expected a string")));
    }
    return true;
}

bool ps_design_declaration_valid(const ps_value *design, ps_text path, bool field, size_t layouts, bool condition,
                                 ps_value **error)
{
    static const char *const design_keys[] = {"show", "class", "style", "label", "wrapper", "group", "prepend"};
    static const char *const field_design_keys[] = {"show", "class", "style", "attributes", "label", "wrapper", "group", "prepend"};
    static const char *const group_design_keys[] = {"show", "class", "style", "attributes", "layout", "label", "wrapper", "group", "prepend"};
    /* A condition field also declares its editor (docs/spec/schema.md, Structured condition editor). */
    static const char *const condition_design_keys[] = {"show", "class", "style", "attributes", "editor", "label", "wrapper", "group", "prepend"};
    static const char *const layout_names[] = {"stacked", "inline", "line"};
    static const char *const node_keys[] = {"class", "style"};
    static const char *const field_wrapper_keys[] = {"class", "style", "attributes"};
    static const char *const styles[][2] = {{"class", "design.class"}, {"style", "design.style"}};
    static const char *const nodes[][5] = {
        {"label", "design.label", "design.label.class", "design.label.style", "design.label.attributes"},
        {"wrapper", "design.wrapper", "design.wrapper.class", "design.wrapper.style", "design.wrapper.attributes"},
        {"group", "design.group", "design.group.class", "design.group.style", "design.group.attributes"},
        {"prepend", "design.prepend", "design.prepend.class", "design.prepend.style", "design.prepend.attributes"},
    };
    if (design->kind != PS_BOOL && design->kind != PS_OBJECT)
        return ps_declaration_error(PS_TEXT("design"), path, "a boolean or an object", error);
    if (design->kind != PS_OBJECT) return true;
    if (!(layouts ? ps_known_keys(design, "design", group_design_keys, 9, path, error)
          : condition ? ps_known_keys(design, "design", condition_design_keys, 9, path, error)
          : field ? ps_known_keys(design, "design", field_design_keys, 8, path, error)
                  : ps_known_keys(design, "design", design_keys, 7, path, error)))
        return false;
    const ps_value *show = ps_get(design, "show");
    if (show && show->kind != PS_BOOL && !condition_value(show))
        return ps_declaration_error(PS_TEXT("design.show"), path, "an expression, a boolean or a condition map", error);
    for (size_t i = 0; i < 2; ++i) {
        const ps_value *value = ps_get(design, styles[i][0]);
        if (value && !condition_value(value))
            return ps_declaration_error(ps_fixed(styles[i][1]), path, "a string or a condition map", error);
    }
    const ps_value *attributes = ps_get(design, "attributes");
    if (attributes && !ps_declared_attributes_valid(attributes, "design.attributes", path, error)) return false;
    const ps_value *layout = layouts ? ps_get(design, "layout") : NULL;
    bool known_layout = false;
    for (size_t i = 0; layout && i < layouts; ++i) known_layout = known_layout || ps_is_string(layout, layout_names[i]);
    if (layout && !known_layout)
        return ps_declaration_error(PS_TEXT("design.layout"), path,
                                    layouts == 3 ? "stacked, inline or line" : "stacked or inline", error);
    for (size_t i = 0; i < 4; ++i) {
        const ps_value *node = ps_get(design, nodes[i][0]);
        if (!node) continue;
        if (node->kind != PS_OBJECT)
            return ps_declaration_error(ps_fixed(nodes[i][1]), path, "an object", error);
        bool wrapper = field && i == 1;
        if (!(wrapper ? ps_known_keys(node, nodes[i][1], field_wrapper_keys, 3, path, error)
                      : ps_known_keys(node, nodes[i][1], node_keys, 2, path, error)))
            return false;
        for (size_t j = 0; j < 2; ++j) {
            const ps_value *value = ps_get(node, styles[j][0]);
            if (value && !condition_value(value))
                return ps_declaration_error(ps_fixed(nodes[i][2 + j]), path, "a string or a condition map", error);
        }
        const ps_value *node_attributes = ps_get(node, "attributes");
        if (node_attributes && !ps_declared_attributes_valid(node_attributes, nodes[i][4], path, error)) return false;
    }
    return true;
}
