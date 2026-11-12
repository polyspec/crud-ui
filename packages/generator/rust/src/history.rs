use crate::error::{FormError, FormResult};

/// The number of records an undo history keeps in each direction (CURT-062).
pub const HISTORY_LIMIT: usize = 100;

/// The undo history of a form: the records before earlier changes and the records after undone changes, oldest first.
/// The functions of the module take it by reference and return new values.
#[derive(Debug, Clone, PartialEq)]
pub struct History<T> {
    /// Earlier records, at most [`HISTORY_LIMIT`].
    pub entries: Vec<T>,
    /// Records that redo restores, at most [`HISTORY_LIMIT`].
    pub redo_entries: Vec<T>,
    /// Path of the last change when it was a value edit.
    pub last_path: Option<String>,
}

impl<T> History<T> {
    /// The earlier records, oldest first (CURT-076).
    pub fn entries(&self) -> &[T] {
        &self.entries
    }

    /// The records that redo restores, oldest first (CURT-076).
    pub fn redo_entries(&self) -> &[T] {
        &self.redo_entries
    }

    /// The path of the last value edit, or `None` when the last change was no value edit (CURT-077).
    pub fn last_path(&self) -> Option<&str> {
        self.last_path.as_deref()
    }
}

/// The history after an undo or a redo and the record that it restored.
#[derive(Debug, Clone, PartialEq)]
pub struct HistoryResult<T> {
    /// The history after the restore.
    pub history: History<T>,
    /// The restored record.
    pub value: T,
}

/// The last [`HISTORY_LIMIT`] records of a list.
fn last_records<T: Clone>(records: &[T]) -> Vec<T> {
    records[records.len().saturating_sub(HISTORY_LIMIT)..].to_vec()
}

/// The history with no record (CURT-076).
pub fn empty_history<T>() -> History<T> {
    History {
        entries: Vec::new(),
        redo_entries: Vec::new(),
        last_path: None,
    }
}

/// Appends the record before a change to the entries unless `path` equals the path of the last value edit, keeps the
/// last [`HISTORY_LIMIT`] entries, clears the redo entries and sets the path of the history to `path` (CURT-077,
/// CURT-063).
pub fn record_change<T: Clone>(
    history: &History<T>,
    previous: T,
    path: Option<&str>,
) -> History<T> {
    let mut entries = history.entries.clone();
    if path.is_none() || path != history.last_path.as_deref() {
        entries.push(previous);
    }
    History {
        entries: last_records(&entries),
        redo_entries: Vec::new(),
        last_path: path.map(str::to_string),
    }
}

/// Whether the history has a record to restore (CURT-078).
pub fn can_undo<T>(history: &History<T>) -> bool {
    !history.entries.is_empty()
}

/// Whether the history has a record to restore in the forward direction (CURT-078).
pub fn can_redo<T>(history: &History<T>) -> bool {
    !history.redo_entries.is_empty()
}

/// The history without its last entry, with `current` appended to the redo entries, and the last entry as the record
/// (CURT-079); it fails when the history has no entry.
pub fn undo_change<T: Clone>(history: &History<T>, current: T) -> FormResult<HistoryResult<T>> {
    let Some((value, rest)) = history.entries.split_last() else {
        return Err(FormError::input("Nothing to undo"));
    };
    let mut redo_entries = history.redo_entries.clone();
    redo_entries.push(current);
    Ok(HistoryResult {
        history: History {
            entries: rest.to_vec(),
            redo_entries: last_records(&redo_entries),
            last_path: None,
        },
        value: value.clone(),
    })
}

/// The history with `current` appended to the entries and without its last redo entry, and that redo entry as the
/// record (CURT-080); it fails when the history has no redo entry.
pub fn redo_change<T: Clone>(history: &History<T>, current: T) -> FormResult<HistoryResult<T>> {
    let Some((value, rest)) = history.redo_entries.split_last() else {
        return Err(FormError::input("Nothing to redo"));
    };
    let mut entries = history.entries.clone();
    entries.push(current);
    Ok(HistoryResult {
        history: History {
            entries: last_records(&entries),
            redo_entries: rest.to_vec(),
            last_path: None,
        },
        value: value.clone(),
    })
}
