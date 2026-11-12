package validate

// Pattern rules pattern and match (docs/spec/validation-rules.md, Patterns): the
// whole canonical text of the value must match the declared pattern, which
// checkParameter recognized and compiled before the rule runs (pattern_match.go).

// ruleMatch fails a value whose canonical text does not wholly match the
// pattern; a value without canonical text (an array or an object) fails. Empty
// values pass. The message is messages[ruleName], the declared rule name only,
// then the default.
func ruleMatch(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	if text, ok := canonicalText(value); ok && ctx.pattern.matches(text) {
		return "", false
	}
	if m, ok := ctx.messages[ctx.ruleName]; ok {
		return m, true
	}
	return "Please enter a valid format.", true
}
