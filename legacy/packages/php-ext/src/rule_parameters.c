#include "engine_internal.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>

/*
 * Rule name and parameter checks (docs/spec/validation-rules.md, "Parameter errors"). A parameter
 * outside the definitions, and a validate or messages key that is not a registered rule, is a load
 * failure (kind compose) whose location is the field's declaration path: at is the property names
 * joined with '.', trace is the list of those names.
 */

/* The message of a reference parameter outside its definition. */
#define REFERENCE_MESSAGE "Invalid reference parameter: expected the declaration path of a field"

bool ps_registered_rule(ps_text rule)
{
    static const char *const rules[] = {
        "required", "email", "minlength", "maxlength", "min", "max", "match", "pattern",
        "unique", "in", "range", "rangelength", "number", "digits", "equalTo", "containedIn", "typeFrom", "minFrom", "maxFrom", "notEqual",
        "date", "dateISO", "enddate", "url", "accept", "mincount", "maxcount", "step",
        "conditionTree",
        "reference",
    };
    for (size_t i = 0; i < sizeof(rules) / sizeof(rules[0]); ++i)
        if (ps_text_is(rule, rules[i])) return true;
    return false;
}

static bool pattern_rule(ps_text rule)
{
    return ps_text_is(rule, "pattern") || ps_text_is(rule, "match");
}

/*
 * The problem of a parameter of a rule that references a field: equalTo, containedIn, typeFrom, minFrom, maxFrom and enddate take a field
 * reference string, notEqual a string, number or boolean, unique true or a string, and reference a
 * string.
 */
static bool reference_parameter(ps_text rule, const ps_value *parameter, ps_parameter_problem *problem)
{
    int kind = parameter ? parameter->kind : PS_NULL;
    const char *message = NULL;
    if (ps_text_is(rule, "equalTo")) {
        if (kind != PS_STRING) message = "Invalid equalTo parameter: expected a field reference string";
    } else if (ps_text_is(rule, "containedIn")) {
        if (kind != PS_STRING) message = "Invalid containedIn parameter: expected a field reference string";
    } else if (ps_text_is(rule, "typeFrom")) {
        if (kind != PS_STRING) message = "Invalid typeFrom parameter: expected a field reference string";
    } else if (ps_text_is(rule, "minFrom")) {
        if (kind != PS_STRING) message = "Invalid minFrom parameter: expected a field reference string";
    } else if (ps_text_is(rule, "maxFrom")) {
        if (kind != PS_STRING) message = "Invalid maxFrom parameter: expected a field reference string";
    } else if (ps_text_is(rule, "enddate")) {
        if (kind != PS_STRING) message = "Invalid enddate parameter: expected a field reference string";
    } else if (ps_text_is(rule, "notEqual")) {
        bool number = kind == PS_INT || (kind == PS_FLOAT && isfinite(parameter->data.number));
        if (kind != PS_STRING && kind != PS_BOOL && !number)
            message = "Invalid notEqual parameter: expected a string, number or boolean";
    } else if (ps_text_is(rule, "unique")) {
        if (kind != PS_STRING && kind != PS_BOOL) message = "Invalid unique parameter: expected true, false or a string";
    } else if (ps_text_is(rule, "reference")) {
        if (kind != PS_STRING) message = REFERENCE_MESSAGE;
    } else {
        return false;
    }
    if (message) *problem = (ps_parameter_problem){.code = "INVALID_RULE_PARAMETER", .message = message};
    return true;
}

bool ps_rule_parameter(ps_text rule, const ps_value *parameter, ps_pattern_cache *patterns,
                       ps_parameter_problem *problem)
{
    *problem = (ps_parameter_problem){0};
    if (ps_length_rule(rule)) {
        *problem = ps_length_parameter(rule, parameter);
        return true;
    }
    if (ps_number_rule(rule)) {
        *problem = ps_number_parameter(rule, parameter);
        return true;
    }
    if (ps_text_is(rule, "in")) {
        *problem = ps_in_parameter(parameter);
        return !problem->code || strcmp(problem->code, "INTERNAL_ERROR");
    }
    if (reference_parameter(rule, parameter, problem)) return true;
    if (ps_text_is(rule, "conditionTree")) {
        if (!ps_condition_tree_parameter(parameter))
            *problem = (ps_parameter_problem){.code = "INVALID_RULE_PARAMETER",
                .message = "Invalid conditionTree parameter: expected true, false or judge"};
        return true;
    }
    if (!pattern_rule(rule)) return true;
    if (!parameter || parameter->kind != PS_STRING) {
        *problem = (ps_parameter_problem){.code = "INVALID_RULE_PARAMETER", .message =
            ps_text_is(rule, "match") ? "Invalid match parameter: expected a pattern string"
                                      : "Invalid pattern parameter: expected a pattern string"};
        return true;
    }
    /* A declared pattern is compiled once, when it is checked. */
    const ps_pattern *pattern;
    ps_pattern_error error;
    int valid = ps_pattern_cache_get(patterns, ps_string(parameter), &pattern, &error);
    if (valid < 0) return false;
    if (!valid) *problem = (ps_parameter_problem){.code = "INVALID_RULE_PATTERN", .reason = error.reason, .offset = error.offset};
    return true;
}

ps_value *ps_parameter_error(ps_text rule, const ps_parameter_problem *problem,
                             const ps_text *path, size_t length)
{
    ps_html_buffer at = {0};
    ps_value *trace = ps_array_value();
    for (size_t i = 0; i < length; ++i) {
        if (i) ps_html_character(&at, '.');
        ps_html_append(&at, path[i]);
        if (trace && !ps_append(trace, ps_text_value(path[i]))) { ps_value_free(trace); trace = NULL; }
    }
    ps_chars location = ps_html_take(&at);
    ps_chars message;
    if (!strcmp(problem->code, "UNKNOWN_RULE")) {
        message = PS_CONCAT(PS_TEXT("Unknown rule: "), rule);
    } else if (problem->reason) {
        char offset[32];
        snprintf(offset, sizeof(offset), "%zu", problem->offset);
        message = PS_CONCAT(PS_TEXT("Invalid "), rule, PS_TEXT(" pattern: "), ps_fixed(problem->reason),
                            PS_TEXT(" at "), ps_fixed(offset));
    } else {
        message = ps_copy(ps_fixed(problem->message));
    }
    ps_value *error = location.bytes && message.bytes && trace
        ? ps_error_text("compose", problem->code, ps_view(message), ps_view(location), trace)
        : NULL;
    if (error && problem->reason) {
        /* The parameter error and the syntax error of a pattern are the causes of the load failure (C17.70). */
        ps_value *parameter = ps_error_text("parameter", problem->code, ps_view(message), ps_view(location), NULL);
        ps_value *syntax = ps_object_value();
        if (syntax && ps_set(syntax, "kind", ps_string_value("syntax")) &&
            ps_set(syntax, "reason", ps_string_value(problem->reason)) &&
            ps_set(syntax, "offset", ps_int_value((int64_t)problem->offset))) {
            parameter = ps_error_with_cause(parameter, syntax);
        } else {
            ps_value_free(syntax);
            ps_value_free(parameter);
            parameter = NULL;
        }
        error = parameter ? ps_error_with_cause(error, parameter) : (ps_value_free(error), NULL);
    }
    free(location.bytes);
    free(message.bytes);
    ps_value_free(trace);
    return error;
}

static ps_value *internal_error(void)
{
    return ps_error("internal", "INTERNAL_ERROR", "Validation failed", "", NULL);
}

/* The load failure of one parameter that takes effect, or NULL. */
static ps_value *check_value(ps_text rule, const ps_value *parameter, const ps_text *path, size_t length,
                             ps_pattern_cache *patterns)
{
    if (parameter->kind == PS_NULL || (parameter->kind == PS_BOOL && !parameter->data.boolean)) return NULL;
    ps_parameter_problem problem;
    if (!ps_rule_parameter(rule, parameter, patterns, &problem)) return internal_error();
    if (!problem.code) return NULL;
    ps_value *error = ps_parameter_error(rule, &problem, path, length);
    return error ? error : internal_error();
}

/*
 * The load failure of a declared parameter. A length, numeric or count parameter may be
 * conditional: every value of a condition map and every literal branch of a ternary is checked,
 * selected or not; a branch that takes its value from the data, and the result of any other
 * expression, is checked when validation selects it. A string that is not an expression is a
 * literal. Pattern and membership parameters are used as declared.
 */
static ps_value *check_declared(ps_text rule, const ps_value *parameter, const ps_text *path, size_t length,
                                ps_pattern_cache *patterns)
{
    if (!ps_length_rule(rule) && !ps_number_rule(rule))
        return check_value(rule, parameter, path, length, patterns);
    if (parameter->kind == PS_OBJECT) {
        for (size_t i = 0; i < ps_size(parameter); ++i) {
            ps_value *error = check_value(rule, ps_at(parameter, i), path, length, patterns);
            if (error) return error;
        }
        return NULL;
    }
    if (parameter->kind != PS_STRING || !ps_condition_expression(ps_string(parameter)))
        return check_value(rule, parameter, path, length, patterns);
    bool parsed = false;
    ps_value *literals = ps_expression_literals(ps_string(parameter), &parsed);
    if (!literals) return internal_error();
    /* A string that is not an expression is a literal. */
    if (!parsed) {
        ps_value_free(literals);
        return check_value(rule, parameter, path, length, patterns);
    }
    ps_value *error = NULL;
    for (size_t i = 0; !error && i < ps_size(literals); ++i)
        error = check_value(rule, ps_at(literals, i), path, length, patterns);
    ps_value_free(literals);
    return error;
}

/* The UNKNOWN_RULE load failure of a name that is not a registered rule, or NULL. */
static ps_value *check_name(ps_text rule, const ps_text *path, size_t length)
{
    if (ps_registered_rule(rule)) return NULL;
    static const ps_parameter_problem unknown = {.code = "UNKNOWN_RULE"};
    ps_value *error = ps_parameter_error(rule, &unknown, path, length);
    return error ? error : internal_error();
}

/*
 * The load failure INVALID_RULE_PARAMETER with message at the declaration path location, whose trace is the path, or NULL when
 * an allocation fails.
 */
static ps_value *declaration_error(const ps_text *path, size_t length, ps_text location, ps_text message)
{
    ps_value *trace = ps_array_value();
    bool ok = trace != NULL;
    for (size_t i = 0; ok && i < length; ++i) {
        ps_value *name = ps_text_value(path[i]);
        ok = name && ps_append(trace, name);
    }
    ps_value *error = ok ? ps_error_text("compose", "INVALID_RULE_PARAMETER", message, location, trace) : NULL;
    ps_value_free(trace);
    return error;
}

/*
 * The load failure of a field's group source (group_source.c), or NULL: INVALID_RULE_PARAMETER at
 * the declaration path. An allocation failure is an internal error.
 */
static ps_value *check_group_source(const ps_value *field, const ps_text *path, size_t length,
                                    const ps_value *root)
{
    ps_chars location = ps_dotted_path(path, length, (ps_text){NULL, 0});
    ps_chars message = {NULL, 0};
    int state = location.bytes ? ps_group_source_failure(field, ps_view(location), root, &message) : -1;
    ps_value *error = state > 0 ? declaration_error(path, length, ps_view(location), ps_view(message)) : NULL;
    free(location.bytes);
    free(message.bytes);
    if (state < 0 || (state > 0 && !error)) return internal_error();
    return error;
}

/*
 * The load failure of a field whose multiple is present and is not a boolean, only or an object (schema.md, CUSC-081), or
 * NULL: INVALID_RULE_PARAMETER at the declaration path. An allocation failure is an internal error.
 */
static ps_value *check_multiple(const ps_value *field, const ps_text *path, size_t length)
{
    const ps_value *multiple = ps_get(field, "multiple");
    if (!multiple || multiple->kind == PS_BOOL || multiple->kind == PS_OBJECT || ps_is_string(multiple, "only")) return NULL;
    ps_chars location = ps_dotted_path(path, length, (ps_text){NULL, 0});
    ps_chars message = location.bytes
        ? PS_CONCAT(PS_TEXT("Invalid multiple at "), ps_view(location), PS_TEXT(": expected a boolean, only or an object"))
        : (ps_chars){NULL, 0};
    ps_value *error = message.bytes ? declaration_error(path, length, ps_view(location), ps_view(message)) : NULL;
    free(location.bytes);
    free(message.bytes);
    return error ? error : internal_error();
}

/*
 * The load failure of a reference parameter that names no field of root that a reference can name
 * (a field whose type is not group and that has no lang), or NULL.
 */
static ps_value *check_target(ps_text rule, const ps_value *parameter, const ps_value *root,
                              const ps_text *path, size_t length)
{
    if (!ps_text_is(rule, "reference") || parameter->kind != PS_STRING || ps_reference_target(root, ps_string(parameter)))
        return NULL;
    static const ps_parameter_problem problem = {.code = "INVALID_RULE_PARAMETER", .message = REFERENCE_MESSAGE};
    ps_value *error = ps_parameter_error(rule, &problem, path, length);
    return error ? error : internal_error();
}

/*
 * A field's multiple, then its group source, then its rule names and parameters in declaration order, then its messages
 * keys.
 */
static ps_value *check_field(const ps_value *field, const ps_text *path, size_t length,
                             ps_pattern_cache *patterns, const ps_value *root)
{
    ps_value *multiple_error = check_multiple(field, path, length);
    if (multiple_error) return multiple_error;
    ps_value *source_error = check_group_source(field, path, length, root);
    if (source_error) return source_error;
    const ps_value *rules = ps_get(field, "validate");
    for (size_t i = 0; rules && rules->kind == PS_OBJECT && i < ps_size(rules); ++i) {
        ps_text rule = ps_key(rules, i);
        ps_value *error = check_name(rule, path, length);
        if (!error) error = check_declared(rule, ps_at(rules, i), path, length, patterns);
        if (!error) error = check_target(rule, ps_at(rules, i), root, path, length);
        if (error) return error;
    }
    const ps_value *messages = ps_get(field, "messages");
    for (size_t i = 0; messages && messages->kind == PS_OBJECT && i < ps_size(messages); ++i) {
        ps_value *error = check_name(ps_key(messages, i), path, length);
        if (error) return error;
    }
    return NULL;
}

bool ps_repeated_field(const ps_value *field)
{
    const ps_value *multiple = ps_get(field, "multiple");
    return multiple && (multiple->kind == PS_OBJECT || ps_is_string(multiple, "only") ||
                        (multiple->kind == PS_BOOL && multiple->data.boolean));
}

/*
 * Whether reference, declared by the field at path, names a repeated group of the form whose root
 * field map is root (docs/spec/schema.md, Keyed maps): it leaves as many fields of the declaration
 * path as it has leading dots (a bare name one; a path with a dot inside and no leading dot starts
 * at the root), stays within the root, has no empty name and no "*", passes only through groups
 * that do not repeat and ends on a repeated group.
 */
static bool names_repeated_group(const ps_value *reference, const ps_value *root, const ps_text *path, size_t length)
{
    if (reference->kind != PS_STRING) return false;
    ps_text text = ps_string(reference);
    size_t dots = 0;
    while (dots < text.length && text.bytes[dots] == '.') dots++;
    ps_text rest = ps_text_slice(text, dots, text.length);
    bool from_root = dots == 0 && ps_text_find_byte(rest, '.', 0) != SIZE_MAX;
    size_t leave = from_root ? length : (dots ? dots : 1);
    if (leave > length) return false;
    for (size_t start = 0;;) {
        size_t end = ps_text_find_byte(rest, '.', start);
        ps_text name = ps_text_slice(rest, start, end == SIZE_MAX ? rest.length : end);
        if (name.length == 0 || ps_text_is(name, "*")) return false;
        if (end == SIZE_MAX) break;
        start = end + 1;
    }
    const ps_value *properties = root;
    for (size_t i = 0; i < length - leave; ++i) {
        const ps_value *field = properties ? ps_get_text(properties, path[i]) : NULL;
        properties = field && field->kind == PS_OBJECT ? ps_get(field, "properties") : NULL;
        if (properties && properties->kind != PS_OBJECT) properties = NULL;
    }
    for (size_t start = 0;;) {
        size_t end = ps_text_find_byte(rest, '.', start);
        ps_text name = ps_text_slice(rest, start, end == SIZE_MAX ? rest.length : end);
        const ps_value *field = properties ? ps_get_text(properties, name) : NULL;
        const ps_value *children = field && field->kind == PS_OBJECT ? ps_get(field, "properties") : NULL;
        if (!field || field->kind != PS_OBJECT || !ps_is_string(ps_get(field, "type"), "group") ||
            !children || children->kind != PS_OBJECT)
            return false;
        if (end == SIZE_MAX) return ps_repeated_field(field);
        if (ps_repeated_field(field)) return false;
        properties = children;
        start = end + 1;
    }
}

/* The INVALID_FORM_INPUT load failure of a multiple.keys that names no repeated group, or NULL. */
static ps_value *check_keyed_map(const ps_value *field, const ps_value *root, const ps_text *path, size_t length)
{
    const ps_value *multiple = ps_get(field, "multiple");
    const ps_value *reference = multiple && multiple->kind == PS_OBJECT ? ps_get(multiple, "keys") : NULL;
    if (!reference || names_repeated_group(reference, root, path, length)) return NULL;
    ps_chars dotted = ps_dotted_path(path, length, (ps_text){NULL, 0});
    ps_chars message = dotted.bytes ? PS_CONCAT(PS_TEXT("Invalid multiple.keys at "), ps_view(dotted),
                                                PS_TEXT(": expected a reference to a repeated group")) : dotted;
    ps_value *error = message.bytes
        ? ps_error_text("input", "INVALID_FORM_INPUT", ps_view(message), PS_TEXT(""), NULL) : NULL;
    free(dotted.bytes);
    free(message.bytes);
    return error ? error : internal_error();
}

static ps_value *check_properties(const ps_value *properties, const ps_value *root, ps_text **path,
                                  size_t *capacity, size_t length, ps_pattern_cache *patterns)
{
    if (!properties || properties->kind != PS_OBJECT) return NULL;
    for (size_t i = 0; i < ps_size(properties); ++i) {
        const ps_value *field = ps_at(properties, i);
        if (!field || field->kind != PS_OBJECT) continue;
        if (length + 1 > *capacity) {
            size_t grown = *capacity ? *capacity * 2 : 8;
            ps_text *resized = realloc(*path, grown * sizeof(**path));
            if (!resized) return internal_error();
            *path = resized;
            *capacity = grown;
        }
        (*path)[length] = ps_key(properties, i);
        ps_value *error = check_field(field, *path, length + 1, patterns, root);
        if (!error) error = check_keyed_map(field, root, *path, length + 1);
        if (error) return error;
        const ps_value *children = ps_get(field, "properties");
        if (ps_is_string(ps_get(field, "type"), "group") && children && children->kind == PS_OBJECT) {
            error = check_properties(children, root, path, capacity, length + 1, patterns);
            if (error) return error;
        }
    }
    return NULL;
}

ps_value *ps_check_rule_parameters(const ps_value *properties, ps_pattern_cache *patterns)
{
    ps_text *path = NULL;
    size_t capacity = 0;
    ps_value *error = check_properties(properties, properties, &path, &capacity, 0, patterns);
    free(path);
    return error;
}
