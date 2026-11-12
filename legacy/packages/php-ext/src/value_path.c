#include "engine_internal.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const ps_value *segment(const ps_value *value, ps_text key)
{
    if (!value) return NULL;
    if (value->kind == PS_OBJECT) return ps_get_text(value, key);
    if (value->kind == PS_ARRAY) {
        if (key.length > 1 && key.bytes[0] == '#') key = ps_text_slice(key, 1, key.length);
        if (!key.length) return NULL;
        size_t index = 0;
        for (size_t i = 0; i < key.length; ++i) {
            if (key.bytes[i] < '0' || key.bytes[i] > '9' || index > (SIZE_MAX - 9) / 10) return NULL;
            index = index * 10 + (size_t)(key.bytes[i] - '0');
        }
        return ps_at(value, index);
    }
    return NULL;
}

const ps_value *ps_path(const ps_value *root, ps_text path)
{
    if (!path.bytes) return NULL;
    const ps_value *value = root;
    size_t start = 0;
    bool bracket = false;
    for (size_t cursor = 0;; ++cursor) {
        bool end = cursor == path.length;
        char c = end ? 0 : path.bytes[cursor];
        bool boundary = end || (!bracket && (c == '.' || c == '[')) || (bracket && c == ']');
        if (boundary && cursor > start) {
            value = segment(value, ps_text_slice(path, start, cursor));
            if (!value) return NULL;
        }
        if (end) break;
        if (!bracket && c == '[') { bracket = true; start = cursor + 1; }
        else if (bracket && c == ']') { bracket = false; start = cursor + 1; }
        else if (!bracket && c == '.') start = cursor + 1;
    }
    return value;
}

const ps_value *ps_path_segments(const ps_value *root, const ps_text *segments, size_t length)
{
    if (!segments && length) return NULL;
    const ps_value *value = root;
    for (size_t i = 0; i < length; ++i) {
        if (!segments[i].bytes) return NULL;
        value = segment(value, segments[i]);
        if (!value) return NULL;
    }
    return value;
}

ps_chars ps_scalar_string(const ps_value *value)
{
    if (!value || value->kind == PS_NULL || value->kind == PS_ARRAY || value->kind == PS_OBJECT)
        return ps_copy(PS_TEXT(""));
    if (value->kind == PS_STRING) return ps_copy(ps_string(value));
    if (value->kind == PS_BOOL) return ps_copy(value->data.boolean ? PS_TEXT("1") : PS_TEXT(""));
    /* A float is finite (ps_value_float); it is written as its canonical text (CUMK-069). */
    if (value->kind != PS_INT) return ps_number_text(value->data.number);
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "%lld", (long long)value->data.integer);
    return ps_copy(ps_fixed(buffer));
}

ps_chars ps_js_string(const ps_value *value)
{
    if (!value) return ps_copy(PS_TEXT("undefined"));
    if (value->kind == PS_NULL) return ps_copy(PS_TEXT("null"));
    if (value->kind == PS_BOOL) return ps_copy(value->data.boolean ? PS_TEXT("true") : PS_TEXT("false"));
    if (value->kind == PS_OBJECT) return ps_copy(PS_TEXT("[object Object]"));
    if (value->kind != PS_ARRAY) return ps_scalar_string(value);
    ps_html_buffer out = {0};
    for (size_t i = 0; i < ps_size(value); ++i) {
        const ps_value *item = ps_at(value, i);
        ps_chars text = item && item->kind != PS_NULL ? ps_js_string(item) : ps_copy(PS_TEXT(""));
        if (!text.bytes || (i && !ps_html_character(&out, ',')) || !ps_html_append(&out, ps_view(text)))
            out.failed = true;
        free(text.bytes);
    }
    return ps_html_take(&out);
}
