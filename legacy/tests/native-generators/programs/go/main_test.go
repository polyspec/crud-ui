package main

import (
	"encoding/json"
	"strings"
	"testing"

	gen "github.com/polyspec/crudui/packages/generator/go"
)

// runText decodes a request text and runs it as the program does.
func runText(t *testing.T, text string) (any, error) {
	t.Helper()
	v, e := gen.DecodeJSON([]byte(text))
	if e != nil {
		t.Fatal(e)
	}
	request := obj(v)
	if request == nil {
		t.Fatal("the request must be an object")
	}
	return run(request)
}

const groupSpec = `{"type":"group","properties":{"name":{"type":"text"}}}`

// TestWrongTypedMembersAreInputErrors shows that a member of the wrong type fails the request with an input
// error that names the member, as the Rust program does, and does not become an empty text.
func TestWrongTypedMembersAreInputErrors(t *testing.T) {
	cases := map[string]string{
		"basepath":  `{"operation":"compileForm","spec":` + groupSpec + `,"options":{"basepath":1}}`,
		"keyPrefix": `{"operation":"compileForm","spec":` + groupSpec + `,"options":{"keyPrefix":null}}`,
		"files":     `{"operation":"compileForm","spec":` + groupSpec + `,"options":{"files":"x"}}`,
		"language":  `{"operation":"buildList","spec":{"columns":{"name":{"field":"name"}}},"rows":[],"options":{"language":true}}`,
	}
	for member, text := range cases {
		t.Run(member, func(t *testing.T) {
			_, err := runText(t, text)
			if err == nil || !strings.Contains(err.Error(), member) {
				t.Fatalf("a wrong-typed %s gave %v, want an input error that names it", member, err)
			}
		})
	}
}

// TestAbsentMembersStayAbsent shows that absent options are still accepted.
func TestAbsentMembersStayAbsent(t *testing.T) {
	if _, err := runText(t, `{"operation":"compileForm","spec":`+groupSpec+`}`); err != nil {
		t.Fatalf("absent options failed: %v", err)
	}
	if _, err := runText(t, `{"operation":"compileForm","spec":`+groupSpec+`,"options":{"basepath":"x","keyPrefix":"p"}}`); err != nil {
		t.Fatalf("text options failed: %v", err)
	}
}

// TestWrongTypedActionArgumentIsAnError shows that a path argument of the wrong type is reported in the
// step of the action, as the Rust program reports it, instead of an empty path.
func TestWrongTypedActionArgumentIsAnError(t *testing.T) {
	spec, e := gen.DecodeJSON([]byte(groupSpec))
	if e != nil {
		t.Fatal(e)
	}
	template, e := gen.CompileForm(obj(spec), gen.CompileOptions{})
	if e != nil {
		t.Fatal(e)
	}
	b, e := json.Marshal(template)
	if e != nil {
		t.Fatal(e)
	}
	text := `{"operation":"form","template":` + string(b) + `,"data":{},"actions":[{"method":"getValue","args":[1]}]}`
	result, err := runText(t, text)
	if err != nil {
		t.Fatal(err)
	}
	steps, ok := val(obj(result), "steps").([]*gen.Object)
	if !ok || len(steps) != 1 {
		t.Fatalf("steps = %#v, want one step", result)
	}
	message, isText := val(obj(val(steps[0], "error")), "message").(string)
	if !isText || message != "Argument 0 must be a string" {
		t.Fatalf("action error = %q, want the argument error", message)
	}
}
