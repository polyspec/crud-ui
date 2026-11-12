package generator

import (
	"strconv"
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

// boundOptions holds the resolved text options of one binding.
type boundOptions struct {
	IDPrefix, KeyPrefix, Unsupported string
	// Collapsed holds the row paths rendered collapsed.
	Collapsed map[string]bool
}

type bindState struct {
	data     *Object
	lookup   map[string]any
	options  boundOptions
	language string
	messages formMessages
	// rows holds repeated path segment positions, numbers the one-based positions of the enclosing rows.
	rows    []int
	numbers []int
	// stickyDepth counts enclosing rows with a sticky header.
	stickyDepth int
	// layout is "inline" when the field nodes take the inline layout of an enclosing group.
	layout string
}

// declaredLayout returns the design.layout a group declares, "" when it declares none.
func declaredLayout(spec *Object, path string) (string, error) {
	return optionalString(read(read(spec, "design"), "layout"), "design.layout at "+path)
}

// layoutState returns the state of a group's children: a declared layout replaces the inherited
// one, and a line or stacked layout ends it.
func layoutState(s bindState, layout string) bindState {
	if layout == "" {
		return s
	}
	s.layout = ""
	if layout == "inline" {
		s.layout = "inline"
	}
	return s
}

// checkedBinding checks the text of a template, a record and the options, the order of the record and the kind
// of the template, in that order, and returns the record (an empty one for none) to bind.
func checkedBinding(template *FormTemplate, data *Object, options BindOptions) (*Object, error) {
	if e := CheckBindText(template, data, options); e != nil {
		return nil, e
	}
	if e := checkOrderedValue(data); e != nil {
		return nil, e
	}
	if template == nil || template.Kind != "crudui/form-template" {
		return nil, inputError("Unsupported form template")
	}
	if data == nil {
		data = NewObject()
	}
	return data, nil
}

// BindForm creates the node models of the form grammar without changing the template or record.
func BindForm(template *FormTemplate, data *Object, options BindOptions) ([]*Object, error) {
	data, e := checkedBinding(template, data, options)
	if e != nil {
		return nil, e
	}
	// Nil selects each default. Type errors come in option order, before a supported-language check.
	language, e := bindLanguage(options)
	if e != nil {
		return nil, e
	}
	bound := boundOptions{IDPrefix: "crudui", KeyPrefix: template.KeyPrefix, Unsupported: "throw"}
	for _, option := range []struct {
		name   string
		value  any
		target *string
	}{{"keyPrefix", options.KeyPrefix, &bound.KeyPrefix}, {"idPrefix", options.IDPrefix, &bound.IDPrefix}} {
		if option.value == nil {
			continue
		}
		s, ok := option.value.(string)
		if !ok {
			return nil, inputError("%s must be a string", option.name)
		}
		*option.target = s
	}
	if options.Unsupported != nil {
		unsupported, ok := options.Unsupported.(string)
		if !ok || (unsupported != "throw" && unsupported != "marker") {
			return nil, inputError("unsupported must be throw or marker")
		}
		bound.Unsupported = unsupported
	}
	bound.Collapsed = map[string]bool{}
	for _, row := range options.Collapsed {
		bound.Collapsed[row] = true
	}
	messages, e := messagesFor(language)
	if e != nil {
		return nil, e
	}
	s := bindState{data: data, lookup: plainObject(data), options: bound, language: language, messages: messages}
	return buildChildren(template.Fields, "", s)
}
func buildChildren(fields []FieldTemplate, path string, s bindState) ([]*Object, error) {
	out := []*Object{}
	for _, f := range fields {
		p := f.Name
		if path != "" {
			p = path + "." + f.Name
		}
		v, e := buildField(f, p, s)
		if e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, nil
}

// checkGroupData requires present group data, including a repeated group row, to be an object.
func checkGroupData(value any, path string) error {
	if !isAbsent(value) && object(value) == nil {
		return inputError("Group data must be an object: %s", path)
	}
	return nil
}
func repeated(f FieldTemplate) bool {
	return repeatedSpec(f.Spec)
}

// repeatedSpec reports a field declared multiple: true, only or an object.
func repeatedSpec(spec *Object) bool {
	v := read(spec, "multiple")
	return v == true || v == "only" || object(v) != nil
}

// dataOnly reports a collection declared multiple: only or multiple.only: true, whose rows come
// only from the data.
func dataOnly(spec *Object) bool {
	v := read(spec, "multiple")
	return v == "only" || read(object(v), "only") == true
}

// multiple holds the evaluated controls and limits of a repeated field.
type multiple struct {
	min, max       float64
	hasMin, hasMax bool
	copy, sortable bool
	// only marks rows that come only from the data.
	only     bool
	title    string
	hasTitle bool
	controls string
	header   string
}

func multipleSettings(spec *Object) *multiple {
	v := read(spec, "multiple")
	if v == true || v == "only" {
		return &multiple{only: v == "only", controls: "header", header: "static"}
	}
	o := object(v)
	if o == nil {
		return nil
	}
	m := &multiple{copy: read(o, "copy") == true, sortable: read(o, "sortable") == true, only: read(o, "only") == true, controls: "header", header: "static"}
	m.min, m.hasMin = asNumber(read(o, "min"))
	m.max, m.hasMax = asNumber(read(o, "max"))
	m.title, m.hasTitle = read(o, "title").(string)
	if c, ok := read(o, "controls").(string); ok && (c == "footer" || c == "outline") {
		m.controls = c
	}
	if read(o, "header") == "sticky" {
		m.header = "sticky"
	}
	return m
}
func makeWidget(spec *Object, value any, path string, design *Object, s bindState) (*Object, error) {
	// A group source lists the rows of its group in the data as a choice list; compilation has checked the source
	// (docs/spec/schema.md, Choices from a repeated group).
	if source, ok := validate.GroupSourceItems(read(spec, "items")); ok {
		withChoices, err := withGroupChoices(spec, source, s.data)
		if err != nil {
			return nil, err
		}
		spec = withChoices
	}
	if items := read(spec, "items"); isChoiceList(items) {
		// Only the choices of a choice or multichoice field declare their appearance, and only the
		// choice list of a select field has groups.
		appearance := choicesType(stringAt(spec, "type"))
		if _, ok := choicePairs(items, appearance, canonicalType(stringAt(spec, "type")) == "select"); !ok {
			return nil, inputError("Invalid items at %s: expected %s", path, choiceListExpected)
		}
		if appearance {
			if e := checkChoiceAppearance(items, path); e != nil {
				return nil, e
			}
		}
	}
	w := evalWidget(widgetContext{spec: spec, value: value, path: path, design: design, state: s})
	if w != nil {
		return w, nil
	}
	if s.options.Unsupported != "throw" {
		return NewObject("unsupported", true, "type", stringAt(spec, "type")), nil
	}
	return nil, &UnsupportedFieldTypeError{Type: stringAt(spec, "type"), Path: path}
}

// withGroupChoices returns a copy of spec whose items are the choice list of the group source for the record data,
// one {value, label} pair per choice, the literal choices first; the template keeps its group source. A row that repeats
// a literal choice returns the input failure of the validator (CUSC-089).
func withGroupChoices(spec *Object, source *Object, data *Object) (*Object, error) {
	choices, err := validate.GroupChoices(source, data)
	if err != nil {
		return nil, err
	}
	items := make([]any, 0, len(choices))
	for _, choice := range choices {
		items = append(items, NewObject("value", choice.Value, "label", choice.Label))
	}
	copied := copyObject(spec)
	copied.Set("items", items)
	return copied, nil
}

// declaredAttributes returns a copy of the declared control attributes (design.attributes) or,
// with wrapper, the node root attributes (design.wrapper.attributes); nil when none is declared.
func declaredAttributes(design any, wrapper bool) *Object {
	source := read(design, "attributes")
	if wrapper {
		source = read(read(design, "wrapper"), "attributes")
	}
	o := object(source)
	if o == nil || len(o.Keys()) == 0 {
		return nil
	}
	return copyObject(o)
}

// nodeRoot starts a node with its kind, path, design.wrapper appearance and declared attributes.
func nodeRoot(kind, path string, d *Object, spec *Object) *Object {
	vm := NewObject("kind", kind, "path", path, "className", nodeClass(d, "wrapper"))
	if st := styleString(nodeStyle(d, "wrapper")); st != "" {
		vm.Set("style", st)
	}
	if attributes := declaredAttributes(read(spec, "design"), true); attributes != nil {
		vm.Set("attributes", attributes)
	}
	vm.Set("hidden", read(d, "show") != true)
	return vm
}

// setHeader adds a header from alternating part names and values, omitting empty parts and an empty header.
func setHeader(vm *Object, d *Object, parts ...string) {
	header := NewObject("className", nodeClass(d, "label"))
	if st := styleString(nodeStyle(d, "label")); st != "" {
		header.Set("style", st)
	}
	present := false
	for i := 0; i < len(parts); i += 2 {
		if parts[i+1] != "" {
			header.Set(parts[i], parts[i+1])
			present = true
		}
	}
	if present {
		vm.Set("header", header)
	}
}
func nodeBody(className, style, id string) *Object {
	body := NewObject("className", className)
	if st := styleString(style); st != "" {
		body.Set("style", st)
	}
	if id != "" {
		body.Set("id", id)
	}
	return body
}
func actionModel(name, label string, disabled bool) *Object {
	return NewObject("name", name, "label", label, "disabled", disabled)
}

// labelTarget returns the control identifier a field label targets.
func labelTarget(w *Object) string {
	if read(w, "unsupported") == true {
		return ""
	}
	if file := read(read(w, "extra"), "file"); has(file, "id") && read(file, "id") != nil {
		return stringAt(file, "id")
	}
	return stringAt(read(w, "attrs"), "id")
}
func buildField(f FieldTemplate, path string, s bindState) (*Object, error) {
	spec := f.Spec
	d, e := resolveDesign(read(spec, "design"), s.lookup, parsePath(path), s.rows)
	if e != nil {
		return nil, e
	}
	label, description := "", ""
	if truthy(read(spec, "label")) {
		label = translate(read(spec, "label"), s.language)
	}
	if truthy(read(spec, "description")) {
		description = translate(read(spec, "description"), s.language)
	}
	if m := multipleSettings(spec); m != nil {
		return buildCollection(f, path, d, label, description, m, s)
	}
	if stringAt(spec, "type") == "group" {
		return buildGroup(f, path, d, label, description, s)
	}
	if l := read(spec, "lang"); l == true || object(l) != nil {
		return buildLang(spec, path, d, label, description, l, s)
	}
	return buildLeaf(spec, path, d, label, description, s)
}
func buildLeaf(spec *Object, path string, d *Object, label, description string, s bindState) (*Object, error) {
	typ := stringAt(spec, "type")
	value := getPath(s.data, path)
	vm := nodeRoot("field", path, d, spec)
	// A field node of an inline layout is one row of a label column and a control column.
	if s.layout == "inline" {
		vm.Set("className", joinClass("crudui-node--inline", stringAt(vm, "className")))
	}
	if typ == "checkbox" || typ == "switcher" {
		effective := value
		if isAbsent(effective) {
			effective = read(spec, "default")
		}
		checked := effective == true || effective == float64(1) || effective == 1 || effective == "1"
		id := controlID(s.options.IDPrefix, path)
		// An inline layout writes the label in the label column of the header instead of the caption.
		headerLabel := s.layout == "inline" && label != ""
		if headerLabel {
			setHeader(vm, d, "label", label, "labelFor", id, "description", description)
		} else {
			setHeader(vm, d, "description", description)
		}
		vm.Set("body", nodeBody("", "", ""))
		// A switcher is a checkbox input announced and drawn as a switch.
		switcher := typ == "switcher"
		control := ""
		if switcher {
			control = "crudui-input crudui-input--switch"
		}
		checkbox := NewObject("id", id, "name", bracketName(path, s.options.KeyPrefix), "className", joinClass("valid-target", control, nodeClass(d, "main")), "checked", checked)
		if switcher {
			checkbox.Set("role", "switch")
		}
		if !headerLabel {
			checkbox.Set("caption", label)
		}
		if attributes := declaredAttributes(read(spec, "design"), false); attributes != nil {
			checkbox.Set("attributes", attributes)
		}
		vm.Set("checkbox", checkbox)
		return vm, nil
	}
	w, e := makeWidget(spec, value, path, d, s)
	if e != nil {
		return nil, e
	}
	if typ != "hidden" {
		labelFor := ""
		if label != "" {
			labelFor = labelTarget(w)
		}
		setHeader(vm, d, "label", label, "labelFor", labelFor, "description", description)
	}
	vm.Set("body", nodeBody("", "", ""))
	vm.Set("widget", w)
	return vm, nil
}
func buildGroup(f FieldTemplate, path string, d *Object, label, description string, s bindState) (*Object, error) {
	if e := checkGroupData(getPath(s.data, path), path); e != nil {
		return nil, e
	}
	vm := nodeRoot("group", path, d, f.Spec)
	layout, e := declaredLayout(f.Spec, path)
	if e != nil {
		return nil, e
	}
	// A line group is one row in an inline layout, and its children take no inline layout.
	if layout == "line" {
		inline := ""
		if s.layout == "inline" {
			inline = "crudui-node--inline"
		}
		vm.Set("className", joinClass(inline, "crudui-node--line", stringAt(vm, "className")))
	}
	setHeader(vm, d, "label", label, "description", description)
	vm.Set("body", nodeBody(nodeClass(d, "group"), nodeStyle(d, "group"), ""))
	children, e := buildChildren(f.Children, path, layoutState(s, layout))
	if e != nil {
		return nil, e
	}
	vm.Set("children", children)
	return vm, nil
}
func buildCollection(f FieldTemplate, path string, d *Object, label, description string, m *multiple, s bindState) (*Object, error) {
	var keys []string
	switch value := getPath(s.data, path); {
	case isAbsent(value) && m.only:
		keys = []string{}
	case isAbsent(value):
		keys = []string{"__0000000000000__"}
	case object(value) != nil:
		keys = object(value).Keys()
	default:
		return nil, inputError("Repeated data must be a keyed object: %s", path)
	}
	item := "field"
	if stringAt(f.Spec, "type") == "group" {
		item = "group"
	}
	rowsState := s
	if item == "group" {
		layout, e := declaredLayout(f.Spec, path)
		if e != nil {
			return nil, e
		}
		rowsState = layoutState(s, layout)
	}
	rows := []*Object{}
	for i, key := range keys {
		row, e := buildRow(f, path, key, i, len(keys), item, label, m, rowsState)
		if e != nil {
			return nil, e
		}
		rows = append(rows, row)
	}
	vm := nodeRoot("collection", path, d, f.Spec)
	setHeader(vm, d, "label", label, "description", description, "count", formatCount(s.messages.count, len(keys)))
	vm.Set("body", nodeBody("", "", ""))
	vm.Set("item", item)
	if len(keys) == 0 && !m.only {
		full := m.hasMax && 0 >= m.max
		vm.Set("controls", NewObject("placement", "footer", "label", s.messages.collectionControls, "actions", []*Object{actionModel("add-row", s.messages.addRow, full)}))
	}
	vm.Set("children", rows)
	return vm, nil
}
func buildRow(f FieldTemplate, collectionPath, key string, index, count int, item, label string, m *multiple, s bindState) (*Object, error) {
	msg := s.messages
	rowPath := collectionPath + "." + key
	rd, e := resolveDesign(read(f.Spec, "design"), s.lookup, parsePath(rowPath), append(append([]int{}, s.rows...), len(parsePath(collectionPath))))
	if e != nil {
		return nil, e
	}
	sticky := m.header == "sticky"
	rowState := s
	rowState.rows = append(append([]int{}, s.rows...), len(parsePath(collectionPath)))
	rowState.numbers = append(append([]int{}, s.numbers...), index+1)
	if sticky {
		rowState.stickyDepth++
	}
	vm := NewObject("kind", "row", "key", key, "className", "", "hidden", false)
	// Rows that come only from the data have no row controls.
	if !m.only {
		full := m.hasMax && float64(count) >= m.max
		actions := []*Object{}
		if m.sortable {
			actions = append(actions, actionModel("move-up", msg.moveUp, index == 0), actionModel("move-down", msg.moveDown, index == count-1))
		}
		actions = append(actions, actionModel("add-row", msg.addRow, full))
		if m.copy {
			actions = append(actions, actionModel("copy-row", msg.copyRow, full))
		}
		actions = append(actions, actionModel("remove-row", msg.removeRow, m.hasMin && float64(count) <= m.min))
		vm.Set("controls", NewObject("placement", m.controls, "label", msg.rowControls, "actions", actions))
	}
	if sticky {
		vm.Set("sticky", true)
		vm.Set("stickyDepth", s.stickyDepth)
	}
	numbers := make([]string, len(rowState.numbers))
	for i, n := range rowState.numbers {
		numbers[i] = strconv.Itoa(n)
	}
	header := NewObject("className", "")
	if label != "" {
		header.Set("label", label)
	}
	header.Set("number", strings.Join(numbers, "."))
	vm.Set("header", header)
	if item == "field" {
		w, e := makeWidget(f.Spec, getPath(s.data, rowPath), rowPath, rd, rowState)
		if e != nil {
			return nil, e
		}
		vm.Set("body", nodeBody("", "", ""))
		vm.Set("widget", w)
		return vm, nil
	}
	if e := checkGroupData(getPath(s.data, rowPath), rowPath); e != nil {
		return nil, e
	}
	children, e := buildChildren(f.Children, rowPath, rowState)
	if e != nil {
		return nil, e
	}
	summary := msg.collapsed
	nested, total := false, 0
	for _, child := range children {
		if stringAt(child, "kind") == "collection" {
			nested = true
			total += len(objectList(read(child, "children")))
		}
	}
	if nested {
		summary = formatCount(msg.children, total)
	}
	if m.hasTitle {
		v := getPath(s.data, rowPath+"."+m.title)
		if isAbsent(v) || v == nil || v == "" {
			header.Set("title", msg.untitled)
		} else {
			header.Set("title", jsString(v))
		}
	}
	header.Set("summary", summary)
	vm.Set("body", nodeBody(nodeClass(rd, "group"), nodeStyle(rd, "group"), controlID(s.options.IDPrefix, rowPath)+":body"))
	vm.Set("collapsible", true)
	vm.Set("expanded", !s.options.Collapsed[rowPath])
	vm.Set("toggleLabel", msg.toggleRow)
	vm.Set("children", children)
	return vm, nil
}
func buildLang(spec *Object, path string, d *Object, label, description string, l any, s bindState) (*Object, error) {
	langs := []any{"ko", "en", "ja", "zh"}
	if a := list(read(l, "only")); len(a) > 0 {
		langs = a
	}
	frame := ""
	if read(l, "frame") != false {
		frame = "crudui-node--framed"
	}
	groupClass, e := optionalString(read(l, "group_class"), "lang group_class at "+path)
	if e != nil {
		return nil, e
	}
	title := ""
	if truthy(read(l, "title")) {
		title = translate(read(l, "title"), s.language)
	}
	vm := nodeRoot("lang", path, d, spec)
	// A framed language group is a node modifier; the stylesheet draws the frame around its body.
	vm.Set("className", joinClass(frame, stringAt(vm, "className")))
	setHeader(vm, d, "label", label, "description", description, "title", title)
	vm.Set("body", nodeBody(joinClass(groupClass), "", ""))
	children := []*Object{}
	for _, code := range langs {
		p := path + "." + jsString(code)
		ld, e := resolveDesign(read(spec, "design"), s.lookup, parsePath(p), s.rows)
		if e != nil {
			return nil, e
		}
		w, e := makeWidget(spec, getPath(s.data, p), p, ld, s)
		if e != nil {
			return nil, e
		}
		children = append(children, NewObject("kind", "lang-item", "lang", code, "className", "", "hidden", false, "header", NewObject("className", "", "label", code), "body", nodeBody("", "", ""), "widget", w))
	}
	vm.Set("children", children)
	return vm, nil
}
