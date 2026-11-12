#include "engine_internal.h"

#include <ctype.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static bool whitespace(char value)
{
    return isspace((unsigned char)value) != 0;
}

ps_chars ps_join_classes(ps_text first, ps_text second, ps_text third)
{
    const ps_text parts[] = {first, second, third};
    ps_html_buffer out = {0};
    bool pending_space = false;
    for (size_t part = 0; part < 3; ++part) {
        for (size_t i = 0; i < parts[part].length; ++i) {
            char value = parts[part].bytes[i];
            if (whitespace(value)) {
                if (out.length) pending_space = true;
            } else {
                if (pending_space && !ps_html_character(&out, ' ')) break;
                pending_space = false;
                if (!ps_html_character(&out, value)) break;
            }
        }
        if (out.length) pending_space = true;
    }
    return ps_html_take(&out);
}

ps_chars ps_join_path(ps_text parent, ps_text child)
{
    if (!parent.length) return ps_copy(child);
    return PS_CONCAT(parent, PS_TEXT("."), child);
}

bool ps_path_parts(ps_text path, ps_text **result, size_t *length)
{
    if (!path.bytes || !result || !length) return false;
    *result = NULL;
    *length = 0;
    size_t capacity = 0;
    ps_text *parts = NULL;
    size_t start = 0;
    bool bracket = false;
    for (size_t cursor = 0;; ++cursor) {
        bool end = cursor == path.length;
        char value = end ? 0 : path.bytes[cursor];
        bool boundary = end || (!bracket && (value == '.' || value == '[')) ||
                        (bracket && value == ']');
        if (boundary && cursor > start) {
            if (*length == capacity) {
                size_t next = capacity ? capacity * 2 : 4;
                ps_text *resized = realloc(parts, next * sizeof(*parts));
                if (!resized) { free(parts); *length = 0; return false; }
                parts = resized; capacity = next;
            }
            parts[(*length)++] = ps_text_slice(path, start, cursor);
        }
        if (end) break;
        if (!bracket && value == '[') { bracket = true; start = cursor + 1; }
        else if (bracket && value == ']') { bracket = false; start = cursor + 1; }
        else if (!bracket && value == '.') start = cursor + 1;
    }
    *result = parts;
    return true;
}

ps_chars ps_bracket_name(ps_text path, ps_text prefix)
{
    size_t length = 0;
    ps_text *parts = NULL;
    if (!ps_path_parts(path, &parts, &length)) return (ps_chars){NULL, 0};
    ps_html_buffer out = {0};
    bool has_prefix = prefix.bytes && prefix.length;
    if (has_prefix) ps_html_append(&out, prefix);
    for (size_t i = 0; i < length; ++i) {
        if (!out.length) ps_html_append(&out, parts[i]);
        else if (!ps_html_character(&out, '[') || !ps_html_append(&out, parts[i]) ||
                 !ps_html_character(&out, ']')) break;
    }
    if (!length && has_prefix) ps_html_text(&out, "[]");
    free(parts);
    return ps_html_take(&out);
}

static bool row_segment(size_t index, const size_t *rows, size_t count)
{
    for (size_t i = 0; i < count; ++i) if (rows[i] == index) return true;
    return false;
}

ps_chars ps_rule_name(ps_text path, const size_t *rows, size_t count)
{
    size_t length = 0;
    ps_text *parts = NULL;
    if (!ps_path_parts(path, &parts, &length)) return (ps_chars){NULL, 0};
    ps_html_buffer out = {0};
    if (length) ps_html_append(&out, parts[0]);
    for (size_t i = 1; i < length; ++i) {
        if (row_segment(i, rows, count)) ps_html_text(&out, "[]");
        else if (!ps_html_character(&out, '[') || !ps_html_append(&out, parts[i]) ||
                 !ps_html_character(&out, ']')) break;
    }
    if (ps_text_ends(path, "[]")) ps_html_text(&out, "[]");
    free(parts);
    return ps_html_take(&out);
}

ps_chars ps_leaf_name(ps_text path, const size_t *rows, size_t count)
{
    size_t length = 0;
    ps_text *parts = NULL;
    if (!ps_path_parts(path, &parts, &length)) return (ps_chars){NULL, 0};
    ps_text last = length ? parts[length - 1] : path;
    bool repeated = length && row_segment(length - 1, rows, count);
    ps_text base = repeated ? (length > 1 ? parts[length - 2] : PS_TEXT("")) : last;
    bool suffix = repeated || ps_text_ends(path, "[]");
    ps_chars out = suffix ? PS_CONCAT(base, PS_TEXT("[]")) : ps_copy(base);
    free(parts);
    return out;
}

static bool unreserved(unsigned char value)
{
    return (value >= 'A' && value <= 'Z') ||
           (value >= 'a' && value <= 'z') ||
           (value >= '0' && value <= '9') ||
           (value && strchr("-_.!~*'()", value) != NULL);
}

static bool encode_component(ps_html_buffer *out, ps_text value)
{
    static const char hex[] = "0123456789ABCDEF";
    for (size_t i = 0; i < value.length; ++i) {
        unsigned char byte = (unsigned char)value.bytes[i];
        if (unreserved(byte)) { if (!ps_html_character(out, (char)byte)) return false; }
        else {
            char encoded[] = {'%', hex[byte >> 4], hex[byte & 15]};
            if (!ps_html_bytes(out, encoded, sizeof(encoded))) return false;
        }
    }
    return true;
}

ps_chars ps_control_id(ps_text prefix, ps_text path)
{
    ps_html_buffer out = {0};
    if (encode_component(&out, prefix)) {
        if (ps_html_character(&out, ':')) encode_component(&out, path);
    }
    return ps_html_take(&out);
}

/*
 * Resolve content: a string is itself; a language map yields the first non-empty string entry for
 * the language, en, ko and then its first key; any other value is empty.
 */
ps_chars ps_translate(const ps_value *value, ps_text language)
{
    if (value && value->kind == PS_STRING) return ps_copy(ps_string(value));
    if (!value || value->kind != PS_OBJECT) return ps_copy(PS_TEXT(""));
    const ps_text keys[] = {language.bytes ? language : PS_TEXT("ko"), PS_TEXT("en"), PS_TEXT("ko")};
    for (size_t i = 0; i < 4; ++i) {
        const ps_value *candidate = i < 3 ? ps_get_text(value, keys[i]) : ps_at(value, 0);
        if (candidate && candidate->kind == PS_STRING && candidate->data.string.length > 0)
            return ps_copy(ps_string(candidate));
    }
    return ps_copy(PS_TEXT(""));
}

static bool append_json(ps_html_buffer *out, const ps_value *value);

static bool append_quoted(ps_html_buffer *out, ps_text value)
{
    static const char hex[] = "0123456789abcdef";
    if (!ps_html_character(out, '"')) return false;
    for (size_t i = 0; i < value.length; ++i) {
        unsigned char c = (unsigned char)value.bytes[i];
        if (c == '"' || c == '\\') {
            if (!ps_html_character(out, '\\') || !ps_html_character(out, (char)c)) return false;
        } else if (c == '\b' || c == '\f' || c == '\n' || c == '\r' || c == '\t') {
            const char escape = c == '\b' ? 'b' : c == '\f' ? 'f' : c == '\n' ? 'n' : c == '\r' ? 'r' : 't';
            if (!ps_html_character(out, '\\') || !ps_html_character(out, escape)) return false;
        } else if (c < 0x20) {
            char escaped[] = {'\\','u','0','0',hex[c >> 4],hex[c & 15]};
            if (!ps_html_bytes(out, escaped, sizeof(escaped))) return false;
        } else if (!ps_html_character(out, (char)c)) return false;
    }
    return ps_html_character(out, '"');
}

static bool append_json(ps_html_buffer *out, const ps_value *value)
{
    char number[80];
    if (!value || value->kind == PS_NULL) return ps_html_text(out, "null");
    switch (value->kind) {
        case PS_BOOL: return ps_html_text(out, value->data.boolean ? "true" : "false");
        case PS_INT:
            snprintf(number, sizeof(number), "%lld", (long long)value->data.integer);
            return ps_html_text(out, number);
        case PS_FLOAT: {
            /* JSON.stringify writes a number as Number.prototype.toString does; a non-finite number fails. */
            ps_chars text = ps_number_text(value->data.number);
            bool ok = text.bytes && ps_html_append(out, ps_view(text));
            free(text.bytes);
            return ok;
        }
        case PS_STRING:
            return append_quoted(out, ps_string(value));
        case PS_ARRAY:
            if (!ps_html_character(out, '[')) return false;
            for (size_t i = 0; i < ps_size(value); ++i)
                if ((i && !ps_html_character(out, ',')) || !append_json(out, ps_at(value, i))) return false;
            return ps_html_character(out, ']');
        case PS_OBJECT:
            if (!ps_html_character(out, '{')) return false;
            for (size_t i = 0; i < ps_size(value); ++i) {
                if ((i && !ps_html_character(out, ',')) ||
                    !append_quoted(out, ps_key(value, i)) ||
                    !ps_html_character(out, ':') || !append_json(out, ps_at(value, i))) return false;
            }
            return ps_html_character(out, '}');
        default: return false;
    }
}

ps_chars ps_json_string(const ps_value *value)
{
    ps_html_buffer out = {0};
    if (!append_json(&out, value)) out.failed = true;
    return ps_html_take(&out);
}

ps_chars ps_json_quote(ps_text value)
{
    ps_html_buffer out = {0};
    if (!append_quoted(&out, value)) out.failed = true;
    return ps_html_take(&out);
}

static ps_text trim_range(ps_text text)
{
    size_t start = 0, end = text.length;
    while (start < end && whitespace(text.bytes[start])) start++;
    while (end > start && whitespace(text.bytes[end - 1])) end--;
    return ps_text_slice(text, start, end);
}

ps_chars ps_style_string(ps_text source)
{
    ps_html_buffer out = {0};
    size_t start = 0, colon = SIZE_MAX;
    char quote = 0;
    bool escaped = false, comment = false;
    char blocks[128];
    size_t depth = 0;
    for (size_t cursor = 0;; ++cursor) {
        bool end = cursor >= source.length;
        char c = end ? 0 : source.bytes[cursor];
        char next = cursor + 1 < source.length ? source.bytes[cursor + 1] : 0;
        bool has_next = cursor + 1 < source.length;
        bool finish = end;
        if (comment) {
            if (!end && c == '*' && has_next && next == '/') { comment = false; cursor++; }
            if (end) break;
            continue;
        }
        if (escaped) { escaped = false; if (end) break; continue; }
        if (!end && c == '\\') { escaped = true; continue; }
        if (quote) { if (!end && c == quote) quote = 0; if (end) break; continue; }
        if (!end && c == '/' && has_next && next == '*') { comment = true; cursor++; continue; }
        if (!end && (c == '"' || c == '\'')) { quote = c; continue; }
        if (!end && (c == '(' || c == '[' || c == '{')) { if (depth < sizeof(blocks)) blocks[depth++] = c; continue; }
        if (!end && (c == ')' || c == ']' || c == '}')) {
            char open = c == ')' ? '(' : c == ']' ? '[' : '{';
            if (depth && blocks[depth - 1] == open) depth--;
            continue;
        }
        if (!end && !depth && c == ':' && colon == SIZE_MAX) { colon = cursor; continue; }
        if (!end && !depth && c == ';') finish = true;
        if (finish) {
            if (colon != SIZE_MAX) {
                ps_text property = trim_range(ps_text_slice(source, start, colon));
                ps_text value = trim_range(ps_text_slice(source, colon + 1, cursor));
                if (property.length && value.length) {
                    if (out.length) ps_html_text(&out, "; ");
                    ps_html_append(&out, property);
                    ps_html_text(&out, ": ");
                    ps_html_append(&out, value);
                }
            }
            start = cursor + 1; colon = SIZE_MAX;
        }
        if (end) break;
    }
    return ps_html_take(&out);
}

