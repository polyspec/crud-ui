package validate

// Recursive forbidden-key scanning verifies the shared four-runtime fixture.
//
// legacy/tests/fixtures/spec-validity/cases.json defines SPEC §6 meta-key rejection.
// A clean specification passes; a
// forbidden meta key found at ANY depth (slot/bucket body and one level below,
// deep child subtrees, array elements, $ref-inherited bases) is a LOAD ERROR,
// never valid:true. JS / PHP / Go / Rust load this ONE file and must reproduce
// it identically. This test re-runs the real load path
// (ValidateJSON = compose → forbidden-scan → validate) against it.
//
// Each case declares `engine`: "pass" requires no load error and valid:true with
// no errors, or {code, at}
// requires a *compose.ComposeLoadError whose Code is code and whose dotted Trace
// is at. The case `files` are the composition files passed to the runtime.

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/internal/conformance"
)

type forbiddenScanCase struct {
	Name   string          `json:"name"`
	Note   string          `json:"note"`
	Spec   json.RawMessage `json:"spec"`
	Files  json.RawMessage `json:"files"`
	Engine json.RawMessage `json:"engine"`
}

// engineError is the {code, at} object form of a fixture engine expectation.
type engineError struct {
	Code *string `json:"code"`
	At   *string `json:"at"`
}

func loadForbiddenScanFixtures(t *testing.T) []forbiddenScanCase {
	t.Helper()
	// legacy/packages/validator/go/validator/validate → repo root is four levels up.
	path := filepath.Join("..", "..", "..", "..", "..", "tests", "fixtures", "spec-validity", "cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("shared spec-validity fixture not found at %s: %v", path, err)
	}
	var cases []forbiddenScanCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatalf("fixture json decode: %v", err)
	}
	if len(cases) == 0 {
		t.Fatal("fixture is empty")
	}
	return cases
}

// filesFor decodes the optional fixture files map into the { key: rawJSON } shape
// ValidateJSON consumes.
func filesFor(t *testing.T, c forbiddenScanCase) map[string][]byte {
	t.Helper()
	files := map[string][]byte{}
	if len(c.Files) == 0 {
		return files
	}
	var fm map[string]json.RawMessage
	if err := json.Unmarshal(c.Files, &fm); err != nil {
		t.Fatalf("%s: files decode: %v", c.Name, err)
	}
	for k, v := range fm {
		files[k] = []byte(v)
	}
	return files
}

// enginePasses reports whether the fixture engine field is the literal string "pass".
func enginePasses(raw json.RawMessage) bool {
	var s string
	return json.Unmarshal(raw, &s) == nil && s == "pass"
}

func TestForbiddenScanMatchesFixture(t *testing.T) {
	for _, c := range loadForbiddenScanFixtures(t) {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			conformance.Record(t, "validate", "legacy/tests/fixtures/spec-validity/cases.json", c.Name)
			// Data is irrelevant to the scan; pass empty. The scan runs in the load
			// path before any data-driven validation.
			res, err := ValidateJSON(c.Spec, nil, filesFor(t, c), "")

			if enginePasses(c.Engine) {
				if err != nil {
					t.Fatalf("clean spec must pass the load path, got error: %v", err)
				}
				if !res.Valid || len(res.Errors) != 0 {
					t.Fatalf("%s: expected valid:true with no errors, got %+v", c.Name, res)
				}
				return
			}

			var want engineError
			if uerr := json.Unmarshal(c.Engine, &want); uerr != nil || want.Code == nil || want.At == nil {
				t.Fatalf("%s: engine must be \"pass\" | {code, at}, got %s", c.Name, c.Engine)
			}
			if err == nil {
				t.Fatalf("expected load error %s at %s, but validated successfully", *want.Code, *want.At)
			}
			var le *compose.ComposeLoadError
			ok := errors.As(err, &le)
			if !ok {
				t.Fatalf("expected *compose.ComposeLoadError, got %T: %v", err, err)
			}
			if string(le.Code) != *want.Code {
				t.Fatalf("error code mismatch: expected %s, got %s (%s)", *want.Code, le.Code, le.Message)
			}
			gotPath := strings.Join(le.Trace, ".")
			if gotPath != *want.At {
				t.Fatalf("error path mismatch: expected %s, got %s", *want.At, gotPath)
			}
		})
	}
}
