package compose

import "strings"

// $patch application — add / remove / replace over the $ref base (SPEC §5).
// Port of patch.ts.
//
// $patch is an OBJECT of operations. Two shapes coexist (both order-preserving):
//
//  1. Deep-path set — "field.validate.required": ".other". The dotted key is
//     split into segments and the value is SET at that node (creating
//     intermediate objects). SPEC §5 canonical form. Object values deep-merge;
//     scalars replace.
//
//  2. Structured ops — explicit add / remove / replace keys:
//     add:     { "path.to.new": value, … }   — deep-merge value at path
//     replace: { "path.to.key": value, … }   — same merge rule (scalar override)
//     remove:  [ "path.to.key", … ] | { … }  — deep delete
//
// Resolution order: base ($ref) first, then $patch overlays. An unresolved patch
// (op shape error, path conflict, strict-remove miss) is a LOAD ERROR.

// applyPatch applies a $patch value to the (already $ref-expanded) base spec.
func applyPatch(base *OMap, patch any) (*OMap, error) {
	pm, ok := isOMap(patch)
	if !ok {
		return nil, newLoadError(PatchShape,
			"$patch must be an object of operations, got "+jsTypeName(patch))
	}
	result := base
	// Apply entries in declaration order (OMap preserves order).
	for _, key := range pm.Keys() {
		val, _ := pm.Get(key)
		var err error
		switch key {
		case "add", "replace":
			result, err = applyAddReplace(result, val, key)
		case "remove":
			result, err = applyRemove(result, val)
		default:
			// Deep-path set (SPEC §5 canonical form): "a.b.c": value.
			var segs []string
			segs, err = splitPath(key)
			if err == nil {
				result, err = setDeepPath(result, segs, val)
			}
		}
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}

// applyAddReplace: a map of deep-path → value, deep-merged at each path.
func applyAddReplace(base *OMap, val any, op string) (*OMap, error) {
	vm, ok := isOMap(val)
	if !ok {
		return nil, newLoadError(PatchShape,
			"$patch."+op+" must be an object of deep-path → value")
	}
	result := base
	for _, path := range vm.Keys() {
		v, _ := vm.Get(path)
		segs, err := splitPath(path)
		if err != nil {
			return nil, err
		}
		result, err = setDeepPath(result, segs, v)
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}

// applyRemove: an array of deep-paths, or a nested {k:{sub:…}} map.
func applyRemove(base *OMap, val any) (*OMap, error) {
	if arr, ok := val.([]any); ok {
		result := base
		for _, p := range arr {
			path, ok := p.(string)
			if !ok {
				return nil, newLoadError(PatchShape, "$patch.remove array entries must be strings")
			}
			segs, err := splitPath(path)
			if err != nil {
				return nil, err
			}
			result, err = removeDeepPath(result, segs)
			if err != nil {
				return nil, err
			}
		}
		return result, nil
	}
	if vm, ok := isOMap(val); ok {
		// Nested map form: recurse where both sides are objects.
		return removeNested(base, vm), nil
	}
	return nil, newLoadError(PatchShape,
		"$patch.remove must be an array of paths or a nested object")
}

// splitPath splits a dotted deep-path into segments. Empty path is a shape error.
func splitPath(path string) ([]string, error) {
	if path == "" {
		return nil, newLoadError(PatchShape, "$patch path must be non-empty")
	}
	return strings.Split(path, "."), nil
}

// setDeepPath sets value at a deep path, creating intermediate objects. When both
// the existing leaf and the new value are plain objects, DEEP-MERGE;
// otherwise the new value REPLACES. Returns a new tree.
func setDeepPath(node *OMap, segments []string, value any) (*OMap, error) {
	head := segments[0]
	rest := segments[1:]
	out := node.Clone()

	if len(rest) == 0 {
		existing, _ := out.Get(head)
		out.Set(head, mergeValue(existing, value))
		return out, nil
	}

	child, ok := out.Get(head)
	switch {
	case !ok:
		// child === undefined
		set, err := setDeepPath(NewOMap(), rest, value)
		if err != nil {
			return nil, err
		}
		out.Set(head, set)
	default:
		if cm, isObj := isOMap(child); isObj {
			set, err := setDeepPath(cm, rest, value)
			if err != nil {
				return nil, err
			}
			out.Set(head, set)
		} else {
			// Intermediate node is a scalar/array — cannot descend into it.
			return nil, newLoadError(PatchPathConflict,
				"$patch cannot descend into non-object at '"+head+"'")
		}
	}
	return out, nil
}

// mergeValue is the deep-merge leaf rule: both
// plain objects → recursive deep merge; otherwise the latter value wins
// (scalar/array override).
func mergeValue(existing, incoming any) any {
	em, eok := isOMap(existing)
	im, iok := isOMap(incoming)
	if eok && iok {
		out := em.Clone()
		for _, k := range im.Keys() {
			iv, _ := im.Get(k)
			ov, _ := out.Get(k)
			out.Set(k, mergeValue(ov, iv))
		}
		return out
	}
	return incoming
}

// removeDeepPath deletes a value at a deep path. Strict: a missing target is a
// load error.
func removeDeepPath(node *OMap, segments []string) (*OMap, error) {
	head := segments[0]
	rest := segments[1:]
	if !node.Has(head) {
		return nil, newLoadError(PatchRemoveTargetMissing,
			"$patch remove target not found: '"+strings.Join(segments, ".")+"'")
	}
	out := node.Clone()
	if len(rest) == 0 {
		out.Delete(head)
		return out, nil
	}
	child, _ := out.Get(head)
	cm, ok := isOMap(child)
	if !ok {
		return nil, newLoadError(PatchRemoveTargetMissing,
			"$patch remove cannot descend into non-object at '"+head+"'")
	}
	sub, err := removeDeepPath(cm, rest)
	if err != nil {
		return nil, err
	}
	out.Set(head, sub)
	return out, nil
}

// removeNested is the nested-map remove: for each key, recurse
// when both the target and the removal spec are objects, else unset the key. A
// missing key is tolerated here (the key is simply absent), unlike the
// array-path form.
func removeNested(base *OMap, spec *OMap) *OMap {
	out := base.Clone()
	for _, key := range spec.Keys() {
		sub, _ := spec.Get(key)
		target, present := out.Get(key)
		tm, tIsObj := isOMap(target)
		sm, sIsObj := isOMap(sub)
		if present && tIsObj && sIsObj {
			out.Set(key, removeNested(tm, sm))
		} else {
			out.Delete(key)
		}
	}
	return out
}

// jsTypeName mirrors the JS typeof-style names used in error messages so the
// message text matches the reference where it is observable.
func jsTypeName(v any) string {
	switch t := v.(type) {
	case nil:
		return "null"
	case []any:
		return "array"
	case *OMap:
		return "object"
	case string:
		return "string"
	case bool:
		return "boolean"
	case float64, int, int64, float32:
		return "number"
	default:
		_ = t
		return "object"
	}
}
