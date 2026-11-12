#include "engine_internal.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const ps_form_messages *ps_form_messages_for(ps_text language)
{
    for (size_t i = 0; i < ps_interface_messages_count; ++i)
        if (ps_text_is(language, ps_interface_messages[i].language)) return &ps_interface_messages[i].messages;
    return NULL;
}

const ps_list_messages *ps_list_messages_for(ps_text language)
{
    for (size_t i = 0; i < ps_interface_list_messages_count; ++i)
        if (ps_text_is(language, ps_interface_list_messages[i].language)) return &ps_interface_list_messages[i].messages;
    return NULL;
}

ps_chars ps_format_count(const char *template, size_t count)
{
    ps_text text = ps_fixed(template);
    size_t marker = ps_text_find(text, PS_TEXT("{count}"), 0);
    if (marker == SIZE_MAX) return ps_copy(text);
    ps_chars number = ps_decimal(count);
    ps_chars out = number.bytes
        ? PS_CONCAT(ps_text_slice(text, 0, marker), ps_view(number),
                    ps_text_slice(text, marker + strlen("{count}"), text.length))
        : number;
    free(number.bytes);
    return out;
}

ps_chars ps_format_page(const char *template, size_t page)
{
    ps_text text = ps_fixed(template);
    size_t marker = ps_text_find(text, PS_TEXT("{page}"), 0);
    if (marker == SIZE_MAX) return ps_copy(text);
    ps_chars number = ps_decimal(page);
    ps_chars out = number.bytes
        ? PS_CONCAT(ps_text_slice(text, 0, marker), ps_view(number),
                    ps_text_slice(text, marker + strlen("{page}"), text.length))
        : number;
    free(number.bytes);
    return out;
}

ps_value *ps_form_messages_value(const ps_form_messages *messages)
{
    const struct { const char *key; const char *text; } entries[] = {
        {"moveUp", messages->move_up}, {"moveDown", messages->move_down},
        {"addRow", messages->add_row}, {"copyRow", messages->copy_row},
        {"removeRow", messages->remove_row}, {"toggleRow", messages->toggle_row},
        {"expandAll", messages->expand_all}, {"collapseAll", messages->collapse_all},
        {"undo", messages->undo}, {"redo", messages->redo},
        {"rowControls", messages->row_controls},
        {"collectionControls", messages->collection_controls},
        {"formControls", messages->form_controls}, {"formActions", messages->form_actions},
        {"submit", messages->submit}, {"reset", messages->reset},
        {"outline", messages->outline}, {"data", messages->data},
        {"untitled", messages->untitled}, {"collapsed", messages->collapsed},
        {"count", messages->count}, {"children", messages->children},
        {"conditionMode", messages->condition_mode},
        {"conditionAddComparison", messages->condition_add_comparison},
        {"conditionAddGroup", messages->condition_add_group},
        {"conditionAddJudge", messages->condition_add_judge},
        {"conditionRemove", messages->condition_remove},
        {"conditionInvalid", messages->condition_invalid},
    };
    ps_value *value = ps_object_value();
    for (size_t i = 0; value && i < sizeof(entries) / sizeof(entries[0]); ++i)
        if (!ps_set(value, entries[i].key, ps_string_value(entries[i].text))) {
            ps_value_free(value); return NULL;
        }
    return value;
}
