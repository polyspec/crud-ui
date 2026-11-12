package validate

// Detail validation processes the read structure of a single record. A detail
// contains a fields map and display settings; it has no search and no input
// data. It performs these structure operations, matching the JavaScript entry
// validator-ts/src/validate-detail:
//
//	(1) compose — the detail ROOT composes exactly as the list root
//	    (ComposeSpec), and the fields map expands with ComposeProperties, the
//	    same engine as list columns and form properties. An unresolved
//	    composition is a *compose.ComposeLoadError.
//	(2) forbidden-scan — ScanForbiddenKeys walks the whole composed detail tree
//	    and rejects a §6 forbidden meta key as a load failure.
//
// Shape checks belong to the meta-schema and are not repeated here.

import (
	"fmt"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// ValidateDetail composes and forbidden-scans a detail-spec. It returns a clean
// ListValidationResult (valid:true, no errors) when the detail composes and scans
// clean. An unresolved composition or a forbidden meta key returns a
// *compose.ComposeLoadError.
func ValidateDetail(spec *compose.OMap, opts Options) (ListValidationResult, error) {
	return validateStructure(spec, opts, "fields", nil)
}

// ValidateDetailJSON decodes a raw JSON detail-spec and the optional
// { key: rawJSON } file set, then runs ValidateDetail. A detail carries no data.
func ValidateDetailJSON(specJSON []byte, filesJSON map[string][]byte, basepath string) (ListValidationResult, error) {
	specAny, err := compose.DecodeOrdered(specJSON)
	if err != nil {
		return ListValidationResult{}, fmt.Errorf("validate-detail: spec decode: %w", err)
	}
	spec, ok := specAny.(*compose.OMap)
	if !ok {
		return ListValidationResult{}, fmt.Errorf("validate-detail: spec is not an object")
	}

	files := FileSet{}
	for k, raw := range filesJSON {
		docAny, derr := compose.DecodeOrdered(raw)
		if derr != nil {
			return ListValidationResult{}, fmt.Errorf("validate-detail: file %q decode: %w", k, derr)
		}
		doc, isMap := docAny.(*compose.OMap)
		if !isMap {
			return ListValidationResult{}, fmt.Errorf("validate-detail: file %q is not an object", k)
		}
		files[k] = doc
	}

	return ValidateDetail(spec, Options{Files: files, Basepath: basepath})
}
