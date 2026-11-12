package generator

import "github.com/polyspec/crudui/packages/validator/go/validator/validate"

// HistoryLimit is the number of records an undo history keeps in each direction (CURT-062).
const HistoryLimit = 100

// History is the undo history of a form: the records before earlier changes and the records after undone changes,
// oldest first. The functions below take and return it by value and never change their arguments.
type History[T any] struct {
	// Entries are the earlier records, at most HistoryLimit.
	Entries []T
	// RedoEntries are the records that redo restores, at most HistoryLimit.
	RedoEntries []T
	// LastPath is the path of the last change when it was a value edit, and empty otherwise.
	LastPath string
}

// EmptyHistory returns the history with no record (CURT-076).
func EmptyHistory[T any]() History[T] { return History[T]{Entries: []T{}, RedoEntries: []T{}} }

// lastRecords returns a copy of the last HistoryLimit records of the list.
func lastRecords[T any](records []T) []T {
	if len(records) > HistoryLimit {
		records = records[len(records)-HistoryLimit:]
	}
	return append([]T{}, records...)
}

// RecordChange appends the record before a change to the entries unless path equals the path of the last value edit,
// keeps the last HistoryLimit entries, clears the redo entries and sets the path of the history to path (CURT-077,
// CURT-063).
func RecordChange[T any](history History[T], previous T, path string) History[T] {
	entries := lastRecords(history.Entries)
	if path == "" || path != history.LastPath {
		entries = lastRecords(append(entries, previous))
	}
	return History[T]{Entries: entries, RedoEntries: []T{}, LastPath: path}
}

// CanUndo reports whether the history has a record to restore (CURT-078).
func CanUndo[T any](history History[T]) bool { return len(history.Entries) > 0 }

// CanRedo reports whether the history has a record to restore in the forward direction (CURT-078).
func CanRedo[T any](history History[T]) bool { return len(history.RedoEntries) > 0 }

// HistoryResult is the history after an undo or a redo and the record that it restored.
type HistoryResult[T any] struct {
	History History[T]
	Value   T
}

// UndoChange returns the history without its last entry, with current appended to the redo entries, and the last entry
// as the record; it fails when the history has no entry (CURT-079).
func UndoChange[T any](history History[T], current T) (HistoryResult[T], error) {
	if len(history.Entries) == 0 {
		return HistoryResult[T]{}, &validate.FormInputError{Message: "Nothing to undo"}
	}
	last := len(history.Entries) - 1
	return HistoryResult[T]{
		History: History[T]{Entries: lastRecords(history.Entries[:last]), RedoEntries: lastRecords(append(lastRecords(history.RedoEntries), current))},
		Value:   history.Entries[last],
	}, nil
}

// RedoChange returns the history with current appended to the entries and without its last redo entry, and that redo
// entry as the record; it fails when the history has no redo entry (CURT-080).
func RedoChange[T any](history History[T], current T) (HistoryResult[T], error) {
	if len(history.RedoEntries) == 0 {
		return HistoryResult[T]{}, &validate.FormInputError{Message: "Nothing to redo"}
	}
	last := len(history.RedoEntries) - 1
	return HistoryResult[T]{
		History: History[T]{Entries: lastRecords(append(lastRecords(history.Entries), current)), RedoEntries: lastRecords(history.RedoEntries[:last])},
		Value:   history.RedoEntries[last],
	}, nil
}
