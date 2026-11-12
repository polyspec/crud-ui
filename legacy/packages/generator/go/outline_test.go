package generator

import (
	"encoding/json"
	"os"
	"testing"
)

// TestOutlineFixture checks that BuildOutline reproduces the rows of the shared structure map cases for the nodes that
// BindForm returns.
func TestOutlineFixture(t *testing.T) {
	source, err := os.ReadFile("../../../tests/fixtures/form-outline/cases.json")
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := DecodeJSON(source)
	if err != nil {
		t.Fatal(err)
	}
	cases := list(decoded)
	if len(cases) == 0 {
		t.Fatal("form-outline cases are empty")
	}
	// Each case is a subtest named by the case, which the parity check reads as TestOutlineFixture/<case>.
	for _, item := range cases {
		t.Run(stringAt(item, "name"), func(t *testing.T) {
			template, err := CompileForm(object(read(item, "spec")), CompileOptions{})
			if err != nil {
				t.Fatal(err)
			}
			options := object(read(item, "options"))
			nodes, err := BindForm(template, object(read(item, "data")), BindOptions{Language: read(options, "language")})
			if err != nil {
				t.Fatal(err)
			}
			actual, err := json.Marshal(BuildOutline(nodes))
			if err != nil {
				t.Fatal(err)
			}
			expected, err := json.Marshal(read(item, "expected_outline_rows"))
			if err != nil {
				t.Fatal(err)
			}
			if string(actual) != string(expected) {
				t.Errorf("actual   %s\nexpected %s", actual, expected)
			}
		})
	}
}
