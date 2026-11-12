package validate

// Detail structure conformance verifies the Go runtime against
// legacy/tests/fixtures/detail-validity/cases.json. Each case declares `engine`:
// "pass" (no load error, valid:true, no errors) or {code, at} (a
// *compose.ComposeLoadError with that code whose trace joined by "." is at).

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

type detailValidityCase struct {
	Name   string                     `json:"name"`
	Engine json.RawMessage            `json:"engine"`
	Files  map[string]json.RawMessage `json:"files"`
	Spec   json.RawMessage            `json:"spec"`
}

func loadDetailValidityFixtures(t *testing.T) []detailValidityCase {
	t.Helper()
	path := filepath.Join("..", "..", "..", "..", "..", "tests", "fixtures", "detail-validity", "cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("shared detail-validity fixture not found at %s: %v", path, err)
	}
	var cases []detailValidityCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatalf("fixture json decode: %v", err)
	}
	if len(cases) == 0 {
		t.Fatal("fixture is empty")
	}
	return cases
}

func TestValidateDetailMatchesFixture(t *testing.T) {
	for _, c := range loadDetailValidityFixtures(t) {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			conformance.Record(t, "validateDetail", "legacy/tests/fixtures/detail-validity/cases.json", c.Name)
			if len(c.Engine) == 0 {
				t.Fatalf("%s: case must declare engine", c.Name)
			}
			files := map[string][]byte{}
			for k, v := range c.Files {
				files[k] = []byte(v)
			}
			res, err := ValidateDetailJSON(c.Spec, files, "")

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
