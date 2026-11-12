package validate

// List structure conformance verifies the Go runtime against
// legacy/tests/fixtures/list-validity/cases.json. Each case declares `engine`:
// "pass" (no load error, valid:true, no errors) or {code, at} (a
// *compose.ComposeLoadError with that code whose trace joined by "." is at).
// The case `files` are the composition files passed to the runtime.

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

type listValidityCase struct {
	Name   string                     `json:"name"`
	Engine json.RawMessage            `json:"engine"`
	Files  map[string]json.RawMessage `json:"files"`
	Spec   json.RawMessage            `json:"spec"`
}

func loadListValidityFixtures(t *testing.T) []listValidityCase {
	t.Helper()
	path := filepath.Join("..", "..", "..", "..", "..", "tests", "fixtures", "list-validity", "cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("shared list-validity fixture not found at %s: %v", path, err)
	}
	var cases []listValidityCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatalf("fixture json decode: %v", err)
	}
	if len(cases) == 0 {
		t.Fatal("fixture is empty")
	}
	return cases
}

func TestValidateListMatchesFixture(t *testing.T) {
	for _, c := range loadListValidityFixtures(t) {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			conformance.Record(t, "validateList", "legacy/tests/fixtures/list-validity/cases.json", c.Name)
			if len(c.Engine) == 0 {
				t.Fatalf("%s: case must declare engine", c.Name)
			}
			files := map[string][]byte{}
			for k, v := range c.Files {
				files[k] = []byte(v)
			}
			res, err := ValidateListJSON(c.Spec, files, "")

			var pass string
			if json.Unmarshal(c.Engine, &pass) == nil {
				if pass != "pass" {
					t.Fatalf("%s: engine string must be \"pass\", got %q", c.Name, pass)
				}
				if err != nil {
					t.Fatalf("%s: expected pass, got error: %v", c.Name, err)
				}
				if !res.Valid || len(res.Errors) != 0 {
					t.Fatalf("%s: expected valid:true with no errors, got %+v", c.Name, res)
				}
				return
			}

			var want struct {
				Code *string `json:"code"`
				At   *string `json:"at"`
			}
			if uerr := json.Unmarshal(c.Engine, &want); uerr != nil || want.Code == nil || want.At == nil {
				t.Fatalf("%s: engine must be \"pass\" or {code, at}, got %s", c.Name, c.Engine)
			}
			var le *compose.ComposeLoadError
			ok := errors.As(err, &le)
			if !ok {
				t.Fatalf("%s: expected *compose.ComposeLoadError, got %T: %v", c.Name, err, err)
			}
			if string(le.Code) != *want.Code {
				t.Fatalf("%s: code want %s, got %s (%s)", c.Name, *want.Code, le.Code, le.Message)
			}
			if got := strings.Join(le.Trace, "."); got != *want.At {
				t.Fatalf("%s: at want %s, got %s", c.Name, *want.At, got)
			}
		})
	}
}

// TestValidateListCleanListIsValid pins the no-rows semantics: a clean list-spec
// (composes + scans clean) is valid:true with an empty error set — a list carries
// no rows, so there is no DATA pass to produce field errors.
func TestValidateListCleanListIsValid(t *testing.T) {
	spec := []byte(`{"columns":{"name":{"field":"name","label":"Name"}}}`)
	res, err := ValidateListJSON(spec, nil, "")
	if err != nil {
		t.Fatalf("clean list must not error: %v", err)
	}
	if !res.Valid {
		t.Fatalf("clean list must be valid:true, got %v", res.Valid)
	}
	if len(res.Errors) != 0 {
		t.Fatalf("clean list must carry no errors (no rows → no DATA pass), got %d", len(res.Errors))
	}
}

// TestValidateListForbiddenTraceIntoListTree pins that the forbidden-scan trace
// is the path from the list root to the offending key, so a load failure says
// WHERE in the list a forbidden key sits.
func TestValidateListForbiddenTraceIntoListTree(t *testing.T) {
	spec := []byte(`{"columns":{"name":{"field":"name"},"display_switch":{"field":"x"}}}`)
	_, err := ValidateListJSON(spec, nil, "")
	var le *compose.ComposeLoadError
	ok := errors.As(err, &le)
	if !ok {
		t.Fatalf("expected *compose.ComposeLoadError, got %T: %v", err, err)
	}
	got := strings.Join(le.Trace, ".")
	want := "columns.display_switch"
	if got != want {
		t.Fatalf("forbidden trace: want %s, got %s", want, got)
	}
}
