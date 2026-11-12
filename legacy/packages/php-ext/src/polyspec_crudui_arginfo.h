/* This is a generated file, edit the .stub.php file instead.
 * Stub hash: eb99d15179f38022ea98f93c0f03e6f7f674dc1c */

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_compileForm, 0, 1, stdClass, 0)
	ZEND_ARG_OBJ_TYPE_MASK(0, spec, stdClass, MAY_BE_ARRAY, NULL)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_bindForm, 0, 1, IS_ARRAY, 0)
	ZEND_ARG_OBJ_INFO(0, template, stdClass, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, data, IS_MIXED, 0, "[]")
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Generator_bindButtons arginfo_class_Polyspec_Crudui_Generator_bindForm

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_formButtonsHtml, 0, 1, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, buttons, IS_MIXED, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_renderForm, 0, 1, IS_STRING, 0)
	ZEND_ARG_OBJ_INFO(0, form, Polyspec\\Crudui\\Form, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_MIXED, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_renderList, 0, 2, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, spec, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO(0, rows, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_buildList, 0, 1, stdClass, 0)
	ZEND_ARG_TYPE_INFO(0, spec, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, rows, IS_MIXED, 0, "[]")
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_buildOutline, 0, 1, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, nodes, IS_ARRAY, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_resolveAction, 0, 1, stdClass, 1)
	ZEND_ARG_OBJ_TYPE_MASK(0, input, stdClass, MAY_BE_ARRAY, NULL)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_runAction, 0, 2, stdClass, 1)
	ZEND_ARG_OBJ_INFO(0, form, Polyspec\\Crudui\\Form, 0)
	ZEND_ARG_OBJ_TYPE_MASK(0, target, stdClass, MAY_BE_ARRAY, NULL)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_initialView, 0, 0, IS_ARRAY, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Generator_collapsibleRows arginfo_class_Polyspec_Crudui_Generator_buildOutline

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_toggleRowView, 0, 2, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, view, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, rowPath, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_setAllExpandedView, 0, 2, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, nodes, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, expanded, _IS_BOOL, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Generator_removeRowView arginfo_class_Polyspec_Crudui_Generator_toggleRowView

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_rekeyRowView, 0, 3, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, view, IS_ARRAY, 0)
	ZEND_ARG_TYPE_INFO(0, oldPath, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, newPath, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_emptyHistory, 0, 0, stdClass, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_recordChange, 0, 2, stdClass, 0)
	ZEND_ARG_OBJ_INFO(0, history, stdClass, 0)
	ZEND_ARG_TYPE_INFO(0, previous, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, path, IS_STRING, 1, "null")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_canUndo, 0, 1, _IS_BOOL, 0)
	ZEND_ARG_OBJ_INFO(0, history, stdClass, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Generator_canRedo arginfo_class_Polyspec_Crudui_Generator_canUndo

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_undoChange, 0, 2, stdClass, 0)
	ZEND_ARG_OBJ_INFO(0, history, stdClass, 0)
	ZEND_ARG_TYPE_INFO(0, current, IS_MIXED, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Generator_redoChange arginfo_class_Polyspec_Crudui_Generator_undoChange

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_renderDetail, 0, 1, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, spec, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, record, IS_MIXED, 0, "new stdClass()")
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_buildDetail, 0, 1, stdClass, 0)
	ZEND_ARG_TYPE_INFO(0, spec, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, record, IS_MIXED, 0, "new stdClass()")
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_sequenceRowKey, 0, 1, IS_STRING, 0)
	ZEND_ARG_TYPE_MASK(0, sequence, MAY_BE_LONG|MAY_BE_STRING, NULL)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Generator_createRowKey, 0, 0, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_class_Polyspec_Crudui_Validator_validate, 0, 2, stdClass, 0)
	ZEND_ARG_OBJ_TYPE_MASK(0, spec, stdClass, MAY_BE_ARRAY, NULL)
	ZEND_ARG_OBJ_TYPE_MASK(0, data, stdClass, MAY_BE_ARRAY, NULL)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Validator_validateList arginfo_class_Polyspec_Crudui_Generator_compileForm

#define arginfo_class_Polyspec_Crudui_Validator_validateDetail arginfo_class_Polyspec_Crudui_Generator_compileForm

ZEND_BEGIN_ARG_INFO_EX(arginfo_class_Polyspec_Crudui_Form___construct, 0, 0, 1)
	ZEND_ARG_OBJ_INFO(0, template, stdClass, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, data, IS_MIXED, 0, "[]")
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Form_getTemplate arginfo_class_Polyspec_Crudui_Generator_emptyHistory

#define arginfo_class_Polyspec_Crudui_Form_getFields arginfo_class_Polyspec_Crudui_Generator_initialView

#define arginfo_class_Polyspec_Crudui_Form_getButtons arginfo_class_Polyspec_Crudui_Generator_initialView

#define arginfo_class_Polyspec_Crudui_Form_getMessages arginfo_class_Polyspec_Crudui_Generator_initialView

#define arginfo_class_Polyspec_Crudui_Form_getDescription arginfo_class_Polyspec_Crudui_Generator_createRowKey

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_getRevision, 0, 0, IS_LONG, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Form_getData arginfo_class_Polyspec_Crudui_Generator_emptyHistory

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_getValue, 0, 1, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_setData, 0, 1, IS_VOID, 0)
	ZEND_ARG_TYPE_INFO(0, data, IS_MIXED, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_setValue, 0, 2, IS_VOID, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, value, IS_MIXED, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_addRow, 0, 1, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_copyRow, 0, 2, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, key, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, options, IS_ARRAY, 0, "[]")
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_removeRow, 0, 2, IS_VOID, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, key, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_moveRow, 0, 3, IS_VOID, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, key, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, index, IS_LONG, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_rekeyRow, 0, 3, IS_VOID, 0)
	ZEND_ARG_TYPE_INFO(0, path, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, oldKey, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, newKey, IS_STRING, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Form_toggleRow arginfo_class_Polyspec_Crudui_Form_removeRow

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_setAllExpanded, 0, 1, IS_VOID, 0)
	ZEND_ARG_TYPE_INFO(0, expanded, _IS_BOOL, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_undo, 0, 0, IS_VOID, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Form_redo arginfo_class_Polyspec_Crudui_Form_undo

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Form_canUndo, 0, 0, _IS_BOOL, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Form_canRedo arginfo_class_Polyspec_Crudui_Form_canUndo

ZEND_BEGIN_ARG_INFO_EX(arginfo_class_Polyspec_Crudui_FormError___construct, 0, 0, 2)
	ZEND_ARG_TYPE_INFO(0, errorCode, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, message, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, path, IS_STRING, 0, "\'\'")
	ZEND_ARG_OBJ_INFO_WITH_DEFAULT_VALUE(0, previous, Throwable, 1, "null")
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_FormError_getErrorCode arginfo_class_Polyspec_Crudui_Generator_createRowKey

#define arginfo_class_Polyspec_Crudui_FormError_getPath arginfo_class_Polyspec_Crudui_Generator_createRowKey

ZEND_BEGIN_ARG_INFO_EX(arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError___construct, 0, 0, 2)
	ZEND_ARG_TYPE_INFO(0, code, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, message, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, trace, IS_ARRAY, 0, "[]")
	ZEND_ARG_OBJ_INFO_WITH_DEFAULT_VALUE(0, previous, Throwable, 1, "null")
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError_getErrorCode arginfo_class_Polyspec_Crudui_Generator_createRowKey

#define arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError_getCompositionTrace arginfo_class_Polyspec_Crudui_Generator_initialView

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError___get, 0, 1, IS_MIXED, 0)
	ZEND_ARG_TYPE_INFO(0, name, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError___isset, 0, 1, _IS_BOOL, 0)
	ZEND_ARG_TYPE_INFO(0, name, IS_STRING, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(arginfo_class_Polyspec_Crudui_Validator_Validate_FormInputError___construct, 0, 0, 1)
	ZEND_ARG_TYPE_INFO(0, message, IS_STRING, 0)
ZEND_END_ARG_INFO()

#define arginfo_class_Polyspec_Crudui_Validator_Validate_FormInputError_getErrorCode arginfo_class_Polyspec_Crudui_Generator_createRowKey

ZEND_METHOD(Polyspec_Crudui_Generator, compileForm);
ZEND_METHOD(Polyspec_Crudui_Generator, bindForm);
ZEND_METHOD(Polyspec_Crudui_Generator, bindButtons);
ZEND_METHOD(Polyspec_Crudui_Generator, formButtonsHtml);
ZEND_METHOD(Polyspec_Crudui_Generator, renderForm);
ZEND_METHOD(Polyspec_Crudui_Generator, renderList);
ZEND_METHOD(Polyspec_Crudui_Generator, buildList);
ZEND_METHOD(Polyspec_Crudui_Generator, buildOutline);
ZEND_METHOD(Polyspec_Crudui_Generator, resolveAction);
ZEND_METHOD(Polyspec_Crudui_Generator, runAction);
ZEND_METHOD(Polyspec_Crudui_Generator, initialView);
ZEND_METHOD(Polyspec_Crudui_Generator, collapsibleRows);
ZEND_METHOD(Polyspec_Crudui_Generator, toggleRowView);
ZEND_METHOD(Polyspec_Crudui_Generator, setAllExpandedView);
ZEND_METHOD(Polyspec_Crudui_Generator, removeRowView);
ZEND_METHOD(Polyspec_Crudui_Generator, rekeyRowView);
ZEND_METHOD(Polyspec_Crudui_Generator, emptyHistory);
ZEND_METHOD(Polyspec_Crudui_Generator, recordChange);
ZEND_METHOD(Polyspec_Crudui_Generator, canUndo);
ZEND_METHOD(Polyspec_Crudui_Generator, canRedo);
ZEND_METHOD(Polyspec_Crudui_Generator, undoChange);
ZEND_METHOD(Polyspec_Crudui_Generator, redoChange);
ZEND_METHOD(Polyspec_Crudui_Generator, renderDetail);
ZEND_METHOD(Polyspec_Crudui_Generator, buildDetail);
ZEND_METHOD(Polyspec_Crudui_Generator, sequenceRowKey);
ZEND_METHOD(Polyspec_Crudui_Generator, createRowKey);
ZEND_METHOD(Polyspec_Crudui_Validator, validate);
ZEND_METHOD(Polyspec_Crudui_Validator, validateList);
ZEND_METHOD(Polyspec_Crudui_Validator, validateDetail);
ZEND_METHOD(Polyspec_Crudui_Form, __construct);
ZEND_METHOD(Polyspec_Crudui_Form, getTemplate);
ZEND_METHOD(Polyspec_Crudui_Form, getFields);
ZEND_METHOD(Polyspec_Crudui_Form, getButtons);
ZEND_METHOD(Polyspec_Crudui_Form, getMessages);
ZEND_METHOD(Polyspec_Crudui_Form, getDescription);
ZEND_METHOD(Polyspec_Crudui_Form, getRevision);
ZEND_METHOD(Polyspec_Crudui_Form, getData);
ZEND_METHOD(Polyspec_Crudui_Form, getValue);
ZEND_METHOD(Polyspec_Crudui_Form, setData);
ZEND_METHOD(Polyspec_Crudui_Form, setValue);
ZEND_METHOD(Polyspec_Crudui_Form, addRow);
ZEND_METHOD(Polyspec_Crudui_Form, copyRow);
ZEND_METHOD(Polyspec_Crudui_Form, removeRow);
ZEND_METHOD(Polyspec_Crudui_Form, moveRow);
ZEND_METHOD(Polyspec_Crudui_Form, rekeyRow);
ZEND_METHOD(Polyspec_Crudui_Form, toggleRow);
ZEND_METHOD(Polyspec_Crudui_Form, setAllExpanded);
ZEND_METHOD(Polyspec_Crudui_Form, undo);
ZEND_METHOD(Polyspec_Crudui_Form, redo);
ZEND_METHOD(Polyspec_Crudui_Form, canUndo);
ZEND_METHOD(Polyspec_Crudui_Form, canRedo);
ZEND_METHOD(Polyspec_Crudui_FormError, __construct);
ZEND_METHOD(Polyspec_Crudui_FormError, getErrorCode);
ZEND_METHOD(Polyspec_Crudui_FormError, getPath);
ZEND_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __construct);
ZEND_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, getErrorCode);
ZEND_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, getCompositionTrace);
ZEND_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __get);
ZEND_METHOD(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __isset);
ZEND_METHOD(Polyspec_Crudui_Validator_Validate_FormInputError, __construct);
ZEND_METHOD(Polyspec_Crudui_Validator_Validate_FormInputError, getErrorCode);

static const zend_function_entry class_Polyspec_Crudui_Generator_methods[] = {
	ZEND_ME(Polyspec_Crudui_Generator, compileForm, arginfo_class_Polyspec_Crudui_Generator_compileForm, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, bindForm, arginfo_class_Polyspec_Crudui_Generator_bindForm, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, bindButtons, arginfo_class_Polyspec_Crudui_Generator_bindButtons, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, formButtonsHtml, arginfo_class_Polyspec_Crudui_Generator_formButtonsHtml, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, renderForm, arginfo_class_Polyspec_Crudui_Generator_renderForm, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, renderList, arginfo_class_Polyspec_Crudui_Generator_renderList, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, buildList, arginfo_class_Polyspec_Crudui_Generator_buildList, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, buildOutline, arginfo_class_Polyspec_Crudui_Generator_buildOutline, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, resolveAction, arginfo_class_Polyspec_Crudui_Generator_resolveAction, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, runAction, arginfo_class_Polyspec_Crudui_Generator_runAction, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, initialView, arginfo_class_Polyspec_Crudui_Generator_initialView, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, collapsibleRows, arginfo_class_Polyspec_Crudui_Generator_collapsibleRows, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, toggleRowView, arginfo_class_Polyspec_Crudui_Generator_toggleRowView, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, setAllExpandedView, arginfo_class_Polyspec_Crudui_Generator_setAllExpandedView, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, removeRowView, arginfo_class_Polyspec_Crudui_Generator_removeRowView, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, rekeyRowView, arginfo_class_Polyspec_Crudui_Generator_rekeyRowView, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, emptyHistory, arginfo_class_Polyspec_Crudui_Generator_emptyHistory, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, recordChange, arginfo_class_Polyspec_Crudui_Generator_recordChange, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, canUndo, arginfo_class_Polyspec_Crudui_Generator_canUndo, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, canRedo, arginfo_class_Polyspec_Crudui_Generator_canRedo, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, undoChange, arginfo_class_Polyspec_Crudui_Generator_undoChange, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, redoChange, arginfo_class_Polyspec_Crudui_Generator_redoChange, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, renderDetail, arginfo_class_Polyspec_Crudui_Generator_renderDetail, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, buildDetail, arginfo_class_Polyspec_Crudui_Generator_buildDetail, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, sequenceRowKey, arginfo_class_Polyspec_Crudui_Generator_sequenceRowKey, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Generator, createRowKey, arginfo_class_Polyspec_Crudui_Generator_createRowKey, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_FE_END
};

static const zend_function_entry class_Polyspec_Crudui_Validator_methods[] = {
	ZEND_ME(Polyspec_Crudui_Validator, validate, arginfo_class_Polyspec_Crudui_Validator_validate, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Validator, validateList, arginfo_class_Polyspec_Crudui_Validator_validateList, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_ME(Polyspec_Crudui_Validator, validateDetail, arginfo_class_Polyspec_Crudui_Validator_validateDetail, ZEND_ACC_PUBLIC|ZEND_ACC_STATIC)
	ZEND_FE_END
};

static const zend_function_entry class_Polyspec_Crudui_Form_methods[] = {
	ZEND_ME(Polyspec_Crudui_Form, __construct, arginfo_class_Polyspec_Crudui_Form___construct, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getTemplate, arginfo_class_Polyspec_Crudui_Form_getTemplate, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getFields, arginfo_class_Polyspec_Crudui_Form_getFields, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getButtons, arginfo_class_Polyspec_Crudui_Form_getButtons, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getMessages, arginfo_class_Polyspec_Crudui_Form_getMessages, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getDescription, arginfo_class_Polyspec_Crudui_Form_getDescription, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getRevision, arginfo_class_Polyspec_Crudui_Form_getRevision, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getData, arginfo_class_Polyspec_Crudui_Form_getData, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, getValue, arginfo_class_Polyspec_Crudui_Form_getValue, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, setData, arginfo_class_Polyspec_Crudui_Form_setData, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, setValue, arginfo_class_Polyspec_Crudui_Form_setValue, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, addRow, arginfo_class_Polyspec_Crudui_Form_addRow, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, copyRow, arginfo_class_Polyspec_Crudui_Form_copyRow, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, removeRow, arginfo_class_Polyspec_Crudui_Form_removeRow, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, moveRow, arginfo_class_Polyspec_Crudui_Form_moveRow, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, rekeyRow, arginfo_class_Polyspec_Crudui_Form_rekeyRow, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, toggleRow, arginfo_class_Polyspec_Crudui_Form_toggleRow, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, setAllExpanded, arginfo_class_Polyspec_Crudui_Form_setAllExpanded, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, undo, arginfo_class_Polyspec_Crudui_Form_undo, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, redo, arginfo_class_Polyspec_Crudui_Form_redo, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, canUndo, arginfo_class_Polyspec_Crudui_Form_canUndo, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Form, canRedo, arginfo_class_Polyspec_Crudui_Form_canRedo, ZEND_ACC_PUBLIC)
	ZEND_FE_END
};

static const zend_function_entry class_Polyspec_Crudui_FormError_methods[] = {
	ZEND_ME(Polyspec_Crudui_FormError, __construct, arginfo_class_Polyspec_Crudui_FormError___construct, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_FormError, getErrorCode, arginfo_class_Polyspec_Crudui_FormError_getErrorCode, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_FormError, getPath, arginfo_class_Polyspec_Crudui_FormError_getPath, ZEND_ACC_PUBLIC)
	ZEND_FE_END
};

static const zend_function_entry class_Polyspec_Crudui_Validator_Compose_ComposeLoadError_methods[] = {
	ZEND_ME(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __construct, arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError___construct, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Validator_Compose_ComposeLoadError, getErrorCode, arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError_getErrorCode, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Validator_Compose_ComposeLoadError, getCompositionTrace, arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError_getCompositionTrace, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __get, arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError___get, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Validator_Compose_ComposeLoadError, __isset, arginfo_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError___isset, ZEND_ACC_PUBLIC)
	ZEND_FE_END
};

static const zend_function_entry class_Polyspec_Crudui_Validator_Validate_FormInputError_methods[] = {
	ZEND_ME(Polyspec_Crudui_Validator_Validate_FormInputError, __construct, arginfo_class_Polyspec_Crudui_Validator_Validate_FormInputError___construct, ZEND_ACC_PUBLIC)
	ZEND_ME(Polyspec_Crudui_Validator_Validate_FormInputError, getErrorCode, arginfo_class_Polyspec_Crudui_Validator_Validate_FormInputError_getErrorCode, ZEND_ACC_PUBLIC)
	ZEND_FE_END
};

static zend_class_entry *register_class_Polyspec_Crudui_Generator(void)
{
	zend_class_entry ce, *class_entry;

	INIT_NS_CLASS_ENTRY(ce, "Polyspec\\Crudui", "Generator", class_Polyspec_Crudui_Generator_methods);
	class_entry = zend_register_internal_class_with_flags(&ce, NULL, ZEND_ACC_FINAL);

	return class_entry;
}

static zend_class_entry *register_class_Polyspec_Crudui_Validator(void)
{
	zend_class_entry ce, *class_entry;

	INIT_NS_CLASS_ENTRY(ce, "Polyspec\\Crudui", "Validator", class_Polyspec_Crudui_Validator_methods);
	class_entry = zend_register_internal_class_with_flags(&ce, NULL, ZEND_ACC_FINAL);

	return class_entry;
}

static zend_class_entry *register_class_Polyspec_Crudui_Form(void)
{
	zend_class_entry ce, *class_entry;

	INIT_NS_CLASS_ENTRY(ce, "Polyspec\\Crudui", "Form", class_Polyspec_Crudui_Form_methods);
	class_entry = zend_register_internal_class_with_flags(&ce, NULL, ZEND_ACC_FINAL);

	return class_entry;
}

static zend_class_entry *register_class_Polyspec_Crudui_FormError(zend_class_entry *class_entry_RuntimeException)
{
	zend_class_entry ce, *class_entry;

	INIT_NS_CLASS_ENTRY(ce, "Polyspec\\Crudui", "FormError", class_Polyspec_Crudui_FormError_methods);
	class_entry = zend_register_internal_class_with_flags(&ce, class_entry_RuntimeException, ZEND_ACC_FINAL);

	zval property_errorCode_default_value;
	ZVAL_UNDEF(&property_errorCode_default_value);
	zend_string *property_errorCode_name = zend_string_init("errorCode", sizeof("errorCode") - 1, 1);
	zend_declare_typed_property(class_entry, property_errorCode_name, &property_errorCode_default_value, ZEND_ACC_PRIVATE|ZEND_ACC_READONLY, NULL, (zend_type) ZEND_TYPE_INIT_MASK(MAY_BE_STRING));
	zend_string_release(property_errorCode_name);

	zval property_path_default_value;
	ZVAL_UNDEF(&property_path_default_value);
	zend_string *property_path_name = zend_string_init("path", sizeof("path") - 1, 1);
	zend_declare_typed_property(class_entry, property_path_name, &property_path_default_value, ZEND_ACC_PRIVATE|ZEND_ACC_READONLY, NULL, (zend_type) ZEND_TYPE_INIT_MASK(MAY_BE_STRING));
	zend_string_release(property_path_name);

	return class_entry;
}

static zend_class_entry *register_class_Polyspec_Crudui_Validator_Compose_ComposeLoadError(zend_class_entry *class_entry_RuntimeException)
{
	zend_class_entry ce, *class_entry;

	INIT_NS_CLASS_ENTRY(ce, "Polyspec\\Crudui\\Validator\\Compose", "ComposeLoadError", class_Polyspec_Crudui_Validator_Compose_ComposeLoadError_methods);
	class_entry = zend_register_internal_class_with_flags(&ce, class_entry_RuntimeException, ZEND_ACC_FINAL);

	zval property_errorCode_default_value;
	ZVAL_UNDEF(&property_errorCode_default_value);
	zend_string *property_errorCode_name = zend_string_init("errorCode", sizeof("errorCode") - 1, 1);
	zend_declare_typed_property(class_entry, property_errorCode_name, &property_errorCode_default_value, ZEND_ACC_PRIVATE|ZEND_ACC_READONLY, NULL, (zend_type) ZEND_TYPE_INIT_MASK(MAY_BE_STRING));
	zend_string_release(property_errorCode_name);

	zval property_compositionTrace_default_value;
	ZVAL_UNDEF(&property_compositionTrace_default_value);
	zend_string *property_compositionTrace_name = zend_string_init("compositionTrace", sizeof("compositionTrace") - 1, 1);
	zend_declare_typed_property(class_entry, property_compositionTrace_name, &property_compositionTrace_default_value, ZEND_ACC_PRIVATE|ZEND_ACC_READONLY, NULL, (zend_type) ZEND_TYPE_INIT_MASK(MAY_BE_ARRAY));
	zend_string_release(property_compositionTrace_name);

	return class_entry;
}

static zend_class_entry *register_class_Polyspec_Crudui_Validator_Validate_FormInputError(zend_class_entry *class_entry_RuntimeException)
{
	zend_class_entry ce, *class_entry;

	INIT_NS_CLASS_ENTRY(ce, "Polyspec\\Crudui\\Validator\\Validate", "FormInputError", class_Polyspec_Crudui_Validator_Validate_FormInputError_methods);
	class_entry = zend_register_internal_class_with_flags(&ce, class_entry_RuntimeException, ZEND_ACC_FINAL);

	zval property_errorCode_default_value;
	ZVAL_UNDEF(&property_errorCode_default_value);
	zend_string *property_errorCode_name = zend_string_init("errorCode", sizeof("errorCode") - 1, 1);
	zend_declare_typed_property(class_entry, property_errorCode_name, &property_errorCode_default_value, ZEND_ACC_PRIVATE|ZEND_ACC_READONLY, NULL, (zend_type) ZEND_TYPE_INIT_MASK(MAY_BE_STRING));
	zend_string_release(property_errorCode_name);

	return class_entry;
}
