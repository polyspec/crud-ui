#ifndef CRUDUI_ENGINE_H
#define CRUDUI_ENGINE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct ps_value ps_value;
typedef struct ps_form ps_form;
typedef struct { ps_value *value; ps_value *error; } ps_result;
typedef struct { ps_form *form; ps_value *error; } ps_form_result;
typedef bool (*ps_visitor)(void *, const uint8_t *, size_t, const ps_value *);

enum {
    PS_NULL = 0,
    PS_BOOL = 1,
    PS_INT = 2,
    PS_FLOAT = 3,
    PS_STRING = 4,
    PS_ARRAY = 5,
    PS_OBJECT = 6
};

ps_value *ps_value_new(uint8_t kind);
void ps_value_free(ps_value *value);
void ps_value_bool(ps_value *value, bool input);
void ps_value_int(ps_value *value, int64_t input);
bool ps_value_float(ps_value *value, double input);
bool ps_value_string(ps_value *value, const uint8_t *input, size_t length);
/* Whether bytes are UTF-8 without encoded surrogates: a sequence of Unicode scalar values. */
bool ps_text_valid(const uint8_t *input, size_t length);
/* insert consumes child on both success and failure; all other inputs are borrowed. */
bool ps_value_insert(ps_value *parent, const uint8_t *key, size_t length, ps_value *child);
uint8_t ps_value_read(const ps_value *, int64_t *, double *, const uint8_t **, size_t *);
bool ps_value_visit(const ps_value *, void *, ps_visitor);

ps_result ps_compile_form(const ps_value *spec, const ps_value *options);
ps_result ps_bind_form(const ps_value *template, const ps_value *data, const ps_value *options);
/* Evaluated form buttons with the form binding input checks. */
ps_result ps_bind_form_buttons(const ps_value *template, const ps_value *data, const ps_value *options);
/* Button markup of evaluated buttons. */
ps_result ps_form_buttons_html(const ps_value *buttons);
ps_result ps_render_list(const ps_value *spec, const ps_value *rows, const ps_value *options);
/* List model: columns, evaluated rows, pagination, sort, actions, empty and design. */
ps_result ps_build_list(const ps_value *spec, const ps_value *rows, const ps_value *options);
/* Detail model: fields (key, label, format, value, display, design) and the evaluated design. */
ps_result ps_build_detail(const ps_value *spec, const ps_value *record, const ps_value *options);
/* Detail HTML: image preloads, then the definition list. */
ps_result ps_render_detail(const ps_value *spec, const ps_value *record, const ps_value *options);
/* Structure map rows of evaluated nodes: the form rows, each with its nested rows and its controls placed in the map. */
ps_result ps_build_outline(const ps_value *nodes);
/* Row view state (view.c): a view is {collapsed: list of row paths}; each function returns a new view or list. */
ps_result ps_initial_view(void);
ps_result ps_collapsible_rows(const ps_value *nodes);
ps_result ps_toggle_row_view(const ps_value *view, const ps_value *row_path);
ps_result ps_set_all_expanded_view(const ps_value *nodes, const ps_value *expanded);
ps_result ps_remove_row_view(const ps_value *view, const ps_value *row_path);
ps_result ps_rekey_row_view(const ps_value *view, const ps_value *old_path, const ps_value *new_path);
/* Undo history (history.c): a history is {entries, redoEntries} with an optional string lastPath. */
ps_result ps_empty_history(void);
ps_result ps_record_change(const ps_value *history, const ps_value *previous, const ps_value *path);
ps_result ps_can_undo(const ps_value *history);
ps_result ps_can_redo(const ps_value *history);
ps_result ps_undo_change(const ps_value *history, const ps_value *current);
ps_result ps_redo_change(const ps_value *history, const ps_value *current);
ps_result ps_validate(const ps_value *spec, const ps_value *data, const ps_value *options);
ps_result ps_validate_list(const ps_value *spec, const ps_value *options);
/* Detail structure: root and fields composition, then the forbidden-key scan. */
ps_result ps_validate_detail(const ps_value *spec, const ps_value *options);
ps_result ps_sequence_key(const ps_value *sequence);
ps_result ps_create_key(void);
ps_form_result ps_form_new(const ps_value *template, const ps_value *data, const ps_value *options);
void ps_form_free(ps_form *form);
ps_form *ps_form_clone(const ps_form *form);
ps_result ps_form_read(const ps_form *form, uint8_t member);
/* Render the complete form with render options; NULL options are empty options. */
ps_result ps_form_render_html(const ps_form *form, const ps_value *options);
ps_result ps_form_apply(ps_form *form, uint8_t method, const ps_value *args);
/* Form actions (actions.c): the target of an action button, and the run of an action on a form. */
ps_result ps_resolve_action(const ps_value *input);
ps_result ps_run_action(ps_form *form, const ps_value *target);

#endif
