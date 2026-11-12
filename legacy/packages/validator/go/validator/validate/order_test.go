package validate

import (
	"strings"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

func errorPaths(result ValidationResult) string {
	paths := []string{}
	for _, e := range result.Errors {
		paths = append(paths, e.Path)
	}
	return strings.Join(paths, ",")
}

func TestValidateErrorsFollowMemberOrder(t *testing.T) {
	required := `{"type":"text","validate":{"required":true}}`
	spec := `{"type":"group","properties":{"b":` + required + `,"10":` + required + `,"a":` + required + `}}`
	// Data member order must not matter: the errors follow the specification.
	result, err := ValidateJSON([]byte(spec), []byte(`{"a":"","b":"","10":""}`), nil, "")
	if err != nil {
		t.Fatal(err)
	}
	if got := errorPaths(result); got != "10,b,a" {
		t.Fatalf("got %s, want 10,b,a", got)
	}
}

func TestValidateComposedFilesFollowMemberOrder(t *testing.T) {
	required := `{"type":"text","validate":{"required":true}}`
	file := `{"properties":{"b":` + required + `,"a":` + required + `}}`
	spec := `{"type":"group","properties":{"$ref":"base.yml","$patch":{"10":` + required + `}}}`
	result, err := ValidateJSON([]byte(spec), []byte(`{}`), map[string][]byte{"base.yml": []byte(file)}, "")
	if err != nil {
		t.Fatal(err)
	}
	if got := errorPaths(result); got != "10,b,a" {
		t.Fatalf("got %s, want 10,b,a", got)
	}
}

func TestValidateDoesNotReorderData(t *testing.T) {
	spec := `{"type":"group","properties":{"rows":{"type":"text","multiple":true,"validate":{"required":true}}}}`
	data := map[string]any{"rows": map[string]any{"b": "x", "10": "y"}}
	specValue, err := compose.DecodeOrdered([]byte(spec))
	if err != nil {
		t.Fatal(err)
	}
	specMap, ok := specValue.(*compose.OMap)
	if !ok {
		t.Fatalf("spec decoded as %T, want an object", specValue)
	}
	result, err := Validate(specMap, data, Options{})
	if err != nil || !result.Valid {
		t.Fatalf("got %+v, %v", result, err)
	}
	rows, ok := data["rows"].(map[string]any)
	if !ok {
		t.Fatalf("rows are %T, want an object", data["rows"])
	}
	if len(rows) != 2 || rows["b"] != "x" || rows["10"] != "y" {
		t.Fatalf("data changed: %v", data)
	}
}
