#ifndef PHP_CRUDUI_H
#define PHP_CRUDUI_H

#include "php.h"
#include "Zend/zend_exceptions.h"
#include "ext/spl/spl_exceptions.h"
#include "crudui_engine.h"

extern zend_class_entry *crudui_generator_ce;
extern zend_class_entry *crudui_validator_ce;
extern zend_class_entry *crudui_form_ce;
extern zend_class_entry *crudui_form_error_ce;
extern zend_class_entry *crudui_compose_error_ce;
extern zend_class_entry *crudui_input_error_ce;

ps_value *crudui_from_php(zval *input, bool object_root, bool form_errors);
void crudui_invalid_value(const char *message, bool form_error);
void crudui_input_failure(const char *message);
bool crudui_to_php(const ps_value *input, zval *output);
void crudui_return(ps_result result, zval *return_value);
void crudui_throw(ps_value *error);

/* Value limits (docs/spec/input-text.md): levels of arrays and objects, the value itself included,
   and nodes, which are every array, object, string, number, boolean and null of a value. */
#define CRUDUI_NESTING_LIMIT 512
#define CRUDUI_NODE_LIMIT 1000000

/* Input text checks and value limits (docs/spec/input-text.md); each returns false after throwing
   the failure. form_errors selects the generator failure class over the validator one. */
typedef struct { const char *name; zval *value; } crudui_text_input;
bool crudui_check_specification_text(zval *spec, zval *options, bool form_errors);
bool crudui_check_input_text(const crudui_text_input *inputs, size_t count, zval *options,
                             const char *const *names, size_t name_count, bool form_errors);
void crudui_text_load_failure(zval *trace);
void crudui_text_input_failure(zend_string *message, bool form_error);

#endif
