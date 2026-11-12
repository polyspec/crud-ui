package generator

import (
	"encoding/json"
	"testing"
)

// TestButtonsSuite runs the form button cases of legacy/tests/fixtures/buttons: BindButtons (CURP-008) and FormButtonsHTML (CURP-009).
// Each observation is marshalled and compared with its expectation as JSON text, so the attribute order is checked. An error
// is observed with the code that it carries and its message, as the form state suite does.
func TestButtonsSuite(t *testing.T) {
	for _, c := range fixtureCases(t, "buttons") {
		c := c
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			recordFixtureConformance(t, stringAt(c, "operation"), "buttons", stringAt(c, "name"))
			observed := observeButtonCase(t, c)
			if got, want := marshal(t, observed), marshal(t, read(c, "expected")); got != want {
				t.Fatalf("observed %s, expected %s", got, want)
			}
		})
	}
}

// observeButtonCase runs the operation of one case and returns its observation: the result, or the error.
func observeButtonCase(t *testing.T, c any) any {
	if stringAt(c, "operation") == "formButtonsHtml" {
		html, e := FormButtonsHTML(read(c, "buttons"))
		if e != nil {
			return buttonFailure(t, e)
		}
		return NewObject("result", html)
	}
	template, e := buttonTemplate(c)
	if e != nil {
		return buttonFailure(t, e)
	}
	buttons, e := BindButtons(template, buttonData(c), buttonOptions(c))
	if e != nil {
		return buttonFailure(t, e)
	}
	return NewObject("result", buttons)
}

// buttonTemplate compiles the spec of a case, or reads the template of a case as it is: a value that is no compiled form
// template fails with the message that the template gives.
func buttonTemplate(c any) (*FormTemplate, error) {
	if has(c, "spec") {
		return CompileForm(object(read(c, "spec")), CompileOptions{})
	}
	var template FormTemplate
	if e := json.Unmarshal([]byte(marshalText(read(c, "template"))), &template); e != nil {
		return nil, e
	}
	return &template, nil
}

// buttonData is the record of a case, empty when the case has none.
func buttonData(c any) *Object {
	if has(c, "data") {
		return object(read(c, "data"))
	}
	return NewObject()
}

// buttonOptions are the bind options of a case: its language, which may be any JSON value.
func buttonOptions(c any) BindOptions {
	var options BindOptions
	if has(c, "options") && has(read(c, "options"), "language") {
		options.Language = read(read(c, "options"), "language")
	}
	return options
}

// buttonFailure is the observation of an error: the code that it carries and its message.
func buttonFailure(t *testing.T, e error) any {
	return NewObject("error", NewObject("code", failureCode(t, e), "message", e.Error()))
}

// marshalText encodes a value of a case as JSON text.
func marshalText(value any) string {
	bytes, e := json.Marshal(value)
	if e != nil {
		panic(e)
	}
	return string(bytes)
}
