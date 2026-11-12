#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php_crudui.h"
#include <math.h>
#include "ext/standard/info.h"
#include "polyspec_crudui_arginfo.h"

zend_class_entry *crudui_generator_ce;
zend_class_entry *crudui_validator_ce;
zend_class_entry *crudui_form_ce;
zend_class_entry *crudui_form_error_ce;
zend_class_entry *crudui_compose_error_ce;
zend_class_entry *crudui_input_error_ce;
static zend_object_handlers form_handlers;

typedef struct {
    ps_form *form;
    zend_object object;
} form_object;

static form_object *form_from_object(zend_object *object)
{
    return (form_object *) ((char *) object - XtOffsetOf(form_object, object));
}

static ps_form *require_form(zend_object *object)
{
    ps_form *form = form_from_object(object)->form;
    if (!form) zend_throw_error(NULL, "Polyspec\\Crudui\\Form is not initialized");
    return form;
}

static zend_object *create_form_object(zend_class_entry *ce)
{
    form_object *form = zend_object_alloc(sizeof(form_object), ce);
    form->form = NULL;
    zend_object_std_init(&form->object, ce);
    object_properties_init(&form->object, ce);
    form->object.handlers = &form_handlers;
    return &form->object;
}

static void free_form_object(zend_object *object)
{
    form_object *form = form_from_object(object);
    ps_form_free(form->form);
    zend_object_std_dtor(object);
}

static zend_object *clone_form_object(zend_object *object)
{
    zend_object *clone = create_form_object(object->ce);
    ps_form *form = require_form(object);
    if (form) form_from_object(clone)->form = ps_form_clone(form);
    zend_objects_clone_members(clone, object);
    return clone;
}

static const char *const bind_options[] = {"collapsed", "idPrefix", "keyPrefix", "language", "unsupported"};
static const char *const display_options[] = {"basepath", "data", "language", "layout"};
static const char *const basepath_option[] = {"basepath"};
#define COUNT(items) (sizeof(items) / sizeof(*(items)))

/* Input text of a list or detail method: the specification, the files, the rows or record, the options. */
static bool display_text(zval *spec, const char *name, zval *value, zval *options)
{
    return crudui_check_specification_text(spec, options, true) &&
        crudui_check_input_text(&(crudui_text_input){name, value}, 1, options, display_options, COUNT(display_options), true);
}

/*
 * Form data is an object: a stdClass, an associative array or the empty array; a non-empty list array and any other value
 * are no object (CURP-026) and fail with the root message of CURT-001. An absent value is the default empty object.
 */
static bool form_data_object(zval *data)
{
    if (!data) return true;
    ZVAL_DEREF(data);
    bool object = Z_TYPE_P(data) == IS_OBJECT && instanceof_function(Z_OBJCE_P(data), zend_standard_class_def);
    if (Z_TYPE_P(data) == IS_ARRAY) {
        object = zend_hash_num_elements(Z_ARRVAL_P(data)) == 0 || !zend_array_is_list(Z_ARRVAL_P(data));
    }
    if (!object) crudui_invalid_value("Form data must be an object", true);
    return object;
}

/* Input text of a form binding: the template, the data, then the options; the data is then an object. */
static bool bind_text(zval *template, zval *data, zval *options)
{
    crudui_text_input inputs[] = {{"template", template}, {"data", data}};
    return crudui_check_input_text(inputs, 2, options, bind_options, COUNT(bind_options), true) && form_data_object(data);
}

static void call_two(zval *first, zval *options, bool form_errors, ps_result (*operation)(const ps_value *, const ps_value *), zval *return_value)
{
    ps_value *input = crudui_from_php(first, true, form_errors);
    if (!input) return;
    ps_value *opts = crudui_from_php(options, true, form_errors);
    if (opts) { crudui_return(operation(input, opts), return_value); ps_value_free(opts); }
    ps_value_free(input);
}

/*
 * The options data and files are fixed object options: an empty PHP array given for one is the empty object. The display
 * operations fix only files; their data is an object option, and an empty array is no object (docs/spec/display-formats.md).
 */
static const char *const fixed_keys[] = {"data", "files"};
static const char *const display_fixed_keys[] = {"files"};

static bool fixed_object_options(zval *options, ps_value *converted, const char *const *keys, size_t count)
{
    if (!options) return true;
    for (size_t i = 0; i < count; ++i) {
        zval *value = zend_hash_str_find_deref(Z_ARRVAL_P(options), keys[i], strlen(keys[i]));
        if (value && Z_TYPE_P(value) == IS_ARRAY && zend_hash_num_elements(Z_ARRVAL_P(value)) == 0 &&
            !ps_value_insert(converted, (const uint8_t *) keys[i], strlen(keys[i]), ps_value_new(PS_OBJECT))) {
            zend_throw_error(NULL, "Native options conversion failed");
            return false;
        }
    }
    return true;
}

/* Run an operation with its options when they are present, then release the three values it read. */
static void run_operation(ps_value *input, ps_value *data, ps_value *opts,
                          ps_result (*operation)(const ps_value *, const ps_value *, const ps_value *), zval *return_value)
{
    if (opts) { crudui_return(operation(input, data, opts), return_value); ps_value_free(opts); }
    ps_value_free(data);
    ps_value_free(input);
}

static void call_three(zval *first, zval *second, bool second_is_object, zval *options, bool form_errors, bool fixed_objects, ps_result (*operation)(const ps_value *, const ps_value *, const ps_value *), zval *return_value)
{
    ps_value *input = crudui_from_php(first, true, form_errors);
    if (!input) return;
    ps_value *data = crudui_from_php(second, second_is_object, form_errors);
    if (!data) { ps_value_free(input); return; }
    ps_value *opts = crudui_from_php(options, true, form_errors);
    if (opts && fixed_objects && !fixed_object_options(options, opts, fixed_keys, COUNT(fixed_keys))) { ps_value_free(opts); opts = NULL; }
    run_operation(input, data, opts, operation, return_value);
}

/*
 * A list or detail operation. The specification and the rows or record keep the PHP type they have, so the operation checks
 * their shape in argument order: a list array, the empty array included, is no object (docs/spec/display-formats.md).
 */
/*
 * The page and total options of a list are integers, and a non-finite float is no integer: the library reports the rule
 * of the option (CUDF-029, CUDF-030) for INF and NAN. The converter has no value for a non-finite float, so such an
 * option is given an empty string in a copy, which the count check refuses with the same message; the caller's array is
 * not changed, and every other value still fails in the converter.
 */
static zval *counts_for_conversion(zval *options, zval *copy)
{
    static const char *const keys[] = {"page", "total"};
    bool copied = false;
    if (!options || Z_TYPE_P(options) != IS_ARRAY) return options;
    for (size_t i = 0; i < sizeof(keys) / sizeof(*keys); ++i) {
        zval *value = zend_hash_str_find_deref(Z_ARRVAL_P(options), keys[i], strlen(keys[i]));
        if (!value || Z_TYPE_P(value) != IS_DOUBLE || isfinite(Z_DVAL_P(value))) continue;
        if (!copied) { ZVAL_ARR(copy, zend_array_dup(Z_ARRVAL_P(options))); copied = true; }
        zval empty;
        ZVAL_EMPTY_STRING(&empty);
        zend_hash_str_update(Z_ARRVAL_P(copy), keys[i], strlen(keys[i]), &empty);
    }
    return copied ? copy : options;
}

static void call_display(zval *spec, zval *value, zval *options, ps_result (*operation)(const ps_value *, const ps_value *, const ps_value *), zval *return_value)
{
    ps_value *input = crudui_from_php(spec, false, true);
    if (!input) return;
    ps_value *data = crudui_from_php(value, false, true);
    if (!data) { ps_value_free(input); return; }
    zval copy;
    zval *converted = counts_for_conversion(options, &copy);
    ps_value *opts = crudui_from_php(converted, true, true);
    if (converted == &copy) zval_ptr_dtor(&copy);
    if (opts && !fixed_object_options(options, opts, display_fixed_keys, COUNT(display_fixed_keys))) { ps_value_free(opts); opts = NULL; }
    run_operation(input, data, opts, operation, return_value);
}

/*
 * The argument parsing of methods that share a signature: a template with optional data and options,
 * a specification with optional options, and a path with a key. The macros declare the parsed variables.
 */
#define CRUDUI_PARSE_TEMPLATE_DATA_OPTIONS() \
    zval *template, *data = NULL, *options = NULL; \
    ZEND_PARSE_PARAMETERS_START(1, 3) \
        Z_PARAM_OBJECT_OF_CLASS(template, zend_standard_class_def) \
        Z_PARAM_OPTIONAL \
        Z_PARAM_ZVAL(data) \
        Z_PARAM_ARRAY(options) \
    ZEND_PARSE_PARAMETERS_END()

#define CRUDUI_PARSE_SPEC_OPTIONS() \
    zval *spec, *options = NULL; \
    ZEND_PARSE_PARAMETERS_START(1, 2) \
        Z_PARAM_ARRAY_OR_OBJECT(spec) \
        Z_PARAM_OPTIONAL \
        Z_PARAM_ARRAY(options) \
    ZEND_PARSE_PARAMETERS_END()

#define CRUDUI_PARSE_PATH_KEY() \
    zend_string *path, *key; \
    zval p, k; \
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_STR(path) Z_PARAM_STR(key) ZEND_PARSE_PARAMETERS_END(); \
    ZVAL_STR(&p, path); ZVAL_STR(&k, key)

PHP_METHOD(Polyspec_Crudui_Generator, compileForm)
{
    CRUDUI_PARSE_SPEC_OPTIONS();
    static const char *const names[] = {"basepath", "keyPrefix"};
    if (!crudui_check_specification_text(spec, options, true) ||
        !crudui_check_input_text(NULL, 0, options, names, COUNT(names), true)) return;
    call_two(spec, options, true, ps_compile_form, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, bindForm)
{
    CRUDUI_PARSE_TEMPLATE_DATA_OPTIONS();
    if (!bind_text(template, data, options)) return;
    call_three(template, data, true, options, true, false, ps_bind_form, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, bindButtons)
{
    CRUDUI_PARSE_TEMPLATE_DATA_OPTIONS();
    if (!bind_text(template, data, options)) return;
    call_three(template, data, true, options, true, false, ps_bind_form_buttons, return_value);
}

static bool standard_object(zval *value)
{
    return Z_TYPE_P(value) == IS_OBJECT && instanceof_function(Z_OBJCE_P(value), zend_standard_class_def);
}

PHP_METHOD(Polyspec_Crudui_Generator, formButtonsHtml)
{
    zval *buttons;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(buttons) ZEND_PARSE_PARAMETERS_END();
    ZVAL_DEREF(buttons);
    if (Z_TYPE_P(buttons) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(buttons))) {
        crudui_invalid_value("Form buttons must be a list", true);
        return;
    }
    /* PHP arrays convert to objects, so a button and its attrs must already be stdClass objects. */
    zval *button;
    ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(buttons), button) {
        ZVAL_DEREF(button);
        zval *attrs = standard_object(button)
            ? zend_hash_str_find_deref(Z_OBJPROP_P(button), "attrs", sizeof("attrs") - 1) : NULL;
        if (!attrs || !standard_object(attrs)) {
            crudui_invalid_value("Form buttons must be evaluated button objects", true);
            return;
        }
    } ZEND_HASH_FOREACH_END();
    ps_value *input = crudui_from_php(buttons, false, true);
    if (input) { crudui_return(ps_form_buttons_html(input), return_value); ps_value_free(input); }
}

PHP_METHOD(Polyspec_Crudui_Generator, buildOutline)
{
    zval *nodes;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ARRAY(nodes) ZEND_PARSE_PARAMETERS_END();
    if (!zend_array_is_list(Z_ARRVAL_P(nodes))) {
        crudui_invalid_value("Outline nodes must be a list", true);
        return;
    }
    /* PHP arrays convert to objects, so each node must already be a stdClass object. */
    zval *node;
    ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(nodes), node) {
        ZVAL_DEREF(node);
        if (!standard_object(node)) {
            crudui_invalid_value("Outline nodes must be evaluated node objects", true);
            return;
        }
    } ZEND_HASH_FOREACH_END();
    ps_value *input = crudui_from_php(nodes, false, true);
    if (input) { crudui_return(ps_build_outline(input), return_value); ps_value_free(input); }
}

/* A view result as the array of the PHP library: a view is an array, not an object. */
static void return_view(ps_result result, zval *return_value)
{
    crudui_return(result, return_value);
    if (Z_TYPE_P(return_value) == IS_OBJECT) convert_to_array(return_value);
}

/* Engine nodes of a view function: a list whose items are evaluated node objects, which must stay objects. */
static ps_value *node_input(zval *nodes)
{
    if (!zend_array_is_list(Z_ARRVAL_P(nodes))) {
        crudui_invalid_value("View nodes must be a list", true);
        return NULL;
    }
    zval *node;
    ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(nodes), node) {
        ZVAL_DEREF(node);
        if (!standard_object(node)) {
            crudui_invalid_value("View nodes must be evaluated node objects", true);
            return NULL;
        }
    } ZEND_HASH_FOREACH_END();
    return crudui_from_php(nodes, false, true);
}

/* Converts a history or view as an object root and a second value, then runs the operation on both. */
static void call_root_and_value(zval *root, zval *value, bool view, ps_result (*operation)(const ps_value *, const ps_value *), zval *return_value)
{
    ps_value *input = crudui_from_php(root, true, true);
    ps_value *other = input ? crudui_from_php(value, false, true) : NULL;
    if (other) {
        if (view) return_view(operation(input, other), return_value);
        else crudui_return(operation(input, other), return_value);
    }
    ps_value_free(other);
    ps_value_free(input);
}

PHP_METHOD(Polyspec_Crudui_Generator, initialView)
{
    ZEND_PARSE_PARAMETERS_NONE();
    return_view(ps_initial_view(), return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, collapsibleRows)
{
    zval *nodes;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ARRAY(nodes) ZEND_PARSE_PARAMETERS_END();
    ps_value *input = node_input(nodes);
    if (input) { crudui_return(ps_collapsible_rows(input), return_value); ps_value_free(input); }
}

PHP_METHOD(Polyspec_Crudui_Generator, setAllExpandedView)
{
    zval *nodes;
    bool expanded;
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_ARRAY(nodes) Z_PARAM_BOOL(expanded) ZEND_PARSE_PARAMETERS_END();
    ps_value *input = node_input(nodes);
    zval flag;
    ZVAL_BOOL(&flag, expanded);
    ps_value *flag_value = input ? crudui_from_php(&flag, false, true) : NULL;
    if (flag_value) return_view(ps_set_all_expanded_view(input, flag_value), return_value);
    ps_value_free(flag_value);
    ps_value_free(input);
}

PHP_METHOD(Polyspec_Crudui_Generator, toggleRowView)
{
    zval *view;
    zend_string *row_path;
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_ARRAY(view) Z_PARAM_STR(row_path) ZEND_PARSE_PARAMETERS_END();
    zval row;
    ZVAL_STR(&row, row_path);
    call_root_and_value(view, &row, true, ps_toggle_row_view, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, removeRowView)
{
    zval *view;
    zend_string *row_path;
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_ARRAY(view) Z_PARAM_STR(row_path) ZEND_PARSE_PARAMETERS_END();
    zval row;
    ZVAL_STR(&row, row_path);
    call_root_and_value(view, &row, true, ps_remove_row_view, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, rekeyRowView)
{
    zval *view;
    zend_string *old_path, *new_path;
    ZEND_PARSE_PARAMETERS_START(3, 3) Z_PARAM_ARRAY(view) Z_PARAM_STR(old_path) Z_PARAM_STR(new_path) ZEND_PARSE_PARAMETERS_END();
    zval old_value, new_value;
    ZVAL_STR(&old_value, old_path);
    ZVAL_STR(&new_value, new_path);
    ps_value *input = crudui_from_php(view, true, true);
    ps_value *old_input = input ? crudui_from_php(&old_value, false, true) : NULL;
    ps_value *new_input = old_input ? crudui_from_php(&new_value, false, true) : NULL;
    if (new_input) return_view(ps_rekey_row_view(input, old_input, new_input), return_value);
    ps_value_free(new_input);
    ps_value_free(old_input);
    ps_value_free(input);
}

PHP_METHOD(Polyspec_Crudui_Generator, emptyHistory)
{
    ZEND_PARSE_PARAMETERS_NONE();
    crudui_return(ps_empty_history(), return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, recordChange)
{
    zval *history, *previous;
    zend_string *path = NULL;
    ZEND_PARSE_PARAMETERS_START(2, 3)
        Z_PARAM_OBJECT_OF_CLASS(history, zend_standard_class_def)
        Z_PARAM_ZVAL(previous)
        Z_PARAM_OPTIONAL
        Z_PARAM_STR_OR_NULL(path)
    ZEND_PARSE_PARAMETERS_END();
    zval path_value;
    if (path) ZVAL_STR(&path_value, path); else ZVAL_NULL(&path_value);
    ps_value *input = crudui_from_php(history, true, true);
    ps_value *value = input ? crudui_from_php(previous, false, true) : NULL;
    ps_value *path_input = value ? crudui_from_php(&path_value, false, true) : NULL;
    if (path_input) crudui_return(ps_record_change(input, value, path_input), return_value);
    ps_value_free(path_input);
    ps_value_free(value);
    ps_value_free(input);
}

/* Converts a history and runs a query on it, which returns the result of canUndo or canRedo. */
static void call_history(zval *history, ps_result (*operation)(const ps_value *), zval *return_value)
{
    ps_value *input = crudui_from_php(history, true, true);
    if (input) { crudui_return(operation(input), return_value); ps_value_free(input); }
}

PHP_METHOD(Polyspec_Crudui_Generator, canUndo)
{
    zval *history;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(history, zend_standard_class_def) ZEND_PARSE_PARAMETERS_END();
    call_history(history, ps_can_undo, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, canRedo)
{
    zval *history;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(history, zend_standard_class_def) ZEND_PARSE_PARAMETERS_END();
    call_history(history, ps_can_redo, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, undoChange)
{
    zval *history, *current;
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_OBJECT_OF_CLASS(history, zend_standard_class_def) Z_PARAM_ZVAL(current) ZEND_PARSE_PARAMETERS_END();
    call_root_and_value(history, current, false, ps_undo_change, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, redoChange)
{
    zval *history, *current;
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_OBJECT_OF_CLASS(history, zend_standard_class_def) Z_PARAM_ZVAL(current) ZEND_PARSE_PARAMETERS_END();
    call_root_and_value(history, current, false, ps_redo_change, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, resolveAction)
{
    zval *input;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ARRAY_OR_OBJECT(input) ZEND_PARSE_PARAMETERS_END();
    ps_value *value = crudui_from_php(input, true, true);
    if (value) { crudui_return(ps_resolve_action(value), return_value); ps_value_free(value); }
}

PHP_METHOD(Polyspec_Crudui_Generator, runAction)
{
    zval *form_value, *target;
    ZEND_PARSE_PARAMETERS_START(2, 2)
        Z_PARAM_OBJECT_OF_CLASS(form_value, crudui_form_ce)
        Z_PARAM_ARRAY_OR_OBJECT(target)
    ZEND_PARSE_PARAMETERS_END();
    ps_form *form = require_form(Z_OBJ_P(form_value));
    ps_value *value = form ? crudui_from_php(target, true, true) : NULL;
    if (value) { crudui_return(ps_run_action(form, value), return_value); ps_value_free(value); }
}

PHP_METHOD(Polyspec_Crudui_Generator, renderList)
{
    zval *spec, *rows, *options = NULL;
    ZEND_PARSE_PARAMETERS_START(2, 3)
        Z_PARAM_ZVAL(spec)
        Z_PARAM_ZVAL(rows)
        Z_PARAM_OPTIONAL
        Z_PARAM_ARRAY(options)
    ZEND_PARSE_PARAMETERS_END();
    if (!display_text(spec, "rows", rows, options)) return;
    call_display(spec, rows, options, ps_render_list, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, buildList)
{
    zval *spec, *rows = NULL, *options = NULL;
    ZEND_PARSE_PARAMETERS_START(1, 3)
        Z_PARAM_ZVAL(spec)
        Z_PARAM_OPTIONAL
        Z_PARAM_ZVAL(rows)
        Z_PARAM_ARRAY(options)
    ZEND_PARSE_PARAMETERS_END();
    if (!display_text(spec, "rows", rows, options)) return;
    if (!rows) {
        zval empty; array_init(&empty); rows = &empty;
        call_display(spec, rows, options, ps_build_list, return_value);
        zval_ptr_dtor(&empty);
        return;
    }
    call_display(spec, rows, options, ps_build_list, return_value);
}

/* An omitted record is the empty object; a record that is an array is checked by the operation, as every display argument. */
static void call_detail(INTERNAL_FUNCTION_PARAMETERS, ps_result (*operation)(const ps_value *, const ps_value *, const ps_value *))
{
    zval *spec, *record = NULL, *options = NULL;
    ZEND_PARSE_PARAMETERS_START(1, 3)
        Z_PARAM_ZVAL(spec)
        Z_PARAM_OPTIONAL
        Z_PARAM_ZVAL(record)
        Z_PARAM_ARRAY(options)
    ZEND_PARSE_PARAMETERS_END();
    if (!display_text(spec, "record", record, options)) return;
    zval empty;
    if (!record) { object_init(&empty); record = &empty; }
    call_display(spec, record, options, operation, return_value);
    if (record == &empty) zval_ptr_dtor(&empty);
}

PHP_METHOD(Polyspec_Crudui_Generator, renderDetail)
{
    call_detail(INTERNAL_FUNCTION_PARAM_PASSTHRU, ps_render_detail);
}

PHP_METHOD(Polyspec_Crudui_Generator, buildDetail)
{
    call_detail(INTERNAL_FUNCTION_PARAM_PASSTHRU, ps_build_detail);
}

PHP_METHOD(Polyspec_Crudui_Validator, validate)
{
    zval *spec, *data, *options = NULL;
    ZEND_PARSE_PARAMETERS_START(2, 3)
        Z_PARAM_ARRAY_OR_OBJECT(spec)
        Z_PARAM_ARRAY_OR_OBJECT(data)
        Z_PARAM_OPTIONAL
        Z_PARAM_ARRAY(options)
    ZEND_PARSE_PARAMETERS_END();
    /* Input text is checked first: the specification, the files, the data, then the options. */
    if (!crudui_check_specification_text(spec, options, false) ||
        !crudui_check_input_text(&(crudui_text_input){"data", data}, 1, options, basepath_option, 1, false)) return;
    /* Root data is a request precondition; an empty PHP array is an empty object. */
    if (Z_TYPE_P(data) == IS_ARRAY && zend_hash_num_elements(Z_ARRVAL_P(data)) != 0 &&
        zend_array_is_list(Z_ARRVAL_P(data))) {
        crudui_input_failure("Form data must be an object");
        return;
    }
    call_three(spec, data, true, options, false, false, ps_validate, return_value);
}

PHP_METHOD(Polyspec_Crudui_Validator, validateList)
{
    CRUDUI_PARSE_SPEC_OPTIONS();
    if (!crudui_check_specification_text(spec, options, false) ||
        !crudui_check_input_text(NULL, 0, options, basepath_option, 1, false)) return;
    call_two(spec, options, false, ps_validate_list, return_value);
}

PHP_METHOD(Polyspec_Crudui_Validator, validateDetail)
{
    CRUDUI_PARSE_SPEC_OPTIONS();
    if (!crudui_check_specification_text(spec, options, false) ||
        !crudui_check_input_text(NULL, 0, options, basepath_option, 1, false)) return;
    call_two(spec, options, false, ps_validate_detail, return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, sequenceRowKey)
{
    zend_string *string = NULL;
    zend_long integer;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_STR_OR_LONG(string, integer) ZEND_PARSE_PARAMETERS_END();
    zval sequence;
    if (string) ZVAL_STR_COPY(&sequence, string); else ZVAL_LONG(&sequence, integer);
    ps_value *input = crudui_from_php(&sequence, false, true);
    zval_ptr_dtor(&sequence);
    if (input) { crudui_return(ps_sequence_key(input), return_value); ps_value_free(input); }
}

PHP_METHOD(Polyspec_Crudui_Generator, createRowKey)
{
    ZEND_PARSE_PARAMETERS_NONE();
    crudui_return(ps_create_key(), return_value);
}

PHP_METHOD(Polyspec_Crudui_Generator, renderForm)
{
    zend_object *object;
    zval *options = NULL;
    ZEND_PARSE_PARAMETERS_START(1, 2)
        Z_PARAM_OBJ_OF_CLASS(object, crudui_form_ce)
        Z_PARAM_OPTIONAL
        Z_PARAM_ZVAL(options)
    ZEND_PARSE_PARAMETERS_END();
    ps_form *form = require_form(object);
    if (!form) return;
    /* Absent options are empty options; any other value is checked by the engine. */
    ps_value *render = options ? crudui_from_php(options, false, true) : NULL;
    if (options && !render) return;
    crudui_return(ps_form_render_html(form, render), return_value);
    ps_value_free(render);
}

PHP_METHOD(Polyspec_Crudui_Form, __construct)
{
    (void)return_value;
    CRUDUI_PARSE_TEMPLATE_DATA_OPTIONS();
    if (!bind_text(template, data, options)) return;
    ps_value *compiled = crudui_from_php(template, true, true);
    if (!compiled) return;
    ps_value *values = crudui_from_php(data, true, true);
    if (!values) { ps_value_free(compiled); return; }
    ps_value *opts = crudui_from_php(options, true, true);
    if (opts) {
        ps_form_result result = ps_form_new(compiled, values, opts);
        if (result.error) crudui_throw(result.error);
        else {
            form_object *object = form_from_object(Z_OBJ_P(ZEND_THIS));
            ps_form_free(object->form);
            object->form = result.form;
        }
        ps_value_free(opts);
    }
    ps_value_free(values);
    ps_value_free(compiled);
}

#define FORM_READER(name, member) \
PHP_METHOD(Polyspec_Crudui_Form, name) { \
    ZEND_PARSE_PARAMETERS_NONE(); \
    ps_form *form = require_form(Z_OBJ_P(ZEND_THIS)); \
    if (form) crudui_return(ps_form_read(form, member), return_value); \
}
FORM_READER(getTemplate, 0)
FORM_READER(getData, 1)
FORM_READER(getFields, 2)
FORM_READER(getRevision, 3)
FORM_READER(getButtons, 5)
FORM_READER(getDescription, 7)

PHP_METHOD(Polyspec_Crudui_Form, getMessages)
{
    ZEND_PARSE_PARAMETERS_NONE();
    ps_form *form = require_form(Z_OBJ_P(ZEND_THIS));
    if (!form) return;
    /* Interface text keyed by message name, as an array like the PHP implementation. */
    crudui_return(ps_form_read(form, 6), return_value);
    if (Z_TYPE_P(return_value) == IS_OBJECT) convert_to_array(return_value);
}

static const char *const form_arguments[][3] = {
    {"path"}, {"data"}, {"path", "value"}, {"path"}, {"path", "key"}, {"path", "key"}, {"path", "key"}, {"path", "oldKey", "newKey"},
    {"path", "key"}, {"expanded"}, {NULL}, {NULL}, {NULL}, {NULL},
};

/* Input text of a form method: its text arguments in order, then the row options. */
static bool form_text(uint8_t method, size_t count, zval **values)
{
    static const char *const add_options[] = {"afterKey", "key", "value"};
    crudui_text_input inputs[3];
    size_t used = 0;
    zval *options = NULL;
    for (size_t i = 0; i < count; ++i) {
        if (form_arguments[method][i]) inputs[used++] = (crudui_text_input){form_arguments[method][i], values[i]};
        else options = values[i];
    }
    /* addRow reads a row value; copyRow copies one. */
    return crudui_check_input_text(inputs, used, options, add_options, method == 3 ? 3 : method == 4 ? 2 : 0, true);
}

static void apply_form(zend_object *object, uint8_t method, size_t count, zval **values, const bool *objects, zval *return_value)
{
    ps_form *form = require_form(object);
    if (!form) return;
    if (!form_text(method, count, values)) return;
    ps_value *arguments = ps_value_new(5);
    for (size_t i = 0; i < count; ++i) {
        ps_value *value = crudui_from_php(values[i], objects[i], true);
        if (!value) { ps_value_free(arguments); return; }
        ps_value_insert(arguments, NULL, 0, value);
    }
    crudui_return(ps_form_apply(form, method, arguments), return_value);
    ps_value_free(arguments);
}

PHP_METHOD(Polyspec_Crudui_Form, getValue)
{
    zend_string *path;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_STR(path) ZEND_PARSE_PARAMETERS_END();
    zval value; ZVAL_STR(&value, path);
    apply_form(Z_OBJ_P(ZEND_THIS), 0, 1, (zval *[]){&value}, (bool[]){false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, setData)
{
    zval *data;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(data) ZEND_PARSE_PARAMETERS_END();
    if (!form_data_object(data)) return;
    apply_form(Z_OBJ_P(ZEND_THIS), 1, 1, (zval *[]){data}, (bool[]){true}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, setValue)
{
    zend_string *path;
    zval *data, value;
    ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_STR(path) Z_PARAM_ZVAL(data) ZEND_PARSE_PARAMETERS_END();
    ZVAL_STR(&value, path);
    apply_form(Z_OBJ_P(ZEND_THIS), 2, 2, (zval *[]){&value, data}, (bool[]){false, false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, addRow)
{
    zend_string *path;
    zval *options = NULL, value;
    ZEND_PARSE_PARAMETERS_START(1, 2) Z_PARAM_STR(path) Z_PARAM_OPTIONAL Z_PARAM_ARRAY(options) ZEND_PARSE_PARAMETERS_END();
    ZVAL_STR(&value, path);
    apply_form(Z_OBJ_P(ZEND_THIS), 3, 2, (zval *[]){&value, options}, (bool[]){false, true}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, copyRow)
{
    zend_string *path, *key;
    zval *options = NULL, p, k;
    ZEND_PARSE_PARAMETERS_START(2, 3) Z_PARAM_STR(path) Z_PARAM_STR(key) Z_PARAM_OPTIONAL Z_PARAM_ARRAY(options) ZEND_PARSE_PARAMETERS_END();
    ZVAL_STR(&p, path); ZVAL_STR(&k, key);
    apply_form(Z_OBJ_P(ZEND_THIS), 4, 3, (zval *[]){&p, &k, options}, (bool[]){false, false, true}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, removeRow)
{
    CRUDUI_PARSE_PATH_KEY();
    apply_form(Z_OBJ_P(ZEND_THIS), 5, 2, (zval *[]){&p, &k}, (bool[]){false, false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, moveRow)
{
    zend_string *path, *key;
    zend_long index;
    zval p, k, i;
    ZEND_PARSE_PARAMETERS_START(3, 3) Z_PARAM_STR(path) Z_PARAM_STR(key) Z_PARAM_LONG(index) ZEND_PARSE_PARAMETERS_END();
    ZVAL_STR(&p, path); ZVAL_STR(&k, key); ZVAL_LONG(&i, index);
    apply_form(Z_OBJ_P(ZEND_THIS), 6, 3, (zval *[]){&p, &k, &i}, (bool[]){false, false, false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, rekeyRow)
{
    zend_string *path, *old_key, *new_key;
    zval p, o, n;
    ZEND_PARSE_PARAMETERS_START(3, 3) Z_PARAM_STR(path) Z_PARAM_STR(old_key) Z_PARAM_STR(new_key) ZEND_PARSE_PARAMETERS_END();
    ZVAL_STR(&p, path); ZVAL_STR(&o, old_key); ZVAL_STR(&n, new_key);
    apply_form(Z_OBJ_P(ZEND_THIS), 7, 3, (zval *[]){&p, &o, &n}, (bool[]){false, false, false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, toggleRow)
{
    CRUDUI_PARSE_PATH_KEY();
    apply_form(Z_OBJ_P(ZEND_THIS), 8, 2, (zval *[]){&p, &k}, (bool[]){false, false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, setAllExpanded)
{
    bool expanded;
    zval value;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_BOOL(expanded) ZEND_PARSE_PARAMETERS_END();
    ZVAL_BOOL(&value, expanded);
    apply_form(Z_OBJ_P(ZEND_THIS), 9, 1, (zval *[]){&value}, (bool[]){false}, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, undo)
{
    ZEND_PARSE_PARAMETERS_NONE();
    apply_form(Z_OBJ_P(ZEND_THIS), 10, 0, NULL, NULL, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, redo)
{
    ZEND_PARSE_PARAMETERS_NONE();
    apply_form(Z_OBJ_P(ZEND_THIS), 11, 0, NULL, NULL, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, canUndo)
{
    ZEND_PARSE_PARAMETERS_NONE();
    apply_form(Z_OBJ_P(ZEND_THIS), 12, 0, NULL, NULL, return_value);
}

PHP_METHOD(Polyspec_Crudui_Form, canRedo)
{
    ZEND_PARSE_PARAMETERS_NONE();
    apply_form(Z_OBJ_P(ZEND_THIS), 13, 0, NULL, NULL, return_value);
}

PHP_MINIT_FUNCTION(polyspec_crudui)
{
    (void)type;
    (void)module_number;
    crudui_form_error_ce = register_class_Polyspec_Crudui_FormError(spl_ce_RuntimeException);
    crudui_compose_error_ce = register_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError(spl_ce_RuntimeException);
    crudui_input_error_ce = register_class_Polyspec_Crudui_Validator_Validate_FormInputError(spl_ce_RuntimeException);
    crudui_generator_ce = register_class_Polyspec_Crudui_Generator();
    crudui_validator_ce = register_class_Polyspec_Crudui_Validator();
    crudui_form_ce = register_class_Polyspec_Crudui_Form();
    crudui_form_ce->create_object = create_form_object;
    crudui_form_ce->ce_flags |= ZEND_ACC_NOT_SERIALIZABLE;
    memcpy(&form_handlers, zend_get_std_object_handlers(), sizeof(form_handlers));
    form_handlers.offset = XtOffsetOf(form_object, object);
    form_handlers.free_obj = free_form_object;
    form_handlers.clone_obj = clone_form_object;
    return SUCCESS;
}

PHP_MINFO_FUNCTION(polyspec_crudui)
{
    (void)zend_module;
    php_info_print_table_start();
    php_info_print_table_row(2, "CRUDUI", "enabled");
    php_info_print_table_row(2, "Version", PHP_POLYSPEC_CRUDUI_VERSION);
    php_info_print_table_row(2, "Generation and validation", "native");
    php_info_print_table_end();
}

static const zend_module_dep crudui_deps[] = {
    ZEND_MOD_REQUIRED("SPL")
    ZEND_MOD_END
};

zend_module_entry polyspec_crudui_module_entry = {
    STANDARD_MODULE_HEADER_EX, NULL, crudui_deps,
    "polyspec_crudui", NULL, PHP_MINIT(polyspec_crudui), NULL, NULL, NULL, PHP_MINFO(polyspec_crudui), PHP_POLYSPEC_CRUDUI_VERSION, STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_POLYSPEC_CRUDUI
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(polyspec_crudui)
#endif
