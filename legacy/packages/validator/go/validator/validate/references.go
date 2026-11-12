package validate

// References (docs/spec/validation-rules.md, References). A reference parameter is the
// declaration path of a field: its property names from the root joined with ".", without row
// keys. The ids of the path are the values of that field in the data, read in every row of every
// repeated field on the path, and a value passes when it is a member of them as for in.

import (
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// referenceParameterMessage is the message of a reference parameter outside its definition.
const referenceParameterMessage = "Invalid reference parameter: expected the declaration path of a field"

// isReferenceTarget reports whether path is the declaration path of a field of the form whose
// type is not group and whose lang is absent, false or null (CUVR-074).
func isReferenceTarget(properties *compose.OMap, path string) bool {
	fields := properties
	var field *compose.OMap
	for _, name := range strings.Split(path, ".") {
		if fields == nil {
			return false
		}
		raw, ok := fields.Get(name)
		if !ok {
			return false
		}
		next, ok := raw.(*compose.OMap)
		if !ok || next == nil {
			return false
		}
		field = next
		fields = nil
		if fieldType(next) == "group" {
			fields = childProperties(next)
		}
	}
	if field == nil || fieldType(field) == "group" {
		return false
	}
	lang, ok := field.Get("lang")
	if !ok || lang == nil {
		return true
	}
	enabled, isBool := lang.(bool)
	return isBool && !enabled
}

// referenceIds returns the ids of the declaration path in data (CUVR-072) as members. Data of
// another shape at a step and a missing value hold no ids.
func referenceIds(properties *compose.OMap, data map[string]any, path string) []member {
	segments := strings.Split(path, ".")
	var ids []member
	var walk func(fields *compose.OMap, value any, index int)
	walk = func(fields *compose.OMap, value any, index int) {
		object, ok := value.(map[string]any)
		if fields == nil || !ok {
			return
		}
		name := segments[index]
		raw, declared := fields.Get(name)
		field, isField := raw.(*compose.OMap)
		item, present := object[name]
		if !declared || !isField || field == nil || !present {
			return
		}
		for _, element := range fieldValues(field, item) {
			if index < len(segments)-1 {
				walk(childProperties(field), element, index+1)
				continue
			}
			if id, ok := referenceID(element); ok {
				ids = append(ids, id)
			}
		}
	}
	walk(properties, data, 0)
	return ids
}

// fieldValues returns the values a field has in its data: each row of a repeated field, or the
// value itself.
func fieldValues(field *compose.OMap, value any) []any {
	if !fieldIsMultiple(field) {
		return []any{value}
	}
	rows, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	values := make([]any, 0, len(rows))
	for _, key := range sortedKeys(rows) {
		values = append(values, rows[key])
	}
	return values
}

// referenceID returns the member of an id: a string, a finite number or a boolean whose
// canonical text is not empty after trimming.
func referenceID(value any) (member, bool) {
	switch value.(type) {
	case string, bool:
	default:
		if _, finite := finiteNumber(value); !finite {
			return member{}, false
		}
	}
	m, ok := newMember(value)
	if !ok || trimText(m.text) == "" {
		return member{}, false
	}
	return m, true
}

// ruleReference fails a value that is not a member of the ids of its declaration path. Empty
// values pass.
func ruleReference(value any, ruleParam any, ctx ruleContext) (string, bool) {
	path, isPath := ruleParam.(string)
	if !isPath {
		// The parameter is checked when the specification loads.
		panic("crudui: reference receives a checked declaration path")
	}
	if isEmpty(value) {
		return "", false
	}
	ids, cached := ctx.call.referenceIds[path]
	if !cached {
		ids = referenceIds(ctx.call.properties, ctx.formData, path)
		ctx.call.referenceIds[path] = ids
	}
	if inMatches(value, ids) {
		return "", false
	}
	return ctx.msg("reference", "Please select an existing value."), true
}
