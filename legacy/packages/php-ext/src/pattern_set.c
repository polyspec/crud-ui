#include "engine_internal.h"

#include <stdlib.h>
#include <string.h>

/*
 * Code-point sets for the pattern matcher: sorted lists of disjoint inclusive ranges built when a
 * pattern compiles, and lookups into the embedded Unicode data.
 */

#define CODE_POINT_MAXIMUM 0x10ffff

bool ps_code_ranges_contain(const ps_code_range *ranges, size_t count, uint32_t code_point)
{
    size_t low = 0, high = count;
    while (low < high) {
        size_t middle = low + (high - low) / 2;
        if (code_point < ranges[middle].start) high = middle;
        else if (code_point > ranges[middle].end) low = middle + 1;
        else return true;
    }
    return false;
}

static const ps_unicode_property *find_property(const ps_unicode_property *table, size_t count, ps_text name)
{
    size_t low = 0, high = count;
    while (low < high) {
        size_t middle = low + (high - low) / 2;
        int order = ps_text_compare(name, ps_fixed(table[middle].name));
        if (order < 0) high = middle;
        else if (order > 0) low = middle + 1;
        else return &table[middle];
    }
    return NULL;
}

const ps_unicode_property *ps_unicode_category(ps_text name)
{
    return find_property(ps_general_categories, ps_general_categories_count, name);
}

const ps_unicode_property *ps_unicode_script(ps_text name)
{
    return find_property(ps_scripts, ps_scripts_count, name);
}

bool ps_code_set_add(ps_code_set *set, uint32_t start, uint32_t end)
{
    if (set->failed) return false;
    if (set->count == set->capacity) {
        size_t capacity = set->capacity ? set->capacity * 2 : 8;
        ps_code_range *ranges = realloc(set->ranges, capacity * sizeof(*ranges));
        if (!ranges) { set->failed = true; return false; }
        set->ranges = ranges;
        set->capacity = capacity;
    }
    set->ranges[set->count++] = (ps_code_range){start, end};
    return true;
}

bool ps_code_set_add_ranges(ps_code_set *set, const ps_code_range *ranges, size_t count)
{
    for (size_t i = 0; i < count; ++i)
        if (!ps_code_set_add(set, ranges[i].start, ranges[i].end)) return false;
    return true;
}

static int compare_ranges(const void *left, const void *right)
{
    const ps_code_range *a = left, *b = right;
    return a->start < b->start ? -1 : a->start > b->start ? 1 : 0;
}

bool ps_code_set_normalize(ps_code_set *set)
{
    if (set->failed) return false;
    if (set->count > 1) qsort(set->ranges, set->count, sizeof(*set->ranges), compare_ranges);
    size_t used = 0;
    for (size_t i = 0; i < set->count; ++i) {
        ps_code_range range = set->ranges[i];
        if (used && range.start <= set->ranges[used - 1].end + 1) {
            if (range.end > set->ranges[used - 1].end) set->ranges[used - 1].end = range.end;
        } else {
            set->ranges[used++] = range;
        }
    }
    set->count = used;
    return true;
}

bool ps_code_set_complement(ps_code_set *set)
{
    if (!ps_code_set_normalize(set)) return false;
    ps_code_set result = {0};
    uint32_t next = 0;
    bool open = true;
    for (size_t i = 0; i < set->count; ++i) {
        if (set->ranges[i].start > next) ps_code_set_add(&result, next, set->ranges[i].start - 1);
        if (set->ranges[i].end == CODE_POINT_MAXIMUM) { open = false; break; }
        next = set->ranges[i].end + 1;
    }
    if (open) ps_code_set_add(&result, next, CODE_POINT_MAXIMUM);
    if (result.failed) {
        ps_code_set_free(&result);
        set->failed = true;
        return false;
    }
    ps_code_set_free(set);
    *set = result;
    return true;
}

void ps_code_set_free(ps_code_set *set)
{
    free(set->ranges);
    *set = (ps_code_set){0};
}
