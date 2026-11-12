#include "engine_internal.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    size_t count;
    const char *keys[4];
    int64_t integers[4];
} visit_state;

static bool record(void *context, const uint8_t *key, size_t length,
                   const ps_value *value)
{
    visit_state *state = context;
    int64_t integer = 0;
    double number = 0;
    const uint8_t *text = NULL;
    size_t text_length = 0;
    assert(state->count < 4);
    if (key) {
        assert(length > 0);
        state->keys[state->count] = (const char *)key;
    }
    assert(ps_value_read(value, &integer, &number, &text, &text_length) == PS_INT);
    state->integers[state->count++] = integer;
    return true;
}

static ps_value *integer(int64_t input)
{
    ps_value *value = ps_value_new(PS_NULL);
    assert(value);
    ps_value_int(value, input);
    return value;
}

/*
 * Insert count array index names in descending order and order them. 400,000 members are
 * inserted and ordered within a second; an insertion that compared each name with every earlier
 * one makes 8 * 10^10 comparisons and does not end before the timeout of the test.
 */
static void insert_and_order(size_t count)
{
    ps_value *object = ps_object_value();
    assert(object);
    for (size_t i = 0; i < count; ++i) {
        char key[32]; snprintf(key, sizeof(key), "%zu", count - i);
        assert(ps_set(object, key, integer(1)));
    }
    assert(ps_value_order(object));
    assert(ps_size(object) == count);
    assert(ps_text_is(ps_key(object, 0), "1"));
    char last[32]; snprintf(last, sizeof(last), "%zu", count);
    assert(ps_text_is(ps_key(object, count - 1), last));
    ps_value_free(object);
}

int main(void)
{
    assert(!ps_value_string(NULL, (const uint8_t *)"", 0));
    ps_value_bool(NULL, true);
    ps_value_int(NULL, 1);
    assert(!ps_value_float(NULL, 1.0));
    assert(ps_value_read(NULL, NULL, NULL, NULL, NULL) == UINT8_MAX);

    ps_value *object = ps_value_new(PS_OBJECT);
    assert(object);
    assert(ps_set(object, "first", integer(1)));
    assert(ps_set(object, "second", integer(2)));
    assert(ps_set(object, "first", integer(3)));
    assert(ps_size(object) == 2);

    visit_state state = {0};
    assert(ps_value_visit(object, &state, record));
    assert(state.count == 2);
    assert(!strncmp(state.keys[0], "first", 5));
    assert(!strncmp(state.keys[1], "second", 6));
    assert(state.integers[0] == 3 && state.integers[1] == 2);

    ps_value *copy = ps_value_clone(object);
    assert(copy && ps_equal(copy, object));
    assert(ps_delete_text(copy, PS_TEXT("first")));
    assert(!ps_equal(copy, object));
    assert(ps_has(object, "first"));
    assert(!ps_get(object, NULL));
    assert(!ps_delete_text(object, (ps_text){NULL, 0}));
    ps_value_free(copy);

    ps_value *array = ps_value_new(PS_ARRAY);
    assert(array && ps_append(array, integer(4)) && ps_append(array, integer(5)));
    state = (visit_state){0};
    assert(ps_value_visit(array, &state, record));
    assert(state.count == 2 && !state.keys[0] && !state.keys[1]);
    assert(state.integers[0] == 4 && state.integers[1] == 5);
    ps_value_free(array);

    ps_value *text = ps_value_new(PS_NULL);
    const uint8_t valid[] = {0xed, 0x95, 0x9c, 0xea, 0xb8, 0x80};
    const uint8_t invalid[] = {0xc0, 0xaf};
    assert(ps_value_string(text, valid, sizeof(valid)));
    assert(!ps_value_string(text, invalid, sizeof(invalid)));
    assert(!ps_value_string(text, NULL, 1));
    assert(text->kind == PS_STRING && text->data.string.length == sizeof(valid));
    ps_value_free(text);

    ps_value *number = ps_value_new(PS_NULL);
    assert(number);
    ps_value_int(number, 1);
    ps_value *fraction = ps_value_new(PS_NULL);
    assert(fraction && ps_value_float(fraction, 1.0));
    assert(ps_equal(number, fraction));
    ps_value_free(number);
    ps_value_free(fraction);
    ps_value_free(object);

    /* Specification member order: array index names ascending, then other names in insertion order. */
    ps_value *spec = ps_object_value();
    static const char *const written[] = {"b", "10", "a", "4294967295", "2", "01", "-1", "0", "4294967294"};
    static const char *const expected[] = {"0", "2", "10", "4294967294", "b", "a", "4294967295", "01", "-1"};
    for (size_t i = 0; i < sizeof(written) / sizeof(*written); ++i) {
        ps_value *child = ps_object_value();
        assert(child && ps_set(child, "z", integer(1)) && ps_set(child, "5", integer(2)));
        assert(spec && ps_set(spec, written[i], child));
    }
    ps_value *list = ps_array_value();
    ps_value *row = ps_object_value();
    assert(list && row && ps_set(row, "y", integer(3)) && ps_set(row, "1", integer(4)) && ps_append(list, row));
    assert(ps_append(list, integer(9)) && ps_set(spec, "list", list));
    ps_value *ordered = ps_value_ordered(spec);
    assert(ordered && ps_size(ordered) == 10);
    for (size_t i = 0; i < sizeof(expected) / sizeof(*expected); ++i) {
        assert(ps_text_is(ps_key(ordered, i), expected[i]));
        const ps_value *child = ps_at(ordered, i);
        assert(ps_text_is(ps_key(child, 0), "5") && ps_text_is(ps_key(child, 1), "z"));
    }
    assert(ps_text_is(ps_key(ordered, 9), "list"));
    const ps_value *ordered_list = ps_get(ordered, "list");
    assert(ordered_list->kind == PS_ARRAY && ps_size(ordered_list) == 2);
    assert(ps_text_is(ps_key(ps_at(ordered_list, 0), 0), "1") && ps_text_is(ps_key(ps_at(ordered_list, 0), 1), "y"));
    /* The source is not reordered. */
    assert(ps_text_is(ps_key(spec, 0), "b") && ps_text_is(ps_key(ps_at(spec, 0), 0), "z"));

    /* Options keep their own order and data; only files are ordered. */
    ps_value *options = ps_object_value();
    ps_value *data = ps_object_value();
    ps_value *files = ps_object_value();
    ps_value *file = ps_object_value();
    assert(options && data && files && file);
    assert(ps_set(data, "b", integer(1)) && ps_set(data, "10", integer(2)));
    assert(ps_set(file, "b", integer(1)) && ps_set(file, "10", integer(2)) && ps_set(files, "base.yml", file));
    assert(ps_set(options, "data", data) && ps_set(options, "files", files));
    ps_value *ordered_spec = NULL, *ordered_options = NULL;
    assert(ps_order_specification(spec, options, &ordered_spec, &ordered_options));
    assert(ps_equal(ordered_spec, ordered));
    assert(ps_text_is(ps_key(ps_get(ordered_options, "data"), 0), "b"));
    assert(ps_text_is(ps_key(ps_get(ps_get(ordered_options, "files"), "base.yml"), 0), "10"));
    ps_value *absent_spec = NULL;
    assert(ps_order_specification(NULL, NULL, &absent_spec, NULL) && !absent_spec);
    ps_value_free(ordered_spec); ps_value_free(ordered_options);
    ps_value_free(options); ps_value_free(ordered); ps_value_free(spec);

    /* A NUL character is an ordinary character of values and keys; only well-formed UTF-8 is text. */
    const uint8_t nul_value[] = {'a', 0, 'b'};
    const uint8_t overlong_nul[] = {0xc0, 0x80};
    ps_value *nul_text = ps_value_new(PS_NULL);
    assert(nul_text && ps_value_string(nul_text, nul_value, sizeof(nul_value)));
    assert(ps_text_equal(ps_string(nul_text), ((ps_text){"a\0b", 3})));
    assert(!ps_text_equal(ps_string(nul_text), PS_TEXT("a")));
    assert(!ps_value_string(nul_text, overlong_nul, sizeof(overlong_nul)));
    ps_value *keyed = ps_object_value();
    assert(keyed && ps_set_text(keyed, (ps_text){"k\0x", 3}, integer(1)));
    assert(ps_set_text(keyed, (ps_text){"k\0y", 3}, integer(2)));
    assert(ps_set_text(keyed, PS_TEXT("k"), integer(3)));
    assert(ps_size(keyed) == 3);
    assert(ps_get_text(keyed, (ps_text){"k\0y", 3})->data.integer == 2);
    assert(ps_get_text(keyed, PS_TEXT("k"))->data.integer == 3);
    assert(!ps_get_text(keyed, (ps_text){"k\0z", 3}));
    assert(!ps_value_insert(keyed, overlong_nul, sizeof(overlong_nul), integer(4)));
    ps_value *keyed_copy = ps_value_clone(keyed);
    assert(keyed_copy && ps_equal(keyed, keyed_copy));
    assert(ps_delete_text(keyed_copy, (ps_text){"k\0x", 3}) && ps_size(keyed_copy) == 2);
    assert(!ps_equal(keyed, keyed_copy));
    ps_value_free(keyed_copy); ps_value_free(keyed); ps_value_free(nul_text);

    /* Many members: every name is found, a repeated name keeps its position, and order holds. */
    ps_value *many = ps_object_value();
    assert(many);
    for (size_t i = 0; i < 1000; ++i) {
        char key[32]; snprintf(key, sizeof(key), i % 2 ? "%zu" : "name%zu", 999 - i);
        assert(ps_set(many, key, integer((int64_t)i)));
    }
    assert(ps_set(many, "name999", integer(-1)) && ps_size(many) == 1000);
    assert(ps_text_is(ps_key(many, 0), "name999") && ps_get(many, "name999")->data.integer == -1);
    assert(ps_value_order(many));
    assert(ps_text_is(ps_key(many, 0), "0") && ps_text_is(ps_key(many, 499), "998"));
    assert(ps_text_is(ps_key(many, 500), "name999"));
    for (size_t i = 1; i < 1000; ++i) {
        char key[32]; snprintf(key, sizeof(key), i % 2 ? "%zu" : "name%zu", 999 - i);
        assert(ps_get(many, key) && ps_get(many, key)->data.integer == (int64_t)i);
    }
    assert(ps_delete_text(many, PS_TEXT("0")) && !ps_get(many, "0") && ps_size(many) == 999);
    assert(ps_get(many, "998")->data.integer == 1 && ps_get(many, "name1")->data.integer == 998);
    ps_value *many_copy = ps_value_clone(many);
    assert(many_copy && ps_equal(many, many_copy) && ps_get(many_copy, "name1")->data.integer == 998);
    ps_value_free(many_copy); ps_value_free(many);

    insert_and_order(400000);
    return 0;
}
