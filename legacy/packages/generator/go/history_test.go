package generator

import "testing"

// The cases of legacy/tests/fixtures/history-functions (CURT-063, CURT-076 to CURT-080): the other implementations pass the
// same cases. Each case is a subtest named by its name.

// historyOf reads the history of a case argument.
func historyOf(value any) History[any] {
	history := EmptyHistory[any]()
	history.Entries = list(read(value, "entries"))
	history.RedoEntries = list(read(value, "redoEntries"))
	history.LastPath = stringAt(value, "lastPath")
	return history
}

// historyObject is the JSON object of a history; lastPath is present only when the last change was a value edit.
func historyObject(history History[any]) *Object {
	out := NewObject("entries", history.Entries, "redoEntries", history.RedoEntries)
	if history.LastPath != "" {
		out.Set("lastPath", history.LastPath)
	}
	return out
}

// resultObject is the JSON object of the outcome of an undo or a redo.
func resultObject(result HistoryResult[any]) *Object {
	return NewObject("history", historyObject(result.History), "value", result.Value)
}

// callHistoryFunction calls the history function of a case and returns the observation `{ result }` or `{ error }`.
func callHistoryFunction(t *testing.T, op string, args []any) *Object {
	t.Helper()
	failed := func(e error) *Object {
		return NewObject("error", NewObject("code", failureCode(t, e), "message", e.Error()))
	}
	switch op {
	case "emptyHistory":
		return NewObject("result", historyObject(EmptyHistory[any]()))
	case "recordChange":
		// A change that is not a value edit has no path; any other type is a fixture error.
		path, isString := args[2].(string)
		if !isString && args[2] != nil {
			t.Fatalf("recordChange path is %T, want a string or null", args[2])
		}
		return NewObject("result", historyObject(RecordChange(historyOf(args[0]), args[1], path)))
	case "canUndoRedo":
		history := historyOf(args[0])
		return NewObject("result", []any{CanUndo(history), CanRedo(history)})
	case "undoChange":
		result, e := UndoChange(historyOf(args[0]), args[1])
		if e != nil {
			return failed(e)
		}
		return NewObject("result", resultObject(result))
	case "redoChange":
		result, e := RedoChange(historyOf(args[0]), args[1])
		if e != nil {
			return failed(e)
		}
		return NewObject("result", resultObject(result))
	}
	t.Fatalf("unknown function %s", op)
	return nil
}

// TestHistoryFunctions runs the history function cases of the fixtures.
func TestHistoryFunctions(t *testing.T) {
	for _, c := range fixtureCases(t, "history-functions") {
		c := c
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			recordFixtureConformance(t, "formHistory", "history-functions", stringAt(c, "name"))
			got := callHistoryFunction(t, stringAt(c, "op"), list(read(c, "args")))
			if g, w := marshal(t, got), marshal(t, read(c, "expected")); g != w {
				t.Fatalf("\n got %s\nwant %s", g, w)
			}
		})
	}
}
