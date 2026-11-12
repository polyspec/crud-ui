#include "engine_internal.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct ps_form {
    ps_value *template;
    ps_value *data;
    ps_value *fields;
    ps_value *options;
    /* The row view state: {collapsed: list of row paths}. */
    ps_value *view;
    /* The undo history: {entries, redoEntries} with an optional lastPath (history.c). */
    ps_value *history;
    int64_t revision;
};

/* Path segments as views into the source path. */
typedef struct {
    ps_text *items;
    size_t length;
} form_path;

static ps_value *internal_error(void)
{
    return ps_error("internal", "INTERNAL_ERROR", "C form operation failed", "", NULL);
}

static ps_value *input_error(const char *message)
{
    return ps_error("form", "INVALID_FORM_INPUT", message, "", NULL);
}

/* An input error whose message is the prefix, the text and the suffix. */
static ps_value *input_error_with(const char *prefix, ps_text text, const char *suffix)
{
    ps_chars message = PS_CONCAT(ps_fixed(prefix), text, ps_fixed(suffix));
    if (!message.bytes) return internal_error();
    ps_value *error = ps_error_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL);
    free(message.bytes);
    return error;
}

static bool field_repeats(const ps_value *field)
{
    const ps_value *multiple = member(member(field, "spec"), "multiple");
    return multiple && ((multiple->kind == PS_BOOL && multiple->data.boolean) ||
                        multiple->kind == PS_OBJECT || ps_is_string(multiple, "only"));
}

/* A multiple: only collection: its rows come only from the data. */
static bool field_data_only(const ps_value *field)
{
    const ps_value *multiple = member(member(field, "spec"), "multiple");
    const ps_value *only = member(multiple, "only");
    return ps_is_string(multiple, "only") || (only && only->kind == PS_BOOL && only->data.boolean);
}

static bool field_group(const ps_value *field)
{
    return ps_is_string(member(member(field, "spec"), "type"), "group");
}

static bool reserved_name(ps_text key)
{
    return ps_text_is(key, "__proto__") || ps_text_is(key, "prototype") ||
        ps_text_is(key, "constructor");
}

static bool valid_key(ps_text key)
{
    if (!key.length || reserved_name(key)) return false;
    bool digits = true;
    for (size_t i = 0; i < key.length; ++i) {
        unsigned char c = (unsigned char)key.bytes[i];
        if (!isalnum(c) && c != '_' && c != '-') return false;
        if (!isdigit(c)) digits = false;
    }
    return !digits;
}

static ps_value *checked_key_error(ps_text key)
{
    return valid_key(key) ? NULL
        : input_error_with("Invalid row key: ", key, "; use sequenceRowKey for numeric ids");
}

static ps_value *fresh_key(const ps_value *used, ps_value **error)
{
    for (size_t attempt = 0; attempt < 100; ++attempt) {
        ps_result result = ps_create_key();
        if (result.error) {
            *error = result.error;
            return NULL;
        }
        if (result.value && result.value->kind == PS_STRING &&
            !ps_has_text(used, ps_string(result.value))) return result.value;
        ps_value_free(result.value);
    }
    *error = input_error("Unable to generate an unused row key");
    return NULL;
}

static ps_value *normalize_fields(const ps_value *fields, const ps_value *value,
                                  ps_text path, bool fresh, ps_value **error);

/* fresh gives a placeholder row of a nested collection a fresh key; only a row that AddRow creates has one. */
static ps_value *normalize_row(const ps_value *field, const ps_value *value,
                               ps_text path, bool fresh, ps_value **error)
{
    if (field_group(field))
        return normalize_fields(member(field, "children"), value, path, fresh, error);
    if (value) return ps_value_clone(value);
    const ps_value *fallback = member(member(field, "spec"), "default");
    return fallback ? ps_value_clone(fallback) : ps_string_value("");
}

/* Normalize one keyed row at "<collection path>.<key>". */
static ps_value *normalize_keyed_row(const ps_value *field, const ps_value *value,
                                     ps_text collection_path, ps_text key, bool fresh,
                                     ps_value **error)
{
    ps_chars row_path = ps_join_path(collection_path, key);
    if (!row_path.bytes) {
        *error = internal_error();
        return NULL;
    }
    ps_value *row = normalize_row(field, value, ps_view(row_path), fresh, error);
    free(row_path.bytes);
    return row;
}

/* Normalize record data; path is the full data path, empty at the root. */
static ps_value *normalize_fields(const ps_value *fields, const ps_value *value,
                                  ps_text path, bool fresh, ps_value **error)
{
    if (!fields || fields->kind != PS_ARRAY) {
        *error = input_error("Unsupported form template");
        return NULL;
    }
    if (value && value->kind != PS_OBJECT) {
        *error = path.length ? input_error_with("Group data must be an object: ", path, "")
                             : input_error("Form data must be an object");
        return NULL;
    }
    ps_value *data = value ? ps_value_clone(value) : ps_object_value();
    if (!data) {
        *error = internal_error();
        return NULL;
    }
    ps_chars field_path = {NULL, 0};
    for (size_t index = 0; index < ps_size(fields); ++index) {
        const ps_value *field = ps_at(fields, index);
        const ps_value *name_value = member(field, "name");
        if (!name_value || name_value->kind != PS_STRING) {
            *error = input_error("Unsupported form template");
            goto fail;
        }
        ps_text name = ps_string(name_value);
        const ps_value *raw = ps_get_text(data, name);
        ps_value *normalized = NULL;
        if (field_repeats(field) || field_group(field)) {
            field_path = ps_join_path(path, name);
            if (!field_path.bytes) {
                *error = internal_error();
                goto fail;
            }
        }
        if (field_repeats(field)) {
            if (raw && raw->kind != PS_OBJECT) {
                *error = input_error_with("Repeated data must be a keyed object: ", ps_view(field_path), "");
                goto fail;
            }
            ps_value *rows = ps_object_value();
            if (!rows) {
                *error = internal_error();
                goto fail;
            }
            /* Missing data creates one row with the initial key of a keyed row, except in a data-only collection. */
            if (!raw && !field_data_only(field)) {
                ps_value *key = fresh ? fresh_key(rows, error) : ps_string_value("__0000000000000__");
                if (!key && !*error) *error = internal_error();
                ps_value *row = key
                    ? normalize_keyed_row(field, NULL, ps_view(field_path), ps_string(key), fresh, error) : NULL;
                if (!key || !row || !ps_set_text(rows, ps_string(key), row)) {
                    ps_value_free(key);
                    ps_value_free(rows);
                    if (!*error) *error = internal_error();
                    goto fail;
                }
                ps_value_free(key);
            } else if (raw) {
                for (size_t row_index = 0; row_index < ps_size(raw); ++row_index) {
                    ps_text key = ps_key(raw, row_index);
                    *error = checked_key_error(key);
                    if (*error) {
                        ps_value_free(rows);
                        goto fail;
                    }
                    ps_value *row = normalize_keyed_row(field, ps_at(raw, row_index),
                                                        ps_view(field_path), key, fresh, error);
                    if (!row || !ps_set_text(rows, key, row)) {
                        ps_value_free(rows);
                        if (!*error) *error = internal_error();
                        goto fail;
                    }
                }
            }
            normalized = rows;
        } else if (field_group(field)) {
            normalized = normalize_fields(member(field, "children"), raw, ps_view(field_path), fresh, error);
        } else if (!raw) {
            const ps_value *fallback = member(member(field, "spec"), "default");
            if (fallback) normalized = ps_value_clone(fallback);
            else continue;
        } else {
            continue;
        }
        free(field_path.bytes);
        field_path = (ps_chars){NULL, 0};
        if (!normalized || !ps_set_text(data, name, normalized)) {
            if (!*error) *error = internal_error();
            goto fail;
        }
    }
    return data;
fail:
    free(field_path.bytes);
    ps_value_free(data);
    return NULL;
}

static form_path checked_path(ps_text path, ps_value **error)
{
    form_path result = {0};
    if (!ps_path_parts(path, &result.items, &result.length) || !result.length) {
        free(result.items);
        *error = input_error_with("Invalid form path: ", path, "");
        return (form_path){0};
    }
    for (size_t index = 0; index < result.length; ++index) {
        if (reserved_name(result.items[index])) {
            free(result.items);
            *error = input_error_with("Invalid form path: ", path, "");
            return (form_path){0};
        }
    }
    return result;
}

static void free_path(form_path *path)
{
    free(path->items);
    *path = (form_path){0};
}

static ps_value *put_at(const ps_value *current, const ps_text *path, size_t length,
                        const ps_value *value)
{
    if (!length) return NULL;
    ps_value *object = current && current->kind == PS_OBJECT
        ? ps_value_clone(current) : ps_object_value();
    if (!object) return NULL;
    const ps_value *child = current && current->kind == PS_OBJECT ? ps_get_text(current, path[0]) : NULL;
    ps_value *next = length == 1
        ? ps_value_clone(value)
        : put_at(child, path + 1, length - 1, value);
    if (!next || !ps_set_text(object, path[0], next)) {
        ps_value_free(object);
        return NULL;
    }
    return object;
}

static const ps_value *find_field(const ps_value *fields, ps_text name)
{
    if (!fields || fields->kind != PS_ARRAY) return NULL;
    for (size_t index = 0; index < ps_size(fields); ++index) {
        const ps_value *field = ps_at(fields, index);
        const ps_value *field_name = member(field, "name");
        if (field_name && field_name->kind == PS_STRING && ps_text_equal(ps_string(field_name), name))
            return field;
    }
    return NULL;
}

static bool collection(const ps_form *form, ps_text source, form_path *path,
                       const ps_value **field, const ps_value **rows, ps_value **error)
{
    *path = checked_path(source, error);
    if (*error) return false;
    const ps_value *fields = member(form->template, "fields");
    const ps_value *selected = NULL;
    for (size_t index = 0; index < path->length; ++index) {
        selected = find_field(fields, path->items[index]);
        if (!selected) {
            *error = input_error_with("Unknown collection: ", source, "");
            free_path(path);
            return false;
        }
        if (index + 1 == path->length) break;
        if (field_repeats(selected)) ++index;
        fields = member(selected, "children");
        selected = NULL;
    }
    const ps_value *data = ps_path_segments(form->data, path->items, path->length);
    if (!selected || !field_repeats(selected) || !data || data->kind != PS_OBJECT) {
        *error = input_error_with("Not a keyed collection: ", source, "");
        free_path(path);
        return false;
    }
    *field = selected;
    *rows = data;
    return true;
}

/* A collection whose rows the form may add, copy, remove, move or rekey. */
static bool editable_collection(const ps_form *form, ps_text source, form_path *path,
                                const ps_value **field, const ps_value **rows, ps_value **error)
{
    if (!collection(form, source, path, field, rows, error)) return false;
    if (!field_data_only(*field)) return true;
    free_path(path);
    *error = input_error_with("Rows of ", source, " come only from data");
    return false;
}

/* The bind options of a form: its options with the collapsed list of view, which replaces any collapsed option. */
static ps_value *bind_options(const ps_value *options, const ps_value *view)
{
    ps_value *bound = ps_value_clone(options);
    const ps_value *collapsed = ps_get(view, "collapsed");
    if (!bound || !collapsed || !ps_set(bound, "collapsed", ps_value_clone(collapsed))) {
        ps_value_free(bound);
        return NULL;
    }
    return bound;
}

/* The value of an engine result; NULL with *error set on failure. */
static ps_value *result_value(ps_result result, ps_value **error)
{
    if (result.error) {
        *error = result.error;
        return NULL;
    }
    if (!result.value) {
        *error = internal_error();
        return NULL;
    }
    return result.value;
}

/* The dotted path of the segments of path, joined with dots; NULL bytes on failure. */
static ps_chars dotted_path(const form_path *path)
{
    ps_chars joined = ps_copy(path->items[0]);
    for (size_t index = 1; joined.bytes && index < path->length; ++index) {
        ps_chars next = ps_join_path(ps_view(joined), path->items[index]);
        free(joined.bytes);
        joined = next;
    }
    return joined;
}

/* The row path "<collection path>.<key>": the segments of path joined with the key; NULL bytes on failure. */
static ps_chars row_path_of(const form_path *path, ps_text key)
{
    ps_chars row = ps_copy(path->items[0]);
    for (size_t index = 1; row.bytes && index <= path->length; ++index) {
        ps_chars next = ps_join_path(ps_view(row), index < path->length ? path->items[index] : key);
        free(row.bytes);
        row = next;
    }
    return row;
}

/* The view with the row at key removed, the row and the rows inside it; NULL with *error set on failure. */
static ps_value *view_without_row(const ps_form *form, const form_path *path, ps_text key, ps_value **error)
{
    ps_value *row = ps_chars_value(row_path_of(path, key));
    ps_result removed = row ? ps_remove_row_view(form->view, row) : (ps_result){NULL, internal_error()};
    ps_value_free(row);
    return result_value(removed, error);
}

/* The view with the row at old_key moved to new_key in the collection at path; NULL with *error set on failure. */
static ps_value *view_after_rekey(const ps_form *form, const form_path *path, ps_text old_key,
                                  ps_text new_key, ps_value **error)
{
    ps_value *old_row = ps_chars_value(row_path_of(path, old_key));
    ps_value *new_row = old_row ? ps_chars_value(row_path_of(path, new_key)) : NULL;
    ps_result moved = old_row && new_row
        ? ps_rekey_row_view(form->view, old_row, new_row) : (ps_result){NULL, internal_error()};
    ps_value_free(old_row);
    ps_value_free(new_row);
    return result_value(moved, error);
}

/* Bind the fields with the view, which the form then keeps; the record and the revision do not change. */
static ps_result refresh_view(ps_form *form, ps_value *view)
{
    ps_value *options = bind_options(form->options, view);
    ps_result binding = options
        ? ps_bind_form(form->template, form->data, options)
        : (ps_result){NULL, internal_error()};
    ps_value_free(options);
    if (!binding.value) {
        ps_value_free(view);
        return binding.error ? binding : (ps_result){NULL, internal_error()};
    }
    ps_value_free(form->fields);
    ps_value_free(form->view);
    form->fields = binding.value;
    form->view = view;
    return ps_ok(ps_null_value());
}

/*
 * Take a record, its history and a view, and bind the fields of the record: a NULL view keeps the current view. A failure
 * frees all three and leaves the form unchanged; a success counts one revision.
 */
static ps_result install(ps_form *form, ps_value *data, ps_value *history, ps_value *view)
{
    ps_value *options = bind_options(form->options, view ? view : form->view);
    ps_result binding = options
        ? ps_bind_form(form->template, data, options)
        : (ps_result){NULL, internal_error()};
    ps_value_free(options);
    if (!binding.value) {
        ps_value_free(data);
        ps_value_free(history);
        ps_value_free(view);
        return binding.error ? binding : (ps_result){NULL, internal_error()};
    }
    ps_value_free(form->data);
    ps_value_free(form->fields);
    ps_value_free(form->history);
    form->data = data;
    form->fields = binding.value;
    form->history = history;
    if (view) {
        ps_value_free(form->view);
        form->view = view;
    }
    form->revision++;
    return ps_ok(ps_null_value());
}

/*
 * Replace the record and the view together and record the previous record in the history, with the path of a value
 * edit; a NULL path records a row operation. The record and the view are taken; a failure leaves all unchanged.
 */
static ps_result commit(ps_form *form, ps_value *data, ps_value *view, const ps_value *path)
{
    ps_value *null_path = path ? NULL : ps_null_value();
    const ps_value *record_path = path ? path : null_path;
    ps_result recorded = record_path
        ? ps_record_change(form->history, form->data, record_path)
        : (ps_result){NULL, internal_error()};
    ps_value_free(null_path);
    if (!recorded.value) {
        ps_value_free(data);
        ps_value_free(view);
        return recorded.error ? recorded : (ps_result){NULL, internal_error()};
    }
    return install(form, data, recorded.value, view);
}

static ps_result replace_data(ps_form *form, const ps_value *value)
{
    ps_value *error = NULL;
    ps_value *data = normalize_fields(member(form->template, "fields"), value, PS_TEXT(""), false, &error);
    if (!data) return (ps_result){NULL, error ? error : internal_error()};
    /* Replacing the record resets the view to the initial view and restarts the history. */
    ps_value *view = result_value(ps_initial_view(), &error);
    if (!view) {
        ps_value_free(data);
        return (ps_result){NULL, error};
    }
    ps_value *history = result_value(ps_empty_history(), &error);
    if (!history) {
        ps_value_free(data);
        ps_value_free(view);
        return (ps_result){NULL, error};
    }
    return install(form, data, history, view);
}

/*
 * Restore the record before the last change (undo) or reapply the last undone change (redo): the record replaces the
 * data, the view is kept and the history moves; the revision counts one change.
 */
static ps_result step_form(ps_form *form, bool undo)
{
    ps_result step = undo
        ? ps_undo_change(form->history, form->data)
        : ps_redo_change(form->history, form->data);
    if (!step.value) return step.error ? step : (ps_result){NULL, internal_error()};
    ps_value *history = ps_value_clone(ps_get(step.value, "history"));
    ps_value *value = ps_value_clone(ps_get(step.value, "value"));
    ps_value_free(step.value);
    if (!history || !value) {
        ps_value_free(history);
        ps_value_free(value);
        return (ps_result){NULL, internal_error()};
    }
    return install(form, value, history, NULL);
}

static ps_value *copy_row_value(const ps_value *field, const ps_value *value,
                                ps_value **error)
{
    if (!field_group(field)) return ps_value_clone(value);
    if (!value || value->kind != PS_OBJECT) {
        *error = input_error("Group data must be an object");
        return NULL;
    }
    ps_value *row = ps_value_clone(value);
    const ps_value *children = member(field, "children");
    if (!row || !children || children->kind != PS_ARRAY) {
        ps_value_free(row);
        *error = internal_error();
        return NULL;
    }
    for (size_t index = 0; index < ps_size(children); ++index) {
        const ps_value *child = ps_at(children, index);
        const ps_value *name_value = member(child, "name");
        if (!name_value || name_value->kind != PS_STRING) continue;
        ps_text name = ps_string(name_value);
        const ps_value *raw = ps_get_text(row, name);
        if (!raw || raw->kind != PS_OBJECT) continue;
        if (field_repeats(child)) {
            ps_value *used = ps_value_clone(raw);
            ps_value *copied = ps_object_value();
            if (!used || !copied) {
                ps_value_free(used);
                ps_value_free(copied);
                ps_value_free(row);
                *error = internal_error();
                return NULL;
            }
            for (size_t row_index = 0; row_index < ps_size(raw); ++row_index) {
                ps_value *key = fresh_key(used, error);
                ps_value *item = key
                    ? copy_row_value(child, ps_at(raw, row_index), error) : NULL;
                if (!key || !item || !ps_set_text(copied, ps_string(key), item) ||
                    !ps_set_text(used, ps_string(key), ps_null_value())) {
                    ps_value_free(key);
                    ps_value_free(used);
                    ps_value_free(copied);
                    ps_value_free(row);
                    if (!*error) *error = internal_error();
                    return NULL;
                }
                ps_value_free(key);
            }
            ps_value_free(used);
            if (!ps_set_text(row, name, copied)) {
                ps_value_free(row);
                *error = internal_error();
                return NULL;
            }
        } else if (field_group(child)) {
            ps_value *copied = copy_row_value(child, raw, error);
            if (!copied || !ps_set_text(row, name, copied)) {
                ps_value_free(row);
                if (!*error) *error = internal_error();
                return NULL;
            }
        }
    }
    return row;
}

static double numeric_setting(const ps_value *field, const char *name, bool *present)
{
    const ps_value *multiple = member(member(field, "spec"), "multiple");
    const ps_value *value = member(multiple, name);
    if (value && value->kind == PS_INT) {
        *present = true;
        return (double)value->data.integer;
    }
    if (value && value->kind == PS_FLOAT) {
        *present = true;
        return value->data.number;
    }
    *present = false;
    return 0;
}

static ps_value *object_with_insert(const ps_value *rows, ps_text key,
                                    ps_value *value, size_t at)
{
    ps_value *output = ps_object_value();
    if (!output) {
        ps_value_free(value);
        return NULL;
    }
    for (size_t index = 0; index <= ps_size(rows); ++index) {
        if (index == at) {
            if (!ps_set_text(output, key, value)) {
                ps_value_free(output);
                return NULL;
            }
            value = NULL;
        }
        if (index < ps_size(rows) &&
            !ps_set_text(output, ps_key(rows, index), ps_value_clone(ps_at(rows, index)))) {
            ps_value_free(value);
            ps_value_free(output);
            return NULL;
        }
    }
    return output;
}

/* The position of a row key, or SIZE_MAX. */
static size_t row_position(const ps_value *rows, ps_text key)
{
    for (size_t index = 0; index < ps_size(rows); ++index)
        if (ps_text_equal(ps_key(rows, index), key)) return index;
    return SIZE_MAX;
}

/* The collection of a row operation and the state its checks fill in. */
typedef struct {
    form_path path;
    const ps_value *field;
    const ps_value *rows;
    ps_value *error;
} row_scope;

/*
 * Open the collection of a row operation into scope: false, with failure set, when the operation may not go on. A row to
 * add or copy takes options, which must be an object (needs_options); the other row operations take none.
 */
static bool open_row_scope(ps_form *form, ps_text source, const ps_value *options, bool needs_options,
                           row_scope *scope, ps_result *failure)
{
    *scope = (row_scope){0};
    if (needs_options && (!options || options->kind != PS_OBJECT)) {
        *failure = (ps_result){NULL, input_error("Row options must be an object")};
        return false;
    }
    if (editable_collection(form, source, &scope->path, &scope->field, &scope->rows, &scope->error)) return true;
    *failure = (ps_result){NULL, scope->error};
    return false;
}

/* The failure of a key that the collection does not hold; the path is released. */
static ps_result unknown_row(form_path *path, ps_text key)
{
    free_path(path);
    return (ps_result){NULL, input_error_with("Unknown row: ", key, "")};
}

/* The result of a change: the data and the view must both be built, else the change fails. */
static ps_result finish_change(ps_form *form, ps_value *data, ps_value *view, ps_value *error)
{
    if (!data || !view) {
        ps_value_free(data);
        return (ps_result){NULL, data ? error : internal_error()};
    }
    return commit(form, data, view, NULL);
}

static ps_result add_row(ps_form *form, ps_text source, const ps_value *options)
{
    row_scope scope;
    ps_result failure;
    if (!open_row_scope(form, source, options, true, &scope, &failure)) return failure;
    bool has_max = false;
    double maximum = numeric_setting(scope.field, "max", &has_max);
    if (has_max && (double)ps_size(scope.rows) >= maximum) {
        free_path(&scope.path);
        return (ps_result){NULL, input_error_with("Maximum row count reached: ", source, "")};
    }
    const ps_value *requested = member(options, "key");
    ps_value *key = NULL;
    if (!requested || requested->kind == PS_NULL) key = fresh_key(scope.rows, &scope.error);
    else if (requested->kind == PS_STRING) key = ps_value_clone(requested);
    else scope.error = input_error("A row key must be a string");
    if (!key) {
        free_path(&scope.path);
        return (ps_result){NULL, scope.error ? scope.error : internal_error()};
    }
    scope.error = checked_key_error(ps_string(key));
    if (scope.error || ps_has_text(scope.rows, ps_string(key))) {
        if (!scope.error) scope.error = input_error_with("Row key already exists: ", ps_string(key), "");
        ps_value_free(key);
        free_path(&scope.path);
        return (ps_result){NULL, scope.error};
    }
    size_t at = ps_size(scope.rows);
    const ps_value *after = member(options, "afterKey");
    if (after && after->kind != PS_NULL) {
        if (after->kind != PS_STRING) scope.error = input_error("afterKey must be a string");
        else {
            size_t found = row_position(scope.rows, ps_string(after));
            if (found == SIZE_MAX) scope.error = input_error_with("Unknown row: ", ps_string(after), "");
            else at = found + 1;
        }
    }
    const ps_value *source_value = ps_has(options, "value") ? member(options, "value") : NULL;
    /* A supplied row value is checked at "<collection path>.<key>". */
    ps_chars row_path = scope.error ? (ps_chars){NULL, 0} : ps_copy(scope.path.items[0]);
    for (size_t index = 1; row_path.bytes && index <= scope.path.length; ++index) {
        ps_chars next = ps_join_path(ps_view(row_path),
            index < scope.path.length ? scope.path.items[index] : ps_string(key));
        free(row_path.bytes);
        row_path = next;
    }
    if (!scope.error && !row_path.bytes) scope.error = internal_error();
    ps_value *row = scope.error ? NULL : normalize_row(scope.field, source_value, ps_view(row_path), true, &scope.error);
    free(row_path.bytes);
    ps_value *next_rows = row
        ? object_with_insert(scope.rows, ps_string(key), row, at) : NULL;
    ps_value *data = next_rows
        ? put_at(form->data, scope.path.items, scope.path.length, next_rows) : NULL;
    ps_value_free(next_rows);
    free_path(&scope.path);
    if (!data) {
        ps_value_free(key);
        return (ps_result){NULL, scope.error ? scope.error : internal_error()};
    }
    ps_result result = commit(form, data, NULL, NULL);
    if (result.error) {
        ps_value_free(key);
        return result;
    }
    ps_value_free(result.value);
    return ps_ok(key);
}

static ps_result copy_row(ps_form *form, ps_text source, ps_text key,
                          const ps_value *options)
{
    row_scope scope;
    ps_result failure;
    if (!open_row_scope(form, source, options, true, &scope, &failure)) return failure;
    const ps_value *value = ps_get_text(scope.rows, key);
    if (!value) {
        free_path(&scope.path);
        return (ps_result){NULL, input_error_with("Unknown row: ", key, "")};
    }
    ps_value *copied = copy_row_value(scope.field, value, &scope.error);
    ps_value *next_options = ps_value_clone(options);
    if (!copied || !next_options || !ps_set(next_options, "value", copied) ||
        ((!member(next_options, "afterKey") || member(next_options, "afterKey")->kind == PS_NULL) &&
         !ps_set(next_options, "afterKey", ps_text_value(key)))) {
        ps_value_free(next_options);
        free_path(&scope.path);
        return (ps_result){NULL, scope.error ? scope.error : internal_error()};
    }
    free_path(&scope.path);
    ps_result result = add_row(form, source, next_options);
    ps_value_free(next_options);
    return result;
}

static ps_result remove_row(ps_form *form, ps_text source, ps_text key)
{
    row_scope scope;
    ps_result failure;
    if (!open_row_scope(form, source, NULL, false, &scope, &failure)) return failure;
    if (!ps_has_text(scope.rows, key)) return unknown_row(&scope.path, key);
    bool has_min = false;
    double minimum = numeric_setting(scope.field, "min", &has_min);
    if (has_min && (double)ps_size(scope.rows) <= minimum) {
        free_path(&scope.path);
        return (ps_result){NULL, input_error_with("Minimum row count reached: ", source, "")};
    }
    ps_value *next_rows = ps_value_clone(scope.rows);
    if (!next_rows || !ps_delete_text(next_rows, key)) {
        ps_value_free(next_rows);
        free_path(&scope.path);
        return (ps_result){NULL, internal_error()};
    }
    ps_value *data = put_at(form->data, scope.path.items, scope.path.length, next_rows);
    ps_value_free(next_rows);
    ps_value *view = data ? view_without_row(form, &scope.path, key, &scope.error) : NULL;
    free_path(&scope.path);
    return finish_change(form, data, view, scope.error);
}

static ps_value *reordered_rows(const ps_value *rows, size_t from, size_t to)
{
    ps_value *output = ps_object_value();
    if (!output) return NULL;
    for (size_t target = 0; target < ps_size(rows); ++target) {
        size_t source;
        if (target == to) source = from;
        else if (from < to && target >= from && target < to) source = target + 1;
        else if (from > to && target > to && target <= from) source = target - 1;
        else source = target;
        if (!ps_set_text(output, ps_key(rows, source), ps_value_clone(ps_at(rows, source)))) {
            ps_value_free(output);
            return NULL;
        }
    }
    return output;
}

static ps_result move_row(ps_form *form, ps_text source, ps_text key,
                          int64_t position)
{
    row_scope scope;
    ps_result failure;
    if (!open_row_scope(form, source, NULL, false, &scope, &failure)) return failure;
    (void)scope.field;
    size_t from = row_position(scope.rows, key);
    if (from == SIZE_MAX) {
        free_path(&scope.path);
        return (ps_result){NULL, input_error_with("Unknown row: ", key, "")};
    }
    if (position < 0 || (uint64_t)position >= ps_size(scope.rows)) {
        free_path(&scope.path);
        char message[64];
        snprintf(message, sizeof(message), "Invalid row position: %lld", (long long)position);
        return (ps_result){NULL, input_error(message)};
    }
    if (from == (size_t)position) {
        free_path(&scope.path);
        return ps_ok(ps_null_value());
    }
    ps_value *next_rows = reordered_rows(scope.rows, from, (size_t)position);
    ps_value *data = next_rows
        ? put_at(form->data, scope.path.items, scope.path.length, next_rows) : NULL;
    ps_value_free(next_rows);
    free_path(&scope.path);
    return data ? commit(form, data, NULL, NULL) : (ps_result){NULL, internal_error()};
}

static ps_result rekey_row(ps_form *form, ps_text source, ps_text old_key,
                           ps_text new_key)
{
    ps_value *error = NULL;
    form_path path = {0};
    const ps_value *field = NULL, *rows = NULL;
    if (!editable_collection(form, source, &path, &field, &rows, &error))
        return (ps_result){NULL, error};
    (void)field;
    /* The collection is found before the new key is checked. */
    error = checked_key_error(new_key);
    if (error) {
        free_path(&path);
        return (ps_result){NULL, error};
    }
    if (!ps_has_text(rows, old_key)) {
        free_path(&path);
        return (ps_result){NULL, input_error_with("Unknown row: ", old_key, "")};
    }
    if (ps_text_equal(old_key, new_key)) {
        free_path(&path);
        return ps_ok(ps_null_value());
    }
    if (ps_has_text(rows, new_key)) {
        free_path(&path);
        return (ps_result){NULL, input_error_with("Row key already exists: ", new_key, "")};
    }
    ps_value *next_rows = ps_object_value();
    for (size_t index = 0; next_rows && index < ps_size(rows); ++index) {
        ps_text key = ps_text_equal(ps_key(rows, index), old_key) ? new_key : ps_key(rows, index);
        if (!ps_set_text(next_rows, key, ps_value_clone(ps_at(rows, index)))) {
            ps_value_free(next_rows);
            next_rows = NULL;
        }
    }
    ps_value *data = next_rows
        ? put_at(form->data, path.items, path.length, next_rows) : NULL;
    ps_value_free(next_rows);
    /* The row keeps its collapsed state under its new key. */
    ps_value *view = data ? view_after_rekey(form, &path, old_key, new_key, &error) : NULL;
    free_path(&path);
    return finish_change(form, data, view, error);
}

/* Expand or collapse one row; the view changes and the record and the revision do not. */
static ps_result toggle_row(ps_form *form, ps_text source, ps_text key)
{
    form_path path = {0};
    const ps_value *field = NULL, *rows = NULL;
    ps_value *error = NULL;
    if (!collection(form, source, &path, &field, &rows, &error))
        return (ps_result){NULL, error};
    if (!ps_has_text(rows, key)) return unknown_row(&path, key);
    ps_value *row = ps_chars_value(row_path_of(&path, key));
    free_path(&path);
    ps_result toggled = row
        ? ps_toggle_row_view(form->view, row) : (ps_result){NULL, internal_error()};
    ps_value_free(row);
    ps_value *view = result_value(toggled, &error);
    return view ? refresh_view(form, view) : (ps_result){NULL, error};
}

/* Expand every row, or collapse every collapsible row; the view changes and the record and the revision do not. */
static ps_result set_all_expanded(ps_form *form, const ps_value *expanded)
{
    ps_value *error = NULL;
    ps_value *view = result_value(ps_set_all_expanded_view(form->fields, expanded), &error);
    return view ? refresh_view(form, view) : (ps_result){NULL, error};
}

ps_form_result ps_form_new(const ps_value *template, const ps_value *data,
                           const ps_value *options)
{
    if (!ps_form_template_shape(template))
        return (ps_form_result){NULL, input_error("Unsupported form template")};
    if (!data || data->kind != PS_OBJECT || !options || options->kind != PS_OBJECT)
        return (ps_form_result){NULL, input_error("Invalid form input")};
    /* The template is a specification: the form keeps it in specification member order. */
    ps_value *ordered = ps_value_ordered(template);
    if (!ordered) return (ps_form_result){NULL, internal_error()};
    ps_value *error = NULL;
    ps_value *normalized = normalize_fields(member(ordered, "fields"), data, PS_TEXT(""), false, &error);
    if (!normalized) {
        ps_value_free(ordered);
        return (ps_form_result){NULL, error ? error : internal_error()};
    }
    /* A new form starts with the initial view: no collapsed row. */
    ps_value *view = result_value(ps_initial_view(), &error);
    if (!view) {
        ps_value_free(ordered);
        ps_value_free(normalized);
        return (ps_form_result){NULL, error};
    }
    ps_value *bound = bind_options(options, view);
    ps_result binding = bound ? ps_bind_form(ordered, normalized, bound) : (ps_result){NULL, internal_error()};
    ps_value_free(bound);
    if (!binding.value) {
        ps_value_free(ordered);
        ps_value_free(normalized);
        ps_value_free(view);
        return (ps_form_result){NULL, binding.error ? binding.error : internal_error()};
    }
    /* A new form starts with an empty undo history. */
    ps_value *history = result_value(ps_empty_history(), &error);
    if (!history) {
        ps_value_free(ordered);
        ps_value_free(normalized);
        ps_value_free(view);
        ps_value_free(binding.value);
        return (ps_form_result){NULL, error};
    }
    ps_form *form = calloc(1, sizeof(*form));
    if (!form) {
        ps_value_free(ordered);
        ps_value_free(normalized);
        ps_value_free(view);
        ps_value_free(binding.value);
        ps_value_free(history);
        return (ps_form_result){NULL, internal_error()};
    }
    form->template = ordered;
    form->options = ps_value_clone(options);
    form->data = normalized;
    form->fields = binding.value;
    form->view = view;
    form->history = history;
    if (!form->template || !form->options) {
        ps_form_free(form);
        return (ps_form_result){NULL, internal_error()};
    }
    return (ps_form_result){form, NULL};
}

void ps_form_free(ps_form *form)
{
    if (!form) return;
    ps_value_free(form->template);
    ps_value_free(form->data);
    ps_value_free(form->fields);
    ps_value_free(form->options);
    ps_value_free(form->view);
    ps_value_free(form->history);
    free(form);
}

ps_form *ps_form_clone(const ps_form *form)
{
    if (!form) return NULL;
    ps_form *copy = calloc(1, sizeof(*copy));
    if (!copy) return NULL;
    copy->template = ps_value_clone(form->template);
    copy->data = ps_value_clone(form->data);
    copy->fields = ps_value_clone(form->fields);
    copy->options = ps_value_clone(form->options);
    copy->view = ps_value_clone(form->view);
    copy->history = ps_value_clone(form->history);
    copy->revision = form->revision;
    if (!copy->template || !copy->data || !copy->fields || !copy->options || !copy->view || !copy->history) {
        ps_form_free(copy);
        return NULL;
    }
    return copy;
}

/* The interface language of a bound form: its option, or Korean. */
static ps_text form_language(const ps_form *form)
{
    const ps_value *language = member(form->options, "language");
    return language && language->kind == PS_STRING ? ps_string(language) : PS_TEXT("ko");
}

/* An options object: an object, or an empty list, which is an empty PHP array. */
static bool render_object(const ps_value *value)
{
    return value && (value->kind == PS_OBJECT || (value->kind == PS_ARRAY && !ps_size(value)));
}

/* Whether every member is a string and, with names, has one of the names. */
static bool string_members(const ps_value *object, const char *const *names, size_t count)
{
    for (size_t i = 0; object->kind == PS_OBJECT && i < ps_size(object); ++i) {
        const ps_value *value = ps_at(object, i);
        bool known = !names;
        for (size_t k = 0; !known && k < count; ++k) known = ps_text_is(ps_key(object, i), names[k]);
        if (!known || !value || value->kind != PS_STRING) return false;
    }
    return true;
}

/* Whether a value is a list whose items pass the check. */
static bool list_of(const ps_value *value, bool (*item)(const ps_value *))
{
    if (!value || value->kind != PS_ARRAY) return false;
    for (size_t i = 0; i < ps_size(value); ++i) if (!item(ps_at(value, i))) return false;
    return true;
}

static bool string_item(const ps_value *value) { return value && value->kind == PS_STRING; }

static bool error_item(const ps_value *value)
{
    const ps_value *path = member(value, "path"), *message = member(value, "message");
    return value && value->kind == PS_OBJECT && path && path->kind == PS_STRING &&
        message && message->kind == PS_STRING;
}

/* Whether path is the path of a row: its collection path, `.` and its key. */
static bool row_path_is(ps_text parent, ps_text key, ps_text path)
{
    if (path.length != parent.length + 1 + key.length) return false;
    return (!parent.length || !memcmp(path.bytes, parent.bytes, parent.length)) &&
        path.bytes[parent.length] == '.' &&
        (!key.length || !memcmp(path.bytes + parent.length + 1, key.bytes, key.length));
}

/* The node whose data path is path; a lang-item has no path. Rows sit directly in a collection,
   so the parent path of a row is the path of its collection. */
static const ps_value *node_with_path(const ps_value *nodes, ps_text parent, ps_text path)
{
    for (size_t i = 0; nodes && nodes->kind == PS_ARRAY && i < ps_size(nodes); ++i) {
        const ps_value *node = ps_at(nodes, i);
        ps_text kind = ps_string(member(node, "kind"));
        const ps_value *own = member(node, "path");
        bool has_own = own && own->kind == PS_STRING && !ps_text_is(kind, "row") && !ps_text_is(kind, "lang-item");
        if (ps_text_is(kind, "row") ? row_path_is(parent, ps_string(member(node, "key")), path)
                                    : has_own && ps_text_equal(ps_string(own), path)) return node;
        const ps_value *found = node_with_path(member(node, "children"), has_own ? ps_string(own) : parent, path);
        if (found) return found;
    }
    return NULL;
}

static void release_render(ps_form_render *render)
{
    ps_value_free(render->form);
    for (size_t i = 0; i < render->error_count; ++i) ps_value_free(render->errors[i].messages);
    free(render->errors);
}

/* Add one message to the error texts of a node; false only on allocation failure. */
static bool add_node_error(ps_form_render *render, const ps_value *node, const ps_value *message)
{
    size_t index = 0;
    while (index < render->error_count && render->errors[index].node != node) ++index;
    if (index == render->error_count) {
        ps_node_errors *entries = realloc(render->errors, (render->error_count + 1) * sizeof(*entries));
        if (!entries) return false;
        render->errors = entries;
        entries[index] = (ps_node_errors){node, ps_array_value()};
        render->error_count++;
        if (!entries[index].messages) return false;
    }
    return ps_append(render->errors[index].messages, ps_value_clone(message));
}

/* The template action member or the render action member of one key. */
static const ps_value *action_member(const ps_value *action, const ps_value *declared, const char *key)
{
    const ps_value *value = action && action->kind == PS_OBJECT ? ps_get(action, key) : NULL;
    if (!value) value = declared && declared->kind == PS_OBJECT ? ps_get(declared, key) : NULL;
    return value && value->kind == PS_STRING ? value : NULL;
}

/* Check render options and build the render model; the error is the first option outside the
   contract, in the documented order. */
static ps_value *render_model(const ps_form *form, const ps_value *options, ps_form_render *render)
{
    static const char *const option_names[] = {"action", "hidden", "formErrors", "errors"};
    static const char *const action_names[] = {"method", "url", "enctype"};
    *render = (ps_form_render){0};
    if (!options) return NULL;
    if (!render_object(options)) return input_error("Render options must be an object");
    for (size_t i = 0; options->kind == PS_OBJECT && i < ps_size(options); ++i) {
        bool known = false;
        for (size_t k = 0; !known && k < 4; ++k) known = ps_text_is(ps_key(options, i), option_names[k]);
        if (!known) return input_error_with("Unknown render option: ", ps_key(options, i), "");
    }
    const ps_value *action = options->kind == PS_OBJECT ? ps_get(options, "action") : NULL;
    const ps_value *hidden = options->kind == PS_OBJECT ? ps_get(options, "hidden") : NULL;
    const ps_value *form_errors = options->kind == PS_OBJECT ? ps_get(options, "formErrors") : NULL;
    const ps_value *errors = options->kind == PS_OBJECT ? ps_get(options, "errors") : NULL;
    if (action && (!render_object(action) || !string_members(action, action_names, 3)))
        return input_error("action must be an object with string method, url and enctype");
    if (hidden && (!render_object(hidden) || !string_members(hidden, NULL, 0)))
        return input_error("hidden must be an object of strings");
    if (hidden && !action) return input_error("hidden requires action");
    if (form_errors && !list_of(form_errors, string_item)) return input_error("formErrors must be a list of strings");
    if (errors && !list_of(errors, error_item))
        return input_error("errors must be a list of objects with string path and message");
    for (size_t i = 0; errors && i < ps_size(errors); ++i) {
        const ps_value *error = ps_at(errors, i);
        ps_text path = ps_string(ps_get(error, "path"));
        const ps_value *node = node_with_path(form->fields, PS_TEXT(""), path);
        if (!node) { release_render(render); return input_error_with("Unknown error path: ", path, ""); }
        if (!add_node_error(render, node, ps_get(error, "message"))) { release_render(render); return internal_error(); }
    }
    render->hidden = hidden;
    render->form_errors = form_errors;
    if (action) {
        const ps_value *declared = member(form->template, "action");
        const ps_value *url = action_member(action, declared, "url");
        const ps_value *enctype = action_member(action, declared, "enctype");
        const ps_value *method = action_member(action, declared, "method");
        render->form = ps_object_value();
        if (!render->form || (url && !ps_set(render->form, "action", ps_value_clone(url))) ||
            (enctype && !ps_set(render->form, "encType", ps_value_clone(enctype))) ||
            (method && !ps_set(render->form, "method", ps_value_clone(method)))) {
            release_render(render);
            return internal_error();
        }
    }
    return NULL;
}

ps_result ps_form_render_html(const ps_form *form, const ps_value *options)
{
    if (!form) return (ps_result){NULL, input_error("Form is not initialized")};
    ps_form_render render;
    ps_value *error = render_model(form, options, &render);
    if (error) return (ps_result){NULL, error};
    const ps_form_messages *messages = ps_form_messages_for(form_language(form));
    ps_value *buttons = ps_bind_buttons(form->template, form->data, form_language(form));
    ps_chars description = ps_translate(member(form->template, "description"), form_language(form));
    ps_chars html = buttons && messages && description.bytes
        ? ps_render_form(form->fields, buttons, messages->form_actions, &render, ps_view(description)) : (ps_chars){NULL, 0};
    ps_value_free(buttons);
    free(description.bytes);
    release_render(&render);
    ps_value *value = ps_chars_value(html);
    return value ? ps_ok(value) : (ps_result){NULL, internal_error()};
}

ps_result ps_form_read(const ps_form *form, uint8_t member_index)
{
    if (!form) return (ps_result){NULL, input_error("Form is not initialized")};
    const ps_form_messages *messages = ps_form_messages_for(form_language(form));
    if (member_index == 0) return ps_ok(ps_value_clone(form->template));
    if (member_index == 1) return ps_ok(ps_value_clone(form->data));
    if (member_index == 2) return ps_ok(ps_value_clone(form->fields));
    if (member_index == 3) return ps_ok(ps_int_value(form->revision));
    if (member_index == 5 || member_index == 6) {
        ps_value *value = member_index == 5
            ? ps_bind_buttons(form->template, form->data, form_language(form))
            : messages ? ps_form_messages_value(messages) : NULL;
        return value ? ps_ok(value) : (ps_result){NULL, internal_error()};
    }
    if (member_index == 7) {
        /* The template's root description translated for the instance language. */
        ps_value *value = ps_chars_value(ps_translate(member(form->template, "description"), form_language(form)));
        return value ? ps_ok(value) : (ps_result){NULL, internal_error()};
    }
    if (member_index == 4) {
        ps_value *buttons = ps_bind_buttons(form->template, form->data, form_language(form));
        ps_chars description = ps_translate(member(form->template, "description"), form_language(form));
        ps_chars html = buttons && messages && description.bytes
            ? ps_render_form(form->fields, buttons, messages->form_actions, NULL, ps_view(description)) : (ps_chars){NULL, 0};
        ps_value_free(buttons);
        free(description.bytes);
        ps_value *value = ps_chars_value(html);
        return value ? ps_ok(value) : (ps_result){NULL, internal_error()};
    }
    return (ps_result){NULL, input_error("Unknown form member")};
}

static const ps_value *argument(const ps_value *args, size_t index, ps_value **error)
{
    if (!args || args->kind != PS_ARRAY || index >= ps_size(args)) {
        *error = input_error("Missing form argument");
        return NULL;
    }
    return ps_at(args, index);
}

/* A string argument; NULL bytes with *error set when it is missing or not a string. */
static ps_text string_argument(const ps_value *args, size_t index, ps_value **error)
{
    const ps_value *value = argument(args, index, error);
    if (!value) return (ps_text){NULL, 0};
    if (value->kind != PS_STRING) {
        *error = input_error("Expected a string");
        return (ps_text){NULL, 0};
    }
    return ps_string(value);
}

ps_result ps_form_apply(ps_form *form, uint8_t method, const ps_value *args)
{
    if (!form) return (ps_result){NULL, input_error("Form is not initialized")};
    ps_value *error = NULL;
    if (!args || args->kind != PS_ARRAY)
        return (ps_result){NULL, input_error("Expected an argument array")};
    if (method == 0) {
        ps_text source = string_argument(args, 0, &error);
        if (error) return (ps_result){NULL, error};
        form_path path = checked_path(source, &error);
        if (error) return (ps_result){NULL, error};
        const ps_value *value = ps_path_segments(form->data, path.items, path.length);
        free_path(&path);
        return ps_ok(value ? ps_value_clone(value) : ps_null_value());
    }
    if (method == 1) {
        const ps_value *data = argument(args, 0, &error);
        if (!data) return (ps_result){NULL, error};
        return replace_data(form, data);
    }
    if (method == 2) {
        ps_text source = string_argument(args, 0, &error);
        const ps_value *value = error ? NULL : argument(args, 1, &error);
        if (error) return (ps_result){NULL, error};
        form_path path = checked_path(source, &error);
        if (error) return (ps_result){NULL, error};
        ps_value *updated = put_at(form->data, path.items, path.length, value);
        ps_chars dotted = updated ? dotted_path(&path) : (ps_chars){NULL, 0};
        free_path(&path);
        if (!updated || !dotted.bytes) {
            ps_value_free(updated);
            free(dotted.bytes);
            return (ps_result){NULL, internal_error()};
        }
        ps_value *normalized = normalize_fields(member(form->template, "fields"), updated, PS_TEXT(""), false, &error);
        ps_value_free(updated);
        if (!normalized) {
            free(dotted.bytes);
            return (ps_result){NULL, error ? error : internal_error()};
        }
        ps_value *edited = ps_chars_value(dotted);
        if (!edited) {
            ps_value_free(normalized);
            return (ps_result){NULL, internal_error()};
        }
        ps_result saved = commit(form, normalized, NULL, edited);
        ps_value_free(edited);
        return saved;
    }
    if (method == 3) {
        ps_text source = string_argument(args, 0, &error);
        const ps_value *options = error ? NULL : argument(args, 1, &error);
        return error ? (ps_result){NULL, error} : add_row(form, source, options);
    }
    if (method == 4) {
        ps_text source = string_argument(args, 0, &error);
        ps_text key = error ? source : string_argument(args, 1, &error);
        const ps_value *options = error ? NULL : argument(args, 2, &error);
        return error ? (ps_result){NULL, error} : copy_row(form, source, key, options);
    }
    if (method == 5) {
        ps_text source = string_argument(args, 0, &error);
        ps_text key = error ? source : string_argument(args, 1, &error);
        return error ? (ps_result){NULL, error} : remove_row(form, source, key);
    }
    if (method == 6) {
        ps_text source = string_argument(args, 0, &error);
        ps_text key = error ? source : string_argument(args, 1, &error);
        const ps_value *position = error ? NULL : argument(args, 2, &error);
        if (!error && position->kind != PS_INT) error = input_error("Invalid row position");
        return error ? (ps_result){NULL, error}
                     : move_row(form, source, key, position->data.integer);
    }
    if (method == 7) {
        ps_text source = string_argument(args, 0, &error);
        ps_text old_key = error ? source : string_argument(args, 1, &error);
        ps_text new_key = error ? source : string_argument(args, 2, &error);
        return error ? (ps_result){NULL, error}
                     : rekey_row(form, source, old_key, new_key);
    }
    if (method == 8) {
        ps_text source = string_argument(args, 0, &error);
        ps_text key = error ? source : string_argument(args, 1, &error);
        return error ? (ps_result){NULL, error} : toggle_row(form, source, key);
    }
    if (method == 9) {
        const ps_value *expanded = argument(args, 0, &error);
        return expanded ? set_all_expanded(form, expanded) : (ps_result){NULL, error};
    }
    if (method == 10) return step_form(form, true);
    if (method == 11) return step_form(form, false);
    if (method == 12) return ps_can_undo(form->history);
    if (method == 13) return ps_can_redo(form->history);
    return (ps_result){NULL, input_error("Unknown form operation")};
}
