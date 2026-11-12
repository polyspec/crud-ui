/*
 * The undo history functions of form instances, as History.php: a history is {entries: list, redoEntries: list} with
 * an optional string lastPath. No function changes its argument.
 */
#include "engine_internal.h"

/* The number of records a history keeps in each direction. */
#define HISTORY_LIMIT 100

static const char *const entries_message = "History entries must be a list";
static const char *const redo_message = "History redoEntries must be a list";

static ps_result input_failure(const char *message)
{
    return ps_fail("form", "INVALID_FORM_INPUT", message, "");
}

static ps_result internal_failure(void)
{
    return ps_fail("internal", "INTERNAL_ERROR", "C history operation failed", "");
}

/*
 * The records of one history member: an absent member has none, and a member that is present but not a list
 * fails with message.
 */
static bool records_of(const ps_value *history, const char *name, const char *message,
                       const ps_value **records, ps_result *failure)
{
    *records = NULL;
    if (!ps_has(history, name)) return true;
    const ps_value *value = ps_get(history, name);
    if (value->kind != PS_ARRAY) {
        *failure = input_failure(message);
        return false;
    }
    *records = value;
    return true;
}

/* The first index that a list of count records keeps: the last HISTORY_LIMIT records stay. */
static size_t kept_from(size_t count)
{
    return count > HISTORY_LIMIT ? count - HISTORY_LIMIT : 0;
}

/* A new list of the records from start to end, followed by extra when it is not NULL; NULL on allocation failure. */
static ps_value *copy_records(const ps_value *records, size_t start, size_t end, const ps_value *extra)
{
    ps_value *list = ps_array_value();
    for (size_t i = start; list && i < end; ++i) {
        if (!ps_append(list, ps_value_clone(ps_at(records, i)))) {
            ps_value_free(list);
            return NULL;
        }
    }
    if (list && extra && !ps_append(list, ps_value_clone(extra))) {
        ps_value_free(list);
        return NULL;
    }
    return list;
}

/* A history object {entries, redoEntries}; both lists are taken, and NULL on allocation failure. */
static ps_value *history_object(ps_value *entries, ps_value *redo)
{
    ps_value *object = ps_object_value();
    bool entries_set = ps_set(object, "entries", entries);
    bool redo_set = ps_set(object, "redoEntries", redo);
    if (!entries_set || !redo_set) {
        ps_value_free(object);
        return NULL;
    }
    return object;
}

/* The result {history, value} of an undo or redo; both values are taken. */
static ps_result step_result(ps_value *history, ps_value *value)
{
    ps_value *result = ps_object_value();
    bool history_set = ps_set(result, "history", history);
    bool value_set = ps_set(result, "value", value);
    if (!result || !history_set || !value_set) {
        ps_value_free(result);
        return internal_failure();
    }
    return ps_ok(result);
}

static ps_result bool_result(bool value)
{
    ps_value *boolean = ps_bool_value(value);
    return boolean ? ps_ok(boolean) : internal_failure();
}

ps_result ps_empty_history(void)
{
    ps_value *history = history_object(ps_array_value(), ps_array_value());
    return history ? ps_ok(history) : internal_failure();
}

ps_result ps_record_change(const ps_value *history, const ps_value *previous, const ps_value *path)
{
    const ps_value *entries = NULL;
    ps_result failure = {NULL, NULL};
    if (!records_of(history, "entries", entries_message, &entries, &failure)) return failure;
    if (!path || (path->kind != PS_STRING && path->kind != PS_NULL))
        return input_failure("History path must be a string or null");
    /* A value edit at the path of the last one shares its record. */
    const ps_value *last = ps_get(history, "lastPath");
    bool shares = path->kind == PS_STRING && last && last->kind == PS_STRING &&
        ps_text_equal(ps_string(path), ps_string(last));
    size_t size = ps_size(entries);
    size_t total = shares ? size : size + 1;
    ps_value *list = copy_records(entries, kept_from(total), size, shares ? NULL : previous);
    ps_value *result = history_object(list, ps_array_value());
    if (result && path->kind == PS_STRING && !ps_set(result, "lastPath", ps_value_clone(path))) {
        ps_value_free(result);
        result = NULL;
    }
    return result ? ps_ok(result) : internal_failure();
}

ps_result ps_can_undo(const ps_value *history)
{
    const ps_value *entries = NULL;
    ps_result failure = {NULL, NULL};
    if (!records_of(history, "entries", entries_message, &entries, &failure)) return failure;
    return bool_result(ps_size(entries) != 0);
}

ps_result ps_can_redo(const ps_value *history)
{
    const ps_value *redo = NULL;
    ps_result failure = {NULL, NULL};
    if (!records_of(history, "redoEntries", redo_message, &redo, &failure)) return failure;
    return bool_result(ps_size(redo) != 0);
}

ps_result ps_undo_change(const ps_value *history, const ps_value *current)
{
    const ps_value *entries = NULL, *redo = NULL;
    ps_result failure = {NULL, NULL};
    if (!records_of(history, "entries", entries_message, &entries, &failure)) return failure;
    size_t count = ps_size(entries);
    if (!count) return input_failure("Nothing to undo");
    if (!records_of(history, "redoEntries", redo_message, &redo, &failure)) return failure;
    ps_value *value = ps_value_clone(ps_at(entries, count - 1));
    ps_value *kept = copy_records(entries, 0, count - 1, NULL);
    ps_value *redone = copy_records(redo, kept_from(ps_size(redo) + 1), ps_size(redo), current);
    return step_result(history_object(kept, redone), value);
}

ps_result ps_redo_change(const ps_value *history, const ps_value *current)
{
    const ps_value *entries = NULL, *redo = NULL;
    ps_result failure = {NULL, NULL};
    if (!records_of(history, "redoEntries", redo_message, &redo, &failure)) return failure;
    size_t count = ps_size(redo);
    if (!count) return input_failure("Nothing to redo");
    if (!records_of(history, "entries", entries_message, &entries, &failure)) return failure;
    ps_value *value = ps_value_clone(ps_at(redo, count - 1));
    ps_value *kept = copy_records(redo, 0, count - 1, NULL);
    ps_value *advanced = copy_records(entries, kept_from(ps_size(entries) + 1), ps_size(entries), current);
    return step_result(history_object(advanced, kept), value);
}
