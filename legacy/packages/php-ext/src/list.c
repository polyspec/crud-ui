#include "engine_internal.h"

#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

typedef struct {
    uint32_t limbs[64];
    size_t length;
} list_bigint;

typedef struct {
    const ps_value *spec;
    const ps_value *columns;
    const ps_value *rows;
    const ps_value *options;
    ps_text language;
    const char *layout;
    const ps_value *data;
    ps_html_buffer output;
    ps_chars *preloads;
    size_t preload_count;
    size_t preload_capacity;
    /* The input failure message of a cell that cannot be displayed, or NULL. */
    const char *failure;
} list_context;

typedef struct {
    ps_text key;
    const ps_value *column;
    ps_text field;
    ps_text type;
    const ps_value *format;
    ps_value *design;
    bool sortable;
} list_column;

/*
 * A page or total option. Absent or null is none: returns true with *present false. Any other
 * value must be a number whose value is an integer from min to 2^53 - 1; an integral float such
 * as 2.0 or -0.0 is the integer 2 or 0.
 */
static bool count_option(const ps_value *value, int64_t min, bool *present, int64_t *count)
{
    const int64_t max = 9007199254740991LL;
    *present = false;
    if (!value || value->kind == PS_NULL) return true;
    if (value->kind == PS_INT) {
        if (value->data.integer < min || value->data.integer > max) return false;
        *count = value->data.integer;
    } else if (value->kind == PS_FLOAT) {
        double number = value->data.number;
        if (!isfinite(number) || trunc(number) != number || number < (double)min || number > (double)max)
            return false;
        *count = (int64_t)number;
    } else {
        return false;
    }
    *present = true;
    return true;
}

static bool write_element_start(ps_html_buffer *out, const char *tag, ps_value *attrs)
{
    bool ok = ps_html_start_element(out, ps_fixed(tag), attrs, false, false);
    ps_value_free(attrs);
    return ok;
}

static bool write_element_end(ps_html_buffer *out, const char *tag)
{
    return ps_html_end_element(out, ps_fixed(tag));
}

static const ps_value *format_options(const ps_value *column)
{
    const ps_value *format = member(column, "format");
    return format && format->kind == PS_OBJECT ? format : NULL;
}

static ps_text format_type(const ps_value *column)
{
    const ps_value *format = member(column, "format");
    if (format && format->kind == PS_STRING && format->data.string.length) return ps_string(format);
    if (format && format->kind == PS_OBJECT) {
        ps_text type = text_member(format, "type");
        if (type.length) return type;
    }
    return PS_TEXT("text");
}

static bool is_string(const ps_value *value, const char *text)
{
    return value && value->kind == PS_STRING && ps_is_string(value, text);
}

static bool list_truthy(const ps_value *value)
{
    if (is_string(value, "0") || is_string(value, "false")) return false;
    return ps_truthy(value);
}

static const ps_value *column_value(const ps_value *row, ps_text field)
{
    if (!field.length) return NULL;
    return ps_path(row, field);
}

static bool visible_column(const ps_value *column, const ps_value *data, ps_value **design)
{
    *design = ps_design(member(column, "design"), data, PS_TEXT(""), NULL, 0);
    return *design && bool_member(*design, "show");
}

static bool sortable_column(const ps_value *column, const ps_value *data)
{
    const ps_value *sortable = member(column, "sortable");
    if (!sortable || sortable->kind == PS_NULL) return false;
    if (sortable->kind == PS_STRING) {
        bool parsed = false;
        bool result = ps_expression_truth(ps_string(sortable), data, NULL, NULL, 0, &parsed);
        return parsed && result;
    }
    /* A condition map that selects nothing is false. */
    if (sortable->kind == PS_OBJECT) {
        ps_value *selected = ps_condition_value(sortable, data, NULL, NULL, 0);
        bool result = ps_truthy(selected);
        ps_value_free(selected);
        return result;
    }
    return ps_truthy(sortable);
}

static bool collect_columns(list_context *context, list_column **result, size_t *count)
{
    *result = NULL;
    *count = 0;
    for (size_t i = 0; i < ps_size(context->columns); ++i) {
        const ps_value *column = ps_at(context->columns, i);
        ps_value *design = NULL;
        if (!visible_column(column, context->data, &design)) {
            if (!design) goto fail;
            ps_value_free(design);
            continue;
        }
        list_column *resized = realloc(*result, (*count + 1) * sizeof(**result));
        if (!resized) { ps_value_free(design); goto fail; }
        *result = resized;
        ps_text field = text_member(column, "field");
        (*result)[(*count)++] = (list_column){
            ps_key(context->columns, i), column, field, format_type(column),
            format_options(column), design, sortable_column(column, context->data)
        };
    }
    return true;
fail:
    for (size_t i = 0; i < *count; ++i) ps_value_free((*result)[i].design);
    free(*result);
    *result = NULL;
    *count = 0;
    return false;
}

static void free_columns(list_column *columns, size_t count)
{
    for (size_t i = 0; i < count; ++i) ps_value_free(columns[i].design);
    free(columns);
}

static ps_chars translated(const ps_value *value, ps_text language)
{
    return ps_translate(value, language);
}

static bool append_class_style(ps_value *attrs, ps_text base, const ps_value *design)
{
    const ps_value *main = member(design, "main");
    ps_chars class_name = ps_join_classes(base, text_member(main, "class"), PS_TEXT(""));
    bool ok = class_name.bytes && ps_html_attr_text(attrs, "class", ps_view(class_name));
    ps_text style = text_member(main, "style");
    if (ok && style.length) ok = ps_html_attr_text(attrs, "style", style);
    free(class_name.bytes);
    return ok;
}

static bool append_interpolated(ps_html_buffer *out, const ps_value *template,
                                const ps_value *row, const ps_value *field)
{
    if (!template || template->kind != PS_STRING) return true;
    const char *value = template->data.string.bytes;
    size_t length = template->data.string.length;
    for (size_t i = 0; i < length;) {
        if (value[i] == '{' && i + 2 < length && value[i + 1] == '=' &&
            (isalpha((unsigned char)value[i + 2]) || value[i + 2] == '_')) {
            size_t end = i + 3;
            while (end < length && (isalnum((unsigned char)value[end]) ||
                   value[end] == '_' || value[end] == '.')) end++;
            if (end >= length || value[end] != '}') {
                if (!ps_html_character(out, value[i++])) return false;
                continue;
            }
            ps_text path = {value + i + 2, end - i - 2};
            const ps_value *replacement = ps_text_is(path, "field") ? field : ps_path(row, path);
            if (!replacement) replacement = field;
            ps_chars scalar = ps_scalar_string(replacement);
            if (!scalar.bytes || !ps_html_append(out, ps_view(scalar))) { free(scalar.bytes); return false; }
            free(scalar.bytes);
            i = end + 1;
        } else {
            if (!ps_html_character(out, value[i++])) return false;
        }
    }
    return true;
}

static bool interpolated_value(const ps_value *template, const ps_value *row,
                               const ps_value *field, ps_value **result)
{
    ps_html_buffer out = {0};
    if (!append_interpolated(&out, template, row, field)) { free(out.data); return false; }
    *result = ps_html_value(&out);
    return *result != NULL;
}

static bool utf8_space(const unsigned char *value, size_t length, size_t *width)
{
    if (!length) return false;
    if (value[0] >= 0x09 && value[0] <= 0x0d) { *width = 1; return true; }
    if (value[0] == 0x20) { *width = 1; return true; }
    static const unsigned char two[][2] = {{0xc2,0xa0},{0xe1,0x9a}};
    if (length >= 2 && value[0] == two[0][0] && value[1] == two[0][1]) { *width = 2; return true; }
    if (length >= 3) {
        unsigned code = ((value[0] & 0x0f) << 12) | ((value[1] & 0x3f) << 6) | (value[2] & 0x3f);
        if (code == 0x1680 || (code >= 0x2000 && code <= 0x200a) ||
            code == 0x2028 || code == 0x2029 || code == 0x202f || code == 0x205f ||
            code == 0x3000 || code == 0xfeff) { *width = 3; return true; }
    }
    return false;
}

/* The text of a value with Unicode spaces trimmed; the owned copy ends with a zero byte. */
static bool numeric_text(const ps_value *value, ps_chars *result)
{
    if (!value) { *result = ps_copy(PS_TEXT("")); return result->bytes != NULL; }
    if (value->kind == PS_STRING) {
        size_t start = 0, end = value->data.string.length, width;
        const unsigned char *bytes = (const unsigned char *)value->data.string.bytes;
        while (start < end && utf8_space(bytes + start, end - start, &width)) start += width;
        while (end > start) {
            size_t candidate = end - 1;
            while (candidate > start && (bytes[candidate] & 0xc0) == 0x80) candidate--;
            if (!utf8_space(bytes + candidate, end - candidate, &width) || candidate + width != end) break;
            end = candidate;
        }
        *result = ps_copy(ps_text_slice(ps_string(value), start, end));
        return result->bytes != NULL;
    }
    *result = ps_scalar_string(value);
    return result->bytes != NULL;
}

static void bigint_normalize(list_bigint *value)
{
    while (value->length && !value->limbs[value->length - 1]) value->length--;
}

static void bigint_from_u64(list_bigint *value, uint64_t input)
{
    memset(value, 0, sizeof(*value));
    if (!input) return;
    value->limbs[0] = (uint32_t)input;
    value->limbs[1] = (uint32_t)(input >> 32);
    value->length = value->limbs[1] ? 2 : 1;
}

static bool bigint_multiply(list_bigint *value, uint32_t factor)
{
    uint64_t carry = 0;
    for (size_t i = 0; i < value->length; ++i) {
        uint64_t product = (uint64_t)value->limbs[i] * factor + carry;
        value->limbs[i] = (uint32_t)product;
        carry = product >> 32;
    }
    if (carry) {
        if (value->length == sizeof(value->limbs) / sizeof(value->limbs[0])) return false;
        value->limbs[value->length++] = (uint32_t)carry;
    }
    return true;
}

static bool bigint_add(list_bigint *value, uint32_t addend)
{
    if (!value->length) {
        if (!addend) return true;
        value->limbs[0] = addend;
        value->length = 1;
        return true;
    }
    uint64_t sum = (uint64_t)value->limbs[0] + addend;
    value->limbs[0] = (uint32_t)sum;
    uint32_t carry = (uint32_t)(sum >> 32);
    size_t i = 1;
    while (carry && i < value->length) {
        carry = ++value->limbs[i] == 0;
        i++;
    }
    if (!carry) return true;
    if (value->length == sizeof(value->limbs) / sizeof(value->limbs[0])) return false;
    value->limbs[value->length++] = 1;
    return true;
}

static bool bigint_shift_left(list_bigint *value, unsigned bits)
{
    if (!value->length || !bits) return true;
    size_t words = bits / 32;
    unsigned remainder = bits % 32;
    size_t extra = words + (remainder ? 1 : 0);
    if (value->length + extra > sizeof(value->limbs) / sizeof(value->limbs[0])) return false;
    if (words) {
        memmove(value->limbs + words, value->limbs, value->length * sizeof(value->limbs[0]));
        memset(value->limbs, 0, words * sizeof(value->limbs[0]));
        value->length += words;
    }
    if (remainder) {
        uint32_t carry = 0;
        for (size_t i = words; i < value->length; ++i) {
            uint32_t next = value->limbs[i] >> (32 - remainder);
            value->limbs[i] = (value->limbs[i] << remainder) | carry;
            carry = next;
        }
        if (carry) value->limbs[value->length++] = carry;
    }
    return true;
}

static bool bigint_bit(const list_bigint *value, unsigned bit)
{
    size_t word = bit / 32;
    return word < value->length && (value->limbs[word] & (UINT32_C(1) << (bit % 32)));
}

static unsigned bigint_bit_length(const list_bigint *value)
{
    if (!value->length) return 0;
    uint32_t high = value->limbs[value->length - 1];
    unsigned bits = (unsigned)((value->length - 1) * 32);
    while (high) { bits++; high >>= 1; }
    return bits;
}

static bool bigint_any_lower_bits(const list_bigint *value, unsigned count)
{
    size_t words = count / 32;
    unsigned remainder = count % 32;
    for (size_t i = 0; i < words && i < value->length; ++i)
        if (value->limbs[i]) return true;
    if (remainder && words < value->length &&
        (value->limbs[words] & ((UINT32_C(1) << remainder) - 1))) return true;
    return false;
}

static void bigint_shift_right(list_bigint *value, unsigned bits)
{
    size_t words = bits / 32;
    unsigned remainder = bits % 32;
    if (words >= value->length) { value->length = 0; return; }
    if (words) {
        memmove(value->limbs, value->limbs + words,
                (value->length - words) * sizeof(value->limbs[0]));
        value->length -= words;
    }
    if (remainder) {
        uint32_t carry = 0;
        for (size_t i = value->length; i-- > 0;) {
            uint32_t next = value->limbs[i] << (32 - remainder);
            value->limbs[i] = (value->limbs[i] >> remainder) | carry;
            carry = next;
        }
    }
    bigint_normalize(value);
}

static bool bigint_increment(list_bigint *value)
{
    size_t i = 0;
    while (i < value->length && ++value->limbs[i] == 0) i++;
    if (i < value->length) return true;
    if (!value->length) { value->limbs[0] = 1; value->length = 1; return true; }
    if (value->length == sizeof(value->limbs) / sizeof(value->limbs[0])) return false;
    value->limbs[value->length++] = 1;
    return true;
}

static uint32_t bigint_divide(list_bigint *value, uint32_t divisor)
{
    uint64_t remainder = 0;
    for (size_t i = value->length; i-- > 0;) {
        uint64_t current = (remainder << 32) | value->limbs[i];
        value->limbs[i] = (uint32_t)(current / divisor);
        remainder = current % divisor;
    }
    bigint_normalize(value);
    return (uint32_t)remainder;
}

static char *bigint_decimal(const list_bigint *value)
{
    if (!value->length) return ps_copy(PS_TEXT("0")).bytes;
    list_bigint work = *value;
    uint32_t chunks[64];
    size_t count = 0;
    while (work.length) chunks[count++] = bigint_divide(&work, UINT32_C(1000000000));
    size_t capacity = count * 9 + 1;
    char *result = malloc(capacity);
    if (!result) return NULL;
    size_t length = (size_t)snprintf(result, capacity, "%u", chunks[count - 1]);
    while (--count) length += (size_t)snprintf(result + length, capacity - length,
                                                "%09u", chunks[count - 1]);
    return result;
}

static bool parse_radix_number(ps_text source, unsigned radix, double *number)
{
    list_bigint integer;
    bigint_from_u64(&integer, 0);
    for (size_t i = 2; i < source.length; ++i) {
        char c = source.bytes[i];
        unsigned digit = c >= '0' && c <= '9' ? (unsigned)(c - '0')
            : c >= 'a' && c <= 'f' ? (unsigned)(c - 'a' + 10)
            : c >= 'A' && c <= 'F' ? (unsigned)(c - 'A' + 10)
            : radix;
        if (digit >= radix || !bigint_multiply(&integer, radix) ||
            !bigint_add(&integer, digit)) return false;
    }
    unsigned bits = bigint_bit_length(&integer);
    if (!bits) { *number = 0; return true; }
    if (bits > 1024) { *number = INFINITY; return false; }
    unsigned shift = bits > 53 ? bits - 53 : 0;
    bool half = shift && bigint_bit(&integer, shift - 1);
    bool lower = shift > 1 && bigint_any_lower_bits(&integer, shift - 1);
    bigint_shift_right(&integer, shift);
    bool odd = bigint_bit(&integer, 0);
    if (half && (lower || odd) && !bigint_increment(&integer)) return false;
    if (bigint_bit_length(&integer) > 53) { bigint_shift_right(&integer, 1); shift++; }
    uint64_t significand = integer.length ? integer.limbs[0] : 0;
    if (integer.length > 1)
        significand |= (uint64_t)integer.limbs[1] * UINT64_C(0x100000000);
    *number = ldexp((double)significand, (int)shift);
    return isfinite(*number);
}

static bool parse_number(const ps_value *value, double *number)
{
    if (value && value->kind == PS_INT) { *number = (double)value->data.integer; return true; }
    if (value && value->kind == PS_FLOAT) { *number = value->data.number; return true; }
    ps_chars source = {NULL, 0};
    if (!numeric_text(value, &source)) return false;
    if (!source.length) { free(source.bytes); *number = 0; return true; }
    /* A radix literal is read only unsigned: -0x10 is no number, as the library reads its string values. */
    size_t sign = source.bytes[0] == '-' || source.bytes[0] == '+' ? 1 : 0;
    char marker = source.length > sign + 1 ? source.bytes[sign + 1] : 0;
    bool radix_number = source.length > sign + 1 && source.bytes[sign] == '0' && (marker == 'x' || marker == 'X' ||
        marker == 'o' || marker == 'O' || marker == 'b' || marker == 'B');
    if (radix_number) {
        if (sign) { free(source.bytes); return false; }
        unsigned radix = marker == 'x' || marker == 'X' ? 16
            : marker == 'o' || marker == 'O' ? 8 : 2;
        bool ok = source.length > 2 && parse_radix_number(ps_view(source), radix, number);
        free(source.bytes);
        return ok;
    }
    /* The C number syntax, read independently of the locale. */
    bool overflow = false;
    bool ok = ps_c_number(ps_view(source), number, &overflow) == source.length && isfinite(*number);
    free(source.bytes);
    return ok;
}

static ps_chars fixed_number(double number, int decimals)
{
    const ps_chars failed = {NULL, 0};
    if (fabs(number) >= 1e21) return ps_number_text(number);
    bool negative = number < 0;
    double absolute = fabs(number);
    uint64_t bits;
    memcpy(&bits, &absolute, sizeof(bits));
    unsigned encoded_exponent = (unsigned)((bits >> 52) & UINT64_C(0x7ff));
    uint64_t significand = bits & UINT64_C(0x000fffffffffffff);
    int exponent;
    if (encoded_exponent) {
        significand |= UINT64_C(0x0010000000000000);
        exponent = (int)encoded_exponent - 1023 - 52;
    } else exponent = -1074;
    list_bigint integer;
    bigint_from_u64(&integer, significand);
    for (int i = 0; i < decimals; ++i)
        if (!bigint_multiply(&integer, 5)) return failed;
    int binary_shift = exponent + decimals;
    if (binary_shift >= 0) {
        if (!bigint_shift_left(&integer, (unsigned)binary_shift)) return failed;
    } else {
        unsigned shift = (unsigned)-binary_shift;
        bool round_up = shift && bigint_bit(&integer, shift - 1);
        bigint_shift_right(&integer, shift);
        if (round_up && !bigint_increment(&integer)) return failed;
    }
    char *digits = bigint_decimal(&integer);
    if (!digits) return failed;
    size_t length = strlen(digits);
    size_t integer_length = length > (size_t)decimals ? length - (size_t)decimals : 1;
    size_t zeros = length < (size_t)decimals ? (size_t)decimals - length : 0;
    size_t total = (negative ? 1 : 0) + integer_length +
        (decimals ? 1 + (size_t)decimals : 0);
    char *result = malloc(total + 1);
    if (!result) { free(digits); return failed; }
    char *cursor = result;
    if (negative) *cursor++ = '-';
    if (!decimals) { memcpy(cursor, digits, length); cursor += length; }
    else if (length <= (size_t)decimals) {
        *cursor++ = '0'; *cursor++ = '.';
        memset(cursor, '0', zeros); cursor += zeros;
        memcpy(cursor, digits, length); cursor += length;
    } else {
        memcpy(cursor, digits, integer_length); cursor += integer_length;
        *cursor++ = '.';
        memcpy(cursor, digits + integer_length, (size_t)decimals); cursor += decimals;
    }
    *cursor = '\0';
    free(digits);
    return (ps_chars){result, (size_t)(cursor - result)};
}

/* A decimal number with its integer digits grouped by three; the number has no NUL character. */
static bool append_grouped(ps_html_buffer *out, ps_text number)
{
    /* Only the leading digit run is grouped; an exponent such as "1e+21" keeps its digits. */
    size_t start = number.length && number.bytes[0] == '-' ? 1 : 0;
    size_t end = start;
    while (end < number.length && isdigit((unsigned char)number.bytes[end])) end++;
    if (start && !ps_html_character(out, '-')) return false;
    for (size_t cursor = start; cursor < end; ++cursor) {
        if (cursor > start && (end - cursor) % 3 == 0 &&
            !ps_html_character(out, ',')) return false;
        if (!ps_html_character(out, number.bytes[cursor])) return false;
    }
    return end == number.length || ps_html_append(out, ps_text_slice(number, end, number.length));
}

/* Take ownership of owned text and return it as a string value. */
static ps_value *owned_text(ps_chars text)
{
    return ps_chars_value(text);
}

/* The unescaped text collected in a buffer, or NULL after a failure. */
static ps_value *buffer_text(ps_html_buffer *buffer, bool ok)
{
    if (ok) return ps_html_value(buffer);
    free(buffer->data);
    buffer->data = NULL;
    return NULL;
}

/* A display string: string values keep their bytes, other scalars use scalar text. */
static ps_value *scalar_text(const ps_value *value)
{
    return value && value->kind == PS_STRING ? ps_value_clone(value) : owned_text(ps_scalar_string(value));
}

static ps_value *number_display(const ps_value *value, const ps_value *options, ps_text language,
                                const char **failure)
{
    double number;
    if (!parse_number(value, &number)) return scalar_text(value);
    ps_chars body = {NULL, 0};
    const ps_value *decimals = member(options, "decimals");
    if (decimals && (decimals->kind == PS_INT || decimals->kind == PS_FLOAT)) {
        double raw = decimals->kind == PS_INT ? (double)decimals->data.integer : decimals->data.number;
        double truncated = trunc(raw);
        /* NaN fails both comparisons. */
        if (!(truncated >= 0 && truncated <= 100)) {
            *failure = "Number decimals must be between 0 and 100";
            return NULL;
        }
        body = fixed_number(number, (int)truncated);
    } else body = ps_number_text(number);
    ps_chars prefix = translated(member(options, "prefix"), language);
    ps_chars suffix = translated(member(options, "suffix"), language);
    ps_html_buffer text = {0};
    bool ok = body.bytes && prefix.bytes && suffix.bytes && ps_html_append(&text, ps_view(prefix));
    if (ok) ok = list_truthy(member(options, "thousands"))
        ? append_grouped(&text, ps_view(body)) : ps_html_append(&text, ps_view(body));
    if (ok) ok = ps_html_append(&text, ps_view(suffix));
    free(body.bytes); free(prefix.bytes); free(suffix.bytes);
    return buffer_text(&text, ok);
}

static ps_value *text_display(const ps_value *value, const ps_value *options)
{
    ps_html_buffer out = {0};
    ps_chars owned = ps_scalar_string(value);
    if (!owned.bytes) return NULL;
    const char *text = owned.bytes;
    /* Only a number limits the text; its integer part counts Unicode code points. */
    const ps_value *limit_value = member(options, "truncate");
    double limit = limit_value && limit_value->kind == PS_INT ? (double)limit_value->data.integer
        : limit_value && limit_value->kind == PS_FLOAT ? trunc(limit_value->data.number) : 0;
    size_t length = owned.length, bytes = length;
    /* NaN fails the comparison. */
    if (limit >= 1) {
        size_t points = 0;
        for (size_t i = 0; i < length; ++i)
            if (((unsigned char)text[i] & 0xc0) != 0x80) points++;
        if ((double)points > limit) {
            /* The limit is below the code point count, so it fits in size_t. */
            size_t kept = (size_t)limit;
            points = 0;
            for (bytes = 0; bytes < length; ++bytes)
                if (((unsigned char)text[bytes] & 0xc0) != 0x80 && points++ == kept) break;
        }
    }
    bool ok = ps_html_bytes(&out, text, bytes);
    if (ok && bytes < length) ok = ps_html_text(&out, "…");
    free(owned.bytes);
    return buffer_text(&out, ok);
}

static bool add_preload(list_context *context, const ps_value *source)
{
    if (!source || source->kind != PS_STRING || !source->data.string.length) return true;
    ps_text text = ps_string(source);
    if (text.length >= 5 && !strncasecmp(text.bytes, "data:", 5)) return true;
    for (size_t i = 0; i < context->preload_count; ++i)
        if (ps_text_equal(ps_view(context->preloads[i]), text)) return true;
    if (context->preload_count == context->preload_capacity) {
        size_t capacity = context->preload_capacity ? context->preload_capacity * 2 : 4;
        ps_chars *items = realloc(context->preloads, capacity * sizeof(*items));
        if (!items) return false;
        context->preloads = items;
        context->preload_capacity = capacity;
    }
    ps_chars copy = ps_copy(text);
    if (!copy.bytes) return false;
    context->preloads[context->preload_count++] = copy;
    return true;
}

static bool set_fixed(ps_value *object, const char *key, const char *text)
{
    return ps_set(object, key, ps_string_value(text));
}

static bool set_value(ps_value *object, const char *key, ps_value **value)
{
    ps_value *owned = *value;
    *value = NULL;
    return owned && ps_set(object, key, owned);
}

/* A structured display with its kind as the first member. */
static ps_value *display_object(const char *kind)
{
    ps_value *display = ps_object_value();
    if (display && !set_fixed(display, "kind", kind)) { ps_value_free(display); return NULL; }
    return display;
}

/*
 * Evaluate one cell into its display model: a string for text, date, number and
 * choice-label, or an object for badge, link, bool, image and html. The list and
 * detail writers render only from this model.
 */
static ps_value *cell_display(const list_column *column, const ps_value *row,
                              const ps_value *value, ps_text language, const char **failure)
{
    const ps_value *options = column->format;
    ps_text type = column->type;
    if (ps_text_is(type, "date")) {
        ps_chars scalar = ps_scalar_string(value);
        ps_text pattern = text_member(options, "pattern");
        if (!pattern.length) pattern = PS_TEXT("YYYY-MM-DD");
        ps_chars formatted = scalar.bytes ? ps_format_date_pattern(ps_view(scalar), pattern) : scalar;
        free(scalar.bytes);
        return owned_text(formatted);
    }
    if (ps_text_is(type, "number")) return number_display(value, options, language, failure);
    if (ps_text_is(type, "badge")) {
        ps_chars key = ps_scalar_string(value);
        const ps_value *map = member(options, "map");
        const ps_value *mapped = key.bytes && map && map->kind == PS_OBJECT
            ? ps_get_text(map, ps_view(key)) : NULL;
        bool localized = mapped && (mapped->kind == PS_OBJECT || mapped->kind == PS_ARRAY);
        ps_chars variant = localized ? translated(mapped, language) : ps_scalar_string(mapped);
        ps_chars label = localized ? translated(mapped, language) : ps_copy(ps_view(key));
        ps_value *display = key.bytes ? display_object("badge") : NULL;
        bool ok = display && variant.bytes && label.bytes &&
            set_text(display, "variant", ps_view(variant)) && set_text(display, "label", ps_view(label));
        free(key.bytes); free(variant.bytes); free(label.bytes);
        if (!ok) { ps_value_free(display); return NULL; }
        return display;
    }
    if (ps_text_is(type, "link")) {
        const ps_value *href_template = member(options, "href");
        ps_value *selected = NULL, *href = NULL;
        if (href_template && href_template->kind == PS_OBJECT)
            selected = ps_condition_value(href_template, row, NULL, NULL, 0);
        else selected = href_template ? ps_value_clone(href_template) : ps_string_value("");
        bool ok = selected && interpolated_value(selected, row, value, &href);
        ps_value_free(selected);
        const ps_value *caption_source = member(options, "text");
        /* Only absent, null or empty-string text falls back to the cell value. */
        bool fallback = !caption_source || caption_source->kind == PS_NULL ||
            (caption_source->kind == PS_STRING && caption_source->data.string.length == 0);
        ps_chars caption = fallback ? ps_scalar_string(value) : translated(caption_source, language);
        ps_value *display = display_object("link");
        if (ok) ok = display && caption.bytes && set_value(display, "href", &href) &&
            set_text(display, "text", ps_view(caption));
        ps_text target = text_member(options, "target");
        if (ok && target.length) ok = set_text(display, "target", target);
        ps_value_free(href); free(caption.bytes);
        if (!ok) { ps_value_free(display); return NULL; }
        return display;
    }
    if (ps_text_is(type, "choice-label")) {
        ps_chars key = ps_scalar_string(value);
        if (!key.bytes) return NULL;
        const ps_value *items = member(options, "items");
        const ps_value *label = NULL;
        if (ps_is_choice_list(items)) {
            bool failed = false;
            label = ps_choice_label(items, ps_view(key), &failed);
            if (failed) { free(key.bytes); return NULL; }
        } else if (items && items->kind == PS_ARRAY) {
            /* strtoul stops at a NUL character inside the key or at its terminating zero. */
            char *end = NULL; unsigned long index = strtoul(key.bytes, &end, 10);
            if (end == key.bytes + key.length) label = ps_at(items, (size_t)index);
        } else if (items && items->kind == PS_OBJECT && !ps_has(items, "model"))
            label = ps_get_text(items, ps_view(key));
        /* A choice label is content: a string or a language map. */
        ps_chars display = label ? translated(label, language) : ps_copy(ps_view(key));
        free(key.bytes);
        return owned_text(display);
    }
    if (ps_text_is(type, "bool")) {
        bool truth = list_truthy(value);
        const ps_value *source = member(options, truth ? "true" : "false");
        ps_chars label = source && source->kind != PS_NULL ? translated(source, language)
            : ps_copy(truth ? PS_TEXT("true") : PS_TEXT("false"));
        ps_text as = text_member(options, "as");
        if (!as.length) as = PS_TEXT("text");
        ps_value *display = display_object("bool");
        bool ok = display && label.bytes && ps_set(display, "value", ps_bool_value(truth)) &&
            set_text(display, "label", ps_view(label)) && set_text(display, "as", as);
        free(label.bytes);
        if (!ok) { ps_value_free(display); return NULL; }
        return display;
    }
    if (ps_text_is(type, "image")) {
        const ps_value *alt_template = member(options, "alt");
        ps_chars translated_alt = alt_template ? translated(alt_template, language) : ps_copy(PS_TEXT(""));
        ps_value *translated_value = translated_alt.bytes ? ps_text_value(ps_view(translated_alt)) : NULL;
        ps_value *alt = NULL;
        bool ok = translated_value && interpolated_value(translated_value, row, value, &alt);
        ps_value_free(translated_value); free(translated_alt.bytes);
        ps_value *display = display_object("image");
        ps_value *source = scalar_text(value);
        if (ok) ok = display && set_value(display, "src", &source) && set_value(display, "alt", &alt);
        for (size_t i = 0; ok && i < 2; ++i) {
            const char *name = i ? "height" : "width";
            const ps_value *dimension = member(options, name);
            /* An absent dimension is omitted; a declared null one is empty text. */
            if (!dimension) continue;
            ps_value *text = dimension->kind == PS_NULL ? ps_string_value("") : scalar_text(dimension);
            ok = set_value(display, name, &text);
        }
        ps_value_free(source); ps_value_free(alt);
        if (!ok) { ps_value_free(display); return NULL; }
        return display;
    }
    if (ps_text_is(type, "html")) {
        ps_value *display = display_object("html");
        ps_value *html = scalar_text(value);
        if (!display || !set_value(display, "html", &html)) {
            ps_value_free(display); ps_value_free(html); return NULL;
        }
        return display;
    }
    return text_display(value, options);
}

static bool append_text_member(ps_html_buffer *out, const ps_value *display, const char *key)
{
    const ps_value *text = member(display, key);
    return text && text->kind == PS_STRING && ps_html_escaped(out, ps_string(text), false);
}

/* Write the markup of one display model and record the image it preloads. */
static bool append_display(list_context *context, const ps_value *display)
{
    ps_html_buffer *out = &context->output;
    if (!display) return false;
    if (display->kind == PS_STRING) return ps_html_escaped(out, ps_string(display), false);
    ps_text kind = text_member(display, "kind");
    if (ps_text_is(kind, "html")) {
        const ps_value *html = member(display, "html");
        return html && html->kind == PS_STRING && ps_html_append(out, ps_string(html));
    }
    ps_value *attrs = ps_object_value();
    if (!attrs) return false;
    const char *tag = "span", *text = NULL, *glyph = NULL;
    bool ok = true;
    if (ps_text_is(kind, "badge")) {
        ps_text variant = text_member(display, "variant");
        ok = ps_html_attr_string(attrs, "class", "crudui-badge");
        if (ok && variant.length) ok = ps_html_attr_text(attrs, "data-crudui-variant", variant);
        text = "label";
    } else if (ps_text_is(kind, "link")) {
        tag = "a";
        ok = ps_html_attr_clone(attrs, "href", member(display, "href"));
        if (ok && ps_has(display, "target")) ok = ps_html_attr_clone(attrs, "target", member(display, "target"));
        text = "text";
    } else if (ps_text_is(kind, "image")) {
        tag = "img";
        ok = ps_html_attr_clone(attrs, "src", member(display, "src")) &&
            ps_html_attr_clone(attrs, "alt", member(display, "alt"));
        for (size_t i = 0; ok && i < 2; ++i) {
            const char *name = i ? "height" : "width";
            if (ps_has(display, name)) ok = ps_html_attr_clone(attrs, name, member(display, name));
        }
        if (ok) ok = add_preload(context, member(display, "src"));
    } else if (ps_text_is(kind, "bool")) {
        ps_text as = text_member(display, "as");
        bool truth = bool_member(display, "value");
        if (ps_text_is(as, "check")) {
            ok = ps_html_attr_string(attrs, "class", "crudui-bool crudui-bool--check") &&
                ps_html_attr_string(attrs, "data-crudui-state", truth ? "true" : "false") &&
                ps_html_attr_clone(attrs, "aria-label", member(display, "label"));
            glyph = truth ? "✔" : "✘";
        } else if (ps_text_is(as, "icon")) {
            ok = ps_html_attr_string(attrs, "class", "crudui-bool crudui-bool--icon") &&
                ps_html_attr_string(attrs, "data-crudui-state", truth ? "true" : "false") &&
                ps_html_attr_clone(attrs, "aria-label", member(display, "label"));
        } else {
            ok = ps_html_attr_string(attrs, "class", "crudui-bool crudui-bool--text") &&
                ps_html_attr_string(attrs, "data-crudui-state", truth ? "true" : "false");
            text = "label";
        }
    } else {
        ps_value_free(attrs);
        return false;
    }
    if (!ok) { ps_value_free(attrs); return false; }
    ok = write_element_start(out, tag, attrs);
    if (ok && text) ok = append_text_member(out, display, text);
    if (ok && glyph) ok = ps_html_text(out, glyph);
    return ok && write_element_end(out, tag);
}

/* Read one cell of a row: its value, its row-evaluated design and its display. */
static bool evaluate_cell(list_context *context, const list_column *column,
                          const ps_value *row, const ps_value **value,
                          ps_value **display, ps_value **design)
{
    *value = column_value(row, column->field);
    *design = ps_design(member(column->column, "design"), row, column->field, NULL, 0);
    *display = *design ? cell_display(column, row, *value, context->language, &context->failure) : NULL;
    if (*display) return true;
    ps_value_free(*design);
    *design = NULL;
    return false;
}

/* Write an evaluated cell inside a host element carrying the cell design. */
static bool write_cell(list_context *context, const ps_value *design, const ps_value *display,
                       const char *tag, ps_text base)
{
    ps_value *attrs = design ? ps_object_value() : NULL;
    if (!attrs || !append_class_style(attrs, base, design)) { ps_value_free(attrs); return false; }
    return write_element_start(&context->output, tag, attrs) &&
        append_display(context, display) && write_element_end(&context->output, tag);
}

static bool append_cell(list_context *context, const list_column *column,
                        const ps_value *row, const char *tag, ps_text base)
{
    const ps_value *value = NULL;
    ps_value *display = NULL, *design = NULL;
    if (!evaluate_cell(context, column, row, &value, &display, &design)) return false;
    bool ok = write_cell(context, design, display, tag, base);
    ps_value_free(display);
    ps_value_free(design);
    return ok;
}

static ps_chars column_label(const list_column *column, ps_text language)
{
    const ps_value *label = member(column->column, "label");
    return label ? translated(label, language) : ps_copy(column->key);
}

/* An action label: the translated label of an object action, else the action key. */
static ps_chars action_label(const ps_value *action, ps_text key, ps_text language)
{
    return action->kind == PS_OBJECT && member(action, "label")
        ? translated(member(action, "label"), language) : ps_copy(key);
}

/* The actions of a list or detail: <block>__actions with one <block>__action span per action. */
static bool append_toolbar(list_context *context, const char *block)
{
    char actions_class[32], action_class[32];
    snprintf(actions_class, sizeof actions_class, "%s__actions", block);
    snprintf(action_class, sizeof action_class, "%s__action", block);
    const ps_value *actions = member(context->spec, "actions");
    if (!actions || actions->kind != PS_OBJECT) return true;
    if (!ps_size(actions)) return true;
    ps_value *toolbar = ps_object_value();
    if (!toolbar || !ps_html_attr_string(toolbar, "class", actions_class) ||
        !write_element_start(&context->output, "div", toolbar)) { ps_value_free(toolbar); return false; }
    for (size_t i = 0; i < ps_size(actions); ++i) {
        ps_text key = ps_key(actions, i);
        const ps_value *action = ps_at(actions, i);
        ps_chars label = action_label(action, key, context->language);
        const ps_value *format = action->kind == PS_OBJECT ? member(action, "format") : NULL;
        ps_text type = format && format->kind == PS_OBJECT ? text_member(format, "type") : PS_TEXT("");
        bool link = ps_text_is(type, "link");
        ps_value *span = ps_object_value();
        ps_value *attrs = ps_object_value();
        bool ok = label.bytes && span && attrs && ps_html_attr_string(span, "class", action_class) &&
            ps_html_attr_text(span, "data-action", key) &&
            (link ? ps_html_attr_text(attrs, "href", text_member(format, "href"))
                  : ps_html_attr_string(attrs, "type", "button"));
        if (ok && link && text_member(format, "target").length)
            ok = ps_html_attr_text(attrs, "target", text_member(format, "target"));
        const ps_value *behavior = action->kind == PS_STRING ? NULL : member(action, "behavior");
        /* A script string, or an object with a script: a button that runs the script on click; a
           behavior member name is the event attribute name. */
        const ps_value *script = action->kind == PS_STRING ? action : member(action, "script");
        if (script) {
            ok = ok && ps_set_text(attrs, PS_TEXT("onclick"), ps_value_clone(script));
        } else if (behavior && behavior->kind == PS_OBJECT) {
            for (size_t j = 0; ok && j < ps_size(behavior); ++j) {
                const ps_value *script = ps_at(behavior, j);
                if (script && script->kind == PS_OBJECT) script = member(script, "script");
                if (!script || script->kind != PS_STRING) continue;
                ok = ps_set_text(attrs, ps_key(behavior, j), ps_value_clone(script));
            }
        }
        if (ok) ok = write_element_start(&context->output, "span", span) &&
            ps_html_start_element(&context->output, link ? PS_TEXT("a") : PS_TEXT("button"), attrs, true, false) &&
            ps_html_raw_text(&context->output, ps_view(label)) &&
            write_element_end(&context->output, link ? "a" : "button") &&
            write_element_end(&context->output, "span");
        if (!ok) { ps_value_free(span); ps_value_free(attrs); free(label.bytes); return false; }
        ps_value_free(attrs);
        free(label.bytes);
    }
    return write_element_end(&context->output, "div");
}

static bool append_header(list_context *context, const list_column *columns, size_t count)
{
    if (!write_element_start(&context->output, "thead", ps_object_value()) ||
        !write_element_start(&context->output, "tr", ps_object_value())) return false;
    const ps_value *sort = member(context->spec, "sort");
    ps_text sort_field = text_member(sort, "field");
    const char *sort_dir = is_string(member(sort, "dir"), "desc") ? "desc" : "asc";
    for (size_t i = 0; i < count; ++i) {
        ps_value *attrs = ps_object_value();
        ps_chars label = column_label(&columns[i], context->language);
        bool ok = attrs && label.bytes && append_class_style(attrs, PS_TEXT("crudui-list__heading"), columns[i].design);
        if (ok && columns[i].field.length) ok = ps_html_attr_text(attrs, "data-field", columns[i].field);
        if (ok && columns[i].sortable) ok = ps_html_attr_string(attrs, "data-sortable", "true");
        if (ok && sort_field.length && (ps_text_equal(sort_field, columns[i].field) ||
                                        ps_text_equal(sort_field, columns[i].key)))
            ok = ps_html_attr_string(attrs, "data-sort-dir", sort_dir);
        if (ok) ok = write_element_start(&context->output, "th", attrs);
        else ps_value_free(attrs);
        ps_value *label_attrs = ps_object_value();
        if (ok) ok = label_attrs && ps_html_attr_string(label_attrs, "class", "crudui-list__heading-label") &&
            write_element_start(&context->output, "span", label_attrs) &&
            ps_html_escaped(&context->output, ps_view(label), false) &&
            write_element_end(&context->output, "span");
        else ps_value_free(label_attrs);
        if (ok && columns[i].sortable) {
            ps_value *sort_attrs = ps_object_value();
            ok = sort_attrs && ps_html_attr_string(sort_attrs, "class", "crudui-list__sort") &&
                write_element_start(&context->output, "span", sort_attrs) &&
                ps_html_text(&context->output, "↕") && write_element_end(&context->output, "span");
            if (!ok) ps_value_free(sort_attrs);
        }
        if (ok) ok = write_element_end(&context->output, "th");
        free(label.bytes);
        if (!ok) return false;
    }
    return write_element_end(&context->output, "tr") && write_element_end(&context->output, "thead");
}

/* The class list of a value host: the base followed by the format type modifier. */
static ps_chars value_class(const char *base, ps_text type)
{
    return PS_CONCAT(ps_fixed(base), type);
}

static bool append_table(list_context *context, const list_column *columns, size_t count)
{
    ps_value *attrs = ps_object_value();
    if (!attrs || !ps_html_attr_string(attrs, "class", "crudui-list__table") ||
        !write_element_start(&context->output, "table", attrs) ||
        !append_header(context, columns, count) ||
        !write_element_start(&context->output, "tbody", ps_object_value())) return false;
    for (size_t row_index = 0; row_index < ps_size(context->rows); ++row_index) {
        const ps_value *row = ps_at(context->rows, row_index);
        if (!write_element_start(&context->output, "tr", ps_object_value())) return false;
        for (size_t i = 0; i < count; ++i) {
            ps_chars base = value_class("crudui-list__cell crudui-value crudui-value--", columns[i].type);
            bool ok = base.bytes && append_cell(context, &columns[i], row, "td", ps_view(base));
            free(base.bytes);
            if (!ok) return false;
        }
        if (!write_element_end(&context->output, "tr")) return false;
    }
    return write_element_end(&context->output, "tbody") && write_element_end(&context->output, "table");
}

static bool append_cards(list_context *context, const list_column *columns, size_t count)
{
    ps_value *cards = ps_object_value();
    if (!cards || !ps_html_attr_string(cards, "class", "crudui-list__cards") ||
        !write_element_start(&context->output, "div", cards)) return false;
    for (size_t row_index = 0; row_index < ps_size(context->rows); ++row_index) {
        const ps_value *row = ps_at(context->rows, row_index);
        ps_value *article = ps_object_value();
        if (!article || !ps_html_attr_string(article, "class", "crudui-list__card") ||
            !write_element_start(&context->output, "article", article)) return false;
        for (size_t i = 0; i < count; ++i) {
            ps_value *design = ps_design(member(columns[i].column, "design"), row, columns[i].field, NULL, 0);
            ps_chars base = value_class("crudui-list__cell crudui-value crudui-value--", columns[i].type);
            ps_value *host = ps_object_value();
            ps_chars label = column_label(&columns[i], context->language);
            bool ok = design && base.bytes && host && label.bytes && append_class_style(host, ps_view(base), design) &&
                write_element_start(&context->output, "div", host);
            if (!ok) ps_value_free(host);
            ps_value *label_attrs = ps_object_value();
            if (ok) ok = label_attrs && ps_html_attr_string(label_attrs, "class", "crudui-list__card-label") &&
                write_element_start(&context->output, "span", label_attrs) &&
                ps_html_escaped(&context->output, ps_view(label), false) &&
                write_element_end(&context->output, "span");
            else ps_value_free(label_attrs);
            if (ok) ok = append_cell(context, &columns[i], row, "span", PS_TEXT("crudui-list__card-value")) &&
                write_element_end(&context->output, "div");
            ps_value_free(design); free(base.bytes); free(label.bytes);
            if (!ok) return false;
        }
        if (!write_element_end(&context->output, "article")) return false;
    }
    return write_element_end(&context->output, "div");
}

/* The list interface text of a display language: the table's entry for it, else English. */
static const ps_list_messages *list_messages(ps_text language)
{
    const ps_list_messages *messages = ps_list_messages_for(language);
    return messages ? messages : ps_list_messages_for(PS_TEXT("en"));
}

/* The declared empty text; an absent or null declaration is the emptyList interface message. */
static ps_chars list_empty(const list_context *context)
{
    const ps_value *declared = member(context->spec, "empty");
    if (!declared || declared->kind == PS_NULL) return ps_copy(ps_fixed(list_messages(context->language)->empty_list));
    return translated(declared, context->language);
}

static bool append_empty(list_context *context)
{
    ps_value *attrs = ps_object_value();
    ps_chars empty = list_empty(context);
    bool ok = attrs && empty.bytes && ps_html_attr_string(attrs, "class", "crudui-list__empty") &&
        write_element_start(&context->output, "div", attrs) &&
        ps_html_escaped(&context->output, ps_view(empty), false) &&
        write_element_end(&context->output, "div");
    if (!ok) ps_value_free(attrs);
    free(empty.bytes);
    return ok;
}

bool ps_pagination_declaration_valid(const ps_value *pagination, ps_text path, ps_value **error)
{
    static const char *const keys[] = {"per_page", "mode"};
    static const char *const modes[] = {"pages", "offset", "cursor", "none"};
    if (pagination->kind != PS_BOOL && pagination->kind != PS_OBJECT)
        return ps_declaration_error(PS_TEXT("pagination"), path, "a boolean or an object", error);
    if (pagination->kind != PS_OBJECT) return true;
    if (!ps_known_keys(pagination, "pagination", keys, 2, path, error)) return false;
    const ps_value *per_page = ps_get(pagination, "per_page");
    bool present = false;
    int64_t count = 0;
    if (per_page && (!count_option(per_page, 1, &present, &count) || !present))
        return ps_declaration_error(PS_TEXT("pagination.per_page"), path, "a positive integer", error);
    const ps_value *mode = ps_get(pagination, "mode");
    bool known = false;
    for (size_t i = 0; mode && mode->kind == PS_STRING && !known && i < 4; ++i) known = ps_is_string(mode, modes[i]);
    if (mode && !known) return ps_declaration_error(PS_TEXT("pagination.mode"), path, "pages, offset, cursor or none", error);
    return true;
}

/* The resolved pagination. The declaration and the options were checked before rendering. */
typedef struct {
    bool enabled, page_present, total_present;
    int64_t per_page, page, total, page_count;
    const char *mode;
} pagination_state;

static const char *pagination_mode(const ps_value *mode)
{
    static const char *const modes[] = {"pages", "offset", "cursor", "none"};
    for (size_t i = 0; i < 4; ++i) if (ps_is_string(mode, modes[i])) return modes[i];
    return "pages";
}

/* Enabled paging defaults perPage to 20, mode to pages and page to 1; pageCount is 0 without a
   total and otherwise at least 1. */
static void resolve_pagination(const list_context *context, pagination_state *state)
{
    const ps_value *declared = member(context->spec, "pagination");
    bool present = false;
    int64_t count = 0;
    state->enabled = declared && (declared->kind == PS_OBJECT || (declared->kind == PS_BOOL && declared->data.boolean));
    state->per_page = 20;
    state->mode = "pages";
    if (count_option(member(declared, "per_page"), 1, &present, &count) && present) state->per_page = count;
    /* The declaration was checked, so a declared mode is one of the four modes. */
    state->mode = pagination_mode(member(declared, "mode"));
    state->page = 1;
    if (!count_option(member(context->options, "page"), 1, &state->page_present, &state->page)) state->page_present = false;
    if (!state->page_present) state->page = 1;
    state->total = 0;
    if (!count_option(member(context->options, "total"), 0, &state->total_present, &state->total)) state->total_present = false;
    state->page_count = 0;
    if (state->enabled && state->total_present) {
        state->page_count = (int64_t)ceil((double)state->total / (double)state->per_page);
        if (state->page_count < 1) state->page_count = 1;
    }
}

/* One pagination button: role, page, label, current and disabled, in that order. */
static bool append_button_model(ps_value *buttons, const char *role, int64_t page, ps_chars label, bool current, bool disabled)
{
    ps_value *button = ps_object_value();
    bool ok = button && label.bytes && set_fixed(button, "role", role) && ps_set(button, "page", ps_int_value(page)) &&
        set_text(button, "label", ps_view(label)) && ps_set(button, "current", ps_bool_value(current)) &&
        ps_set(button, "disabled", ps_bool_value(disabled));
    free(label.bytes);
    if (!ok) { ps_value_free(button); return false; }
    return ps_append(buttons, button);
}

/*
 * The previous, numbered and next buttons of enabled paging, or NULL on allocation failure.
 * Without a total the current page is 1; a page after the last page selects the last page. The
 * page-number window holds every page up to seven pages, otherwise the first, previous,
 * current, next and last page.
 */
static ps_value *pagination_buttons(ps_text language, const pagination_state *state)
{
    const ps_list_messages *messages = list_messages(language);
    int64_t page_count = state->page_count;
    int64_t page = page_count > 0 ? (state->page < page_count ? state->page : page_count) : 1;
    int64_t pages[7];
    size_t page_total = 0;
    if (page_count <= 7) {
        for (int64_t value = 1; value <= page_count; ++value) pages[page_total++] = value;
    } else {
        const int64_t window[5] = {1, page > 1 ? page - 1 : 1, page, page < page_count ? page + 1 : page_count, page_count};
        for (size_t i = 0; i < 5; ++i) if (!page_total || pages[page_total - 1] < window[i]) pages[page_total++] = window[i];
    }
    ps_value *buttons = ps_array_value();
    bool ok = buttons && append_button_model(buttons, "previous", page > 1 ? page - 1 : 1,
        ps_copy(ps_fixed(messages->previous_page)), false, page_count == 0 || page <= 1);
    for (size_t i = 0; ok && i < page_total; ++i)
        ok = append_button_model(buttons, "page", pages[i], ps_format_page(messages->page, (size_t)pages[i]), pages[i] == page, pages[i] == page);
    if (ok) ok = append_button_model(buttons, "next", page_count == 0 ? 1 : page < page_count ? page + 1 : page_count,
        ps_copy(ps_fixed(messages->next_page)), false, page_count == 0 || page >= page_count);
    if (!ok) { ps_value_free(buttons); return NULL; }
    return buttons;
}

/* A pagination button's markup: its class and text follow its role, its label is the aria-label. */
static bool append_page_button(list_context *context, const ps_value *button)
{
    ps_text role = ps_string(ps_get(button, "role"));
    int64_t page = ps_get(button, "page")->data.integer;
    char page_text[32];
    snprintf(page_text, sizeof(page_text), "%lld", (long long)page);
    bool previous = ps_text_is(role, "previous"), next = ps_text_is(role, "next");
    ps_value *attrs = ps_object_value();
    bool ok = attrs && ps_html_attr_string(attrs, "type", "button") &&
        ps_html_attr_string(attrs, "class", previous ? "crudui-list__pagination-prev" : next ? "crudui-list__pagination-next" : "crudui-list__pagination-page") &&
        ps_html_attr_string(attrs, "data-page", page_text) &&
        ps_html_attr_text(attrs, "aria-label", ps_string(ps_get(button, "label")));
    if (ok && ps_get(button, "current")->data.boolean) ok = ps_html_attr_string(attrs, "aria-current", "page");
    if (ok && ps_get(button, "disabled")->data.boolean) ok = ps_set(attrs, "disabled", ps_bool_value(true));
    if (!ok) { ps_value_free(attrs); return false; }
    return write_element_start(&context->output, "button", attrs) &&
        ps_html_text(&context->output, previous ? "\xE2\x80\xB9" : next ? "\xE2\x80\xBA" : page_text) &&
        write_element_end(&context->output, "button");
}

static bool append_pagination(list_context *context)
{
    pagination_state state;
    resolve_pagination(context, &state);
    if (!state.enabled) return true;
    ps_value *attrs = ps_object_value();
    bool ok = attrs && ps_html_attr_string(attrs, "class", "crudui-list__pagination") &&
        ps_html_attr_string(attrs, "data-mode", state.mode) &&
        ps_set(attrs, "data-per-page", ps_int_value(state.per_page)) &&
        ps_set(attrs, "data-page", ps_int_value(state.page));
    if (ok && state.total_present) ok = ps_set(attrs, "data-total", ps_int_value(state.total));
    if (!ok) { ps_value_free(attrs); return false; }
    ps_value *buttons = pagination_buttons(context->language, &state);
    ok = buttons && write_element_start(&context->output, "nav", attrs);
    if (!buttons) ps_value_free(attrs);
    for (size_t i = 0; ok && i < ps_size(buttons); ++i) ok = append_page_button(context, ps_at(buttons, i));
    ps_value_free(buttons);
    return ok && write_element_end(&context->output, "nav");
}

static bool append_preloads(list_context *context, ps_html_buffer *target)
{
    for (size_t i = 0; i < context->preload_count; ++i) {
        ps_value *attrs = ps_object_value();
        if (!attrs || !ps_html_attr_string(attrs, "rel", "preload") ||
            !ps_html_attr_string(attrs, "as", "image") ||
            !ps_html_attr_text(attrs, "href", ps_view(context->preloads[i])) ||
            !write_element_start(target, "link", attrs)) { ps_value_free(attrs); return false; }
    }
    return true;
}

/* Open a container element whose class and style come from the evaluated wrapper design. */
static bool append_container_start(list_context *context, const char *tag, const char *base,
                                   const ps_value *design)
{
    const ps_value *wrapper = member(design, "wrapper");
    ps_value *attrs = design ? ps_object_value() : NULL;
    ps_chars class_name = ps_join_classes(ps_fixed(base), text_member(wrapper, "class"), PS_TEXT(""));
    bool ok = attrs && class_name.bytes && ps_html_attr_text(attrs, "class", ps_view(class_name));
    ps_text style = text_member(wrapper, "style");
    if (ok && style.length) ok = ps_html_attr_text(attrs, "style", style);
    free(class_name.bytes);
    if (!ok) { ps_value_free(attrs); return false; }
    return write_element_start(&context->output, tag, attrs);
}

/* The translated list description in crudui-list__description; nothing when it is empty. */
static bool append_description(list_context *context)
{
    ps_chars description = translated(member(context->spec, "description"), context->language);
    if (!description.bytes) return false;
    if (!description.length) { free(description.bytes); return true; }
    ps_value *attrs = ps_object_value();
    bool ok = attrs && ps_html_attr_string(attrs, "class", "crudui-list__description");
    if (ok) ok = write_element_start(&context->output, "p", attrs) &&
        ps_html_escaped(&context->output, ps_view(description), false) &&
        write_element_end(&context->output, "p");
    else ps_value_free(attrs);
    free(description.bytes);
    return ok;
}

static bool render_list(list_context *context, list_column *columns, size_t count)
{
    ps_value *design = ps_design(member(context->spec, "design"), context->data, PS_TEXT(""), NULL, 0);
    bool ok = append_container_start(context, "div", "crudui-list", design) && append_description(context) &&
        append_toolbar(context, "crudui-list");
    if (ok) ok = !ps_size(context->rows) ? append_empty(context)
        : !strcmp(context->layout, "card") ? append_cards(context, columns, count)
        : append_table(context, columns, count);
    if (ok) ok = append_pagination(context) && write_element_end(&context->output, "div");
    ps_value_free(design);
    return ok;
}

/* Composed declarations, visible columns and output shared by list and detail rendering. */
typedef struct {
    list_context context;
    ps_value *declarations;
    ps_value *composed;
    ps_value *empty_data;
    ps_value *empty_files;
    list_column *columns;
    size_t column_count;
} list_session;

static void list_close(list_session *session)
{
    free(session->context.output.data);
    for (size_t i = 0; i < session->context.preload_count; ++i) free(session->context.preloads[i].bytes);
    free(session->context.preloads);
    free_columns(session->columns, session->column_count);
    ps_value_free(session->declarations);
    ps_value_free(session->composed);
    ps_value_free(session->empty_data);
    ps_value_free(session->empty_files);
    *session = (list_session){0};
}

/*
 * Compose the member map members of spec (columns or fields) and, for a list, a search with $ref or
 * $patch into a composed copy of spec in the same member order. NULL with *error set on a
 * composition failure, NULL with *error unset on allocation failure.
 */
static ps_value *compose_display(list_session *session, const ps_value *spec, const ps_value *files,
                                 ps_text basepath, const char *own, const char *members, ps_value **error)
{
    session->declarations = ps_compose_properties(ps_get(spec, members), files, basepath, error);
    if (!session->declarations) return NULL;
    ps_value *search = NULL;
    const ps_value *declared_search = ps_get(spec, "search");
    if (strcmp(own, "list") == 0 && declared_search && declared_search->kind == PS_OBJECT &&
        (ps_has(declared_search, "$ref") || ps_has(declared_search, "$patch"))) {
        search = ps_compose_properties(declared_search, files, basepath, error);
        if (!search) return NULL;
    }
    ps_value *composed = ps_object_value();
    bool ok = composed != NULL;
    for (size_t i = 0; ok && i < ps_size(spec); ++i) {
        ps_text key = ps_key(spec, i);
        ps_value *value = ps_text_is(key, members) ? ps_value_clone(session->declarations)
            : search && ps_text_is(key, "search") ? ps_value_clone(search)
            : ps_value_clone(ps_at(spec, i));
        ok = value && ps_set_text(composed, key, value);
        if (!ok) ps_value_free(value);
    }
    ps_value_free(search);
    if (!ok) { ps_value_free(composed); return NULL; }
    return composed;
}

/*
 * Read the language, data, files and basepath options, compose the specification, scan it for
 * forbidden keys, check its declarations (own is the root path, members the member map) and
 * collect the visible columns. The caller has checked the input and that options is an object.
 * Returns an error value, or NULL when the session is open.
 */
static ps_value *list_open(list_session *session, const ps_value *spec, const ps_value *rows,
                           const ps_value *options, const char *layout, const char *own, const char *members)
{
    *session = (list_session){0};
    ps_text language = text_member(options, "language");
    if (!language.length) language = PS_TEXT("ko");
    const ps_value *data = member(options, "data");
    /* An absent or null context is empty. */
    if (!data || data->kind == PS_NULL) data = session->empty_data = ps_object_value();
    if (!data || data->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "List context must be an object", "").error;
    const ps_value *files = member(options, "files");
    if (!files) files = session->empty_files = ps_object_value();
    ps_text basepath = text_member(options, "basepath");
    ps_value *error = NULL;
    const ps_value *declared = ps_get(spec, members);
    if (!declared || declared->kind != PS_OBJECT) {
        ps_declaration_error(ps_fixed(members), ps_fixed(own), "an object", &error);
        return error ? error : ps_fail("internal", "INTERNAL_ERROR", "C list declaration check failed", "").error;
    }
    session->composed = compose_display(session, spec, files, basepath, own, members, &error);
    if (error) return error;
    if (!session->composed)
        return ps_fail("internal", "INTERNAL_ERROR", "C list composition failed", "").error;
    /* The forbidden-key scan and then the declarations, as the display format specification orders them. */
    error = ps_scan_forbidden(session->composed, NULL, 0);
    if (error) return error;
    if (!ps_display_declarations_valid(session->composed, own, members, &error))
        return error ? error : ps_fail("internal", "INTERNAL_ERROR", "C list declaration check failed", "").error;
    session->context = (list_context){
        session->composed, session->declarations, rows, options, language, layout, data, {0}, NULL, 0, 0, NULL
    };
    if (!collect_columns(&session->context, &session->columns, &session->column_count))
        return ps_fail("internal", "INTERNAL_ERROR", "C list rendering failed", "").error;
    return NULL;
}

/* Return the preloads followed by the written markup, then close the session. */
static ps_result list_finish(list_session *session, bool ok, const char *failure)
{
    ps_html_buffer result = {0};
    list_context *context = &session->context;
    if (ok) ok = append_preloads(context, &result) &&
        ps_html_bytes(&result, context->output.data, context->output.length);
    ps_value *output = ok ? ps_html_value(&result) : NULL;
    if (!ok) free(result.data);
    const char *input_failure = context->failure;
    list_close(session);
    if (!output && input_failure) return ps_fail("form", "INVALID_FORM_INPUT", input_failure, "");
    if (!output) return ps_fail("internal", "INTERNAL_ERROR", failure, "");
    return ps_ok(output);
}

static ps_result render_list_view(const ps_value *spec, const ps_value *rows, const ps_value *options);
static ps_result build_list_view(const ps_value *spec, const ps_value *rows, const ps_value *options);
static ps_result build_detail_view(const ps_value *spec, const ps_value *record, const ps_value *options);
static ps_result render_detail_view(const ps_value *spec, const ps_value *record, const ps_value *options);

/*
 * List and detail specifications and their composition files are read in specification member
 * order; rows, records and options.data keep their order.
 */
#define ORDERED_VIEW(operation, spec, second, options, failure) do { \
    ps_value *ordered_spec = NULL, *ordered_options = NULL; \
    if (!ps_order_specification(spec, options, &ordered_spec, &ordered_options)) \
        return ps_fail("internal", "INTERNAL_ERROR", failure, ""); \
    ps_result result = operation(ordered_spec, second, ordered_options); \
    ps_value_free(ordered_spec); ps_value_free(ordered_options); \
    return result; \
} while (0)

ps_result ps_render_list(const ps_value *spec, const ps_value *rows, const ps_value *options)
{
    ORDERED_VIEW(render_list_view, spec, rows, options, "C list rendering failed");
}

ps_result ps_build_list(const ps_value *spec, const ps_value *rows, const ps_value *options)
{
    ORDERED_VIEW(build_list_view, spec, rows, options, "C list evaluation failed");
}

ps_result ps_build_detail(const ps_value *spec, const ps_value *record, const ps_value *options)
{
    ORDERED_VIEW(build_detail_view, spec, record, options, "C detail evaluation failed");
}

ps_result ps_render_detail(const ps_value *spec, const ps_value *record, const ps_value *options)
{
    ORDERED_VIEW(render_detail_view, spec, record, options, "C detail rendering failed");
}

#undef ORDERED_VIEW

/*
 * The input checks of a list, in the order the shared rules give: the specification, the rows and each row, the columns,
 * the options and their context, the page and the total. False with failure set on the first input that fails.
 */
static bool check_list_input(const ps_value *spec, const ps_value *rows, const ps_value *options, ps_result *failure)
{
    if (!spec || spec->kind != PS_OBJECT) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "List specification must be an object", "");
        return false;
    }
    if (!rows || rows->kind != PS_ARRAY) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "List rows must be an array", "");
        return false;
    }
    for (size_t i = 0; i < ps_size(rows); ++i) {
        if (!ps_at(rows, i) || ps_at(rows, i)->kind != PS_OBJECT) {
            *failure = ps_fail("form", "INVALID_FORM_INPUT", "List rows must be objects", "");
            return false;
        }
    }
    if (!ps_has(spec, "columns")) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "List specification must declare columns", "");
        return false;
    }
    if (!options || options->kind != PS_OBJECT) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "Options must be an object", "");
        return false;
    }
    /* An absent or null context is none; any other value must be an object. */
    const ps_value *data = member(options, "data");
    if (data && data->kind != PS_NULL && data->kind != PS_OBJECT) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "List context must be an object", "");
        return false;
    }
    bool present;
    int64_t count;
    if (!count_option(member(options, "page"), 1, &present, &count)) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "List page must be a positive integer", "");
        return false;
    }
    if (!count_option(member(options, "total"), 0, &present, &count)) {
        *failure = ps_fail("form", "INVALID_FORM_INPUT", "List total must be a nonnegative integer", "");
        return false;
    }
    return true;
}

static ps_result render_list_view(const ps_value *spec, const ps_value *rows, const ps_value *options)
{
    ps_result failure;
    if (!check_list_input(spec, rows, options, &failure)) return failure;
    const ps_value *layout_value = member(options, "layout");
    const char *layout = !layout_value || layout_value->kind == PS_NULL ? "table"
        : ps_is_string(layout_value, "table") ? "table"
        : ps_is_string(layout_value, "card") ? "card" : NULL;
    if (!layout)
        return ps_fail("form", "INVALID_FORM_INPUT", "List layout must be table or card", "");
    list_session session;
    ps_value *error = list_open(&session, spec, rows, options, layout, "list", "columns");
    if (error) { list_close(&session); return (ps_result){NULL, error}; }
    bool ok = render_list(&session.context, session.columns, session.column_count);
    return list_finish(&session, ok, "C list rendering failed");
}

/* The resolved actions of a list or detail, appended to the actions array in member order. */
static bool append_actions_model(const list_context *context, ps_value *actions)
{
    bool ok = true;
    const ps_value *declared_actions = member(context->spec, "actions");
    for (size_t i = 0; ok && declared_actions && declared_actions->kind == PS_OBJECT && i < ps_size(declared_actions); ++i) {
        ps_text key = ps_key(declared_actions, i);
        const ps_value *raw = ps_at(declared_actions, i);
        /* A script string, or an object with a script: a button that runs the script on click; a
           behavior member name is the event attribute name. */
        const ps_value *script = raw->kind == PS_STRING ? raw : member(raw, "script");
        ps_value *action = ps_object_value();
        ps_chars label = action_label(raw, key, context->language);
        ok = action && label.bytes && set_text(action, "key", key) && set_text(action, "label", ps_view(label));
        if (ok && script) {
            ps_value *behavior = ps_object_value();
            ok = behavior && ps_set_text(behavior, PS_TEXT("onclick"), ps_value_clone(script)) && set_value(action, "behavior", &behavior);
            ps_value_free(behavior);
        } else if (ok && member(raw, "format")) {
            const ps_value *raw_format = member(raw, "format");
            ps_value *format = ps_object_value();
            ps_text type = raw_format && raw_format->kind == PS_OBJECT ? text_member(raw_format, "type")
                : raw_format && raw_format->kind == PS_STRING ? ps_string(raw_format) : PS_TEXT("text");
            ok = format && set_text(format, "type", type.length ? type : PS_TEXT("text")) &&
                ps_set(format, "options", raw_format->kind == PS_OBJECT ? ps_value_clone(raw_format) : ps_object_value()) &&
                set_value(action, "format", &format);
            ps_value_free(format);
        }
        if (ok && raw->kind == PS_OBJECT && member(raw, "behavior") && member(raw, "behavior")->kind == PS_OBJECT) {
            ps_value *behavior = ps_object_value();
            const ps_value *source = member(raw, "behavior");
            for (size_t j = 0; ok && j < ps_size(source); ++j) {
                const ps_value *entry = ps_at(source, j);
                if (entry && entry->kind == PS_OBJECT) entry = member(entry, "script");
                if (entry && entry->kind == PS_STRING) ok = ps_set_text(behavior, ps_key(source, j), ps_value_clone(entry));
            }
            if (ok && ps_size(behavior)) ok = set_value(action, "behavior", &behavior);
            ps_value_free(behavior);
        }
        if (ok) ok = ps_append(actions, action), action = NULL;
        ps_value_free(action); free(label.bytes);
    }
    return ok;
}

/* Build the public list model from the same evaluated columns and cells used by rendering. */
static ps_value *list_model(list_session *session)
{
    list_context *context = &session->context;
    ps_value *model = ps_object_value(), *columns = ps_array_value(), *row_models = ps_array_value();
    ps_value *pagination = ps_object_value(), *actions = ps_array_value(), *design = NULL;
    bool ok = model && columns && row_models && pagination && actions;
    for (size_t i = 0; ok && i < session->column_count; ++i) {
        const list_column *column = &session->columns[i];
        ps_value *entry = ps_object_value(), *format = ps_object_value();
        ps_chars label = column_label(column, context->language);
        ok = entry && format && label.bytes &&
            set_text(entry, "key", column->key) && set_text(entry, "field", column->field) &&
            set_text(entry, "label", ps_view(label)) && set_text(format, "type", column->type) &&
            ps_set(format, "options", column->format ? ps_value_clone(column->format) : ps_object_value()) &&
            set_value(entry, "format", &format) && ps_set(entry, "sortable", ps_bool_value(column->sortable)) &&
            ps_set(entry, "design", ps_value_clone(column->design));
        if (ok) ok = ps_append(columns, entry), entry = NULL;
        ps_value_free(entry); ps_value_free(format); free(label.bytes);
    }
    for (size_t r = 0; ok && r < ps_size(context->rows); ++r) {
        ps_value *row_model = ps_object_value(), *cells = ps_array_value();
        ok = row_model && cells;
        const ps_value *row = ps_at(context->rows, r);
        for (size_t i = 0; ok && i < session->column_count; ++i) {
            const list_column *column = &session->columns[i];
            const ps_value *value = NULL;
            ps_value *display = NULL, *cell_design = NULL, *cell = ps_object_value(), *format = ps_object_value();
            ok = cell && format && evaluate_cell(context, column, row, &value, &display, &cell_design) &&
                set_text(format, "type", column->type) &&
                ps_set(format, "options", column->format ? ps_value_clone(column->format) : ps_object_value()) &&
                set_value(cell, "format", &format) && ps_set(cell, "value", value ? ps_value_clone(value) : ps_null_value()) &&
                set_value(cell, "display", &display) && set_value(cell, "design", &cell_design);
            if (ok) ok = ps_append(cells, cell), cell = NULL;
            ps_value_free(cell); ps_value_free(format); ps_value_free(display); ps_value_free(cell_design);
        }
        if (ok) ok = ps_set(row_model, "cells", cells), cells = NULL;
        ps_value_free(cells);
        if (ok) ok = ps_append(row_models, row_model), row_model = NULL;
        ps_value_free(row_model);
    }
    if (ok) {
        pagination_state state;
        resolve_pagination(context, &state);
        ok = ps_set(pagination, "enabled", ps_bool_value(state.enabled));
        if (ok && state.enabled)
            ok = ps_set(pagination, "perPage", ps_int_value(state.per_page)) &&
                set_fixed(pagination, "mode", state.mode) &&
                ps_set(pagination, "page", ps_int_value(state.page));
        else if (ok && state.page_present) ok = ps_set(pagination, "page", ps_int_value(state.page));
        if (ok && state.total_present) ok = ps_set(pagination, "total", ps_int_value(state.total));
        if (ok && state.enabled) {
            ok = ps_set(pagination, "pageCount", ps_int_value(state.page_count));
            if (ok) {
                ok = ps_set(pagination, "buttons", pagination_buttons(context->language, &state));
            }
        }
        design = ps_design(member(context->spec, "design"), context->data, PS_TEXT(""), NULL, 0);
        ok = ok && design && set_value(model, "columns", &columns) && set_value(model, "rows", &row_models) &&
            set_value(model, "pagination", &pagination);
        const ps_value *sort = member(context->spec, "sort");
        if (ok && sort && sort->kind == PS_OBJECT && text_member(sort, "field").length) {
            ps_value *sort_model = ps_object_value();
            ok = sort_model && ps_set(sort_model, "field", ps_value_clone(member(sort, "field"))) &&
                set_fixed(sort_model, "dir", is_string(member(sort, "dir"), "desc") ? "desc" : "asc") &&
                set_value(model, "sort", &sort_model);
            ps_value_free(sort_model);
        }
        if (ok) ok = append_actions_model(context, actions);
        ps_chars empty = list_empty(context);
        ps_chars description = translated(member(context->spec, "description"), context->language);
        if (ok) ok = set_value(model, "actions", &actions) && empty.bytes &&
            set_text(model, "empty", ps_view(empty)) && description.bytes &&
            set_text(model, "description", ps_view(description)) && set_value(model, "design", &design);
        free(empty.bytes); free(description.bytes);
    }
    ps_value_free(columns); ps_value_free(row_models); ps_value_free(pagination); ps_value_free(actions); ps_value_free(design);
    if (!ok) { ps_value_free(model); return NULL; }
    return model;
}

static ps_result build_list_view(const ps_value *spec, const ps_value *rows, const ps_value *options)
{
    ps_result input_failure;
    if (!check_list_input(spec, rows, options, &input_failure)) return input_failure;
    list_session session; ps_value *error = list_open(&session, spec, rows, options, "table", "list", "columns");
    if (error) { list_close(&session); return (ps_result){NULL, error}; }
    ps_value *model = list_model(&session); const char *failure = session.context.failure; list_close(&session);
    if (!model && failure) return ps_fail("form", "INVALID_FORM_INPUT", failure, "");
    if (!model) return ps_fail("internal", "INTERNAL_ERROR", "C list evaluation failed", "");
    return ps_ok(model);
}

/*
 * Validate detail inputs and open a list session whose columns are the detail
 * fields and whose single row is the record. Returns an error value or NULL.
 */
static ps_value *detail_open(list_session *session, const ps_value *spec, const ps_value *record,
                             const ps_value *options)
{
    *session = (list_session){0};
    if (!spec || spec->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "Detail specification must be an object", "").error;
    /* Argument shapes in argument order, then the declaration, then options. */
    if (!record || record->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "Detail record must be an object", "").error;
    if (!ps_has(spec, "fields"))
        return ps_fail("form", "INVALID_FORM_INPUT", "Detail specification must declare fields", "").error;
    if (!options || options->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "Options must be an object", "").error;
    /* An absent or null context is empty. */
    const ps_value *data = member(options, "data");
    if (data && data->kind != PS_NULL && data->kind != PS_OBJECT)
        return ps_fail("form", "INVALID_FORM_INPUT", "Detail context must be an object", "").error;
    return list_open(session, spec, NULL, options, "table", "detail", "fields");
}

/* The detail model: each visible field's key, label and evaluated cell, the actions, then the design. */
static ps_value *detail_model(list_session *session, const ps_value *record)
{
    list_context *context = &session->context;
    ps_value *model = ps_object_value();
    ps_value *fields = ps_array_value();
    ps_value *actions = ps_array_value();
    ps_value *design = NULL;
    bool ok = model && fields && actions;
    for (size_t i = 0; ok && i < session->column_count; ++i) {
        const list_column *column = &session->columns[i];
        const ps_value *value = NULL;
        ps_value *display = NULL, *cell_design = NULL, *format = ps_object_value();
        ps_value *field = ps_object_value();
        ps_chars label = column_label(column, context->language);
        ok = field && format && label.bytes &&
            evaluate_cell(context, column, record, &value, &display, &cell_design) &&
            set_text(format, "type", column->type) &&
            ps_set(format, "options", column->format ? ps_value_clone(column->format) : ps_object_value()) &&
            set_text(field, "key", column->key) && set_text(field, "label", ps_view(label)) &&
            set_value(field, "format", &format) &&
            /* An absent path is null. */
            ps_set(field, "value", value ? ps_value_clone(value) : ps_null_value()) &&
            set_value(field, "display", &display) && set_value(field, "design", &cell_design);
        if (ok) { ok = ps_append(fields, field); field = NULL; }
        free(label.bytes);
        ps_value_free(field); ps_value_free(format);
        ps_value_free(display); ps_value_free(cell_design);
    }
    if (ok) {
        design = ps_design(member(context->spec, "design"), context->data, PS_TEXT(""), NULL, 0);
        ok = design && append_actions_model(context, actions) && set_value(model, "fields", &fields) &&
            set_value(model, "actions", &actions) && set_value(model, "design", &design);
    }
    ps_value_free(fields); ps_value_free(actions); ps_value_free(design);
    if (!ok) { ps_value_free(model); return NULL; }
    return model;
}

static ps_result build_detail_view(const ps_value *spec, const ps_value *record, const ps_value *options)
{
    list_session session;
    ps_value *error = detail_open(&session, spec, record, options);
    if (error) { list_close(&session); return (ps_result){NULL, error}; }
    ps_value *model = detail_model(&session, record);
    const char *input_failure = session.context.failure;
    list_close(&session);
    if (!model && input_failure) return ps_fail("form", "INVALID_FORM_INPUT", input_failure, "");
    if (!model) return ps_fail("internal", "INTERNAL_ERROR", "C detail evaluation failed", "");
    return ps_ok(model);
}

static ps_result render_detail_view(const ps_value *spec, const ps_value *record, const ps_value *options)
{
    list_session session;
    ps_value *error = detail_open(&session, spec, record, options);
    if (error) { list_close(&session); return (ps_result){NULL, error}; }
    list_context *context = &session.context;
    ps_html_buffer *out = &context->output;
    ps_value *model = detail_model(&session, record);
    bool ok = model && append_toolbar(context, "crudui-detail") &&
        append_container_start(context, "dl", "crudui-detail", member(model, "design"));
    const ps_value *fields = member(model, "fields");
    for (size_t i = 0; ok && i < ps_size(fields); ++i) {
        const ps_value *field = ps_at(fields, i);
        const ps_value *label = member(field, "label");
        ps_chars base = value_class("crudui-detail__value crudui-value crudui-value--",
                                    text_member(member(field, "format"), "type"));
        ps_value *field_attrs = ps_object_value();
        ps_value *label_attrs = ps_object_value();
        ok = base.bytes && field_attrs && label_attrs && label && label->kind == PS_STRING &&
            ps_html_attr_string(field_attrs, "class", "crudui-detail__field") &&
            ps_html_attr_string(label_attrs, "class", "crudui-detail__label");
        if (!ok) { ps_value_free(field_attrs); ps_value_free(label_attrs); }
        else {
            /* Each start consumes its attributes. */
            ok = write_element_start(out, "div", field_attrs);
            if (ok) ok = write_element_start(out, "dt", label_attrs);
            else ps_value_free(label_attrs);
            if (ok) ok = ps_html_escaped(out, ps_string(label), false) &&
                write_element_end(out, "dt") &&
                write_cell(context, member(field, "design"), member(field, "display"), "dd", ps_view(base)) &&
                write_element_end(out, "div");
        }
        free(base.bytes);
    }
    if (ok) ok = write_element_end(out, "dl");
    ps_value_free(model);
    return list_finish(&session, ok, "C detail rendering failed");
}
