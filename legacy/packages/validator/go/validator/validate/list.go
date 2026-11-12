package validate

// List validation processes the read structure defined by SPEC §9. A list
// contains columns, sorting, pagination, actions, design and search settings.
// The server supplies rows separately, so this entry does not validate row data.
// It performs these structure operations:
//
//	(1) compose — ComposeSpec expands a root-level $ref/$patch; ComposeProperties
//	    expands the columns map (each column may carry $ref/$patch, the SAME engine
//	    as form properties) and the search form-spec reference. An unresolved
//	    composition is a *compose.ComposeLoadError (a LOAD failure, never
//	    valid:false) — the spec never comes into existence.
//	(2) forbidden-scan — ScanForbiddenKeys walks the COMPOSED list tree to ANY
//	    depth (columns / each Column / CellFormat options bucket / actions / sort /
//	    pagination / design / search sub-form) and rejects a forbidden meta key
//	    (display_switch / if / when / show_if / _ / x{key} … §6) as a LOAD failure.
//
// The meta-schema validates closed objects, required columns, the sort.dir and
// pagination.mode enums, and CellFormat polymorphism. This runtime does not
// repeat those checks. They are defined in the Ajv entry at
// contracts/schema/crudui.schema.json #/definitions/List, exercised by
// validator-ts/src/list-metaschema.conformance.test.ts.
//
// Go ≥ 1.18: interface{} is spelled any. No eval.

import (
	"fmt"

	model "github.com/polyspec/crudui/packages/validator/go/validator"
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// ValidateList runs composition and forbidden-key scanning over a
// list-spec given as the engine value model (*compose.OMap). It returns a clean
// ListValidationResult (valid:true, no errors) when the list composes and scans clean
// — a list carries no rows, so there is no DATA pass to produce field errors. An
// unresolved composition or a forbidden meta key at any depth returns a
// *compose.ComposeLoadError (the caller distinguishes a LOAD failure from a
// validation result), identical to the form path.
func ValidateList(spec *compose.OMap, opts Options) (ListValidationResult, error) {
	// Pass 1a/1b (G5): compose the list ROOT (a list may be a $ref overlay, SPEC
	// §9.1) and the columns map — the read sister of properties — with the SAME
	// ComposeProperties the form properties layer uses.
	return validateStructure(spec, opts, "columns", func(composed *compose.OMap, loader compose.FileLoader, composeOpts compose.ComposeOptions) error {
		// Pass 1c (G5): compose the search form-spec reference. search is INPUT (SPEC
		// §9.1: search = a form-spec reference); its $ref/$patch resolves to a sub-form
		// through the SAME ComposeSpec, and that sub-form then rides pass 2 below. No
		// new search-specific logic.
		s, ok := composed.Get("search")
		if !ok {
			return nil
		}
		sm, isMap := s.(*compose.OMap)
		if !isMap {
			return nil
		}
		expandedSearch, err := compose.ComposeSpec(sm, loader, composeOpts)
		if err != nil {
			return err
		}
		composed.Set("search", expandedSearch)
		return nil
	})
}

// validateStructure composes the root of a read structure and its field map under mapKey,
// lets expand compose the members that are specific to the structure (nil for none), and
// forbidden-scans the whole composed tree to arbitrary depth (pass 2, §6). The scanner is a
// generic tree walker (form parity: index.go scans the composed properties), so a forbidden
// key anywhere is a LOAD failure whose trace starts at the root key, as in every
// implementation and the shared list-validity fixture. A structure has no rows, so there is
// no DATA pass: a clean structure is valid with no errors.
func validateStructure(
	spec *compose.OMap,
	opts Options,
	mapKey string,
	expand func(composed *compose.OMap, loader compose.FileLoader, composeOpts compose.ComposeOptions) error,
) (ListValidationResult, error) {
	// Input text is checked first (docs/spec/input-text.md).
	if err := checkText(spec, opts); err != nil {
		return ListValidationResult{}, err
	}
	spec, loader, composeOpts := composeInput(spec, opts)

	composed, err := composeRootAndFieldMap(spec, mapKey, loader, composeOpts)
	if err != nil {
		return ListValidationResult{}, err
	}
	if expand != nil {
		if err := expand(composed, loader, composeOpts); err != nil {
			return ListValidationResult{}, err
		}
	}
	if scanErr := model.ScanForbiddenKeys(composed, nil); scanErr != nil {
		return ListValidationResult{}, scanErr
	}
	return ListValidationResult{Valid: true, Errors: nil}, nil
}

// ValidateListJSON decodes a raw JSON list-spec (compose.DecodeOrdered so
// declaration order survives) and the optional { key: rawJSON } file set, then
// runs ValidateList. Mirrors ValidateJSON (the form entry) for the CLI / gateway
// subprocess wire. A list carries no data, so there is no data argument.
func ValidateListJSON(specJSON []byte, filesJSON map[string][]byte, basepath string) (ListValidationResult, error) {
	specAny, err := compose.DecodeOrdered(specJSON)
	if err != nil {
		return ListValidationResult{}, fmt.Errorf("validate-list: spec decode: %w", err)
	}
	spec, ok := specAny.(*compose.OMap)
	if !ok {
		return ListValidationResult{}, fmt.Errorf("validate-list: spec is not an object")
	}

	files := FileSet{}
	for k, raw := range filesJSON {
		docAny, derr := compose.DecodeOrdered(raw)
		if derr != nil {
			return ListValidationResult{}, fmt.Errorf("validate-list: file %q decode: %w", k, derr)
		}
		doc, isMap := docAny.(*compose.OMap)
		if !isMap {
			return ListValidationResult{}, fmt.Errorf("validate-list: file %q is not an object", k)
		}
		files[k] = doc
	}

	return ValidateList(spec, Options{Files: files, Basepath: basepath})
}

// composeInput returns the specification in specification member order (an absent
// specification is an empty object), the loader of the files and the compose options.
func composeInput(spec *compose.OMap, opts Options) (*compose.OMap, *compose.MemoryLoader, compose.ComposeOptions) {
	if spec == nil {
		spec = compose.NewOMap()
	}
	ordered, isMap := compose.OrderMembers(spec).(*compose.OMap)
	if !isMap {
		// OrderMembers keeps the dynamic type of an *OMap, so this cannot fail.
		panic("validate: OrderMembers did not return an *OMap for an *OMap input")
	}
	loader := compose.NewMemoryLoader(map[string]*compose.OMap(opts.Files))
	return ordered, loader, compose.ComposeOptions{Basepath: opts.Basepath}
}

// composeRootAndFieldMap composes a read-structure root with ComposeSpec, then
// expands its field map under mapKey (list columns, detail fields) with
// ComposeProperties when that member is an object. Shared by ValidateList and
// ValidateDetail so both roots compose by one rule.
func composeRootAndFieldMap(spec *compose.OMap, mapKey string, loader compose.FileLoader, opts compose.ComposeOptions) (*compose.OMap, error) {
	composed, err := compose.ComposeSpec(spec, loader, opts)
	if err != nil {
		return nil, err
	}
	if m, ok := composed.Get(mapKey); ok {
		if om, isMap := m.(*compose.OMap); isMap {
			expanded, cerr := compose.ComposeProperties(om, loader, opts)
			if cerr != nil {
				return nil, cerr
			}
			composed.Set(mapKey, expanded)
		}
	}
	return composed, nil
}
