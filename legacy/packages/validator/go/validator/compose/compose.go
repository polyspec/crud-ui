package compose

// Composition orchestrator (SPEC §5, G5) — the parser's FIRST pass. Port of
// compose.ts.
//
// Resolution order (SPEC §5, verbatim):
//
//	(1) $ref   — expand file/path base, recursively (nested $ref included) into a
//	             single properties base.
//	(2) $patch — overlay add/remove/replace and deep-path set on that base.
//	(3) the result is the equivalent SINGLE SPEC (composition keys eliminated).
//	(4) the field layer (validate/design/behavior/options) then applies to it.
//
// G5 (SPEC §2): the parser expands composition first, producing a single spec,
// BEFORE applying the field layer — without composition a $ref-using spec cannot
// even be loaded. So composition is a pre-processing pass that runs BEFORE
// validation/render, not a validation step.
//
// Priority is fixed here: $ref = base (first),
// $patch = overlay (later) — base is laid down, patch overrides.

// ComposeOptions configures a composition pass.
type ComposeOptions struct {
	// Basepath for relative $ref resolution.
	Basepath string
}

// ComposeProperties composes a properties map: expand $ref to a base, overlay
// $patch, return the single (composition-free) properties map. Named sibling
// keys follow declaration order — a key declared after $ref overrides the
// base; a key declared before it is overridden by the base.
//
// The input and the result are in specification member order (see OrderMembers).
func ComposeProperties(properties *OMap, loader FileLoader, opts ComposeOptions) (*OMap, error) {
	return ordered(composeProperties, properties, loader, opts)
}

// ComposeSpec composes a full field spec: expand a field-level $ref/$patch, then
// recurse into its properties (which may itself compose). Returns the single spec.
// The input and the result are in specification member order (see OrderMembers).
func ComposeSpec(spec *OMap, loader FileLoader, opts ComposeOptions) (*OMap, error) {
	return ordered(composeSpec, spec, loader, opts)
}

// ordered runs one composition over the input in specification member order and
// returns its result in that order. Merges append new keys, as JavaScript object
// spread does before it moves array-index names first.
func ordered(run func(*OMap, FileLoader, ComposeOptions) (*OMap, error), input *OMap, loader FileLoader, opts ComposeOptions) (*OMap, error) {
	in := orderedOMap(input)
	result, err := run(in, loader, opts)
	if err != nil {
		return nil, err
	}
	return orderedOMap(result), nil
}

// composeProperties is ComposeProperties over an already ordered input.
func composeProperties(properties *OMap, loader FileLoader, opts ComposeOptions) (*OMap, error) {
	basepath := opts.Basepath

	base := NewOMap()
	var patch any
	sawPatch := false
	own := NewOMap()

	for _, k := range properties.Keys() {
		v, _ := properties.Get(k)
		switch k {
		case "$ref":
			// $ref merges onto whatever was declared before it.
			resolved, err := resolveRef(v, basepath, loader, nil)
			if err != nil {
				return nil, err
			}
			base = shallowMerge(own, resolved)
			own = NewOMap()
		case "$patch":
			sawPatch = true
			patch = v
		default:
			own.Set(k, v)
		}
	}

	// No composition keys: still recurse into children so nested $ref expands.
	result := shallowMerge(base, own)
	if sawPatch {
		var err error
		result, err = applyPatch(result, patch)
		if err != nil {
			return nil, err
		}
	}

	// Recurse into every child field's properties (the tree may compose deeper).
	for _, fieldName := range result.Keys() {
		field, _ := result.Get(fieldName)
		if fm, ok := isOMap(field); ok {
			composed, err := composeSpec(fm, loader, opts)
			if err != nil {
				return nil, err
			}
			result.Set(fieldName, composed)
		}
	}

	return result, nil
}

// composeSpec is ComposeSpec over an already ordered input.
func composeSpec(spec *OMap, loader FileLoader, opts ComposeOptions) (*OMap, error) {
	basepath := opts.Basepath

	var resolved *OMap

	// Field-level $ref / $patch (a field may inherit a whole base spec).
	if spec.Has("$ref") || spec.Has("$patch") {
		base := NewOMap()
		var patch any
		hasPatch := false
		own := NewOMap()
		for _, k := range spec.Keys() {
			v, _ := spec.Get(k)
			switch k {
			case "$ref":
				// Field-level $ref resolves a file's properties layer too (default detectKey).
				r, err := resolveRef(v, basepath, loader, nil)
				if err != nil {
					return nil, err
				}
				base = shallowMerge(own, r)
				own = NewOMap()
			case "$patch":
				patch = v
				hasPatch = true
			default:
				own.Set(k, v)
			}
		}
		resolved = shallowMerge(base, own)
		if hasPatch {
			var err error
			resolved, err = applyPatch(resolved, patch)
			if err != nil {
				return nil, err
			}
		}
	} else {
		resolved = spec.Clone()
	}

	// Recurse into properties (composition entry point, SPEC §2 / types.go:73).
	props, _ := resolved.Get("properties")
	if pm, ok := isOMap(props); ok {
		composed, err := composeProperties(pm, loader, opts)
		if err != nil {
			return nil, err
		}
		resolved.Set("properties", composed)
	}

	return resolved, nil
}
