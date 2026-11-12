package generator

import (
	"path/filepath"
	"testing"
)

// renderListCase renders one list case with the specification, the rows and the options of the case.
func renderListCase(c *Object) (string, error) {
	options := object(read(c, "options"))
	language, err := caseText(options, "language")
	if err != nil {
		return "", err
	}
	return RenderList(object(read(c, "spec")), read(c, "rows"), ListOptions{
		Language: language,
		Data:     optionValue(options, "data"),
		Page:     optionValue(options, "page"),
		Total:    optionValue(options, "total"),
		Layout:   optionValue(options, "layout"),
		Files:    caseFiles(options),
	})
}

// TestListRenderSuite runs every case of the shared list-render suite through the Go generator. A result case renders
// its list; the body without the image preload links and the recorded HTML are compared as the normalized layout of
// legacy/tests/fixtures/form-render/normalize.mts, as the TypeScript and Python runners compare them. A failure case must
// raise the recorded code and a message that contains the recorded message.
func TestListRenderSuite(t *testing.T) {
	repository, err := filepath.Abs("../../../..")
	if err != nil {
		t.Fatal(err)
	}
	cases := readSuite(t, "list-render")
	if len(cases) != 165 {
		t.Fatalf("list-render has %d cases, want 165", len(cases))
	}
	var results, failures []*Object
	for _, c := range cases {
		if has(c, "expectError") {
			failures = append(failures, c)
		} else {
			results = append(results, c)
		}
	}
	actual := make([]string, len(results))
	renderErrors := make([]error, len(results))
	for i, c := range results {
		var html string
		html, renderErrors[i] = renderListCase(c)
		actual[i] = withoutPreloads(html)
	}
	expected := make([]string, len(results))
	for i, c := range results {
		expected[i] = stringAt(c, "expected_html")
	}
	normalized := normalizeLayouts(t, repository, append(append([]string{}, actual...), expected...))
	half := len(results)
	for i, c := range results {
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			if renderErrors[i] != nil {
				t.Fatalf("render failed: %v", renderErrors[i])
			}
			if normalized[i] != normalized[half+i] {
				t.Fatalf("layout differs %s", firstDifference(normalized[i], normalized[half+i]))
			}
		})
	}
	for _, c := range failures {
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			_, err := renderListCase(c)
			checkRecordedMessage(t, c, err)
		})
	}
}
