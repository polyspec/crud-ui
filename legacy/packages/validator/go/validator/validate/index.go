package validate

// model validation entry point (SPEC §2 pipeline). Wires the three passes in
// order: G5 compose first → §3 traversal → §2 G1 value evaluation. JS index.ts
// (validate) parity.
//
//	(1) compose — ComposeProperties / ComposeSpec expands $ref / $patch into a
//	    single spec. An unresolved composition returns a *compose.ComposeLoadError
//	    HERE (a LOAD failure, NOT valid:false) — the spec never comes into
//	    existence, so there is no validation result; an unresolved $ref never
//	    yields valid:true.
//	(2/3) validate — Validator traverses the composed spec and runs the validate
//	    slot (conditional rule values via the model expression engine).

import (
	"fmt"

	model "github.com/polyspec/crudui/packages/validator/go/validator"
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
)

// FileSet is a virtual file set $ref resolves against ({ key: doc }).
type FileSet map[string]*compose.OMap

// Options configures a model validation run.
type Options struct {
	// Files is the virtual file set for $ref resolution (default: empty).
	Files FileSet
	// Basepath is the basepath for relative $ref resolution.
	Basepath string
}

// Validate validates data against a model spec given as the engine value model
// (*compose.OMap, decoded with compose.DecodeOrdered). The spec may carry
// $ref / $patch; they are expanded first. An unresolved composition returns a
// *compose.ComposeLoadError, and data with the wrong shape returns a
// *FormInputError; neither produces a validation result. G5 → §3 → §2 G1.
func Validate(spec *compose.OMap, data any, opts Options) (ValidationResult, error) {
	// Input text is checked first: the specification and files, the data, then
	// the options (docs/spec/input-text.md).
	if err := checkText(spec, opts, text.Input{Name: "data", Value: data}); err != nil {
		return ValidationResult{}, err
	}
	// Root data is a request precondition, checked before composition.
	if _, ok := data.(map[string]any); !ok {
		return ValidationResult{}, &FormInputError{Message: "Form data must be an object"}
	}
	spec, loader, composeOpts := composeInput(spec, opts)

	// Two entry shapes (JS index.ts):
	//   (a) a full root group spec { type:'group', properties:{…} } — compose the
	//       whole spec, then read its composed properties.
	//   (b) a properties-layer composition entry { $ref, $patch } with no own
	//       properties — compose it AS a properties map directly.
	hasOwnProperties := false
	if v, ok := spec.Get("properties"); ok {
		if _, ok := v.(*compose.OMap); ok {
			hasOwnProperties = true
		}
	}
	isCompositionEntry := spec.Has("$ref") || spec.Has("$patch")

	var properties *compose.OMap
	if isCompositionEntry && !hasOwnProperties {
		composed, err := compose.ComposeProperties(spec, loader, composeOpts)
		if err != nil {
			return ValidationResult{}, err
		}
		properties = composed
	} else {
		composed, err := compose.ComposeSpec(spec, loader, composeOpts)
		if err != nil {
			return ValidationResult{}, err
		}
		if v, ok := composed.Get("properties"); ok {
			if m, ok := v.(*compose.OMap); ok {
				properties = m
			}
		}
		if properties == nil {
			properties = compose.NewOMap()
		}
	}

	// Load-path forbidden-scan (SPEC §6): walk the composed single spec to
	// arbitrary depth and reject any forbidden meta key BEFORE validation entry.
	// A hit is a *compose.ComposeLoadError (a LOAD failure), never valid:false.
	// This closes the deep-nesting leak the typed model alone could not (R1).
	// JS index.ts parity: scanForbiddenKeys(properties, ['properties']).
	if scanErr := model.ScanForbiddenKeys(properties, []string{"properties"}); scanErr != nil {
		return ValidationResult{}, scanErr
	}
	// The form root declarations are scanned like the fields they sit beside.
	for _, key := range []string{"buttons", "action"} {
		if declared, ok := spec.Get(key); ok {
			if scanErr := model.ScanForbiddenKeys(declared, []string{key}); scanErr != nil {
				return ValidationResult{}, scanErr
			}
		}
	}

	// The data limits are checked after the forbidden-key scan and before the
	// rule parameters.
	limits, err := readDataLimits(spec)
	if err != nil {
		return ValidationResult{}, err
	}
	// Rule parameters are checked after composition and the forbidden-key scan.
	validator, err := NewValidator(properties)
	if err != nil {
		return ValidationResult{}, err
	}
	// The data is measured before any rule.
	if err := checkDataLimits(data, limits); err != nil {
		return ValidationResult{}, err
	}
	return validator.Validate(data)
}

// checkText checks the text and the limits of a specification, its files, the
// named inputs and the base path option, in that order.
func checkText(spec *compose.OMap, opts Options, inputs ...text.Input) error {
	if failure, message := text.CheckSpecification(spec, opts.Files); failure != nil {
		return failure
	} else if message != "" {
		return &FormInputError{Message: message}
	}
	inputs = append(inputs, text.Input{Name: "options.basepath", Value: opts.Basepath})
	if message := text.CheckInputs(inputs...); message != "" {
		return &FormInputError{Message: message}
	}
	return nil
}

// plainValue converts decoded objects to map[string]any, the data model of
// Validate.
func plainValue(value any) any {
	switch v := value.(type) {
	case *compose.OMap:
		out := make(map[string]any, v.Len())
		for _, key := range v.Keys() {
			child, _ := v.Get(key)
			out[key] = plainValue(child)
		}
		return out
	case []any:
		for i, child := range v {
			v[i] = plainValue(child)
		}
		return v
	}
	return value
}

// ValidateJSON is a convenience wrapper that decodes a raw JSON spec and raw JSON
// data, then runs Validate. The spec is decoded with compose.DecodeOrdered so
// declaration order survives; data is decoded with compose.DecodeOrdered into
// plain values (objects → map[string]any, arrays → []any, numbers → float64).
// Both keep text as written, so invalid text reaches the input text check. Empty data bytes validate
// an empty object; any decoded data value is passed to Validate unchanged.
// Files is a { key: rawJSON } map.
func ValidateJSON(specJSON []byte, dataJSON []byte, filesJSON map[string][]byte, basepath string) (ValidationResult, error) {
	specAny, err := compose.DecodeOrdered(specJSON)
	if err != nil {
		return ValidationResult{}, fmt.Errorf("validate: spec decode: %w", err)
	}
	spec, ok := specAny.(*compose.OMap)
	if !ok {
		return ValidationResult{}, fmt.Errorf("validate: spec is not an object")
	}

	var data any = map[string]any{}
	if len(dataJSON) > 0 {
		decoded, err := compose.DecodeOrdered(dataJSON)
		if err != nil {
			return ValidationResult{}, fmt.Errorf("validate: data decode: %w", err)
		}
		data = plainValue(decoded)
	}

	files := FileSet{}
	for k, raw := range filesJSON {
		docAny, err := compose.DecodeOrdered(raw)
		if err != nil {
			return ValidationResult{}, fmt.Errorf("validate: file %q decode: %w", k, err)
		}
		doc, ok := docAny.(*compose.OMap)
		if !ok {
			return ValidationResult{}, fmt.Errorf("validate: file %q is not an object", k)
		}
		files[k] = doc
	}

	return Validate(spec, data, Options{Files: files, Basepath: basepath})
}
