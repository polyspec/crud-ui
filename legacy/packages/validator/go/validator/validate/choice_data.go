package validate

import "github.com/polyspec/crudui/packages/validator/go/validator/compose"

// singleChoiceTypes are the field types whose control holds one value
// (validation-rules.md, "Evaluation").
var singleChoiceTypes = map[string]bool{"select": true, "dropdown": true, "selectbox": true, "choice": true, "radio": true}

// isSingleChoice reports whether a field is a single-choice field: a single-choice
// type whose lang is absent, false or null.
func isSingleChoice(field *compose.OMap) bool {
	if !singleChoiceTypes[fieldType(field)] {
		return false
	}
	lang, ok := field.Get("lang")
	return !ok || lang == nil || lang == false
}

// checkSingleChoiceData returns an input failure for an array or object as the value
// of a single-choice field, or of a row of a repeated one (rows in sorted key order).
func checkSingleChoiceData(value any, path []string, repeated bool) error {
	if !repeated {
		return singleValue(value, path)
	}
	rows, err := objectValue(value, path, "Repeated data must be a keyed object: ")
	if err != nil {
		return err
	}
	for _, key := range sortedKeys(rows) {
		if err := singleValue(rows[key], appendPath(path, key)); err != nil {
			return err
		}
	}
	return nil
}

func singleValue(value any, path []string) error {
	switch value.(type) {
	case []any, map[string]any:
		return &FormInputError{Message: "Choice data must be a single value: " + pathToString(path)}
	}
	return nil
}
