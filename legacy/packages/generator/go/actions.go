package generator

import (
	"slices"
)

// formActions are the eleven operations that an action button can request (CURT-081), in the order of the reference.
var formActions = []string{
	"move-up", "move-down", "add-row", "copy-row", "remove-row",
	"toggle-row", "select-row", "expand-all", "collapse-all", "undo", "redo",
}

// ActionInput is the values a button declares: its action, collection path and row key (CURT-081). An empty member is
// absent.
type ActionInput struct {
	Action string
	Path   string
	Key    string
}

// ActionTarget is the operation, collection path and row key that an action button targets; Path and Key are empty
// when the button declares none.
type ActionTarget struct {
	Name string
	Path string
	Key  string
}

// FocusTarget is the row that receives focus after an action; Key is empty when the collection has no rows left.
type FocusTarget struct {
	Path string
	Key  string
}

// ActionResult is the outcome of an action that ran; Focus is nil when focus stays on the current control.
type ActionResult struct {
	Focus *FocusTarget
}

// ResolveAction resolves the target of the values a button declares; ok is false when the action is none of the
// eleven form actions.
func ResolveAction(input ActionInput) (ActionTarget, bool) {
	if !slices.Contains(formActions, input.Action) {
		return ActionTarget{}, false
	}
	return ActionTarget{Name: input.Action, Path: input.Path, Key: input.Key}, true
}

// RunAction runs a resolved action on the form. A nil result means the action had no result: its target lacks the
// path, or the key that the action needs, and nothing changes. A failing operation returns its error and leaves the
// form unchanged (CURT-090).
func RunAction(form *Form, target ActionTarget) (*ActionResult, error) {
	if !slices.Contains(formActions, target.Name) {
		return nil, inputError("Unknown action: %s", target.Name)
	}
	switch target.Name {
	case "expand-all", "collapse-all":
		if e := form.SetAllExpanded(target.Name == "expand-all"); e != nil {
			return nil, e
		}
		return &ActionResult{}, nil
	case "undo":
		if e := form.Undo(); e != nil {
			return nil, e
		}
		return &ActionResult{}, nil
	case "redo":
		if e := form.Redo(); e != nil {
			return nil, e
		}
		return &ActionResult{}, nil
	}
	path, key := target.Path, target.Key
	if path == "" {
		return nil, nil
	}
	if target.Name == "add-row" {
		// add-row inserts after the row key when the button declares one.
		added, e := form.AddRow(path, AddRowOptions{AfterKey: key})
		if e != nil {
			return nil, e
		}
		return focusOn(path, added), nil
	}
	if key == "" {
		return nil, nil
	}
	switch target.Name {
	case "copy-row":
		copied, e := form.CopyRow(path, key, AddRowOptions{})
		if e != nil {
			return nil, e
		}
		return focusOn(path, copied), nil
	case "remove-row":
		keys, e := rowKeys(form, path)
		if e != nil {
			return nil, e
		}
		// Focus goes to the previous row, else the next row, else the collection.
		index := slices.Index(keys, key)
		neighbour := ""
		if index-1 >= 0 {
			neighbour = keys[index-1]
		} else if index+1 < len(keys) {
			neighbour = keys[index+1]
		}
		if e := form.RemoveRow(path, key); e != nil {
			return nil, e
		}
		if neighbour == "" {
			return &ActionResult{Focus: &FocusTarget{Path: path}}, nil
		}
		return focusOn(path, neighbour), nil
	case "toggle-row":
		if e := form.ToggleRow(path, key); e != nil {
			return nil, e
		}
		return &ActionResult{}, nil
	case "select-row":
		// Selecting changes no state: it only moves focus to the row.
		return focusOn(path, key), nil
	default:
		// move-up and move-down are the only actions left.
		keys, e := rowKeys(form, path)
		if e != nil {
			return nil, e
		}
		offset := 1
		if target.Name == "move-up" {
			offset = -1
		}
		if e := form.MoveRow(path, key, slices.Index(keys, key)+offset); e != nil {
			return nil, e
		}
		return focusOn(path, key), nil
	}
}

// focusOn is the result of an action that focuses the row key of the collection path.
func focusOn(path, key string) *ActionResult {
	return &ActionResult{Focus: &FocusTarget{Path: path, Key: key}}
}

// rowKeys returns the row keys of the keyed collection at path, in order.
func rowKeys(form *Form, path string) ([]string, error) {
	rows, e := form.GetValue(path)
	if e != nil {
		return nil, e
	}
	object, ok := rows.(*Object)
	if !ok {
		return nil, inputError("Repeated data must be a keyed object: %s", path)
	}
	return object.Keys(), nil
}
