package validate

import (
	"math"
	"testing"
	"unicode"
)

// specWhitespace is the White_Space list as docs/spec/validation-rules.md writes it.
var specWhitespace = []rune{
	0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0x85, 0xA0, 0x1680,
	0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
	0x2028, 0x2029, 0x202F, 0x205F, 0x3000,
}

// TestWhitespaceIsTheSpecifiedSet checks isWhitespace against the list the
// specification writes, over every code point.
func TestWhitespaceIsTheSpecifiedSet(t *testing.T) {
	want := map[rune]bool{}
	for _, r := range specWhitespace {
		want[r] = true
	}
	for r := rune(0); r <= unicode.MaxRune; r++ {
		if isWhitespace(r) != want[r] {
			t.Errorf("isWhitespace(U+%04X) = %v", r, isWhitespace(r))
		}
	}
}

func TestTrimTextRemovesOnlyOuterWhitespace(t *testing.T) {
	cases := map[string]string{
		"":                                "",
		"\u3000\t\u00a0x y\u2028 ":        "x y",
		"\u200bx\ufeff":                   "\u200bx\ufeff",
		"\u0000 x \u0000":                 "\u0000 x \u0000",
		"\u180e":                          "\u180e",
		"\u0085\u1680\u202f\u205fx\u000b": "x",
	}
	for in, want := range cases {
		if got := trimText(in); got != want {
			t.Errorf("trimText(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsEmpty(t *testing.T) {
	empty := []any{nil, "", " ", "\u3000\u2029", []any{}, map[string]any{}}
	supplied := []any{0.0, false, "\u0000", "\u200b", "\ufeff", "\u180e", []any{nil}, map[string]any{"a": nil}, "x"}
	for _, v := range empty {
		if !isEmpty(v) {
			t.Errorf("isEmpty(%#v) = false", v)
		}
	}
	for _, v := range supplied {
		if isEmpty(v) {
			t.Errorf("isEmpty(%#v) = true", v)
		}
	}
}

// TestCanonicalNumber compares CanonicalNumber with the text ECMAScript
// String(number) writes for the same doubles (taken from Node.js).
func TestCanonicalNumber(t *testing.T) {
	cases := []struct {
		value float64
		want  string
	}{
		{0, "0"},
		{math.Copysign(0, -1), "0"},
		{1, "1"},
		{-1, "-1"},
		{12, "12"},
		{1.5, "1.5"},
		{0.30000000000000004, "0.30000000000000004"},
		{1e+21, "1e+21"},
		{1e-7, "1e-7"},
		{0.000001, "0.000001"},
		{123456789012345680000, "123456789012345680000"},
		{100000000000000000000, "100000000000000000000"},
		{1e+300, "1e+300"},
		{-1e-300, "-1e-300"},
		{5e-324, "5e-324"},
		{-5e-324, "-5e-324"},
		{1.7976931348623157e+308, "1.7976931348623157e+308"},
		{9007199254740992, "9007199254740992"},
		{9007199254740994, "9007199254740994"},
		{9223372036854776000, "9223372036854776000"},
		{9007199254740993, "9007199254740992"},
		{18446744073709552000, "18446744073709552000"},
		{0.1, "0.1"},
		{100, "100"},
		{1000000, "1000000"},
		{0.0000123, "0.0000123"},
		{0.0000015, "0.0000015"},
		{999999999999999900000, "999999999999999900000"},
		{123000000000000000000, "123000000000000000000"},
		{4.35, "4.35"},
		{0.000123, "0.000123"},
		{-1e-7, "-1e-7"},
		{0.3333333333333333, "0.3333333333333333"},
		{0.6666666666666666, "0.6666666666666666"},
		{3.141592653589793, "3.141592653589793"},
		{2.718281828459045, "2.718281828459045"},
		{1.000000000000001e+21, "1.000000000000001e+21"},
		{1.0000000000000002, "1.0000000000000002"},
		{4294967295, "4294967295"},
		{4294967296.5, "4294967296.5"},
		{0.0000025, "0.0000025"},
		{1.2345e-7, "1.2345e-7"},
		{-1.5e+300, "-1.5e+300"},
	}
	for _, c := range cases {
		if got := CanonicalNumber(c.value); got != c.want {
			t.Errorf("CanonicalNumber(%v) = %q, want %q", c.value, got, c.want)
		}
	}
}

func TestCanonicalText(t *testing.T) {
	cases := []struct {
		value any
		want  string
	}{
		{"", ""},
		{" x ", " x "},
		{true, "1"},
		{false, "0"},
		{12.0, "12"},
		{12, "12"},
		{int64(-7), "-7"},
		{float32(1.5), "1.5"},
		{int64(9007199254740993), "9007199254740992"},
		{int64(9223372036854775807), "9223372036854776000"},
		{uint64(18446744073709551615), "18446744073709552000"},
	}
	for _, c := range cases {
		got, ok := canonicalText(c.value)
		if !ok || got != c.want {
			t.Errorf("canonicalText(%#v) = %q, %v; want %q", c.value, got, ok, c.want)
		}
	}
	for _, v := range []any{nil, []any{"a"}, map[string]any{}, math.NaN(), math.Inf(1), math.Inf(-1)} {
		if got, ok := canonicalText(v); ok {
			t.Errorf("canonicalText(%#v) = %q; want no canonical text", v, got)
		}
	}
}

func TestLengthLimits(t *testing.T) {
	for _, v := range []any{0.0, 1.0, 9007199254740991.0, math.Copysign(0, -1), 3} {
		if _, ok := lengthLimit(v); !ok {
			t.Errorf("lengthLimit(%#v) rejected", v)
		}
	}
	for _, v := range []any{-1.0, 1.5, 9007199254740992.0, math.NaN(), math.Inf(1), "5", true, nil, []any{1.0}} {
		if _, ok := lengthLimit(v); ok {
			t.Errorf("lengthLimit(%#v) accepted", v)
		}
	}
	for _, v := range []any{[]any{0.0, 0.0}, []any{1.0, 2.0}} {
		if _, _, ok := lengthRange(v); !ok {
			t.Errorf("lengthRange(%#v) rejected", v)
		}
	}
	for _, v := range []any{[]any{2.0, 1.0}, []any{1.0}, []any{1.0, 2.0, 3.0}, []any{1.0, "2"}, "1,2"} {
		if _, _, ok := lengthRange(v); ok {
			t.Errorf("lengthRange(%#v) accepted", v)
		}
	}
}

func TestTextLengthCountsCodePoints(t *testing.T) {
	cases := map[any]float64{
		"\U0001F600":                 1,
		"e\u0301":                    2,
		"\U0001F468\u200d\U0001F469": 3,
		"\ud55c\uae00":               2,
		"a\u0000b":                   3,
		" x ":                        3,
		1e21:                         5,
		true:                         1,
		-0.5:                         4,
	}
	for v, want := range cases {
		if got, ok := textLength(v); !ok || got != want {
			t.Errorf("textLength(%#v) = %v, %v; want %v", v, got, ok, want)
		}
	}
}

func TestInMembership(t *testing.T) {
	members, perr := inMembers(" 1.0 ,x, true")
	if perr != nil {
		t.Fatal(perr.message)
	}
	for _, v := range []any{1.0, "1", " 1e0 ", ".1e1", "x", " x\u3000", "true", []any{"x", 1.0}, []any{"x", "", nil, " ", []any{}, map[string]any{}}, []any{nil}} {
		if !inMatches(v, members) {
			t.Errorf("%#v should be a member", v)
		}
	}
	for _, v := range []any{"X", true, " +1. ", "1.", "0x1", []any{"x", "y"}, []any{"x", []any{"x"}}, []any{map[string]any{"a": "x"}}, []any{"x", "y"}, map[string]any{"x": 1.0}, "01.00x"} {
		if inMatches(v, members) {
			t.Errorf("%#v should not be a member", v)
		}
	}

	// List members are read as written: " 2" is not numeric text, and a trimmed
	// value never equals it. Values match by value when they are numeric text
	// after trimming, and booleans only by canonical text.
	members, _ = inMembers([]any{" 2", "-0", false, 1e21})
	for _, v := range []any{"0", 0.0, "-0.0e5", false, 1e21, "1e+21", "1000000000000000000000"} {
		if !inMatches(v, members) {
			t.Errorf("%#v should be a member of the list", v)
		}
	}
	for _, v := range []any{"0.", "+2", true, 1e21 + 1e6, 2.0, "2", " 2", "2e0"} {
		if inMatches(v, members) {
			t.Errorf("%#v should not be a member of the list", v)
		}
	}

	errorsByParam := map[string]any{
		"Invalid in parameter: expected a list, a comma-separated string or a map": 5.0,
		"Invalid in parameter: members must be strings, numbers or booleans":       []any{map[string]any{}},
		"Invalid in parameter: members must not be empty":                          "a, ,b",
	}
	for want, param := range errorsByParam {
		if perr := checkIn(param); perr == nil || perr.message != want {
			t.Errorf("checkIn(%#v) = %v, want %q", param, perr, want)
		}
	}
	if perr := checkIn([]any{math.NaN()}); perr == nil {
		t.Error("a nonfinite member must be rejected")
	}
	for _, param := range []any{[]any{}, map[string]any{}} {
		empty, perr := inMembers(param)
		if perr != nil {
			t.Fatalf("inMembers(%#v) = %v, want an empty member set", param, perr)
		}
		for _, v := range []any{"a", "0", 0.0, true, false} {
			if inMatches(v, empty) {
				t.Errorf("%#v should not be a member of an empty member set", v)
			}
		}
	}
}
