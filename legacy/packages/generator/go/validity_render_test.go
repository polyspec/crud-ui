package generator

import (
	"errors"
	"strings"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// checkValidityCase runs one validity case through build and checks its outcome: a case with expect "ok" and engine "pass"
// builds, a case with expect "fail" and engine "pass" is refused with INVALID_FORM_INPUT (CUDF-036 to CUDF-062), and a case
// with a recorded engine failure is refused with that code and composition trace.
func checkValidityCase(t *testing.T, c *Object, build func(spec *Object, files map[string]*Object) error) {
	t.Helper()
	files := map[string]*Object{}
	if f := object(read(c, "files")); f != nil {
		for _, name := range f.Keys() {
			files[name] = object(read(f, name))
		}
	}
	err := build(object(read(c, "spec")), files)
	engine := object(read(c, "engine"))
	if engine != nil {
		if err == nil {
			t.Fatalf("want the error %s, but the case built", stringAt(engine, "code"))
		}
		if got := failureCode(t, err); got != stringAt(engine, "code") {
			t.Fatalf("code %s, want %s: %v", got, stringAt(engine, "code"), err)
		}
		var loadErr *compose.ComposeLoadError
		if errors.As(err, &loadErr) {
			if at := strings.Join(loadErr.Trace, "."); at != stringAt(engine, "at") {
				t.Fatalf("location %q, want %q", at, stringAt(engine, "at"))
			}
		}
		return
	}
	switch stringAt(c, "expect") {
	case "ok":
		if err != nil {
			t.Fatalf("the case must build: %v", err)
		}
	case "fail":
		if err == nil {
			t.Fatal("the case must be refused, but it built")
		}
		if got := failureCode(t, err); got != "INVALID_FORM_INPUT" {
			t.Fatalf("code %s, want INVALID_FORM_INPUT: %v", got, err)
		}
	default:
		t.Fatalf("expect %q is neither ok nor fail", stringAt(c, "expect"))
	}
}

// TestListRenderValidity runs every case of legacy/tests/fixtures/list-validity through BuildList, the list-render-validity unit.
func TestListRenderValidity(t *testing.T) {
	for _, c := range readSuite(t, "list-validity") {
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			checkValidityCase(t, c, func(spec *Object, files map[string]*Object) error {
				_, err := BuildList(spec, []any{}, ListOptions{Files: files})
				return err
			})
		})
	}
}

// TestDetailRenderValidity runs every case of legacy/tests/fixtures/detail-validity through BuildDetail, the detail-render-validity unit.
func TestDetailRenderValidity(t *testing.T) {
	for _, c := range readSuite(t, "detail-validity") {
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			checkValidityCase(t, c, func(spec *Object, files map[string]*Object) error {
				_, err := BuildDetail(spec, &Object{}, DetailOptions{Files: files})
				return err
			})
		})
	}
}
