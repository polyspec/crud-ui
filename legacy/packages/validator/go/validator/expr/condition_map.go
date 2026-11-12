package expr

// Condition-map resolver (expressions.md §8). A thin wrapper over the
// expression engine — NOT a separate parser.
//
// A condition map is an ordered list of {Expr: value, …}. Keys (each a §2
// expression) are evaluated in declaration order; the first truthy key's value
// wins. On a miss the literal `true` key's value is used if present, else nil.
//
// Go maps do not preserve insertion order, so declaration order is carried by an
// explicit []ConditionEntry slice (the caller controls the order).
//
// The `true` default key is the literal expression `true` (always truthy); R4
// forbids convention sigils such as `_`. The value is returned verbatim
// (bool | string | number | nil) — the call site decides the expected type.

// DefaultKey is the literal expression used as the condition-map default.
const DefaultKey = "true"

// ConditionEntry is one ordered expr→value pair of a condition map.
type ConditionEntry struct {
	Expr  string
	Value any
}

// ResolveConditionMap resolves an ordered condition map against form data.
// Declaration order is the slice order. The default key (literal "true") is
// matched by text, not by evaluation, so it never short-circuits an earlier real
// condition. Returns (value, nil) on a default fallthrough miss with no default
// key present.
func ResolveConditionMap(entries []ConditionEntry, formData map[string]any, currentPath []string, rowKeys []int) (any, error) {
	evaluator := NewEvaluator(formData, currentPath, rowKeys)

	var defaultValue any
	hasDefault := false

	for _, entry := range entries {
		if entry.Expr == DefaultKey {
			defaultValue = entry.Value
			hasDefault = true
			continue
		}
		ast, err := Parse(entry.Expr)
		if err != nil {
			return nil, err
		}
		if evaluator.Evaluate(ast) {
			return entry.Value, nil
		}
	}

	if hasDefault {
		return defaultValue, nil
	}
	return nil, nil
}
