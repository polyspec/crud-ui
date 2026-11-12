package generator

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

func escape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&#x27;").Replace(s)
}
func rawEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", `"`, "&quot;", "<", "&lt;").Replace(s)
}
func escapeText(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}
func eventAttrs(a *Object) bool {
	if a == nil {
		return false
	}
	for _, k := range a.Keys() {
		if strings.HasPrefix(k, "on") {
			return true
		}
	}
	return false
}
func attrs(a *Object, raw, input bool) string {
	if a == nil {
		return ""
	}
	out := ""
	value, hasValue := a.Get("value")
	checked, hasChecked := a.Get("checked")
	name, hasName := a.Get("name")
	style, hasStyle := a.Get("style")
	for _, k := range a.Keys() {
		v := read(a, k)
		if isAbsent(v) || v == nil {
			continue
		}
		if !raw && input && (k == "value" || k == "checked" || k == "name" || k == "style") {
			continue
		}
		s := scalar(v)
		if !raw && (k == "href" || k == "src") {
			s = sanitizeURL(s)
		}
		if k == "style" && !raw {
			s = compactStyle(s)
			if s == "" {
				continue
			}
		}
		if !raw && (k == "readonly" || k == "disabled" || k == "required" || k == "multiple" || k == "autofocus") {
			s = ""
		}
		esc := escape
		if raw {
			esc = rawEscape
		}
		key := k
		if !raw {
			key = ordinaryAttribute(k)
		}
		out += " " + key + `="` + esc(s) + `"`
	}
	if !raw && input {
		if hasStyle {
			if css := compactStyle(scalar(style)); css != "" {
				out += ` style="` + escape(css) + `"`
			}
		}
		if hasName {
			out += ` name="` + escape(scalar(name)) + `"`
		}
		if hasChecked && truthy(checked) {
			out += ` checked=""`
		}
		if hasValue {
			out += ` value="` + escape(scalar(value)) + `"`
		}
	}
	return out
}
func element(tag string, a *Object, body string) string {
	return "<" + tag + attrs(a, false, false) + ">" + body + "</" + tag + ">"
}
func rawElement(tag string, a *Object, body string) string {
	return "<" + tag + attrs(a, true, false) + ">" + body + "</" + tag + ">"
}
func inputHTML(a *Object, raw bool) string {
	end := "/>"
	if raw {
		end = ">"
	}
	return "<input" + attrs(a, raw, true) + end
}
func affixHTML(v any, raw bool) string {
	a := object(v)
	if a == nil {
		return ""
	}
	at := NewObject()
	for _, k := range []string{"class", "style"} {
		if s := stringAt(a, k); s != "" {
			at.Set(k, s)
		}
	}
	return "<span" + attrs(at, raw, false) + ">" + textContent(stringAt(a, "text"), raw) + "</span>"
}
func objectList(v any) []*Object {
	if a, ok := v.([]*Object); ok {
		return a
	}
	out := []*Object{}
	for _, a := range list(v) {
		if o := object(a); o != nil {
			out = append(out, o)
		}
	}
	return out
}

// styleLast returns the attributes with style moved last, as an ordinary control writes them.
func styleLast(a *Object) *Object {
	if !a.Has("style") {
		return a
	}
	a = a.Clone()
	style := read(a, "style")
	a.Delete("style")
	a.Set("style", style)
	return a
}
func controlHTML(w *Object, raw bool, selection string) string {
	tag := stringAt(w, "tag")
	a := object(read(w, "attrs"))
	if !raw {
		a = styleLast(a)
	}
	switch tag {
	case "select":
		body := ""
		// The options of a run of consecutive options of one group are written in its optgroup.
		var group *Object
		for _, o := range objectList(read(w, "options")) {
			g := object(read(o, "group"))
			if group != nil && (g == nil || read(g, "index") != read(group, "index")) {
				body += "</optgroup>"
			}
			if g != nil && (group == nil || read(g, "index") != read(group, "index")) {
				body += "<optgroup" + attrs(NewObject("label", stringAt(g, "label")), raw, false) + ">"
			}
			group = g
			at := NewObject("value", stringAt(o, "value"))
			if truthy(read(o, "selected")) {
				at.Set("selected", selection)
			}
			body += "<option" + attrs(at, raw, false) + ">" + textContent(stringAt(o, "label"), raw) + "</option>"
		}
		if group != nil {
			body += "</optgroup>"
		}
		return "<select" + attrs(a, raw, false) + ">" + body + "</select>"
	case "textarea":
		text := stringAt(w, "text")
		if !raw && strings.HasPrefix(text, "\n") {
			text = "\n" + text
		}
		return "<textarea" + attrs(a, raw, false) + ">" + textContent(text, raw) + "</textarea>"
	default:
		return inputHTML(a, raw)
	}
}
func renderWidget(w *Object) string {
	if w == nil {
		return ""
	}
	if read(w, "unsupported") == true {
		return element("div", NewObject("class", "crudui-widget crudui-widget--unsupported", "data-unsupported-type", stringAt(w, "type")), "")
	}
	a := object(read(w, "attrs"))
	raw := eventAttrs(a)
	script := `<script nonce="">` + stringAt(w, "script") + `</script>`
	switch stringAt(w, "layout") {
	case "widget":
		return `<div class="crudui-widget">` + affixHTML(read(w, "prepend"), raw) + controlHTML(w, raw, "") + affixHTML(read(w, "append"), raw) + `</div>`
	case "bare":
		return controlHTML(w, raw, "")
	case "range":
		output := NewObject("class", "crudui-widget__output")
		if id := stringAt(a, "id"); id != "" {
			output.Set("for", id)
		}
		return `<div class="crudui-widget crudui-widget--range">` + affixHTML(read(w, "prepend"), raw) + controlHTML(w, raw, "") + "<output" + attrs(output, raw, false) + ">" + textContent(stringAt(w, "text"), raw) + "</output>" + affixHTML(read(w, "append"), raw) + `</div>`
	case "host-script":
		return controlHTML(w, raw, "") + script
	case "choices":
		shared := object(read(read(w, "extra"), "input"))
		raw = eventAttrs(shared)
		body := ""
		typ := "checkbox"
		if stringAt(w, "kind") == "choice" {
			typ = "radio"
		}
		for _, o := range objectList(read(w, "options")) {
			at := NewObject()
			merge(at, shared)
			at.Set("type", typ)
			at.Set("value", stringAt(o, "value"))
			at.Set("autocomplete", "off")
			at.Set("class", "valid-target crudui-choices__input")
			if id := stringAt(o, "id"); id != "" {
				at.Set("id", id)
			}
			if typ == "radio" {
				v := ""
				if truthy(read(o, "isDefault")) {
					v = "1"
				}
				at.Set("data-is-default", v)
			}
			if truthy(read(o, "selected")) {
				at.Set("checked", true)
			}
			if raw && at.Has("checked") {
				at.Set("checked", "")
			}
			merge(at, read(read(w, "extra"), "option"))
			merge(at, read(o, "attributes"))
			body += inputHTML(at, raw)
			label := NewObject()
			if id := stringAt(o, "id"); id != "" {
				label.Set("for", id)
			}
			label.Set("class", joinClass(stringAt(w, "itemLabelClass"), stringAt(o, "className")))
			if style := stringAt(o, "style"); style != "" {
				label.Set("style", style)
			}
			body += "<label" + attrs(label, raw, false) + "><span>" + textContent(stringAt(o, "label"), raw) + "</span></label>"
		}
		return "<div" + attrs(a, false, false) + ">" + body + "</div>"
	case "file":
		extra := read(w, "extra")
		file := object(read(extra, "file"))
		display := object(read(extra, "display"))
		raw = eventAttrs(file)
		body := affixHTML(read(w, "prepend"), raw)
		if display != nil {
			if raw {
				body += `<input class="` + rawEscape(stringAt(display, "class")) + `" readonly="" type="text" value="">`
			} else {
				body += inputHTML(display, false)
			}
		}
		body += inputHTML(file, raw)
		if display != nil {
			body += `<button class="crudui-widget__button" type="button">&nbsp;</button>`
		}
		return `<div class="crudui-widget">` + body + `</div>`
	case "display":
		return "<div" + attrs(styleLast(a), false, false) + ">" + stringAt(w, "rawHtml") + "</div>"
	case "search":
		style := ""
		if s := stringAt(w, "styleChrome"); s != "" {
			style = `<style nonce="">` + s + `</style>`
		}
		return style + script + `<div class="crudui-widget crudui-widget--search">` + affixHTML(read(w, "prepend"), true) + controlHTML(w, true, "selected") + affixHTML(read(w, "append"), true) + `</div>`
	case "button":
		if !raw {
			a = styleLast(a)
		}
		return "<button" + attrs(a, raw, false) + ">" + textContent(stringAt(w, "text"), raw) + "</button>"
	case "condition":
		return conditionWidgetHTML(w)
	}
	return ""
}

// conditionWidgetHTML writes a structured condition widget (docs/spec/form-markup.md, Structured condition
// editor): the prepend affix, the named error of a value that the editor does not show, the textarea, the
// editor of a value that it shows and the append affix.
func conditionWidgetHTML(w *Object) string {
	editor := object(read(w, "condition"))
	body := affixHTML(read(w, "prepend"), true)
	if editor.Has("error") {
		body += rawElement("p", NewObject("class", "crudui-condition__error", "role", "alert"), escapeText(stringAt(editor, "error")))
	}
	body += controlHTML(w, true, "")
	if !editor.Has("error") {
		body += rawElement("div", NewObject("class", "crudui-condition", "data-condition-for", stringAt(editor, "for")), conditionNodeHTML(object(read(editor, "root")), editor))
	}
	return `<div class="crudui-widget crudui-widget--condition">` + body + affixHTML(read(w, "append"), true) + `</div>`
}

func conditionButtonHTML(action, label string) string {
	return rawElement("button", NewObject("type", "button", "class", "crudui-action crudui-action--text", "data-condition-action", action), escapeText(label))
}

func conditionSelectHTML(a *Object, choices []string, selected string) string {
	options := ""
	for _, choice := range choices {
		o := NewObject("value", choice)
		if choice == selected {
			o.Set("selected", "")
		}
		options += rawElement("option", o, escapeText(choice))
	}
	return rawElement("select", a, options)
}

// conditionNodeHTML writes one condition of the editor: a group, a field comparison or a judged text (CUMK-067).
func conditionNodeHTML(node, editor *Object) string {
	labels := object(read(editor, "labels"))
	path := stringAt(node, "path")
	remove := ""
	if path != "" {
		remove = conditionButtonHTML("remove", stringAt(labels, "remove"))
	}
	switch stringAt(node, "kind") {
	case "group":
		items := ""
		for _, item := range objectList(read(node, "items")) {
			items += rawElement("li", NewObject("class", "crudui-condition__item"), conditionNodeHTML(item, editor))
		}
		judge := ""
		if read(editor, "judge") == true {
			judge = conditionButtonHTML("add-judge", stringAt(labels, "addJudge"))
		}
		return rawElement("fieldset", NewObject("class", "crudui-condition__group", "data-condition-path", path),
			conditionSelectHTML(NewObject("class", "crudui-condition__mode", "data-condition-part", "mode", "aria-label", stringAt(labels, "mode")), []string{"all", "any"}, stringAt(node, "mode"))+
				rawElement("ol", NewObject("class", "crudui-condition__list"), items)+
				conditionButtonHTML("add-comparison", stringAt(labels, "addComparison"))+conditionButtonHTML("add-group", stringAt(labels, "addGroup"))+judge+remove)
	case "judge":
		return rawElement("div", NewObject("class", "crudui-condition__judge", "data-condition-path", path),
			inputHTML(NewObject("class", "crudui-condition__text", "data-condition-part", "judge", "value", stringAt(node, "text")), true)+remove)
	}
	field := stringAt(node, "field")
	var control string
	if names, ok := read(editor, "fields").([]any); ok {
		choices := []string{}
		for _, name := range names {
			choices = append(choices, scalar(name))
		}
		if !slices.Contains(choices, field) {
			choices = append([]string{field}, choices...)
		}
		control = conditionSelectHTML(NewObject("class", "crudui-condition__field", "data-condition-part", "field"), choices, field)
	} else {
		control = inputHTML(NewObject("class", "crudui-condition__field", "data-condition-part", "field", "value", field), true)
	}
	return rawElement("div", NewObject("class", "crudui-condition__comparison", "data-condition-path", path),
		control+conditionSelectHTML(NewObject("class", "crudui-condition__op", "data-condition-part", "op"), conditionOps, stringAt(node, "op"))+
			inputHTML(NewObject("class", "crudui-condition__value", "data-condition-part", "value", "value", stringAt(node, "value")), true)+remove)
}

// classes joins the nonempty class parts with single spaces.
func classes(parts ...string) string {
	out := []string{}
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, " ")
}

// flag renders a valueless boolean attribute.
func flag(name string, on bool) string {
	if on {
		return " " + name + `=""`
	}
	return ""
}
func controlsHTML(controls *Object) string {
	body := ""
	for _, a := range objectList(read(controls, "actions")) {
		unavailable := ""
		if read(a, "disabled") == true {
			unavailable = ` aria-disabled="true"`
		}
		body += "<button" + attrs(NewObject("type", "button", "class", "crudui-action", "data-crudui-action", stringAt(a, "name"), "aria-label", stringAt(a, "label")), false, false) + unavailable + "></button>"
	}
	return element("div", NewObject("class", "crudui-controls", "role", "group", "aria-label", stringAt(controls, "label")), body)
}
func headerHTML(vm *Object) string {
	header := read(vm, "header")
	expanded := read(vm, "expanded") == true
	parts := ""
	if read(vm, "collapsible") == true {
		a := NewObject("type", "button", "class", "crudui-action", "data-crudui-action", "toggle-row", "aria-expanded", strconv.FormatBool(expanded))
		if body := read(vm, "body"); has(body, "id") {
			a.Set("aria-controls", stringAt(body, "id"))
		}
		if has(vm, "toggleLabel") {
			a.Set("aria-label", stringAt(vm, "toggleLabel"))
		}
		parts += "<button" + attrs(a, false, false) + "></button>"
	}
	if has(header, "label") {
		if target := stringAt(header, "labelFor"); target != "" {
			parts += element("label", NewObject("class", "crudui-node__label", "for", target), escape(stringAt(header, "label")))
		} else {
			parts += element("span", NewObject("class", "crudui-node__label"), escape(stringAt(header, "label")))
		}
	}
	if has(header, "description") {
		parts += element("p", NewObject("class", "crudui-node__description"), escape(stringAt(header, "description")))
	}
	for _, part := range []string{"number", "title"} {
		if has(header, part) {
			parts += element("span", NewObject("class", "crudui-node__"+part), escape(stringAt(header, part)))
		}
	}
	if has(header, "summary") {
		parts += `<span class="crudui-node__summary"` + flag("hidden", expanded) + ">" + escape(stringAt(header, "summary")) + "</span>"
	}
	if has(header, "count") {
		parts += element("span", NewObject("class", "crudui-node__count"), escape(stringAt(header, "count")))
	}
	controls := read(vm, "controls")
	if stringAt(controls, "placement") == "header" {
		parts += controlsHTML(object(controls))
	}
	if parts == "" {
		return ""
	}
	return element("div", NewObject("class", classes("crudui-node__header", stringAt(header, "className")), "style", stringAt(header, "style")), parts)
}
func bodyHTML(vm *Object, errors map[*Object][]string) string {
	body := read(vm, "body")
	a := NewObject("class", classes("crudui-node__body", stringAt(body, "className")))
	for _, k := range []string{"style", "id"} {
		if has(body, k) {
			a.Set(k, stringAt(body, k))
		}
	}
	inner := ""
	if box := object(read(vm, "checkbox")); box != nil {
		input := NewObject("class", stringAt(box, "className"), "id", stringAt(box, "id"), "name", stringAt(box, "name"), "type", "checkbox")
		if has(box, "role") {
			input.Set("role", stringAt(box, "role"))
		}
		input.Set("value", "1")
		if read(box, "checked") == true {
			input.Set("checked", true)
		}
		merge(input, read(box, "attributes"))
		inner = inputHTML(input, false)
		// An inline layout writes the label in the header; the checkbox model then has no caption.
		if has(box, "caption") {
			inner += element("label", NewObject("for", stringAt(box, "id")), escape(stringAt(box, "caption")))
		}
	} else if w := object(read(vm, "widget")); w != nil {
		inner = renderWidget(w)
	} else {
		inner = nodesHTML(objectList(read(vm, "children")), errors)
	}
	return "<div" + attrs(a, false, false) + flag("hidden", read(vm, "collapsible") == true && read(vm, "expanded") != true) + ">" + inner + "</div>"
}

// nodeHTML renders one node of the recursive form grammar with its header, body, errors and
// footer slots; errors holds the error texts of the nodes that have errors.
func nodeHTML(vm *Object, errors map[*Object][]string) string {
	kind := stringAt(vm, "kind")
	sticky := ""
	if read(vm, "sticky") == true {
		sticky = "crudui-node--sticky"
	}
	a := NewObject("class", classes("crudui-node", "crudui-node--"+kind, sticky, stringAt(vm, "className")))
	if read(vm, "sticky") == true {
		// A sticky row carries its depth on the root; the stylesheet derives its sticky line from it.
		depth := stringAt(vm, "stickyDepth")
		if depth == "" {
			depth = "0"
		}
		styles := []string{}
		if st := stringAt(vm, "style"); st != "" {
			styles = append(styles, st)
		}
		a.Set("style", strings.Join(append(styles, "--crudui-sticky-depth: "+depth), "; "))
	} else if has(vm, "style") {
		a.Set("style", stringAt(vm, "style"))
	}
	if kind != "row" && kind != "lang-item" && has(vm, "path") {
		a.Set("data-field-path", stringAt(vm, "path"))
	}
	if has(vm, "key") {
		a.Set("data-crudui-row-key", stringAt(vm, "key"))
	}
	if has(vm, "lang") {
		a.Set("data-lang", stringAt(vm, "lang"))
	}
	footer := ""
	if controls := read(vm, "controls"); stringAt(controls, "placement") == "footer" {
		footer = element("div", NewObject("class", "crudui-node__footer"), controlsHTML(object(controls)))
	}
	header := headerHTML(vm)
	if read(vm, "sticky") == true && header != "" {
		header = element("div", NewObject("class", "crudui-node__header-container"), header)
	}
	return "<div" + attrs(a, false, false) + flag("hidden", read(vm, "hidden") == true) + attrs(object(read(vm, "attributes")), false, false) + ">" + header + bodyHTML(vm, errors) + errorsHTML("crudui-node", errors[vm]) + footer + "</div>"
}
func nodesHTML(nodes []*Object, errors map[*Object][]string) string {
	var out strings.Builder
	for _, n := range nodes {
		out.WriteString(nodeHTML(n, errors))
	}
	return out.String()
}

// RenderForm renders one instance as the complete form without changing its template or data
// (form-runtime.md, "Complete form"). options is nil or an object with the optional members
// action, hidden, formErrors and errors; nil writes the crudui-form block alone.
func RenderForm(form *Form, options any) (string, error) {
	if form == nil {
		return "", inputError("Form instance is required")
	}
	model, e := formRenderModel(form.fields, form.template.Action, options)
	if e != nil {
		return "", e
	}
	language := "ko"
	if s, ok := form.options.Language.(string); ok {
		language = s
	}
	m, e := messagesFor(language)
	if e != nil {
		return "", e
	}
	evaluated, e := bindButtons(form.template.Buttons, form.data, language, m)
	if e != nil {
		return "", e
	}
	buttons, e := FormButtonsHTML(evaluated)
	if e != nil {
		return "", e
	}
	footer := element("div", NewObject("class", "crudui-form__footer"),
		element("div", NewObject("class", "crudui-controls", "role", "group", "aria-label", m.formActions), buttons))
	description := ""
	if text := translate(form.template.Description, language); text != "" {
		description = element("p", NewObject("class", "crudui-form__description"), escape(text))
	}
	block := `<div class="crudui-form">` + description + errorsHTML("crudui-form", model.formErrors) + `<div class="crudui-form__body">` + nodesHTML(form.fields, model.nodeErrors) + `</div>` + footer + `</div>`
	if model.form == nil {
		return block, nil
	}
	hidden := ""
	for _, pair := range model.hidden {
		hidden += inputHTML(NewObject("type", "hidden", "name", pair[0], "value", pair[1]), false)
	}
	return element("form", model.form, hidden+block), nil
}

var javascriptProtocolRE = regexp.MustCompile(`(?i)^[\x00-\x1f ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:`)

func sanitizeURL(value string) string {
	if javascriptProtocolRE.MatchString(value) {
		return "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
	}
	return value
}

func textContent(value string, raw bool) string {
	if raw {
		return escapeText(value)
	}
	return escape(value)
}

func ordinaryAttribute(name string) string {
	switch name {
	case "autocomplete":
		return "autoComplete"
	case "readonly":
		return "readOnly"
	case "maxlength":
		return "maxLength"
	case "minlength":
		return "minLength"
	case "colspan":
		return "colSpan"
	case "rowspan":
		return "rowSpan"
	default:
		return name
	}
}
