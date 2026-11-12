//! CRUDUI composition engine — SPEC §5, G5.
//!
//! The parser's first pass: expand `$ref` (base inheritance) then `$patch`
//! (add/remove/replace + deep-path set) into a single, composition-free spec,
//! BEFORE the field layer / validation / render. Unresolved composition is a LOAD
//! ERROR (`ComposeLoadError`) — never `valid:true`.
//!
//! Byte-for-byte parity with the JS reference engine
//! (`legacy/packages/validator/ts/src/compose`); the shared 4-language fixture
//! `tests/fixtures/compose/cases.json` is the single source of truth.

// Intentional: `compose/compose.rs` mirrors the JS reference layout
// (`legacy/packages/validator/ts/src/compose/compose.ts`), the byte-for-byte parity
// source. Renaming would diverge the two engines' file maps; the re-exports
// below flatten the path for callers (`compose::compose_spec`).
#[allow(
    clippy::module_inception,
    reason = "compose/compose.rs mirrors the file map of the other engines"
)]
pub mod compose;
pub mod errors;
pub mod loader;
pub mod member_order;
mod members;
pub mod patch;
pub mod ref_;

pub use compose::{compose_properties, compose_spec, ComposeOptions};
pub use errors::{ComposeErrorCode, ComposeLoadError, ComposeResult};
pub use loader::{FileLoader, LoadedDoc, MemoryLoader};
pub use member_order::{member_ordered, member_ordered_map};
pub use patch::apply_patch;
pub use ref_::resolve_ref;
