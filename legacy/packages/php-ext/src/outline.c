/* The structure map model derived from evaluated nodes: one entry per form row. */
#include "engine_internal.h"

static bool outline_rows(const ps_value *nodes, ps_value *out);

/* The entry of one row of the collection at path, with the rows nested in it; NULL on allocation failure. */
static ps_value *outline_entry(ps_text path, const ps_value *row)
{
    static const char *const texts[] = {"number", "title"};
    ps_value *entry = ps_object_value();
    ps_value *rows = ps_array_value();
    if (!entry || !rows) goto fail;
    if (!ps_set(entry, "path", ps_text_value(path)) || !ps_set(entry, "key", ps_text_value(text_of(member(row, "key"))))) goto fail;
    const ps_value *header = member(row, "header");
    for (size_t i = 0; i < sizeof(texts) / sizeof(*texts); ++i) {
        const ps_value *text = member(header, texts[i]);
        if (text && text->kind != PS_NULL && !ps_set(entry, texts[i], ps_value_clone(text))) goto fail;
    }
    const ps_value *controls = member(row, "controls");
    if (ps_is_string(member(controls, "placement"), "outline") && !ps_set(entry, "controls", ps_value_clone(controls))) goto fail;
    if (!outline_rows(children_of(row), rows)) goto fail;
    if (!ps_set(entry, "rows", rows)) { rows = NULL; goto fail; }
    return entry;
fail:
    ps_value_free(rows);
    ps_value_free(entry);
    return NULL;
}

/* Append the rows under nodes to out, looking through every node that is not a collection. */
static bool outline_rows(const ps_value *nodes, ps_value *out)
{
    for (size_t i = 0; i < ps_size(nodes); ++i) {
        const ps_value *node = ps_at(nodes, i);
        if (!ps_is_string(member(node, "kind"), "collection")) {
            if (!outline_rows(children_of(node), out)) return false;
            continue;
        }
        const ps_value *children = children_of(node);
        ps_text path = text_of(member(node, "path"));
        for (size_t j = 0; j < ps_size(children); ++j)
            if (!ps_append(out, outline_entry(path, ps_at(children, j)))) return false;
    }
    return true;
}

ps_result ps_build_outline(const ps_value *nodes)
{
    if (!nodes || nodes->kind != PS_ARRAY)
        return ps_fail("form", "INVALID_FORM_INPUT", "Outline nodes must be a list", "");
    for (size_t i = 0; i < ps_size(nodes); ++i)
        if (!ps_at(nodes, i) || ps_at(nodes, i)->kind != PS_OBJECT)
            return ps_fail("form", "INVALID_FORM_INPUT", "Outline nodes must be evaluated node objects", "");
    ps_value *rows = ps_array_value();
    if (!rows || !outline_rows(nodes, rows)) {
        ps_value_free(rows);
        return ps_fail("internal", "INTERNAL_ERROR", "C outline evaluation failed", "");
    }
    return ps_ok(rows);
}
