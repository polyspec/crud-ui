package compose

import (
	"regexp"
	"strings"
)

// $ref resolution expands base inheritance before other composition (SPEC §5).
//
// Resolution supports these input forms:
//
//	(1) value = a single string OR an array of strings — an array resolves each
//	    path in order, then merge (later overrides earlier on key clash).
//	(2) plain path options.yml → load YAML, descend by the default
//	    detectKey ["properties"] (= take the file's properties only).
//	(3) path-specified (file.yml).a.b → regex split, detectKeys = ["a","b",
//	    "properties"] — descend a.b, then descend to properties underneath.
//	(4) relative paths get the basepath "/" prefix; absolute (/-leading) pass
//	    through (handled by the FileLoader).
//	(5) the result is recursively processed — nested $ref is expanded.
//
// model normalization: $ref is the properties-layer composition entry point. The
// resolved result is flattened to a single properties map and laid down as the
// base; $patch overlays it (base first, patch overrides). Unresolved $ref
// (missing file / bad format / absent detectKey / cycle) is a LOAD ERROR.

// pathSpecRE splits (path).keys — same pattern as the JS
// /^\((?<path>.*?)\)\.(?<keys>.*)$/.
var pathSpecRE = regexp.MustCompile(`^\((.*?)\)\.(.*)$`)

// orderedFrom returns the chain keys in insertion order for trace messages. Go
// map order is random, so the trace uses the explicit slice the caller tracks
// instead; resolveSingleRef builds traces from its own ordered chain.

// resolveRef resolves a $ref value (string or []string) to a single flattened
// properties map. Each entry is resolved in declaration order and merged (later
// overrides earlier). Nested $ref inside a resolved doc is expanded recursively.
// chain is the ordered list of canonical file keys on the current resolution
// path (for cycle detection + trace).
func resolveRef(value any, basepath string, loader FileLoader, chain []string) (*OMap, error) {
	paths, err := normalizeRefValue(value)
	if err != nil {
		return nil, err
	}
	merged := NewOMap()
	for _, path := range paths {
		resolved, err := resolveSingleRef(path, basepath, loader, chain)
		if err != nil {
			return nil, err
		}
		// Merge: later keys override earlier.
		merged = shallowMerge(merged, resolved)
	}
	return merged, nil
}

// normalizeRefValue normalizes the $ref value into a list of path strings
// (scalar → [scalar]).
func normalizeRefValue(value any) ([]string, error) {
	if s, ok := value.(string); ok {
		return []string{s}, nil
	}
	if arr, ok := value.([]any); ok {
		out := make([]string, 0, len(arr))
		for _, p := range arr {
			s, ok := p.(string)
			if !ok {
				return nil, newLoadError(RefValueType,
					"$ref array entries must be strings, got "+jsTypeName(p))
			}
			out = append(out, s)
		}
		return out, nil
	}
	return nil, newLoadError(RefValueType,
		"$ref must be a string or an array of strings, got "+jsTypeName(value))
}

// resolveSingleRef resolves one $ref path entry, descending detectKeys and
// expanding nested refs.
func resolveSingleRef(rawPath, basepath string, loader FileLoader, chain []string) (*OMap, error) {
	orgPath := rawPath
	path := rawPath
	detectKeys := []string{"properties"}

	// Path-specified form (file.yml).a.b (leading '(').
	if strings.HasPrefix(path, "(") {
		m := pathSpecRE.FindStringSubmatch(path)
		if m == nil {
			return nil, newLoadError(RefFormatError, orgPath+" ref error")
		}
		path = m[1]
		keys := m[2]
		// detectKeys = keys split on '.' followed by "properties".
		detectKeys = append(strings.Split(keys, "."), "properties")
	}

	// Empty path is a format error.
	if path == "" {
		return nil, newLoadError(RefFormatError, orgPath+" ref error")
	}

	key := loader.Normalize(path, basepath)

	// Cycle detection: this file key already on the current resolution chain
	// (SPEC §7).
	for _, c := range chain {
		if c == key {
			trace := append(append([]string{}, chain...), key)
			return nil, newLoadError(RefCycle,
				"$ref cycle detected: "+strings.Join(trace, " -> "), trace...)
		}
	}

	loaded, err := loader.Load(key) // RefFileNotFound if absent
	if err != nil {
		return nil, err
	}
	// Every loaded document, from any loader, is read in specification member order.
	doc := orderedOMap(loaded)

	// Descend detectKeys.
	var node any = doc
	for _, detectKey := range detectKeys {
		nm, ok := isOMap(node)
		if ok && nm.Has(detectKey) {
			node, _ = nm.Get(detectKey)
		} else {
			trace := append(append([]string{}, chain...), key)
			return nil, newLoadError(RefDetectKeyNotFound,
				detectKey+" not found in "+orgPath, trace...)
		}
	}

	nodeMap, ok := isOMap(node)
	if !ok {
		// A properties layer must be a map. A scalar/array here is malformed.
		trace := append(append([]string{}, chain...), key)
		return nil, newLoadError(RefDetectKeyNotFound,
			orgPath+" resolved to a non-object properties layer", trace...)
	}

	// Recursively expand nested $ref inside the resolved properties map. Add this
	// file key to the visiting chain so a deeper $ref back to it is a cycle.
	nextChain := append(append([]string{}, chain...), key)
	return expandNestedRefs(nodeMap, basepath, loader, nextChain)
}

// expandNestedRefs expands any $ref (and merges any $patch) sitting INSIDE a
// resolved properties map, recursively. The resolved base is laid down first, then sibling named keys
// override it in declaration order: a later plain key overrides an earlier $ref.
func expandNestedRefs(node *OMap, basepath string, loader FileLoader, chain []string) (*OMap, error) {
	if !node.Has("$ref") && !node.Has("$patch") {
		return node, nil
	}

	base := NewOMap()
	var patch any
	hasPatch := false
	own := NewOMap()

	// Preserve declaration order: $ref expands to the base; keys declared after it
	// override, keys before it are overridden by it.
	for _, k := range node.Keys() {
		v, _ := node.Get(k)
		switch k {
		case "$ref":
			// base = (earlier own keys) overlaid by ref: the ref merges onto
			// whatever was processed before it.
			resolved, err := resolveRef(v, basepath, loader, chain)
			if err != nil {
				return nil, err
			}
			base = shallowMerge(own, resolved)
			// own keys already folded into base; reset so later keys override base.
			own = NewOMap()
		case "$patch":
			patch = v
			hasPatch = true
		default:
			own.Set(k, v)
		}
	}

	result := shallowMerge(base, own)
	if hasPatch {
		var err error
		result, err = applyPatch(result, patch)
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}

// shallowMerge returns { ...a, ...b }: b's keys override a's; key order follows a
// then b's new keys (JS spread semantics).
func shallowMerge(a, b *OMap) *OMap {
	out := a.Clone()
	for _, k := range b.Keys() {
		v, _ := b.Get(k)
		out.Set(k, v)
	}
	return out
}
