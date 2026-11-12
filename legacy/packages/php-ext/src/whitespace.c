#include "engine_internal.h"

/*
 * Whitespace, trimming and emptiness (docs/spec/validation-rules.md, "Values"). Whitespace is
 * exactly the White_Space ranges of the embedded Unicode data; no other notion is used by the
 * validation rules.
 */

bool ps_whitespace(uint32_t code_point)
{
    return ps_code_ranges_contain(ps_white_space, ps_white_space_count, code_point);
}

/*
 * The code point starting at index. Engine strings are valid UTF-8; a byte that does not start a
 * complete sequence is read as one code point of its own value so that reading never passes the end.
 */
size_t ps_utf8_decode(ps_text text, size_t index, uint32_t *code_point)
{
    const unsigned char *bytes = (const unsigned char *)text.bytes;
    unsigned char first = bytes[index];
    size_t length = first < 0x80 ? 1 : first >= 0xf0 ? 4 : first >= 0xe0 ? 3 : first >= 0xc0 ? 2 : 1;
    if (length > text.length - index) length = 1;
    uint32_t value = length == 1 ? first : first & (0x7f >> length);
    for (size_t i = 1; i < length; ++i) {
        if ((bytes[index + i] & 0xc0) != 0x80) { *code_point = first; return 1; }
        value = (value << 6) | (bytes[index + i] & 0x3f);
    }
    *code_point = value;
    return length;
}

/* The start of the code point that ends at end (end > 0). */
static size_t previous_start(ps_text text, size_t end)
{
    size_t start = end - 1;
    while (start > 0 && end - start < 4 && (((unsigned char)text.bytes[start]) & 0xc0) == 0x80) start--;
    uint32_t code_point;
    return start + ps_utf8_decode(text, start, &code_point) == end ? start : end - 1;
}

ps_text ps_trim(ps_text text)
{
    size_t start = 0, end = text.length;
    while (start < end) {
        uint32_t code_point;
        size_t length = ps_utf8_decode(text, start, &code_point);
        if (!ps_whitespace(code_point)) break;
        start += length;
    }
    while (end > start) {
        size_t previous = previous_start(text, end);
        uint32_t code_point;
        ps_utf8_decode(text, previous, &code_point);
        if (!ps_whitespace(code_point)) break;
        end = previous;
    }
    return ps_text_slice(text, start, end);
}

size_t ps_code_points(ps_text text)
{
    size_t count = 0;
    for (size_t index = 0; index < text.length; ++count) {
        uint32_t code_point;
        index += ps_utf8_decode(text, index, &code_point);
    }
    return count;
}

bool ps_empty_value(const ps_value *value)
{
    if (!value || value->kind == PS_NULL) return true;
    if (value->kind == PS_STRING) return ps_trim(ps_string(value)).length == 0;
    return (value->kind == PS_ARRAY || value->kind == PS_OBJECT) && ps_size(value) == 0;
}
