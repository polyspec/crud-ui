// Package validate is the Go model form validator (SPEC §2 G5 → §3 → §2 G1) —
// the THIRD pass of the model pipeline.
//
// It consumes a model field model (the validate / design / behavior / options role
// slots) AFTER the compose pass (validator-go/validator/compose) has expanded
// $ref / $patch into a single spec. It does NOT re-implement the expression engine — it CALLS the
// existing engine (validator-go/validator/expr) for conditional rule values.
// The rule semantics mirror the JS reference (validator-ts/src/rules) byte for
// byte; the shared 4-language fixture legacy/tests/fixtures/validate/cases.json is the
// single truth, generated from the JS engine.
//
// Pipeline (SPEC):
//
//	(1) compose  — ComposeProperties / ComposeSpec (compose/) runs BEFORE this
//	    engine (Validate in index.go). An unresolved $ref is a *ComposeLoadError
//	    there (never valid:true).
//	(2) field traversal — recurse properties; group nesting, multiple arrays
//	    (items.i), object-key multiple (sorted keys, items.__uid__). Data order is
//	    preserved by form state and rendering; sorted order is validation errors.
//	(3) validate-slot evaluation — per field, walk the validate slot in
//	    declaration order; for each rule evaluate its (possibly conditional) value
//	    to an effective param (expression / condition map); skip when false/null;
//	    else run the rule. type:number runs an implicit number rule first when no
//	    explicit number rule is present.
//	(4) error collection — first error per field stops that field; collect into a
//	    flat []ValidationError; valid = len(errors) == 0.
//
// Go ≥ 1.18: interface{} is spelled any. No eval.
package validate

import "strings"

// ValidationError is one validation failure. Field shape (path / field / rule /
// message / value) is identical in every runtime so the 4-language idempotence
// comparison (SPEC G-B) holds with the same (path, rule, message).
type ValidationError struct {
	// Path is the dot-joined full path to the field (items.0.name, rows.__uid__.v).
	Path string `json:"path"`
	// Field is the last path segment (the field name).
	Field string `json:"field"`
	// Rule is the failed rule name, the invoked key verbatim (pattern vs match).
	// An implicit type:number failure reports "number".
	Rule string `json:"rule"`
	// Message is the display message: field messages[rule] override → rule default
	// (with {0}/{1} substituted) → "Validation failed." fallback.
	Message string `json:"message"`
	// Value is the failed value (the whole array for array-level rules).
	Value any `json:"value"`
}

// ValidationResult is the outcome of validating data: valid, the collected
// errors and the hidden paths.
type ValidationResult struct {
	// Valid reports whether Errors is empty.
	Valid bool `json:"valid"`
	// Errors is the flat list of failures in traversal order.
	Errors []ValidationError `json:"errors"`
	// Hidden lists the data paths of the fields whose design.show resolves to
	// false, in declaration order (validation-rules.md, "Evaluation").
	Hidden []string `json:"hidden"`
}

// ListValidationResult is the outcome of checking a list or detail declaration:
// valid plus the collected errors.
type ListValidationResult struct {
	// Valid reports whether Errors is empty.
	Valid bool `json:"valid"`
	// Errors is the flat list of failures.
	Errors []ValidationError `json:"errors"`
}

// pathToString joins path segments with dots (JS pathToString). Numeric indices
// and unique keys are dotted too (items.0.code), matching the fixtures.
func pathToString(path []string) string {
	return strings.Join(path, ".")
}

// getFieldName returns the last path segment (JS getFieldName); "" for an empty
// path.
func getFieldName(path []string) string {
	if len(path) == 0 {
		return ""
	}
	return path[len(path)-1]
}
