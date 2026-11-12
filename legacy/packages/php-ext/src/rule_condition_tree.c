#include "engine_internal.h"

#include <math.h>

/*
 * The conditionTree rule (docs/spec/schema.md, "Condition trees"): a value passes when it is a
 * group {all: [...]} or {any: [...]}, a field comparison {field, op, value} or, under the parameter
 * judge, a judged text {judge}, at most 32 levels deep. The check reads no level below the limit.
 */

/* The deepest level of a condition tree; the root condition is level 1 (CUSC-075). */
#define CONDITION_TREE_DEPTH 32

bool ps_condition_tree_parameter(const ps_value *parameter)
{
    return parameter && ((parameter->kind == PS_BOOL && parameter->data.boolean) ||
                         ps_is_string(parameter, "judge"));
}

/* A string, a finite number or a boolean. */
bool ps_condition_scalar(const ps_value *value)
{
    return value && (value->kind == PS_STRING || value->kind == PS_BOOL || value->kind == PS_INT ||
                     (value->kind == PS_FLOAT && isfinite(value->data.number)));
}

/* A string that is not empty after trimming. */
static bool condition_text(const ps_value *value)
{
    return value && value->kind == PS_STRING && ps_trim(ps_string(value)).length > 0;
}

/* Whether the object node has exactly the members names. */
static bool condition_members(const ps_value *node, const char *const *names, size_t count)
{
    if (ps_size(node) != count) return false;
    for (size_t i = 0; i < count; ++i)
        if (!ps_has(node, names[i])) return false;
    return true;
}

static bool condition_operator(const ps_value *op)
{
    static const char *const operators[] = {"eq", "ne", "lt", "le", "gt", "ge", "in", "has"};
    for (size_t i = 0; i < sizeof(operators) / sizeof(operators[0]); ++i)
        if (ps_is_string(op, operators[i])) return true;
    return false;
}

static bool condition_node(const ps_value *node, bool judge, size_t level)
{
    if (level > CONDITION_TREE_DEPTH || !node || node->kind != PS_OBJECT) return false;
    static const char *const all[] = {"all"}, *const any[] = {"any"}, *const judged[] = {"judge"};
    static const char *const comparison[] = {"field", "op", "value"};
    const char *group = condition_members(node, all, 1) ? "all" : condition_members(node, any, 1) ? "any" : NULL;
    if (group) {
        const ps_value *list = ps_get(node, group);
        if (list->kind != PS_ARRAY) return false;
        for (size_t i = 0; i < ps_size(list); ++i)
            if (!condition_node(ps_at(list, i), judge, level + 1)) return false;
        return true;
    }
    if (condition_members(node, comparison, 3)) {
        const ps_value *op = ps_get(node, "op"), *value = ps_get(node, "value");
        if (!condition_text(ps_get(node, "field")) || !condition_operator(op)) return false;
        if (!ps_is_string(op, "in")) return ps_condition_scalar(value);
        if (value->kind != PS_ARRAY) return false;
        for (size_t i = 0; i < ps_size(value); ++i)
            if (!ps_condition_scalar(ps_at(value, i))) return false;
        return true;
    }
    return condition_members(node, judged, 1) && judge && condition_text(ps_get(node, "judge"));
}

bool ps_condition_tree_passes(const ps_value *value, const ps_value *parameter)
{
    return condition_node(value, ps_is_string(parameter, "judge"), 1);
}
