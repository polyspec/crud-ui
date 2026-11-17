package validate

// Choices from a repeated group (docs/spec/schema.md, "Choices from a repeated group"; docs/spec/validation-rules.md,
// "Values" and "Parameter errors").
//
// A choice field whose items is a group source {from, label} takes its choices from the rows of a repeated group of
// the same form. This file checks the declaration and reads the choices from the data. The validator checks a value
// against the choices and the generator lists them, so both use these functions.

import (
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// groupSourceTypes are the field types that take a group source.
var groupSourceTypes = map[string]bool{
	"select": true, "dropdown": true, "selectbox": true, "choice": true, "radio": true,
	"multichoice": true, "checkboxes": true, "checkcontainer": true,
}

// booleanTypes are the field types whose stored value is a boolean, which a group source refuses (CUSC-068).
var booleanTypes = map[string]bool{"checkbox": true, "switcher": true}

// GroupChoice is one choice of a group source: the canonical text of its value and its label. A literal choice keeps
// its declared label (CUSC-089); a row's label is the text of its label field, or the value when the source declares no
// label or the row gives none.
type GroupChoice struct {
	Value string
	Label any
}

// GroupSourceItems returns the items of a field as a group source, and whether the items are one: an object with the
// member from.
func GroupSourceItems(items any) (*compose.OMap, bool) {
	source, ok := items.(*compose.OMap)
	return source, ok && source != nil && source.Has("from")
}

// GroupSourceFailure returns the message of the first rule that the group source of field, declared at path, breaks
// under the root properties, or "" when it breaks none. The members of items are checked in declaration order, then the
// field, from, the type of its field, label and the type of its field. A field whose items is not a group source has no failure.
func GroupSourceFailure(field *compose.OMap, path string, root *compose.OMap) string {
	items, _ := field.Get("items")
	source, ok := GroupSourceItems(items)
	if !ok {
		return ""
	}
	for _, key := range source.Keys() {
		if key != "from" && key != "label" && key != "choices" {
			return "Invalid items." + key + " at " + path + ": unknown key"
		}
	}
	if !groupSourceTypes[fieldType(field)] || hasLang(field) {
		return "Invalid items.from at " + path + ": expected a choice field without lang"
	}
	from, _ := source.Get("from")
	// A from that is not a string has no group (sourceGroup), so both conditions give the from failure.
	fromText, fromIsText := from.(string)
	if _, ok := selectionField(source, root); ok {
		if _, hasLabel := source.Get("label"); hasLabel {
			return "Invalid items.label at " + path + ": a source of selected values takes the labels of its field"
		}
		if choices, declared := source.Get("choices"); declared && !validLiteralChoices(choices) {
			return "Invalid items.choices at " + path + ": expected value and label pairs with distinct string or number values"
		}
		return ""
	}
	group := sourceGroup(from, root)
	if !fromIsText || group == nil {
		return "Invalid items.from at " + path + ": expected {group}.*.{field} for a field of a repeated group outside repeated groups"
	}
	segments := strings.Split(fromText, ".")
	groupPath := strings.Join(segments[:len(segments)-2], ".")
	valueName := segments[len(segments)-1]
	if holdsBoolean(group, valueName) {
		return booleanFailure("from", path, groupPath+"."+valueName)
	}
	label, declared := source.Get("label")
	// A label that is not a string is no scalar child (scalarChild), so both conditions give the label failure.
	labelText, labelIsText := label.(string)
	if declared && (!labelIsText || !scalarChild(group, label)) {
		return "Invalid items.label at " + path + ": expected the name of a direct child field of the group without multiple, properties or lang"
	}
	if declared && holdsBoolean(group, labelText) {
		return booleanFailure("label", path, groupPath+"."+labelText)
	}
	if choices, declared := source.Get("choices"); declared {
		if _, ok := literalChoices(choices); !ok {
			return "Invalid items.choices at " + path + ": expected value and label pairs with distinct string or number values"
		}
	}
	return ""
}

// literalChoices returns the literal choices of a group source (CUSC-089), each with the canonical text of its value,
// and whether choices keeps their rules: a list of {value, label} pairs whose values are strings or finite numbers with
// distinct canonical texts that are not empty after trimming. Absent choices give no literal choice.
func literalChoices(choices any) ([]GroupChoice, bool) {
	if choices == nil {
		return nil, true
	}
	list, ok := choices.([]any)
	if !ok {
		return nil, false
	}
	literal := make([]GroupChoice, 0, len(list))
	seen := map[string]bool{}
	for _, item := range list {
		choice, ok := item.(*compose.OMap)
		if !ok || choice == nil || choice.Len() != 2 || !choice.Has("value") || !choice.Has("label") {
			return nil, false
		}
		raw, _ := choice.Get("value")
		value, ok := choiceText(raw)
		if !ok || seen[value] {
			return nil, false
		}
		seen[value] = true
		label, _ := choice.Get("label")
		literal = append(literal, GroupChoice{Value: value, Label: label})
	}
	return literal, true
}

// sourceLiteral returns the literal choices of a checked group source.
func sourceLiteral(source *compose.OMap) []GroupChoice {
	choices, _ := source.Get("choices")
	literal, _ := literalChoices(choices)
	return literal
}

// GroupChoicesIn returns the choices of a checked group source for the root data under the root properties: a source of
// selected values (CUSC-097) takes the values that its field selects, otherwise the rows of the group as GroupChoices.
func GroupChoicesIn(source *compose.OMap, data any, root *compose.OMap) ([]GroupChoice, error) {
	if field, ok := selectionField(source, root); ok {
		return selectionChoices(source, field, data), nil
	}
	if repeat := firstRepeat(source, data, false); repeat != "" {
		return nil, &FormInputError{Message: repeat}
	}
	choices := append([]GroupChoice{}, sourceLiteral(source)...)
	rows, ok := sourceRows(source, data)
	if !ok {
		return choices, nil
	}
	valueName := rows.valueName
	labelName, hasLabel := labelOf(source)
	seen := map[string]bool{}
	for _, row := range rows.values {
		value, ok := choiceText(objectMemberValue(row, valueName))
		if !ok || seen[value] {
			continue
		}
		seen[value] = true
		label := value
		if hasLabel {
			if text, ok := choiceText(objectMemberValue(row, labelName)); ok {
				label = text
			}
		}
		choices = append(choices, GroupChoice{Value: value, Label: label})
	}
	return choices, nil
}

// groupRows are the rows of the group that a checked group source names in the data: the declaration path of the
// group, the name of its value field and the row keys with their rows in data order.
type groupRows struct {
	groupPath string
	valueName string
	keys      []string
	values    []any
}

// sourceRows returns the rows of the group that a checked group source names in the root data, and whether the group
// has object data.
func sourceRows(source *compose.OMap, data any) (groupRows, bool) {
	from, _ := source.Get("from")
	text, isText := from.(string)
	segments := strings.Split(text, ".")
	if !isText || len(segments) < 3 {
		return groupRows{}, false
	}
	names := segments[:len(segments)-2]
	rows := data
	for _, name := range names {
		member, ok := objectMember(rows, name)
		if !ok {
			return groupRows{}, false
		}
		rows = member
	}
	keys, values, ok := objectEntries(rows)
	if !ok {
		return groupRows{}, false
	}
	return groupRows{groupPath: strings.Join(names, "."), valueName: segments[len(segments)-1], keys: keys, values: values}, true
}

// groupSourceRepeat returns the input failure message of the first row of a checked group source, in data order, whose
// choice value repeats a literal choice (CUSC-089), or "" when none does.
func groupSourceRepeat(source *compose.OMap, data any) string {
	return firstRepeat(source, data, false)
}

// repeatedRow is a row whose choice value repeats the value of an earlier row: the data path of its value field and
// the canonical text of the value (CUVR-087, CUVR-096).
type repeatedRow struct {
	at    string
	value string
}

// groupSourceRepeats returns the rows whose choice value repeats the value of an earlier row, in data order.
func groupSourceRepeats(source *compose.OMap, data any) []repeatedRow {
	group, ok := sourceRows(source, data)
	if !ok {
		return nil
	}
	var repeats []repeatedRow
	seen := map[string]bool{}
	for index, row := range group.values {
		value, ok := choiceText(objectMemberValue(row, group.valueName))
		if !ok {
			continue
		}
		if seen[value] {
			repeats = append(repeats, repeatedRow{at: group.groupPath + "." + group.keys[index] + "." + group.valueName, value: value})
		}
		seen[value] = true
	}
	return repeats
}

// firstRepeat returns the message of the first row of a checked group source, in data order, whose choice value is a
// literal choice or, with rows, the value of an earlier row; "" when none repeats.
func firstRepeat(source *compose.OMap, data any, rows bool) string {
	group, ok := sourceRows(source, data)
	if !ok {
		return ""
	}
	literal := map[string]bool{}
	for _, choice := range sourceLiteral(source) {
		literal[choice.Value] = true
	}
	seen := map[string]bool{}
	for index, row := range group.values {
		value, ok := choiceText(objectMemberValue(row, group.valueName))
		if !ok {
			continue
		}
		at := group.groupPath + "." + group.keys[index] + "." + group.valueName
		if literal[value] {
			return "Group source value repeats a literal choice at " + at + ": " + value
		}
		if rows && seen[value] {
			return "Group source value repeats an earlier row: " + value + " at " + at
		}
		seen[value] = true
	}
	return ""
}

// groupSourceMembers returns the choice values of a checked group source for the data, as the members of an in rule.
func groupSourceMembers(source *compose.OMap, data map[string]any, root *compose.OMap) ([]any, error) {
	choices, err := GroupChoicesIn(source, data, root)
	if err != nil {
		return nil, err
	}
	members := make([]any, 0, len(choices))
	for _, choice := range choices {
		members = append(members, choice.Value)
	}
	return members, nil
}

// sourceGroup returns the child fields of the repeated group that from names under the root properties, or nil when
// from is not {group}.*.{field} for a field of a repeated group outside repeated groups. The field must be a direct
// child of that group and a scalar child (scalarChild).
func sourceGroup(from any, root *compose.OMap) *compose.OMap {
	text, ok := from.(string)
	if !ok {
		return nil
	}
	segments := strings.Split(text, ".")
	count := len(segments)
	if count < 3 || segments[count-2] != "*" {
		return nil
	}
	current := root
	for index, name := range segments[:count-2] {
		if name == "" || !current.Has(name) {
			return nil
		}
		raw, _ := current.Get(name)
		field, ok := raw.(*compose.OMap)
		if !ok || field == nil || fieldType(field) != "group" {
			return nil
		}
		children := childProperties(field)
		if children == nil || fieldIsMultiple(field) != (index == count-3) {
			return nil
		}
		current = children
	}
	if !scalarChild(current, segments[count-1]) {
		return nil
	}
	return current
}

// scalarChild reports whether name is a direct child of properties that is not repeated, not a group and has no lang
// (docs/spec/schema.md, label). A name that is not a string is not a child.
func scalarChild(properties *compose.OMap, name any) bool {
	text, ok := name.(string)
	if !ok || properties == nil || !properties.Has(text) {
		return false
	}
	raw, _ := properties.Get(text)
	child, ok := raw.(*compose.OMap)
	return ok && child != nil && fieldType(child) != "group" && !child.Has("properties") &&
		!fieldIsMultiple(child) && !hasLang(child)
}

// holdsBoolean reports whether the child name of the group properties, a scalar child, is of a type that stores a
// boolean.
func holdsBoolean(properties *compose.OMap, name any) bool {
	text, ok := name.(string)
	if !ok {
		return false
	}
	raw, _ := properties.Get(text)
	child, ok := raw.(*compose.OMap)
	return ok && child != nil && booleanTypes[fieldType(child)]
}

// booleanFailure returns the message of a group source whose member names the field that holds a boolean (CUSC-068).
func booleanFailure(member string, path string, field string) string {
	return "Invalid items." + member + " at " + path + ": " + field + " holds a boolean, expected a field whose values are strings or numbers"
}

// hasLang reports whether a field declares lang as true or as an object.
func hasLang(field *compose.OMap) bool {
	lang, _ := field.Get("lang")
	switch value := lang.(type) {
	case bool:
		return value
	case *compose.OMap:
		return value != nil
	}
	return false
}

// labelOf returns the name of the label member of a group source, when it is a string.
func labelOf(source *compose.OMap) (string, bool) {
	label, _ := source.Get("label")
	name, ok := label.(string)
	return name, ok
}

// choiceText returns the canonical text of a string or a finite number that is not empty after trimming. Booleans,
// arrays, objects, null and nonfinite numbers have no choice text.
func choiceText(value any) (string, bool) {
	if _, isBool := value.(bool); isBool {
		return "", false
	}
	text, ok := canonicalText(value)
	if !ok || trimText(text) == "" {
		return "", false
	}
	return text, true
}

// objectMember returns the member name of an object, and whether the value is an object that has it.
func objectMember(object any, name string) (any, bool) {
	switch o := object.(type) {
	case *compose.OMap:
		if o == nil {
			return nil, false
		}
		return o.Get(name)
	case map[string]any:
		member, ok := o[name]
		return member, ok
	}
	return nil, false
}

// objectMemberValue returns the member name of an object, or nil when the value is not an object or lacks it.
func objectMemberValue(object any, name string) any {
	member, _ := objectMember(object, name)
	return member
}

// objectEntries returns the member keys and values of an object in data order, and whether the value is an object. A
// plain map has no member order, so its members follow its sorted keys.
func objectEntries(object any) ([]string, []any, bool) {
	switch o := object.(type) {
	case *compose.OMap:
		if o == nil {
			return nil, nil, false
		}
		keys := o.Keys()
		values := make([]any, 0, len(keys))
		for _, key := range keys {
			member, _ := o.Get(key)
			values = append(values, member)
		}
		return keys, values, true
	case map[string]any:
		keys := sortedKeys(o)
		values := make([]any, 0, len(keys))
		for _, key := range keys {
			values = append(values, o[key])
		}
		return keys, values, true
	}
	return nil, nil, false
}

// selectionField returns the root field that a source names when it is a source of selected values (CUSC-097): a `from`
// with no `.` that names a multichoice, checkboxes or checkcontainer field whose items are literal.
func selectionField(source *compose.OMap, root *compose.OMap) (*compose.OMap, bool) {
	from, _ := source.Get("from")
	text, isText := from.(string)
	if !isText || strings.Contains(text, ".") || root == nil {
		return nil, false
	}
	raw, ok := root.Get(text)
	if !ok {
		return nil, false
	}
	field, ok := raw.(*compose.OMap)
	if !ok {
		return nil, false
	}
	kind, _ := field.Get("type")
	if name, isName := kind.(string); !isName || (name != "multichoice" && name != "checkboxes" && name != "checkcontainer") {
		return nil, false
	}
	items, _ := field.Get("items")
	if _, isSource := GroupSourceItems(items); isSource {
		return nil, false
	}
	switch items.(type) {
	case *compose.OMap, []any:
		return field, true
	}
	return nil, false
}

// selectionChoices returns the choices of a source of selected values (CUSC-097): its literal choices in written order,
// then each item of the source field, in the order of its items, that the field selects in the data, with its label.
func selectionChoices(source *compose.OMap, field *compose.OMap, data any) []GroupChoice {
	choices := append([]GroupChoice{}, sourceLiteral(source)...)
	seen := map[string]bool{}
	for _, choice := range choices {
		seen[choice.Value] = true
	}
	from, _ := source.Get("from")
	text := stringOf(from)
	// The data of a generator is a compose object, which objectMember reads as a plain map does (C19.150).
	member, _ := objectMember(data, text)
	members, ok := member.([]any)
	if !ok {
		return choices
	}
	selected := map[string]bool{}
	for _, member := range members {
		if value, ok := choiceText(member); ok {
			selected[value] = true
		}
	}
	items, _ := field.Get("items")
	type entry struct {
		value string
		label any
	}
	var entries []entry
	switch its := items.(type) {
	case []any:
		for _, item := range its {
			value, ok := choiceText(objectMemberValue(item, "value"))
			if !ok {
				continue
			}
			label := objectMemberValue(item, "label")
			if label == nil {
				label = value
			}
			entries = append(entries, entry{value, label})
		}
	case *compose.OMap:
		for _, key := range its.Keys() {
			value, ok := choiceText(key)
			if !ok {
				continue
			}
			label, _ := its.Get(key)
			entries = append(entries, entry{value, label})
		}
	}
	for _, e := range entries {
		if !selected[e.value] || seen[e.value] {
			continue
		}
		seen[e.value] = true
		choices = append(choices, GroupChoice{Value: e.value, Label: e.label})
	}
	return choices
}

// validLiteralChoices reports whether a `choices` declaration is a list of value and label pairs with distinct values.
func validLiteralChoices(choices any) bool {
	_, ok := literalChoices(choices)
	return ok
}

// valueFieldMessages returns the messages of the value field that a group source names (the last segment of from), or nil
// when the source names no such field: the message of unique at a repeated row is the one of that field (CUVR-096).
func valueFieldMessages(source *compose.OMap, root *compose.OMap) map[string]string {
	from, _ := source.Get("from")
	group := sourceGroup(from, root)
	if group == nil {
		return nil
	}
	text := stringOf(from)
	segments := strings.Split(text, ".")
	raw, ok := group.Get(segments[len(segments)-1])
	field, isField := raw.(*compose.OMap)
	if !ok || !isField {
		return nil
	}
	return fieldMessages(field)
}

// stringOf returns the string of a value, or the empty string when the value is no string.
func stringOf(value any) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}
