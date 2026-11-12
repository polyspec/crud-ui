package generator

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// readSuite decodes every case of one shared suite from legacy/tests/fixtures/<suite>/cases.json, in file order.
func readSuite(t *testing.T, suite string) []*Object {
	t.Helper()
	repository, err := filepath.Abs("../../../..")
	if err != nil {
		t.Fatal(err)
	}
	source, err := os.ReadFile(filepath.Join(repository, "legacy/tests/fixtures", suite, "cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	v, err := DecodeJSON(source)
	if err != nil {
		t.Fatal(err)
	}
	raw, ok := v.([]any)
	if !ok {
		t.Fatalf("the %s cases must be a list", suite)
	}
	cases := make([]*Object, len(raw))
	for i, item := range raw {
		c := object(item)
		if c == nil {
			t.Fatalf("a %s case must be an object", suite)
		}
		cases[i] = c
	}
	return cases
}

// caseFiles reads the files option of a case: each name maps to its object, nil when the value is not an object.
func caseFiles(options *Object) map[string]*Object {
	files := map[string]*Object{}
	if f := object(optionValue(options, "files")); f != nil {
		for _, name := range f.Keys() {
			files[name] = object(read(f, name))
		}
	}
	return files
}

// checkRecordedFailure asserts that a failed case raises the recorded code and message.
func checkRecordedFailure(t *testing.T, c *Object, err error) {
	t.Helper()
	want := object(read(c, "expectError"))
	if err == nil {
		t.Fatalf("want the error %s, but the case rendered", stringAt(want, "code"))
	}
	if got := failureCode(t, err); got != stringAt(want, "code") {
		t.Fatalf("code %s, want %s: %v", got, stringAt(want, "code"), err)
	}
	if got := failureMessage(err); got != stringAt(want, "message") {
		t.Fatalf("message %q, want %q", got, stringAt(want, "message"))
	}
}

// TestFormCompleteSuite runs every case of the shared form-complete suite through the Go generator. A result case
// compiles, binds and renders its complete form with the render options of the case, and its HTML must equal the
// recorded HTML byte for byte; a failure case must raise the recorded code and message.
func TestFormCompleteSuite(t *testing.T) {
	cases := readSuite(t, "form-complete")
	if len(cases) != 28 {
		t.Fatalf("form-complete has %d cases, want 28", len(cases))
	}
	for _, c := range cases {
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			html, err := renderFormCase(c, read(c, "render"))
			if has(c, "expectError") {
				checkRecordedFailure(t, c, err)
				return
			}
			if err != nil {
				t.Fatalf("render failed: %v", err)
			}
			if want := stringAt(c, "expected_html"); html != want {
				t.Fatalf("html differs %s", firstDifference(html, want))
			}
		})
	}
}

// preloadLink matches the image preload links that a list or detail writes before its body.
var preloadLink = regexp.MustCompile(`<link [^>]*rel="preload"[^>]*>`)

// withoutPreloads returns the rendered HTML without its image preload links, as the shared suites compare the body.
func withoutPreloads(html string) string {
	return preloadLink.ReplaceAllString(html, "")
}

// checkRecordedMessage asserts that a failed list or detail case raises the recorded code and a message that
// contains the recorded message, as the shared list and detail suites do.
func checkRecordedMessage(t *testing.T, c *Object, err error) {
	t.Helper()
	want := object(read(c, "expectError"))
	if err == nil {
		t.Fatalf("want the error %s, but the case rendered", stringAt(want, "code"))
	}
	if got := failureCode(t, err); got != stringAt(want, "code") {
		t.Fatalf("code %s, want %s: %v", got, stringAt(want, "code"), err)
	}
	if message := stringAt(want, "message"); message != "" && !strings.Contains(err.Error(), message) {
		t.Fatalf("message %q does not contain %q", err.Error(), message)
	}
}
