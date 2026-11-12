package validate

// Whitespace, trimming and emptiness (docs/spec/validation-rules.md, Values).
//
// Whitespace is exactly the White_Space code points of the embedded Unicode data
// (unicode_data.go). Every rule in this package uses these definitions and no
// other notion of whitespace or emptiness.

import "strings"

// isWhitespace reports whether r has the Unicode White_Space property.
func isWhitespace(r rune) bool {
	return containsRune(unicodeWhiteSpace, r)
}

// trimText removes leading and trailing whitespace and nothing else.
func trimText(s string) string {
	return strings.TrimFunc(s, isWhitespace)
}

// isEmpty reports an empty value: missing or null, a string that is empty after
// trimming, an empty array or an empty object. 0 and false are supplied values.
func isEmpty(value any) bool {
	switch v := value.(type) {
	case nil:
		return true
	case string:
		return trimText(v) == ""
	case []any:
		return len(v) == 0
	case map[string]any:
		return len(v) == 0
	default:
		return false
	}
}
