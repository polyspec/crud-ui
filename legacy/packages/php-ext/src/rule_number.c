#include "engine_internal.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

/*
 * Numbers (docs/spec/validation-rules.md, "Values", "Numbers"): numeric text, the numeric rules
 * number, digits, min, max, range and step, the collection counts mincount and maxcount, and
 * their parameter checks.
 * Numeric text is read by number_text.c, independently of the C locale.
 */

bool ps_numeric_value(const ps_value *value, double *number)
{
    if (!value) return false;
    if (value->kind == PS_INT) { *number = (double)value->data.integer; return true; }
    if (value->kind == PS_FLOAT) { *number = value->data.number; return isfinite(*number); }
    return value->kind == PS_STRING && ps_numeric_text(ps_trim(ps_string(value)), number);
}

/* A finite number parameter. */
static bool finite_parameter(const ps_value *parameter, double *number)
{
    if (!parameter) return false;
    if (parameter->kind == PS_INT) { *number = (double)parameter->data.integer; return true; }
    if (parameter->kind == PS_FLOAT) { *number = parameter->data.number; return isfinite(*number); }
    return false;
}

static bool range_parameter(const ps_value *parameter, double *minimum, double *maximum)
{
    return parameter && parameter->kind == PS_ARRAY && ps_size(parameter) == 2 &&
        finite_parameter(ps_at(parameter, 0), minimum) &&
        finite_parameter(ps_at(parameter, 1), maximum) && *minimum <= *maximum;
}

static bool step_parameter(const ps_value *parameter, double *step)
{
    return finite_parameter(parameter, step) && *step > 0;
}

/* A count limit: an integer from 0 to 2^53 - 1, as a length limit. */
static bool count_parameter(const ps_value *parameter, int64_t *limit)
{
    return ps_length_limit(parameter, limit);
}

/* A decimal significand and exponent read from a canonical number text without its sign. */
static bool decimal_parts(ps_text text, uint64_t *significand, int64_t *exponent)
{
    uint64_t digits = 0;
    int64_t scale = 0, trailing = 0;
    bool fraction = false;
    size_t index = 0;
    for (; index < text.length && text.bytes[index] != 'e'; ++index) {
        char c = text.bytes[index];
        if (c == '.') { fraction = true; continue; }
        if (c < '0' || c > '9') return false;
        if (fraction) scale--;
        /* Trailing zeros are kept aside, so at most 17 significant digits are multiplied in. */
        if (c == '0' && digits) { trailing++; continue; }
        for (; trailing; --trailing) digits *= 10;
        digits = digits * 10 + (uint64_t)(c - '0');
    }
    int64_t power = 0;
    if (index < text.length) {
        bool below = index + 1 < text.length && text.bytes[index + 1] == '-';
        for (index += 2; index < text.length; ++index) power = power * 10 + (text.bytes[index] - '0');
        if (below) power = -power;
    }
    *significand = digits;
    *exponent = power + scale + trailing;
    return true;
}

/* (left * right) mod modulus for a modulus below 2^63. */
static uint64_t multiply_mod(uint64_t left, uint64_t right, uint64_t modulus)
{
    uint64_t result = 0;
    left %= modulus;
    for (; right; right >>= 1) {
        if (right & 1) { result += left; if (result >= modulus) result -= modulus; }
        left += left;
        if (left >= modulus) left -= modulus;
    }
    return result;
}

/*
 * Whether |value| is an integer multiple of a positive step, both read as the decimal numbers their
 * canonical texts write: 1 or 0, -1 on allocation failure.
 */
int ps_step_multiple(double value, double step)
{
    ps_chars value_text = ps_number_text(fabs(value));
    ps_chars step_text = ps_number_text(step);
    uint64_t a = 0, b = 0;
    int64_t p = 0, q = 0;
    bool read = value_text.bytes && step_text.bytes &&
        decimal_parts(ps_view(value_text), &a, &p) && decimal_parts(ps_view(step_text), &b, &q);
    free(value_text.bytes);
    free(step_text.bytes);
    if (!read || !b) return -1;
    if (!a) return 1;
    if (p >= q) {
        /* b | a * 10^(p - q) */
        uint64_t power = 1 % b, base = 10 % b;
        for (int64_t e = p - q; e; e >>= 1) {
            if (e & 1) power = multiply_mod(power, base, b);
            base = multiply_mod(base, base, b);
        }
        return multiply_mod(a % b, power, b) == 0;
    }
    /* 10^(q - p) | a, then b | a / 10^(q - p); a has at most 17 digits. */
    if (q - p > 19) return 0;
    for (int64_t e = q - p; e; --e) {
        if (a % 10) return 0;
        a /= 10;
    }
    return a % b == 0;
}

/* digits: a string (trimmed) or a number whose canonical text is ASCII digits; -1 on allocation failure. */
static int digits_value(const ps_value *value)
{
    ps_chars owned = {NULL, 0};
    ps_text text;
    if (value->kind == PS_STRING) text = ps_trim(ps_string(value));
    else if (value->kind == PS_INT || value->kind == PS_FLOAT) {
        if (value->kind == PS_FLOAT && !isfinite(value->data.number)) return 0;
        if (ps_canonical_text(value, &owned) <= 0) return -1;
        text = ps_view(owned);
    } else return 0;
    bool digits = text.length > 0;
    for (size_t i = 0; digits && i < text.length; ++i)
        digits = text.bytes[i] >= '0' && text.bytes[i] <= '9';
    free(owned.bytes);
    return digits;
}

/* The count of a value: array elements, object keys, 0 for nothing or blank text, else 1. */
static uint64_t count_value(const ps_value *value)
{
    if (!value || value->kind == PS_NULL) return 0;
    if (value->kind == PS_ARRAY || value->kind == PS_OBJECT) return ps_size(value);
    if (value->kind == PS_STRING && !ps_trim(ps_string(value)).length) return 0;
    return 1;
}

bool ps_number_rule(ps_text rule)
{
    static const char *const rules[] = {"number", "digits", "min", "max", "range", "step", "mincount", "maxcount"};
    for (size_t i = 0; i < sizeof(rules) / sizeof(rules[0]); ++i)
        if (ps_text_is(rule, rules[i])) return true;
    return false;
}

ps_parameter_problem ps_number_parameter(ps_text rule, const ps_value *parameter)
{
    static const struct { const char *rule, *message; } messages[] = {
        {"number", "Invalid number parameter: expected true or false"},
        {"digits", "Invalid digits parameter: expected true or false"},
        {"min", "Invalid min parameter: expected a finite number"},
        {"max", "Invalid max parameter: expected a finite number"},
        {"range", "Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum"},
        {"step", "Invalid step parameter: expected a finite number above 0"},
        {"mincount", "Invalid mincount parameter: expected an integer from 0 to 9007199254740991"},
        {"maxcount", "Invalid maxcount parameter: expected an integer from 0 to 9007199254740991"},
    };
    double first, second;
    int64_t limit;
    bool valid;
    if (ps_text_is(rule, "number") || ps_text_is(rule, "digits")) valid = parameter && parameter->kind == PS_BOOL;
    else if (ps_text_is(rule, "min") || ps_text_is(rule, "max")) valid = finite_parameter(parameter, &first);
    else if (ps_text_is(rule, "range")) valid = range_parameter(parameter, &first, &second);
    else if (ps_text_is(rule, "step")) valid = step_parameter(parameter, &first);
    else valid = count_parameter(parameter, &limit);
    if (valid) return (ps_parameter_problem){0};
    for (size_t i = 0; i < sizeof(messages) / sizeof(messages[0]); ++i)
        if (ps_text_is(rule, messages[i].rule))
            return (ps_parameter_problem){.code = "INVALID_RULE_PARAMETER", .message = messages[i].message};
    return (ps_parameter_problem){0};
}

int ps_number_passes(ps_text rule, const ps_value *value, const ps_value *parameter)
{
    double number = 0, first = 0, second = 0;
    int64_t limit = 0;
    if (ps_text_is(rule, "mincount") || ps_text_is(rule, "maxcount")) {
        if (!count_parameter(parameter, &limit)) return -1;
        uint64_t count = count_value(value);
        return ps_text_is(rule, "mincount") ? count >= (uint64_t)limit : count <= (uint64_t)limit;
    }
    if (ps_text_is(rule, "number") || ps_text_is(rule, "digits")) {
        if (!parameter || parameter->kind != PS_BOOL) return -1;
        if (!parameter->data.boolean) return 1;
        return ps_text_is(rule, "digits") ? digits_value(value) : ps_numeric_value(value, &number);
    }
    if (ps_text_is(rule, "range")) {
        if (!range_parameter(parameter, &first, &second)) return -1;
    } else if (ps_text_is(rule, "step")) {
        if (!step_parameter(parameter, &first)) return -1;
    } else if (!finite_parameter(parameter, &first)) return -1;
    if (!ps_numeric_value(value, &number)) return 0;
    if (ps_text_is(rule, "min")) return number >= first;
    if (ps_text_is(rule, "max")) return number <= first;
    if (ps_text_is(rule, "range")) return number >= first && number <= second;
    return ps_step_multiple(number, first);
}
