package generator

import (
	"path/filepath"
	"testing"
)

// renderDetailCase renders one detail case with the specification, the record and the options of the case.
func renderDetailCase(c *Object) (string, error) {
	options := object(read(c, "options"))
	language, err := caseText(options, "language")
	if err != nil {
		return "", err
	}
	return RenderDetail(object(read(c, "spec")), object(read(c, "record")), DetailOptions{
		Language: language,
		Data:     optionValue(options, "data"),
		Page:     optionValue(options, "page"),
		Total:    optionValue(options, "total"),
		Layout:   optionValue(options, "layout"),
		Files:    caseFiles(options),
	})
}

// TestDetailRenderSuite runs every case of the shared detail-render suite through the Go generator. A result case
// renders its detail; the body without the image preload links and the recorded HTML are compared as the normalized
// layout of legacy/tests/fixtures/form-render/normalize.mts, as the TypeScript and Python runners compare them. A failure
// case must raise the recorded code and a message that contains the recorded message.
func TestDetailRenderSuite(t *testing.T) {
	repository, err := filepath.Abs("../../../..")
	if err != nil {
		t.Fatal(err)
	}
	cases := readSuite(t, "detail-render")
	if len(cases) != 68 {
		t.Fatalf("detail-render has %d cases, want 68", len(cases))
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
		html, renderErrors[i] = renderDetailCase(c)
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
			_, err := renderDetailCase(c)
			checkRecordedMessage(t, c, err)
		})
	}
}
