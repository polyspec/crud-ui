#ifndef CRUDUI_ENGINE_INTERNAL_H
#define CRUDUI_ENGINE_INTERNAL_H

#include "crudui_engine.h"

#include <stdlib.h>
#include <string.h>

/*
 * Strings carry their byte length. Every string that can hold user data (keys, values, paths,
 * expressions, messages and markup) is a ps_text or a ps_chars and is read by its length, so a
 * NUL character is an ordinary character. A plain C string is used only for a fixed identifier
 * known when the engine is compiled (a member name, a tag, a message or an error code).
 */

/* Borrowed bytes. */
typedef struct {
    const char *bytes;
    size_t length;
} ps_text;

/* Owned bytes from malloc, followed by one terminating zero that is never read as an end; bytes is
   NULL after an allocation failure. */
typedef struct {
    char *bytes;
    size_t length;
} ps_chars;

/* A fixed C string literal as text. */
#define PS_TEXT(literal) ((ps_text){"" literal, sizeof(literal) - 1})
/* Several texts joined into new memory. */
#define PS_CONCAT(...) \
    ps_concat((const ps_text[]){__VA_ARGS__}, sizeof((const ps_text[]){__VA_ARGS__}) / sizeof(ps_text))

/* A fixed identifier as text; NULL is empty. */
static inline ps_text ps_fixed(const char *identifier)
{
    return (ps_text){identifier ? identifier : "", identifier ? strlen(identifier) : 0};
}

static inline ps_text ps_view(ps_chars owned)
{
    return (ps_text){owned.bytes ? owned.bytes : "", owned.bytes ? owned.length : 0};
}

bool ps_text_equal(ps_text left, ps_text right);
/* Text equal to a fixed identifier. */
bool ps_text_is(ps_text text, const char *identifier);
bool ps_text_starts(ps_text text, const char *prefix);
bool ps_text_ends(ps_text text, const char *suffix);
/* The first position at or after from of a byte or a text, or SIZE_MAX. */
size_t ps_text_find_byte(ps_text text, char byte, size_t from);
size_t ps_text_find(ps_text text, ps_text needle, size_t from);
ps_text ps_text_slice(ps_text text, size_t start, size_t end);
/* Bytewise order of two texts: negative, zero or positive. */
int ps_text_compare(ps_text left, ps_text right);
ps_chars ps_copy(ps_text text);
ps_chars ps_concat(const ps_text *parts, size_t count);
/* Decimal text of an unsigned integer. */
ps_chars ps_decimal(size_t value);

typedef struct {
    char *key;
    size_t key_length;
    ps_value *value;
} ps_member;

struct ps_value {
    uint8_t kind;
    union {
        bool boolean;
        int64_t integer;
        double number;
        struct { char *bytes; size_t length; } string;
        /*
         * An object with many members also has slots, a hash index of member positions: each
         * slot holds a position plus one, or zero when empty; slot_count is a power of two.
         */
        struct { ps_member *items; size_t length; size_t capacity; size_t *slots; size_t slot_count; } children;
    } data;
};

typedef struct {
    char *data;
    size_t length;
    size_t capacity;
    bool failed;
} ps_html_buffer;

ps_value *ps_value_clone(const ps_value *value);
/*
 * Specification member order: every object lists array index names (canonical decimal integers
 * from 0 to 4294967294) first in ascending numeric order, then all other names in insertion
 * order. ps_value_order reorders an owned value in place and ps_value_ordered returns an ordered
 * copy; both return false or NULL only on allocation failure.
 */
bool ps_value_order(ps_value *value);
ps_value *ps_value_ordered(const ps_value *value);
/* Update an object's member index after its members were reordered in place. */
void ps_value_reindex(ps_value *object);
/*
 * True when a template is exactly the shape compileForm produces: only kind
 * (crudui/form-template), fields, buttons (objects), an optional string keyPrefix and an optional
 * object action; each field has exactly a string name, an object spec and a field list children.
 */
bool ps_form_template_shape(const ps_value *template);
/*
 * Copy a specification (or template) in member order and, when ordered_options is given, copy the
 * options with only options.files in member order; record data keeps its order. NULL inputs stay
 * NULL. Returns false only on allocation failure.
 */
bool ps_order_specification(const ps_value *spec, const ps_value *options,
                            ps_value **ordered_spec, ps_value **ordered_options);
/* Members by a fixed identifier. */
const ps_value *ps_get(const ps_value *value, const char *key);
ps_value *ps_get_mut(ps_value *value, const char *key);
bool ps_has(const ps_value *value, const char *key);

/* The comparison operators of the structured condition editor, in their order (CUSC-073, CUSC-085). */
extern const char *const ps_condition_ops[8];
/* A string, a finite number or a boolean: an operand of a condition comparison (CUSC-073). */
bool ps_condition_scalar(const ps_value *value);
bool ps_set(ps_value *object, const char *key, ps_value *value);
/* Members by a text key. */
const ps_value *ps_get_text(const ps_value *value, ps_text key);
ps_value *ps_get_mut_text(ps_value *value, ps_text key);
bool ps_has_text(const ps_value *value, ps_text key);
bool ps_set_text(ps_value *object, ps_text key, ps_value *value);
bool ps_delete_text(ps_value *object, ps_text key);
size_t ps_size(const ps_value *value);
const ps_value *ps_at(const ps_value *value, size_t index);
/* The member name at index of an object; empty text for any other value. */
ps_text ps_key(const ps_value *value, size_t index);
bool ps_append(ps_value *array, ps_value *value);
bool ps_equal(const ps_value *left, const ps_value *right);
bool ps_is_string(const ps_value *value, const char *text);
/*
 * The bytes of a string value; empty text for any other value. The stored bytes are followed by a
 * zero byte, so a C parser such as strtod may start inside them: it stops at the first zero byte,
 * and the caller compares the end it reports with the length.
 */
ps_text ps_string(const ps_value *value);
bool ps_truthy(const ps_value *value);
ps_value *ps_null_value(void);
ps_value *ps_bool_value(bool value);
ps_value *ps_int_value(int64_t value);
ps_value *ps_float_value(double value);
/* A string value of a fixed identifier. */
ps_value *ps_string_value(const char *value);
ps_value *ps_text_value(ps_text value);
/* A string value that takes the owned bytes, which are freed in every case. */
ps_value *ps_chars_value(ps_chars value);
ps_value *ps_array_value(void);
ps_value *ps_object_value(void);
bool ps_replace(ps_value *parent, size_t index, ps_value *value);
const ps_value *ps_path(const ps_value *root, ps_text path);
const ps_value *ps_path_segments(const ps_value *root, const ps_text *segments, size_t length);
ps_chars ps_scalar_string(const ps_value *value);
ps_chars ps_js_string(const ps_value *value);
ps_chars ps_json_string(const ps_value *value);
ps_chars ps_json_quote(ps_text value);
ps_chars ps_join_classes(ps_text first, ps_text second, ps_text third);
ps_chars ps_join_path(ps_text parent, ps_text child);
/* An absent prefix has NULL bytes. */
ps_chars ps_bracket_name(ps_text path, ps_text prefix);
ps_chars ps_rule_name(ps_text path, const size_t *row_segments, size_t row_count);
ps_chars ps_leaf_name(ps_text path, const size_t *row_segments, size_t row_count);
ps_chars ps_control_id(ps_text prefix, ps_text path);
ps_chars ps_translate(const ps_value *value, ps_text language);
ps_chars ps_style_string(ps_text source);
ps_chars ps_format_date(ps_text source, bool datetime);
ps_chars ps_format_date_pattern(ps_text source, ps_text pattern);
/* Path segments as views into path; free the array with free. */
bool ps_path_parts(ps_text path, ps_text **parts, size_t *length);
bool ps_condition_expression(ps_text value);

bool ps_html_bytes(ps_html_buffer *out, const char *value, size_t length);
bool ps_html_append(ps_html_buffer *out, ps_text value);
/* Fixed markup. */
bool ps_html_text(ps_html_buffer *out, const char *value);
bool ps_html_character(ps_html_buffer *out, char value);
ps_chars ps_html_take(ps_html_buffer *out);
ps_value *ps_html_value(ps_html_buffer *out);
bool ps_html_escaped(ps_html_buffer *out, ps_text value, bool raw);
bool ps_html_raw_text(ps_html_buffer *out, ps_text value);
bool ps_html_void_tag(ps_text tag);
bool ps_html_start_element(ps_html_buffer *out, ps_text tag,
                           const ps_value *attrs, bool raw, bool style_last);
bool ps_html_end_element(ps_html_buffer *out, ps_text tag);
bool ps_html_attr_string(ps_value *attrs, const char *name, const char *value);
bool ps_html_attr_text(ps_value *attrs, const char *name, ps_text value);
bool ps_html_attr_clone(ps_value *attrs, const char *name, const ps_value *value);
ps_value *ps_html_appearance_attrs(ps_text class_name, ps_text style);

/* Interface labels for row, collection and form controls; {count} is replaced by a number. */
typedef struct {
    const char *move_up;
    const char *move_down;
    const char *add_row;
    const char *copy_row;
    const char *remove_row;
    const char *toggle_row;
    const char *expand_all;
    const char *collapse_all;
    const char *undo;
    const char *redo;
    const char *row_controls;
    const char *collection_controls;
    const char *form_controls;
    const char *form_actions;
    const char *submit;
    const char *reset;
    const char *outline;
    const char *data;
    const char *untitled;
    const char *collapsed;
    const char *count;
    const char *children;
    const char *condition_mode;
    const char *condition_add_comparison;
    const char *condition_add_group;
    const char *condition_add_judge;
    const char *condition_remove;
    const char *condition_invalid;
} ps_form_messages;

/* Interface labels for list pagination buttons and empty list text; {page} is replaced by a page number. */
typedef struct {
    const char *previous_page;
    const char *next_page;
    const char *page;
    const char *empty_list;
} ps_list_messages;

/* The interface text of one language, generated from contracts/interface-messages.json. */
typedef struct {
    const char *language;
    ps_form_messages messages;
} ps_language_messages;
typedef struct {
    const char *language;
    ps_list_messages messages;
} ps_list_language_messages;
extern const ps_language_messages ps_interface_messages[];
extern const size_t ps_interface_messages_count;
extern const ps_list_language_messages ps_interface_list_messages[];
extern const size_t ps_interface_list_messages_count;

/* Interface text for a supported language (ko, en, ja, zh), or NULL. */
const ps_form_messages *ps_form_messages_for(ps_text language);
const ps_list_messages *ps_list_messages_for(ps_text language);
/* Replace the first {count} in a counted message. */
ps_chars ps_format_count(const char *template, size_t count);
/* Replace the first {page} in a page label. */
ps_chars ps_format_page(const char *template, size_t page);

/* The design of a node at path; rows holds the positions of the row keys in the path. */
ps_value *ps_design(const ps_value *design, const ps_value *data, ps_text path,
                    const size_t *rows, size_t row_count);
bool ps_widget_supported(ps_text type);
/* Whether a field type renders the choices layout (choice and multichoice and their aliases). */
bool ps_widget_choices(ps_text type);
/* Whether a field type renders a select (select, dropdown and selectbox). */
bool ps_widget_select(ps_text type);
/*
 * The declared control attributes of a field spec (design.attributes) or, with wrapper, its node
 * root attributes (design.wrapper.attributes); NULL when none is declared.
 */
const ps_value *ps_declared_attributes(const ps_value *spec, bool wrapper);
/* Append copies of the members of attributes to object in their order; false on allocation failure. */
bool ps_append_attributes(ps_value *object, const ps_value *attributes);
/* An absent key prefix has NULL bytes. */
ps_value *ps_widget(const ps_value *spec, const ps_value *value, bool value_present,
                    ps_text path, const ps_value *design, ps_text key_prefix,
                    ps_text id_prefix, ps_text language,
                    const size_t *row_segments, size_t row_count);
ps_chars ps_render_fields(const ps_value *fields);
/* Evaluate the template buttons for a record: type, tag, text and attrs in output order. */
ps_value *ps_bind_buttons(const ps_value *template, const ps_value *data, ps_text language);
/* The error texts of one rendered node (form-runtime.md, "Complete form"). */
typedef struct {
    const ps_value *node;
    ps_value *messages;
} ps_node_errors;

/* Checked render options of a complete form. */
typedef struct {
    ps_value *form;              /* form element attributes in output order; NULL without action */
    const ps_value *hidden;      /* hidden input values: an object of strings, or NULL */
    const ps_value *form_errors; /* errors of the whole form: a list of strings, or NULL */
    ps_node_errors *errors;      /* error texts of the nodes that have errors */
    size_t error_count;
} ps_form_render;

/* Form markup: the form element and hidden inputs of `render` (NULL for none) around the
   crudui-form block, which holds the translated root description when it is not empty, the form
   errors, the field body and the footer controls group holding the buttons. */
ps_chars ps_render_form(const ps_value *fields, const ps_value *buttons, const char *actions_label,
                        const ps_form_render *render, ps_text description);
/* Every interface text as an object keyed by message name. */
ps_value *ps_form_messages_value(const ps_form_messages *messages);

/*
 * Expressions evaluated at current_path; row_keys, when not NULL, holds for each segment of the
 * path whether it is a row key, so a row is one level of a relative path (docs/spec/expressions.md,
 * "Evaluation"). ps_relative_base: the length of the prefix of a path of path_length segments that
 * a relative path with levels_up further dots starts from.
 */
size_t ps_relative_base(const bool *row_keys, size_t path_length, size_t levels_up);
ps_value *ps_expression_value(ps_text expression, const ps_value *data,
                              const ps_text *current_path, const bool *row_keys, size_t path_length,
                              bool *parsed);
bool ps_expression_truth(ps_text expression, const ps_value *data,
                         const ps_text *current_path, const bool *row_keys, size_t path_length,
                         bool *parsed);
/*
 * The literal values a ternary expression can return, through nested ternaries and parentheses,
 * in branch order: an empty array for any other expression, with *parsed false when the text is
 * not an expression; NULL on allocation failure.
 */
ps_value *ps_expression_literals(ps_text expression, bool *parsed);
ps_value *ps_condition_value(const ps_value *map, const ps_value *data,
                             const ps_text *current_path, const bool *row_keys, size_t path_length);
/*
 * A conditional declaration resolved in the row context (docs/spec/validation-rules.md,
 * "Conditional parameters"): a condition map selects its first matching value or its true default
 * (null when nothing matches), a condition expression gives its value, and any other value,
 * including a string that is not a valid expression, is itself. NULL only on allocation failure
 * (or for a NULL declaration).
 */
ps_value *ps_resolve_conditional(const ps_value *declared, const ps_value *data,
                                 const ps_text *current_path, const bool *row_keys, size_t path_length);
/*
 * Visibility of design.show: only a value that resolves to false hides; a missing show is visible.
 * *failed is set when the resolution cannot be allocated.
 */
bool ps_shown(const ps_value *show, const ps_value *data,
              const ps_text *current_path, const bool *row_keys, size_t path_length, bool *failed);

/*
 * Values (whitespace.c, canonical.c; docs/spec/validation-rules.md, "Values").
 * ps_whitespace: a code point with the Unicode White_Space property.
 * ps_utf8_decode: the code point at index of engine text and its byte length (at least 1).
 * ps_trim: the text without leading and trailing whitespace.
 * ps_code_points: the number of code points.
 * ps_empty_value: missing, null, a string empty after trimming, or an empty array or object.
 * ps_number_text: a finite double as ECMAScript Number.prototype.toString writes it; NULL bytes on
 * allocation failure.
 * ps_canonical_text: the canonical text of a string, boolean or number: 1 with owned text, 0 for
 * any other value, -1 on allocation failure.
 */
bool ps_whitespace(uint32_t code_point);
size_t ps_utf8_decode(ps_text text, size_t index, uint32_t *code_point);
ps_text ps_trim(ps_text text);
size_t ps_code_points(ps_text text);
bool ps_empty_value(const ps_value *value);
ps_chars ps_number_text(double number);
int ps_canonical_text(const ps_value *value, ps_chars *text);

/*
 * A rule parameter outside the specification (docs/spec/validation-rules.md, "Parameter
 * errors"): code is NULL for a valid parameter. A pattern problem has a reason and a code-point
 * offset and no fixed message; every other problem has a fixed message.
 */
typedef struct {
    const char *code;
    const char *message;
    const char *reason;
    size_t offset;
} ps_parameter_problem;

/* Length rules (rule_length.c). ps_length_passes: 1 or 0 for a valid parameter, -1 otherwise. */
bool ps_length_rule(ps_text rule);
bool ps_length_limit(const ps_value *parameter, int64_t *limit);
bool ps_length_range(const ps_value *parameter, int64_t *minimum, int64_t *maximum);
ps_parameter_problem ps_length_parameter(ps_text rule, const ps_value *parameter);
int ps_length_passes(ps_text rule, const ps_value *value, const ps_value *parameter);

/*
 * Choice lists (choice_list.c, docs/spec/schema.md "Choice lists", "Choice groups").
 * ps_is_choice_list: an array with an object element that has a value or a choices member.
 * ps_choice_next: the next choice of a choice list in written order, the choices of each group in
 * place of the group, or NULL at the end; group, when given, receives the position of the group in
 * the list, or SIZE_MAX for a choice outside groups. A cursor starts as {items, 0, 0}.
 * ps_choice_list_valid: 1 when every choice has a value and a label and no other member, besides
 * class, style and attributes with appearance (the choices of a choice or multichoice field), every
 * value is a string or a finite number, no two values have the same canonical text and, with
 * groups (the choice list of a select field or an in parameter), every group has exactly a label
 * and a non-empty list of such choices without appearance; 0 otherwise; -1 on allocation failure.
 * ps_choice_value_text: the canonical text of the value of a valid choice; NULL bytes on
 * allocation failure.
 * ps_choice_label: the label of the choice of a valid choice list whose value text is key, or NULL;
 * failed reports an allocation failure.
 */
typedef struct {
    const ps_value *items;
    size_t item;
    size_t inner;
} ps_choice_cursor;
bool ps_is_choice_list(const ps_value *items);
const ps_value *ps_choice_next(ps_choice_cursor *cursor, size_t *group);
int ps_choice_list_valid(const ps_value *items, bool appearance, bool groups);
ps_chars ps_choice_value_text(const ps_value *choice);
const ps_value *ps_choice_label(const ps_value *items, ps_text key, bool *failed);

/*
 * Choices from a repeated group (group_source.c; docs/spec/schema.md, "Choices from a repeated group").
 * ps_is_group_source: an items object with the member from.
 * ps_group_source_failure: the declaration check of a field's group source under the root
 * properties: 0 when valid or not a group source, 1 with the message in *message, -1 on allocation
 * failure.
 * ps_group_source_choices: the choices of a checked group source for the root data, an array of
 * {value, label} objects, its literal choices first (CUSC-089); NULL with the owned message in *repeated
 * when a row's value repeats a literal choice, and NULL with *repeated empty on allocation failure.
 */
bool ps_is_group_source(const ps_value *items);
int ps_group_source_failure(const ps_value *field, ps_text path, const ps_value *root, ps_chars *message);
ps_value *ps_group_source_choices(const ps_value *items, const ps_value *data, ps_chars *repeated);
/*
 * ps_group_source_repeat: the input failure message of the first row of a checked group source, in
 * data order, whose choice value repeats a literal choice (CUSC-089) or that of an earlier row
 * (CUVR-087): 0 when none repeats, 1 with the message in *message, -1 on allocation failure.
 */
int ps_group_source_repeat(const ps_value *items, const ps_value *data, ps_chars *message);

/* Membership (rule_in.c). ps_in_passes: 1, 0, or -1 on allocation failure; the parameter is valid. */
ps_parameter_problem ps_in_parameter(const ps_value *parameter);
int ps_in_passes(const ps_value *value, const ps_value *parameter);

/*
 * Condition trees (rule_condition_tree.c): ps_condition_tree_parameter is true for the parameters
 * true and judge, and ps_condition_tree_passes whether a value is a condition tree under one of them.
 */
bool ps_condition_tree_parameter(const ps_value *parameter);
bool ps_condition_tree_passes(const ps_value *value, const ps_value *parameter);

/*
 * References (references.c). ps_reference_target: whether path is the declaration path of a field of
 * properties whose type is not group and whose lang is absent, false or null. ps_reference_ids: the
 * array of the ids of path in data, or NULL on allocation failure.
 */
bool ps_reference_target(const ps_value *properties, ps_text path);
ps_value *ps_reference_ids(const ps_value *properties, const ps_value *data, ps_text path);

/*
 * Locale-independent number text (number_text.c); no engine path uses strtod or printf for a
 * floating-point number.
 * ps_numeric_text: whether trimmed text is numeric text (the HTML valid floating-point number)
 * whose value is finite, with that value, the nearest double.
 * ps_c_number: the number strtod reads in the "C" locale from the start of text (after ASCII
 * space): the byte count read, 0 when nothing is a number; *overflow is set, with an infinite
 * number, when a finite spelling overflows.
 * ps_format_general: printf "%.*g" in the "C" locale (precision 1 to 17); NULL bytes on
 * allocation failure.
 */
bool ps_numeric_text(ps_text text, double *number);
size_t ps_c_number(ps_text text, double *number, bool *overflow);
ps_chars ps_format_general(double number, int precision);

/*
 * Numbers (rule_number.c; docs/spec/validation-rules.md, "Numbers").
 * ps_numeric_value: a finite number, or a string that is numeric text after trimming.
 * ps_step_multiple: whether |value| is an integer multiple of a positive step, both read exactly as
 * the decimal numbers their canonical texts write: 1 or 0, -1 on allocation failure.
 * ps_number_rule: number, digits, min, max, range, step, mincount and maxcount.
 * ps_number_passes: 1 or 0 for a valid parameter, -1 otherwise or on allocation failure.
 */
bool ps_numeric_value(const ps_value *value, double *number);
int ps_step_multiple(double value, double step);
bool ps_number_rule(ps_text rule);
ps_parameter_problem ps_number_parameter(ps_text rule, const ps_value *parameter);
int ps_number_passes(ps_text rule, const ps_value *value, const ps_value *parameter);

/*
 * Unicode data (unicode_data.c, generated from contracts/unicode-properties.json): inclusive
 * code-point ranges in ascending order. Property tables are in bytewise name order.
 */
typedef struct {
    uint32_t start;
    uint32_t end;
} ps_code_range;

typedef struct {
    const char *name;
    const ps_code_range *ranges;
    size_t count;
} ps_unicode_property;

extern const char ps_unicode_version[];
extern const ps_code_range ps_white_space[];
extern const size_t ps_white_space_count;
extern const ps_unicode_property ps_general_categories[];
extern const size_t ps_general_categories_count;
extern const ps_unicode_property ps_scripts[];
extern const size_t ps_scripts_count;

/*
 * Code-point sets (pattern_set.c): sorted, disjoint inclusive ranges.
 * ps_code_ranges_contain: membership by binary search.
 * ps_unicode_category, ps_unicode_script: a property by its exact name, or NULL.
 */
bool ps_code_ranges_contain(const ps_code_range *ranges, size_t count, uint32_t code_point);
const ps_unicode_property *ps_unicode_category(ps_text name);
const ps_unicode_property *ps_unicode_script(ps_text name);

typedef struct {
    ps_code_range *ranges;
    size_t count;
    size_t capacity;
    bool failed;
} ps_code_set;

/* Add ranges (in any order); normalize sorts and merges them; complement inverts over 0..0x10FFFF. */
bool ps_code_set_add(ps_code_set *set, uint32_t start, uint32_t end);
bool ps_code_set_add_ranges(ps_code_set *set, const ps_code_range *ranges, size_t count);
bool ps_code_set_normalize(ps_code_set *set);
bool ps_code_set_complement(ps_code_set *set);
void ps_code_set_free(ps_code_set *set);

/*
 * The CRUDUI pattern language (pattern.c) and its matcher (pattern_match.c).
 * ps_pattern_compile: 1 with a compiled pattern, 0 with the reason and code-point offset of the
 * first construct outside the language, -1 on allocation failure.
 * ps_pattern_matches: whether the whole text matches (1 or 0), -1 on allocation failure; the time
 * is proportional to the code points of the text times the states of the pattern.
 */
typedef struct {
    const char *reason;
    size_t offset;
} ps_pattern_error;

typedef struct ps_pattern ps_pattern;

int ps_pattern_compile(ps_text source, ps_pattern **pattern, ps_pattern_error *error);
int ps_pattern_matches(const ps_pattern *pattern, ps_text text);
size_t ps_pattern_state_count(const ps_pattern *pattern);
void ps_pattern_free(ps_pattern *pattern);

/*
 * Compiled patterns by source text for one operation. ps_pattern_cache_get compiles a source
 * once: 1 with the borrowed pattern, 0 with the language error, -1 on allocation failure.
 */
typedef struct ps_pattern_cache ps_pattern_cache;

ps_pattern_cache *ps_pattern_cache_new(void);
int ps_pattern_cache_get(ps_pattern_cache *cache, ps_text source, const ps_pattern **pattern,
                         ps_pattern_error *error);
void ps_pattern_cache_free(ps_pattern_cache *cache);

/* Rule name and parameter checks (rule_parameters.c). */
/* Whether a validate or messages key is a registered rule name. */
bool ps_registered_rule(ps_text rule);
/*
 * The problem of a parameter that takes effect (not false or null) for one rule; the length,
 * numeric, count, membership and pattern rules have parameter checks. Returns false on
 * allocation failure.
 */
bool ps_rule_parameter(ps_text rule, const ps_value *parameter, ps_pattern_cache *patterns,
                       ps_parameter_problem *problem);
/* The load failure of a problem at a field's declaration path; NULL on allocation failure. */
ps_value *ps_parameter_error(ps_text rule, const ps_parameter_problem *problem,
                             const ps_text *path, size_t length);
/*
 * Check the declared rule names and parameters of composed form properties: fields in declaration
 * order (a group before its children), each field's rules in declaration order and then its
 * messages keys and its multiple.keys reference (INVALID_FORM_INPUT when it names no repeated group,
 * docs/spec/validation-rules.md, Keyed maps); a name that is not a registered rule is UNKNOWN_RULE. A resolved parameter given by a
 * condition is checked when validation resolves it. Returns the first load failure, an internal
 * error on allocation failure, or NULL.
 */
ps_value *ps_check_rule_parameters(const ps_value *properties, ps_pattern_cache *patterns);
/* A repeated field: multiple is true, only or an object (rule_parameters.c). */
bool ps_repeated_field(const ps_value *field);

ps_result ps_ok(ps_value *value);
/* Errors with fixed text. */
ps_result ps_fail(const char *kind, const char *code, const char *message,
                  const char *at);
ps_value *ps_error(const char *kind, const char *code, const char *message,
                   const char *at, const ps_value *trace);
/* Errors whose message or location holds user data. */
ps_result ps_fail_text(const char *kind, const char *code, ps_text message, ps_text at);
ps_value *ps_error_text(const char *kind, const char *code, ps_text message,
                        ps_text at, const ps_value *trace);
/* Give an error its cause, the error that the exception of it has as its previous exception; both are consumed. */
ps_value *ps_error_with_cause(ps_value *error, ps_value *cause);

/*
 * Declaration checks (declaration.c). Each returns false with *error set to an INVALID_FORM_INPUT
 * error at "", or with *error NULL when allocation fails.
 * ps_declaration_error: "Invalid <key> at <path>: expected <expected>".
 * ps_known_keys: the first member of a closed bucket that is not allowed,
 * "Invalid <name>.<key> at <path>: unknown key".
 * ps_design_declaration_valid: the design declaration rules of a form field or button, a list or
 * detail specification, or a list column or detail field; only a form field (field) accepts
 * attributes and wrapper.attributes, and only a group field accepts layout, one of the first
 * layouts names of stacked, inline and line (3 for a group, 2 for a repeated group, 0 otherwise).
 */
bool ps_declaration_error(ps_text key, ps_text path, const char *expected, ps_value **error);
bool ps_known_keys(const ps_value *bucket, const char *name, const char *const *allowed,
                   size_t count, ps_text path, ps_value **error);
bool ps_design_declaration_valid(const ps_value *design, ps_text path, bool field, size_t layouts, bool condition,
                                 ps_value **error);
/* Declared attributes at key: an object of data-* or aria-* names crudui does not write to strings;
   every name is checked before any value. */
bool ps_declared_attributes_valid(const ps_value *attributes, const char *key, ps_text path, ps_value **error);
/* The pagination declaration rules of a list at path (list.c). */
bool ps_pagination_declaration_valid(const ps_value *pagination, ps_text path, ps_value **error);
/*
 * The declaration rules of a composed list or detail specification (display_declaration.c): the
 * root members, the own design at own, each member of the map members at <members>.<name> and,
 * for a list, search, sort, actions, empty and pagination. own is "list" or "detail" and members
 * is "columns" or "fields".
 */
bool ps_display_declarations_valid(const ps_value *spec, const char *own, const char *members, ps_value **error);
/*
 * The forbidden-key scan of a composed specification (forbidden_scan.c): the load failure
 * FORBIDDEN_META_KEY of the first forbidden key, with path as the prefix of its location, or NULL.
 */
ps_value *ps_scan_forbidden(const ps_value *node, ps_text *path, size_t length);
/* The dotted path, followed by the key when it has bytes (forbidden_scan.c). */
ps_chars ps_dotted_path(const ps_text *path, size_t length, ps_text key);

ps_value *ps_compose_properties(const ps_value *properties, const ps_value *files,
                                ps_text basepath, ps_value **error);
ps_value *ps_compose_spec(const ps_value *spec, const ps_value *files,
                          ps_text basepath, ps_value **error);

/* A member of an object; NULL for any other value. */
static inline const ps_value *member(const ps_value *value, const char *key)
{
    return value && value->kind == PS_OBJECT ? ps_get(value, key) : NULL;
}

/* The children of a node, NULL when it has no children list. */
static inline const ps_value *children_of(const ps_value *node)
{
    const ps_value *children = member(node, "children");
    return children && children->kind == PS_ARRAY ? children : NULL;
}

/* The text of a string value, empty for any other value. */
static inline ps_text text_of(const ps_value *value)
{
    return value && value->kind == PS_STRING ? ps_string(value) : PS_TEXT("");
}

/* The text of a member; empty for a missing or non-string member. */
static inline ps_text text_member(const ps_value *object, const char *key)
{
    return ps_string(member(object, key));
}

/* A boolean member that is true; false for a missing or non-boolean member. */
static inline bool bool_member(const ps_value *object, const char *key)
{
    const ps_value *value = member(object, key);
    return value && value->kind == PS_BOOL && value->data.boolean;
}

/* Field declaration predicates shared by the declaration checks (template.c, group_source.c). */
/* A multiple or lang declaration that enables the feature: true or an object (or only, for multiple). */
static inline bool enabled_declaration(const ps_value *value)
{
    return value && ((value->kind == PS_BOOL && value->data.boolean) || value->kind == PS_OBJECT);
}

static inline bool repeated_declaration(const ps_value *value)
{
    return enabled_declaration(value) || ps_is_string(value, "only");
}

/* A child that renders one scalar value: not repeated, not a group and not a language field. */
static inline bool scalar_child(const ps_value *child)
{
    return child && child->kind == PS_OBJECT && !ps_is_string(ps_get(child, "type"), "group") &&
        !ps_has(child, "properties") && !repeated_declaration(ps_get(child, "multiple")) &&
        !enabled_declaration(ps_get(child, "lang"));
}

/* Set a member to the string of a fixed identifier; NULL is empty. */
static inline bool set_string(ps_value *object, const char *key, const char *value)
{
    return ps_set(object, key, ps_string_value(value ? value : ""));
}

/* Set a member to a text; empty bytes are refused. */
static inline bool set_text(ps_value *object, const char *key, ps_text value)
{
    return value.bytes && ps_set(object, key, ps_text_value(value));
}

/* Set a member to an owned value and leave the caller no reference to it. */
static inline bool set_owned_value(ps_value *object, const char *key, ps_value **value)
{
    ps_value *owned = *value;
    *value = NULL;
    return ps_set(object, key, owned);
}

/* Append the significant digits of a number in scientific form: the first digit, then a point and the rest when any. */
static inline size_t ps_append_mantissa(char *text, size_t length, const char *digits, size_t count)
{
    text[length++] = digits[0];
    if (count > 1) {
        text[length++] = '.';
        memcpy(text + length, digits + 1, count - 1);
        length += count - 1;
    }
    return length;
}

#endif
