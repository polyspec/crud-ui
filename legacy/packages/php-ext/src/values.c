#include "php_crudui.h"
#include <math.h>
#include <string.h>

/*
 * Convert a PHP value. A shared array is converted at each place, so the conversion stops at the
 * value limits (docs/spec/input-text.md), which bound a value that denotes a large tree or
 * contains itself through a reference.
 */
static ps_value *convert(zval *input, bool object_root, unsigned depth, size_t *nodes, bool form_errors)
{
    ps_value *output = NULL;
    HashTable *members;
    bool object;
    zend_ulong index;
    zend_string *key;
    zval *child;

    if (input == NULL) return ps_value_new(object_root ? 6 : 0);
    ZVAL_DEREF(input);
    if (Z_TYPE_P(input) == IS_INDIRECT) input = Z_INDIRECT_P(input);
    bool container = Z_TYPE_P(input) == IS_ARRAY
        || (Z_TYPE_P(input) == IS_OBJECT && instanceof_function(Z_OBJCE_P(input), zend_standard_class_def));
    if (++*nodes > CRUDUI_NODE_LIMIT || (container && depth >= CRUDUI_NESTING_LIMIT)) {
        crudui_invalid_value("Recursive or excessively nested PHP value", form_errors);
        return NULL;
    }

    if (container) {
        members = Z_TYPE_P(input) == IS_ARRAY ? Z_ARRVAL_P(input) : Z_OBJPROP_P(input);
        object = Z_TYPE_P(input) == IS_OBJECT || !zend_array_is_list(members);
        if (object_root && !object && zend_hash_num_elements(members) != 0) {
            if (form_errors) crudui_invalid_value("Expected an object", true);
            else zend_type_error("Expected an object");
            return NULL;
        }
        object = object || object_root;
        output = ps_value_new(object ? 6 : 5);
        ZEND_HASH_FOREACH_KEY_VAL(members, index, key, child) {
            /* PHP foreach excludes inaccessible subclass properties. */
            if (key && ZSTR_LEN(key) && ZSTR_VAL(key)[0] == '\0') continue;
            if (Z_TYPE_P(child) == IS_UNDEF) continue;
            ps_value *value = convert(child, false, depth + 1, nodes, form_errors);
            if (!value) { ps_value_free(output); return NULL; }
            zend_string *numeric = NULL;
            if (object && !key) key = numeric = zend_long_to_str((zend_long) index);
            bool ok = ps_value_insert(output, object ? (const uint8_t *) ZSTR_VAL(key) : NULL,
                object ? ZSTR_LEN(key) : 0, value);
            if (numeric) zend_string_release(numeric);
            if (!ok) {
                ps_value_free(output);
                crudui_invalid_value("PHP object keys must contain valid UTF-8", form_errors);
                return NULL;
            }
        } ZEND_HASH_FOREACH_END();
        return output;
    }

    if (object_root) { zend_type_error("Expected an object"); return NULL; }
    output = ps_value_new(0);
    switch (Z_TYPE_P(input)) {
        case IS_NULL: return output;
        case IS_TRUE: case IS_FALSE: ps_value_bool(output, Z_TYPE_P(input) == IS_TRUE); return output;
        case IS_LONG: ps_value_int(output, Z_LVAL_P(input)); return output;
        case IS_DOUBLE:
            if (ps_value_float(output, Z_DVAL_P(input))) return output;
            break;
        case IS_STRING:
            if (ps_value_string(output, (const uint8_t *) Z_STRVAL_P(input), Z_STRLEN_P(input))) return output;
            ps_value_free(output);
            crudui_invalid_value("PHP strings must contain valid UTF-8", form_errors);
            return NULL;
        default: break;
    }
    ps_value_free(output);
    zend_string *message = strpprintf(0, "Unsupported PHP value: %s", zend_zval_type_name(input));
    crudui_invalid_value(ZSTR_VAL(message), form_errors);
    zend_string_release(message);
    return NULL;
}

ps_value *crudui_from_php(zval *input, bool object_root, bool form_errors)
{
    size_t nodes = 0;
    return convert(input, object_root, 0, &nodes, form_errors);
}

static bool append_child(void *context, const uint8_t *key, size_t length, const ps_value *child)
{
    zval value;
    zval *output = context;
    if (!crudui_to_php(child, &value)) return false;
    if (!key) {
        zend_hash_next_index_insert(Z_ARRVAL_P(output), &value);
    } else {
        zend_string *name = zend_string_init((const char *) key, length, false);
        zend_hash_update(Z_OBJPROP_P(output), name, &value);
        zend_string_release(name);
    }
    return true;
}

bool crudui_to_php(const ps_value *input, zval *output)
{
    int64_t integer = 0;
    double number = 0;
    const uint8_t *text = NULL;
    size_t length = 0;
    uint8_t kind = ps_value_read(input, &integer, &number, &text, &length);
    switch (kind) {
        case 0: ZVAL_NULL(output); return true;
        case 1: ZVAL_BOOL(output, integer); return true;
        case 2: ZVAL_LONG(output, integer); return true;
        case 3: ZVAL_DOUBLE(output, number); return true;
        case 4: ZVAL_STRINGL(output, (const char *) text, length); return true;
        case 5: array_init(output); break;
        case 6: object_init(output); break;
        default: zend_throw_error(NULL, "Invalid native value type"); return false;
    }
    if (ps_value_visit(input, output, append_child)) return true;
    zval_ptr_dtor(output);
    ZVAL_UNDEF(output);
    return false;
}

void crudui_return(ps_result result, zval *return_value)
{
    /* An error PHP raised during the operation, such as a failed string conversion, is the result. */
    if (EG(exception)) { ps_value_free(result.value); ps_value_free(result.error); return; }
    if (result.error) { crudui_throw(result.error); return; }
    if (!result.value) { zend_throw_error(NULL, "Native operation returned no result"); return; }
    crudui_to_php(result.value, return_value);
    ps_value_free(result.value);
}
