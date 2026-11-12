#include "php_crudui.h"
#include "Zend/zend_smart_str.h"

#include <stdlib.h>
#include <string.h>

/*
 * Input text checks of the PHP methods (docs/spec/input-text.md). Every string and member name
 * of a specification, a composition file and caller data is a sequence of Unicode scalar values,
 * which in PHP is valid UTF-8. Invalid text is rejected before any other check of a method, in
 * the order: the specification, the files, the other arguments, then the options. The same walk
 * applies the value limits.
 */

typedef struct {
    zend_string **items;
    size_t length;
    size_t capacity;
} text_path;

typedef struct {
    zend_string *name;
    zval *value;
} text_member;

/* What a walk finds first. */
typedef enum { TEXT_CLEAN, TEXT_INVALID, TEXT_LIMIT } text_finding;

/*
 * One walk of a value as the tree it denotes. An array or object reached twice, through sharing,
 * a reference or because it contains itself, is walked at each place, so the node count and the
 * nesting limit bound every walk, including one around a cycle.
 */
typedef struct {
    size_t nodes;
} text_walk;

static bool valid_text(zend_string *text)
{
    return ps_text_valid((const uint8_t *) ZSTR_VAL(text), ZSTR_LEN(text));
}

static zval *resolved(zval *value)
{
    ZVAL_DEREF(value);
    if (Z_TYPE_P(value) == IS_INDIRECT) value = Z_INDIRECT_P(value);
    ZVAL_DEREF(value);
    return value;
}

/* The members of an array or a standard object, as the value conversion reads them. */
static HashTable *container(zval *value, bool *list)
{
    if (Z_TYPE_P(value) == IS_ARRAY) {
        *list = zend_array_is_list(Z_ARRVAL_P(value));
        return Z_ARRVAL_P(value);
    }
    if (Z_TYPE_P(value) == IS_OBJECT && instanceof_function(Z_OBJCE_P(value), zend_standard_class_def)) {
        *list = false;
        return Z_OBJPROP_P(value);
    }
    return NULL;
}

/* Count a node at depth; false when it takes the value beyond its limits. */
static bool admit(text_walk *walk, const HashTable *members, size_t depth)
{
    if (++walk->nodes > CRUDUI_NODE_LIMIT) return false;
    return !members || depth < CRUDUI_NESTING_LIMIT;
}

static bool skipped(zend_string *key, zval *child)
{
    /* PHP iteration excludes inaccessible subclass properties and unset slots. */
    return (key && ZSTR_LEN(key) && ZSTR_VAL(key)[0] == '\0') || Z_TYPE_P(child) == IS_UNDEF;
}

/* Whether a value holds invalid text or passes a limit: a quick walk before the ordered one. */
static bool contains(zval *value, size_t depth, text_walk *walk)
{
    value = resolved(value);
    bool list;
    HashTable *members = container(value, &list);
    if (!admit(walk, members, depth)) return true;
    if (Z_TYPE_P(value) == IS_STRING) return !valid_text(Z_STR_P(value));
    if (!members) return false;
    zend_ulong index;
    zend_string *key;
    zval *child;
    ZEND_HASH_FOREACH_KEY_VAL(members, index, key, child) {
        (void) index;
        child = resolved(child);
        if (skipped(key, child)) continue;
        if ((key && !valid_text(key)) || contains(child, depth + 1, walk)) return true;
    } ZEND_HASH_FOREACH_END();
    return false;
}

static bool push(text_path *path, zend_string *segment)
{
    if (path->length == path->capacity) {
        size_t capacity = path->capacity ? path->capacity * 2 : 16;
        zend_string **items = realloc(path->items, capacity * sizeof(*items));
        if (!items) { zend_string_release(segment); return false; }
        path->items = items;
        path->capacity = capacity;
    }
    path->items[path->length++] = segment;
    return true;
}

static void pop(text_path *path)
{
    zend_string_release(path->items[--path->length]);
}

static int compare_members(const void *left, const void *right)
{
    const zend_string *a = ((const text_member *) left)->name, *b = ((const text_member *) right)->name;
    size_t length = ZSTR_LEN(a) < ZSTR_LEN(b) ? ZSTR_LEN(a) : ZSTR_LEN(b);
    int order = memcmp(ZSTR_VAL(a), ZSTR_VAL(b), length);
    if (order) return order;
    return ZSTR_LEN(a) < ZSTR_LEN(b) ? -1 : ZSTR_LEN(a) > ZSTR_LEN(b);
}

/* Search in code point order of member names, which is the byte order of UTF-8. */
static text_finding first(zval *value, text_path *path, size_t depth, text_walk *walk)
{
    value = resolved(value);
    bool list;
    HashTable *members = container(value, &list);
    if (!admit(walk, members, depth)) return TEXT_LIMIT;
    if (Z_TYPE_P(value) == IS_STRING) return valid_text(Z_STR_P(value)) ? TEXT_CLEAN : TEXT_INVALID;
    if (!members) return TEXT_CLEAN;
    text_finding found = TEXT_CLEAN;
    zend_ulong index;
    zend_string *key;
    zval *child;
    if (list) {
        zend_ulong position = 0;
        ZEND_HASH_FOREACH_VAL(members, child) {
            child = resolved(child);
            if (Z_TYPE_P(child) == IS_UNDEF) continue;
            if (!push(path, zend_ulong_to_str(position++))) break;
            found = first(child, path, depth + 1, walk);
            if (found != TEXT_CLEAN) break;
            pop(path);
        } ZEND_HASH_FOREACH_END();
        return found;
    }
    size_t count = zend_hash_num_elements(members), used = 0;
    text_member *sorted = calloc(count ? count : 1, sizeof(*sorted));
    if (!sorted) return TEXT_CLEAN;
    ZEND_HASH_FOREACH_KEY_VAL(members, index, key, child) {
        child = resolved(child);
        if (skipped(key, child)) continue;
        if (key && !valid_text(key)) { found = TEXT_INVALID; break; }
        sorted[used].name = key ? zend_string_copy(key) : zend_ulong_to_str(index);
        sorted[used++].value = child;
    } ZEND_HASH_FOREACH_END();
    if (found == TEXT_CLEAN) {
        qsort(sorted, used, sizeof(*sorted), compare_members);
        for (size_t i = 0; i < used && found == TEXT_CLEAN; ++i) {
            if (!push(path, zend_string_copy(sorted[i].name))) break;
            found = first(sorted[i].value, path, depth + 1, walk);
            if (found == TEXT_CLEAN) pop(path);
        }
    }
    for (size_t i = 0; i < used; ++i) zend_string_release(sorted[i].name);
    free(sorted);
    return found;
}

/*
 * The first failure of a value, walked as the tree it denotes: invalid text, whose path is left
 * in path, or a value beyond its limits.
 */
static text_finding failure(zval *value, text_path *path)
{
    text_walk walk = {0};
    if (!value || !contains(value, 0, &walk)) return TEXT_CLEAN;
    walk.nodes = 0;
    return first(value, path, 0, &walk);
}

static void release(text_path *path)
{
    while (path->length) pop(path);
    free(path->items);
}

static zval *option(zval *options, const char *name)
{
    return options && Z_TYPE_P(options) == IS_ARRAY
        ? zend_hash_str_find_deref(Z_ARRVAL_P(options), name, strlen(name)) : NULL;
}

/* The input failure of a value beyond its limits, which names the value. */
static void limit_failure(const char *prefix, const char *name, bool form_errors)
{
    zend_string *message = strpprintf(0, "Recursive or excessively nested value: %s%s", prefix, name);
    crudui_text_input_failure(message, form_errors);
    zend_string_release(message);
}

bool crudui_check_specification_text(zval *spec, zval *options, bool form_errors)
{
    const char *names[] = {"spec", "files"};
    zval *values[] = {spec, option(options, "files")};
    for (size_t i = 0; i < 2; ++i) {
        text_path path = {0};
        text_finding found = failure(values[i], &path);
        if (found == TEXT_CLEAN) { release(&path); continue; }
        if (found == TEXT_LIMIT) {
            release(&path);
            limit_failure("", names[i], form_errors);
            return false;
        }
        zval trace;
        array_init(&trace);
        for (size_t j = 0; j < path.length; ++j) add_next_index_str(&trace, zend_string_copy(path.items[j]));
        release(&path);
        crudui_text_load_failure(&trace);
        zval_ptr_dtor(&trace);
        return false;
    }
    return true;
}

static bool check_input(const char *prefix, const char *name, zval *value, bool form_errors)
{
    text_path path = {0};
    text_finding found = failure(value, &path);
    if (found == TEXT_CLEAN) { release(&path); return true; }
    if (found == TEXT_LIMIT) {
        release(&path);
        limit_failure(prefix, name, form_errors);
        return false;
    }
    smart_str message = {0};
    smart_str_appends(&message, "Text must be Unicode scalar values: ");
    smart_str_appends(&message, prefix);
    smart_str_appends(&message, name);
    for (size_t i = 0; i < path.length; ++i) {
        smart_str_appendc(&message, '.');
        smart_str_append(&message, path.items[i]);
    }
    smart_str_0(&message);
    release(&path);
    crudui_text_input_failure(message.s, form_errors);
    smart_str_free(&message);
    return false;
}

bool crudui_check_input_text(const crudui_text_input *inputs, size_t count, zval *options,
                             const char *const *names, size_t name_count, bool form_errors)
{
    for (size_t i = 0; i < count; ++i) {
        if (!check_input("", inputs[i].name, inputs[i].value, form_errors)) return false;
    }
    for (size_t i = 0; i < name_count; ++i) {
        zval *value = option(options, names[i]);
        if (value && !check_input("options.", names[i], value, form_errors)) return false;
    }
    return true;
}
