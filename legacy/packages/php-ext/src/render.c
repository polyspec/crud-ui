#include "engine_internal.h"

#include <stdlib.h>
#include <string.h>

typedef ps_html_buffer render_buffer;

#define text ps_html_text
#define append ps_html_append
#define character ps_html_character
#define take ps_html_take
#define attr_string ps_html_attr_string
#define attr_text ps_html_attr_text
#define attr_clone ps_html_attr_clone
#define appearance_attrs ps_html_appearance_attrs

static bool escaped(render_buffer *out, ps_text value, bool raw)
{
    return ps_html_escaped(out, value, raw);
}

static bool raw_text(render_buffer *out, ps_text value)
{
    return ps_html_raw_text(out, value);
}

/* Elements with a fixed tag. */
static bool start_element(render_buffer *out, const char *tag, const ps_value *attrs,
                          bool raw, bool style_last)
{
    return ps_html_start_element(out, ps_fixed(tag), attrs, raw, style_last);
}

static bool end_element(render_buffer *out, const char *tag, bool raw)
{
    (void)raw;
    return ps_html_end_element(out, ps_fixed(tag));
}

static bool has_events(const ps_value *attrs)
{
    if (!attrs || attrs->kind != PS_OBJECT) return false;
    for (size_t i = 0; i < ps_size(attrs); ++i) {
        ps_text name = ps_key(attrs, i);
        if (name.length >= 3 && name.bytes[0] == 'o' && name.bytes[1] == 'n' &&
            name.bytes[2] >= 'a' && name.bytes[2] <= 'z') return true;
    }
    return false;
}

static bool write_escaped(render_buffer *out, ps_text value, bool raw)
{
    return raw ? raw_text(out, value) : escaped(out, value, false);
}

static bool write_affix(render_buffer *out, const ps_value *affix, bool raw)
{
    if (!affix || affix->kind != PS_OBJECT) return true;
    ps_value *attrs = appearance_attrs(text_member(affix, "class"),
                                       text_member(affix, "style"));
    if (!attrs) return false;
    bool ok = start_element(out, "span", attrs, raw, false) &&
        write_escaped(out, text_member(affix, "text"), raw) &&
        end_element(out, "span", raw);
    ps_value_free(attrs);
    return ok;
}

static bool write_control(render_buffer *out, const ps_value *widget, bool search)
{
    ps_text tag = text_member(widget, "tag");
    if (!tag.length) tag = PS_TEXT("input");
    const ps_value *attrs = member(widget, "attrs");
    bool raw = search || ps_is_string(member(widget, "layout"), "condition") || has_events(attrs);
    if (!ps_html_start_element(out, tag, attrs, raw, !raw)) return false;
    if (ps_html_void_tag(tag)) return true;
    if (ps_text_is(tag, "select")) {
        const ps_value *options = member(widget, "options");
        /* The options of one group form one optgroup element; a group ends where its index changes. */
        const ps_value *open_group = NULL;
        for (size_t i = 0; options && options->kind == PS_ARRAY && i < ps_size(options); ++i) {
            const ps_value *option = ps_at(options, i);
            const ps_value *group = member(option, "group");
            const ps_value *index = member(group, "index");
            bool same = open_group && index && ps_equal(member(open_group, "index"), index);
            if (open_group && !same) {
                if (!end_element(out, "optgroup", raw)) return false;
                open_group = NULL;
            }
            if (group && !open_group) {
                ps_value *group_attrs = ps_object_value();
                bool ok = group_attrs && attr_clone(group_attrs, "label", member(group, "label")) &&
                    start_element(out, "optgroup", group_attrs, raw, false);
                ps_value_free(group_attrs);
                if (!ok) return false;
                open_group = group;
            }
            ps_value *option_attrs = ps_object_value();
            if (!option_attrs || !attr_clone(option_attrs, "value", member(option, "value")) ||
                (bool_member(option, "selected") &&
                 !attr_string(option_attrs, "selected", search ? "selected" : ""))) {
                ps_value_free(option_attrs);
                return false;
            }
            bool ok = start_element(out, "option", option_attrs, raw, false) &&
                write_escaped(out, text_member(option, "label"), raw) &&
                end_element(out, "option", raw);
            ps_value_free(option_attrs);
            if (!ok) return false;
        }
        if (open_group && !end_element(out, "optgroup", raw)) return false;
    } else {
        ps_text content = text_member(widget, "text");
        if (!raw && ps_text_is(tag, "textarea") && content.length && content.bytes[0] == '\n' &&
            !character(out, '\n')) return false;
        if (!write_escaped(out, content, raw)) return false;
    }
    return ps_html_end_element(out, tag);
}

static bool write_script(render_buffer *out, ps_text script)
{
    ps_value *attrs = ps_object_value();
    if (!attrs || !attr_string(attrs, "nonce", "")) { ps_value_free(attrs); return false; }
    bool ok = start_element(out, "script", attrs, false, false) && append(out, script) &&
        end_element(out, "script", false);
    ps_value_free(attrs);
    return ok;
}

static bool write_widget(render_buffer *out, const ps_value *model);

static bool write_choice_group(render_buffer *out, const ps_value *model)
{
    const ps_value *extra = member(model, "extra");
    const ps_value *shared = member(extra, "input");
    bool raw = has_events(shared);
    bool radio = ps_is_string(member(model, "kind"), "choice");
    if (!start_element(out, "div", member(model, "attrs"), false, false)) return false;
    const ps_value *options = member(model, "options");
    for (size_t i = 0; options && options->kind == PS_ARRAY && i < ps_size(options); ++i) {
        const ps_value *option = ps_at(options, i);
        ps_value *attrs = shared && shared->kind == PS_OBJECT
            ? ps_value_clone(shared) : ps_object_value();
        if (!attrs || !attr_string(attrs, "type", radio ? "radio" : "checkbox") ||
            !attr_clone(attrs, "value", member(option, "value")) ||
            !attr_string(attrs, "autocomplete", "off") ||
            !attr_string(attrs, "class", "valid-target crudui-choices__input") ||
            (member(option, "id") && !attr_clone(attrs, "id", member(option, "id"))) ||
            (radio && !attr_string(attrs, "data-is-default",
                                   bool_member(option, "isDefault") ? "1" : "")) ||
            (bool_member(option, "selected") && !attr_string(attrs, "checked", "")) ||
            !ps_append_attributes(attrs, member(extra, "option")) ||
            !ps_append_attributes(attrs, member(option, "attributes"))) {
            ps_value_free(attrs);
            return false;
        }
        bool ok = start_element(out, "input", attrs, raw, false);
        ps_value_free(attrs);
        if (!ok) return false;
        /* The label classes, then the class the choice declares, and its style. */
        ps_value *label_attrs = ps_object_value();
        ps_chars label_class = ps_join_classes(text_member(model, "itemLabelClass"),
                                               text_member(option, "className"), PS_TEXT(""));
        if (!label_attrs || !label_class.bytes || !attr_clone(label_attrs, "for", member(option, "id")) ||
            !attr_text(label_attrs, "class", ps_view(label_class)) ||
            (text_member(option, "style").length && !attr_clone(label_attrs, "style", member(option, "style")))) {
            ps_value_free(label_attrs); free(label_class.bytes);
            return false;
        }
        free(label_class.bytes);
        ok = start_element(out, "label", label_attrs, raw, false) &&
            start_element(out, "span", NULL, raw, false) &&
            write_escaped(out, text_member(option, "label"), raw) &&
            end_element(out, "span", raw) && end_element(out, "label", raw);
        ps_value_free(label_attrs);
        if (!ok) return false;
    }
    return end_element(out, "div", false);
}

static bool write_file_group(render_buffer *out, const ps_value *model)
{
    const ps_value *extra = member(model, "extra");
    const ps_value *file = member(extra, "file");
    const ps_value *display = member(extra, "display");
    bool raw = has_events(file);
    ps_value *group = ps_object_value();
    if (!group || !attr_string(group, "class", "crudui-widget")) { ps_value_free(group); return false; }
    bool ok = start_element(out, "div", group, false, false) &&
        write_affix(out, member(model, "prepend"), raw);
    ps_value_free(group);
    if (!ok) return false;
    if (display && display->kind == PS_OBJECT) {
        ps_value *attrs = raw ? ps_object_value() : ps_value_clone(display);
        if (!attrs || (raw && (!attr_text(attrs, "class", text_member(display, "class")) ||
                              !attr_string(attrs, "readonly", "") ||
                              !attr_string(attrs, "type", "text") ||
                              !attr_string(attrs, "value", "")))) {
            ps_value_free(attrs);
            return false;
        }
        ok = start_element(out, "input", attrs, raw, false);
        ps_value_free(attrs);
        if (!ok) return false;
    }
    if (!start_element(out, "input", file, raw, false)) return false;
    if (display && display->kind == PS_OBJECT) {
        ps_value *attrs = ps_object_value();
        if (!attrs || !attr_string(attrs, "class", "crudui-widget__button") ||
            !attr_string(attrs, "type", "button")) { ps_value_free(attrs); return false; }
        ok = start_element(out, "button", attrs, false, false) && text(out, "&nbsp;") &&
            end_element(out, "button", false);
        ps_value_free(attrs);
        if (!ok) return false;
    }
    return end_element(out, "div", false);
}

static bool write_search(render_buffer *out, const ps_value *model)
{
    ps_text chrome = text_member(model, "styleChrome");
    if (chrome.length) {
        ps_value *attrs = ps_object_value();
        if (!attrs || !attr_string(attrs, "nonce", "")) { ps_value_free(attrs); return false; }
        bool ok = start_element(out, "style", attrs, false, false) && append(out, chrome) &&
            end_element(out, "style", false);
        ps_value_free(attrs);
        if (!ok) return false;
    }
    if (!write_script(out, text_member(model, "script"))) return false;
    ps_value *attrs = ps_object_value();
    if (!attrs || !attr_string(attrs, "class", "crudui-widget crudui-widget--search")) {
        ps_value_free(attrs);
        return false;
    }
    bool ok = start_element(out, "div", attrs, false, false) &&
        write_affix(out, member(model, "prepend"), true) &&
        write_control(out, model, true) &&
        write_affix(out, member(model, "append"), true) &&
        end_element(out, "div", false);
    ps_value_free(attrs);
    return ok;
}

/* The start of an element with the class and the data-condition-path of an editor node. */
static bool start_condition_node(render_buffer *out, const char *tag, const char *class_name, ps_text path)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "class", class_name) && attr_text(attrs, "data-condition-path", path) &&
        start_element(out, tag, attrs, true, false);
    ps_value_free(attrs);
    return ok;
}

static bool write_condition_button(render_buffer *out, const char *action, ps_text label)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "type", "button") &&
        attr_string(attrs, "class", "crudui-action crudui-action--text") &&
        attr_string(attrs, "data-condition-action", action) &&
        start_element(out, "button", attrs, true, false) && raw_text(out, label) &&
        end_element(out, "button", false);
    ps_value_free(attrs);
    return ok;
}

static bool write_condition_option(render_buffer *out, ps_text choice, ps_text selected)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_text(attrs, "value", choice) &&
        (!ps_text_equal(choice, selected) || attr_string(attrs, "selected", "")) &&
        start_element(out, "option", attrs, true, false) && raw_text(out, choice) &&
        end_element(out, "option", false);
    ps_value_free(attrs);
    return ok;
}

/* A select of the editor: its attributes (class, part and an optional aria-label) and the start of its options. */
static bool start_condition_select(render_buffer *out, const char *class_name, const char *part, const ps_value *label)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "class", class_name) && attr_string(attrs, "data-condition-part", part) &&
        (!label || attr_clone(attrs, "aria-label", label)) && start_element(out, "select", attrs, true, false);
    ps_value_free(attrs);
    return ok;
}

static bool write_condition_input(render_buffer *out, const char *class_name, const char *part, const ps_value *value)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "class", class_name) && attr_string(attrs, "data-condition-part", part) &&
        attr_clone(attrs, "value", value) && ps_html_start_element(out, PS_TEXT("input"), attrs, true, false);
    ps_value_free(attrs);
    return ok;
}

/* One condition of the editor: a group, a field comparison or a judged text (docs/spec/form-markup.md, CUMK-067). */
static bool write_condition_node(render_buffer *out, const ps_value *node, const ps_value *editor)
{
    const ps_value *labels = member(editor, "labels");
    ps_text path = text_member(node, "path");
    ps_text kind = text_member(node, "kind");
    bool removable = path.length > 0;
    if (ps_text_is(kind, "group")) {
        if (!start_condition_node(out, "fieldset", "crudui-condition__group", path) ||
            !start_condition_select(out, "crudui-condition__mode", "mode", member(labels, "mode")) ||
            !write_condition_option(out, PS_TEXT("all"), text_member(node, "mode")) ||
            !write_condition_option(out, PS_TEXT("any"), text_member(node, "mode")) ||
            !end_element(out, "select", false)) return false;
        ps_value *list_attrs = ps_object_value();
        bool ok = list_attrs && attr_string(list_attrs, "class", "crudui-condition__list") &&
            start_element(out, "ol", list_attrs, false, false);
        ps_value_free(list_attrs);
        const ps_value *items = member(node, "items");
        for (size_t i = 0; ok && i < ps_size(items); ++i) {
            ps_value *item_attrs = ps_object_value();
            ok = item_attrs && attr_string(item_attrs, "class", "crudui-condition__item") &&
                start_element(out, "li", item_attrs, false, false) &&
                write_condition_node(out, ps_at(items, i), editor) && end_element(out, "li", false);
            ps_value_free(item_attrs);
        }
        return ok && end_element(out, "ol", false) &&
            write_condition_button(out, "add-comparison", text_member(labels, "addComparison")) &&
            write_condition_button(out, "add-group", text_member(labels, "addGroup")) &&
            (!bool_member(editor, "judge") || write_condition_button(out, "add-judge", text_member(labels, "addJudge"))) &&
            (!removable || write_condition_button(out, "remove", text_member(labels, "remove"))) &&
            end_element(out, "fieldset", false);
    }
    if (ps_text_is(kind, "judge")) {
        return start_condition_node(out, "div", "crudui-condition__judge", path) &&
            write_condition_input(out, "crudui-condition__text", "judge", member(node, "text")) &&
            (!removable || write_condition_button(out, "remove", text_member(labels, "remove"))) &&
            end_element(out, "div", false);
    }
    ps_text field = text_member(node, "field");
    const ps_value *fields = member(editor, "fields");
    if (!start_condition_node(out, "div", "crudui-condition__comparison", path)) return false;
    bool ok = true;
    if (fields && fields->kind == PS_ARRAY) {
        bool listed = false;
        for (size_t i = 0; i < ps_size(fields); ++i) listed = listed || ps_text_equal(ps_string(ps_at(fields, i)), field);
        ok = start_condition_select(out, "crudui-condition__field", "field", NULL) &&
            (listed || write_condition_option(out, field, field));
        for (size_t i = 0; ok && i < ps_size(fields); ++i) ok = write_condition_option(out, ps_string(ps_at(fields, i)), field);
        ok = ok && end_element(out, "select", false);
    } else {
        ok = write_condition_input(out, "crudui-condition__field", "field", member(node, "field"));
    }
    ok = ok && start_condition_select(out, "crudui-condition__op", "op", NULL);
    for (size_t i = 0; ok && i < 8; ++i) ok = write_condition_option(out, ps_fixed(ps_condition_ops[i]), text_member(node, "op"));
    return ok && end_element(out, "select", false) &&
        write_condition_input(out, "crudui-condition__value", "value", member(node, "value")) &&
        (!removable || write_condition_button(out, "remove", text_member(labels, "remove"))) &&
        end_element(out, "div", false);
}

/*
 * A structured condition widget (docs/spec/form-markup.md, Structured condition editor): the prepend affix,
 * the named error of a value that the editor does not show, the textarea, the editor of a value that it
 * shows and the append affix.
 */
static bool write_condition_widget(render_buffer *out, const ps_value *model)
{
    const ps_value *editor = member(model, "condition");
    bool raw = true;
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "class", "crudui-widget crudui-widget--condition") &&
        start_element(out, "div", attrs, false, false) && write_affix(out, member(model, "prepend"), raw);
    ps_value_free(attrs);
    if (ok && ps_has(editor, "error")) {
        ps_value *error = ps_object_value();
        ok = error && attr_string(error, "class", "crudui-condition__error") && attr_string(error, "role", "alert") &&
            start_element(out, "p", error, false, false) && raw_text(out, text_member(editor, "error")) &&
            end_element(out, "p", false);
        ps_value_free(error);
    }
    ok = ok && write_control(out, model, false);
    if (ok && !ps_has(editor, "error")) {
        ps_value *wrapper = ps_object_value();
        ok = wrapper && attr_string(wrapper, "class", "crudui-condition") &&
            attr_clone(wrapper, "data-condition-for", member(editor, "for")) &&
            start_element(out, "div", wrapper, true, false) &&
            write_condition_node(out, member(editor, "root"), editor) && end_element(out, "div", false);
        ps_value_free(wrapper);
    }
    return ok && write_affix(out, member(model, "append"), raw) && end_element(out, "div", false);
}

static bool write_widget(render_buffer *out, const ps_value *model)
{
    if (!model || model->kind != PS_OBJECT) return false;
    if (bool_member(model, "unsupported")) {
        ps_value *attrs = ps_object_value();
        if (!attrs || !attr_string(attrs, "class", "crudui-widget crudui-widget--unsupported") ||
            !attr_text(attrs, "data-unsupported-type", text_member(model, "type"))) {
            ps_value_free(attrs);
            return false;
        }
        bool ok = start_element(out, "div", attrs, false, false) &&
            end_element(out, "div", false);
        ps_value_free(attrs);
        return ok;
    }
    ps_text layout = text_member(model, "layout");
    if (ps_text_is(layout, "widget")) {
        ps_value *attrs = ps_object_value();
        if (!attrs || !attr_string(attrs, "class", "crudui-widget")) { ps_value_free(attrs); return false; }
        bool raw = has_events(member(model, "attrs"));
        bool ok = start_element(out, "div", attrs, false, false) &&
            write_affix(out, member(model, "prepend"), raw) &&
            write_control(out, model, false) &&
            write_affix(out, member(model, "append"), raw) &&
            end_element(out, "div", false);
        ps_value_free(attrs);
        return ok;
    }
    if (ps_text_is(layout, "range")) {
        /* The range input, an output with the value it was rendered with and the unit. */
        ps_value *attrs = ps_object_value();
        ps_value *output = ps_object_value();
        const ps_value *id = member(member(model, "attrs"), "id");
        bool raw = has_events(member(model, "attrs"));
        bool ok = attrs && output && attr_string(attrs, "class", "crudui-widget crudui-widget--range") &&
            attr_string(output, "class", "crudui-widget__output") && (!id || attr_clone(output, "for", id)) &&
            start_element(out, "div", attrs, false, false) &&
            write_affix(out, member(model, "prepend"), raw) &&
            write_control(out, model, false) &&
            start_element(out, "output", output, raw, false) &&
            write_escaped(out, text_member(model, "text"), raw) && end_element(out, "output", raw) &&
            write_affix(out, member(model, "append"), raw) &&
            end_element(out, "div", false);
        ps_value_free(attrs); ps_value_free(output);
        return ok;
    }
    if (ps_text_is(layout, "bare")) return write_control(out, model, false);
    if (ps_text_is(layout, "host-script"))
        return write_control(out, model, false) && write_script(out, text_member(model, "script"));
    if (ps_text_is(layout, "choices")) return write_choice_group(out, model);
    if (ps_text_is(layout, "file")) return write_file_group(out, model);
    if (ps_text_is(layout, "display"))
        return start_element(out, "div", member(model, "attrs"), false, true) &&
            append(out, text_member(model, "rawHtml")) && end_element(out, "div", false);
    if (ps_text_is(layout, "search")) return write_search(out, model);
    if (ps_text_is(layout, "button")) return write_control(out, model, false);
    if (ps_text_is(layout, "condition")) return write_condition_widget(out, model);
    return false;
}

static bool write_node(render_buffer *out, const ps_value *node, const ps_form_render *render);

/* Append a class list part; empty parts are skipped and parts are joined by one space. */
static bool class_part(render_buffer *classes, ps_text part)
{
    if (!part.length) return true;
    return (!classes->length || character(classes, ' ')) && append(classes, part);
}

static bool write_empty_element(render_buffer *out, const char *tag, const ps_value *attrs)
{
    return start_element(out, tag, attrs, false, false) && end_element(out, tag, false);
}

static bool write_text_element(render_buffer *out, const char *tag, const ps_value *attrs,
                               ps_text content)
{
    return start_element(out, tag, attrs, false, false) && escaped(out, content, false) &&
        end_element(out, tag, false);
}

static bool write_controls(render_buffer *out, const ps_value *controls)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "class", "crudui-controls") &&
        attr_string(attrs, "role", "group") &&
        attr_text(attrs, "aria-label", text_member(controls, "label")) &&
        start_element(out, "div", attrs, false, false);
    ps_value_free(attrs);
    const ps_value *actions = member(controls, "actions");
    for (size_t i = 0; ok && actions && actions->kind == PS_ARRAY && i < ps_size(actions); ++i) {
        const ps_value *action = ps_at(actions, i);
        ps_value *button = ps_object_value();
        ok = button && attr_string(button, "type", "button") &&
            attr_string(button, "class", "crudui-action") &&
            attr_text(button, "data-crudui-action", text_member(action, "name")) &&
            attr_text(button, "aria-label", text_member(action, "label")) &&
            (!bool_member(action, "disabled") || attr_string(button, "aria-disabled", "true")) &&
            write_empty_element(out, "button", button);
        ps_value_free(button);
    }
    return ok && end_element(out, "div", false);
}

static bool write_class_text(render_buffer *out, const char *tag, const char *class_name,
                             ps_text content)
{
    ps_value *attrs = ps_object_value();
    bool ok = attrs && attr_string(attrs, "class", class_name) &&
        write_text_element(out, tag, attrs, content);
    ps_value_free(attrs);
    return ok;
}

/* Header parts in slot order; the header is omitted when it has no parts. */
static bool write_header(render_buffer *out, const ps_value *node)
{
    const ps_value *header = member(node, "header");
    const ps_value *controls = member(node, "controls");
    bool collapsible = bool_member(node, "collapsible");
    bool expanded = bool_member(node, "expanded");
    bool header_controls = ps_is_string(member(controls, "placement"), "header");
    render_buffer parts = {0};
    bool ok = true;
    if (collapsible) {
        ps_value *toggle = ps_object_value();
        const ps_value *body_id = member(member(node, "body"), "id");
        ok = toggle && attr_string(toggle, "type", "button") &&
            attr_string(toggle, "class", "crudui-action") &&
            attr_string(toggle, "data-crudui-action", "toggle-row") &&
            attr_string(toggle, "aria-expanded", expanded ? "true" : "false") &&
            (!body_id || attr_clone(toggle, "aria-controls", body_id)) &&
            (!member(node, "toggleLabel") ||
             attr_clone(toggle, "aria-label", member(node, "toggleLabel"))) &&
            write_empty_element(&parts, "button", toggle);
        ps_value_free(toggle);
    }
    if (ok && member(header, "label")) {
        const ps_value *target = member(header, "labelFor");
        ps_value *attrs = ps_object_value();
        ok = attrs && attr_string(attrs, "class", "crudui-node__label") &&
            (!target || !text_member(header, "labelFor").length || attr_clone(attrs, "for", target)) &&
            write_text_element(&parts, target && text_member(header, "labelFor").length ? "label" : "span",
                               attrs, text_member(header, "label"));
        ps_value_free(attrs);
    }
    if (ok && member(header, "description"))
        ok = write_class_text(&parts, "p", "crudui-node__description", text_member(header, "description"));
    if (ok && member(header, "number"))
        ok = write_class_text(&parts, "span", "crudui-node__number", text_member(header, "number"));
    if (ok && member(header, "title"))
        ok = write_class_text(&parts, "span", "crudui-node__title", text_member(header, "title"));
    if (ok && member(header, "summary")) {
        ps_value *attrs = ps_object_value();
        ok = attrs && attr_string(attrs, "class", "crudui-node__summary") &&
            (!expanded || attr_string(attrs, "hidden", "")) &&
            write_text_element(&parts, "span", attrs, text_member(header, "summary"));
        ps_value_free(attrs);
    }
    if (ok && member(header, "count"))
        ok = write_class_text(&parts, "span", "crudui-node__count", text_member(header, "count"));
    if (ok && header_controls) ok = write_controls(&parts, controls);
    if (!ok) parts.failed = true;
    ps_chars content = take(&parts);
    if (!content.bytes) return false;
    if (!content.length) { free(content.bytes); return true; }

    render_buffer classes = {0};
    ps_text header_style = text_member(header, "style");
    if (!class_part(&classes, PS_TEXT("crudui-node__header")) ||
        !class_part(&classes, text_member(header, "className"))) classes.failed = true;
    ps_chars class_name = take(&classes);
    ps_value *attrs = ps_object_value();
    ok = class_name.bytes && attrs && attr_text(attrs, "class", ps_view(class_name)) &&
        (!header_style.length || attr_text(attrs, "style", header_style)) &&
        start_element(out, "div", attrs, false, false) && append(out, ps_view(content)) &&
        end_element(out, "div", false);
    free(class_name.bytes); free(content.bytes); ps_value_free(attrs);
    return ok;
}

static bool write_body(render_buffer *out, const ps_value *node, const ps_form_render *render)
{
    const ps_value *body = member(node, "body");
    render_buffer classes = {0};
    if (!class_part(&classes, PS_TEXT("crudui-node__body")) ||
        !class_part(&classes, text_member(body, "className"))) classes.failed = true;
    ps_chars class_name = take(&classes);
    ps_value *attrs = ps_object_value();
    bool ok = class_name.bytes && attrs && attr_text(attrs, "class", ps_view(class_name)) &&
        (!text_member(body, "style").length || attr_clone(attrs, "style", member(body, "style"))) &&
        (!text_member(body, "id").length || attr_clone(attrs, "id", member(body, "id"))) &&
        (!bool_member(node, "collapsible") || bool_member(node, "expanded") ||
         attr_string(attrs, "hidden", "")) &&
        start_element(out, "div", attrs, false, false);
    free(class_name.bytes); ps_value_free(attrs);
    if (!ok) return false;
    const ps_value *checkbox = member(node, "checkbox");
    if (checkbox) {
        ps_value *input = ps_object_value();
        ps_value *label = ps_object_value();
        ok = input && label &&
            attr_text(input, "class", text_member(checkbox, "className")) &&
            attr_text(input, "id", text_member(checkbox, "id")) &&
            attr_text(input, "name", text_member(checkbox, "name")) &&
            attr_string(input, "type", "checkbox") &&
            (!text_member(checkbox, "role").length || attr_clone(input, "role", member(checkbox, "role"))) &&
            attr_string(input, "value", "1") &&
            (!bool_member(checkbox, "checked") || attr_string(input, "checked", "")) &&
            ps_append_attributes(input, member(checkbox, "attributes")) &&
            start_element(out, "input", input, false, false) &&
            /* An inline layout writes the label in the header, and the checkbox has no caption. */
            (!member(checkbox, "caption") ||
             (attr_text(label, "for", text_member(checkbox, "id")) &&
              write_text_element(out, "label", label, text_member(checkbox, "caption"))));
        ps_value_free(input); ps_value_free(label);
    } else if (member(node, "widget")) {
        ok = write_widget(out, member(node, "widget"));
    } else {
        const ps_value *children = member(node, "children");
        for (size_t i = 0; ok && children && children->kind == PS_ARRAY && i < ps_size(children); ++i)
            ok = write_node(out, ps_at(children, i), render);
    }
    return ok && end_element(out, "div", false);
}

/* A `{block}__errors` element with one `{block}__error` paragraph per message; nothing without messages. */
static bool write_errors(render_buffer *out, const char *errors_class, const char *error_class,
                         const ps_value *messages)
{
    if (!messages || !ps_size(messages)) return true;
    ps_value *errors = ps_object_value();
    ps_value *paragraph = ps_object_value();
    bool ok = errors && paragraph && attr_string(errors, "class", errors_class) &&
        attr_string(paragraph, "class", error_class) && start_element(out, "div", errors, false, false);
    for (size_t i = 0; ok && i < ps_size(messages); ++i)
        ok = start_element(out, "p", paragraph, false, false) &&
            escaped(out, ps_string(ps_at(messages, i)), false) && end_element(out, "p", false);
    ok = ok && end_element(out, "div", false);
    ps_value_free(errors); ps_value_free(paragraph);
    return ok;
}

/* The error texts of a node in the render options, or NULL. */
static const ps_value *node_errors(const ps_form_render *render, const ps_value *node)
{
    for (size_t i = 0; render && i < render->error_count; ++i)
        if (render->errors[i].node == node) return render->errors[i].messages;
    return NULL;
}

/* One node of the recursive form grammar: root, header, body, errors and footer slots. */
static bool write_node(render_buffer *out, const ps_value *node, const ps_form_render *render)
{
    if (!node || node->kind != PS_OBJECT) return false;
    ps_text kind = text_member(node, "kind");
    ps_chars modifier = PS_CONCAT(PS_TEXT("crudui-node--"), kind);
    render_buffer classes = {0};
    if (!modifier.bytes || !class_part(&classes, PS_TEXT("crudui-node")) ||
        !class_part(&classes, ps_view(modifier)) ||
        (bool_member(node, "sticky") && !class_part(&classes, PS_TEXT("crudui-node--sticky"))) ||
        !class_part(&classes, text_member(node, "className"))) classes.failed = true;
    free(modifier.bytes);
    ps_chars class_name = take(&classes);
    /* A sticky row carries its depth on the root; the stylesheet derives its sticky line from it. */
    render_buffer style = {0};
    ps_text node_style = text_member(node, "style");
    if (node_style.length && !append(&style, node_style)) style.failed = true;
    if (bool_member(node, "sticky")) {
        ps_chars depth = member(node, "stickyDepth") ? ps_scalar_string(member(node, "stickyDepth"))
                                                     : ps_copy(PS_TEXT("0"));
        if (!depth.bytes || (style.length && !text(&style, "; ")) ||
            !text(&style, "--crudui-sticky-depth: ") || !append(&style, ps_view(depth))) style.failed = true;
        free(depth.bytes);
    }
    ps_chars style_text = take(&style);
    bool path = !ps_text_is(kind, "row") && !ps_text_is(kind, "lang-item") && member(node, "path");
    ps_value *attrs = ps_object_value();
    render_buffer header = {0};
    bool ok = class_name.bytes && style_text.bytes && attrs &&
        attr_text(attrs, "class", ps_view(class_name)) &&
        (!style_text.length || attr_text(attrs, "style", ps_view(style_text))) &&
        (!path || attr_clone(attrs, "data-field-path", member(node, "path"))) &&
        (!member(node, "key") || attr_clone(attrs, "data-crudui-row-key", member(node, "key"))) &&
        (!member(node, "lang") || attr_clone(attrs, "data-lang", member(node, "lang"))) &&
        (!bool_member(node, "hidden") || attr_string(attrs, "hidden", "")) &&
        ps_append_attributes(attrs, member(node, "attributes")) &&
        write_header(&header, node) && start_element(out, "div", attrs, false, false);
    if (!ok) header.failed = true;
    ps_chars header_html = take(&header);
    if (ok && header_html.bytes && header_html.length && bool_member(node, "sticky")) {
        ps_value *wrapper = ps_object_value();
        ok = wrapper && attr_string(wrapper, "class", "crudui-node__header-container") &&
            start_element(out, "div", wrapper, false, false) && append(out, ps_view(header_html)) &&
            end_element(out, "div", false);
        ps_value_free(wrapper);
    } else if (ok && header_html.bytes) {
        ok = append(out, ps_view(header_html));
    } else if (ok) {
        ok = false;
    }
    free(header_html.bytes);
    ok = ok && write_body(out, node, render) &&
        write_errors(out, "crudui-node__errors", "crudui-node__error", node_errors(render, node));
    free(class_name.bytes); free(style_text.bytes); ps_value_free(attrs);
    const ps_value *controls = member(node, "controls");
    if (ok && ps_is_string(member(controls, "placement"), "footer")) {
        ps_value *footer = ps_object_value();
        ok = footer && attr_string(footer, "class", "crudui-node__footer") &&
            start_element(out, "div", footer, false, false) && write_controls(out, controls) &&
            end_element(out, "div", false);
        ps_value_free(footer);
    }
    return ok && end_element(out, "div", false);
}

/* Button escaping: attribute values escape & " <, text escapes & < >. */
static bool button_escaped(render_buffer *out, ps_text value, bool attribute)
{
    for (size_t i = 0; i < value.length; ++i) {
        char c = value.bytes[i];
        const char *entity = c == '&' ? "&amp;" : c == '<' ? "&lt;"
            : attribute && c == '"' ? "&quot;" : !attribute && c == '>' ? "&gt;" : NULL;
        if (entity ? !text(out, entity) : !character(out, c)) return false;
    }
    return true;
}

/* The button elements alone: tag, attributes in member order, escaped text. */
static bool write_button_items(render_buffer *out, const ps_value *buttons)
{
    bool ok = true;
    for (size_t i = 0; ok && i < ps_size(buttons); ++i) {
        const ps_value *button = ps_at(buttons, i);
        ps_text tag = text_member(button, "tag");
        const ps_value *attrs = member(button, "attrs");
        ok = character(out, '<') && append(out, tag);
        for (size_t j = 0; ok && attrs && j < ps_size(attrs); ++j) {
            ok = character(out, ' ') && append(out, ps_key(attrs, j)) && text(out, "=\"") &&
                button_escaped(out, ps_string(ps_at(attrs, j)), true) &&
                character(out, '"');
        }
        ok = ok && character(out, '>') && button_escaped(out, text_member(button, "text"), false) &&
            text(out, "</") && append(out, tag) && character(out, '>');
    }
    return ok;
}

static bool write_buttons(render_buffer *out, const ps_value *buttons, const char *label)
{
    ps_value *footer = ps_object_value();
    ps_value *controls = ps_object_value();
    bool ok = footer && controls && attr_string(footer, "class", "crudui-form__footer") &&
        attr_string(controls, "class", "crudui-controls") && attr_string(controls, "role", "group") &&
        attr_string(controls, "aria-label", label) &&
        start_element(out, "div", footer, false, false) && start_element(out, "div", controls, false, false);
    ps_value_free(footer); ps_value_free(controls);
    ok = ok && write_button_items(out, buttons);
    return ok && end_element(out, "div", false) && end_element(out, "div", false);
}

/* The form element and its hidden inputs, written before the crudui-form block. */
static bool write_form_start(render_buffer *out, const ps_form_render *render)
{
    if (!start_element(out, "form", render->form, false, false)) return false;
    bool ok = true;
    for (size_t i = 0; ok && render->hidden && render->hidden->kind == PS_OBJECT && i < ps_size(render->hidden); ++i) {
        ps_value *input = ps_object_value();
        ok = input && attr_string(input, "type", "hidden") &&
            attr_text(input, "name", ps_key(render->hidden, i)) &&
            attr_clone(input, "value", ps_at(render->hidden, i)) &&
            start_element(out, "input", input, false, false);
        ps_value_free(input);
    }
    return ok;
}

/* The root description paragraph; nothing when the text is empty. */
static bool write_description(render_buffer *out, ps_text description)
{
    if (!description.length) return true;
    ps_value *paragraph = ps_object_value();
    bool ok = paragraph && attr_string(paragraph, "class", "crudui-form__description") &&
        start_element(out, "p", paragraph, false, false) && escaped(out, description, false) &&
        end_element(out, "p", false);
    ps_value_free(paragraph);
    return ok;
}

static ps_chars render_form(const ps_value *fields, const ps_value *buttons, const char *label,
                            const ps_form_render *render, ps_text description)
{
    if (!fields || fields->kind != PS_ARRAY) return (ps_chars){NULL, 0};
    render_buffer out = {0};
    ps_value *form = ps_object_value();
    ps_value *body = ps_object_value();
    bool wrapped = render && render->form;
    bool ok = form && body && attr_string(form, "class", "crudui-form") &&
        attr_string(body, "class", "crudui-form__body") &&
        (!wrapped || write_form_start(&out, render)) &&
        start_element(&out, "div", form, false, false) &&
        write_description(&out, description) &&
        write_errors(&out, "crudui-form__errors", "crudui-form__error", render ? render->form_errors : NULL) &&
        start_element(&out, "div", body, false, false);
    for (size_t i = 0; ok && i < ps_size(fields); ++i) ok = write_node(&out, ps_at(fields, i), render);
    ok = ok && end_element(&out, "div", false) &&
        (!buttons || write_buttons(&out, buttons, label));
    if (!ok || !end_element(&out, "div", false) || (wrapped && !end_element(&out, "form", false))) out.failed = true;
    ps_value_free(form); ps_value_free(body);
    return take(&out);
}

ps_chars ps_render_fields(const ps_value *fields)
{
    return render_form(fields, NULL, NULL, NULL, PS_TEXT(""));
}

ps_chars ps_render_form(const ps_value *fields, const ps_value *buttons, const char *actions_label,
                        const ps_form_render *render, ps_text description)
{
    if (!buttons || buttons->kind != PS_ARRAY || !actions_label) return (ps_chars){NULL, 0};
    return render_form(fields, buttons, actions_label, render, description);
}

/* A string member, or false when absent or of another kind. */
static bool string_valued(const ps_value *object, const char *name)
{
    const ps_value *value = member(object, name);
    return value && value->kind == PS_STRING;
}

/* An evaluated button: tag a or button, string text, attrs of known names with string values. */
static bool evaluated_button(const ps_value *button)
{
    static const char *const names[] = {"type", "class", "style", "name", "value", "href", "onclick"};
    const ps_value *attrs = member(button, "attrs");
    if (!button || button->kind != PS_OBJECT || !string_valued(button, "text") ||
        !(ps_is_string(member(button, "tag"), "a") || ps_is_string(member(button, "tag"), "button")) ||
        !attrs || attrs->kind != PS_OBJECT) return false;
    for (size_t j = 0; j < ps_size(attrs); ++j) {
        ps_text name = ps_key(attrs, j);
        bool known = false;
        for (size_t k = 0; !known && k < sizeof(names) / sizeof(*names); ++k)
            known = ps_text_is(name, names[k]);
        if (!known || !ps_at(attrs, j) || ps_at(attrs, j)->kind != PS_STRING) return false;
    }
    return true;
}

ps_result ps_form_buttons_html(const ps_value *buttons)
{
    if (!buttons || buttons->kind != PS_ARRAY)
        return ps_fail("form", "INVALID_FORM_INPUT", "Form buttons must be a list", "");
    for (size_t i = 0; i < ps_size(buttons); ++i)
        if (!evaluated_button(ps_at(buttons, i)))
            return ps_fail("form", "INVALID_FORM_INPUT", "Form buttons must be evaluated button objects", "");
    render_buffer out = {0};
    if (!write_button_items(&out, buttons)) out.failed = true;
    ps_value *value = ps_html_value(&out);
    return value ? ps_ok(value) : ps_fail("internal", "INTERNAL_ERROR", "C button rendering failed", "");
}
