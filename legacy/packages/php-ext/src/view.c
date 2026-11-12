/* The row view state of form instances: a view is {collapsed: list of row paths}, as View.php. */
#include "engine_internal.h"

#include <string.h>

static const char *const view_message = "View collapsed must be a list of strings";
static const char *const nodes_message = "View nodes must be evaluated node objects";

static ps_result input_failure(const char *message)
{
    return ps_fail("form", "INVALID_FORM_INPUT", message, "");
}

static ps_result internal_failure(void)
{
    return ps_fail("internal", "INTERNAL_ERROR", "C view operation failed", "");
}

/* The collapsed list of a view, NULL unless it is a list of strings. */
static const ps_value *collapsed_of(const ps_value *view)
{
    const ps_value *collapsed = member(view, "collapsed");
    if (!collapsed || collapsed->kind != PS_ARRAY) return NULL;
    for (size_t i = 0; i < ps_size(collapsed); ++i) {
        const ps_value *item = ps_at(collapsed, i);
        if (!item || item->kind != PS_STRING) return NULL;
    }
    return collapsed;
}

/* Whether nodes is a list of evaluated node objects. */
static bool node_list(const ps_value *nodes)
{
    if (!nodes || nodes->kind != PS_ARRAY) return false;
    for (size_t i = 0; i < ps_size(nodes); ++i) {
        const ps_value *node = ps_at(nodes, i);
        if (!node || node->kind != PS_OBJECT) return false;
    }
    return true;
}

/* Whether path is the row path or lies inside that row: the row path followed by a dot. */
static bool inside(ps_text row, ps_text path)
{
    if (ps_text_equal(path, row)) return true;
    return path.length > row.length && path.bytes[row.length] == '.' &&
        (!row.length || !memcmp(path.bytes, row.bytes, row.length));
}

/* Whether the list already holds the text. */
static bool listed(const ps_value *rows, ps_text text)
{
    for (size_t i = 0; i < ps_size(rows); ++i)
        if (ps_text_equal(text_of(ps_at(rows, i)), text)) return true;
    return false;
}

/* A new string value with the text of a string; NULL on allocation failure. */
static ps_value *copy_text(ps_text text)
{
    ps_value *value = ps_value_new(PS_NULL);
    if (!value || !ps_value_string(value, (const uint8_t *)text.bytes, text.length)) {
        ps_value_free(value);
        return NULL;
    }
    return value;
}

/* A view whose collapsed list is the given list, which the view takes; NULL on allocation failure. */
static ps_result view_result(ps_value *collapsed)
{
    ps_value *view = ps_object_value();
    if (!view || !ps_set(view, "collapsed", collapsed)) {
        ps_value_free(view);
        return internal_failure();
    }
    return ps_ok(view);
}

/* Append the row paths of the collapsible rows under nodes to out, depth first in node order; false on allocation failure. */
static bool collect_rows(const ps_value *nodes, ps_value *out)
{
    for (size_t i = 0; i < ps_size(nodes); ++i) {
        const ps_value *node = ps_at(nodes, i);
        if (!ps_is_string(member(node, "kind"), "collection")) {
            if (!collect_rows(children_of(node), out)) return false;
            continue;
        }
        ps_text path = text_of(member(node, "path"));
        const ps_value *rows = children_of(node);
        for (size_t j = 0; j < ps_size(rows); ++j) {
            const ps_value *row = ps_at(rows, j);
            const ps_value *collapsible = member(row, "collapsible");
            if (collapsible && collapsible->kind == PS_BOOL && collapsible->data.boolean) {
                ps_value *row_path = ps_chars_value(ps_join_path(path, text_of(member(row, "key"))));
                if (!row_path || !ps_append(out, row_path)) return false;
            }
            if (!collect_rows(children_of(row), out)) return false;
        }
    }
    return true;
}

/* The collapsible rows of a list of nodes, as a list of row paths; NULL on allocation failure. */
static ps_value *collapsible_rows(const ps_value *nodes)
{
    ps_value *rows = ps_array_value();
    if (!rows || !collect_rows(nodes, rows)) {
        ps_value_free(rows);
        return NULL;
    }
    return rows;
}

ps_result ps_initial_view(void)
{
    return view_result(ps_array_value());
}

ps_result ps_collapsible_rows(const ps_value *nodes)
{
    if (!node_list(nodes)) return input_failure(nodes_message);
    ps_value *rows = collapsible_rows(nodes);
    return rows ? ps_ok(rows) : internal_failure();
}

/* The collapsed list of a view and the row of a row operation; the failure is set when either is not valid. */
static bool row_input(const ps_value *view, const ps_value *row_path, const ps_value **collapsed, ps_text *row,
                      ps_result *failure)
{
    *collapsed = collapsed_of(view);
    if (!*collapsed) {
        *failure = input_failure(view_message);
        return false;
    }
    if (!row_path || row_path->kind != PS_STRING) {
        *failure = input_failure("Row path must be a string");
        return false;
    }
    *row = ps_string(row_path);
    return true;
}

/* Copies the collapsed rows into a new list, leaving out each item that drop reports for the row; *dropped reports
 * whether one was left out when dropped is not NULL. The caller frees the list. NULL when the copy fails. */
static ps_value *rows_without(const ps_value *collapsed, ps_text row, bool (*drop)(ps_text row, ps_text item),
                              bool *dropped)
{
    ps_value *rows = ps_array_value();
    if (!rows) return NULL;
    for (size_t i = 0; i < ps_size(collapsed); ++i) {
        ps_text item = text_of(ps_at(collapsed, i));
        if (drop(row, item)) {
            if (dropped) *dropped = true;
            continue;
        }
        if (!ps_append(rows, copy_text(item))) {
            ps_value_free(rows);
            return NULL;
        }
    }
    return rows;
}

static bool drops_same_row(ps_text row, ps_text item)
{
    return ps_text_equal(item, row);
}

static bool drops_row_inside(ps_text row, ps_text item)
{
    return inside(row, item);
}

ps_result ps_toggle_row_view(const ps_value *view, const ps_value *row_path)
{
    const ps_value *collapsed = NULL;
    ps_text row;
    ps_result failure;
    if (!row_input(view, row_path, &collapsed, &row, &failure)) return failure;
    bool found = false;
    ps_value *rows = rows_without(collapsed, row, drops_same_row, &found);
    if (!rows) return internal_failure();
    if (!found && !ps_append(rows, copy_text(row))) {
        ps_value_free(rows);
        return internal_failure();
    }
    return view_result(rows);
}

ps_result ps_set_all_expanded_view(const ps_value *nodes, const ps_value *expanded)
{
    if (!expanded || expanded->kind != PS_BOOL) return input_failure("Expanded must be a boolean");
    if (!node_list(nodes)) return input_failure(nodes_message);
    if (expanded->data.boolean) return ps_initial_view();
    ps_value *rows = collapsible_rows(nodes);
    return rows ? view_result(rows) : internal_failure();
}

ps_result ps_remove_row_view(const ps_value *view, const ps_value *row_path)
{
    const ps_value *collapsed = NULL;
    ps_text row;
    ps_result failure;
    if (!row_input(view, row_path, &collapsed, &row, &failure)) return failure;
    ps_value *rows = rows_without(collapsed, row, drops_row_inside, NULL);
    return rows ? view_result(rows) : internal_failure();
}

ps_result ps_rekey_row_view(const ps_value *view, const ps_value *old_path, const ps_value *new_path)
{
    const ps_value *collapsed = collapsed_of(view);
    if (!collapsed) return input_failure(view_message);
    if (!old_path || old_path->kind != PS_STRING || !new_path || new_path->kind != PS_STRING)
        return input_failure("Row path must be a string");
    ps_text old_row = ps_string(old_path), new_row = ps_string(new_path);
    ps_value *rows = ps_array_value();
    if (!rows) return internal_failure();
    for (size_t i = 0; i < ps_size(collapsed); ++i) {
        ps_text item = text_of(ps_at(collapsed, i));
        ps_chars moved = inside(old_row, item)
            ? PS_CONCAT(new_row, ps_text_slice(item, old_row.length, item.length))
            : ps_copy(item);
        if (!moved.bytes) goto fail;
        if (listed(rows, ps_view(moved))) {
            free(moved.bytes);
            continue;
        }
        ps_value *value = ps_chars_value(moved);
        if (!value || !ps_append(rows, value)) goto fail;
    }
    return view_result(rows);
fail:
    ps_value_free(rows);
    return internal_failure();
}
