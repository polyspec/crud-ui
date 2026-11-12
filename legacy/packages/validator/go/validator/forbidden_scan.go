package validator

// Recursive forbidden meta-key scan (SPEC §6) — the runtime half of the
// global rejection that the meta-schema's propertyNames enforces statically.
// Byte-for-byte behavior parity with the JS reference
// (validator-ts/src/forbidden-scan.ts).
//
// R1: the types/parser PRESERVE every key (round-trip), so blocking forbidden
// meta keys is the VALIDATION layer's job, not the model's. The typed models
// (Go/Rust) only rejected forbidden keys at the top level and one level under
// open buckets — a deeply nested meta key (validate.required.if,
// options.x.display_switch, …) leaked through. This scan closes that leak: it
// walks the COMPOSED single spec (after $ref/$patch expansion and x-strip) to
// ARBITRARY depth and rejects a forbidden key found at ANY depth — including one
// level under a slot/bucket body.
//
// Placement (SPEC §2 pipeline): this runs in the spec LOAD path, immediately
// after compose expansion and before validation entry. A hit is therefore a LOAD
// failure (*compose.ComposeLoadError, code FORBIDDEN_META_KEY) — the spec never
// comes into existence — never a valid:false validation result.
//
// Forbidden set (SPEC §6): the enumerated ForbiddenMetaKeys (condition-only /
// composition-directive / magic-symbol meta keys) PLUS the x{key} comment family (any
// x-prefixed key, length > 1). $ref/$patch are NOT forbidden — compose already
// consumed them, so they do not survive to here; x{key} IS strip-eligible, so
// any x{key} that survives to this scan is rejected (the strip belongs to the
// meta-schema; survival means it was not stripped). No eval.

import (
	"strconv"
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// isXScanCommentKey reports whether key is an x{key} comment key for the scan: an
// x followed by at least one more character (xclass, xstyle, xnote, …). The bare
// key "x" is not a comment. This matches the JS forbidden-scan.ts isXCommentKey
// exactly (length > 1 && first byte == 'x') — the scan is the 4-language contract
// boundary, so it does not borrow the narrower typed-layer heuristic.
func isXScanCommentKey(key string) bool {
	return len(key) > 1 && strings.HasPrefix(key, ForbiddenKeyPrefix)
}

// isScanForbiddenKey reports whether key is globally forbidden: an enumerated
// literal (ForbiddenMetaKeys) OR an x{key} comment.
func isScanForbiddenKey(key string) bool {
	return forbiddenSet[key] || isXScanCommentKey(key)
}

// ScanForbiddenKeys recursively scans a composed single spec (compose value
// model: *compose.OMap / []any / scalars) for any forbidden meta key at any
// depth. It returns a *compose.ComposeLoadError (code FORBIDDEN_META_KEY) on the
// first hit, with the dotted path to the offending key in Message and Trace; nil
// when the spec is clean.
//
// The scan descends into every object value AND every array element (a forbidden
// key nested inside an array of sub-specs is caught too). Map keys are checked
// before descending into their values, so the reported path points at the
// shallowest offending key. rootPath is the optional path prefix for the error
// trace.
func ScanForbiddenKeys(spec any, rootPath []string) *compose.ComposeLoadError {
	return scanWalk(spec, rootPath)
}

func scanWalk(node any, path []string) *compose.ComposeLoadError {
	switch n := node.(type) {
	case []any:
		for i, elem := range n {
			if err := scanWalk(elem, appendPath(path, strconv.Itoa(i))); err != nil {
				return err
			}
		}
		return nil
	case *compose.OMap:
		// Check every key at THIS level first (shallowest hit reported), then descend.
		keys := n.Keys()
		for _, key := range keys {
			if isScanForbiddenKey(key) {
				at := appendPath(path, key)
				return &compose.ComposeLoadError{
					Code:    compose.ForbiddenMetaKey,
					Message: "forbidden meta key \"" + key + "\" at " + strings.Join(at, "."),
					Trace:   at,
				}
			}
		}
		for _, key := range keys {
			v, _ := n.Get(key)
			if err := scanWalk(v, appendPath(path, key)); err != nil {
				return err
			}
		}
		return nil
	default:
		// null / string / number / bool: nothing to descend into.
		return nil
	}
}

// appendPath returns a fresh slice path+seg (never aliases the caller's path, so
// sibling recursion does not corrupt the trace).
func appendPath(path []string, seg string) []string {
	out := make([]string, len(path)+1)
	copy(out, path)
	out[len(path)] = seg
	return out
}
