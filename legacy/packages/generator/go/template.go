// Package generator compiles, binds and renders CRUDUI forms and lists in Go.
package generator

import (
	"encoding/json"
	"fmt"
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
	"github.com/polyspec/crudui/packages/validator/go/validator/validate"
	"slices"
	"strconv"
	"strings"
)

// FieldTemplate stores one resolved field specification and its ordered children.
type FieldTemplate struct {
	Name     string          `json:"name"`
	Spec     *Object         `json:"spec"`
	Children []FieldTemplate `json:"children"`
}

// FormTemplate stores reusable structure without record data.
type FormTemplate struct {
	Kind      string          `json:"kind"`
	KeyPrefix string          `json:"keyPrefix,omitempty"`
	Fields    []FieldTemplate `json:"fields"`
	// Buttons lists the form buttons in declaration order; one submit button when the spec declares none.
	Buttons []*Object `json:"buttons"`
	// Action is the submission target declared by the spec, kept unchanged in the template.
	Action *Object `json:"action,omitempty"`
	// Description is the root description content as the spec declares it, translated when the
	// form is rendered. It is a template member when the root declares description.
	Description         any `json:"description,omitempty"`
	keyPrefixProvided   bool
	descriptionProvided bool
}

// CompileOptions supplies composition files and the optional form-name prefix.
type CompileOptions struct {
	Files             map[string]*Object
	Loader            compose.FileLoader
	Basepath          string
	KeyPrefix         string
	KeyPrefixProvided bool
}

// BindOptions selects control IDs, content and interface language, form-name prefix and unsupported-field handling.
// Each option is nil for its default; decoded JSON of another type or value is rejected.
type BindOptions struct {
	// IDPrefix defaults to crudui.
	IDPrefix any
	// Language defaults to ko and must be ko, en, ja or zh, so an empty string is rejected.
	Language any
	// KeyPrefix defaults to the template prefix; an empty string removes it.
	KeyPrefix any
	// Unsupported is throw (default) or marker, which renders unsupported fields as markers.
	Unsupported any
	// Collapsed lists the row paths {collection}.{key} rendered collapsed; the other rows are expanded.
	Collapsed []string
}

// CompileForm resolves field composition without binding record data.
func CompileForm(spec *Object, options CompileOptions) (*FormTemplate, error) {
	// Input text is checked first (docs/spec/input-text.md).
	loader, e := checkSpecText(spec, options.Files, options.Loader)
	if e != nil {
		return nil, e
	}
	if e := checkInputText(text.Input{Name: "options.basepath", Value: options.Basepath}, text.Input{Name: "options.keyPrefix", Value: options.KeyPrefix}); e != nil {
		return nil, e
	}
	if e := checkOrderedValue(spec); e != nil {
		return nil, e
	}
	spec = orderedObject(spec)
	if spec == nil || stringAt(spec, "type") != "group" || object(read(spec, "properties")) == nil {
		return nil, inputError("A form spec must be a group with properties")
	}
	if e := checkFormDeclarations(spec); e != nil {
		return nil, e
	}
	// The form root takes no layout; a group field declares it (docs/spec/schema.md, Layout).
	if has(read(spec, "design"), "layout") {
		return nil, inputError("Invalid design.layout at form: unknown key")
	}
	p, e := compose.ComposeProperties(object(read(spec, "properties")), loader, compose.ComposeOptions{Basepath: options.Basepath})
	if e != nil {
		return nil, e
	}
	fields, e := compileFields(p, p, "")
	if e != nil {
		return nil, e
	}
	buttons := []*Object{NewObject("type", "submit")}
	if declared, ok := read(spec, "buttons").([]any); ok {
		buttons = []*Object{}
		// checkFormDeclarations has checked that every button is an object.
		for _, button := range declared {
			buttons = append(buttons, copyObject(object(button)))
		}
	}
	var action *Object
	if declared := object(read(spec, "action")); declared != nil {
		action = copyObject(declared)
	}
	var description any
	if spec.Has("description") {
		description = copyValue(read(spec, "description"))
	}
	return &FormTemplate{Kind: "crudui/form-template", KeyPrefix: options.KeyPrefix, keyPrefixProvided: options.KeyPrefixProvided || options.KeyPrefix != "", Fields: fields, Buttons: buttons, Action: action, Description: description, descriptionProvided: spec.Has("description")}, nil
}

// checkFormDeclarations rejects a wrong root action or buttons declaration.
func checkFormDeclarations(spec *Object) error {
	fail := func(key, expected string) error {
		return inputError("Invalid %s at form: expected %s", key, expected)
	}
	if spec.Has("action") {
		action := object(read(spec, "action"))
		if action == nil {
			return fail("action", "an object")
		}
		for _, key := range []string{"method", "url", "enctype"} {
			if _, ok := read(action, key).(string); action.Has(key) && !ok {
				return fail("action."+key, "a string")
			}
		}
	}
	if !spec.Has("buttons") {
		return nil
	}
	declared, ok := read(spec, "buttons").([]any)
	if !ok {
		return fail("buttons", "a list of buttons")
	}
	for index, value := range declared {
		key := "buttons." + strconv.Itoa(index)
		button := object(value)
		if button == nil {
			return fail(key, "an object")
		}
		kind, isString := read(button, "type").(string)
		if !isString || !formButtonTypes[kind] {
			return fail(key+".type", "submit, reset, button or link")
		}
		for _, name := range []string{"name", "value", "href"} {
			if _, ok := read(button, name).(string); button.Has(name) && !ok {
				return fail(key+"."+name, "a string")
			}
		}
		// A button type without interface text needs declared text.
		if buttonText(messageTables["ko"], kind) == "" && !button.Has("text") {
			return fail(key+".text", "content for this button type")
		}
		if kind == "link" && !button.Has("href") {
			return fail(key+".href", "a link target")
		}
		if e := checkDeclarations(button, "form."+key, false); e != nil {
			return e
		}
	}
	return nil
}

// compileFields resolves the fields of p in declaration order, each field's children after it. root is the composed
// properties of the form, which a group source reads.
func compileFields(p *Object, root *Object, parent string) ([]FieldTemplate, error) {
	out := []FieldTemplate{}
	if p == nil {
		return out, nil
	}
	for _, name := range p.Keys() {
		raw := object(read(p, name))
		if raw == nil {
			continue
		}
		path := name
		if parent != "" {
			path = parent + "." + name
		}
		if e := checkDeclarations(raw, path, true); e != nil {
			return nil, e
		}
		// A group source is checked after the other declarations of the field (docs/spec/schema.md, Choices from a
		// repeated group).
		if message := validate.GroupSourceFailure(raw, path, root); message != "" {
			return nil, &validate.FormInputError{Message: message}
		}
		children, e := compileFields(object(read(raw, "properties")), root, path)
		if e != nil {
			return nil, e
		}
		s := copyObject(raw)
		s.Delete("properties")
		out = append(out, FieldTemplate{Name: name, Spec: s, Children: children})
	}
	return out, nil
}

// conditionValue reports a string or a condition map, which is a non-empty object.
func conditionValue(v any) bool {
	if _, ok := v.(string); ok {
		return true
	}
	o := object(v)
	return o != nil && len(o.Keys()) > 0
}

// scalarChild reports a child that renders one scalar value: not repeated, not a group and not a language field.
func scalarChild(v any) bool {
	child := object(v)
	if child == nil {
		return false
	}
	multiple, lang := read(child, "multiple"), read(child, "lang")
	repeated := multiple == true || multiple == "only" || object(multiple) != nil
	language := lang == true || object(lang) != nil
	return stringAt(child, "type") != "group" && !child.Has("properties") && !repeated && !language
}

// closedKeys lists the keys each closed declaration bucket allows.
var closedKeys = map[string][]string{
	"multiple": {"only", "min", "max", "copy", "sortable", "title", "controls", "header", "onclick", "keys"},
	// multiple.only: true combines with title, header and keys only.
	"multiple only": {"only", "title", "header", "keys"},
	"lang":          {"mode", "only", "name", "key", "frame", "title", "group_class"},
	"design":        {"show", "class", "style", "label", "wrapper", "group", "prepend"},
	"design node":   {"class", "style"},
	"field design":  {"show", "class", "style", "attributes", "label", "wrapper", "group", "prepend"},
	// A condition field also declares its editor (docs/spec/schema.md, Structured condition editor).
	"condition design": {"show", "class", "style", "attributes", "editor", "label", "wrapper", "group", "prepend"},
	"group design":     {"show", "class", "style", "attributes", "layout", "label", "wrapper", "group", "prepend"},
	"field wrapper":    {"class", "style", "attributes"},
	"behavior":         {"onchange", "onclick", "onload"},
}

// unknownKey returns the first key of o, in declaration order, that the bucket does not allow.
func unknownKey(o *Object, bucket string) (string, bool) {
	for _, key := range o.Keys() {
		if !slices.Contains(closedKeys[bucket], key) {
			return key, true
		}
	}
	return "", false
}

// invalidMember is the error for a member of a declaration at path that is not of the expected kind.
func invalidMember(path, key, expected string) error {
	return inputError("Invalid %s at %s: expected %s", key, path, expected)
}

// unknownMember is the error for a key that a closed declaration at path does not list.
func unknownMember(path, key string) error {
	return inputError("Invalid %s at %s: unknown key", key, path)
}

// checkDeclarations rejects a wrong value type or an unknown key in one field's closed declarations.
// Only a form field (field) accepts declared attributes in its design.
func checkDeclarations(spec *Object, path string, field bool) error {
	fail := func(key, expected string) error { return invalidMember(path, key, expected) }
	unknown := func(key string) error { return unknownMember(path, key) }
	// Buttons and the submission target belong to the form, not to a field.
	for _, key := range []string{"buttons", "action"} {
		if spec.Has(key) {
			return fail(key, "the form root")
		}
	}
	if spec.Has("multiple") {
		multiple := read(spec, "multiple")
		_, isBool := multiple.(bool)
		settings := object(multiple)
		if !isBool && multiple != "only" && settings == nil {
			return fail("multiple", "a boolean, only or an object")
		}
		if settings != nil {
			bucket := "multiple"
			if read(settings, "only") == true {
				bucket = "multiple only"
			}
			if key, found := unknownKey(settings, bucket); found {
				return unknown("multiple." + key)
			}
			if _, ok := read(settings, "only").(bool); settings.Has("only") && !ok {
				return fail("multiple.only", "a boolean")
			}
			// A keyed map is a data-only collection; validation resolves its reference.
			if settings.Has("keys") {
				if read(settings, "only") != true {
					return fail("multiple.keys", "multiple.only: true")
				}
				if _, ok := read(settings, "keys").(string); !ok {
					return fail("multiple.keys", "a reference to a repeated group")
				}
			}
			for _, key := range []string{"min", "max"} {
				if _, ok := asNumber(read(settings, key)); settings.Has(key) && !ok {
					return fail("multiple."+key, "a number")
				}
			}
			for _, key := range []string{"copy", "sortable"} {
				if _, ok := read(settings, key).(bool); settings.Has(key) && !ok {
					return fail("multiple."+key, "a boolean")
				}
			}
			if settings.Has("title") {
				if stringAt(spec, "type") != "group" {
					return fail("multiple.title", "a repeated group")
				}
				title, ok := read(settings, "title").(string)
				properties := object(read(spec, "properties"))
				if !ok || !has(properties, title) || !scalarChild(read(properties, title)) {
					return fail("multiple.title", "the name of a direct child field without multiple, properties or lang")
				}
			}
			if c, isString := read(settings, "controls").(string); settings.Has("controls") && (!isString || (c != "header" && c != "footer" && c != "outline")) {
				return fail("multiple.controls", "header, footer or outline")
			}
			if h, isString := read(settings, "header").(string); settings.Has("header") && (!isString || (h != "static" && h != "sticky")) {
				return fail("multiple.header", "static or sticky")
			}
		}
	}
	if spec.Has("lang") {
		if _, isBool := read(spec, "lang").(bool); !isBool && object(read(spec, "lang")) == nil {
			return fail("lang", "a boolean or an object")
		}
		if lang := object(read(spec, "lang")); lang != nil {
			if key, found := unknownKey(lang, "lang"); found {
				return unknown("lang." + key)
			}
		}
	}
	if lang := object(read(spec, "lang")); lang != nil && lang.Has("only") {
		only := read(lang, "only")
		codes, isList := only.([]any)
		for _, code := range codes {
			if _, ok := code.(string); !ok {
				isList = false
			}
		}
		if !isList && object(only) == nil {
			return fail("lang.only", "a list of language codes or an object")
		}
	}
	if spec.Has("design") {
		var layouts []string
		if field {
			layouts = groupLayouts(spec)
		}
		if e := checkDesignDeclaration(read(spec, "design"), path, field, layouts, field && isConditionType(spec)); e != nil {
			return e
		}
	}
	if behavior := object(read(spec, "behavior")); behavior != nil {
		if key, found := unknownKey(behavior, "behavior"); found {
			return unknown("behavior." + key)
		}
	}
	if field && strings.ToLower(stringAt(spec, "type")) == "range" {
		return checkRangeDeclaration(spec, path)
	}
	if field && isConditionType(spec) {
		if e := checkConditionDeclaration(spec, path); e != nil {
			return e
		}
		return checkConditionEditor(spec, path)
	}
	if field && has(read(spec, "options"), "fields") {
		return conditionFieldsError(path)
	}
	return nil
}

// isConditionType reports a field whose type is condition.
func isConditionType(spec *Object) bool {
	return strings.ToLower(stringAt(spec, "type")) == "condition"
}

// checkRangeDeclaration rejects a range field without literal bounds and a literal step whose
// multiple the minimum is (docs/spec/schema.md, Range fields): the slider moves from the minimum
// in steps.
func checkRangeDeclaration(spec *Object, path string) error {
	rules := read(spec, "validate")
	minimum, _, ok := validate.NumberRange(read(rules, "range"))
	if !ok {
		return inputError("Invalid validate.range at %s: expected [minimum, maximum] finite numbers with minimum not above maximum", path)
	}
	step, ok := validate.StepSize(read(rules, "step"))
	if !ok {
		return inputError("Invalid validate.step at %s: expected a finite number above 0", path)
	}
	if !validate.IsStepMultiple(minimum, step) {
		return inputError("Invalid validate.range at %s: expected a minimum that is a multiple of validate.step", path)
	}
	return nil
}

// ownedAttributePrefixes are the prefixes of attribute names crudui writes on a control or a node root.
var ownedAttributePrefixes = []string{"data-crudui-", "data-source-"}

// ownedAttributeNames are the attribute names crudui writes on a control or a node root.
var ownedAttributeNames = []string{
	"data-field-path", "data-lang", "data-name", "data-rule-name", "data-default", "data-is-default",
	"data-type", "data-height", "data-upload-server", "data-fileserver", "data-server", "data-max-tags",
	"data-keyword-min-length", "data-delay", "data-api-server", "data-max-width", "data-min-width",
	"data-max-height", "data-min-height", "data-preview-max-width", "data-preview-max-height",
	"data-unsupported-type",
}

// declaredAttributeName reports whether name is a data-* or aria-* name crudui does not write:
// lowercase letters, digits, "-", "_" and "." after the prefix, starting with a letter or a digit.
func declaredAttributeName(name string) bool {
	rest, found := strings.CutPrefix(name, "data-")
	if !found {
		rest, found = strings.CutPrefix(name, "aria-")
	}
	if !found || rest == "" {
		return false
	}
	for index := 0; index < len(rest); index++ {
		c := rest[index]
		alphanumeric := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
		if !alphanumeric && (index == 0 || (c != '-' && c != '_' && c != '.')) {
			return false
		}
	}
	if slices.Contains(ownedAttributeNames, name) {
		return false
	}
	for _, prefix := range ownedAttributePrefixes {
		if strings.HasPrefix(name, prefix) {
			return false
		}
	}
	return true
}

// checkDeclaredAttributes rejects declared attributes at key that are not an object of permitted
// names to strings. Every name is checked before any value.
func checkDeclaredAttributes(attributes any, key, path string) error {
	o := object(attributes)
	if o == nil {
		return inputError("Invalid %s at %s: expected an object", key, path)
	}
	for _, name := range o.Keys() {
		if !declaredAttributeName(name) {
			return inputError("Invalid %s.%s at %s: expected a data-* or aria-* name that crudui does not write", key, name, path)
		}
	}
	for _, name := range o.Keys() {
		if _, ok := read(o, name).(string); !ok {
			return inputError("Invalid %s.%s at %s: expected a string", key, name, path)
		}
	}
	return nil
}

// groupLayouts returns the design.layout values a group field accepts (docs/spec/schema.md, Layout):
// a repeated group has no line, and a field that is not a group has no layout (nil).
func groupLayouts(spec *Object) []string {
	if stringAt(spec, "type") != "group" {
		return nil
	}
	if repeatedSpec(spec) {
		return []string{"stacked", "inline"}
	}
	return []string{"stacked", "inline", "line"}
}

// checkDesignDeclaration rejects an unknown key or a wrong value type in one design declaration at path.
// Form fields, form buttons, list and detail specifications, their columns and fields share this
// rule; only a form field (field) accepts attributes and wrapper.attributes, and only a group
// field (non-nil layouts) accepts layout, one of layouts.
func checkDesignDeclaration(design any, path string, field bool, layouts []string, condition bool) error {
	fail := func(key, expected string) error { return invalidMember(path, key, expected) }
	unknown := func(key string) error { return unknownMember(path, key) }
	d := object(design)
	if _, isBool := design.(bool); !isBool && d == nil {
		return fail("design", "a boolean or an object")
	}
	if d == nil {
		return nil
	}
	designBucket := "design"
	if layouts != nil {
		designBucket = "group design"
	} else if condition {
		designBucket = "condition design"
	} else if field {
		designBucket = "field design"
	}
	if key, found := unknownKey(d, designBucket); found {
		return unknown("design." + key)
	}
	if show := read(d, "show"); d.Has("show") {
		if _, ok := show.(bool); !ok && !conditionValue(show) {
			return fail("design.show", "an expression, a boolean or a condition map")
		}
	}
	for _, key := range []string{"class", "style"} {
		if d.Has(key) && !conditionValue(read(d, key)) {
			return fail("design."+key, "a string or a condition map")
		}
	}
	if d.Has("attributes") {
		if e := checkDeclaredAttributes(read(d, "attributes"), "design.attributes", path); e != nil {
			return e
		}
	}
	if layout, isString := read(d, "layout").(string); layouts != nil && d.Has("layout") && (!isString || !slices.Contains(layouts, layout)) {
		if len(layouts) == 3 {
			return fail("design.layout", "stacked, inline or line")
		}
		return fail("design.layout", "stacked or inline")
	}
	for _, node := range []string{"label", "wrapper", "group", "prepend"} {
		if !d.Has(node) {
			continue
		}
		n := object(read(d, node))
		if n == nil {
			return fail("design."+node, "an object")
		}
		nodeBucket := "design node"
		if field && node == "wrapper" {
			nodeBucket = "field wrapper"
		}
		if key, found := unknownKey(n, nodeBucket); found {
			return unknown("design." + node + "." + key)
		}
		for _, key := range []string{"class", "style"} {
			if n.Has(key) && !conditionValue(read(n, key)) {
				return fail("design."+node+"."+key, "a string or a condition map")
			}
		}
		if n.Has("attributes") {
			if e := checkDeclaredAttributes(read(n, "attributes"), "design."+node+".attributes", path); e != nil {
				return e
			}
		}
	}
	return nil
}

// inputError is the form input error (INVALID_FORM_INPUT) of the generator, with the formatted message; every failure
// of the generator that is no composition failure and no unsupported field is one.
func inputError(format string, args ...any) error {
	return &validate.FormInputError{Message: fmt.Sprintf(format, args...)}
}

// errTemplateShape rejects a value that is not exactly the compiled template shape.
var errTemplateShape = inputError("Unsupported form template")

// onlyMembers reports whether every member of o is one of names.
func onlyMembers(o *Object, names ...string) bool {
	for _, key := range o.Keys() {
		known := false
		for _, name := range names {
			known = known || key == name
		}
		if !known {
			return false
		}
	}
	return true
}

// UnmarshalJSON reads the template in specification member order. A value that is not
// exactly the compiled shape is rejected: the template kind, a field list, a button object
// list, an optional string keyPrefix, an optional object action, an optional description of any
// value and no other member.
func (t *FormTemplate) UnmarshalJSON(data []byte) error {
	v, e := DecodeJSON(data)
	if e != nil {
		return e
	}
	o := object(compose.OrderMembers(v))
	if o == nil || !onlyMembers(o, "kind", "keyPrefix", "fields", "buttons", "action", "description") || read(o, "kind") != "crudui/form-template" {
		return errTemplateShape
	}
	keyPrefix, keyPrefixOK := read(o, "keyPrefix").(string)
	action := object(read(o, "action"))
	if (o.Has("keyPrefix") && !keyPrefixOK) || (o.Has("action") && action == nil) {
		return errTemplateShape
	}
	a, ok := read(o, "fields").([]any)
	if !ok {
		return errTemplateShape
	}
	fields, e := decodeFields(a)
	if e != nil {
		return e
	}
	declared, ok := read(o, "buttons").([]any)
	if !ok {
		return errTemplateShape
	}
	buttons := []*Object{}
	for _, value := range declared {
		button := object(value)
		if button == nil {
			return errTemplateShape
		}
		buttons = append(buttons, button)
	}
	var description any
	if o.Has("description") {
		description = read(o, "description")
	}
	*t = FormTemplate{Kind: "crudui/form-template", KeyPrefix: keyPrefix, keyPrefixProvided: o.Has("keyPrefix"), Fields: fields, Buttons: buttons, Action: action, Description: description, descriptionProvided: o.Has("description")}
	return nil
}

// decodeFields reads a field list; each field has exactly a string name, an object spec and a field list children.
func decodeFields(a []any) ([]FieldTemplate, error) {
	out := []FieldTemplate{}
	for _, v := range a {
		o := object(v)
		if o == nil || !onlyMembers(o, "name", "spec", "children") {
			return nil, errTemplateShape
		}
		s := object(read(o, "spec"))
		name, ok := read(o, "name").(string)
		ch, childrenOK := read(o, "children").([]any)
		if !ok || s == nil || !childrenOK {
			return nil, errTemplateShape
		}
		c, e := decodeFields(ch)
		if e != nil {
			return nil, e
		}
		out = append(out, FieldTemplate{Name: name, Spec: s, Children: c})
	}
	return out, nil
}
func cloneTemplate(t *FormTemplate) (*FormTemplate, error) {
	if t == nil || t.Kind != "crudui/form-template" {
		return nil, inputError("Unsupported form template")
	}
	b, e := json.Marshal(t)
	if e != nil {
		return nil, e
	}
	var out FormTemplate
	e = json.Unmarshal(b, &out)
	return &out, e
}

// UnsupportedFieldTypeError identifies a field type that has no supported widget.
type UnsupportedFieldTypeError struct {
	Type string
	Path string
}

// Error returns the unsupported type and its structural field path.
func (e *UnsupportedFieldTypeError) Error() string {
	return "Unsupported field type \"" + e.Type + "\" at \"" + e.Path + "\""
}

// Code returns the shared unsupported-field error code.
func (e *UnsupportedFieldTypeError) Code() string { return "UNSUPPORTED_FIELD_TYPE" }

// MarshalJSON retains specification order, an explicitly empty form-name prefix and a declared
// null description.
func (t FormTemplate) MarshalJSON() ([]byte, error) {
	o := NewObject("kind", t.Kind)
	if t.keyPrefixProvided || t.KeyPrefix != "" {
		o.Set("keyPrefix", t.KeyPrefix)
	}
	o.Set("fields", t.Fields)
	o.Set("buttons", t.Buttons)
	if t.Action != nil {
		o.Set("action", t.Action)
	}
	if t.descriptionProvided || t.Description != nil {
		o.Set("description", t.Description)
	}
	return json.Marshal(o)
}
