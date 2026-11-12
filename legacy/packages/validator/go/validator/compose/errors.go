// Package compose is the Go port of the model composition engine (SPEC §5, G5).
//
// The parser's FIRST pass: expand $ref (base inheritance) then $patch
// (add/remove/replace + deep-path set) into a single, composition-free spec,
// BEFORE the field layer / validation / render. Unresolved composition is a LOAD
// ERROR (ComposeLoadError) — never valid:true.
//
// Byte-for-byte parity with the JS reference (validator-ts/src/compose). Both
// load the SAME shared fixture legacy/tests/fixtures/compose/cases.json and must
// reproduce it identically (G-B 4-language idempotence). interface{} is spelled
// any (Go ≥ 1.18). No eval.
package compose

// ComposeErrorCode is a stable machine-readable load-error code (one per
// unresolved-behavior class). Mirrors errors.ts ComposeErrorCode exactly.
type ComposeErrorCode string

const (
	// RefFileNotFound: $ref points at a file that does not exist (the file cannot be loaded).
	RefFileNotFound ComposeErrorCode = "REF_FILE_NOT_FOUND"
	// RefFormatError: $ref string is malformed: "(…" with no closing ").keys", or empty path.
	RefFormatError ComposeErrorCode = "REF_FORMAT_ERROR"
	// RefDetectKeyNotFound: a detectKey path segment (or the trailing "properties") is absent.
	RefDetectKeyNotFound ComposeErrorCode = "REF_DETECT_KEY_NOT_FOUND"
	// RefCycle: $ref cycle detected (A→B→A); resolution stops instead of recursing forever.
	RefCycle ComposeErrorCode = "REF_CYCLE"
	// RefValueType: $ref value is neither a string nor an array of strings.
	RefValueType ComposeErrorCode = "REF_VALUE_TYPE"
	// PatchShape: $patch is not an object of deep-path → value entries.
	PatchShape ComposeErrorCode = "PATCH_SHAPE"
	// PatchPathConflict: $patch op targets a path whose intermediate node is a non-object scalar.
	PatchPathConflict ComposeErrorCode = "PATCH_PATH_CONFLICT"
	// PatchRemoveTargetMissing: $patch remove targets a path that does not exist (strict remove).
	PatchRemoveTargetMissing ComposeErrorCode = "PATCH_REMOVE_TARGET_MISSING"
	// ForbiddenMetaKey: a forbidden meta key (condition-only / composition-directive / magic-symbol,
	// or an x{key} comment that survived x-strip) was found at any depth in the
	// composed single spec. The forbidden-scan runs in the LOAD path after compose
	// expansion; a hit is a load failure, never valid:true. Mirrors JS forbidden-scan.ts.
	ForbiddenMetaKey ComposeErrorCode = "FORBIDDEN_META_KEY"
	// InvalidRuleParameter: a validate rule parameter outside the rule's
	// definition (docs/spec/validation-rules.md, Parameter errors). Trace is the
	// field's declaration path.
	InvalidRuleParameter ComposeErrorCode = "INVALID_RULE_PARAMETER"
	// InvalidRulePattern: a pattern or match parameter outside the CRUDUI pattern
	// language. Trace is the field's declaration path.
	InvalidRulePattern ComposeErrorCode = "INVALID_RULE_PATTERN"
	// UnknownRule: a validate or messages key that is not a registered rule name
	// (docs/spec/validation-rules.md, Parameter errors). Trace is the field's
	// declaration path.
	UnknownRule ComposeErrorCode = "UNKNOWN_RULE"
	// InvalidText: a string or member name in the specification or a composition
	// file that is not valid UTF-8 (docs/spec/input-text.md). Trace is its path.
	InvalidText ComposeErrorCode = "INVALID_TEXT"
)

// ComposeLoadError is every composition load failure. NOT a validation error.
//
// Composition is a pre-processing pass that runs BEFORE validation/render: the
// parser expands $ref/$patch into a single spec first (G5). An unresolved
// composition is therefore NOT a validation failure (valid:false) — it is a LOAD
// FAILURE: the spec itself does not come into existence. Never let an unresolved
// $ref pass as valid:true.
type ComposeLoadError struct {
	// Code is the stable machine-readable code (one per unresolved-behavior class).
	Code ComposeErrorCode
	// Message is the human-readable detail.
	Message string
	// Trace is the composition path stack when the error occurred (for cycle/trace).
	Trace []string
}

// Error implements the error interface.
func (e *ComposeLoadError) Error() string {
	return string(e.Code) + ": " + e.Message
}

// newLoadError builds a ComposeLoadError. Trace is optional.
func newLoadError(code ComposeErrorCode, message string, trace ...string) *ComposeLoadError {
	return &ComposeLoadError{Code: code, Message: message, Trace: trace}
}
