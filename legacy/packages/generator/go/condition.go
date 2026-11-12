package generator

import (
	"fmt"
	"strings"
)

// conditionText is the condition text of a condition field value (docs/spec/form-markup.md,
// Condition fields): a string is itself, null and an absent value are empty, and any other value
// is the JSON text that ECMAScript's JSON.stringify writes for it.
func conditionText(v any) string {
	if v == nil || isAbsent(v) {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	var b strings.Builder
	writeConditionJSON(&b, v)
	return b.String()
}

// writeConditionJSON writes the JSON.stringify text of a data value: object members in their
// order, no whitespace, numbers in ECMAScript's shortest form.
func writeConditionJSON(b *strings.Builder, v any) {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if x {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case string:
		writeJSONString(b, x)
	case *Object:
		b.WriteByte('{')
		for i, k := range x.Keys() {
			if i > 0 {
				b.WriteByte(',')
			}
			writeJSONString(b, k)
			b.WriteByte(':')
			writeConditionJSON(b, read(x, k))
		}
		b.WriteByte('}')
	case []any:
		b.WriteByte('[')
		for i, item := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			writeConditionJSON(b, item)
		}
		b.WriteByte(']')
	default:
		n, ok := asNumber(x)
		if !ok {
			// Data is decoded JSON, which holds no other value.
			panic(fmt.Sprintf("conditionText: %T is no JSON value", v))
		}
		b.WriteString(numberString(n))
	}
}

// checkConditionDeclaration rejects a condition field whose validate.conditionTree is not the
// literal true or judge (docs/spec/schema.md, Condition fields).
func checkConditionDeclaration(spec *Object, path string) error {
	parameter := read(read(spec, "validate"), "conditionTree")
	if parameter != true && parameter != "judge" {
		return inputError("Invalid validate.conditionTree at %s: expected true or judge", path)
	}
	return nil
}
