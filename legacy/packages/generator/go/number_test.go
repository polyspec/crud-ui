package generator

import (
	"math"
	"testing"
)

func TestFixedNumberExactBinaryRounding(t *testing.T) {
	cases := []struct {
		value  float64
		places int
		want   string
	}{{2.5, 0, "3"}, {-2.5, 0, "-3"}, {1.005, 2, "1.00"}, {2.675, 2, "2.67"}, {-0.001, 2, "-0.00"}, {math.Copysign(0, -1), 2, "0.00"}, {1e21, 2, "1e+21"}, {1000000000000000128, 0, "1000000000000000128"}, {1.25, 1, "1.3"}}
	for _, c := range cases {
		if got := fixedNumber(c.value, c.places); got != c.want {
			t.Errorf("%v at %d: %q != %q", c.value, c.places, got, c.want)
		}
	}
}
func TestNumberStringExponentThresholds(t *testing.T) {
	cases := []struct {
		value float64
		want  string
	}{{1e21, "1e+21"}, {1e20, "100000000000000000000"}, {1e-6, "0.000001"}, {1e-7, "1e-7"}, {math.Copysign(0, -1), "0"}}
	for _, c := range cases {
		if got := numberString(c.value); got != c.want {
			t.Errorf("%v: %q != %q", c.value, got, c.want)
		}
	}
}

func TestNumberStringConversion(t *testing.T) {
	cases := []struct{ input, want string }{
		{"0x10", "16"}, {"0b101", "5"}, {"0o17", "15"},
		{"0xbeddbd88a491d408d0415072f52b9a13fda", "1.0391742914815888e+42"},
		{"\ufeff\u00a0 1.25\u2028", "1.25"}, {"", "0"}, {"-.5", "-0.5"},
	}
	for _, c := range cases {
		number, ok := parseNumberString(c.input)
		if !ok || numberString(number) != c.want {
			t.Errorf("%q: %v (%v), want %q", c.input, number, ok, c.want)
		}
	}
	for _, invalid := range []string{"0x1p2", "0b102", "0o8", "+0x10", "1_000", "Inf", "\u00851\u0085"} {
		if _, ok := parseNumberString(invalid); ok {
			t.Errorf("accepted %q", invalid)
		}
	}
}

// The relations of a dynamic source are written as JSON.stringify writes them: -0 as 0, a Go integer and a
// float by numberString, and a string with only the quote, the backslash and the control characters escaped.
func TestSourceRelationsWriteJSONStringifyText(t *testing.T) {
	items := NewObject("model", "Doc", "relations", []any{math.Copysign(0, -1), 1e21, 3, NewObject("q<", "a&b \"\\\n\u0001")})
	want := `[0,1e+21,3,{"q<":"a&b` + " " + `\"\\\n\u0001"}]`
	if got := stringAt(sourceAttrs(items), "data-source-relations"); got != want {
		t.Errorf("relations %q, want %q", got, want)
	}
}
