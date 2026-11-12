#include "engine_internal.h"

#include <stdlib.h>
#include <string.h>

/*
 * Membership (docs/spec/validation-rules.md, "Values"): members come from a list (each element as
 * is), a choice list (the value of each element), a comma-separated string (each item trimmed) or
 * a map (its keys). A value matches a member
 * when their canonical texts are the same code points, or when both are numeric (numbers, or
 * strings that are numeric text) with equal values.
 */

/* A value or member as the comparison sees it. */
typedef struct {
    ps_text text;
    bool numeric;
    double number;
} member_text;

/* Describe a text as a member: numeric when it is numeric text with a finite value. */
static bool string_member(ps_text text, member_text *member)
{
    *member = (member_text){text, false, 0};
    member->numeric = ps_numeric_text(text, &member->number);
    return true;
}

static bool same_member(const member_text *left, const member_text *right)
{
    return ps_text_equal(left->text, right->text) ||
        (left->numeric && right->numeric && left->number == right->number);
}

static bool scalar_member(const ps_value *value)
{
    return value && (value->kind == PS_STRING || value->kind == PS_INT ||
                     value->kind == PS_FLOAT || value->kind == PS_BOOL);
}

/*
 * Visit every member of a valid parameter in order. The visitor returns 1 to stop with a match,
 * 0 to continue and -1 to stop with a failure. The canonical text of a number or boolean member
 * lives only for the call.
 */
typedef int (*member_visitor)(void *context, const member_text *member);

static int visit_members(const ps_value *parameter, void *context, member_visitor visit)
{
    if (parameter->kind == PS_STRING) {
        ps_text list = ps_string(parameter);
        size_t start = 0;
        for (;;) {
            size_t comma = ps_text_find_byte(list, ',', start);
            size_t end = comma == SIZE_MAX ? list.length : comma;
            member_text member;
            if (!string_member(ps_trim(ps_text_slice(list, start, end)), &member)) return -1;
            int result = visit(context, &member);
            if (result) return result;
            if (comma == SIZE_MAX) return 0;
            start = comma + 1;
        }
    }
    bool choices = ps_is_choice_list(parameter);
    /* A choice list contributes the value of each choice, inside groups included. */
    ps_choice_cursor cursor = {parameter, 0, 0};
    const ps_value *choice = NULL;
    for (size_t i = 0; choices ? (choice = ps_choice_next(&cursor, NULL)) != NULL : i < ps_size(parameter); ++i) {
        member_text member;
        if (parameter->kind == PS_OBJECT) {
            if (!string_member(ps_key(parameter, i), &member)) return -1;
            int result = visit(context, &member);
            if (result) return result;
            continue;
        }
        const ps_value *item = choices ? ps_get(choice, "value") : ps_at(parameter, i);
        if (item->kind == PS_STRING) {
            if (!string_member(ps_string(item), &member)) return -1;
            int result = visit(context, &member);
            if (result) return result;
            continue;
        }
        ps_chars text;
        if (ps_canonical_text(item, &text) <= 0) return -1;
        member = (member_text){ps_view(text), false, 0};
        if (item->kind != PS_BOOL) member.numeric = ps_numeric_value(item, &member.number);
        int result = visit(context, &member);
        free(text.bytes);
        if (result) return result;
    }
    return 0;
}

static int nonempty_member(void *context, const member_text *member)
{
    (void)context;
    return ps_trim(member->text).length ? 0 : 2;
}

ps_parameter_problem ps_in_parameter(const ps_value *parameter)
{
    static const ps_parameter_problem shape = {.code = "INVALID_RULE_PARAMETER", .message =
        "Invalid in parameter: expected a list, a comma-separated string or a map"};
    static const ps_parameter_problem types = {.code = "INVALID_RULE_PARAMETER", .message =
        "Invalid in parameter: members must be strings, numbers or booleans"};
    static const ps_parameter_problem empty = {.code = "INVALID_RULE_PARAMETER", .message =
        "Invalid in parameter: members must not be empty"};
    static const ps_parameter_problem pairs = {.code = "INVALID_RULE_PARAMETER", .message =
        "Invalid in parameter: expected value and label pairs with distinct string or number values"};
    static const ps_parameter_problem failed = {.code = "INTERNAL_ERROR", .message = "Validation failed"};
    if (!parameter || (parameter->kind != PS_ARRAY && parameter->kind != PS_OBJECT && parameter->kind != PS_STRING))
        return shape;
    /* A choice list is checked by the choice list rules before its values are checked as members. */
    if (ps_is_choice_list(parameter)) {
        int valid = ps_choice_list_valid(parameter, false, true);
        if (valid < 0) return failed;
        if (!valid) return pairs;
    } else if (parameter->kind == PS_ARRAY) {
        /* Each list element is checked in order: its type, then its text. */
        for (size_t i = 0; i < ps_size(parameter); ++i) {
            const ps_value *item = ps_at(parameter, i);
            if (!scalar_member(item)) return types;
            if (item->kind != PS_STRING) continue;
            if (!ps_trim(ps_string(item)).length) return empty;
        }
        return (ps_parameter_problem){0};
    }
    int result = visit_members(parameter, NULL, nonempty_member);
    if (result < 0) return failed;
    return result ? empty : (ps_parameter_problem){0};
}

typedef struct {
    member_text value;
} match_context;

static int matching_member(void *context, const member_text *member)
{
    return same_member(&((match_context *)context)->value, member) ? 1 : 0;
}

int ps_in_passes(const ps_value *value, const ps_value *parameter)
{
    if (ps_empty_value(value)) return 1;
    /* Every element passes: an empty element as an empty value does, an array or object never. */
    if (value->kind == PS_ARRAY) {
        for (size_t i = 0; i < ps_size(value); ++i) {
            const ps_value *element = ps_at(value, i);
            if (ps_empty_value(element)) continue;
            if (!scalar_member(element)) return 0;
            int result = ps_in_passes(element, parameter);
            if (result <= 0) return result;
        }
        return 1;
    }
    if (!scalar_member(value)) return 0;
    match_context context;
    ps_chars owned = {NULL, 0};
    if (value->kind == PS_STRING) {
        if (!string_member(ps_trim(ps_string(value)), &context.value)) return -1;
    } else {
        if (ps_canonical_text(value, &owned) <= 0) return -1;
        context.value = (member_text){ps_view(owned), false, 0};
        if (value->kind != PS_BOOL) context.value.numeric = ps_numeric_value(value, &context.value.number);
    }
    int result = visit_members(parameter, &context, matching_member);
    free(owned.bytes);
    return result;
}
