package generator

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/testsupport/conformance"
	"github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

// The cases of legacy/tests/fixtures/{form-view,form-history,form-actions,view-functions,history-functions} are the
// observations of the TypeScript reference; see legacy/tests/fixtures/form-state/README.md.

var generatedKey = regexp.MustCompile(`__[0-9A-Za-z]{13}__`)

// recordFixtureConformance records the actual case result with its declared fixture path.
func recordFixtureConformance(t *testing.T, feature, family, name string) {
	t.Helper()
	conformance.Record(t, feature, "legacy/tests/fixtures/"+family+"/cases.json", name)
}

// fixtureCases reads the cases of a fixture family.
func fixtureCases(t *testing.T, family string) []*Object {
	t.Helper()
	bytes, e := os.ReadFile(filepath.Join("..", "..", "..", "tests", "fixtures", family, "cases.json"))
	if e != nil {
		t.Fatal(e)
	}
	decoded, e := DecodeJSON(bytes)
	if e != nil {
		t.Fatal(e)
	}
	cases := []*Object{}
	for _, c := range list(decoded) {
		cases = append(cases, object(c))
	}
	if len(cases) == 0 {
		t.Fatalf("%s holds no case", family)
	}
	return cases
}

// fixtureString returns a fixture value that must be a string, and fails the test otherwise.
func fixtureString(t *testing.T, value any) string {
	t.Helper()
	s, ok := value.(string)
	if !ok {
		t.Fatalf("fixture value %v is %T, want a string", value, value)
	}
	return s
}

// fixtureText returns the text argument at index i of a fixture call, which must be a string.
func fixtureText(t *testing.T, args []any, i int) string {
	t.Helper()
	return fixtureString(t, args[i])
}

// marshal is the JSON text of a value.
func marshal(t *testing.T, value any) string {
	t.Helper()
	bytes, e := json.Marshal(value)
	if e != nil {
		t.Fatal(e)
	}
	return string(bytes)
}

// namer names the row keys that an operation generated `$1`, `$2` in order of first appearance.
type namer struct {
	known     map[string]bool
	generated map[string]string
}

func newNamer(texts ...string) *namer {
	n := &namer{known: map[string]bool{}, generated: map[string]string{}}
	for _, text := range texts {
		for _, key := range generatedKey.FindAllString(text, -1) {
			n.known[key] = true
		}
	}
	return n
}

func (n *namer) rename(text string) string {
	return generatedKey.ReplaceAllStringFunc(text, func(key string) string {
		if n.known[key] {
			return key
		}
		name, ok := n.generated[key]
		if !ok {
			name = "$" + strconv.Itoa(len(n.generated)+1)
			n.generated[key] = name
		}
		return name
	})
}

// walk returns the value with the generated keys of its strings and object keys named.
func (n *namer) walk(value any) any {
	switch v := value.(type) {
	case string:
		return n.rename(v)
	case []string:
		out := make([]any, len(v))
		for i, s := range v {
			out[i] = n.rename(s)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = n.walk(item)
		}
		return out
	case *Object:
		out := NewObject()
		for _, key := range v.Keys() {
			out.Set(n.rename(key), n.walk(read(v, key)))
		}
		return out
	}
	return value
}

// collapsedRows returns the row paths of the collapsed rows of the evaluated nodes, depth first.
func collapsedRows(nodes []*Object) []string {
	out := []string{}
	var visit func(nodes []*Object)
	visit = func(nodes []*Object) {
		for _, node := range nodes {
			children := objectList(read(node, "children"))
			if stringAt(node, "kind") != "collection" {
				visit(children)
				continue
			}
			for _, row := range children {
				if read(row, "collapsible") == true && read(row, "expanded") == false {
					out = append(out, stringAt(node, "path")+"."+stringAt(row, "key"))
				}
				visit(objectList(read(row, "children")))
			}
		}
	}
	visit(nodes)
	return out
}

// fieldChoices returns the value and label of each option of the field node at a data path, depth first.
func fieldChoices(nodes []*Object, path string) (any, bool) {
	for _, node := range nodes {
		if stringAt(node, "kind") == "field" && stringAt(node, "path") == path {
			out := []any{}
			for _, option := range objectList(read(read(node, "widget"), "options")) {
				out = append(out, NewObject("value", stringAt(option, "value"), "label", stringAt(option, "label")))
			}
			return out, true
		}
		if found, ok := fieldChoices(objectList(read(node, "children")), path); ok {
			return found, true
		}
	}
	return nil, false
}

// addRowOptions reads the options of addRow and copyRow from a step argument.
func addRowOptions(options any) AddRowOptions {
	out := AddRowOptions{Key: stringAt(options, "key"), AfterKey: stringAt(options, "afterKey")}
	if has(options, "value") {
		out.Value, out.ValueProvided = read(options, "value"), true
	}
	return out
}

// perform runs one step on the form and returns what the step returned.
func performStep(t *testing.T, form *Form, spec *Object, op string, args []any) (any, error) {
	t.Helper()
	text := func(i int) string { return fixtureText(t, args, i) }
	switch op {
	case "validate":
		// The validator reads its data as a plain map; the errors follow the specification, so the decoded order does not matter.
		var data map[string]any
		if e := json.Unmarshal([]byte(marshal(t, form.GetData())), &data); e != nil {
			return nil, e
		}
		result, e := validate.Validate(spec, data, validate.Options{})
		if e != nil {
			return nil, e
		}
		errors := make([]any, 0, len(result.Errors))
		for _, item := range result.Errors {
			errors = append(errors, NewObject("path", item.Path, "field", item.Field, "rule", item.Rule, "message", item.Message))
		}
		return NewObject("valid", result.Valid, "errors", errors), nil
	case "choices":
		found, ok := fieldChoices(form.Fields(), text(0))
		if !ok {
			t.Fatalf("no field node at %s", text(0))
		}
		return found, nil
	case "resolveAction":
		target, ok := ResolveAction(ActionInput{Action: stringAt(args[0], "action"), Path: stringAt(args[0], "path"), Key: stringAt(args[0], "key")})
		if !ok {
			return nil, nil
		}
		return actionTargetObject(target), nil
	case "runAction":
		result, e := RunAction(form, ActionTarget{Name: stringAt(args[0], "name"), Path: stringAt(args[0], "path"), Key: stringAt(args[0], "key")})
		if e != nil {
			return nil, e
		}
		return actionResultObject(result), nil
	case "addRow":
		options := any(NewObject())
		if len(args) > 1 {
			options = args[1]
		}
		return form.AddRow(text(0), addRowOptions(options))
	case "copyRow":
		options := any(NewObject())
		if len(args) > 2 {
			options = args[2]
		}
		return form.CopyRow(text(0), text(1), addRowOptions(options))
	case "removeRow":
		return nil, form.RemoveRow(text(0), text(1))
	case "moveRow":
		index, e := strconv.Atoi(marshal(t, args[2]))
		if e != nil {
			t.Fatal(e)
		}
		return nil, form.MoveRow(text(0), text(1), index)
	case "rekeyRow":
		return nil, form.RekeyRow(text(0), text(1), text(2))
	case "setValue":
		return nil, form.SetValue(text(0), args[1])
	case "setData":
		return nil, form.SetData(object(args[0]))
	case "toggleRow":
		return nil, form.ToggleRow(text(0), text(1))
	case "setAllExpanded":
		return nil, form.SetAllExpanded(args[0] == true)
	case "undo":
		return nil, form.Undo()
	case "redo":
		return nil, form.Redo()
	}
	t.Fatalf("unknown step %s", op)
	return nil, nil
}

// observeSessions runs every session of a family and requires the observations of the reference.
func observeSessions(t *testing.T, family string, history bool) {
	for _, c := range fixtureCases(t, family) {
		c := c
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			feature := map[string]string{"form-view": "viewState", "form-history": "formHistory", "form-actions": "runAction", "form-choices": "createForm"}[family]
			recordFixtureConformance(t, feature, family, stringAt(c, "name"))
			spec, data, steps := read(c, "spec"), read(c, "data"), list(read(c, "steps"))
			name := newNamer(marshal(t, spec), marshal(t, data), marshal(t, steps))
			template, e := CompileForm(object(spec), CompileOptions{})
			if e != nil {
				t.Fatal(e)
			}
			form, e := NewForm(template, object(data), BindOptions{})
			if e != nil {
				t.Fatal(e)
			}
			expected := list(read(c, "expected"))
			for i, step := range steps {
				observed := NewObject()
				op := stringAt(step, "op")
				result, e := performStep(t, form, object(spec), op, list(read(step, "args")))
				if e != nil {
					observed.Set("error", NewObject("code", failureCode(t, e), "message", e.Error()))
				} else if result != nil || op == "runAction" || op == "resolveAction" {
					observed.Set("result", name.walk(result))
				}
				observed.Set("data", name.walk(form.GetData()))
				observed.Set("revision", form.Revision())
				if history {
					observed.Set("canUndo", form.CanUndo())
					observed.Set("canRedo", form.CanRedo())
				}
				observed.Set("collapsed", name.walk(collapsedRows(form.Fields())))
				if got, want := marshal(t, observed), marshal(t, expected[i]); got != want {
					t.Fatalf("step %d %s\n got %s\nwant %s", i, marshal(t, step), got, want)
				}
			}
		})
	}
}

// TestFormView runs the view state sessions of the fixtures.
func TestFormView(t *testing.T) { observeSessions(t, "form-view", false) }

// TestFormHistory runs the undo history sessions of the fixtures.
func TestFormHistory(t *testing.T) { observeSessions(t, "form-history", true) }

// TestFormActions runs the action sessions of the fixtures, with the history flags.
func TestFormActions(t *testing.T) { observeSessions(t, "form-actions", true) }

// TestFormChoices runs the sessions of the choices of a group source, with the history flags.
func TestFormChoices(t *testing.T) { observeSessions(t, "form-choices", true) }

// actionTargetObject is the JSON object of an action target; path and key are absent when empty.
func actionTargetObject(target ActionTarget) *Object {
	out := NewObject("name", target.Name)
	if target.Path != "" {
		out.Set("path", target.Path)
	}
	if target.Key != "" {
		out.Set("key", target.Key)
	}
	return out
}

// actionResultObject is the JSON value of an action result; nil when the action had no result.
func actionResultObject(result *ActionResult) any {
	if result == nil {
		return nil
	}
	out := NewObject()
	if result.Focus != nil {
		focus := NewObject("path", result.Focus.Path)
		if result.Focus.Key != "" {
			focus.Set("key", result.Focus.Key)
		}
		out.Set("focus", focus)
	}
	return out
}

// viewObject is the JSON object of a view.
func viewObject(view ViewState) *Object {
	collapsed := make([]any, len(view.Collapsed))
	for i, path := range view.Collapsed {
		collapsed[i] = path
	}
	return NewObject("collapsed", collapsed)
}

// viewOf reads the view of a function case argument.
func viewOf(t *testing.T, value any) ViewState {
	t.Helper()
	view := InitialView()
	for _, path := range list(read(value, "collapsed")) {
		view.Collapsed = append(view.Collapsed, fixtureString(t, path))
	}
	return view
}

// nodesOf binds the form of a function case.
func nodesOf(t *testing.T, spec, data any, collapsed []string) []*Object {
	t.Helper()
	template, e := CompileForm(object(spec), CompileOptions{})
	if e != nil {
		t.Fatal(e)
	}
	nodes, e := BindForm(template, object(data), BindOptions{Collapsed: collapsed})
	if e != nil {
		t.Fatal(e)
	}
	return nodes
}

// callViewFunction calls the view function of a case.
func callViewFunction(t *testing.T, op string, args []any) any {
	t.Helper()
	text := func(i int) string { return fixtureText(t, args, i) }
	switch op {
	case "initialView":
		return viewObject(InitialView())
	case "toggleRowView":
		return viewObject(ToggleRowView(viewOf(t, args[0]), text(1)))
	case "collapsibleRows":
		return CollapsibleRows(nodesOf(t, args[0], args[1], nil))
	case "setAllExpandedView":
		return viewObject(SetAllExpandedView(nodesOf(t, args[0], args[1], nil), args[2] == true))
	case "removeRowView":
		return viewObject(RemoveRowView(viewOf(t, args[0]), text(1)))
	case "rekeyRowView":
		return viewObject(RekeyRowView(viewOf(t, args[0]), text(1), text(2)))
	case "bindCollapsed":
		collapsed := []string{}
		for _, path := range list(args[2]) {
			collapsed = append(collapsed, fixtureString(t, path))
		}
		return collapsedRows(nodesOf(t, args[0], args[1], collapsed))
	}
	t.Fatalf("unknown function %s", op)
	return nil
}

// TestViewFunctions runs the view function cases of the fixtures.
func TestViewFunctions(t *testing.T) {
	for _, c := range fixtureCases(t, "view-functions") {
		c := c
		t.Run(stringAt(c, "name"), func(t *testing.T) {
			recordFixtureConformance(t, "viewState", "view-functions", stringAt(c, "name"))
			got := NewObject("result", callViewFunction(t, stringAt(c, "op"), list(read(c, "args"))))
			if g, w := marshal(t, got), marshal(t, read(c, "expected")); g != w {
				t.Fatalf("\n got %s\nwant %s", g, w)
			}
		})
	}
}
