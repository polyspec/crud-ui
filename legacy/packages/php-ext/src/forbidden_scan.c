#include "engine_internal.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* The forbidden-key scan of composed specifications (docs/spec/schema.md). */

/* An enumerated forbidden meta key, or an x-prefixed comment key of at least two bytes. */
static bool forbidden_key(ps_text key)
{
    static const char *const keys[] = {
        "display_switch", "display_target", "if", "when", "show_if",
        "_", "seqtokey", "__13hex__", "$after", "$before",
        "$merge", "$remove", "xclass", "xstyle",
    };
    if (key.length >= 2 && key.bytes[0] == 'x') return true;
    for (size_t i = 0; i < sizeof(keys) / sizeof(keys[0]); ++i) if (ps_text_is(key, keys[i])) return true;
    return false;
}

static ps_value *path_trace(const ps_text *path, size_t length, ps_text key)
{
    ps_value *trace = ps_array_value();
    if (!trace) return NULL;
    for (size_t i = 0; i < length; ++i)
        if (!ps_append(trace, ps_text_value(path[i]))) goto fail;
    if (key.bytes && !ps_append(trace, ps_text_value(key))) goto fail;
    return trace;
fail:
    ps_value_free(trace);
    return NULL;
}

ps_chars ps_dotted_path(const ps_text *path, size_t length, ps_text key)
{
    ps_html_buffer out = {0};
    for (size_t i = 0; i < length; ++i) {
        if (i) ps_html_character(&out, '.');
        ps_html_append(&out, path[i]);
    }
    if (key.bytes) {
        if (length) ps_html_character(&out, '.');
        ps_html_append(&out, key);
    }
    return ps_html_take(&out);
}

ps_value *ps_scan_forbidden(const ps_value *node, ps_text *path, size_t length)
{
    if (!node || (node->kind != PS_ARRAY && node->kind != PS_OBJECT)) return NULL;
    if (node->kind == PS_OBJECT) {
        for (size_t i = 0; i < ps_size(node); ++i) {
            ps_text key = ps_key(node, i);
            if (!forbidden_key(key)) continue;
            ps_chars at = ps_dotted_path(path, length, key);
            ps_value *trace = path_trace(path, length, key);
            ps_chars message = at.bytes
                ? PS_CONCAT(PS_TEXT("forbidden meta key \""), key, PS_TEXT("\" at "), ps_view(at))
                : at;
            ps_value *error = message.bytes && trace
                ? ps_error_text("compose", "FORBIDDEN_META_KEY", ps_view(message), ps_view(at), trace)
                : NULL;
            free(message.bytes); free(at.bytes); ps_value_free(trace);
            return error ? error : ps_error("internal", "INTERNAL_ERROR", "Validation failed", "", NULL);
        }
    }
    for (size_t i = 0; i < ps_size(node); ++i) {
        char index[32];
        ps_text key = ps_key(node, i);
        if (node->kind == PS_ARRAY) { snprintf(index, sizeof(index), "%zu", i); key = ps_fixed(index); }
        ps_text *next = malloc((length + 1) * sizeof(*next));
        if (!next) return ps_error("internal", "INTERNAL_ERROR", "Validation failed", "", NULL);
        if (length) memcpy(next, path, length * sizeof(*next));
        next[length] = key;
        ps_value *error = ps_scan_forbidden(ps_at(node, i), next, length + 1);
        free(next);
        if (error) return error;
    }
    return NULL;
}
