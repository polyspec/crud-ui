#include "engine_internal.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

static bool valid_utf8(const uint8_t *input, size_t length)
{
    if (!input && length) return false;
    size_t i = 0;
    while (i < length) {
        uint8_t byte = input[i++];
        if (byte < 0x80) continue;
        size_t continuation;
        uint32_t code;
        if (byte >= 0xc2 && byte <= 0xdf) { continuation = 1; code = byte & 0x1f; }
        else if (byte >= 0xe0 && byte <= 0xef) { continuation = 2; code = byte & 0x0f; }
        else if (byte >= 0xf0 && byte <= 0xf4) { continuation = 3; code = byte & 0x07; }
        else return false;
        if (i + continuation > length) return false;
        for (size_t j = 0; j < continuation; ++j) {
            uint8_t next = input[i++];
            if ((next & 0xc0) != 0x80) return false;
            code = (code << 6) | (next & 0x3f);
        }
        if ((continuation == 2 && code < 0x800) ||
            (continuation == 3 && code < 0x10000) ||
            code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return false;
    }
    return true;
}

bool ps_text_valid(const uint8_t *input, size_t length)
{
    return valid_utf8(input, length);
}

static char *copy_bytes(const uint8_t *input, size_t length)
{
    char *copy = malloc(length + 1);
    if (!copy) return NULL;
    if (length) memcpy(copy, input, length);
    copy[length] = '\0';
    return copy;
}

ps_value *ps_value_new(uint8_t kind)
{
    ps_value *value = calloc(1, sizeof(*value));
    if (!value) return NULL;
    value->kind = kind == PS_ARRAY || kind == PS_OBJECT ? kind : PS_NULL;
    return value;
}

static void clear_value(ps_value *value)
{
    if (!value) return;
    if (value->kind == PS_STRING) free(value->data.string.bytes);
    if (value->kind == PS_ARRAY || value->kind == PS_OBJECT) {
        for (size_t i = 0; i < value->data.children.length; ++i) {
            free(value->data.children.items[i].key);
            ps_value_free(value->data.children.items[i].value);
        }
        free(value->data.children.items);
        free(value->data.children.slots);
    }
    memset(&value->data, 0, sizeof(value->data));
}

void ps_value_free(ps_value *value)
{
    clear_value(value);
    free(value);
}

void ps_value_bool(ps_value *value, bool input)
{
    if (!value) return;
    clear_value(value); value->kind = PS_BOOL; value->data.boolean = input;
}

void ps_value_int(ps_value *value, int64_t input)
{
    if (!value) return;
    clear_value(value); value->kind = PS_INT; value->data.integer = input;
}

bool ps_value_float(ps_value *value, double input)
{
    if (!value || !isfinite(input)) return false;
    clear_value(value); value->kind = PS_FLOAT; value->data.number = input; return true;
}

bool ps_value_string(ps_value *value, const uint8_t *input, size_t length)
{
    if (!value || !valid_utf8(input, length)) return false;
    char *copy = copy_bytes(input, length);
    if (!copy) return false;
    clear_value(value); value->kind = PS_STRING;
    value->data.string.bytes = copy; value->data.string.length = length; return true;
}

static bool reserve(ps_value *value)
{
    if (value->data.children.length < value->data.children.capacity) return true;
    size_t capacity = value->data.children.capacity ? value->data.children.capacity * 2 : 4;
    if (capacity > SIZE_MAX / sizeof(ps_member)) return false;
    ps_member *items = realloc(value->data.children.items, capacity * sizeof(*items));
    if (!items) return false;
    value->data.children.items = items; value->data.children.capacity = capacity; return true;
}

/* An object with at least this many members finds a name through its index instead of a scan. */
#define INDEXED_MEMBERS 16

/* FNV-1a over the name bytes. */
static size_t name_hash(const char *key, size_t length)
{
    uint64_t hash = UINT64_C(14695981039346656037);
    for (size_t i = 0; i < length; ++i) hash = (hash ^ (uint8_t)key[i]) * UINT64_C(1099511628211);
    return (size_t)hash;
}

static void index_member(ps_value *object, size_t position)
{
    const ps_member *member = &object->data.children.items[position];
    size_t mask = object->data.children.slot_count - 1;
    size_t slot = name_hash(member->key, member->key_length) & mask;
    while (object->data.children.slots[slot]) slot = (slot + 1) & mask;
    object->data.children.slots[slot] = position + 1;
}

/*
 * Rebuild the index of an object's members with room for four times as many; without memory for
 * it, names are found by scanning.
 */
void ps_value_reindex(ps_value *object)
{
    if (!object || object->kind != PS_OBJECT) return;
    free(object->data.children.slots);
    object->data.children.slots = NULL;
    object->data.children.slot_count = 0;
    size_t length = object->data.children.length, count = INDEXED_MEMBERS * 4;
    if (length < INDEXED_MEMBERS) return;
    while (count < length * 4) {
        if (count > SIZE_MAX / 2 / sizeof(size_t)) return;
        count *= 2;
    }
    size_t *slots = calloc(count, sizeof(*slots));
    if (!slots) return;
    object->data.children.slots = slots;
    object->data.children.slot_count = count;
    for (size_t i = 0; i < length; ++i) index_member(object, i);
}

static size_t member_index(const ps_value *object, const char *key, size_t length)
{
    if (!object || object->kind != PS_OBJECT || !key) return SIZE_MAX;
    const size_t *slots = object->data.children.slots;
    if (slots) {
        size_t mask = object->data.children.slot_count - 1;
        for (size_t slot = name_hash(key, length) & mask; slots[slot]; slot = (slot + 1) & mask) {
            const ps_member *member = &object->data.children.items[slots[slot] - 1];
            if (member->key_length == length && !memcmp(member->key, key, length)) return slots[slot] - 1;
        }
        return SIZE_MAX;
    }
    for (size_t i = 0; i < object->data.children.length; ++i) {
        const ps_member *member = &object->data.children.items[i];
        if (member->key_length == length && !memcmp(member->key, key, length)) return i;
    }
    return SIZE_MAX;
}

bool ps_value_insert(ps_value *parent, const uint8_t *key, size_t length, ps_value *child)
{
    if (!parent || !child) { ps_value_free(child); return false; }
    if (parent->data.children.length && !parent->data.children.items) {
        ps_value_free(child); return false;
    }
    if (parent->kind == PS_ARRAY && !key) {
        if (!reserve(parent)) { ps_value_free(child); return false; }
        parent->data.children.items[parent->data.children.length++] = (ps_member){NULL, 0, child};
        return true;
    }
    if (parent->kind != PS_OBJECT || !key || !valid_utf8(key, length)) {
        ps_value_free(child); return false;
    }
    size_t index = member_index(parent, (const char *)key, length);
    if (index != SIZE_MAX) {
        ps_value_free(parent->data.children.items[index].value);
        parent->data.children.items[index].value = child;
        return true;
    }
    char *copy = copy_bytes(key, length);
    if (!copy || !reserve(parent)) { free(copy); ps_value_free(child); return false; }
    size_t position = parent->data.children.length++;
    parent->data.children.items[position] = (ps_member){copy, length, child};
    /* The index stays at most half full. */
    if (parent->data.children.slots && position * 2 < parent->data.children.slot_count)
        index_member(parent, position);
    else if (position + 1 >= INDEXED_MEMBERS) ps_value_reindex(parent);
    return true;
}

uint8_t ps_value_read(const ps_value *value, int64_t *integer, double *number,
                      const uint8_t **text, size_t *length)
{
    if (!value) return UINT8_MAX;
    switch (value->kind) {
        case PS_BOOL: if (integer) *integer = value->data.boolean; break;
        case PS_INT: if (integer) *integer = value->data.integer; break;
        case PS_FLOAT: if (number) *number = value->data.number; break;
        case PS_STRING:
            if (text) *text = (const uint8_t *)value->data.string.bytes;
            if (length) *length = value->data.string.length;
            break;
        default: break;
    }
    return value->kind;
}

bool ps_value_visit(const ps_value *value, void *context, ps_visitor visitor)
{
    if (!value || !visitor ||
        (value->kind != PS_ARRAY && value->kind != PS_OBJECT)) return false;
    for (size_t i = 0; i < value->data.children.length; ++i) {
        const ps_member *member = &value->data.children.items[i];
        const uint8_t *key = value->kind == PS_OBJECT ? (const uint8_t *)member->key : NULL;
        if (!visitor(context, key, value->kind == PS_OBJECT ? member->key_length : 0, member->value)) return false;
    }
    return true;
}

ps_value *ps_value_clone(const ps_value *value)
{
    if (!value || value->kind > PS_OBJECT) return NULL;
    ps_value *copy = ps_value_new(value->kind);
    if (!copy) return NULL;
    switch (value->kind) {
        case PS_BOOL: ps_value_bool(copy, value->data.boolean); break;
        case PS_INT: ps_value_int(copy, value->data.integer); break;
        case PS_FLOAT: if (!ps_value_float(copy, value->data.number)) goto fail; break;
        case PS_STRING:
            if (!ps_value_string(copy, (const uint8_t *)value->data.string.bytes, value->data.string.length)) goto fail;
            break;
        case PS_ARRAY: case PS_OBJECT:
            for (size_t i = 0; i < value->data.children.length; ++i) {
                const ps_member *member = &value->data.children.items[i];
                ps_value *child = ps_value_clone(member->value);
                if (!child || !ps_value_insert(copy, value->kind == PS_OBJECT ? (const uint8_t *)member->key : NULL, member->key_length, child)) goto fail;
            }
            break;
        default: break;
    }
    return copy;
fail:
    ps_value_free(copy); return NULL;
}

/* An array index member name: a canonical decimal integer from 0 to 4294967294. */
static bool array_index_name(const char *key, size_t length, uint64_t *index)
{
    if (!key || !length || length > 10 || (length > 1 && key[0] == '0')) return false;
    uint64_t number = 0;
    for (size_t i = 0; i < length; ++i) {
        if (key[i] < '0' || key[i] > '9') return false;
        number = number * 10 + (uint64_t)(key[i] - '0');
    }
    if (number > UINT64_C(4294967294)) return false;
    *index = number;
    return true;
}

typedef struct { uint64_t index; ps_member member; } index_member_name;

static int compare_index_names(const void *left, const void *right)
{
    uint64_t a = ((const index_member_name *)left)->index, b = ((const index_member_name *)right)->index;
    return (a > b) - (a < b);
}

bool ps_value_order(ps_value *value)
{
    if (!value || (value->kind != PS_ARRAY && value->kind != PS_OBJECT)) return true;
    size_t length = value->data.children.length;
    ps_member *items = value->data.children.items;
    if (value->kind == PS_OBJECT && length > 1) {
        index_member_name *named = malloc(length * sizeof(*named));
        ps_member *others = malloc(length * sizeof(*others));
        if (!named || !others) { free(named); free(others); return false; }
        size_t count = 0, other = 0;
        for (size_t i = 0; i < length; ++i) {
            uint64_t index;
            if (array_index_name(items[i].key, items[i].key_length, &index)) named[count++] = (index_member_name){index, items[i]};
            else others[other++] = items[i];
        }
        /* Array index names in ascending numeric order; names are distinct, so no two compare equal. */
        qsort(named, count, sizeof(*named), compare_index_names);
        for (size_t i = 0; i < count; ++i) items[i] = named[i].member;
        /* Then every other name in insertion order. */
        memcpy(items + count, others, other * sizeof(*items));
        free(named); free(others);
        ps_value_reindex(value);
    }
    for (size_t i = 0; i < length; ++i)
        if (!ps_value_order(items[i].value)) return false;
    return true;
}

ps_value *ps_value_ordered(const ps_value *value)
{
    ps_value *copy = ps_value_clone(value);
    if (copy && !ps_value_order(copy)) { ps_value_free(copy); return NULL; }
    return copy;
}

bool ps_order_specification(const ps_value *spec, const ps_value *options,
                            ps_value **ordered_spec, ps_value **ordered_options)
{
    *ordered_spec = NULL;
    if (ordered_options) *ordered_options = NULL;
    if (spec && !(*ordered_spec = ps_value_ordered(spec))) return false;
    if (!ordered_options || !options) return true;
    if (!(*ordered_options = ps_value_clone(options))) goto fail;
    if (options->kind == PS_OBJECT) {
        ps_value *files = ps_get_mut(*ordered_options, "files");
        if (files && !ps_value_order(files)) goto fail;
    }
    return true;
fail:
    ps_value_free(*ordered_spec); *ordered_spec = NULL;
    ps_value_free(*ordered_options); *ordered_options = NULL;
    return false;
}

const ps_value *ps_get_text(const ps_value *value, ps_text key)
{
    if (!key.bytes) return NULL;
    size_t index = member_index(value, key.bytes, key.length);
    return index == SIZE_MAX ? NULL : value->data.children.items[index].value;
}

ps_value *ps_get_mut_text(ps_value *value, ps_text key)
{
    return (ps_value *)ps_get_text(value, key);
}

bool ps_has_text(const ps_value *value, ps_text key) { return ps_get_text(value, key) != NULL; }

bool ps_set_text(ps_value *object, ps_text key, ps_value *value)
{
    if (!key.bytes) { ps_value_free(value); return false; }
    return ps_value_insert(object, (const uint8_t *)key.bytes, key.length, value);
}

bool ps_delete_text(ps_value *object, ps_text key)
{
    if (!key.bytes) return false;
    size_t index = member_index(object, key.bytes, key.length);
    if (index == SIZE_MAX) return false;
    ps_member *member = &object->data.children.items[index];
    free(member->key); ps_value_free(member->value);
    memmove(member, member + 1, (object->data.children.length - index - 1) * sizeof(*member));
    object->data.children.length--;
    ps_value_reindex(object);
    return true;
}

const ps_value *ps_get(const ps_value *value, const char *key)
{
    return key ? ps_get_text(value, ps_fixed(key)) : NULL;
}

ps_value *ps_get_mut(ps_value *value, const char *key)
{
    return (ps_value *)ps_get(value, key);
}

bool ps_has(const ps_value *value, const char *key) { return ps_get(value, key) != NULL; }

bool ps_set(ps_value *object, const char *key, ps_value *value)
{
    if (!key) { ps_value_free(value); return false; }
    return ps_set_text(object, ps_fixed(key), value);
}

size_t ps_size(const ps_value *value) { return value && (value->kind == PS_ARRAY || value->kind == PS_OBJECT) ? value->data.children.length : 0; }
const ps_value *ps_at(const ps_value *value, size_t index) { return index < ps_size(value) ? value->data.children.items[index].value : NULL; }

ps_text ps_key(const ps_value *value, size_t index)
{
    if (!value || value->kind != PS_OBJECT || index >= ps_size(value)) return PS_TEXT("");
    const ps_member *member = &value->data.children.items[index];
    return (ps_text){member->key, member->key_length};
}

bool ps_append(ps_value *array, ps_value *value) { return ps_value_insert(array, NULL, 0, value); }

bool ps_equal(const ps_value *left, const ps_value *right)
{
    if (left == right) return true;
    if (!left || !right || left->kind != right->kind) {
        if (left && right && (left->kind == PS_INT || left->kind == PS_FLOAT) &&
            (right->kind == PS_INT || right->kind == PS_FLOAT)) {
            double a = left->kind == PS_INT ? (double)left->data.integer : left->data.number;
            double b = right->kind == PS_INT ? (double)right->data.integer : right->data.number;
            return a == b;
        }
        return false;
    }
    switch (left->kind) {
        case PS_NULL: return true;
        case PS_BOOL: return left->data.boolean == right->data.boolean;
        case PS_INT: return left->data.integer == right->data.integer;
        case PS_FLOAT: return left->data.number == right->data.number;
        case PS_STRING: return left->data.string.length == right->data.string.length && !memcmp(left->data.string.bytes, right->data.string.bytes, left->data.string.length);
        case PS_ARRAY: case PS_OBJECT:
            if (ps_size(left) != ps_size(right)) return false;
            for (size_t i = 0; i < ps_size(left); ++i) {
                if (left->kind == PS_OBJECT && !ps_text_equal(ps_key(left, i), ps_key(right, i))) return false;
                if (!ps_equal(ps_at(left, i), ps_at(right, i))) return false;
            }
            return true;
        default: return false;
    }
}

bool ps_is_string(const ps_value *value, const char *text)
{
    return value && value->kind == PS_STRING && text &&
        strlen(text) == value->data.string.length &&
        !memcmp(value->data.string.bytes, text, value->data.string.length);
}
ps_text ps_string(const ps_value *value)
{
    if (!value || value->kind != PS_STRING) return PS_TEXT("");
    return (ps_text){value->data.string.bytes, value->data.string.length};
}
bool ps_truthy(const ps_value *value)
{
    if (!value) return false;
    switch (value->kind) {
        case PS_NULL: return false;
        case PS_BOOL: return value->data.boolean;
        case PS_INT: return value->data.integer != 0;
        case PS_FLOAT: return value->data.number != 0;
        case PS_STRING: return value->data.string.length != 0;
        default: return true;
    }
}

ps_value *ps_null_value(void) { return ps_value_new(PS_NULL); }
ps_value *ps_bool_value(bool input)
{
    ps_value *value = ps_value_new(PS_NULL);
    if (value) ps_value_bool(value, input);
    return value;
}
ps_value *ps_int_value(int64_t input)
{
    ps_value *value = ps_value_new(PS_NULL);
    if (value) ps_value_int(value, input);
    return value;
}
ps_value *ps_float_value(double input)
{
    ps_value *value = ps_value_new(PS_NULL);
    if (!value || !ps_value_float(value, input)) { ps_value_free(value); return NULL; }
    return value;
}
ps_value *ps_text_value(ps_text input)
{
    if (!input.bytes) return NULL;
    ps_value *value = ps_value_new(PS_NULL);
    if (!value || !ps_value_string(value, (const uint8_t *)input.bytes, input.length)) {
        ps_value_free(value); return NULL;
    }
    return value;
}
ps_value *ps_string_value(const char *input)
{
    return input ? ps_text_value(ps_fixed(input)) : NULL;
}
ps_value *ps_chars_value(ps_chars input)
{
    ps_value *value = input.bytes ? ps_text_value(ps_view(input)) : NULL;
    free(input.bytes);
    return value;
}
ps_value *ps_array_value(void) { return ps_value_new(PS_ARRAY); }
ps_value *ps_object_value(void) { return ps_value_new(PS_OBJECT); }
bool ps_replace(ps_value *parent, size_t index, ps_value *value)
{
    if (!parent || !value || (parent->kind != PS_ARRAY && parent->kind != PS_OBJECT) ||
        index >= parent->data.children.length) {
        ps_value_free(value); return false;
    }
    ps_value_free(parent->data.children.items[index].value);
    parent->data.children.items[index].value = value;
    return true;
}

bool ps_text_equal(ps_text left, ps_text right)
{
    return left.length == right.length &&
        (!left.length || !memcmp(left.bytes, right.bytes, left.length));
}

bool ps_text_is(ps_text text, const char *identifier)
{
    return identifier && ps_text_equal(text, ps_fixed(identifier));
}

bool ps_text_starts(ps_text text, const char *prefix)
{
    size_t length = strlen(prefix);
    return text.length >= length && !memcmp(text.bytes, prefix, length);
}

bool ps_text_ends(ps_text text, const char *suffix)
{
    size_t length = strlen(suffix);
    return text.length >= length && !memcmp(text.bytes + text.length - length, suffix, length);
}

size_t ps_text_find_byte(ps_text text, char byte, size_t from)
{
    if (from >= text.length) return SIZE_MAX;
    const char *found = memchr(text.bytes + from, byte, text.length - from);
    return found ? (size_t)(found - text.bytes) : SIZE_MAX;
}

size_t ps_text_find(ps_text text, ps_text needle, size_t from)
{
    if (from > text.length || needle.length > text.length - from) return SIZE_MAX;
    if (!needle.length) return from;
    for (size_t i = from; i + needle.length <= text.length; ++i)
        if (text.bytes[i] == needle.bytes[0] && !memcmp(text.bytes + i, needle.bytes, needle.length))
            return i;
    return SIZE_MAX;
}

ps_text ps_text_slice(ps_text text, size_t start, size_t end)
{
    if (end > text.length) end = text.length;
    if (start > end) start = end;
    return (ps_text){text.bytes + start, end - start};
}

int ps_text_compare(ps_text left, ps_text right)
{
    size_t shared = left.length < right.length ? left.length : right.length;
    int order = shared ? memcmp(left.bytes, right.bytes, shared) : 0;
    if (order) return order;
    return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

ps_chars ps_copy(ps_text text)
{
    return ps_concat(&text, 1);
}

ps_chars ps_concat(const ps_text *parts, size_t count)
{
    size_t length = 0;
    for (size_t i = 0; i < count; ++i) {
        if (!parts[i].bytes && parts[i].length) return (ps_chars){NULL, 0};
        if (parts[i].length > SIZE_MAX - 1 - length) return (ps_chars){NULL, 0};
        length += parts[i].length;
    }
    char *bytes = malloc(length + 1);
    if (!bytes) return (ps_chars){NULL, 0};
    size_t offset = 0;
    for (size_t i = 0; i < count; ++i) {
        if (parts[i].length) memcpy(bytes + offset, parts[i].bytes, parts[i].length);
        offset += parts[i].length;
    }
    bytes[length] = '\0';
    return (ps_chars){bytes, length};
}

ps_chars ps_decimal(size_t value)
{
    char digits[32];
    size_t cursor = sizeof(digits);
    do { digits[--cursor] = (char)('0' + value % 10); value /= 10; } while (value);
    return ps_copy((ps_text){digits + cursor, sizeof(digits) - cursor});
}

/* The growable output buffer shared by markup, messages and text building. */
static bool buffer_reserve(ps_html_buffer *out, size_t extra)
{
    if (out->failed) return false;
    if (extra > SIZE_MAX - out->length - 1) { out->failed = true; return false; }
    size_t needed = out->length + extra + 1;
    if (needed <= out->capacity) return true;
    size_t capacity = out->capacity ? out->capacity : 256;
    while (capacity < needed) {
        if (capacity > SIZE_MAX / 2) { capacity = needed; break; }
        capacity *= 2;
    }
    char *data = realloc(out->data, capacity);
    if (!data) { out->failed = true; return false; }
    out->data = data;
    out->capacity = capacity;
    return true;
}

bool ps_html_bytes(ps_html_buffer *out, const char *value, size_t length)
{
    if (!value && length) { out->failed = true; return false; }
    if (!buffer_reserve(out, length)) return false;
    if (length) memcpy(out->data + out->length, value, length);
    out->length += length;
    out->data[out->length] = '\0';
    return true;
}

bool ps_html_append(ps_html_buffer *out, ps_text value)
{
    return ps_html_bytes(out, value.bytes, value.length);
}

bool ps_html_text(ps_html_buffer *out, const char *value)
{
    return ps_html_append(out, ps_fixed(value));
}

bool ps_html_character(ps_html_buffer *out, char value)
{
    return ps_html_bytes(out, &value, 1);
}

ps_chars ps_html_take(ps_html_buffer *out)
{
    if (out->failed) {
        free(out->data);
        *out = (ps_html_buffer){0};
        return (ps_chars){NULL, 0};
    }
    if (!out->data) return ps_copy(PS_TEXT(""));
    ps_chars result = {out->data, out->length};
    *out = (ps_html_buffer){0};
    return result;
}

ps_value *ps_html_value(ps_html_buffer *out)
{
    return ps_chars_value(ps_html_take(out));
}
