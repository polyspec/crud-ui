#include "engine_internal.h"

#include <stdlib.h>

/* Declaration rules of composed list and detail specifications (docs/spec/display-formats.md). */

static const char *const list_keys[] = {"columns", "search", "sort", "pagination", "actions", "empty", "description", "design"};
static const char *const detail_keys[] = {"fields", "actions", "design"};
static const char *const column_keys[] = {"field", "label", "format", "design", "sortable"};
static const char *const field_keys[] = {"field", "label", "format", "design"};
static const char *const sort_keys[] = {"field", "dir"};
static const char *const script_action_keys[] = {"label", "script"};
static const char *const action_keys[] = {"label", "format", "behavior", "design"};
static const char *const behavior_keys[] = {"onchange", "onclick", "onload"};
static const char *const format_strings[] = {"type", "pattern", "target", "as"};
static const char *const format_content[] = {"prefix", "suffix", "text", "true", "false", "alt"};
static const char *const content = "a string, a language map or null";

#define COUNT(array) (sizeof(array) / sizeof((array)[0]))

static bool listed(ps_text key, const char *const *allowed, size_t count)
{
    for (size_t i = 0; i < count; ++i) if (ps_text_is(key, allowed[i])) return true;
    return false;
}

/* A string, a language map (a non-empty object of strings or null) or null. */
static bool is_content(const ps_value *value)
{
    if (value->kind == PS_NULL || value->kind == PS_STRING) return true;
    if (value->kind != PS_OBJECT || !ps_size(value)) return false;
    for (size_t i = 0; i < ps_size(value); ++i) {
        const ps_value *entry = ps_at(value, i);
        if (entry->kind != PS_NULL && entry->kind != PS_STRING) return false;
    }
    return true;
}

/* A condition map: an object with at least one member. */
static bool is_condition_map(const ps_value *value)
{
    return value->kind == PS_OBJECT && ps_size(value) > 0;
}

/* Fail with "Invalid <prefix><key> at <path>: unknown key"; *error is NULL on allocation failure. */
static bool unknown_key(ps_text prefix, ps_text key, ps_text path, ps_value **error)
{
    ps_chars message = PS_CONCAT(PS_TEXT("Invalid "), prefix, key, PS_TEXT(" at "), path, PS_TEXT(": unknown key"));
    *error = message.bytes
        ? ps_error_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL) : NULL;
    free(message.bytes);
    return false;
}

/* Fail with "Invalid <prefix><name> at <path>: expected <expected>". */
static bool expected_at(ps_text prefix, ps_text name, ps_text path, const char *expected, ps_value **error)
{
    ps_chars key = PS_CONCAT(prefix, name);
    if (!key.bytes) { *error = NULL; return false; }
    ps_declaration_error(ps_view(key), path, expected, error);
    free(key.bytes);
    return false;
}

/* Reject the first member of object, in member order, that allowed does not list. */
static bool closed(const ps_value *object, ps_text prefix, const char *const *allowed, size_t count,
                   ps_text path, ps_value **error)
{
    for (size_t i = 0; i < ps_size(object); ++i)
        if (!listed(ps_key(object, i), allowed, count)) return unknown_key(prefix, ps_key(object, i), path, error);
    return true;
}

/* A cell format declaration at path. */
static bool format_valid(const ps_value *format, ps_text path, ps_value **error)
{
    if (format->kind == PS_BOOL || format->kind == PS_STRING) return true;
    if (format->kind != PS_OBJECT)
        return ps_declaration_error(PS_TEXT("format"), path, "a boolean, a string or an object", error);
    for (size_t i = 0; i < ps_size(format); ++i) {
        ps_text key = ps_key(format, i);
        const ps_value *value = ps_at(format, i);
        if (listed(key, format_strings, COUNT(format_strings))) {
            if (value->kind != PS_STRING) return expected_at(PS_TEXT("format."), key, path, "a string", error);
        } else if (listed(key, format_content, COUNT(format_content))) {
            if (!is_content(value)) return expected_at(PS_TEXT("format."), key, path, content, error);
        } else if (ps_text_is(key, "map")) {
            if (value->kind != PS_OBJECT) return ps_declaration_error(PS_TEXT("format.map"), path, "an object", error);
            for (size_t j = 0; j < ps_size(value); ++j)
                if (!is_content(ps_at(value, j)))
                    return expected_at(PS_TEXT("format.map."), ps_key(value, j), path, content, error);
        } else if (ps_text_is(key, "href")) {
            if (value->kind != PS_STRING && !is_condition_map(value))
                return ps_declaration_error(PS_TEXT("format.href"), path, "a string or a condition map", error);
        } else if (ps_text_is(key, "items")) {
            if (value->kind != PS_ARRAY && value->kind != PS_OBJECT)
                return ps_declaration_error(PS_TEXT("format.items"), path, "an array or an object", error);
            if (ps_is_choice_list(value)) {
                int valid = ps_choice_list_valid(value, false, false);
                if (valid < 0) return false;
                if (!valid)
                    return ps_declaration_error(PS_TEXT("format.items"), path,
                                                "value and label pairs with distinct string or number values", error);
            }
        }
    }
    return true;
}

/* One column or field declaration at <members>.<name>. */
static bool member_valid(ps_text name, const ps_value *member, bool list, const char *members, ps_value **error)
{
    if (member->kind != PS_OBJECT) return ps_declaration_error(name, ps_fixed(members), "an object", error);
    ps_chars owned = PS_CONCAT(ps_fixed(members), PS_TEXT("."), name);
    if (!owned.bytes) { *error = NULL; return false; }
    ps_text path = ps_view(owned);
    const ps_value *field = ps_get(member, "field"), *label = ps_get(member, "label");
    const ps_value *format = ps_get(member, "format"), *design = ps_get(member, "design");
    const ps_value *sortable = ps_get(member, "sortable");
    bool valid = list ? closed(member, PS_TEXT(""), column_keys, COUNT(column_keys), path, error)
                      : closed(member, PS_TEXT(""), field_keys, COUNT(field_keys), path, error);
    if (valid && field && field->kind != PS_STRING)
        valid = ps_declaration_error(PS_TEXT("field"), path, "a string", error);
    if (valid && label && !is_content(label))
        valid = ps_declaration_error(PS_TEXT("label"), path, content, error);
    if (valid && format) valid = format_valid(format, path, error);
    if (valid && design) valid = ps_design_declaration_valid(design, path, false, 0, false, error);
    if (valid && sortable && sortable->kind != PS_BOOL && sortable->kind != PS_STRING && !is_condition_map(sortable))
        valid = ps_declaration_error(PS_TEXT("sortable"), path, "a boolean, an expression or a condition map", error);
    free(owned.bytes);
    return valid;
}

/* One behavior entry of an action at path. */
static bool behavior_entry_valid(ps_text event, const ps_value *entry, ps_text path, ps_value **error)
{
    if (entry->kind == PS_STRING) return true;
    ps_chars owned = PS_CONCAT(PS_TEXT("behavior."), event);
    if (!owned.bytes) { *error = NULL; return false; }
    ps_text key = ps_view(owned);
    bool valid;
    if (entry->kind != PS_OBJECT) {
        valid = ps_declaration_error(key, path, "a script or an object", error);
    } else {
        ps_chars prefix = PS_CONCAT(key, PS_TEXT("."));
        const ps_value *label = ps_get(entry, "label"), *script = ps_get(entry, "script");
        valid = prefix.bytes && closed(entry, ps_view(prefix), script_action_keys, COUNT(script_action_keys), path, error);
        if (!prefix.bytes) *error = NULL;
        if (valid && label && !is_content(label))
            valid = expected_at(ps_view(prefix), PS_TEXT("label"), path, content, error);
        if (valid && script && script->kind != PS_STRING)
            valid = expected_at(ps_view(prefix), PS_TEXT("script"), path, "a string", error);
        free(prefix.bytes);
    }
    free(owned.bytes);
    return valid;
}

/* The members of an action object at path, after its unknown keys. */
static bool action_members_valid(const ps_value *action, ps_text path, ps_value **error)
{
    const ps_value *label = ps_get(action, "label"), *format = ps_get(action, "format");
    const ps_value *behavior = ps_get(action, "behavior"), *design = ps_get(action, "design");
    if (label && !is_content(label)) return ps_declaration_error(PS_TEXT("label"), path, content, error);
    if (format && !format_valid(format, path, error)) return false;
    if (behavior && behavior->kind != PS_BOOL && behavior->kind != PS_OBJECT)
        return ps_declaration_error(PS_TEXT("behavior"), path, "a boolean or an object", error);
    if (behavior && behavior->kind == PS_OBJECT) {
        if (!closed(behavior, PS_TEXT("behavior."), behavior_keys, COUNT(behavior_keys), path, error)) return false;
        for (size_t i = 0; i < ps_size(behavior); ++i)
            if (!behavior_entry_valid(ps_key(behavior, i), ps_at(behavior, i), path, error)) return false;
    }
    return !design || ps_design_declaration_valid(design, path, false, 0, false, error);
}

/* One list or detail action at actions.<name>. */
static bool action_valid(ps_text name, const ps_value *action, ps_value **error)
{
    if (action->kind == PS_STRING) return true;
    if (action->kind != PS_OBJECT) return ps_declaration_error(name, PS_TEXT("actions"), "a script or an object", error);
    ps_chars owned = PS_CONCAT(PS_TEXT("actions."), name);
    if (!owned.bytes) { *error = NULL; return false; }
    ps_text path = ps_view(owned);
    const ps_value *script = ps_get(action, "script"), *label = ps_get(action, "label");
    bool valid;
    if (script) {
        valid = closed(action, PS_TEXT(""), script_action_keys, COUNT(script_action_keys), path, error);
        if (valid && label && !is_content(label)) valid = ps_declaration_error(PS_TEXT("label"), path, content, error);
        if (valid && script->kind != PS_STRING) valid = ps_declaration_error(PS_TEXT("script"), path, "a string", error);
    } else {
        valid = closed(action, PS_TEXT(""), action_keys, COUNT(action_keys), path, error) &&
            action_members_valid(action, path, error);
    }
    free(owned.bytes);
    return valid;
}

/* The actions of a list or detail at own, each action in member order. */
static bool actions_valid(const ps_value *actions, ps_text own, ps_value **error)
{
    if (actions->kind != PS_OBJECT) return ps_declaration_error(PS_TEXT("actions"), own, "an object", error);
    for (size_t i = 0; i < ps_size(actions); ++i) {
        ps_text name = ps_key(actions, i);
        /* Actions are not composed: a composition key is not an action name. */
        if (ps_text_is(name, "$ref") || ps_text_is(name, "$patch"))
            return unknown_key(PS_TEXT(""), name, PS_TEXT("actions"), error);
        if (!action_valid(name, ps_at(actions, i), error)) return false;
    }
    return true;
}

/* The list members after the columns: search, sort, actions, empty, description and pagination. */
static bool list_members_valid(const ps_value *spec, ps_value **error)
{
    const ps_text own = PS_TEXT("list");
    const ps_value *search = ps_get(spec, "search"), *sort = ps_get(spec, "sort");
    const ps_value *actions = ps_get(spec, "actions"), *empty = ps_get(spec, "empty");
    const ps_value *pagination = ps_get(spec, "pagination");
    if (search && search->kind != PS_BOOL && search->kind != PS_OBJECT)
        return ps_declaration_error(PS_TEXT("search"), own, "a boolean or an object", error);
    if (sort) {
        if (sort->kind != PS_OBJECT) return ps_declaration_error(PS_TEXT("sort"), own, "an object", error);
        if (!closed(sort, PS_TEXT("sort."), sort_keys, COUNT(sort_keys), own, error)) return false;
        const ps_value *field = ps_get(sort, "field"), *dir = ps_get(sort, "dir");
        if (field && field->kind != PS_STRING)
            return ps_declaration_error(PS_TEXT("sort.field"), own, "a string", error);
        if (dir && !ps_is_string(dir, "asc") && !ps_is_string(dir, "desc"))
            return ps_declaration_error(PS_TEXT("sort.dir"), own, "asc or desc", error);
    }
    if (actions && !actions_valid(actions, own, error)) return false;
    if (empty && !is_content(empty)) return ps_declaration_error(PS_TEXT("empty"), own, content, error);
    const ps_value *description = ps_get(spec, "description");
    if (description && !is_content(description)) return ps_declaration_error(PS_TEXT("description"), own, content, error);
    return !pagination || ps_pagination_declaration_valid(pagination, own, error);
}

bool ps_display_declarations_valid(const ps_value *spec, const char *own, const char *members, ps_value **error)
{
    bool list = strcmp(own, "list") == 0;
    ps_text own_text = ps_fixed(own);
    for (size_t i = 0; i < ps_size(spec); ++i) {
        ps_text key = ps_key(spec, i);
        if (ps_text_is(key, "$ref") || ps_text_is(key, "$patch"))
            return ps_declaration_error(key, own_text,
                                        list ? "composition inside columns" : "composition inside fields", error);
        if (list ? !listed(key, list_keys, COUNT(list_keys)) : !listed(key, detail_keys, COUNT(detail_keys)))
            return unknown_key(PS_TEXT(""), key, own_text, error);
    }
    const ps_value *design = ps_get(spec, "design");
    if (design && !ps_design_declaration_valid(design, own_text, false, 0, false, error)) return false;
    const ps_value *declared = ps_get(spec, members);
    for (size_t i = 0; i < ps_size(declared); ++i)
        if (!member_valid(ps_key(declared, i), ps_at(declared, i), list, members, error)) return false;
    if (list) return list_members_valid(spec, error);
    const ps_value *actions = ps_get(spec, "actions");
    return !actions || actions_valid(actions, own_text, error);
}
