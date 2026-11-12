package validate

// Keyed maps (docs/spec/schema.md and docs/spec/validation-rules.md, "Keyed maps"): a field that
// declares multiple.keys holds rows only under the row keys of the repeated group that the
// reference names.

import (
	"slices"
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// keyedMapReference returns the declared multiple.keys of a field and whether it declares one.
func keyedMapReference(field *compose.OMap) (any, bool) {
	raw, ok := field.Get("multiple")
	if !ok {
		return nil, false
	}
	settings, ok := raw.(*compose.OMap)
	if !ok || settings == nil {
		return nil, false
	}
	return settings.Get("keys")
}

// namesRepeatedGroup reports whether reference, declared by the field at declaration, names a
// repeated group of the form whose root field map is root (CUSC-077): it leaves as many fields of
// the declaration path as it has leading dots (a bare name one; a path with a dot inside and no
// leading dot starts at the root), stays within the root, has no empty name and no "*", passes only through
// groups that do not repeat and ends on a repeated group.
func namesRepeatedGroup(reference any, declaration []string, root *compose.OMap) bool {
	text, ok := reference.(string)
	if !ok {
		return false
	}
	dots := 0
	for dots < len(text) && text[dots] == '.' {
		dots++
	}
	rest := text[dots:]
	// A path with a dot inside and no leading dot starts at the root; a bare name leaves the field.
	base := []string{}
	if dots > 0 || !strings.Contains(rest, ".") {
		leave := max(dots, 1)
		if leave > len(declaration) {
			return false
		}
		base = declaration[:len(declaration)-leave]
	}
	names := strings.Split(rest, ".")
	if slices.Contains(names, "") || slices.Contains(names, "*") {
		return false
	}
	properties := root
	for _, name := range base {
		raw, _ := properties.Get(name)
		field, isField := raw.(*compose.OMap)
		properties = nil
		if isField && field != nil {
			properties = childProperties(field)
		}
		if properties == nil {
			properties = compose.NewOMap()
		}
	}
	for index, name := range names {
		raw, _ := properties.Get(name)
		field, isField := raw.(*compose.OMap)
		if !isField || field == nil || fieldType(field) != "group" || childProperties(field) == nil {
			return false
		}
		if index == len(names)-1 {
			return fieldIsMultiple(field)
		}
		if fieldIsMultiple(field) {
			return false
		}
		properties = childProperties(field)
	}
	return false
}

// checkKeyedMapReference fails the load when the field declares a multiple.keys that names no
// repeated group (CUVR-070), with the field's declaration path.
func checkKeyedMapReference(field *compose.OMap, declaration []string, root *compose.OMap) error {
	reference, declared := keyedMapReference(field)
	if declared && !namesRepeatedGroup(reference, declaration, root) {
		return &FormInputError{Message: "Invalid multiple.keys at " + pathToString(declaration) + ": expected a reference to a repeated group"}
	}
	return nil
}

// checkKeyedMapKeys fails when a key of the field's keyed object value is not a row key of the
// group that its multiple.keys names, read in the field's row context (CUVR-069); keys in code
// point order, the byte order of their UTF-8 text.
func checkKeyedMapKeys(field *compose.OMap, value map[string]any, fieldPath []string, rowKeys []int, allData map[string]any) error {
	raw, declared := keyedMapReference(field)
	reference, ok := raw.(string)
	if !declared || !ok {
		return nil
	}
	ids, isGroup := resolveFieldReference(reference, fieldPath, rowKeys, allData).(map[string]any)
	for _, key := range sortedKeys(value) {
		if _, found := ids[key]; !isGroup || !found {
			return &FormInputError{Message: "Row key is not an id of " + reference + ": " + pathToString(appendPath(fieldPath, key))}
		}
	}
	return nil
}
