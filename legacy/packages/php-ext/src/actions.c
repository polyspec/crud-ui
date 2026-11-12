/*
 * The form actions of the PHP library (Generator::resolveAction and Generator::runAction, CURT-081 to CURT-091): an action
 * button names an action with its collection path and row key. A run applies the action to a form through ps_form_apply,
 * so a failing operation leaves the form unchanged.
 */
#include "engine_internal.h"

/* The methods of ps_form_apply (form.c) that the actions call. */
enum {
    FORM_GET_VALUE = 0,
    FORM_ADD_ROW = 3,
    FORM_COPY_ROW = 4,
    FORM_REMOVE_ROW = 5,
    FORM_MOVE_ROW = 6,
    FORM_TOGGLE_ROW = 8,
    FORM_SET_ALL_EXPANDED = 9,
    FORM_UNDO = 10,
    FORM_REDO = 11,
};

/* The action names of the PHP library. */
static const char *const action_names[] = {
    "move-up", "move-down", "add-row", "copy-row", "remove-row", "toggle-row", "select-row",
    "expand-all", "collapse-all", "undo", "redo",
};

static ps_result internal_failure(void)
{
    return ps_fail("internal", "INTERNAL_ERROR", "C action operation failed", "");
}

/* An invalid input whose message is owned text, which is freed; an allocation failure is an internal error. */
static ps_result invalid_input(ps_chars message)
{
    if (!message.bytes) return internal_failure();
    ps_result failure = ps_fail_text("form", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""));
    free(message.bytes);
    return failure;
}

static bool known_action(ps_text name)
{
    for (size_t i = 0; i < sizeof(action_names) / sizeof(*action_names); ++i)
        if (ps_text_is(name, action_names[i])) return true;
    return false;
}

/*
 * The text of an action member: NULL bytes when it is absent or null. A value that is no string fails with the message
 * of the PHP library.
 */
static bool action_text(const ps_value *values, const char *name, ps_text *text, ps_result *failure)
{
    const ps_value *value = member(values, name);
    *text = (ps_text){NULL, 0};
    if (!value || value->kind == PS_NULL) return true;
    if (value->kind != PS_STRING) {
        *failure = invalid_input(PS_CONCAT(PS_TEXT("An action "), ps_fixed(name), PS_TEXT(" must be a string")));
        return false;
    }
    *text = ps_string(value);
    return true;
}

/* The result of an action that names an unknown action: the name, or none when it is no string. */
static ps_result unknown_action(ps_text name)
{
    return invalid_input(PS_CONCAT(PS_TEXT("Unknown action: "), name));
}

static ps_result unknown_row(ps_text key)
{
    return invalid_input(PS_CONCAT(PS_TEXT("Unknown row: "), key));
}

/* The focus result {focus: {path, key}}; the key is left out when has_key is false; NULL on allocation failure. */
static ps_value *focus_value(ps_text path, ps_text key, bool has_key)
{
    ps_value *focus = ps_object_value();
    ps_value *result = ps_object_value();
    if (!focus || !result) {
        ps_value_free(focus);
        ps_value_free(result);
        return NULL;
    }
    if (!ps_set(focus, "path", ps_text_value(path))) {
        ps_value_free(focus);
        ps_value_free(result);
        return NULL;
    }
    if (has_key && !ps_set(focus, "key", ps_text_value(key))) {
        ps_value_free(focus);
        ps_value_free(result);
        return NULL;
    }
    if (!ps_set(result, "focus", focus)) {
        ps_value_free(result);
        return NULL;
    }
    return result;
}

/* The focus of a row whose key is the string value of an operation result; the result is consumed. */
static ps_result focus_of_result(ps_text path, ps_result operation)
{
    if (operation.error) return operation;
    if (!operation.value || operation.value->kind != PS_STRING) {
        ps_value_free(operation.value);
        return internal_failure();
    }
    ps_value *focus = focus_value(path, ps_string(operation.value), true);
    ps_value_free(operation.value);
    return focus ? ps_ok(focus) : internal_failure();
}

/* The empty result of an action that moves no focus; the operation result is consumed. */
static ps_result empty_result(ps_result operation)
{
    if (operation.error) return operation;
    ps_value_free(operation.value);
    ps_value *empty = ps_object_value();
    return empty ? ps_ok(empty) : internal_failure();
}

/* The focus after an operation whose result is no value: the key is left out when has_key is false. */
static ps_result focus_result(ps_text path, ps_text key, bool has_key, ps_result operation)
{
    if (operation.error) return operation;
    ps_value_free(operation.value);
    ps_value *focus = focus_value(path, key, has_key);
    return focus ? ps_ok(focus) : internal_failure();
}

/*
 * Apply one form method to the arguments, which the call takes: the form is only changed by a successful operation.
 */
static ps_result apply(ps_form *form, uint8_t method, size_t count, ps_value *values[])
{
    ps_value *args = ps_array_value();
    bool ok = args != NULL;
    for (size_t i = 0; i < count; ++i)
        if (!ps_append(args, values[i])) ok = false;
    if (!ok) {
        ps_value_free(args);
        return internal_failure();
    }
    ps_result result = ps_form_apply(form, method, args);
    ps_value_free(args);
    return result;
}

/* The row object of the collection at path, which the caller frees; a value that is no keyed object fails. */
static ps_value *collection_rows(ps_form *form, ps_text path, ps_result *failure)
{
    ps_value *values[] = {ps_text_value(path)};
    ps_result got = apply(form, FORM_GET_VALUE, 1, values);
    if (got.error) {
        *failure = got;
        return NULL;
    }
    if (!got.value || got.value->kind != PS_OBJECT) {
        ps_value_free(got.value);
        *failure = invalid_input(PS_CONCAT(PS_TEXT("Repeated data must be a keyed object: "), path));
        return NULL;
    }
    return got.value;
}

/* The position of a row key in the keyed object, or SIZE_MAX when it has no such row. */
static size_t row_index(const ps_value *rows, ps_text key)
{
    for (size_t i = 0; i < ps_size(rows); ++i)
        if (ps_text_equal(ps_key(rows, i), key)) return i;
    return SIZE_MAX;
}

ps_result ps_resolve_action(const ps_value *input)
{
    const ps_value *name = member(input, "action");
    if (!name || name->kind != PS_STRING || !known_action(ps_string(name))) return ps_ok(ps_null_value());
    ps_value *target = ps_object_value();
    if (!target || !ps_set(target, "name", ps_text_value(ps_string(name)))) {
        ps_value_free(target);
        return internal_failure();
    }
    static const char *const members[] = {"path", "key"};
    for (size_t i = 0; i < sizeof(members) / sizeof(*members); ++i) {
        ps_text text;
        ps_result failure;
        if (!action_text(input, members[i], &text, &failure)) {
            ps_value_free(target);
            return failure;
        }
        if (text.bytes && text.length && !ps_set(target, members[i], ps_text_value(text))) {
            ps_value_free(target);
            return internal_failure();
        }
    }
    return ps_ok(target);
}

ps_result ps_run_action(ps_form *form, const ps_value *target)
{
    const ps_value *name = member(target, "name");
    if (!name || name->kind != PS_STRING) return unknown_action(PS_TEXT("none"));
    ps_text action = ps_string(name);
    if (!known_action(action)) return unknown_action(action);
    if (ps_text_is(action, "expand-all") || ps_text_is(action, "collapse-all")) {
        ps_value *values[] = {ps_bool_value(ps_text_is(action, "expand-all"))};
        return empty_result(apply(form, FORM_SET_ALL_EXPANDED, 1, values));
    }
    if (ps_text_is(action, "undo")) return empty_result(apply(form, FORM_UNDO, 0, NULL));
    if (ps_text_is(action, "redo")) return empty_result(apply(form, FORM_REDO, 0, NULL));

    ps_text path, key;
    ps_result failure;
    if (!action_text(target, "path", &path, &failure)) return failure;
    if (!action_text(target, "key", &key, &failure)) return failure;
    if (!path.bytes || !path.length) return ps_ok(ps_null_value());

    if (ps_text_is(action, "add-row")) {
        ps_value *options = ps_object_value();
        if (key.bytes && !ps_set(options, "afterKey", ps_text_value(key))) {
            ps_value_free(options);
            return internal_failure();
        }
        ps_value *values[] = {ps_text_value(path), options};
        return focus_of_result(path, apply(form, FORM_ADD_ROW, 2, values));
    }
    if (!key.bytes || !key.length) return ps_ok(ps_null_value());
    if (ps_text_is(action, "copy-row")) {
        ps_value *values[] = {ps_text_value(path), ps_text_value(key), ps_object_value()};
        return focus_of_result(path, apply(form, FORM_COPY_ROW, 3, values));
    }
    if (ps_text_is(action, "toggle-row")) {
        ps_value *values[] = {ps_text_value(path), ps_text_value(key)};
        return empty_result(apply(form, FORM_TOGGLE_ROW, 2, values));
    }
    if (ps_text_is(action, "select-row")) {
        ps_value *focus = focus_value(path, key, true);
        return focus ? ps_ok(focus) : internal_failure();
    }

    ps_value *rows = collection_rows(form, path, &failure);
    if (!rows) return failure;
    size_t index = row_index(rows, key);
    if (index == SIZE_MAX) {
        ps_value_free(rows);
        return unknown_row(key);
    }
    if (ps_text_is(action, "remove-row")) {
        /* The row that receives focus is the previous one, else the next one, else the collection. */
        ps_text neighbour = {NULL, 0};
        if (index > 0) neighbour = ps_key(rows, index - 1);
        else if (index + 1 < ps_size(rows)) neighbour = ps_key(rows, index + 1);
        ps_value *values[] = {ps_text_value(path), ps_text_value(key)};
        ps_result removed = apply(form, FORM_REMOVE_ROW, 2, values);
        ps_result result = removed.error
            ? removed
            : focus_result(path, neighbour, neighbour.bytes != NULL, removed);
        ps_value_free(rows);
        return result;
    }
    /* move-up and move-down */
    int64_t delta = ps_text_is(action, "move-up") ? -1 : 1;
    ps_value *values[] = {ps_text_value(path), ps_text_value(key), ps_int_value((int64_t)index + delta)};
    ps_result moved = apply(form, FORM_MOVE_ROW, 3, values);
    ps_value_free(rows);
    return focus_result(path, key, true, moved);
}
