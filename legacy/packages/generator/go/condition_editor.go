package generator

import (
	"math"
	"slices"
	"strconv"
	"strings"
	"unicode"
)

// conditionOps are the comparison operators that the structured editor offers, in their order
// (docs/spec/schema.md, CUSC-073 and CUSC-085).
var conditionOps = []string{"eq", "ne", "lt", "le", "gt", "ge", "in", "has"}

// conditionMaxDepth is the deepest level of a condition tree; the root is level 1 (CUSC-075).
const conditionMaxDepth = 32

// isEmptyConditionValue reports an empty value (docs/spec/validation-rules.md, CUVR-020): a
// missing value, null, a string that is empty after trimming White_Space, an empty array or an
// empty object.
func isEmptyConditionValue(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return strings.TrimFunc(x, unicode.IsSpace) == ""
	case []any:
		return len(x) == 0
	case *Object:
		return x.Len() == 0
	}
	return isAbsent(v)
}

// isConditionScalar reports a string, a finite number or a boolean.
func isConditionScalar(v any) bool {
	switch v.(type) {
	case string, bool:
		return true
	}
	n, ok := asNumber(v)
	return ok && !math.IsInf(n, 0) && !math.IsNaN(n)
}

// conditionNode is the editor node of a condition at path and depth, or nil when the editor does
// not show it (CUSC-086).
func conditionNode(v any, path string, depth int, judge bool) *Object {
	o := object(v)
	if depth > conditionMaxDepth || o == nil {
		return nil
	}
	keys := o.Keys()
	if len(keys) == 1 && (keys[0] == "all" || keys[0] == "any") {
		items, ok := read(o, keys[0]).([]any)
		if !ok {
			return nil
		}
		nodes := make([]any, 0, len(items))
		for i, item := range items {
			child := conditionNode(item, path+"/"+keys[0]+"/"+strconv.Itoa(i), depth+1, judge)
			if child == nil {
				return nil
			}
			nodes = append(nodes, child)
		}
		return NewObject("kind", "group", "path", path, "mode", keys[0], "items", nodes)
	}
	if len(keys) == 1 && keys[0] == "judge" {
		text, ok := read(o, "judge").(string)
		if !judge || !ok {
			return nil
		}
		return NewObject("kind", "judge", "path", path, "text", text)
	}
	if len(keys) == 3 && o.Has("field") && o.Has("op") && o.Has("value") {
		field, fieldOK := read(o, "field").(string)
		op, opOK := read(o, "op").(string)
		if !fieldOK || !opOK || !slices.Contains(conditionOps, op) {
			return nil
		}
		value := read(o, "value")
		valid := isConditionScalar(value)
		if op == "in" {
			items, isList := value.([]any)
			valid = isList && !slices.ContainsFunc(items, func(item any) bool { return !isConditionScalar(item) })
		}
		if !valid {
			return nil
		}
		return NewObject("kind", "comparison", "path", path, "field", field, "op", op, "value", conditionText(value))
	}
	return nil
}

// conditionEditor is the editor model of a structured condition field (docs/spec/form-markup.md,
// Structured condition editor): its root node when the editor shows the value, an empty value
// being an empty all group, and otherwise the error text of the field.
func conditionEditor(c widgetContext, id string, value any) *Object {
	judge := read(read(c.spec, "validate"), "conditionTree") == "judge"
	var root *Object
	if isEmptyConditionValue(value) {
		root = NewObject("kind", "group", "path", "", "mode", "all", "items", []any{})
	} else {
		root = conditionNode(value, "", 1, judge)
	}
	m := c.state.messages
	if root == nil {
		return NewObject("for", id, "error", strings.Replace(m.conditionInvalid, "{path}", c.path, 1))
	}
	var fields any
	if names, ok := read(read(c.spec, "options"), "fields").([]any); ok {
		fields = names
	}
	labels := NewObject("mode", m.conditionMode, "addComparison", m.conditionAddComparison, "addGroup", m.conditionAddGroup,
		"addJudge", m.conditionAddJudge, "remove", m.conditionRemove)
	return NewObject("for", id, "judge", judge, "fields", fields, "labels", labels, "root", root)
}

// checkConditionEditor rejects a design.editor of a condition field other than text or structured
// (CUSC-083), and options.fields outside a structured editor or with names that break its rule
// (CUSC-084).
func checkConditionEditor(spec *Object, path string) error {
	editor := any("text")
	if design := object(read(spec, "design")); design != nil && design.Has("editor") {
		editor = read(design, "editor")
	}
	if editor != "text" && editor != "structured" {
		return inputError("Invalid design.editor at %s: expected text or structured", path)
	}
	options := object(read(spec, "options"))
	if options == nil || !options.Has("fields") {
		return nil
	}
	names, ok := read(options, "fields").([]any)
	seen := map[string]bool{}
	for _, name := range names {
		text, isText := name.(string)
		if !isText || isEmptyConditionValue(text) || seen[text] {
			ok = false
			break
		}
		seen[text] = true
	}
	if editor != "structured" || !ok {
		return conditionFieldsError(path)
	}
	return nil
}

// conditionFieldsError is the error of an options.fields that breaks its rule (CUSC-084).
func conditionFieldsError(path string) error {
	return inputError("Invalid options.fields at %s: expected distinct field names of a structured condition editor", path)
}
