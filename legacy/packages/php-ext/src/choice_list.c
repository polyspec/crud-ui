#include "engine_internal.h"

#include <math.h>
#include <stdint.h>
#include <stdlib.h>

/*
 * Choice lists (docs/spec/schema.md, "Choice lists", "Choice appearance" and "Choice groups"): an
 * items array of value and label pairs whose choices keep the list order for any values. The
 * choice list of a select field may hold groups, each a label and a list of choices.
 */

/* A group: an object element that has a choices member. */
static bool is_group(const ps_value *item)
{
    return item->kind == PS_OBJECT && ps_has(item, "choices");
}

bool ps_is_choice_list(const ps_value *items)
{
    if (!items || items->kind != PS_ARRAY) return false;
    for (size_t i = 0; i < ps_size(items); ++i) {
        const ps_value *item = ps_at(items, i);
        if (item->kind == PS_OBJECT && (ps_has(item, "value") || ps_has(item, "choices"))) return true;
    }
    return false;
}

const ps_value *ps_choice_next(ps_choice_cursor *cursor, size_t *group)
{
    while (cursor->item < ps_size(cursor->items)) {
        const ps_value *item = ps_at(cursor->items, cursor->item);
        if (!is_group(item)) {
            cursor->item++;
            if (group) *group = SIZE_MAX;
            return item;
        }
        const ps_value *choices = ps_get(item, "choices");
        if (choices->kind == PS_ARRAY && cursor->inner < ps_size(choices)) {
            if (group) *group = cursor->item;
            return ps_at(choices, cursor->inner++);
        }
        cursor->item++;
        cursor->inner = 0;
    }
    return NULL;
}

/* Whether a choice has value, label and no other member than the appearance members it may declare. */
static bool choice_members(const ps_value *item, bool appearance)
{
    static const char *const members[] = {"value", "label", "class", "style", "attributes"};
    if (item->kind != PS_OBJECT || !ps_has(item, "value") || !ps_has(item, "label")) return false;
    for (size_t i = 0; i < ps_size(item); ++i) {
        bool known = false;
        for (size_t j = 0; !known && j < (appearance ? 5 : 2); ++j) known = ps_text_is(ps_key(item, i), members[j]);
        if (!known) return false;
    }
    const ps_value *value = ps_get(item, "value");
    return value->kind == PS_STRING || value->kind == PS_INT ||
        (value->kind == PS_FLOAT && isfinite(value->data.number));
}

/* Whether a group has exactly label and a non-empty list of choices without appearance members. */
static bool group_members(const ps_value *item)
{
    const ps_value *choices = ps_get(item, "choices");
    if (ps_size(item) != 2 || !ps_has(item, "label") || choices->kind != PS_ARRAY || !ps_size(choices))
        return false;
    for (size_t i = 0; i < ps_size(choices); ++i)
        if (!choice_members(ps_at(choices, i), false)) return false;
    return true;
}

static ps_chars value_text(const ps_value *choice)
{
    ps_chars text = {NULL, 0};
    if (ps_canonical_text(ps_get(choice, "value"), &text) <= 0) return (ps_chars){NULL, 0};
    return text;
}

int ps_choice_list_valid(const ps_value *items, bool appearance, bool groups)
{
    for (size_t i = 0; i < ps_size(items); ++i) {
        const ps_value *item = ps_at(items, i);
        if (groups && is_group(item) ? !group_members(item) : !choice_members(item, appearance)) return 0;
    }
    ps_choice_cursor outer = {items, 0, 0};
    for (const ps_value *choice; (choice = ps_choice_next(&outer, NULL));) {
        ps_chars left = value_text(choice);
        if (!left.bytes) return -1;
        ps_choice_cursor inner = {items, 0, 0};
        for (const ps_value *earlier; (earlier = ps_choice_next(&inner, NULL)) != choice;) {
            ps_chars right = value_text(earlier);
            if (!right.bytes) { free(left.bytes); return -1; }
            bool same = ps_text_equal(ps_view(left), ps_view(right));
            free(right.bytes);
            if (same) { free(left.bytes); return 0; }
        }
        free(left.bytes);
    }
    return 1;
}

ps_chars ps_choice_value_text(const ps_value *choice)
{
    return value_text(choice);
}

const ps_value *ps_choice_label(const ps_value *items, ps_text key, bool *failed)
{
    *failed = false;
    ps_choice_cursor cursor = {items, 0, 0};
    for (const ps_value *choice; (choice = ps_choice_next(&cursor, NULL));) {
        ps_chars text = value_text(choice);
        if (!text.bytes) { *failed = true; return NULL; }
        bool same = ps_text_equal(ps_view(text), key);
        free(text.bytes);
        if (same) return ps_get(choice, "label");
    }
    return NULL;
}
