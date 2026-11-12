//! Composition load errors (SPEC §5, §7; unresolved_behavior).
//!
//! Composition is a pre-processing pass that runs BEFORE validation/render: the
//! parser expands `$ref`/`$patch` into a single spec first (G5). An unresolved
//! composition is NOT a validation failure (`valid:false`) — it is a LOAD
//! FAILURE: the spec itself does not come into existence. Never let an
//! unresolved `$ref` pass as `valid:true`.
//!
//! Load-error classes:
//!   (1) $ref file missing
//!   (2) $ref format error
//!   (3) detectKey absent
//!   (4) $ref cycle (A→B→A)
//!   (5) $patch target/op error

use std::fmt;

/// Machine-readable load-error codes. One per unresolved-behavior class — these
/// strings are the cross-language contract (`expectError.code` in cases.json).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ComposeErrorCode {
    /// $ref points at a file that does not exist.
    RefFileNotFound,
    /// $ref string is malformed: `(…` with no closing `).keys`, or empty path.
    RefFormatError,
    /// A detectKey path segment (or the trailing `properties`) is absent.
    RefDetectKeyNotFound,
    /// $ref cycle detected (A→B→A).
    RefCycle,
    /// $ref value is neither a string nor an array of strings.
    RefValueType,
    /// $patch is not an object of deep-path → value entries.
    PatchShape,
    /// $patch op targets a path whose intermediate node is a non-object scalar.
    PatchPathConflict,
    /// $patch remove targets a path that does not exist (strict remove).
    PatchRemoveTargetMissing,
    /// A forbidden meta key survived into the composed single spec at some depth
    /// (SPEC §6). The recursive forbidden-scan runs after composition and x-strip and
    /// before validation; a forbidden key anywhere is a LOAD failure, never
    /// `valid:true`. `trace` carries the dotted path to the offending key.
    ForbiddenMetaKey,
    /// A rule parameter outside the validation-rule definitions; `trace` is the
    /// field's declaration path.
    InvalidRuleParameter,
    /// A `pattern` or `match` parameter outside the CRUDUI pattern language;
    /// `trace` is the field's declaration path.
    InvalidRulePattern,
    /// A `validate` or `messages` key that is not a registered rule name;
    /// `trace` is the field's declaration path.
    UnknownRule,
    /// A string or member name of the specification or a composition file that
    /// is not a sequence of Unicode scalar values (docs/spec/input-text.md);
    /// `trace` is its path.
    InvalidText,
}

impl ComposeErrorCode {
    /// Stable wire string (matches the JS `ComposeErrorCode` union member).
    pub fn as_str(self) -> &'static str {
        match self {
            ComposeErrorCode::RefFileNotFound => "REF_FILE_NOT_FOUND",
            ComposeErrorCode::RefFormatError => "REF_FORMAT_ERROR",
            ComposeErrorCode::RefDetectKeyNotFound => "REF_DETECT_KEY_NOT_FOUND",
            ComposeErrorCode::RefCycle => "REF_CYCLE",
            ComposeErrorCode::RefValueType => "REF_VALUE_TYPE",
            ComposeErrorCode::PatchShape => "PATCH_SHAPE",
            ComposeErrorCode::PatchPathConflict => "PATCH_PATH_CONFLICT",
            ComposeErrorCode::PatchRemoveTargetMissing => "PATCH_REMOVE_TARGET_MISSING",
            ComposeErrorCode::ForbiddenMetaKey => "FORBIDDEN_META_KEY",
            ComposeErrorCode::InvalidRuleParameter => "INVALID_RULE_PARAMETER",
            ComposeErrorCode::InvalidRulePattern => "INVALID_RULE_PATTERN",
            ComposeErrorCode::UnknownRule => "UNKNOWN_RULE",
            ComposeErrorCode::InvalidText => "INVALID_TEXT",
        }
    }
}

impl ComposeErrorCode {
    /// The kind of the failure (bindgen design E-1): the code in lower snake case.
    pub fn kind(self) -> &'static str {
        match self {
            ComposeErrorCode::RefFileNotFound => "ref_file_not_found",
            ComposeErrorCode::RefFormatError => "ref_format_error",
            ComposeErrorCode::RefDetectKeyNotFound => "ref_detect_key_not_found",
            ComposeErrorCode::RefCycle => "ref_cycle",
            ComposeErrorCode::RefValueType => "ref_value_type",
            ComposeErrorCode::PatchShape => "patch_shape",
            ComposeErrorCode::PatchPathConflict => "patch_path_conflict",
            ComposeErrorCode::PatchRemoveTargetMissing => "patch_remove_target_missing",
            ComposeErrorCode::ForbiddenMetaKey => "forbidden_meta_key",
            ComposeErrorCode::InvalidRuleParameter => "invalid_rule_parameter",
            ComposeErrorCode::InvalidRulePattern => "invalid_rule_pattern",
            ComposeErrorCode::UnknownRule => "unknown_rule",
            ComposeErrorCode::InvalidText => "invalid_text",
        }
    }
}

impl bindgen_core::Kinds for ComposeLoadError {
    fn kind(&self) -> &'static str {
        self.code.kind()
    }
    fn status(&self) -> Option<u16> {
        None
    }
    fn errno(&self) -> Option<i32> {
        None
    }
}

impl fmt::Display for ComposeErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A composition load failure — distinct from a later validation error. Mirrors
/// the JS `ComposeLoadError` (code + message + trace path stack for cycles).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ComposeLoadError {
    /// Stable machine-readable code (one per unresolved-behavior class).
    pub code: ComposeErrorCode,
    /// Human-readable message (not part of the cross-language contract).
    pub message: String,
    /// The composition path stack when the error occurred (for cycle/trace).
    pub trace: Vec<String>,
}

impl ComposeLoadError {
    /// Build a load error with no trace stack.
    pub fn new(code: ComposeErrorCode, message: impl Into<String>) -> Self {
        ComposeLoadError {
            code,
            message: message.into(),
            trace: Vec::new(),
        }
    }

    /// Build a load error carrying the resolution-chain trace (cycle/not-found).
    pub fn with_trace(
        code: ComposeErrorCode,
        message: impl Into<String>,
        trace: Vec<String>,
    ) -> Self {
        ComposeLoadError {
            code,
            message: message.into(),
            trace,
        }
    }
}

impl fmt::Display for ComposeLoadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ComposeLoadError {}

/// Convenience alias for composition results.
pub type ComposeResult<T> = Result<T, ComposeLoadError>;
