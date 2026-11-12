#include "engine_internal.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const ps_value *files;
    ps_text basepath;
    ps_chars *paths;
    size_t length;
} compose_context;

static ps_value *compose_properties(const ps_value *, compose_context *, ps_value **);
static ps_value *compose_spec(const ps_value *, compose_context *, ps_value **);

static void composition_error_text(ps_value **error, const char *code, ps_text message,
                                   const ps_value *trace)
{
    if (*error) return;
    ps_html_buffer at = {0};
    for (size_t i = 0; trace && i < ps_size(trace); ++i) {
        if (i) ps_html_character(&at, '.');
        ps_html_append(&at, ps_string(ps_at(trace, i)));
    }
    ps_chars location = ps_html_take(&at);
    if (!location.bytes) return;
    *error = ps_error_text("compose", code, message, ps_view(location), trace);
    free(location.bytes);
}

static void composition_error(ps_value **error, const char *code, const char *message,
                              const ps_value *trace)
{
    composition_error_text(error, code, ps_fixed(message), trace);
}

/* A composition error whose message is the prefix, the text and the suffix. */
static void composition_error_with(ps_value **error, const char *code, const char *prefix,
                                   ps_text text, const char *suffix, const ps_value *trace)
{
    ps_chars message = PS_CONCAT(ps_fixed(prefix), text, ps_fixed(suffix));
    if (message.bytes) composition_error_text(error, code, ps_view(message), trace);
    free(message.bytes);
}

static ps_chars join_path(ps_text basepath, ps_text path)
{
    if ((path.length && path.bytes[0] == '/') || !basepath.length) return ps_copy(path);
    return PS_CONCAT(basepath, PS_TEXT("/"), path);
}

static ps_value *trace_value(const compose_context *context, ps_text extra)
{
    ps_value *trace = ps_array_value();
    if (!trace) return NULL;
    for (size_t i = 0; i < context->length; ++i) {
        if (!ps_append(trace, ps_text_value(ps_view(context->paths[i])))) { ps_value_free(trace); return NULL; }
    }
    if (!ps_append(trace, ps_text_value(extra))) { ps_value_free(trace); return NULL; }
    return trace;
}

static bool is_visiting(const compose_context *context, ps_text path)
{
    for (size_t i = 0; i < context->length; ++i)
        if (ps_text_equal(ps_view(context->paths[i]), path)) return true;
    return false;
}

static ps_value *merge_objects(const ps_value *base, const ps_value *overlay)
{
    ps_value *out = base && base->kind == PS_OBJECT ? ps_value_clone(base) : ps_object_value();
    if (!out || !overlay || overlay->kind != PS_OBJECT) return out;
    for (size_t i = 0; i < ps_size(overlay); ++i) {
        if (!ps_set_text(out, ps_key(overlay, i), ps_value_clone(ps_at(overlay, i)))) {
            ps_value_free(out); return NULL;
        }
    }
    /* A merge produces an object in specification member order, as an object spread does. */
    if (!ps_value_order(out)) { ps_value_free(out); return NULL; }
    return out;
}

static ps_value *deep_merge_value(const ps_value *existing, const ps_value *incoming)
{
    if (existing && incoming && existing->kind == PS_OBJECT && incoming->kind == PS_OBJECT) {
        ps_value *out = ps_value_clone(existing);
        if (!out) return NULL;
        for (size_t i = 0; i < ps_size(incoming); ++i) {
            ps_text key = ps_key(incoming, i);
            ps_value *merged = deep_merge_value(ps_get_text(out, key), ps_at(incoming, i));
            if (!merged || !ps_set_text(out, key, merged)) { ps_value_free(out); return NULL; }
        }
        return out;
    }
    return ps_value_clone(incoming);
}

/* The segment of path that starts at *start and ends at the next dot; *start moves past the dot,
   or to SIZE_MAX after the last segment. */
static ps_text next_segment(ps_text path, size_t *start)
{
    size_t dot = ps_text_find_byte(path, '.', *start);
    ps_text segment = ps_text_slice(path, *start, dot == SIZE_MAX ? path.length : dot);
    *start = dot == SIZE_MAX ? SIZE_MAX : dot + 1;
    return segment;
}

static bool set_path(ps_value *object, ps_text path, const ps_value *value,
                     ps_value **error)
{
    if (!path.length) { composition_error(error, "PATCH_SHAPE", "$patch path must be non-empty", NULL); return false; }
    size_t start = 0;
    ps_value *node = object;
    for (;;) {
        ps_text segment = next_segment(path, &start);
        if (start == SIZE_MAX) {
            ps_value *merged = deep_merge_value(ps_get_text(node, segment), value);
            return merged && ps_set_text(node, segment, merged);
        }
        ps_value *child = ps_get_mut_text(node, segment);
        if (!child) {
            ps_value *created = ps_object_value();
            if (!created || !ps_set_text(node, segment, created)) return false;
            child = ps_get_mut_text(node, segment);
        } else if (child->kind != PS_OBJECT) {
            composition_error_with(error, "PATCH_PATH_CONFLICT",
                "$patch cannot descend into non-object at '", segment, "'", NULL);
            return false;
        }
        node = child;
    }
}

static bool remove_path(ps_value *object, ps_text path, ps_value **error)
{
    size_t start = 0;
    ps_value *node = object;
    for (;;) {
        ps_text segment = next_segment(path, &start);
        ps_value *child = ps_get_mut_text(node, segment);
        if (!child) {
            composition_error_with(error, "PATCH_REMOVE_TARGET_MISSING",
                "$patch remove target not found: '", path, "'", NULL);
            return false;
        }
        if (start == SIZE_MAX) return ps_delete_text(node, segment);
        if (child->kind != PS_OBJECT) {
            composition_error_with(error, "PATCH_REMOVE_TARGET_MISSING",
                "$patch remove cannot descend into non-object at '", segment, "'", NULL);
            return false;
        }
        node = child;
    }
}

static void remove_nested(ps_value *base, const ps_value *spec)
{
    for (size_t i = 0; i < ps_size(spec); ++i) {
        ps_text key = ps_key(spec, i);
        ps_value *target = ps_get_mut_text(base, key);
        const ps_value *part = ps_at(spec, i);
        if (target && target->kind == PS_OBJECT && part->kind == PS_OBJECT) remove_nested(target, part);
        else ps_delete_text(base, key);
    }
}

static ps_value *apply_patch(const ps_value *base, const ps_value *patch, ps_value **error)
{
    if (!patch || patch->kind != PS_OBJECT) {
        composition_error(error, "PATCH_SHAPE", "$patch must be an object of operations", NULL); return NULL;
    }
    ps_value *out = ps_value_clone(base);
    if (!out) return NULL;
    for (size_t i = 0; i < ps_size(patch) && !*error; ++i) {
        ps_text operation = ps_key(patch, i);
        const ps_value *value = ps_at(patch, i);
        if (ps_text_is(operation, "add") || ps_text_is(operation, "replace")) {
            if (value->kind != PS_OBJECT) {
                composition_error(error, "PATCH_SHAPE", "$patch add and replace values must be objects", NULL); break;
            }
            for (size_t j = 0; j < ps_size(value); ++j)
                if (!set_path(out, ps_key(value, j), ps_at(value, j), error)) break;
        } else if (ps_text_is(operation, "remove")) {
            if (value->kind == PS_ARRAY) {
                for (size_t j = 0; j < ps_size(value); ++j) {
                    const ps_value *path = ps_at(value, j);
                    if (path->kind != PS_STRING) {
                        composition_error(error, "PATCH_SHAPE", "$patch.remove array entries must be strings", NULL); break;
                    }
                    if (!remove_path(out, ps_string(path), error)) break;
                }
            } else if (value->kind == PS_OBJECT) remove_nested(out, value);
            else composition_error(error, "PATCH_SHAPE", "$patch.remove must be an array of paths or a nested object", NULL);
        } else if (!set_path(out, operation, value, error)) break;
    }
    if (*error || !ps_value_order(out)) { ps_value_free(out); return NULL; }
    return out;
}

static ps_value *resolve_single(ps_text raw, compose_context *context, ps_value **error)
{
    ps_text path = raw;
    ps_text keys = {NULL, 0};
    if (path.length && path.bytes[0] == '(') {
        size_t marker = ps_text_find(path, PS_TEXT(")."), 1);
        if (marker == SIZE_MAX) { composition_error(error, "REF_FORMAT_ERROR", "Invalid $ref path", NULL); return NULL; }
        keys = ps_text_slice(raw, marker + 2, raw.length);
        path = ps_text_slice(raw, 1, marker);
    }
    if (!path.length) { composition_error(error, "REF_FORMAT_ERROR", "Invalid $ref path", NULL); return NULL; }
    ps_chars normalized = join_path(context->basepath, path);
    if (!normalized.bytes) return NULL;
    ps_value *trace = trace_value(context, ps_view(normalized));
    if (!trace) { free(normalized.bytes); return NULL; }
    if (is_visiting(context, ps_view(normalized))) {
        composition_error(error, "REF_CYCLE", "$ref cycle detected", trace);
        ps_value_free(trace); free(normalized.bytes); return NULL;
    }
    const ps_value *node = ps_get_text(context->files, ps_view(normalized));
    if (!node || node->kind != PS_OBJECT) {
        composition_error_with(error, "REF_FILE_NOT_FOUND", "$ref file not found: ",
                               ps_view(normalized), "", trace);
        ps_value_free(trace); free(normalized.bytes); return NULL;
    }
    ps_value *owned = ps_value_clone(node);
    node = owned;
    if (keys.bytes) {
        size_t start = 0;
        while (node && start < keys.length) {
            ps_text segment = next_segment(keys, &start);
            node = ps_get_text(node, segment);
        }
    }
    if (node) node = ps_get(node, "properties");
    if (!node || node->kind != PS_OBJECT) {
        composition_error(error, "REF_DETECT_KEY_NOT_FOUND", "$ref properties path was not found", trace);
        ps_value_free(trace); ps_value_free(owned); free(normalized.bytes); return NULL;
    }
    ps_chars *paths = realloc(context->paths, (context->length + 1) * sizeof(*paths));
    if (!paths) { ps_value_free(trace); ps_value_free(owned); free(normalized.bytes); return NULL; }
    context->paths = paths; context->paths[context->length++] = normalized;
    ps_value *result = compose_properties(node, context, error);
    context->length--; free(context->paths[context->length].bytes);
    ps_value_free(trace); ps_value_free(owned);
    return result;
}

static ps_value *resolve_ref(const ps_value *reference, compose_context *context, ps_value **error)
{
    if (!reference || (reference->kind != PS_STRING && reference->kind != PS_ARRAY)) {
        composition_error(error, "REF_VALUE_TYPE",
                          "$ref must be a string or an array of strings", NULL);
        return NULL;
    }
    ps_value *out = ps_object_value();
    if (!out) return NULL;
    size_t count = reference->kind == PS_ARRAY ? ps_size(reference) : 1;
    bool complete = true;
    for (size_t i = 0; complete && i < count; ++i) {
        const ps_value *path = reference->kind == PS_ARRAY ? ps_at(reference, i) : reference;
        if (!path || path->kind != PS_STRING) {
            composition_error(error, "REF_VALUE_TYPE", "$ref must be a string or an array of strings", NULL);
            complete = false; break;
        }
        ps_value *resolved = resolve_single(ps_string(path), context, error);
        if (!resolved) { complete = false; break; }
        ps_value *merged = merge_objects(out, resolved);
        ps_value_free(out); ps_value_free(resolved); out = merged;
        if (!out) complete = false;
    }
    if (!complete || *error) { ps_value_free(out); return NULL; }
    return out;
}

static ps_value *compose_layer(const ps_value *input, compose_context *context, ps_value **error)
{
    ps_value *base = ps_object_value();
    ps_value *own = ps_object_value();
    const ps_value *patch = NULL;
    if (!base || !own) goto fail;
    for (size_t i = 0; i < ps_size(input); ++i) {
        ps_text key = ps_key(input, i);
        const ps_value *value = ps_at(input, i);
        if (ps_text_is(key, "$ref")) {
            ps_value *resolved = resolve_ref(value, context, error);
            if (!resolved) goto fail;
            ps_value *before = merge_objects(own, resolved);
            ps_value_free(resolved); ps_value_free(base); base = before;
            ps_value_free(own); own = ps_object_value();
            if (!base || !own) goto fail;
        } else if (ps_text_is(key, "$patch")) patch = value;
        else if (!ps_set_text(own, key, ps_value_clone(value))) goto fail;
    }
    ps_value *out = merge_objects(base, own);
    ps_value_free(base); ps_value_free(own);
    if (!out) return NULL;
    if (patch) {
        ps_value *patched = apply_patch(out, patch, error);
        ps_value_free(out); out = patched;
    }
    return out;
fail:
    ps_value_free(base); ps_value_free(own); return NULL;
}

static ps_value *compose_properties(const ps_value *properties, compose_context *context, ps_value **error)
{
    if (!properties || properties->kind != PS_OBJECT) return ps_object_value();
    ps_value *out = compose_layer(properties, context, error);
    if (!out) return NULL;
    for (size_t i = 0; i < ps_size(out); ++i) {
        const ps_value *field = ps_at(out, i);
        if (field->kind != PS_OBJECT) continue;
        ps_value *composed = compose_spec(field, context, error);
        if (!composed || !ps_replace(out, i, composed)) { ps_value_free(out); return NULL; }
    }
    return out;
}

static ps_value *compose_spec(const ps_value *spec, compose_context *context, ps_value **error)
{
    ps_value *out = compose_layer(spec, context, error);
    if (!out) return NULL;
    const ps_value *properties = ps_get(out, "properties");
    if (properties && properties->kind == PS_OBJECT) {
        ps_value *composed = compose_properties(properties, context, error);
        if (!composed || !ps_set(out, "properties", composed)) { ps_value_free(out); return NULL; }
    }
    return out;
}

/* The composition of a properties or a spec input with the files of its context, or an empty object when none is given. */
static ps_value *compose_entry(ps_value *(*compose)(const ps_value *, compose_context *, ps_value **),
                               const ps_value *input, const ps_value *files, ps_text basepath, ps_value **error)
{
    compose_context context = {files && files->kind == PS_OBJECT ? files : NULL,
        basepath.bytes ? basepath : PS_TEXT(""), NULL, 0};
    ps_value *empty = NULL;
    if (!context.files) context.files = empty = ps_object_value();
    ps_value *out = compose(input, &context, error);
    free(context.paths); ps_value_free(empty); return out;
}

ps_value *ps_compose_properties(const ps_value *properties, const ps_value *files,
                                ps_text basepath, ps_value **error)
{
    return compose_entry(compose_properties, properties, files, basepath, error);
}

ps_value *ps_compose_spec(const ps_value *spec, const ps_value *files,
                          ps_text basepath, ps_value **error)
{
    return compose_entry(compose_spec, spec, files, basepath, error);
}
