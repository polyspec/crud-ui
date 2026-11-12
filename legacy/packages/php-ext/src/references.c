#include "engine_internal.h"

#include <math.h>
#include <stdint.h>

/*
 * References (docs/spec/validation-rules.md, "References"). A reference parameter is the
 * declaration path of a field: its property names from the root joined with '.', without row
 * keys. The ids of the path are the values of that field in the data, read in every row of every
 * repeated field on the path, and a value passes when it is a member of them as for in.
 */

/* The segment of path that starts at start, and in *next the start of the following one or SIZE_MAX. */
static ps_text segment(ps_text path, size_t start, size_t *next)
{
    size_t dot = ps_text_find_byte(path, '.', start);
    *next = dot == SIZE_MAX ? SIZE_MAX : dot + 1;
    return ps_text_slice(path, start, dot == SIZE_MAX ? path.length : dot);
}

bool ps_reference_target(const ps_value *properties, ps_text path)
{
    const ps_value *fields = properties, *field = NULL;
    for (size_t start = 0; start != SIZE_MAX;) {
        ps_text name = segment(path, start, &start);
        const ps_value *next = fields && fields->kind == PS_OBJECT ? ps_get_text(fields, name) : NULL;
        if (!next || next->kind != PS_OBJECT) return false;
        field = next;
        fields = ps_is_string(ps_get(next, "type"), "group") ? ps_get(next, "properties") : NULL;
    }
    if (!field || ps_is_string(ps_get(field, "type"), "group")) return false;
    const ps_value *lang = ps_get(field, "lang");
    return !lang || lang->kind == PS_NULL || (lang->kind == PS_BOOL && !lang->data.boolean);
}

/* Whether a value is an id: a string, a finite number or a boolean whose canonical text is not empty after trimming. */
static bool id_value(const ps_value *value)
{
    switch (value->kind) {
    case PS_BOOL: case PS_INT: return true;
    case PS_FLOAT: return isfinite(value->data.number);
    case PS_STRING: return ps_trim(ps_string(value)).length > 0;
    default: return false;
    }
}

static bool collect(const ps_value *fields, const ps_value *value, ps_text path, size_t start, ps_value *ids);

/* Add the ids of one value of the field at the segment that starts at start; false on allocation failure. */
static bool collect_value(const ps_value *field, const ps_value *value, ps_text path, size_t next, ps_value *ids)
{
    if (next != SIZE_MAX) return collect(ps_get(field, "properties"), value, path, next, ids);
    return !id_value(value) || ps_append(ids, ps_value_clone(value));
}

/* Add the ids of the path from the segment that starts at start; false on allocation failure. */
static bool collect(const ps_value *fields, const ps_value *value, ps_text path, size_t start, ps_value *ids)
{
    if (!fields || fields->kind != PS_OBJECT || !value || value->kind != PS_OBJECT) return true;
    size_t next;
    ps_text name = segment(path, start, &next);
    const ps_value *field = ps_get_text(fields, name), *item = ps_get_text(value, name);
    if (!field || field->kind != PS_OBJECT || !item) return true;
    if (!ps_repeated_field(field)) return collect_value(field, item, path, next, ids);
    if (item->kind != PS_OBJECT) return true;
    for (size_t i = 0; i < ps_size(item); ++i)
        if (!collect_value(field, ps_at(item, i), path, next, ids)) return false;
    return true;
}

ps_value *ps_reference_ids(const ps_value *properties, const ps_value *data, ps_text path)
{
    ps_value *ids = ps_array_value();
    if (ids && !collect(properties, data, path, 0, ids)) { ps_value_free(ids); return NULL; }
    return ids;
}
