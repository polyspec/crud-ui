#include "engine_internal.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    ps_chars property;
    ps_chars value;
} style_declaration;

static ps_text trimmed(ps_text text)
{
    size_t start = 0, end = text.length;
    while (start < end && isspace((unsigned char)text.bytes[start])) start++;
    while (end > start && isspace((unsigned char)text.bytes[end - 1])) end--;
    return ps_text_slice(text, start, end);
}

bool ps_html_escaped(ps_html_buffer *out, ps_text value, bool raw)
{
    for (size_t i = 0; i < value.length; ++i) {
        switch ((unsigned char)value.bytes[i]) {
            case '&': if (!ps_html_text(out, "&amp;")) return false; break;
            case '<': if (!ps_html_text(out, "&lt;")) return false; break;
            case '>':
                if (raw) { if (!ps_html_character(out, '>')) return false; }
                else if (!ps_html_text(out, "&gt;")) return false;
                break;
            case '"': if (!ps_html_text(out, "&quot;")) return false; break;
            case '\'':
                if (raw) { if (!ps_html_character(out, '\'')) return false; }
                else if (!ps_html_text(out, "&#x27;")) return false;
                break;
            default: if (!ps_html_character(out, value.bytes[i])) return false;
        }
    }
    return true;
}

bool ps_html_raw_text(ps_html_buffer *out, ps_text value)
{
    for (size_t i = 0; i < value.length; ++i) {
        char c = value.bytes[i];
        if (c == '&') { if (!ps_html_text(out, "&amp;")) return false; }
        else if (c == '<') { if (!ps_html_text(out, "&lt;")) return false; }
        else if (c == '>') { if (!ps_html_text(out, "&gt;")) return false; }
        else if (!ps_html_character(out, c)) return false;
    }
    return true;
}

static ps_chars style_property(ps_text source)
{
    ps_html_buffer cleaned = {0};
    for (size_t cursor = 0; cursor < source.length;) {
        if (cursor + 1 < source.length && source.bytes[cursor] == '/' && source.bytes[cursor + 1] == '*') {
            if (cleaned.length && cleaned.data[cleaned.length - 1] != ' ')
                ps_html_character(&cleaned, ' ');
            cursor += 2;
            while (cursor < source.length &&
                   !(cursor + 1 < source.length && source.bytes[cursor] == '*' && source.bytes[cursor + 1] == '/'))
                cursor++;
            if (cursor < source.length) cursor += 2;
        } else ps_html_character(&cleaned, source.bytes[cursor++]);
    }
    ps_chars raw = ps_html_take(&cleaned);
    if (!raw.bytes) return raw;
    ps_text key = trimmed(ps_view(raw));
    if (ps_text_starts(key, "--")) {
        ps_chars custom = ps_copy(key);
        free(raw.bytes);
        return custom;
    }
    ps_html_buffer camel = {0};
    for (size_t i = 0; i < key.length; ++i) {
        if (key.bytes[i] == '-' && i + 1 < key.length && key.bytes[i + 1] >= 'a' && key.bytes[i + 1] <= 'z')
            ps_html_character(&camel, (char)toupper((unsigned char)key.bytes[++i]));
        else ps_html_character(&camel, key.bytes[i]);
    }
    free(raw.bytes);
    ps_chars named = ps_html_take(&camel);
    if (!named.bytes) return named;
    ps_html_buffer css = {0};
    for (size_t i = 0; i < named.length; ++i) {
        char c = named.bytes[i];
        if (c >= 'A' && c <= 'Z') {
            ps_html_character(&css, '-');
            ps_html_character(&css, (char)tolower((unsigned char)c));
        } else ps_html_character(&css, c);
    }
    free(named.bytes);
    ps_chars property = ps_html_take(&css);
    if (!property.bytes || !ps_text_starts(ps_view(property), "ms-")) return property;
    ps_chars prefixed = PS_CONCAT(PS_TEXT("-"), ps_view(property));
    free(property.bytes);
    return prefixed;
}

static void free_declarations(style_declaration *items, size_t length)
{
    for (size_t i = 0; i < length; ++i) {
        free(items[i].property.bytes);
        free(items[i].value.bytes);
    }
    free(items);
}

static bool style_finish(ps_text source, size_t end, size_t start, size_t colon,
                         style_declaration **items, size_t *length, size_t *capacity)
{
    if (colon == SIZE_MAX) return true;
    ps_chars property = style_property(ps_text_slice(source, start, colon));
    ps_chars value = ps_copy(trimmed(ps_text_slice(source, colon + 1, end)));
    if (!property.bytes || !value.bytes) { free(property.bytes); free(value.bytes); return false; }
    if (!property.length || !value.length) { free(property.bytes); free(value.bytes); return true; }
    for (size_t i = 0; i < *length; ++i) {
        if (ps_text_equal(ps_view((*items)[i].property), ps_view(property))) {
            free((*items)[i].value.bytes);
            (*items)[i].value = value;
            free(property.bytes);
            return true;
        }
    }
    if (*length == *capacity) {
        size_t next = *capacity ? *capacity * 2 : 4;
        style_declaration *resized = next > SIZE_MAX / sizeof(**items) ? NULL
            : realloc(*items, next * sizeof(**items));
        if (!resized) { free(property.bytes); free(value.bytes); return false; }
        *items = resized;
        *capacity = next;
    }
    (*items)[(*length)++] = (style_declaration){property, value};
    return true;
}

static ps_chars render_style(ps_text source)
{
    style_declaration *items = NULL;
    size_t length = 0, capacity = 0;
    size_t start = 0, colon = SIZE_MAX;
    char quote = 0, blocks[128];
    size_t depth = 0;
    bool escaped = false, comment = false;
    for (size_t cursor = 0;; ++cursor) {
        bool end = cursor >= source.length;
        char current = end ? 0 : source.bytes[cursor];
        bool has_next = cursor + 1 < source.length;
        char next = has_next ? source.bytes[cursor + 1] : 0;
        if (comment) {
            if (!end && current == '*' && has_next && next == '/') { comment = false; cursor++; }
            if (end) break;
            continue;
        }
        if (escaped) { escaped = false; if (end) break; continue; }
        if (!end && current == '\\') { escaped = true; continue; }
        if (quote) { if (!end && current == quote) quote = 0; if (end) break; continue; }
        if (!end && current == '/' && has_next && next == '*') { comment = true; cursor++; continue; }
        if (!end && (current == '"' || current == '\'')) { quote = current; continue; }
        if (!end && (current == '(' || current == '[' || current == '{')) {
            if (depth < sizeof(blocks)) blocks[depth++] = current;
            continue;
        }
        if (!end && (current == ')' || current == ']' || current == '}')) {
            char open = current == ')' ? '(' : current == ']' ? '[' : '{';
            if (depth && blocks[depth - 1] == open) depth--;
            continue;
        }
        if (!end && !depth && current == ':' && colon == SIZE_MAX) { colon = cursor; continue; }
        if ((!end && !depth && current == ';') || end) {
            if (!style_finish(source, cursor, start, colon, &items, &length, &capacity)) {
                free_declarations(items, length);
                return (ps_chars){NULL, 0};
            }
            start = cursor + 1;
            colon = SIZE_MAX;
        }
        if (end) break;
    }
    ps_html_buffer out = {0};
    for (size_t i = 0; i < length; ++i) {
        if (i) ps_html_character(&out, ';');
        ps_html_append(&out, ps_view(items[i].property));
        ps_html_character(&out, ':');
        ps_html_append(&out, ps_view(items[i].value));
    }
    free_declarations(items, length);
    return ps_html_take(&out);
}

/* A URL whose scheme is javascript after leading C0 controls and spaces, as React checks it. */
static bool dangerous_url(ps_text value)
{
    size_t cursor = 0;
    while (cursor < value.length && (unsigned char)value.bytes[cursor] <= 0x20) cursor++;
    const char *scheme = "javascript";
    for (size_t i = 0; scheme[i]; ++i) {
        if (i) {
            while (cursor < value.length &&
                   (value.bytes[cursor] == '\r' || value.bytes[cursor] == '\n' || value.bytes[cursor] == '\t'))
                cursor++;
        }
        if (cursor >= value.length || tolower((unsigned char)value.bytes[cursor]) != scheme[i]) return false;
        cursor++;
    }
    while (cursor < value.length &&
           (value.bytes[cursor] == '\r' || value.bytes[cursor] == '\n' || value.bytes[cursor] == '\t'))
        cursor++;
    return cursor < value.length && value.bytes[cursor] == ':';
}

static ps_text attribute_name(ps_text name)
{
    if (ps_text_is(name, "autocomplete")) return PS_TEXT("autoComplete");
    if (ps_text_is(name, "readonly")) return PS_TEXT("readOnly");
    if (ps_text_is(name, "maxlength")) return PS_TEXT("maxLength");
    if (ps_text_is(name, "minlength")) return PS_TEXT("minLength");
    if (ps_text_is(name, "colspan")) return PS_TEXT("colSpan");
    if (ps_text_is(name, "rowspan")) return PS_TEXT("rowSpan");
    return name;
}

static bool boolean_attribute(ps_text name)
{
    return ps_text_is(name, "readonly") || ps_text_is(name, "disabled") ||
        ps_text_is(name, "required") || ps_text_is(name, "multiple") ||
        ps_text_is(name, "autofocus");
}

static bool moved_input_attribute(ps_text name)
{
    return ps_text_is(name, "name") || ps_text_is(name, "checked") || ps_text_is(name, "value");
}

static bool append_attribute(ps_html_buffer *out, ps_text name,
                             const ps_value *value, bool raw)
{
    if (!value || value->kind == PS_NULL) return true;
    ps_chars owned = {NULL, 0}, style = {NULL, 0};
    ps_text rendered;
    if (value->kind == PS_STRING) rendered = ps_string(value);
    else {
        owned = ps_scalar_string(value);
        if (!owned.bytes) return false;
        rendered = ps_view(owned);
    }
    if (!raw && ps_text_is(name, "style")) {
        style = render_style(rendered);
        if (!style.bytes) { free(owned.bytes); return false; }
        rendered = ps_view(style);
        if (!rendered.length) { free(style.bytes); free(owned.bytes); return true; }
    } else if (!raw && boolean_attribute(name)) {
        rendered = PS_TEXT("");
    } else if (!raw && (ps_text_is(name, "href") || ps_text_is(name, "src") || ps_text_is(name, "action"))) {
        if (ps_text_is(name, "src") && !rendered.length) { free(owned.bytes); return true; }
        if (dangerous_url(rendered))
            rendered = PS_TEXT("javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')");
    }
    bool ok = ps_html_character(out, ' ') && ps_html_append(out, raw ? name : attribute_name(name)) &&
        ps_html_text(out, "=\"") && ps_html_escaped(out, rendered, raw) &&
        ps_html_character(out, '"');
    free(style.bytes);
    free(owned.bytes);
    return ok;
}

static bool append_attributes(ps_html_buffer *out, ps_text tag,
                              const ps_value *attrs, bool raw, bool style_last)
{
    if (!attrs || attrs->kind != PS_OBJECT) return true;
    bool input = !raw && ps_text_is(tag, "input");
    bool value_control = !raw && (ps_text_is(tag, "select") || ps_text_is(tag, "textarea"));
    for (size_t i = 0; i < ps_size(attrs); ++i) {
        ps_text name = ps_key(attrs, i);
        if ((input && moved_input_attribute(name)) || (value_control && ps_text_is(name, "value")) ||
            (style_last && ps_text_is(name, "style"))) continue;
        if (!append_attribute(out, name, ps_at(attrs, i), raw)) return false;
    }
    if (style_last && ps_has(attrs, "style") &&
        !append_attribute(out, PS_TEXT("style"), ps_get(attrs, "style"), raw)) return false;
    if (input) {
        static const char *const names[] = {"name", "checked", "value"};
        for (size_t i = 0; i < sizeof(names) / sizeof(names[0]); ++i)
            if (ps_has(attrs, names[i]) &&
                !append_attribute(out, ps_fixed(names[i]), ps_get(attrs, names[i]), false)) return false;
    }
    return true;
}

bool ps_html_void_tag(ps_text tag)
{
    return ps_text_is(tag, "input") || ps_text_is(tag, "img") || ps_text_is(tag, "br") ||
        ps_text_is(tag, "hr") || ps_text_is(tag, "link");
}

bool ps_html_start_element(ps_html_buffer *out, ps_text tag,
                           const ps_value *attrs, bool raw, bool style_last)
{
    return ps_html_character(out, '<') && ps_html_append(out, tag) &&
        append_attributes(out, tag, attrs, raw, style_last) &&
        ps_html_text(out, !raw && ps_html_void_tag(tag) ? "/>" : ">");
}

bool ps_html_end_element(ps_html_buffer *out, ps_text tag)
{
    return ps_html_void_tag(tag) ? true : ps_html_text(out, "</") && ps_html_append(out, tag) &&
        ps_html_character(out, '>');
}

bool ps_html_attr_string(ps_value *attrs, const char *name, const char *value)
{
    return ps_set(attrs, name, ps_string_value(value ? value : ""));
}

bool ps_html_attr_text(ps_value *attrs, const char *name, ps_text value)
{
    return ps_set(attrs, name, ps_text_value(value.bytes ? value : PS_TEXT("")));
}

bool ps_html_attr_clone(ps_value *attrs, const char *name, const ps_value *value)
{
    return value && ps_set(attrs, name, ps_value_clone(value));
}

ps_value *ps_html_appearance_attrs(ps_text class_name, ps_text style)
{
    ps_value *attrs = ps_object_value();
    if (!attrs || (class_name.length && !ps_html_attr_text(attrs, "class", class_name)) ||
        (style.length && !ps_html_attr_text(attrs, "style", style))) {
        ps_value_free(attrs);
        return NULL;
    }
    return attrs;
}
