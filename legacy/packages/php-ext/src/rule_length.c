#include "engine_internal.h"

#include <math.h>

/*
 * Length rules (docs/spec/validation-rules.md, "Values"): minlength, maxlength and rangelength
 * count the code points of a scalar's canonical text, untrimmed; an array or object fails.
 */

#define LENGTH_LIMIT_MAXIMUM INT64_C(9007199254740991)

bool ps_length_limit(const ps_value *parameter, int64_t *limit)
{
    if (!parameter) return false;
    if (parameter->kind == PS_INT) {
        if (parameter->data.integer < 0 || parameter->data.integer > LENGTH_LIMIT_MAXIMUM) return false;
        *limit = parameter->data.integer;
        return true;
    }
    if (parameter->kind == PS_FLOAT) {
        double number = parameter->data.number;
        if (!isfinite(number) || floor(number) != number || number < 0 || number > (double)LENGTH_LIMIT_MAXIMUM)
            return false;
        *limit = (int64_t)number;
        return true;
    }
    return false;
}

bool ps_length_range(const ps_value *parameter, int64_t *minimum, int64_t *maximum)
{
    return parameter && parameter->kind == PS_ARRAY && ps_size(parameter) == 2 &&
        ps_length_limit(ps_at(parameter, 0), minimum) &&
        ps_length_limit(ps_at(parameter, 1), maximum) && *minimum <= *maximum;
}

bool ps_length_rule(ps_text rule)
{
    return ps_text_is(rule, "minlength") || ps_text_is(rule, "maxlength") || ps_text_is(rule, "rangelength");
}

ps_parameter_problem ps_length_parameter(ps_text rule, const ps_value *parameter)
{
    int64_t minimum, maximum;
    if (ps_text_is(rule, "rangelength")) {
        if (ps_length_range(parameter, &minimum, &maximum)) return (ps_parameter_problem){0};
        return (ps_parameter_problem){.code = "INVALID_RULE_PARAMETER", .message =
            "Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum"};
    }
    if (ps_length_limit(parameter, &minimum)) return (ps_parameter_problem){0};
    return (ps_parameter_problem){.code = "INVALID_RULE_PARAMETER", .message =
        ps_text_is(rule, "minlength")
            ? "Invalid minlength parameter: expected an integer from 0 to 9007199254740991"
            : "Invalid maxlength parameter: expected an integer from 0 to 9007199254740991"};
}

int ps_length_passes(ps_text rule, const ps_value *value, const ps_value *parameter)
{
    int64_t minimum = 0, maximum = LENGTH_LIMIT_MAXIMUM;
    if (ps_text_is(rule, "rangelength")) {
        if (!ps_length_range(parameter, &minimum, &maximum)) return -1;
    } else {
        int64_t limit;
        if (!ps_length_limit(parameter, &limit)) return -1;
        if (ps_text_is(rule, "minlength")) minimum = limit;
        else maximum = limit;
    }
    ps_chars text;
    int scalar = ps_canonical_text(value, &text);
    if (scalar <= 0) return scalar;
    size_t count = ps_code_points(ps_view(text));
    free(text.bytes);
    return (uint64_t)count >= (uint64_t)minimum && (uint64_t)count <= (uint64_t)maximum;
}
