//! File loader for `$ref` resolution.
//!
//! `$ref` loads external YAML files. The
//! compose engine never touches the filesystem directly — it goes through the
//! `FileLoader` trait, so the shared fixtures supply a virtual in-memory file set
//! (the spec graph is the input; no disk needed). The only implementation today
//! is `MemoryLoader`; a disk + YAML backed loader is not implemented yet — when
//! added it plugs into the same trait without touching the engine.
//!
//! Path normalization:
//! - absolute (`/…`) paths pass through unchanged
//! - relative paths get the basepath prefix (`basepath + '/' + path`)
//!
//! The loader receives the ALREADY-normalized absolute key, so cycle detection
//! and the fixture map key on one canonical identifier.

use std::collections::HashMap;

use serde_json::{Map, Value};

use super::errors::{ComposeErrorCode, ComposeLoadError, ComposeResult};

/// A loaded YAML document (a parsed object tree). Always an object map at the top.
pub type LoadedDoc = Map<String, Value>;

/// Loads a normalized file key to its parsed document. `load` returns
/// `ComposeLoadError(REF_FILE_NOT_FOUND)` when the key is absent — the engine
/// relies on that exact code (an unresolved `$ref` is a load error, never
/// `valid:true`).
pub trait FileLoader {
    /// Resolve `path` against `basepath` to the canonical key the map uses.
    fn normalize(&self, path: &str, basepath: &str) -> String;
    /// Load the parsed document at the canonical key, or return NOT_FOUND.
    fn load(&self, key: &str) -> ComposeResult<LoadedDoc>;
}

/// In-memory loader over a fixed `{ key: doc }` map. Shared fixtures pass a file
/// set here; the engine resolves `$ref` against it with no disk access. Keys are
/// the normalized identifiers (`normalize` output).
pub struct MemoryLoader {
    files: HashMap<String, Value>,
}

impl MemoryLoader {
    /// Build a loader from a `{ key: doc }` map. Every entry is kept; a `doc` that is
    /// not a JSON object fails its load with `REF_FORMAT_ERROR` (CUSC-092).
    pub fn new(files: Map<String, Value>) -> Self {
        MemoryLoader {
            files: files.into_iter().collect(),
        }
    }
}

impl FileLoader for MemoryLoader {
    fn normalize(&self, path: &str, basepath: &str) -> String {
        // Absolute path: pass through. Relative: prefix basepath.
        if path.starts_with('/') {
            return path.to_string();
        }
        if !basepath.is_empty() {
            return format!("{}/{}", basepath, path);
        }
        path.to_string()
    }

    fn load(&self, key: &str) -> ComposeResult<LoadedDoc> {
        match self.files.get(key) {
            // Defensive clone so resolution never mutates the source file set.
            Some(Value::Object(doc)) => Ok(doc.clone()),
            // CUSC-092: a file is an object; another document fails the load.
            Some(_) => Err(ComposeLoadError::with_trace(
                ComposeErrorCode::RefFormatError,
                format!("$ref file is not an object: {}", key),
                vec![key.to_string()],
            )),
            None => Err(ComposeLoadError::with_trace(
                ComposeErrorCode::RefFileNotFound,
                format!("$ref file not found: {}", key),
                vec![key.to_string()],
            )),
        }
    }
}
