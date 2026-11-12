package expr

import "testing"

func TestIsConditionExpression(t *testing.T) {
	for _, s := range []string{".active", "..state", "flags.active", "count >= 2", "status not in ['off']", "true ? 'a' : 'b'"} {
		if !IsConditionExpression(s) {
			t.Errorf("Expected expression: %q", s)
		}
	}
	for _, s := range []any{"active", "text-primary", "color: red", "width:calc(1 + 2)", false, nil} {
		if IsConditionExpression(s) {
			t.Errorf("Expected literal: %#v", s)
		}
	}
}

func TestExpressionRecognitionUsesSharedWhitespace(t *testing.T) {
	for _, s := range []string{"\ufeff .active ", "count\u00a0>=\u00a02", "count\u202fnot\u202fin\u202f[1]"} {
		if !IsConditionExpression(s) {
			t.Errorf("Expression not recognized: %q", s)
		}
	}
	for _, s := range []string{"count\u0085>=\u00852", "a?b\rc:d", "a?b\u2028c:d"} {
		if IsConditionExpression(s) {
			t.Errorf("Literal recognized as an expression: %q", s)
		}
	}
}
