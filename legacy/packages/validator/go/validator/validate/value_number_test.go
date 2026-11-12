package validate

import (
	"encoding/json"
	"math"
	"testing"
)

func TestEveryGoNumericTypeIsANumber(t *testing.T) {
	for _, v := range []any{int(7), int8(7), int16(7), int32(7), int64(7), uint(7), uint8(7), uint16(7), uint32(7), uint64(7), uintptr(7), float32(7), float64(7), json.Number("7")} {
		if n, ok := numeric(v); !ok || n != 7 {
			t.Errorf("numeric(%T) = %v, %v; want 7", v, n, ok)
		}
		if text, ok := canonicalText(v); !ok || text != "7" {
			t.Errorf("canonicalText(%T) = %q, %v", v, text, ok)
		}
		if !isDigits(v) {
			t.Errorf("isDigits(%T) = false", v)
		}
		if perr := checkNumericParameter("step", v); perr != nil {
			t.Errorf("step %T: %s", v, perr.message)
		}
		if perr := checkNumericParameter("mincount", v); perr != nil {
			t.Errorf("mincount %T: %s", v, perr.message)
		}
	}
	if n, _ := numeric(uint64(9007199254740993)); n != 9007199254740992 {
		t.Errorf("an integer converts to the nearest double, got %v", n)
	}
	if _, ok := numeric(int8(-1)); !ok {
		t.Error("a negative int8 is numeric")
	}
}

func TestNumericText(t *testing.T) {
	accepted := map[string]float64{
		"12": 12, "-12": -12, "0.5": 0.5, ".5": 0.5, "1e5": 1e5, "1E-3": 1e-3, "-.5e+2": -50,
		"　 12\t": 12, "1e-400": 0, "007": 7, "-0": 0,
	}
	for text, want := range accepted {
		if got, ok := numeric(text); !ok || got != want {
			t.Errorf("numeric(%q) = %v, %v; want %v", text, got, ok, want)
		}
	}
	for _, text := range []string{"+1", "1.", "0x10", "Infinity", "NaN", "1_000", "١", "1e", "e5", "--1", "1e999", "-1e999", "1,5", "1 2", "", " ", "0b1", "1d", "inf"} {
		if _, ok := numeric(text); ok {
			t.Errorf("%q is not numeric text", text)
		}
	}
	for _, v := range []any{true, false, nil, []any{1.0}, map[string]any{}, math.Inf(1), math.NaN()} {
		if _, ok := numeric(v); ok {
			t.Errorf("%#v is not numeric", v)
		}
	}
}

func TestStepMultiplesAreExact(t *testing.T) {
	cases := []struct {
		value, step float64
		want        bool
	}{
		{0.3, 0.1, true},
		{0.30000000000000004, 0.1, false},
		{-0.6, 0.1, true},
		{0, 0.1, true},
		{math.Copysign(0, -1), 7, true},
		{1e21, 0.1, true},
		{2e-7, 0.1, false},
		{1.0000000001, 0.1, false},
		{1e21, 1e20, true},
		{1.5e21, 1e20, true},
		{1.05e21, 1e20, false},
		{2e-7, 2e-7, true},
		{3e-7, 2e-7, false},
		{1.75, 0.25, true},
		{1.8, 0.25, false},
		{5e-324, 5e-324, true},
		{1.7976931348623157e308, 5e-324, true},
		{1e308, 3, false},
		{9007199254740993, 2, true},
		{7, 2, false},
	}
	for _, c := range cases {
		if got := isStepMultiple(c.value, c.step); got != c.want {
			t.Errorf("isStepMultiple(%v, %v) = %v, want %v", c.value, c.step, got, c.want)
		}
	}
}

func TestDigitsAndCounts(t *testing.T) {
	for v, want := range map[any]bool{
		"123": true, " 123 ": true, "007": true, 42.0: true, 0.0: true, math.Copysign(0, -1): true, 1e20: true,
		"12a": false, "-1": false, "1.0": false, 1.5: false, 1e21: false, true: false, "١": false, "1 2": false, -3.0: false,
	} {
		if got := isDigits(v); got != want {
			t.Errorf("isDigits(%#v) = %v, want %v", v, got, want)
		}
	}
	if isDigits([]any{"1"}) || isDigits(nil) {
		t.Error("arrays and null are not digits")
	}

	counts := []struct {
		value any
		want  int
	}{
		{nil, 0}, {" ", 0}, {"", 0}, {"x", 1}, {0.0, 1}, {false, 1},
		{[]any{}, 0}, {[]any{"a", "b"}, 2}, {map[string]any{"a": 1.0}, 1},
	}
	for _, c := range counts {
		if got := countOf(c.value); got != c.want {
			t.Errorf("countOf(%#v) = %d, want %d", c.value, got, c.want)
		}
	}
}

func TestNumericParameters(t *testing.T) {
	bad := map[string][]any{
		"number":   {5.0, "true", nil},
		"digits":   {1.0},
		"min":      {true, "5", []any{5.0}, math.Inf(1)},
		"max":      {math.NaN(), map[string]any{}},
		"range":    {[]any{5.0, 1.0}, []any{1.0}, []any{1.0, 5.0, 9.0}, []any{nil, 5.0}, "1,5"},
		"step":     {0.0, -1.0, true, math.Inf(1)},
		"mincount": {1.5, -1.0, true, 9007199254740992.0},
		"maxcount": {"1"},
	}
	for rule, params := range bad {
		for _, param := range params {
			if checkNumericParameter(rule, param) == nil {
				t.Errorf("%s %#v must be rejected", rule, param)
			}
		}
	}
	good := map[string][]any{
		"number":   {true, false},
		"min":      {-0.5, 1e21, 0.0},
		"range":    {[]any{1.0, 1.0}, []any{-2.0, 3.5}},
		"step":     {5e-324, 1e20},
		"mincount": {0.0, 9007199254740991.0},
	}
	for rule, params := range good {
		for _, param := range params {
			if perr := checkNumericParameter(rule, param); perr != nil {
				t.Errorf("%s %#v: %s", rule, param, perr.message)
			}
		}
	}
}

func TestMessagesReplaceEveryPlaceholder(t *testing.T) {
	if got := withParameters("{0}..{1} ({0} to {1})", 2, 1e21); got != "2..1e+21 (2 to 1e+21)" {
		t.Errorf("got %q", got)
	}
	msg, failed := ruleRange(9.0, []any{2.0, 4.0}, ruleContext{messages: map[string]string{"range": "{0}-{1}/{0}-{1}"}})
	if !failed || msg != "2-4/2-4" {
		t.Errorf("ruleRange = %q, %v", msg, failed)
	}
}

func TestNumberRangeStepSizeAndIsStepMultipleDecideAsTheRules(t *testing.T) {
	if minimum, maximum, ok := NumberRange([]any{float64(1), float64(5)}); !ok || minimum != 1 || maximum != 5 {
		t.Errorf("NumberRange([1, 5]) = %v, %v, %v", minimum, maximum, ok)
	}
	if _, _, ok := NumberRange([]any{float64(5), float64(1)}); ok {
		t.Error("NumberRange([5, 1]) accepted a minimum above the maximum")
	}
	if step, ok := StepSize(0.5); !ok || step != 0.5 {
		t.Errorf("StepSize(0.5) = %v, %v", step, ok)
	}
	if _, ok := StepSize(float64(0)); ok {
		t.Error("StepSize(0) accepted a step that is not above 0")
	}
	if !IsStepMultiple(1.5, 0.5) || IsStepMultiple(1.25, 0.5) {
		t.Error("IsStepMultiple did not decide 1.5 and 1.25 against the step 0.5")
	}
}
