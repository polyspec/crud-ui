#include "engine_internal.h"

#include <ctype.h>
#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <time.h>

typedef struct {
    const ps_value *data;
    ps_value *errors;
    /* The failure that ends validation; NULL with a false result means an internal failure. */
    ps_value *failure;
    /* The declaration path of the current field: property names without row keys. */
    ps_text *declaration;
    size_t declaration_capacity;
    /* Compiled patterns by source text, filled when the parameters are checked. */
    ps_pattern_cache *patterns;
    /* For each collection field and filter, the rows whose unique value an earlier row holds. */
    struct unique_rows *unique_rows;
    size_t unique_rows_count;
    /* The position in unique_rows by container path, field name and filter. */
    ps_value *unique_positions;
    /* For each position of the current data path, whether its segment is a row key. */
    bool *row_keys;
    size_t row_capacity;
    /* The composed root field map, which a reference parameter names a field of. */
    const ps_value *properties;
    /* For each declaration path that reference names, the array of its ids in the data. */
    ps_value *reference_ids;
} validation_context;

/* Make room for the row key flags of a data path of length segments. */
static bool reserve_row_keys(validation_context *context, size_t length)
{
    if (length <= context->row_capacity) return true;
    size_t capacity = context->row_capacity ? context->row_capacity : 8;
    while (capacity < length) capacity *= 2;
    bool *grown = realloc(context->row_keys, capacity * sizeof(*grown));
    if (!grown) return false;
    context->row_keys = grown; context->row_capacity = capacity;
    return true;
}

/* The rows of one collection field whose value an earlier row holds, sorted by address. */
typedef struct unique_rows {
    const ps_value **duplicates;
    size_t count;
} unique_rows;

static bool string_in(ps_text value, const char *const *items, size_t count)
{
    for (size_t i = 0; i < count; ++i) if (ps_text_is(value, items[i])) return true;
    return false;
}

static const ps_value *relative_field(ps_text reference, const validation_context *context,
                                      const ps_text *path, size_t length)
{
    size_t first = 0;
    while (first < reference.length) {
        uint32_t point;
        size_t size = ps_utf8_decode(reference, first, &point);
        if (!ps_whitespace(point)) break;
        first += size;
    }
    reference = ps_text_slice(reference, first, reference.length);
    size_t dots = 0;
    while (dots < reference.length && reference.bytes[dots] == '.') dots++;
    if (dots || ps_text_find_byte(reference, '.', 0) == SIZE_MAX) {
        size_t base = ps_relative_base(context->row_keys, length, dots ? dots - 1 : 0);
        size_t tail = 0; ps_text *parts = NULL;
        if (!ps_path_parts(ps_text_slice(reference, dots, reference.length), &parts, &tail)) return NULL;
        ps_text *segments = calloc(base + tail ? base + tail : 1, sizeof(*segments));
        if (!segments) { free(parts); return NULL; }
        for (size_t i = 0; i < base; ++i) segments[i] = path[i];
        for (size_t i = 0; i < tail; ++i) segments[base + i] = parts[i];
        const ps_value *value = ps_path_segments(context->data, segments, base + tail);
        free(segments); free(parts); return value;
    }
    return ps_path(context->data, reference);
}

static bool valid_email(ps_text text)
{
    static const char local_symbols[] = ".!#$%&'*+/=?^_`{|}~-";
    size_t at = ps_text_find_byte(text, '@', 0);
    if (at == SIZE_MAX || at == 0 || ps_text_find_byte(text, '@', at + 1) != SIZE_MAX ||
        at + 1 == text.length || text.bytes[at - 1] == '.' || text.bytes[0] == '.') return false;
    for (size_t i = 0; i + 1 < at; ++i)
        if (text.bytes[i] == '.' && text.bytes[i + 1] == '.') return false;
    if (!isalnum((unsigned char)text.bytes[at + 1])) return false;
    for (size_t i = 0; i < at; ++i) {
        unsigned char c = (unsigned char)text.bytes[i];
        if (!isalnum(c) && (!c || !memchr(local_symbols, c, sizeof(local_symbols) - 1))) return false;
    }
    for (size_t i = at + 1; i < text.length; ++i) {
        unsigned char c = (unsigned char)text.bytes[i];
        if (!isalnum(c) && c != '-' && c != '.') return false;
        if (c == '.' && (i + 1 == text.length || text.bytes[i - 1] == '.')) return false;
    }
    return true;
}

static int decimal_at(ps_text text, size_t start, size_t count)
{
    int value = 0;
    for (size_t i = start; i < start + count; ++i) value = value * 10 + (text.bytes[i] - '0');
    return value;
}

static bool iso_date(ps_text text, int *serial)
{
    if (text.length != 10 || text.bytes[4] != '-' || text.bytes[7] != '-') return false;
    for (size_t i = 0; i < 10; ++i) if (i != 4 && i != 7 && !isdigit((unsigned char)text.bytes[i])) return false;
    int year = decimal_at(text, 0, 4), month = decimal_at(text, 5, 2), day = decimal_at(text, 8, 2);
    static const int days[] = {0,31,28,31,30,31,30,31,31,30,31,30,31};
    if (month < 1 || month > 12) return false;
    int limit = days[month];
    if (month == 2 && (year % 400 == 0 || (year % 4 == 0 && year % 100 != 0))) limit++;
    if (day < 1 || day > limit) return false;
    if (serial) *serial = year * 372 + month * 31 + day;
    return true;
}

/* The calendar day that year, month and day name (CUVR-058). */
static bool calendar_day(int year, int month, int day)
{
    static const int days[] = {0,31,28,31,30,31,30,31,31,30,31,30,31};
    if (month < 1 || month > 12 || day < 1) return false;
    int limit = days[month];
    if (month == 2 && (year % 400 == 0 || (year % 4 == 0 && year % 100 != 0))) limit++;
    return day <= limit;
}

static bool digits_at(ps_text text, size_t start, size_t count)
{
    if (start + count > text.length) return false;
    for (size_t i = start; i < start + count; ++i) if (!isdigit((unsigned char)text.bytes[i])) return false;
    return true;
}

/* YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY or DD/MM/YYYY naming a calendar day; a slash form is a day in either reading. */
static bool day_text(ps_text text)
{
    if (text.length != 10) return false;
    if (digits_at(text, 0, 4) && (text.bytes[4] == '-' || text.bytes[4] == '/') && text.bytes[7] == text.bytes[4]
        && digits_at(text, 5, 2) && digits_at(text, 8, 2))
        return calendar_day(decimal_at(text, 0, 4), decimal_at(text, 5, 2), decimal_at(text, 8, 2));
    if (text.bytes[2] == '/' && text.bytes[5] == '/' && digits_at(text, 0, 2) && digits_at(text, 3, 2) && digits_at(text, 6, 4)) {
        int year = decimal_at(text, 6, 4);
        return calendar_day(year, decimal_at(text, 0, 2), decimal_at(text, 3, 2))
            || calendar_day(year, decimal_at(text, 3, 2), decimal_at(text, 0, 2));
    }
    return false;
}

/* YYYY-MM-DDTHH:MM:SS followed by Z or +HH:MM / -HH:MM, with a calendar day and a valid time and offset (CUVR-058). */
static bool date_time_text(ps_text text)
{
    if (text.length != 20 && text.length != 25) return false;
    if (text.bytes[10] != 'T' || !iso_date(ps_text_slice(text, 0, 10), NULL)) return false;
    if (!digits_at(text, 11, 2) || text.bytes[13] != ':' || !digits_at(text, 14, 2) || text.bytes[16] != ':' || !digits_at(text, 17, 2))
        return false;
    if (decimal_at(text, 11, 2) > 23 || decimal_at(text, 14, 2) > 59 || decimal_at(text, 17, 2) > 59) return false;
    if (text.length == 20) return text.bytes[19] == 'Z';
    if (text.bytes[19] != '+' && text.bytes[19] != '-') return false;
    if (text.bytes[22] != ':' || !digits_at(text, 20, 2) || !digits_at(text, 23, 2)) return false;
    return decimal_at(text, 20, 2) <= 23 && decimal_at(text, 23, 2) <= 59;
}

/* The date rule (CUVR-058): trimmed text in one of the listed layouts; a number is no date. */
static bool valid_date_text(ps_text text)
{
    return day_text(text) || date_time_text(text);
}

static bool same_letters(ps_text left, ps_text right)
{
    if (left.length != right.length) return false;
    for (size_t i = 0; i < left.length; ++i)
        if (tolower((unsigned char)left.bytes[i]) != tolower((unsigned char)right.bytes[i])) return false;
    return true;
}

static bool mime_extension(ps_text filename, ps_text extension)
{
    size_t dot = SIZE_MAX;
    for (size_t i = filename.length; i-- > 0;) if (filename.bytes[i] == '.') { dot = i; break; }
    if (dot == SIZE_MAX || dot + 1 == filename.length) return false;
    return same_letters(ps_text_slice(filename, dot + 1, filename.length), extension);
}

static bool accept_one(ps_text value, ps_text item)
{
    item = ps_trim(item);
    if (!item.length) return false;
    if (item.bytes[0] == '.') {
        /* An extension of 31 bytes or fewer. */
        if (item.length - 1 >= 32) return false;
        return mime_extension(value, ps_text_slice(item, 1, item.length));
    }
    if (ps_text_find_byte(value, '/', 0) == SIZE_MAX) return false;
    if (ps_text_is(item, "*/*")) return true;
    if (item.length >= 2 && item.bytes[item.length - 1] == '*' && item.bytes[item.length - 2] == '/')
        return value.length >= item.length - 1 &&
            same_letters(ps_text_slice(value, 0, item.length - 1), ps_text_slice(item, 0, item.length - 1));
    return same_letters(value, item);
}

static bool accept_value(const ps_value *value, const ps_value *parameter)
{
    if (!parameter || parameter->kind != PS_STRING || !value || value->kind != PS_STRING) return true;
    ps_text list = ps_string(parameter);
    size_t start = 0;
    for (;;) {
        size_t comma = ps_text_find_byte(list, ',', start);
        size_t end = comma == SIZE_MAX ? list.length : comma;
        if (accept_one(ps_string(value), ps_text_slice(list, start, end))) return true;
        if (comma == SIZE_MAX) break;
        start = comma + 1;
    }
    return false;
}

/* The member name of an array or object item at index, with index text in the buffer. */
static ps_text item_key(const ps_value *container, size_t index, char *buffer, size_t size)
{
    if (container->kind == PS_OBJECT) return ps_key(container, index);
    snprintf(buffer, size, "%zu", index);
    return ps_fixed(buffer);
}

/* Kinds in the order values sort for the unique rule; an integer and a float are both numbers. */
static int unique_kind(const ps_value *value)
{
    switch (value->kind) {
        case PS_NULL: return 0;
        case PS_BOOL: return 1;
        case PS_INT: case PS_FLOAT: return 2;
        case PS_STRING: return 3;
        case PS_ARRAY: return 4;
        default: return 5;
    }
}

static int compare_text(ps_text left, ps_text right)
{
    size_t shorter = left.length < right.length ? left.length : right.length;
    int order = shorter ? memcmp(left.bytes, right.bytes, shorter) : 0;
    if (order) return order;
    return (left.length > right.length) - (left.length < right.length);
}

/*
 * A total order whose equal values are the values ps_equal matches, except that numbers compare
 * by their double value, so two integers above 2^53 that convert to the same double are equal.
 */
static int compare_unique(const ps_value *left, const ps_value *right)
{
    int kinds = unique_kind(left) - unique_kind(right);
    if (kinds) return kinds;
    switch (left->kind) {
        case PS_NULL: return 0;
        case PS_BOOL: return left->data.boolean - right->data.boolean;
        case PS_INT: case PS_FLOAT: {
            double a = left->kind == PS_INT ? (double)left->data.integer : left->data.number;
            double b = right->kind == PS_INT ? (double)right->data.integer : right->data.number;
            return (a > b) - (a < b);
        }
        case PS_STRING: return compare_text(ps_string(left), ps_string(right));
        default: {
            size_t length = ps_size(left);
            if (length != ps_size(right)) return (length > ps_size(right)) - (length < ps_size(right));
            for (size_t i = 0; i < length; ++i) {
                int order = left->kind == PS_OBJECT ? compare_text(ps_key(left, i), ps_key(right, i)) : 0;
                if (!order) order = compare_unique(ps_at(left, i), ps_at(right, i));
                if (order) return order;
            }
            return 0;
        }
    }
}

typedef struct {
    ps_text name;
    size_t position;
} unique_member;

static int compare_members(const void *left, const void *right)
{
    return compare_text(((const unique_member *)left)->name, ((const unique_member *)right)->name);
}

/*
 * A copy of the value whose object members are sorted by name at every depth, so that
 * compare_unique finds two objects equal whatever order their members come in. NULL on
 * allocation failure.
 */
static ps_value *canonical_unique_copy(const ps_value *value)
{
    if (value->kind != PS_OBJECT && value->kind != PS_ARRAY) return ps_value_clone(value);
    size_t count = ps_size(value);
    ps_value *copy = value->kind == PS_OBJECT ? ps_object_value() : ps_array_value();
    unique_member *members = malloc((count ? count : 1) * sizeof(*members));
    if (!copy || !members) { ps_value_free(copy); free(members); return NULL; }
    for (size_t i = 0; i < count; ++i)
        members[i] = (unique_member){value->kind == PS_OBJECT ? ps_key(value, i) : (ps_text){NULL, 0}, i};
    if (value->kind == PS_OBJECT) qsort(members, count, sizeof(*members), compare_members);
    for (size_t i = 0; i < count; ++i) {
        ps_value *member = canonical_unique_copy(ps_at(value, members[i].position));
        bool added = member && (value->kind == PS_OBJECT ? ps_set_text(copy, members[i].name, member) : ps_append(copy, member));
        if (!added) { free(members); ps_value_free(copy); return NULL; }
    }
    free(members);
    return copy;
}

typedef struct {
    ps_value *value;
    size_t position;
    const ps_value *row;
} unique_item;

/* Equal values next to each other, each run of equal values in row order. */
static int compare_unique_entries(const void *left, const void *right)
{
    const unique_item *a = left, *b = right;
    int order = compare_unique(a->value, b->value);
    return order ? order : (a->position > b->position) - (a->position < b->position);
}

static void free_unique_items(unique_item *items, size_t count)
{
    for (size_t i = 0; i < count; ++i) ps_value_free(items[i].value);
    free(items);
}

/*
 * 1 when the values are unique, 0 when not, -1 on allocation failure. The filter condition runs
 * once for each item, and sorting brings equal values next to each other.
 */
static int unique_values(const ps_value *values, const ps_value *parameter,
                         const validation_context *context, const ps_text *path, size_t length)
{
    bool condition = parameter && parameter->kind == PS_STRING && ps_condition_expression(ps_string(parameter));
    size_t count = ps_size(values), kept = 0;
    unique_item *items = malloc((count ? count : 1) * sizeof(*items));
    ps_text *item_path = calloc(length + 1, sizeof(*item_path));
    bool *item_rows = calloc(length + 1, sizeof(*item_rows));
    if (!items || !item_path || !item_rows) { free(items); free(item_path); free(item_rows); return -1; }
    for (size_t p = 0; p < length; ++p) { item_path[p] = path[p]; item_rows[p] = context->row_keys[p]; }
    item_rows[length] = true;
    for (size_t i = 0; i < count; ++i) {
        const ps_value *item = ps_at(values, i);
        char index[32];
        item_path[length] = item_key(values, i, index, sizeof(index));
        if (condition) {
            bool parsed = false, included = ps_expression_truth(ps_string(parameter), context->data, item_path, item_rows, length + 1, &parsed);
            if (!parsed || !included) continue;
        }
        if (parameter && parameter->kind == PS_STRING && !condition) item = ps_path(item, ps_string(parameter));
        if (ps_empty_value(item)) continue;
        items[kept] = (unique_item){canonical_unique_copy(item), i, NULL};
        if (!items[kept].value) { free(item_path); free(item_rows); free_unique_items(items, kept); return -1; }
        ++kept;
    }
    free(item_path); free(item_rows);
    qsort(items, kept, sizeof(*items), compare_unique_entries);
    int unique = 1;
    for (size_t i = 1; i < kept && unique; ++i) if (!compare_unique(items[i - 1].value, items[i].value)) unique = 0;
    free_unique_items(items, kept);
    return unique;
}

static void release_unique_rows(validation_context *context)
{
    for (size_t i = 0; i < context->unique_rows_count; ++i) free(context->unique_rows[i].duplicates);
    free(context->unique_rows);
    ps_value_free(context->unique_positions);
}

static int compare_rows(const void *left, const void *right)
{
    uintptr_t a = (uintptr_t)*(const ps_value *const *)left, b = (uintptr_t)*(const ps_value *const *)right;
    return (a > b) - (a < b);
}

/*
 * The duplicate rows of one collection field, found once per validation: the filter runs once for
 * each row and sorting brings equal values next to each other. NULL on allocation failure.
 */
static const unique_rows *duplicate_rows(validation_context *context, const ps_value *container,
                                         ps_text field, ps_text filter, const ps_text *path, size_t length)
{
    /* The container path, the field name and the filter, each followed by a zero byte. */
    size_t key_length = field.length + filter.length + 2;
    for (size_t p = 0; p + 2 < length; ++p) key_length += path[p].length + 1;
    char *key = malloc(key_length);
    if (!key) return NULL;
    size_t at = 0;
    for (size_t p = 0; p + 2 < length; ++p) {
        if (path[p].length) memcpy(key + at, path[p].bytes, path[p].length);
        at += path[p].length; key[at++] = 0;
    }
    if (field.length) memcpy(key + at, field.bytes, field.length);
    at += field.length; key[at++] = 0;
    if (filter.length) memcpy(key + at, filter.bytes, filter.length);
    at += filter.length; key[at++] = 0;
    ps_text name = {key, key_length};
    const ps_value *known = ps_get_text(context->unique_positions, name);
    if (known) { free(key); return &context->unique_rows[known->data.integer]; }
    unique_rows *grown = realloc(context->unique_rows, (context->unique_rows_count + 1) * sizeof(*grown));
    if (grown) context->unique_rows = grown;
    ps_value *position = grown ? ps_int_value((int64_t)context->unique_rows_count) : NULL;
    bool stored = position && ps_set_text(context->unique_positions, name, position);
    free(key);
    if (!stored) return NULL;
    unique_rows *rows = &grown[context->unique_rows_count++];
    size_t count = ps_size(container), kept = 0;
    *rows = (unique_rows){malloc((count ? count : 1) * sizeof(*rows->duplicates)), 0};
    unique_item *items = malloc((count ? count : 1) * sizeof(*items));
    ps_text *sibling = calloc(length, sizeof(*sibling));
    if (!rows->duplicates || !items || !sibling) { free(items); free(sibling); return NULL; }
    for (size_t p = 0; p < length; ++p) sibling[p] = path[p];
    for (size_t i = 0; i < count; ++i) {
        const ps_value *row = ps_at(container, i);
        const ps_value *value = row && row->kind == PS_OBJECT ? ps_get_text(row, field) : NULL;
        if (ps_empty_value(value)) continue;
        if (filter.length) {
            char index[32];
            sibling[length - 2] = item_key(container, i, index, sizeof(index));
            bool parsed = false, included = ps_expression_truth(filter, context->data, sibling, context->row_keys, length, &parsed);
            if (!parsed || !included) continue;
        }
        items[kept] = (unique_item){canonical_unique_copy(value), i, row};
        if (!items[kept].value) { free(sibling); free_unique_items(items, kept); return NULL; }
        ++kept;
    }
    free(sibling);
    qsort(items, kept, sizeof(*items), compare_unique_entries);
    for (size_t i = 1; i < kept; ++i)
        if (!compare_unique(items[i - 1].value, items[i].value)) rows->duplicates[rows->count++] = items[i].row;
    free_unique_items(items, kept);
    qsort(rows->duplicates, rows->count, sizeof(*rows->duplicates), compare_rows);
    return rows;
}

/* The finite number of a value for minFrom and maxFrom (CUVR-079); a boolean is none. */
static bool finite_value(const ps_value *value, double *number)
{
    if (value->kind == PS_INT) { *number = (double)value->data.integer; return true; }
    if (value->kind == PS_FLOAT && isfinite(value->data.number)) { *number = value->data.number; return true; }
    return false;
}

/* Whether `needle` occurs in `haystack`, byte for byte (CUVR-075). */
static bool text_contains(ps_text haystack, ps_text needle)
{
    if (needle.length > haystack.length) return false;
    for (size_t at = 0; at + needle.length <= haystack.length; ++at)
        if (memcmp(haystack.bytes + at, needle.bytes, needle.length) == 0) return true;
    return false;
}

static const ps_value *effective_parameter(ps_text rule, const ps_value *declared,
                                           const validation_context *context,
                                           const ps_text *path, size_t length, ps_value **owned)
{
    static const char *const verbatim[] = {
        "equalTo", "containedIn", "typeFrom", "minFrom", "maxFrom", "notEqual", "unique", "enddate", "reference", "accept",
        "match", "pattern", "in", "conditionTree",
    };
    *owned = NULL;
    if (!declared || string_in(rule, verbatim, sizeof(verbatim) / sizeof(verbatim[0]))) return declared;
    *owned = ps_resolve_conditional(declared, context->data, path, context->row_keys, length);
    return *owned;
}

/*
 * Visibility (docs/spec/validation-rules.md, "Evaluation"): 1 when design.show resolves to false in
 * the field's row context, 0 when the field is visible, -1 when the resolution cannot be allocated.
 */
static int hidden_field(const ps_value *field, const validation_context *context,
                        const ps_text *path, size_t length)
{
    const ps_value *design = ps_get(field, "design");
    bool failed = false;
    bool shown = ps_shown(design && design->kind == PS_OBJECT ? ps_get(design, "show") : NULL,
                          context->data, path, context->row_keys, length, &failed);
    return failed ? -1 : !shown;
}

static const ps_value *custom_message(const ps_value *field, ps_text rule)
{
    const ps_value *messages = ps_get(field, "messages");
    const ps_value *message = messages && messages->kind == PS_OBJECT ? ps_get_text(messages, rule) : NULL;
    return message && message->kind == PS_STRING ? message : NULL;
}

/*
 * The message of a failed rule: the declared message or the default. The parameters of the length,
 * numeric and count rules are shown as their canonical text: every {0} is the parameter, or the
 * first of a pair, and every {1} the second of a pair.
 */
static ps_chars message_for(const ps_value *field, ps_text rule, const ps_value *parameter)
{
    const ps_value *custom = custom_message(field, rule);
    struct default_message { const char *rule, *message; };
    static const struct default_message defaults[] = {
        {"required", "This field is required."},
        {"email", "Please enter a valid email address."},
        {"minlength", "Please enter at least {0} characters."},
        {"maxlength", "Please enter no more than {0} characters."},
        {"min", "Please enter a value greater than or equal to {0}."},
        {"max", "Please enter a value less than or equal to {0}."},
        {"match", "Please enter a valid format."}, {"pattern", "Please enter a valid format."},
        {"unique", "Values must be unique."}, {"in", "Please select a valid option."},
        {"range", "Please enter a value between {0} and {1}."},
        {"rangelength", "Please enter a value between {0} and {1} characters."},
        {"number", "Please enter a valid number."}, {"digits", "Please enter only digits."},
        {"equalTo", "Please enter the same value again."}, {"notEqual", "Please enter a different value."},
        {"containedIn", "Please enter a value that the referenced field contains."},
        {"typeFrom", "Please enter a value of the declared type."},
        {"minFrom", "Please enter a value at or above the declared minimum."}, {"maxFrom", "Please enter a value at or below the declared maximum."},
        {"date", "Please enter a valid date."}, {"dateISO", "Please enter a valid date in ISO format (YYYY-MM-DD)."},
        {"enddate", "End date must be after the start date."}, {"url", "Please enter a valid URL."},
        {"accept", "Please upload a file with a valid format."},
        {"mincount", "Please select at least {0} items."}, {"maxcount", "Please select no more than {0} items."},
        {"step", "Please enter a value that is a multiple of {0}."},
        {"conditionTree", "Please enter a valid condition."},
        {"reference", "Please select an existing value."},
    };
    ps_text format = {NULL, 0};
    if (custom) format = ps_string(custom);
    for (size_t i = 0; !custom && i < sizeof(defaults) / sizeof(defaults[0]); ++i)
        if (ps_text_is(rule, defaults[i].rule)) { format = ps_fixed(defaults[i].message); break; }
    if (!format.bytes) return (ps_chars){NULL, 0};
    bool shown = ps_length_rule(rule) ||
        (ps_number_rule(rule) && !ps_text_is(rule, "number") && !ps_text_is(rule, "digits"));
    if (!shown) return ps_copy(format);
    bool pair = ps_text_is(rule, "range") || ps_text_is(rule, "rangelength");
    ps_chars texts[2] = {{NULL, 0}, {NULL, 0}};
    const ps_value *values[2] = {pair ? ps_at(parameter, 0) : parameter, pair ? ps_at(parameter, 1) : NULL};
    for (size_t i = 0; i < 2; ++i)
        if (values[i] && ps_canonical_text(values[i], &texts[i]) < 0) values[i] = NULL, texts[0].length = SIZE_MAX;
    ps_html_buffer out = {0};
    if (texts[0].length == SIZE_MAX) out.failed = true;
    for (size_t cursor = 0; cursor < format.length;) {
        size_t index = cursor + 2 < format.length && format.bytes[cursor] == '{' && format.bytes[cursor + 2] == '}'
            ? (size_t)(format.bytes[cursor + 1] - '0') : 2;
        if (index < 2 && texts[index].bytes) {
            ps_html_append(&out, ps_view(texts[index]));
            cursor += 3;
        } else ps_html_character(&out, format.bytes[cursor++]);
    }
    free(texts[0].bytes); free(texts[1].bytes);
    return ps_html_take(&out);
}

static bool url_valid(ps_text value)
{
    size_t separator = ps_text_find(value, PS_TEXT("://"), 0);
    if (separator == SIZE_MAX || separator + 3 == value.length) return false;
    ps_text scheme = ps_text_slice(value, 0, separator);
    return same_letters(scheme, PS_TEXT("http")) || same_letters(scheme, PS_TEXT("https")) ||
        same_letters(scheme, PS_TEXT("ftp"));
}

/*
 * The whole-value pattern match of a nonempty value (docs/spec/validation-rules.md, "Patterns"):
 * the canonical text of a scalar against the pattern compiled when it was checked; an array or
 * object has no canonical text and fails.
 */
static int pattern_passes(validation_context *context, const ps_value *value, const ps_value *parameter)
{
    const ps_pattern *pattern = NULL;
    ps_pattern_error error;
    if (parameter->kind != PS_STRING ||
        ps_pattern_cache_get(context->patterns, ps_string(parameter), &pattern, &error) <= 0) return -1;
    ps_chars text;
    int scalar = ps_canonical_text(value, &text);
    if (scalar <= 0) return scalar;
    int matched = ps_pattern_matches(pattern, ps_view(text));
    free(text.bytes);
    return matched;
}

/* 1 when the rule passes, 0 when it fails, -1 when validation cannot continue. */
static int rule_passes(ps_text rule, const ps_value *value, const ps_value *parameter,
                       const ps_value *field, validation_context *context,
                       const ps_text *path, size_t length)
{
    if (ps_text_is(rule, "required")) return !(parameter->kind == PS_BOOL && parameter->data.boolean && ps_empty_value(value));
    if (ps_empty_value(value) && !ps_text_is(rule, "mincount") && !ps_text_is(rule, "maxcount")) return 1;
    if (ps_text_is(rule, "email")) return parameter->kind != PS_BOOL || !parameter->data.boolean ||
        (value->kind == PS_STRING && valid_email(ps_string(value)));
    if (ps_number_rule(rule)) return ps_number_passes(rule, value, parameter);
    if (ps_length_rule(rule)) return ps_length_passes(rule, value, parameter);
    if (ps_text_is(rule, "match") || ps_text_is(rule, "pattern")) return pattern_passes(context, value, parameter);
    if (ps_text_is(rule, "in")) return ps_in_passes(value, parameter);
    if (ps_text_is(rule, "unique")) {
        if (value && (value->kind == PS_ARRAY || value->kind == PS_OBJECT)) return unique_values(value, parameter, context, path, length);
        if (length < 2 || ps_empty_value(value)) return 1;
        const ps_value *container = ps_path_segments(context->data, path, length - 2);
        if (!container || (container->kind != PS_ARRAY && container->kind != PS_OBJECT)) return 1;
        bool condition = parameter->kind == PS_STRING && ps_condition_expression(ps_string(parameter));
        if (condition) { bool parsed = false; if (!ps_expression_truth(ps_string(parameter), context->data, path, context->row_keys, length, &parsed) || !parsed) return 1; }
        const unique_rows *rows = duplicate_rows(context, container, path[length - 1],
                                                 condition ? ps_string(parameter) : (ps_text){NULL, 0}, path, length);
        if (!rows) return -1;
        const ps_value *row = ps_path_segments(context->data, path, length - 1);
        if (rows->count && bsearch(&row, rows->duplicates, rows->count, sizeof(*rows->duplicates), compare_rows)) return 0;
        return 1;
    }
    if (ps_text_is(rule, "reference")) {
        if (parameter->kind != PS_STRING) return -1;
        /* The ids of a declaration path are collected once per validation. */
        const ps_value *ids = ps_get_text(context->reference_ids, ps_string(parameter));
        if (!ids) {
            ps_value *found = ps_reference_ids(context->properties, context->data, ps_string(parameter));
            if (!found || !ps_set_text(context->reference_ids, ps_string(parameter), found)) return -1;
            ids = ps_get_text(context->reference_ids, ps_string(parameter));
        }
        return ids ? ps_in_passes(value, ids) : -1;
    }
    if (ps_text_is(rule, "equalTo") || ps_text_is(rule, "notEqual")) {
        const ps_value *other = parameter->kind == PS_STRING ? relative_field(ps_string(parameter), context, path, length) : parameter;
        bool equal = ps_equal(value, other); return ps_text_is(rule, "equalTo") ? equal : !equal;
    }
    if (ps_text_is(rule, "containedIn")) {
        /* CUVR-075: a string value occurs in the string value of the referenced field. */
        const ps_value *other = parameter->kind == PS_STRING ? relative_field(ps_string(parameter), context, path, length) : NULL;
        return value->kind == PS_STRING && other && other->kind == PS_STRING && text_contains(ps_string(other), ps_string(value));
    }
    if (ps_text_is(rule, "typeFrom")) {
        /* CUVR-077: the value has the type that the referenced field names. */
        const ps_value *declared = parameter->kind == PS_STRING ? relative_field(ps_string(parameter), context, path, length) : NULL;
        if (!declared || declared->kind != PS_STRING) return 0;
        ps_text type = ps_string(declared);
        if (ps_text_is(type, "bool")) return value->kind == PS_BOOL;
        if (ps_text_is(type, "int")) return value->kind == PS_INT || (value->kind == PS_FLOAT && isfinite(value->data.number) && floor(value->data.number) == value->data.number);
        if (ps_text_is(type, "enum")) return value->kind == PS_STRING;
        return 0;
    }
    if (ps_text_is(rule, "minFrom") || ps_text_is(rule, "maxFrom")) {
        /* CUVR-079: a finite number within the bound of the referenced field; a missing or null bound declares none. */
        double number, limit;
        if (!finite_value(value, &number)) return 0;
        const ps_value *bound = parameter->kind == PS_STRING ? relative_field(ps_string(parameter), context, path, length) : NULL;
        if (!bound || bound->kind == PS_NULL) return 1;
        if (!finite_value(bound, &limit)) return 0;
        return ps_text_is(rule, "minFrom") ? number >= limit : number <= limit;
    }
    if (ps_text_is(rule, "dateISO")) { int serial; return value->kind == PS_STRING && iso_date(ps_trim(ps_string(value)), &serial); }
    if (ps_text_is(rule, "date")) return value->kind == PS_STRING && valid_date_text(ps_trim(ps_string(value)));
    if (ps_text_is(rule, "enddate")) {
        if (value->kind != PS_STRING || parameter->kind != PS_STRING) return 1;
        int end, start; const ps_value *other = relative_field(ps_string(parameter), context, path, length);
        return !other || other->kind != PS_STRING || !iso_date(ps_trim(ps_string(value)), &end) || !iso_date(ps_trim(ps_string(other)), &start) || end >= start;
    }
    if (ps_text_is(rule, "url")) return parameter->kind == PS_BOOL && !parameter->data.boolean ? 1 : value->kind == PS_STRING && url_valid(ps_trim(ps_string(value)));
    if (ps_text_is(rule, "accept")) return accept_value(value, parameter);
    if (ps_text_is(rule, "conditionTree")) return ps_condition_tree_passes(value, parameter);
    /* Rule names are checked when the specification loads. */
    (void)field; return -1;
}

static bool append_error(validation_context *context, const ps_text *path, size_t length,
                         ps_text rule, ps_text message, const ps_value *value)
{
    ps_chars full = ps_dotted_path(path, length, (ps_text){NULL, 0});
    ps_value *error = ps_object_value();
    bool ok = full.bytes && error &&
        ps_set(error, "path", ps_text_value(ps_view(full))) &&
        ps_set(error, "field", ps_text_value(length ? path[length - 1] : PS_TEXT(""))) &&
        ps_set(error, "rule", ps_text_value(rule)) &&
        ps_set(error, "message", ps_text_value(message)) &&
        ps_set(error, "value", value ? ps_value_clone(value) : ps_null_value()) &&
        ps_append(context->errors, error);
    if (!ok) ps_value_free(error);
    free(full.bytes); return ok;
}

/* Record a failed rule; false when the error cannot be recorded. */
static bool rule_error(validation_context *context, const ps_text *path, size_t length,
                       const ps_value *field, ps_text rule, const ps_value *parameter,
                       const ps_value *value)
{
    ps_chars message = message_for(field, rule, parameter);
    bool ok = message.bytes && append_error(context, path, length, rule, ps_view(message), value);
    free(message.bytes);
    return ok;
}

static bool array_level_rule(ps_text rule)
{
    return ps_text_is(rule, "required") || ps_text_is(rule, "unique") ||
        ps_text_is(rule, "mincount") || ps_text_is(rule, "maxcount");
}

/*
 * The values of a group source's choices for the root data, as an array of strings; NULL with the owned message in
 * *repeated when a row repeats a literal choice (CUSC-089), and NULL with *repeated empty on allocation failure.
 */
static ps_value *group_members(const ps_value *items, const ps_value *data, ps_chars *repeated)
{
    ps_value *choices = ps_group_source_choices(items, data, repeated);
    ps_value *members = choices ? ps_array_value() : NULL;
    bool ok = members != NULL;
    for (size_t i = 0; ok && i < ps_size(choices); ++i) {
        ps_value *value = ps_value_clone(ps_get(ps_at(choices, i), "value"));
        ok = value && ps_append(members, value);
    }
    ps_value_free(choices);
    if (!ok) { ps_value_free(members); return NULL; }
    return members;
}

static bool allocation_failure(validation_context *context);

/*
 * The rules of a field. depth is the length of the field's declaration path in
 * context->declaration.
 */
static bool validate_rules(const ps_value *field, const ps_value *value,
                           validation_context *context, ps_text *path, size_t length,
                           size_t depth, bool array_level, bool element)
{
    const ps_value *rules = ps_get(field, "validate");
    if (!array_level && ps_is_string(ps_get(field, "type"), "number") && (!rules || !ps_has(rules, "number"))) {
        ps_value *enabled = ps_bool_value(true);
        if (!enabled) return false;
        int pass = rule_passes(PS_TEXT("number"), value, enabled, field, context, path, length);
        bool ok = pass >= 0 && (pass || rule_error(context, path, length, field, PS_TEXT("number"), enabled, value));
        ps_value_free(enabled);
        if (!ok || !pass) return ok;
    }
    /* A group source checks the value against the choices of its rows before the declared rules (validation-rules.md, "Values"). */
    const ps_value *items = ps_get(field, "items");
    if (!array_level && ps_is_group_source(items)) {
        /* A repeated value among the source rows is data that the choices cannot express (CUVR-087). */
        ps_chars repeat = {NULL, 0};
        int repeat_state = ps_group_source_repeat(items, context->data, &repeat);
        if (repeat_state < 0) return allocation_failure(context);
        if (repeat_state > 0) {
            context->failure = ps_error_text("input", "INVALID_FORM_INPUT", ps_view(repeat), PS_TEXT(""), NULL);
            free(repeat.bytes);
            return false;
        }
        ps_chars repeated = {NULL, 0};
        ps_value *members = group_members(items, context->data, &repeated);
        if (!members) {
            if (repeated.bytes)
                context->failure = ps_error_text("input", "INVALID_FORM_INPUT", ps_view(repeated), PS_TEXT(""), NULL);
            free(repeated.bytes);
            return false;
        }
        int pass = rule_passes(PS_TEXT("in"), value, members, field, context, path, length);
        bool ok = pass >= 0 && (pass || rule_error(context, path, length, field, PS_TEXT("in"), members, value));
        ps_value_free(members);
        if (!ok || !pass) return ok;
    }
    if (!rules || rules->kind != PS_OBJECT) return true;
    for (size_t i = 0; i < ps_size(rules); ++i) {
        ps_text rule = ps_key(rules, i); bool collection = array_level_rule(rule);
        if ((array_level && !collection) || (element && collection)) continue;
        ps_value *owned = NULL; const ps_value *parameter = effective_parameter(rule, ps_at(rules, i), context, path, length, &owned);
        if (!parameter) return false;
        if (parameter->kind == PS_NULL || (parameter->kind == PS_BOOL && !parameter->data.boolean)) { ps_value_free(owned); continue; }
        if (owned) {
            /* A resolved parameter is checked when it is selected; a literal was checked at load. */
            ps_parameter_problem problem;
            if (!ps_rule_parameter(rule, parameter, context->patterns, &problem)) { ps_value_free(owned); return false; }
            if (problem.code) {
                context->failure = ps_parameter_error(rule, &problem, context->declaration, depth);
                ps_value_free(owned); return false;
            }
        }
        int pass = rule_passes(rule, value, parameter, field, context, path, length);
        if (pass <= 0) {
            bool ok = pass == 0 && rule_error(context, path, length, field, rule, parameter, value);
            ps_value_free(owned); return ok;
        }
        ps_value_free(owned);
    }
    return true;
}

static int compare_keys(const void *left, const void *right)
{ return ps_text_compare(*(const ps_text *)left, *(const ps_text *)right); }

/* Record a form input failure for the data path and stop traversal. */
static bool input_failure_text(validation_context *context, ps_text label,
                               const ps_text *path, size_t length)
{
    ps_chars full = ps_dotted_path(path, length, (ps_text){NULL, 0});
    ps_chars message = full.bytes ? PS_CONCAT(label, ps_view(full)) : full;
    context->failure = message.bytes
        ? ps_error_text("input", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL) : NULL;
    free(full.bytes); free(message.bytes);
    return false;
}

/* Record an allocation failure, which ends validation with an internal error; returns false. */
static bool allocation_failure(validation_context *context)
{
    context->failure = ps_error("internal", "INTERNAL_ERROR", "Validation failed", "", NULL);
    return false;
}

static bool input_failure(validation_context *context, const char *label,
                          const ps_text *path, size_t length)
{
    return input_failure_text(context, ps_fixed(label), path, length);
}

/* Row keys of a keyed collection in sorted order; NULL only on allocation failure. */
static ps_text *sorted_row_keys(const ps_value *rows, size_t *count)
{
    *count = ps_size(rows);
    ps_text *keys = calloc(*count ? *count : 1, sizeof(*keys));
    if (!keys) return NULL;
    for (size_t j = 0; j < *count; ++j) keys[j] = ps_key(rows, j);
    qsort(keys, *count, sizeof(*keys), compare_keys);
    return keys;
}

/* A single-choice field: select, dropdown, selectbox, choice or radio whose lang is absent, false or null. */
static bool single_choice_field(const ps_value *field)
{
    static const char *const types[] = {"select", "dropdown", "selectbox", "choice", "radio"};
    const ps_value *type = ps_get(field, "type");
    bool single = false;
    for (size_t i = 0; !single && i < sizeof(types) / sizeof(*types); ++i) single = ps_is_string(type, types[i]);
    const ps_value *lang = ps_get(field, "lang");
    return single && (!lang || lang->kind == PS_NULL || (lang->kind == PS_BOOL && !lang->data.boolean));
}

/* Reject an array or object as a single-choice value, or as a row value of a repeated
   single-choice field in sorted key order. Returns false on a failure. */
static bool single_choice_data(const ps_value *value, bool repeated, validation_context *context,
                               const ps_text *path, size_t length)
{
    static const char label[] = "Choice data must be a single value: ";
    if (!repeated) {
        if (value->kind != PS_ARRAY && value->kind != PS_OBJECT) return true;
        return input_failure(context, label, path, length);
    }
    size_t count = 0;
    ps_text *keys = sorted_row_keys(value, &count);
    if (!keys) return false;
    for (size_t j = 0; j < count; ++j) {
        const ps_value *row = ps_get_text(value, keys[j]);
        if (!row || (row->kind != PS_ARRAY && row->kind != PS_OBJECT)) continue;
        ps_text *row_path = malloc((length + 1) * sizeof(*row_path));
        if (!row_path) { free(keys); return false; }
        memcpy(row_path, path, length * sizeof(*row_path)); row_path[length] = keys[j];
        input_failure(context, label, row_path, length + 1);
        free(row_path); free(keys); return false;
    }
    free(keys);
    return true;
}

/*
 * Reject a key of the keyed object rows of a field declaring multiple.keys that is not a row key
 * of the group its reference names, read in the field's row context; keys in code point order, the
 * byte order of their UTF-8 text (docs/spec/validation-rules.md, Keyed maps). Returns false on a
 * failure, with the failure or an allocation error recorded on the context.
 */
static bool keyed_map_keys(const ps_value *field, const ps_value *rows, validation_context *context,
                           const ps_text *path, size_t length)
{
    const ps_value *multiple = ps_get(field, "multiple");
    const ps_value *reference = multiple && multiple->kind == PS_OBJECT ? ps_get(multiple, "keys") : NULL;
    if (!reference || reference->kind != PS_STRING) return true;
    const ps_value *group = relative_field(ps_string(reference), context, path, length);
    size_t count = 0;
    ps_text *keys = sorted_row_keys(rows, &count);
    if (!keys) return allocation_failure(context);
    for (size_t j = 0; j < count; ++j) {
        if (group && group->kind == PS_OBJECT && ps_get_text(group, keys[j])) continue;
        ps_chars label = PS_CONCAT(PS_TEXT("Row key is not an id of "), ps_string(reference), PS_TEXT(": "));
        ps_text *row_path = label.bytes ? malloc((length + 1) * sizeof(*row_path)) : NULL;
        if (row_path) {
            memcpy(row_path, path, length * sizeof(*row_path)); row_path[length] = keys[j];
            input_failure_text(context, ps_view(label), row_path, length + 1);
        } else {
            allocation_failure(context);
        }
        free(row_path); free(label.bytes); free(keys);
        return false;
    }
    free(keys);
    return true;
}

/* The rows of a repeated scalar field, each with its element rules, in sorted key order. */
static bool validate_elements(const ps_value *field, const ps_value *rows, validation_context *context,
                              const ps_text *path, size_t length, size_t depth)
{
    size_t count = 0;
    ps_text *keys = sorted_row_keys(rows, &count);
    if (!keys) return false;
    ps_text *item_path = malloc((length + 1) * sizeof(*item_path));
    bool valid = item_path != NULL && reserve_row_keys(context, length + 1);
    if (valid) memcpy(item_path, path, length * sizeof(*item_path));
    for (size_t j = 0; valid && j < count; ++j) {
        item_path[length] = keys[j];
        context->row_keys[length] = true;
        valid = validate_rules(field, ps_get_text(rows, keys[j]), context, item_path, length + 1, depth, false, true);
    }
    free(item_path); free(keys);
    return valid;
}

/*
 * Validate fields; path is owned and freed. depth is the declaration path length of properties.
 * The data shape is checked for every field; the rules of a hidden field and of everything it
 * contains are not evaluated (hidden is set inside a hidden field). A repeated field without data
 * is an empty collection: its collection rules run and it has no rows.
 */
static bool validate_properties(const ps_value *properties, const ps_value *data,
                                validation_context *context, ps_text *path, size_t length,
                                size_t depth, bool hidden)
{
    if (!properties || properties->kind != PS_OBJECT) { free(path); return true; }
    if (data && data->kind == PS_OBJECT) {
        size_t count = 0;
        ps_text *keys = sorted_row_keys(data, &count);
        if (!keys) { free(path); return false; }
        for (size_t i = 0; i < count; ++i) {
            if (!ps_get_text(properties, keys[i])) {
                ps_text *unknown_path = malloc((length + 1) * sizeof(*unknown_path));
                if (!unknown_path) { free(keys); free(path); return false; }
                if (length) memcpy(unknown_path, path, length * sizeof(*unknown_path));
                unknown_path[length] = keys[i];
                input_failure(context, "Unknown form data field: ", unknown_path, length + 1);
                free(unknown_path); free(keys); free(path); return false;
            }
        }
        free(keys);
    }
    for (size_t i = 0; i < ps_size(properties); ++i) {
        ps_text name = ps_key(properties, i); const ps_value *field = ps_at(properties, i);
        if (!field || field->kind != PS_OBJECT) continue;
        if (depth + 1 > context->declaration_capacity) {
            size_t capacity = context->declaration_capacity ? context->declaration_capacity * 2 : 8;
            ps_text *declaration = realloc(context->declaration, capacity * sizeof(*declaration));
            if (!declaration) { free(path); return false; }
            context->declaration = declaration; context->declaration_capacity = capacity;
        }
        context->declaration[depth] = name;
        ps_text *field_path = realloc(path, (length + 1) * sizeof(*field_path));
        if (!field_path || !reserve_row_keys(context, length + 2)) { free(field_path ? field_path : path); return false; }
        path = field_path; path[length] = name; context->row_keys[length] = false;
        const ps_value *value = data && data->kind == PS_OBJECT ? ps_get_text(data, name) : NULL;
        bool repeated = ps_repeated_field(field);
        const ps_value *children = ps_get(field, "properties");
        bool group = ps_is_string(ps_get(field, "type"), "group") && children && children->kind == PS_OBJECT;
        if (repeated && value && value->kind != PS_OBJECT) {
            input_failure(context, "Repeated data must be a keyed object: ", path, length + 1);
            free(path); return false;
        }
        if (repeated && value && !keyed_map_keys(field, value, context, path, length + 1)) {
            free(path); return false;
        }
        if (value && single_choice_field(field) && !single_choice_data(value, repeated, context, path, length + 1)) {
            free(path); return false;
        }
        if (group && !repeated && value && value->kind != PS_OBJECT) {
            input_failure(context, "Group data must be an object: ", path, length + 1);
            free(path); return false;
        }
        int hides = hidden ? 1 : hidden_field(field, context, path, length + 1);
        if (hides < 0) { free(path); return false; }
        bool skipped = hides == 1;
        bool valid = true;
        if (group && repeated) {
            /* Keyed rows use sorted-key traversal in every implementation. */
            size_t count = 0; ps_text *keys = value ? sorted_row_keys(value, &count) : NULL;
            if (value && !keys) { free(path); return false; }
            for (size_t j = 0; valid && j < count; ++j) {
                const ps_value *item = ps_get_text(value, keys[j]);
                ps_text *item_path = malloc((length + 2) * sizeof(*item_path));
                if (!item_path) { valid = false; break; }
                memcpy(item_path, path, (length + 1) * sizeof(*item_path)); item_path[length + 1] = keys[j];
                context->row_keys[length] = false; context->row_keys[length + 1] = true;
                if (!item || item->kind != PS_OBJECT) {
                    input_failure(context, "Group data must be an object: ", item_path, length + 2);
                    free(item_path); valid = false; break;
                }
                valid = validate_properties(children, item, context, item_path, length + 2, depth + 1, skipped);
            }
            free(keys);
            if (valid && !skipped)
                valid = validate_rules(field, value, context, path, length + 1, depth + 1, false, false);
        } else if (group) {
            ps_text *child_path = malloc((length + 1) * sizeof(*child_path));
            if (!child_path) { free(path); return false; }
            memcpy(child_path, path, (length + 1) * sizeof(*child_path));
            valid = validate_properties(children, value, context, child_path, length + 1, depth + 1, skipped) &&
                (skipped || validate_rules(field, value, context, path, length + 1, depth + 1, false, false));
        } else if (skipped) {
            /* A hidden scalar field has no data shape to check. */
        } else if (repeated) {
            size_t before = ps_size(context->errors);
            valid = validate_rules(field, value, context, path, length + 1, depth + 1, true, false);
            if (valid && value && ps_size(context->errors) == before)
                valid = validate_elements(field, value, context, path, length + 1, depth + 1);
        } else {
            valid = validate_rules(field, value, context, path, length + 1, depth + 1, false, false);
        }
        if (!valid) { free(path); return false; }
    }
    free(path); return true;
}

/*
 * Append the data path of each field whose design.show resolves to false, in declaration order,
 * each field of a group row under the row's key and the fields inside a hidden field included
 * (docs/spec/validation-rules.md, "Evaluation"); data of another shape is read as missing. path
 * holds length segments and room for two more; false on allocation failure.
 */
static bool collect_hidden(const ps_value *properties, const ps_value *data, validation_context *context,
                           ps_text *path, size_t length, ps_value *hidden)
{
    if (!properties || properties->kind != PS_OBJECT) return true;
    if (!reserve_row_keys(context, length + 2)) return false;
    for (size_t i = 0; i < ps_size(properties); ++i) {
        ps_text name = ps_key(properties, i); const ps_value *field = ps_at(properties, i);
        if (!field || field->kind != PS_OBJECT) continue;
        path[length] = name; context->row_keys[length] = false;
        int hides = hidden_field(field, context, path, length + 1);
        if (hides < 0) return false;
        if (hides) {
            ps_chars full = ps_dotted_path(path, length + 1, (ps_text){NULL, 0});
            bool ok = full.bytes && ps_append(hidden, ps_text_value(ps_view(full)));
            free(full.bytes);
            if (!ok) return false;
        }
        const ps_value *children = ps_get(field, "properties");
        if (!ps_is_string(ps_get(field, "type"), "group") || !children || children->kind != PS_OBJECT) continue;
        const ps_value *value = data && data->kind == PS_OBJECT ? ps_get_text(data, name) : NULL;
        if (value && value->kind != PS_OBJECT) value = NULL;
        ps_text *child_path = malloc((length + 3) * sizeof(*child_path));
        if (!child_path) return false;
        memcpy(child_path, path, (length + 1) * sizeof(*child_path));
        bool ok = true;
        if (!ps_repeated_field(field)) {
            ok = collect_hidden(children, value, context, child_path, length + 1, hidden);
        } else if (value) {
            size_t count = 0; ps_text *keys = sorted_row_keys(value, &count);
            ok = keys != NULL;
            ps_text *row_path = ok ? malloc((length + 4) * sizeof(*row_path)) : NULL;
            ok = ok && row_path;
            for (size_t j = 0; ok && j < count; ++j) {
                const ps_value *row = ps_get_text(value, keys[j]);
                memcpy(row_path, path, (length + 1) * sizeof(*row_path));
                row_path[length + 1] = keys[j];
                ok = reserve_row_keys(context, length + 4);
                if (ok) { context->row_keys[length] = false; context->row_keys[length + 1] = true; }
                ok = ok && collect_hidden(children, row && row->kind == PS_OBJECT ? row : NULL, context,
                                          row_path, length + 2, hidden);
            }
            free(row_path); free(keys);
        }
        free(child_path);
        if (!ok) return false;
    }
    return true;
}

/* The result of a validation: valid, the errors and, for a form, the hidden paths (NULL for a declaration). */
static ps_result validation_result(ps_value *errors, ps_value *hidden)
{
    ps_value *result = ps_object_value(); bool valid = ps_size(errors) == 0;
    if (!result || !ps_set(result, "valid", ps_bool_value(valid)) || !ps_set(result, "errors", errors)) {
        ps_value_free(result); ps_value_free(errors); ps_value_free(hidden);
        return ps_fail("internal", "INTERNAL_ERROR", "Validation failed", "");
    }
    if (hidden && !ps_set(result, "hidden", hidden)) {
        ps_value_free(result); return ps_fail("internal", "INTERNAL_ERROR", "Validation failed", "");
    }
    return ps_ok(result);
}

static const ps_value *option_files(const ps_value *options)
{
    const ps_value *files = ps_get(options, "files");
    return files && files->kind == PS_OBJECT ? files : NULL;
}

static ps_text option_basepath(const ps_value *options)
{
    const ps_value *basepath = options && options->kind == PS_OBJECT ? ps_get(options, "basepath") : NULL;
    return ps_string(basepath);
}

static ps_result validate_form(const ps_value *spec, const ps_value *data, const ps_value *options);
static ps_result validate_list(const ps_value *spec, const ps_value *options);
static ps_result validate_detail(const ps_value *spec, const ps_value *options);

/*
 * Specifications and composition files are validated in specification member order; the
 * submitted data keeps its order.
 */
ps_result ps_validate(const ps_value *spec, const ps_value *data, const ps_value *options)
{
    ps_value *ordered_spec = NULL, *ordered_options = NULL;
    if (!ps_order_specification(spec, options, &ordered_spec, &ordered_options))
        return ps_fail("internal", "INTERNAL_ERROR", "Validation failed", "");
    ps_result result = validate_form(ordered_spec, data, ordered_options);
    ps_value_free(ordered_spec); ps_value_free(ordered_options);
    return result;
}

ps_result ps_validate_list(const ps_value *spec, const ps_value *options)
{
    ps_value *ordered_spec = NULL, *ordered_options = NULL;
    if (!ps_order_specification(spec, options, &ordered_spec, &ordered_options))
        return ps_fail("internal", "INTERNAL_ERROR", "Validation failed", "");
    ps_result result = validate_list(ordered_spec, ordered_options);
    ps_value_free(ordered_spec); ps_value_free(ordered_options);
    return result;
}

ps_result ps_validate_detail(const ps_value *spec, const ps_value *options)
{
    ps_value *ordered_spec = NULL, *ordered_options = NULL;
    if (!ps_order_specification(spec, options, &ordered_spec, &ordered_options))
        return ps_fail("internal", "INTERNAL_ERROR", "Validation failed", "");
    ps_result result = validate_detail(ordered_spec, ordered_options);
    ps_value_free(ordered_spec); ps_value_free(ordered_options);
    return result;
}

/* The levels and the nodes of a form root that declares no dataLimits (CUVR-083), and their maximums. */
#define DATA_DEPTH_DEFAULT 64
#define DATA_VALUES_DEFAULT 100000
#define DATA_DEPTH_MAXIMUM 512
#define DATA_VALUES_MAXIMUM 1000000

/*
 * Read the dataLimits of a form root into depth and values, a missing member taking its default;
 * the load failure of a bad one (CUVR-084), or NULL.
 */
static ps_value *read_data_limits(const ps_value *spec, int64_t *depth, int64_t *values)
{
    const ps_value *declared = spec && spec->kind == PS_OBJECT ? ps_get(spec, "dataLimits") : NULL;
    if (!declared) return NULL;
    bool valid = declared->kind == PS_OBJECT;
    for (size_t i = 0; valid && i < ps_size(declared); ++i) {
        ps_text key = ps_key(declared, i);
        int64_t *bound = ps_text_is(key, "depth") ? depth : ps_text_is(key, "values") ? values : NULL;
        int64_t maximum = bound == depth ? DATA_DEPTH_MAXIMUM : DATA_VALUES_MAXIMUM;
        valid = bound && ps_length_limit(ps_at(declared, i), bound) && *bound >= 1 && *bound <= maximum;
    }
    if (valid) return NULL;
    ps_value *trace = ps_array_value();
    ps_value *error = trace ? ps_error("compose", "INVALID_RULE_PARAMETER",
        "Invalid dataLimits parameter: expected depth from 1 to 512 and values from 1 to 1000000", "", trace) : NULL;
    ps_value_free(trace);
    return error ? error : ps_error("internal", "INTERNAL_ERROR", "Validation failed", "", NULL);
}

/* Add the levels and the nodes of value, which sits at level. */
static void measure_data(const ps_value *value, int64_t level, int64_t *levels, int64_t *nodes)
{
    ++*nodes;
    if (value->kind != PS_ARRAY && value->kind != PS_OBJECT) return;
    if (level > *levels) *levels = level;
    for (size_t i = 0; i < ps_size(value); ++i) measure_data(ps_at(value, i), level + 1, levels, nodes);
}

/* The input failure of data beyond its limits, its levels checked before its nodes (CUVR-082), or NULL. */
static ps_value *data_limits_failure(const ps_value *data, int64_t depth, int64_t values)
{
    int64_t levels = 0, nodes = 0;
    measure_data(data, 1, &levels, &nodes);
    if (levels <= depth && nodes <= values) return NULL;
    char message[96];
    snprintf(message, sizeof(message), "Submitted data exceeds the %s limit of %lld",
             levels > depth ? "depth" : "values", (long long)(levels > depth ? depth : values));
    return ps_error("input", "INVALID_FORM_INPUT", message, "", NULL);
}

static ps_result validate_form(const ps_value *spec, const ps_value *data, const ps_value *options)
{
    /* Root data is a request precondition, checked before composition. */
    if (!data || data->kind != PS_OBJECT)
        return ps_fail("input", "INVALID_FORM_INPUT", "Form data must be an object", "");
    const ps_value *files = option_files(options); ps_value *error = NULL, *properties = NULL;
    if (spec && spec->kind == PS_OBJECT && (ps_has(spec, "$ref") || ps_has(spec, "$patch")) &&
        (!ps_get(spec, "properties") || ps_get(spec, "properties")->kind != PS_OBJECT))
        properties = ps_compose_properties(spec, files, option_basepath(options), &error);
    else {
        ps_value *composed = ps_compose_spec(spec, files, option_basepath(options), &error);
        if (composed) { properties = ps_value_clone(ps_get(composed, "properties")); ps_value_free(composed); }
    }
    if (error) { ps_value_free(properties); return (ps_result){NULL, error}; }
    if (!properties) properties = ps_object_value();
    ps_text root_path[1] = {PS_TEXT("properties")};
    error = ps_scan_forbidden(properties, root_path, 1);
    /* The form root declarations are scanned like the fields they sit beside. */
    static const char *const form_keys[] = {"buttons", "action"};
    for (size_t i = 0; !error && spec && spec->kind == PS_OBJECT && i < 2; ++i) {
        ps_text form_path[1] = {ps_fixed(form_keys[i])};
        if (ps_get(spec, form_keys[i])) error = ps_scan_forbidden(ps_get(spec, form_keys[i]), form_path, 1);
    }
    /* The data limits are checked after the forbidden-key scan and before the rule parameters. */
    int64_t depth_limit = DATA_DEPTH_DEFAULT, values_limit = DATA_VALUES_DEFAULT;
    if (!error) error = read_data_limits(spec, &depth_limit, &values_limit);
    ps_pattern_cache *patterns = error ? NULL : ps_pattern_cache_new();
    if (!error && !patterns) error = ps_error("internal", "INTERNAL_ERROR", "Validation failed", "", NULL);
    /* Rule parameters are checked after composition and the forbidden-key scan. */
    if (!error) error = ps_check_rule_parameters(properties, patterns);
    /* The data is measured before any rule. */
    if (!error) error = data_limits_failure(data, depth_limit, values_limit);
    if (error) { ps_pattern_cache_free(patterns); ps_value_free(properties); return (ps_result){NULL, error}; }
    validation_context context = {data, ps_array_value(), NULL, NULL, 0, patterns, NULL, 0, ps_object_value(), NULL, 0,
                                  properties, ps_object_value()};
    bool valid = context.errors && context.unique_positions && context.reference_ids &&
        validate_properties(properties, data, &context, NULL, 0, 0, false);
    ps_value *hidden = valid ? ps_array_value() : NULL;
    ps_text *hidden_path = valid ? malloc(2 * sizeof(*hidden_path)) : NULL;
    bool collected = hidden && hidden_path && collect_hidden(properties, data, &context, hidden_path, 0, hidden);
    free(hidden_path);
    free(context.declaration);
    free(context.row_keys);
    release_unique_rows(&context);
    ps_value_free(context.reference_ids);
    ps_pattern_cache_free(patterns);
    ps_value_free(properties);
    if (!valid || !collected) {
        ps_value_free(context.errors); ps_value_free(hidden);
        if (context.failure) return (ps_result){NULL, context.failure};
        return ps_fail("internal", "INTERNAL_ERROR", "Validation failed", "");
    }
    return validation_result(context.errors, hidden);
}

/* Compose a list or detail root; NULL with *error unset means an internal failure. */
static ps_value *compose_view_root(const ps_value *spec, const ps_value *options, ps_value **error)
{
    ps_value *composed = ps_compose_spec(spec, option_files(options), option_basepath(options), error);
    if (!composed && !*error) composed = ps_object_value();
    return composed;
}

/* Expand an object map member of a composed view root with properties composition. */
static void compose_view_map(ps_value *composed, const char *key, const ps_value *options, ps_value **error)
{
    const ps_value *map = ps_get(composed, key);
    if (*error || !map || map->kind != PS_OBJECT) return;
    ps_value *resolved = ps_compose_properties(map, option_files(options), option_basepath(options), error);
    if (resolved && !ps_set(composed, key, resolved)) { ps_value_free(resolved); }
}

/* Scan the composed view tree and return the clean-load result. */
static ps_result finish_view(ps_value *composed, ps_value *error)
{
    if (!error) error = ps_scan_forbidden(composed, NULL, 0);
    ps_value_free(composed);
    if (error) return (ps_result){NULL, error};
    return validation_result(ps_array_value(), NULL);
}

static ps_result validate_list(const ps_value *spec, const ps_value *options)
{
    ps_value *error = NULL;
    ps_value *composed = compose_view_root(spec, options, &error);
    if (error) return (ps_result){NULL, error};
    compose_view_map(composed, "columns", options, &error);
    const ps_value *search = ps_get(composed, "search");
    if (search && search->kind == PS_OBJECT && (ps_has(search, "$ref") || ps_has(search, "$patch")))
        compose_view_map(composed, "search", options, &error);
    return finish_view(composed, error);
}

static ps_result validate_detail(const ps_value *spec, const ps_value *options)
{
    ps_value *error = NULL;
    ps_value *composed = compose_view_root(spec, options, &error);
    if (error) return (ps_result){NULL, error};
    compose_view_map(composed, "fields", options, &error);
    return finish_view(composed, error);
}
