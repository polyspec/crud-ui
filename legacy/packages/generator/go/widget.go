package generator

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type widgetContext struct {
	spec   *Object
	value  any
	path   string
	design *Object
	state  bindState
}

func (c widgetContext) name() string             { return bracketName(c.path, c.state.options.KeyPrefix) }
func (c widgetContext) id() string               { return controlID(c.state.options.IDPrefix, c.path) }
func (c widgetContext) class(base string) string { return joinClass(base, nodeClass(c.design, "main")) }
func (c widgetContext) option(k, def string) string {
	v := read(read(c.spec, "options"), k)
	if v == nil || isAbsent(v) {
		return def
	}
	return scalar(v)
}
func (c widgetContext) dataAttrs() *Object {
	return NewObject("data-name", leafName(c.path, c.state.rows), "data-rule-name", ruleName(c.path, c.state.rows), "data-default", scalar(read(c.spec, "default")))
}
func (c widgetContext) translate(v any) string { return translate(v, c.state.language) }
func (c widgetContext) display() string        { return defaultString(c.value, read(c.spec, "default")) }
func (c widgetContext) behavior() *Object {
	o := NewObject()
	if b := object(read(c.spec, "behavior")); b != nil {
		for _, k := range b.Keys() {
			v := read(b, k)
			if object(v) != nil {
				v = read(v, "script")
			}
			if s, ok := v.(string); ok && s != "" {
				o.Set(k, s)
			}
		}
	}
	return o
}
func (c widgetContext) affix(k string) *Object {
	text := c.translate(read(c.spec, k))
	if text == "" {
		return nil
	}
	a := NewObject("text", text, "class", "crudui-widget__affix")
	if k == "prepend" {
		a.Set("class", joinClass("crudui-widget__affix", nodeClass(c.design, "prepend")))
		if s := styleString(nodeStyle(c.design, "prepend")); s != "" {
			a.Set("style", s)
		}
	}
	return a
}
func (c widgetContext) attrsStyle(a *Object) {
	if s := styleString(nodeStyle(c.design, "main")); s != "" {
		a.Set("style", s)
	}
}
func (c widgetContext) attrsPlaceholder(a *Object) {
	if p := c.translate(read(c.spec, "placeholder")); p != "" {
		a.Set("placeholder", p)
	}
}
func (c widgetContext) attrsBehaviorData(a *Object) { merge(a, c.behavior()); merge(a, c.dataAttrs()) }
func (c widgetContext) withAffixes(w *Object) *Object {
	for _, k := range []string{"prepend", "append"} {
		if a := c.affix(k); a != nil {
			w.Set(k, a)
		}
	}
	return w
}
func dynamicItems(v any) bool { return object(v) != nil && has(v, "model") }
func sourceAttrs(items any) *Object {
	relations := read(items, "relations")
	if relations == nil || isAbsent(relations) {
		relations = []any{}
	}
	// relations was checked by checkOrderedValue with the whole specification, so it is a supported
	// value with finite numbers.
	var b strings.Builder
	writeJSONText(&b, relations)
	return NewObject("data-source-model", stringAt(items, "model"), "data-source-method", stringAt(items, "method"), "data-source-table", stringAt(items, "table"), "data-source-relations", b.String())
}

// writeJSONText writes a checked JSON value as JSON.stringify writes it: each number as numberString
// writes it, and each string with only the quote, the backslash and the control characters escaped.
func writeJSONText(b *strings.Builder, v any) {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		b.WriteString(strconv.FormatBool(x))
	case string:
		writeJSONString(b, x)
	case []any:
		b.WriteByte('[')
		for i, item := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			writeJSONText(b, item)
		}
		b.WriteByte(']')
	case *Object:
		if x == nil {
			b.WriteString("null")
			return
		}
		b.WriteByte('{')
		for i, key := range x.Keys() {
			if i > 0 {
				b.WriteByte(',')
			}
			writeJSONString(b, key)
			b.WriteByte(':')
			member, _ := x.Get(key)
			writeJSONText(b, member)
		}
		b.WriteByte('}')
	default:
		number, ok := asNumber(x)
		if !ok {
			panic(fmt.Sprintf("writeJSONText: %T is no checked JSON value", v))
		}
		b.WriteString(numberString(number))
	}
}

// writeJSONString writes a string as JSON.stringify quotes it.
func writeJSONString(b *strings.Builder, s string) {
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
}
func (c widgetContext) options(selected []string, defaults *string) []*Object {
	out := []*Object{}
	items := read(c.spec, "items")
	if dynamicItems(items) {
		return out
	}
	entries := []choicePair{}
	if isChoiceList(items) {
		// Binding has checked the list and accepted appearance members only for choices and groups
		// only for a select field.
		entries, _ = choicePairs(items, true, true)
	} else {
		for _, k := range keys(items) {
			entries = append(entries, choicePair{k, item(items, k)})
		}
	}
	for _, entry := range entries {
		k, v := entry.value, entry.label
		label := c.translate(v)
		if label == "" {
			label = scalar(v)
		}
		checked := false
		for _, s := range selected {
			if s == k {
				checked = true
			}
		}
		out = append(out, NewObject("value", k, "label", label, "selected", checked, "isDefault", defaults != nil && *defaults == k))
	}
	return out
}
// placeholderOption is the one option of a select or search field with no option: value "" and the
// untranslated text select (CUSC-080).
func placeholderOption() *Object {
	return NewObject("value", "", "label", "select", "selected", false, "isDefault", false)
}

func widget(kind, layout, tag string, attrs *Object) *Object {
	w := NewObject("kind", kind, "layout", layout)
	if tag != "" {
		w.Set("tag", tag)
	}
	w.Set("attrs", attrs)
	return w
}

var widgetAliases = map[string]string{"string": "text", "integer": "number", "float": "number", "decimal": "number", "dropdown": "select", "selectbox": "select", "radio": "choice", "checkboxes": "multichoice", "checkcontainer": "multichoice", "datetime-local": "datetime", "html": "dummy", "static": "dummy", "cover-simple": "cover", "autocomplete": "search", "wysiwyg": "tinymce", "action": "button"}

// canonicalType returns the lowercase widget type of a field type, an alias resolved.
func canonicalType(typ string) string {
	kind := strings.ToLower(typ)
	if canonical, ok := widgetAliases[kind]; ok {
		kind = canonical
	}
	return kind
}

// choicesType reports whether a field type, or its alias, renders the choices layout.
func choicesType(typ string) bool {
	kind := canonicalType(typ)
	return kind == "choice" || kind == "multichoice"
}

var newlineRE = regexp.MustCompile(`\r\n|\n\r|\r|\n`)

func evalWidget(c widgetContext) *Object {
	kind := strings.ToLower(stringAt(c.spec, "type"))
	if canonical, ok := widgetAliases[kind]; ok {
		kind = canonical
	}
	name := c.name()
	a := NewObject()
	var w *Object
	switch kind {
	case "text", "email", "number":
		a = NewObject("type", kind, "name", name, "value", c.display())
		if kind == "number" {
			a.Set("step", "any")
		}
		a.Set("class", c.class("valid-target crudui-input"))
		c.attrsPlaceholder(a)
		c.attrsStyle(a)
		c.attrsBehaviorData(a)
		w = c.withAffixes(widget(kind, "widget", "input", a))
	case "range":
		// A range input takes the bounds and the step of its validate.range and validate.step
		// (docs/spec/form-markup.md, Range fields); compilation has checked them.
		rules := read(c.spec, "validate")
		bounds := list(read(rules, "range"))
		a = NewObject("type", "range", "name", name, "value", c.display(), "min", jsString(bounds[0]), "max", jsString(bounds[1]), "step", jsString(read(rules, "step")), "class", c.class("valid-target crudui-input crudui-input--range"))
		c.attrsStyle(a)
		c.attrsBehaviorData(a)
		w = c.withAffixes(widget(kind, "range", "input", a))
		w.Set("text", c.display())
	case "password":
		a = NewObject("type", "password", "name", name, "value", scalar(c.value), "class", c.class("valid-target crudui-input"))
		c.attrsStyle(a)
		merge(a, c.dataAttrs())
		w = widget(kind, "bare", "input", a)
	case "textarea":
		a = NewObject("name", name, "class", c.class("valid-target crudui-input"), "rows", "5")
		c.attrsStyle(a)
		c.attrsBehaviorData(a)
		w = c.withAffixes(widget(kind, "widget", "textarea", a))
		w.Set("text", c.display())
	case "condition":
		// A condition field holds the condition text of its tree, marked for the browser bindings
		// (docs/spec/form-markup.md, Condition fields).
		a = NewObject("name", name, "class", c.class("valid-target crudui-input crudui-input--condition"), "rows", "5", "data-crudui-value", "json")
		c.attrsStyle(a)
		c.attrsBehaviorData(a)
		a.Set("data-default", conditionText(read(c.spec, "default")))
		w = c.withAffixes(widget(kind, "widget", "textarea", a))
		shown := c.value
		if isAbsent(shown) {
			shown = read(c.spec, "default")
		}
		w.Set("text", conditionText(shown))
		if read(read(c.spec, "design"), "editor") == "structured" {
			// A structured editor (docs/spec/form-markup.md, Structured condition editor): the textarea keeps the
			// value, hidden while the editor shows it (CUMK-067), visible with a named error otherwise (CUMK-068).
			editor := conditionEditor(c, c.id(), shown)
			w.Set("layout", "condition")
			w.Set("condition", editor)
			if !editor.Has("error") {
				a.Set("hidden", "")
			}
		}
	case "hidden":
		a = NewObject("type", "hidden", "name", name, "value", c.display(), "class", c.class("valid-target"))
		merge(a, c.dataAttrs())
		w = widget(kind, "bare", "input", a)
	case "date", "datetime":
		inputType, layout := kind, "widget"
		v := dateValue(c.display())
		if kind == "datetime" {
			inputType, layout, v = "datetime-local", "bare", datetimeValue(c.display())
		}
		a = NewObject("type", inputType, "name", name, "value", v, "class", c.class("valid-target crudui-input"))
		c.attrsStyle(a)
		c.attrsBehaviorData(a)
		w = widget(kind, layout, "input", a)
		if kind == "date" {
			c.withAffixes(w)
		}
	case "select":
		items := read(c.spec, "items")
		dynamic := dynamicItems(items)
		base := "valid-target crudui-input crudui-input--select"
		if dynamic {
			base += " valid-target-async"
		}
		a = NewObject("name", name, "class", c.class(base))
		var source any = nil
		if dynamic {
			source = sourceAttrs(items)
			merge(a, source)
		}
		c.attrsStyle(a)
		c.attrsBehaviorData(a)
		w = c.withAffixes(widget(kind, "widget", "select", a))
		w.Set("source", source)
		options := c.options([]string{c.display()}, nil)
		if len(options) == 0 {
			options = []*Object{placeholderOption()}
		} else if isChoiceList(items) {
			// An option inside a choice list group has the group's position and translated label.
			for i, group := range choiceGroups(items) {
				if group != nil {
					label := c.translate(group.label)
					if label == "" {
						label = scalar(group.label)
					}
					options[i].Set("group", NewObject("index", group.index, "label", label))
				}
			}
		}
		w.Set("options", options)
	case "choice", "multichoice":
		items := read(c.spec, "items")
		dynamic := dynamicItems(items)
		class, label := "crudui-choices", "crudui-choices__label"
		if kind == "multichoice" {
			class = "crudui-choices crudui-choices--multiple"
		}
		// The choices element takes the class and style of design.group after its own class.
		a = NewObject("class", joinClass(class, nodeClass(c.design, "group")))
		if style := styleString(nodeStyle(c.design, "group")); style != "" {
			a.Set("style", style)
		}
		var source any = nil
		if dynamic {
			source = sourceAttrs(items)
			merge(a, source)
		}
		w = widget(kind, "choices", "", a)
		w.Set("source", source)
		w.Set("itemLabelClass", joinClass(label, nodeClass(c.design, "main")))
		selected := []string{}
		var def *string
		if kind == "choice" {
			v := read(c.spec, "default")
			if v != nil && !isAbsent(v) {
				if _, array := v.([]any); !array {
					s := scalar(v)
					def = &s
				}
			}
			selected = []string{c.display()}
		} else {
			v := c.value
			if isAbsent(v) {
				v = read(c.spec, "default")
			}
			if a, ok := v.([]any); ok {
				for _, e := range a {
					selected = append(selected, jsString(e))
				}
			} else if truthy(v) {
				selected = append(selected, jsString(v))
			}
		}
		options := c.options(selected, def)
		for i, o := range options {
			o.Set("id", c.id()+":"+strconv.Itoa(i))
			if isChoiceList(items) {
				choiceAppearance(o, object(list(items)[i]))
			}
		}
		w.Set("options", options)
		if !dynamic {
			inputName := name
			if kind == "multichoice" {
				inputName += "[]"
			}
			input := NewObject("name", inputName, "data-name", leafName(c.path, c.state.rows), "data-rule-name", ruleName(c.path, c.state.rows))
			for _, k := range []string{"onchange", "onclick"} {
				if k == "onclick" && kind != "choice" {
					continue
				}
				if v := read(c.behavior(), k); !isAbsent(v) {
					input.Set(k, v)
				}
			}
			w.Set("extra", NewObject("input", input))
		}
	case "dummy":
		v := c.value
		if isAbsent(v) {
			v = read(c.spec, "default")
		}
		items := read(c.spec, "items")
		if isChoiceList(items) {
			if x, ok := choiceLabel(items, scalar(v)); ok {
				v = x
			}
		} else if object(items) != nil && !dynamicItems(items) {
			if x := read(items, scalar(v)); !isAbsent(x) {
				v = x
			}
		}
		raw := scalar(v)
		if raw != "" && raw != "0" {
			raw = newlineRE.ReplaceAllString(raw, "<br />$0")
		}
		if cls := nodeClass(c.design, "main"); cls != "" {
			a.Set("class", cls)
		}
		c.attrsStyle(a)
		w = widget(kind, "display", "div", a)
		w.Set("rawHtml", raw)
	case "dummy-input":
		a = NewObject("type", "text", "name", name, "value", c.display(), "readonly", "", "class", c.class("crudui-input"))
		c.attrsPlaceholder(a)
		c.attrsStyle(a)
		a.Set("data-default", scalar(read(c.spec, "default")))
		w = c.withAffixes(widget(kind, "widget", "input", a))
	case "image", "file", "cover":
		class := "valid-target crudui-input crudui-input--file"
		accept := "*/*"
		if kind == "image" || kind == "cover" {
			accept = "image/*"
		}
		accept = c.option("accept", accept)
		if v, ok := read(read(c.spec, "validate"), "accept").(string); ok && v != "" {
			accept = v
		}
		file := NewObject("type", "file", "class", c.class(class))
		for _, k := range []string{"max_width", "min_width", "max_height", "min_height", "preview_max_width", "preview_max_height"} {
			file.Set("data-"+strings.ReplaceAll(k, "_", "-"), c.option(k, "0"))
		}
		if kind == "cover" {
			name += "[name]"
		}
		file.Set("name", name)
		file.Set("data-name", leafName(c.path, c.state.rows))
		file.Set("data-rule-name", ruleName(c.path, c.state.rows))
		merge(file, c.behavior())
		if kind != "cover" {
			file.Set("value", "")
		}
		file.Set("accept", accept)
		file.Set("id", c.id())
		extra := NewObject()
		if kind != "cover" {
			extra.Set("display", NewObject("type", "text", "class", "crudui-input", "value", "", "readonly", ""))
		}
		extra.Set("file", file)
		w = widget(kind, "file", "", a)
		w.Set("extra", extra)
		if p := c.affix("prepend"); p != nil {
			w.Set("prepend", p)
		}
	case "image-viewer":
		raw := "이미지가 없습니다."
		if values := list(c.value); len(values) > 0 {
			raw = ""
			height := ""
			if h := c.option("height", ""); h != "" {
				height = ` height="` + h + `"`
			}
			for _, v := range values {
				raw += `<img src="` + scalar(v) + `"` + height + `>`
			}
		}
		if cls := nodeClass(c.design, "main"); cls != "" {
			a.Set("class", cls)
		}
		w = widget(kind, "display", "div", a)
		w.Set("rawHtml", raw)
	case "search":
		w = searchWidget(c)
	case "tinymce", "summernote", "editorjs", "tui", "tagify", "tagify2":
		w = editorWidget(kind, c)
	case "button":
		a = NewObject("type", "button", "class", c.class("crudui-action crudui-action--text"))
		c.attrsStyle(a)
		a.Set("id", c.id())
		merge(a, c.behavior())
		w = widget(kind, "button", "button", a)
		text := ""
		if c.spec.Has("content") {
			text = c.translate(read(c.spec, "content"))
		}
		w.Set("text", text)
	default:
		return nil
	}
	if w != nil {
		tag := stringAt(w, "tag")
		if tag == "input" || tag == "select" || tag == "textarea" {
			object(read(w, "attrs")).Set("id", c.id())
		}
		appendDeclaredAttributes(w, declaredAttributes(read(c.spec, "design"), false))
	}
	return orderedWidget(w)
}

// appendDeclaredAttributes adds the declared control attributes after the attributes crudui writes
// on the control: attrs, extra.file of a file layout, or extra.option of a choices layout with
// option inputs.
func appendDeclaredAttributes(w *Object, attributes *Object) {
	if attributes == nil {
		return
	}
	extra := object(read(w, "extra"))
	if stringAt(w, "layout") == "choices" {
		if has(extra, "input") {
			extra.Set("option", attributes)
		}
		return
	}
	if file := object(read(extra, "file")); file != nil {
		merge(file, attributes)
		return
	}
	merge(object(read(w, "attrs")), attributes)
}

// widgetMembers lists the widget model members in their output order (docs/spec/form-runtime.md).
var widgetMembers = []string{"kind", "layout", "tag", "attrs", "text", "rawHtml", "source", "options", "itemLabelClass", "script", "styleChrome", "prepend", "append", "extra", "condition"}

// orderedWidget returns the widget with its members in output order.
func orderedWidget(w *Object) *Object {
	out := NewObject()
	for _, key := range widgetMembers {
		if value, ok := w.Get(key); ok {
			out.Set(key, value)
		}
	}
	for _, key := range w.Keys() {
		if !out.Has(key) {
			value, _ := w.Get(key)
			out.Set(key, value)
		}
	}
	return out
}
func searchWidget(c widgetContext) *Object {
	items := read(c.spec, "items")
	dynamic := dynamicItems(items)
	min, delay, api := c.option("keyword_min_length", "2"), c.option("delay", "250"), c.option("api_server", "")
	base := "valid-target crudui-input crudui-input--select"
	var source any = nil
	if dynamic {
		base += " valid-target-async"
		source = sourceAttrs(items)
	}
	a := NewObject("class", c.class(base))
	c.attrsStyle(a)
	a.Set("name", c.name())
	a.Set("data-keyword-min-length", min)
	a.Set("data-delay", delay)
	a.Set("data-api-server", api)
	merge(a, source)
	a.Set("data-name", leafName(c.path, c.state.rows))
	a.Set("data-rule-name", ruleName(c.path, c.state.rows))
	a.Set("id", c.id())
	if s := stringAt(c.behavior(), "onchange"); s != "" {
		a.Set("onchange", s)
	}
	a.Set("data-default", scalar(read(c.spec, "default")))
	w := c.withAffixes(widget("search", "search", "select", a))
	w.Set("source", source)
	options := c.options([]string{c.display()}, nil)
	if len(options) == 0 {
		options = []*Object{placeholderOption()}
	}
	w.Set("options", options)
	callback := ""
	if cb := c.option("callback", ""); cb != "" {
		callback = fmt.Sprintf("$(document.getElementById(%s)).on('select2:select', %s);", scriptString(c.id()), cb)
	}
	style := ""
	if c.option("hide_searching", "undefined") != "" {
		style = "[class~=" + scriptString(c.id()+"_select2") + "] .loading-results { display: none; }"
	}
	w.Set("styleChrome", style)
	w.Set("script", fmt.Sprintf("$(function() {select2(CSS.escape(%s), %s, %s, %s);%s});", scriptString(c.id()), scriptString(min), scriptString(delay), scriptString(c.id()+"_select2"), callback))
	return w
}
func editorWidget(kind string, c widgetContext) *Object {
	id := c.id()
	base, rows := "valid-target crudui-input", "3"
	tag := "textarea"
	if kind == "tinymce" {
		base += " tinymcearea"
	}
	if kind == "summernote" {
		base += " summernote"
		rows = "5"
	}
	if kind == "editorjs" {
		base += " contentjs"
	}
	if kind == "tui" {
		base += " tuiarea"
	}
	if kind == "tagify" || kind == "tagify2" {
		tag = "input"
	}
	a := NewObject()
	if tag == "input" {
		a.Set("type", "text")
	}
	a.Set("id", id)
	a.Set("class", c.class(base))
	a.Set("name", c.name())
	if tag == "textarea" {
		a.Set("rows", c.option("rows", rows))
	} else {
		a.Set("value", c.display())
		a.Set("data-max-tags", c.option("max_tags", "0"))
		if kind == "tagify2" {
			a.Set("data-server", c.option("server", ""))
		}
		c.attrsPlaceholder(a)
	}
	script := ""
	selector := "'#'+CSS.escape(" + scriptString(id) + ")"
	switch kind {
	case "tinymce":
		height, upload := c.option("height", "300"), c.option("fileserver", "upload")
		a.Set("data-type", stringAt(c.spec, "type"))
		a.Set("data-height", height)
		a.Set("data-upload-server", upload)
		script = fmt.Sprintf("$(function() {editor_tinymce(%s, %s, %s, false);});", selector, height, scriptString(upload))
	case "summernote":
		script = fmt.Sprintf("$(function() {editor_summernote(%s, %s);});", selector, scriptString(c.option("upload", "upload")))
	case "editorjs", "tui":
		server := c.option("fileserver", "")
		a.Set("data-fileserver", server)
		script = fmt.Sprintf("$(function() {editor_%s(%s, %s);});", kind, selector, scriptString(server))
	case "tagify":
		script = fmt.Sprintf("$(function() {editor_tagify(%s, %s);});", selector, c.option("max_tags", "0"))
	case "tagify2":
		script = fmt.Sprintf("$(function() {editor_tagify2(%s, %s, %s);});", selector, c.option("max_tags", "0"), scriptString(c.option("server", "")))
	}
	c.attrsBehaviorData(a)
	w := widget(kind, "host-script", tag, a)
	if tag == "textarea" {
		w.Set("text", c.display())
	}
	w.Set("script", script)
	return w
}

func scriptString(value string) string {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	// Encoding a string into a bytes.Buffer cannot fail.
	if e := enc.Encode(value); e != nil {
		panic(fmt.Sprintf("scriptString: encode of a string: %v", e))
	}
	return strings.ReplaceAll(strings.TrimSuffix(b.String(), "\n"), "<", `\u003c`)
}
