#include "engine_internal.h"

#include <math.h>
#include <stdlib.h>

/*
 * Choices from a repeated group (docs/spec/schema.md, "Choices from a repeated group"): a choice
 * field whose items object holds the member from takes its choices from the rows of a repeated
 * group of the same form. The declaration check is shared by the generator and the validator.
 */

/* The field types that take a group source: exact type strings. */
static bool choice_type(const ps_value *type)
{
    static const char *const types[] = {
        "select", "dropdown", "selectbox", "choice", "radio", "multichoice", "checkboxes", "checkcontainer",
    };
    for (size_t i = 0; i < sizeof(types) / sizeof(types[0]); ++i)
        if (ps_is_string(type, types[i])) return true;
    return false;
}

bool ps_is_group_source(const ps_value *items)
{
    return items && items->kind == PS_OBJECT && ps_has(items, "from");
}

/* Split text at every dot, empty segments included, as the declaration names them. */
static bool split_dots(ps_text text, ps_text **parts, size_t *count)
{
    size_t total = 1;
    for (size_t i = 0; i < text.length; ++i)
        if (text.bytes[i] == '.') total++;
    ps_text *list = malloc(total * sizeof(*list));
    if (!list) return false;
    size_t start = 0, n = 0;
    for (size_t i = 0; i <= text.length; ++i) {
        if (i == text.length || text.bytes[i] == '.') {
            list[n++] = ps_text_slice(text, start, i);
            start = i + 1;
        }
    }
    *parts = list;
    *count = n;
    return true;
}

/*
 * The properties of the repeated group that the names lead to from the root properties, or NULL:
 * every name is a group field with properties, only the last one is repeated.
 */
static const ps_value *source_scope(const ps_value *root, const ps_text *names, size_t count)
{
    const ps_value *scope = root;
    for (size_t i = 0; i < count; ++i) {
        const ps_value *field = names[i].length ? ps_get_text(scope, names[i]) : NULL;
        if (!field || field->kind != PS_OBJECT || !ps_is_string(ps_get(field, "type"), "group")) return NULL;
        const ps_value *children = ps_get(field, "properties");
        if (!children || children->kind != PS_OBJECT) return NULL;
        if (repeated_declaration(ps_get(field, "multiple")) != (i == count - 1)) return NULL;
        scope = children;
    }
    return scope;
}

/* Whether the scalar child of a group is of a type that stores a boolean, checkbox or switcher (CUSC-068). */
static bool holds_boolean(const ps_value *child)
{
    const ps_value *type = ps_get(child, "type");
    return ps_is_string(type, "checkbox") || ps_is_string(type, "switcher");
}

static int literal_choices(const ps_value *choices, ps_value **literal);
static int first_repeat(const ps_value *items, const ps_value *data, bool rows_too, ps_chars *message);

static int failure(ps_chars *message, ps_chars text)
{
    *message = text;
    return text.bytes ? 1 : -1;
}

int ps_group_source_failure(const ps_value *field, ps_text path, const ps_value *root, ps_chars *message)
{
    *message = (ps_chars){NULL, 0};
    const ps_value *items = ps_get(field, "items");
    if (!ps_is_group_source(items)) return 0;
    for (size_t i = 0; i < ps_size(items); ++i) {
        ps_text key = ps_key(items, i);
        if (!ps_text_is(key, "from") && !ps_text_is(key, "label") && !ps_text_is(key, "choices"))
            return failure(message, PS_CONCAT(PS_TEXT("Invalid items."), key, PS_TEXT(" at "), path,
                                              PS_TEXT(": unknown key")));
    }
    if (!choice_type(ps_get(field, "type")) || enabled_declaration(ps_get(field, "lang")))
        return failure(message, PS_CONCAT(PS_TEXT("Invalid items.from at "), path,
                                          PS_TEXT(": expected a choice field without lang")));
    const ps_value *from = ps_get(items, "from");
    const ps_value *group = NULL;
    bool valid = false;
    ps_text *parts = NULL;
    size_t count = 0;
    ps_text value_name = {NULL, 0};
    if (from->kind == PS_STRING) {
        if (!split_dots(ps_string(from), &parts, &count)) return -1;
        if (count >= 3 && ps_text_is(parts[count - 2], "*")) {
            group = source_scope(root, parts, count - 2);
            value_name = parts[count - 1];
            valid = group && scalar_child(ps_get_text(group, value_name));
        }
    }
    free(parts);
    if (!valid)
        return failure(message, PS_CONCAT(PS_TEXT("Invalid items.from at "), path,
            PS_TEXT(": expected {group}.*.{field} for a field of a repeated group outside repeated groups")));
    /* from is {group}.*.{value}: the declaration path of the group is the text before ".*.". */
    ps_text group_path = ps_text_slice(ps_string(from), 0, ps_string(from).length - value_name.length - 3);
    if (holds_boolean(ps_get_text(group, value_name)))
        return failure(message, PS_CONCAT(PS_TEXT("Invalid items.from at "), path, PS_TEXT(": "), group_path,
            PS_TEXT("."), value_name, PS_TEXT(" holds a boolean, expected a field whose values are strings or numbers")));
    if (ps_has(items, "label")) {
        const ps_value *label = ps_get(items, "label");
        if (label->kind != PS_STRING || !scalar_child(ps_get_text(group, ps_string(label))))
            return failure(message, PS_CONCAT(PS_TEXT("Invalid items.label at "), path,
                PS_TEXT(": expected the name of a direct child field of the group without multiple, properties or lang")));
        if (holds_boolean(ps_get_text(group, ps_string(label))))
            return failure(message, PS_CONCAT(PS_TEXT("Invalid items.label at "), path, PS_TEXT(": "), group_path,
                PS_TEXT("."), ps_string(label), PS_TEXT(" holds a boolean, expected a field whose values are strings or numbers")));
    }
    if (ps_has(items, "choices")) {
        ps_value *literal = NULL;
        int state = literal_choices(ps_get(items, "choices"), &literal);
        ps_value_free(literal);
        if (state < 0) return -1;
        if (!state)
            return failure(message, PS_CONCAT(PS_TEXT("Invalid items.choices at "), path,
                PS_TEXT(": expected value and label pairs with distinct string or number values")));
    }
    return 0;
}

/*
 * The canonical text of a string or a finite number that is not empty after trimming: 1 with the
 * owned text, 0 for any other value, -1 on allocation failure.
 */
static int choice_text(const ps_value *value, ps_chars *text)
{
    *text = (ps_chars){NULL, 0};
    if (!value || !(value->kind == PS_STRING || value->kind == PS_INT ||
                    (value->kind == PS_FLOAT && isfinite(value->data.number))))
        return 0;
    int state = ps_canonical_text(value, text);
    if (state <= 0) return state;
    if (ps_trim(ps_view(*text)).length == 0) {
        free(text->bytes);
        *text = (ps_chars){NULL, 0};
        return 0;
    }
    return 1;
}

/* Whether a choice of the list already has the value text. */
static bool choice_seen(const ps_value *choices, ps_text value)
{
    for (size_t i = 0; i < ps_size(choices); ++i)
        if (ps_text_equal(value, ps_string(ps_get(ps_at(choices, i), "value")))) return true;
    return false;
}

/* Append a {value, label} choice; the value text and the label node are consumed. */
static bool append_pair(ps_value *choices, ps_chars value, ps_value *label_node)
{
    ps_value *pair = ps_object_value();
    ps_value *value_node = ps_chars_value(value);
    if (!pair || !value_node || !label_node) {
        ps_value_free(pair); ps_value_free(value_node); ps_value_free(label_node);
        return false;
    }
    if (!ps_set(pair, "value", value_node)) { ps_value_free(label_node); ps_value_free(pair); return false; }
    if (!ps_set(pair, "label", label_node)) { ps_value_free(pair); return false; }
    return ps_append(choices, pair);
}

/* Append a {value, label} choice of a row; both texts are consumed. */
static bool append_choice(ps_value *choices, ps_chars value, ps_chars label)
{
    return append_pair(choices, value, ps_chars_value(label));
}

/*
 * The literal choices of a group source (CUSC-089): 1 with the owned array of {value, label} objects in *literal, the
 * value the canonical text; 0 when choices is not a list of {value, label} pairs whose values are strings or finite
 * numbers with distinct canonical texts that are not empty after trimming; -1 on allocation failure. Absent choices
 * give an empty array.
 */
static int literal_choices(const ps_value *choices, ps_value **literal)
{
    *literal = ps_array_value();
    if (!*literal) return -1;
    if (!choices) return 1;
    if (choices->kind != PS_ARRAY) return 0;
    for (size_t i = 0; i < ps_size(choices); ++i) {
        const ps_value *choice = ps_at(choices, i);
        if (!choice || choice->kind != PS_OBJECT || ps_size(choice) != 2 || !ps_has(choice, "value") ||
            !ps_has(choice, "label"))
            return 0;
        ps_chars value = {NULL, 0};
        int state = choice_text(ps_get(choice, "value"), &value);
        if (state <= 0) return state;
        if (choice_seen(*literal, ps_view(value))) { free(value.bytes); return 0; }
        if (!append_pair(*literal, value, ps_value_clone(ps_get(choice, "label")))) return -1;
    }
    return 1;
}

ps_value *ps_group_source_choices(const ps_value *items, const ps_value *data, ps_chars *repeated)
{
    ps_value *choices = NULL;
    ps_text *parts = NULL;
    size_t count = 0;
    if (first_repeat(items, data, false, repeated) != 0) return NULL;
    if (literal_choices(ps_get(items, "choices"), &choices) <= 0) goto fail;
    const ps_value *from = ps_get(items, "from");
    if (from->kind != PS_STRING || !split_dots(ps_string(from), &parts, &count)) goto fail;
    const ps_value *rows = data;
    for (size_t i = 0; rows && i + 2 < count; ++i)
        rows = rows->kind == PS_OBJECT ? ps_get_text(rows, parts[i]) : NULL;
    if (!rows || rows->kind != PS_OBJECT) { free(parts); return choices; }
    ps_text label_name = {NULL, 0};
    const ps_value *label = ps_get(items, "label");
    if (label && label->kind == PS_STRING) label_name = ps_string(label);
    ps_text value_name = parts[count - 1];
    for (size_t r = 0; r < ps_size(rows); ++r) {
        const ps_value *row = ps_at(rows, r);
        if (!row || row->kind != PS_OBJECT) continue;
        ps_chars value = {NULL, 0};
        int state = choice_text(ps_get_text(row, value_name), &value);
        if (state < 0) goto fail;
        if (!state) continue;
        if (choice_seen(choices, ps_view(value))) { free(value.bytes); continue; }
        ps_chars label_text = {NULL, 0};
        if (label_name.bytes && choice_text(ps_get_text(row, label_name), &label_text) < 0) {
            free(value.bytes); goto fail;
        }
        ps_chars label_owned = label_text.bytes ? label_text : ps_copy(ps_view(value));
        if (!label_owned.bytes) { free(value.bytes); goto fail; }
        if (!append_choice(choices, value, label_owned)) goto fail;
    }
    free(parts);
    return choices;
fail:
    free(parts);
    ps_value_free(choices);
    return NULL;
}

/*
 * The message of the first row of a checked group source, in data order, whose choice value is a literal choice
 * (CUSC-089) or, with rows, the value of an earlier row (CUVR-087): 0 when none repeats, 1 with the message in *message,
 * -1 on allocation failure.
 */
static int first_repeat(const ps_value *items, const ps_value *data, bool rows_too, ps_chars *message)
{
    *message = (ps_chars){NULL, 0};
    ps_value *literal = NULL;
    if (literal_choices(ps_get(items, "choices"), &literal) < 0) { ps_value_free(literal); return -1; }
    const ps_value *from = ps_get(items, "from");
    ps_text *parts = NULL;
    size_t count = 0;
    if (!from || from->kind != PS_STRING) { ps_value_free(literal); return 0; }
    if (!split_dots(ps_string(from), &parts, &count)) { ps_value_free(literal); return -1; }
    const ps_value *rows = data;
    for (size_t i = 0; rows && i + 2 < count; ++i)
        rows = rows->kind == PS_OBJECT ? ps_get_text(rows, parts[i]) : NULL;
    if (count < 3 || !rows || rows->kind != PS_OBJECT) { free(parts); ps_value_free(literal); return 0; }
    ps_text value_name = parts[count - 1];
    free(parts);
    /* from is {group}.*.{value}: the declaration path of the group is the text before ".*.". */
    ps_text group_path = ps_text_slice(ps_string(from), 0, ps_string(from).length - value_name.length - 3);
    ps_chars *seen = malloc((ps_size(rows) + 1) * sizeof(*seen));
    if (!seen) { ps_value_free(literal); return -1; }
    size_t seen_count = 0;
    int result = 0;
    for (size_t r = 0; result == 0 && r < ps_size(rows); ++r) {
        const ps_value *row = ps_at(rows, r);
        if (!row || row->kind != PS_OBJECT) continue;
        ps_chars value = {NULL, 0};
        int state = choice_text(ps_get_text(row, value_name), &value);
        if (state < 0) { result = -1; break; }
        if (!state) continue;
        if (choice_seen(literal, ps_view(value))) {
            *message = PS_CONCAT(PS_TEXT("Group source value repeats a literal choice at "), group_path, PS_TEXT("."),
                                 ps_key(rows, r), PS_TEXT("."), value_name, PS_TEXT(": "), ps_view(value));
            free(value.bytes);
            result = message->bytes ? 1 : -1;
            break;
        }
        bool repeated = false;
        for (size_t i = 0; rows_too && !repeated && i < seen_count; ++i)
            repeated = ps_text_equal(ps_view(seen[i]), ps_view(value));
        if (!repeated) { seen[seen_count++] = value; continue; }
        *message = PS_CONCAT(PS_TEXT("Group source value repeats an earlier row: "), ps_view(value), PS_TEXT(" at "),
                             group_path, PS_TEXT("."), ps_key(rows, r), PS_TEXT("."), value_name);
        free(value.bytes);
        result = message->bytes ? 1 : -1;
    }
    for (size_t i = 0; i < seen_count; ++i) free(seen[i].bytes);
    free(seen);
    ps_value_free(literal);
    return result;
}

int ps_group_source_repeat(const ps_value *items, const ps_value *data, ps_chars *message)
{
    return first_repeat(items, data, true, message);
}
