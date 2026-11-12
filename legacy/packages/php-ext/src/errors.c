#include "php_crudui.h"

/* Throw a new exception of the class whose message is a PHP string, which may hold NUL characters.
   The message property is declared by the base class. */
static zend_object *throw_message(zend_class_entry *ce, zend_class_entry *base, zend_string *message)
{
    zval exception;
    object_init_ex(&exception, ce);
    zend_update_property_str(base, Z_OBJ(exception), ZEND_STRL("message"), message);
    zend_object *object = Z_OBJ(exception);
    zend_throw_exception_object(&exception);
    return object;
}

static void initialize_error(zend_class_entry *ce, zend_object *object, zend_string *code, zend_string *message, zval *detail)
{
    zend_update_property_str(ce, object, ZEND_STRL("message"), message);
    zend_update_property_str(ce, object, ZEND_STRL("errorCode"), code);
    if (ce == crudui_form_error_ce) zend_update_property(ce, object, ZEND_STRL("path"), detail);
    else if (ce == crudui_compose_error_ce) zend_update_property(ce, object, ZEND_STRL("compositionTrace"), detail);
}

void crudui_input_failure(const char *message)
{
    zend_object *error = zend_throw_exception(crudui_input_error_ce, message, 0);
    zend_string *code = zend_string_init("INVALID_FORM_INPUT", sizeof("INVALID_FORM_INPUT") - 1, false);
    zend_string *text = zend_string_init(message, strlen(message), false);
    initialize_error(crudui_input_error_ce, error, code, text, NULL);
    zend_string_release(code);
    zend_string_release(text);
}

PHP_METHOD(Polyspec_Crudui_Validator_Validate_FormInputError, __construct)
{
    (void)return_value;
    zend_string *message;
    ZEND_PARSE_PARAMETERS_START(1, 1)
        Z_PARAM_STR(message)
    ZEND_PARSE_PARAMETERS_END();
    zend_string *code = zend_string_init("INVALID_FORM_INPUT", sizeof("INVALID_FORM_INPUT") - 1, false);
    initialize_error(crudui_input_error_ce, Z_OBJ_P(ZEND_THIS), code, message, NULL);
    zend_string_release(code);
}

void crudui_text_load_failure(zval *trace)
{
    zend_string *message = zend_string_init(ZEND_STRL("Text must be Unicode scalar values"), false);
    zend_string *code = zend_string_init(ZEND_STRL("INVALID_TEXT"), false);
    zend_object *object = throw_message(crudui_compose_error_ce, zend_ce_exception, message);
    initialize_error(crudui_compose_error_ce, object, code, message, trace);
    zend_string_release(code);
    zend_string_release(message);
}

void crudui_text_input_failure(zend_string *message, bool form_error)
{
    zend_class_entry *ce = form_error ? crudui_form_error_ce : crudui_input_error_ce;
    zend_string *code = zend_string_init(ZEND_STRL("INVALID_FORM_INPUT"), false);
    zend_object *object = throw_message(ce, zend_ce_exception, message);
    zval path;
    ZVAL_EMPTY_STRING(&path);
    initialize_error(ce, object, code, message, &path);
    zend_string_release(code);
}

void crudui_invalid_value(const char *message, bool form_error)
{
    if (!form_error) { zend_throw_exception(spl_ce_InvalidArgumentException, message, 0); return; }
    zend_object *error = zend_throw_exception(crudui_form_error_ce, message, 0);
    zend_string *code = zend_string_init("INVALID_FORM_INPUT", sizeof("INVALID_FORM_INPUT") - 1, false);
    zend_string *text = zend_string_init(message, strlen(message), false);
    zval path; ZVAL_EMPTY_STRING(&path);
    initialize_error(crudui_form_error_ce, error, code, text, &path);
    zend_string_release(code);
    zend_string_release(text);
}

PHP_METHOD(Polyspec_Crudui_FormError, __construct)
{
    (void)return_value;
    zend_string *code, *message, *path = NULL;
    zval *previous = NULL;
    ZEND_PARSE_PARAMETERS_START(2, 4)
        Z_PARAM_STR(code)
        Z_PARAM_STR(message)
        Z_PARAM_OPTIONAL
        Z_PARAM_STR(path)
        Z_PARAM_OBJECT_OF_CLASS_OR_NULL(previous, zend_ce_throwable)
    ZEND_PARSE_PARAMETERS_END();
    zval detail;
    if (path) ZVAL_STR_COPY(&detail, path); else ZVAL_EMPTY_STRING(&detail);
    initialize_error(crudui_form_error_ce, Z_OBJ_P(ZEND_THIS), code, message, &detail);
    zval_ptr_dtor(&detail);
    if (previous) zend_update_property(zend_ce_exception, Z_OBJ_P(ZEND_THIS), ZEND_STRL("previous"), previous);
}

PHP_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __construct)
{
    (void)return_value;
    zend_string *code, *message;
    zval *trace = NULL, *previous = NULL, detail;
    ZEND_PARSE_PARAMETERS_START(2, 4)
        Z_PARAM_STR(code)
        Z_PARAM_STR(message)
        Z_PARAM_OPTIONAL
        Z_PARAM_ARRAY(trace)
        Z_PARAM_OBJECT_OF_CLASS_OR_NULL(previous, zend_ce_throwable)
    ZEND_PARSE_PARAMETERS_END();
    if (trace) ZVAL_COPY(&detail, trace); else array_init(&detail);
    initialize_error(crudui_compose_error_ce, Z_OBJ_P(ZEND_THIS), code, message, &detail);
    zval_ptr_dtor(&detail);
    if (previous) zend_update_property(zend_ce_exception, Z_OBJ_P(ZEND_THIS), ZEND_STRL("previous"), previous);
}

static void return_property(zend_class_entry *ce, zend_object *object, const char *name, size_t length, zval *return_value)
{
    zval temporary;
    zval *value = zend_read_property(ce, object, name, length, false, &temporary);
    if (!EG(exception)) ZVAL_COPY(return_value, value);
}

PHP_METHOD(Polyspec_Crudui_FormError, getErrorCode)
{
    ZEND_PARSE_PARAMETERS_NONE();
    return_property(crudui_form_error_ce, Z_OBJ_P(ZEND_THIS), ZEND_STRL("errorCode"), return_value);
}

PHP_METHOD(Polyspec_Crudui_FormError, getPath)
{
    ZEND_PARSE_PARAMETERS_NONE();
    return_property(crudui_form_error_ce, Z_OBJ_P(ZEND_THIS), ZEND_STRL("path"), return_value);
}

PHP_METHOD(Polyspec_Crudui_Validator_Validate_FormInputError, getErrorCode)
{
    ZEND_PARSE_PARAMETERS_NONE();
    return_property(crudui_input_error_ce, Z_OBJ_P(ZEND_THIS), ZEND_STRL("errorCode"), return_value);
}

PHP_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, getErrorCode)
{
    ZEND_PARSE_PARAMETERS_NONE();
    return_property(crudui_compose_error_ce, Z_OBJ_P(ZEND_THIS), ZEND_STRL("errorCode"), return_value);
}

PHP_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, getCompositionTrace)
{
    ZEND_PARSE_PARAMETERS_NONE();
    return_property(crudui_compose_error_ce, Z_OBJ_P(ZEND_THIS), ZEND_STRL("compositionTrace"), return_value);
}

PHP_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __get)
{
    zend_string *name;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_STR(name) ZEND_PARSE_PARAMETERS_END();
    if (zend_string_equals_literal(name, "code")) {
        return_property(crudui_compose_error_ce, Z_OBJ_P(ZEND_THIS), ZEND_STRL("errorCode"), return_value);
    } else {
        zend_string *message = zend_string_concat2(
            ZEND_STRL("Undefined property: Polyspec\\Crudui\\Validator\\Compose\\ComposeLoadError::$"),
            ZSTR_VAL(name), ZSTR_LEN(name));
        throw_message(spl_ce_OutOfRangeException, zend_ce_exception, message);
        zend_string_release(message);
    }
}

PHP_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __isset)
{
    zend_string *name;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_STR(name) ZEND_PARSE_PARAMETERS_END();
    RETURN_BOOL(zend_string_equals_literal(name, "code"));
}

/* Create an object of a class of the PHP library through its constructor, or return false when the class is not loaded. */
static bool construct(zval *object, const char *name, uint32_t count, zval *args)
{
    zend_string *class_name = zend_string_init(name, strlen(name), false);
    zend_class_entry *ce = zend_lookup_class(class_name);
    zend_string_release(class_name);
    if (!ce) return false;
    object_init_ex(object, ce);
    zend_call_known_instance_method(ce->constructor, Z_OBJ_P(object), NULL, count, args);
    return true;
}

/* Create the exception of an error value, with its cause as the previous exception, without throwing it. */
static void build_error(zval *exception, HashTable *members)
{
    zval *kind = zend_hash_str_find(members, ZEND_STRL("kind"));
    zval *code = zend_hash_str_find(members, ZEND_STRL("code"));
    zval *message = zend_hash_str_find(members, ZEND_STRL("message"));
    zval *cause = zend_hash_str_find(members, ZEND_STRL("cause"));
    bool composition = zend_string_equals_literal(Z_STR_P(kind), "compose");
    /* Every message is set as a PHP string, so a NUL character in it is kept. */
    if (zend_string_equals_literal(Z_STR_P(kind), "internal")) {
        object_init_ex(exception, zend_ce_error);
        zend_update_property_str(zend_ce_error, Z_OBJ_P(exception), ZEND_STRL("message"), Z_STR_P(message));
    } else if (zend_string_equals_literal(Z_STR_P(kind), "input")) {
        object_init_ex(exception, crudui_input_error_ce);
        zend_update_property_str(zend_ce_exception, Z_OBJ_P(exception), ZEND_STRL("message"), Z_STR_P(message));
        zend_string *input_code = zend_string_init("INVALID_FORM_INPUT", sizeof("INVALID_FORM_INPUT") - 1, false);
        initialize_error(crudui_input_error_ce, Z_OBJ_P(exception), input_code, Z_STR_P(message), NULL);
        zend_string_release(input_code);
    } else if (zend_string_equals_literal(Z_STR_P(kind), "parameter")) {
        zval args[2];
        ZVAL_COPY(&args[0], zend_hash_str_find(members, ZEND_STRL("code")));
        ZVAL_COPY(&args[1], message);
        bool built = construct(exception, "Polyspec\\Crudui\\Validator\\Values\\InvalidRuleParameter", 2, args);
        zval_ptr_dtor(&args[0]);
        zval_ptr_dtor(&args[1]);
        if (!built) object_init_ex(exception, zend_ce_exception);
    } else if (zend_string_equals_literal(Z_STR_P(kind), "syntax")) {
        zval args[2];
        ZVAL_COPY(&args[0], zend_hash_str_find(members, ZEND_STRL("reason")));
        ZVAL_COPY(&args[1], zend_hash_str_find(members, ZEND_STRL("offset")));
        bool built = construct(exception, "Polyspec\\Crudui\\Validator\\Patterns\\PatternSyntaxError", 2, args);
        zval_ptr_dtor(&args[0]);
        zval_ptr_dtor(&args[1]);
        if (!built) object_init_ex(exception, zend_ce_exception);
    } else {
        zend_class_entry *ce = composition ? crudui_compose_error_ce : crudui_form_error_ce;
        object_init_ex(exception, ce);
        zend_update_property_str(zend_ce_exception, Z_OBJ_P(exception), ZEND_STRL("message"), Z_STR_P(message));
        zval *detail = zend_hash_str_find(members, composition ? "trace" : "at", composition ? 5 : 2);
        initialize_error(ce, Z_OBJ_P(exception), Z_STR_P(code), Z_STR_P(message), detail);
    }
    /* The cause of an error is the previous exception of its exception (C17.69, C17.70). */
    if (cause && Z_TYPE_P(cause) == IS_OBJECT) {
        zval previous;
        build_error(&previous, Z_OBJPROP_P(cause));
        zend_update_property(zend_ce_exception, Z_OBJ_P(exception), ZEND_STRL("previous"), &previous);
        zval_ptr_dtor(&previous);
    }
}

void crudui_throw(ps_value *error)
{
    zval value;
    if (EG(exception)) { ps_value_free(error); return; }
    if (!crudui_to_php(error, &value)) { ps_value_free(error); return; }
    ps_value_free(error);
    zval exception;
    build_error(&exception, Z_OBJPROP(value));
    zend_throw_exception_object(&exception);
    zval_ptr_dtor(&value);
}
