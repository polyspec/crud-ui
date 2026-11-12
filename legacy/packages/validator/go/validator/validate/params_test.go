package validate

import (
	"errors"
	"slices"
	"testing"

	model "github.com/polyspec/crudui/packages/validator/go/validator"
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

func TestRegistryIsTheModelRuleNames(t *testing.T) {
	var names []string
	for name := range builtInRules {
		names = append(names, name)
	}
	want := slices.Clone(model.RuleNames)
	slices.Sort(names)
	slices.Sort(want)
	if !slices.Equal(names, want) {
		t.Fatalf("registry %v, model %v", names, want)
	}
}

func TestParameterChecks(t *testing.T) {
	cases := []struct {
		name string
		spec string
		data string
		// failure is "CODE|message|at", or "" for a validation result.
		failure string
	}{
		{
			name: "disabled parameters are not checked",
			spec: `{"type":"group","properties":{"v":{"type":"text","validate":{"minlength":false,"maxlength":null,"rangelength":false,"in":null,"pattern":false,"match":null}}}}`,
			data: `{"v":"x"}`,
		},
		{
			name:    "a pattern map is not a pattern string",
			spec:    `{"type":"group","properties":{"v":{"type":"text","validate":{"pattern":{".on":"a"}}}}}`,
			data:    `{"v":"x"}`,
			failure: "INVALID_RULE_PARAMETER|Invalid pattern parameter: expected a pattern string|v",
		},
		{
			name:    "a literal string limit is not an integer",
			spec:    `{"type":"group","properties":{"v":{"type":"text","validate":{"maxlength":"5"}}}}`,
			data:    `{"v":"x"}`,
			failure: "INVALID_RULE_PARAMETER|Invalid maxlength parameter: expected an integer from 0 to 9007199254740991|v",
		},
		{
			name:    "rules of one field in declaration order",
			spec:    `{"type":"group","properties":{"v":{"type":"text","validate":{"in":5,"minlength":-1}}}}`,
			data:    `{"v":"x"}`,
			failure: "INVALID_RULE_PARAMETER|Invalid in parameter: expected a list, a comma-separated string or a map|v",
		},
		{
			name:    "a declared parameter fails before any data is read",
			spec:    `{"type":"group","properties":{"g":{"type":"group","properties":{"v":{"type":"text","validate":{"rangelength":[1]}}}}}}`,
			data:    `{}`,
			failure: "INVALID_RULE_PARAMETER|Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum|g.v",
		},
		{
			name:    "an unselected literal ternary branch is checked at load",
			spec:    `{"type":"group","properties":{"rows":{"type":"group","multiple":true,"properties":{"on":{"type":"text"},"v":{"type":"text","validate":{"maxlength":".on ? 3 : (.x ? 4 : -1)"}}}}}}`,
			data:    `{}`,
			failure: "INVALID_RULE_PARAMETER|Invalid maxlength parameter: expected an integer from 0 to 9007199254740991|rows.v",
		},
		{
			name:    "an unselected condition map value is checked at load",
			spec:    `{"type":"group","properties":{"on":{"type":"text"},"v":{"type":"text","validate":{"rangelength":{".on":[3,1]}}}}}`,
			data:    `{"on":false,"v":"x"}`,
			failure: "INVALID_RULE_PARAMETER|Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum|v",
		},
		{
			name:    "a data branch selects an invalid limit in a row",
			spec:    `{"type":"group","properties":{"rows":{"type":"group","multiple":true,"properties":{"on":{"type":"text"},"limit":{"type":"text"},"v":{"type":"text","validate":{"maxlength":".on ? .limit : 3"}}}}}}`,
			data:    `{"rows":{"r1":{"on":false,"limit":-1,"v":"x"},"r2":{"on":true,"limit":-1,"v":"x"}}}`,
			failure: "INVALID_RULE_PARAMETER|Invalid maxlength parameter: expected an integer from 0 to 9007199254740991|rows.v",
		},
		{
			name: "a data branch that is not selected",
			spec: `{"type":"group","properties":{"rows":{"type":"group","multiple":true,"properties":{"on":{"type":"text"},"limit":{"type":"text"},"v":{"type":"text","validate":{"maxlength":".on ? .limit : 3"}}}}}}`,
			data: `{"rows":{"r1":{"on":false,"limit":-1,"v":"x"}}}`,
		},
		{
			name: "a condition map that selects nothing disables the rule",
			spec: `{"type":"group","properties":{"on":{"type":"text"},"v":{"type":"text","validate":{"rangelength":{".on":[1,3]}}}}}`,
			data: `{"on":false,"v":""}`,
		},
		{
			name:    "a condition expression selects a boolean",
			spec:    `{"type":"group","properties":{"on":{"type":"text"},"v":{"type":"text","validate":{"minlength":".on"}}}}`,
			data:    `{"on":true,"v":""}`,
			failure: "INVALID_RULE_PARAMETER|Invalid minlength parameter: expected an integer from 0 to 9007199254740991|v",
		},
		{
			name:    "a condition map literal of a repeated scalar field",
			spec:    `{"type":"group","properties":{"on":{"type":"text"},"tags":{"type":"text","multiple":true,"validate":{"minlength":{"true":true}}}}}`,
			data:    `{}`,
			failure: "INVALID_RULE_PARAMETER|Invalid minlength parameter: expected an integer from 0 to 9007199254740991|tags",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result, err := ValidateJSON([]byte(c.spec), []byte(c.data), nil, "")
			if c.failure == "" {
				if err != nil {
					t.Fatalf("unexpected failure: %v", err)
				}
				if !result.Valid {
					t.Fatalf("unexpected errors: %+v", result.Errors)
				}
				return
			}
			got := failureOf(err)
			if got == nil {
				t.Fatalf("want failure %s, got %v (result %+v)", c.failure, err, result)
			}
			if s := got.Code + "|" + got.Message + "|" + got.At; s != c.failure {
				t.Fatalf("failure %s, want %s", s, c.failure)
			}
		})
	}
}

func TestNewValidatorChecksDeclarations(t *testing.T) {
	spec, err := compose.DecodeOrdered([]byte(`{"v":{"type":"text","validate":{"match":"a**"}}}`))
	if err != nil {
		t.Fatal(err)
	}
	specMap, ok := spec.(*compose.OMap)
	if !ok {
		t.Fatalf("spec decoded as %T, want an object", spec)
	}
	_, err = NewValidator(specMap)
	var loadErr *compose.ComposeLoadError
	ok = errors.As(err, &loadErr)
	if !ok || loadErr.Code != compose.InvalidRulePattern || loadErr.Message != "Invalid match pattern: invalid quantifier at 2" {
		t.Fatalf("got %v", err)
	}
}
