package generator

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
)

// Byte strings that are not UTF-8 are invalid text in every generator input.
// The shared cases of legacy/tests/fixtures/text-validity run in TestInputTextCases and the functions of its units.
func TestInputTextRejectsInvalidUTF8(t *testing.T) {
	const bad = "\xed\xa0\x80"
	message := func(e error) string {
		if e == nil {
			return ""
		}
		return e.Error()
	}
	loadAt := func(e error) string {
		var load *compose.ComposeLoadError
		if !errors.As(e, &load) || load.Code != compose.InvalidText || load.Message != "Text must be Unicode scalar values" {
			return "not a text load failure: " + message(e)
		}
		return strings.Join(load.Trace, ".")
	}
	spec := parseObject(t, `{"type":"group","properties":{"name":{"type":"text"},"rows":{"type":"group","multiple":true,"properties":{"v":{"type":"text"}}}}}`)
	template := compile(t, `{"type":"group","properties":{"name":{"type":"text"},"rows":{"type":"group","multiple":true,"properties":{"v":{"type":"text"}}}}}`)

	bad1 := parseObject(t, `{"type":"group","properties":{"name":{"type":"text","label":"x"}}}`)
	label, _ := bad1.Get("properties")
	field, _ := object(label).Get("name")
	object(field).Set("label", "x"+bad)
	if _, e := CompileForm(bad1, CompileOptions{}); loadAt(e) != "properties.name.label" {
		t.Errorf("compile label: %v", e)
	}
	if _, e := CompileForm(spec, CompileOptions{Files: map[string]*Object{"b.yml": NewObject("x", NewObject(bad, 1))}}); loadAt(e) != "b.yml.x" {
		t.Errorf("compile file: %v", e)
	}
	loader := compose.NewMemoryLoader(map[string]*Object{"b.yml": NewObject("properties", NewObject("x", NewObject("type", bad)))})
	ref := parseObject(t, `{"type":"group","properties":{"$ref":"b.yml"}}`)
	if _, e := CompileForm(ref, CompileOptions{Loader: loader, Files: map[string]*Object{bad: NewObject()}}); loadAt(e) != "b.yml.properties.x.type" {
		t.Errorf("compile loader: %v", e)
	}
	if _, e := CompileForm(spec, CompileOptions{KeyPrefix: bad}); message(e) != "Text must be Unicode scalar values: options.keyPrefix" {
		t.Errorf("compile key prefix: %v", e)
	}
	if _, e := BindForm(template, NewObject("rows", NewObject("k", NewObject("v", bad))), BindOptions{}); message(e) != "Text must be Unicode scalar values: data.rows.k.v" {
		t.Errorf("bind data: %v", e)
	}
	if _, e := BindButtons(template, nil, BindOptions{Unsupported: bad, Language: bad}); message(e) != "Text must be Unicode scalar values: options.language" {
		t.Errorf("buttons options: %v", e)
	}
	if _, e := NewForm(template, NewObject(bad, 1), BindOptions{}); message(e) != "Text must be Unicode scalar values: data" {
		t.Errorf("new form: %v", e)
	}
	form, e := NewForm(template, NewObject("rows", NewObject("k", NewObject("v", "a"))), BindOptions{})
	if e != nil {
		t.Fatal(e)
	}
	for name, run := range map[string]func() error{
		"path":             func() error { return form.SetValue("name"+bad, "x") },
		"value.1":          func() error { return form.SetValue("name", []any{"ok", bad}) },
		"data.name":        func() error { return form.SetData(NewObject("name", bad)) },
		"options.afterKey": func() error { _, e := form.AddRow("rows", AddRowOptions{AfterKey: bad, Key: bad}); return e },
		"key":              func() error { _, e := form.CopyRow("rows", bad, AddRowOptions{}); return e },
		"newKey":           func() error { return form.RekeyRow("rows", "k", bad) },
	} {
		if message(run()) != "Text must be Unicode scalar values: "+name {
			t.Errorf("%s: %v", name, run())
		}
	}
	if _, e := form.GetValue(bad); message(e) != "Text must be Unicode scalar values: path" {
		t.Errorf("get value: %v", e)
	}
	list := parseObject(t, `{"columns":{"v":{"field":"v"}}}`)
	if _, e := RenderList(list, []*Object{NewObject("v", "a"), NewObject("v", bad)}, ListOptions{Page: 0}); message(e) != "Text must be Unicode scalar values: rows.1.v" {
		t.Errorf("render list rows: %v", e)
	}
	if _, e := BuildList(list, []*Object{}, ListOptions{Layout: bad, Data: NewObject("a", bad)}); message(e) != "Text must be Unicode scalar values: options.data.a" {
		t.Errorf("list options: %v", e)
	}
	detail := parseObject(t, `{"fields":{"v":{"field":"v"}}}`)
	if _, e := RenderDetail(detail, NewObject("v", bad), DetailOptions{}); message(e) != "Text must be Unicode scalar values: record.v" {
		t.Errorf("detail record: %v", e)
	}
	// A value that contains itself is beyond the value limits, found by the same walk.
	cyclic := []any{nil}
	cyclic[0] = cyclic
	if e := form.SetValue("name", cyclic); message(e) != "Recursive or excessively nested value: value" {
		t.Errorf("cyclic value: %v", e)
	}
}

// fixtureCase is one case of a text-validity fixture: each member decoded
// with the order-preserving reader, and the raw JSON text of each member, which
// a case gives as a template.
type fixtureCase struct {
	members map[string]any
	raw     map[string][]byte
}

func loadTextFixture(t *testing.T, feature string) []fixtureCase {
	t.Helper()
	path := filepath.Join("..", "..", "..", "tests", "fixtures", "text-validity", feature, "cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("shared text-validity fixture not found at %s: %v", path, err)
	}
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		t.Fatalf("fixture json decode: %v", err)
	}
	cases := make([]fixtureCase, 0, len(items))
	for _, item := range items {
		members, err := compose.DecodeRawMembers(item)
		if err != nil {
			t.Fatalf("fixture case decode: %v", err)
		}
		c := fixtureCase{members: map[string]any{}, raw: map[string][]byte{}}
		for _, m := range members {
			v, err := compose.DecodeOrdered(m.Value)
			if err != nil {
				t.Fatalf("fixture member %s decode: %v", m.Name, err)
			}
			c.members[m.Name] = v
			c.raw[m.Name] = m.Value
		}
		cases = append(cases, c)
	}
	if len(cases) == 0 {
		t.Fatal("fixture is empty")
	}
	return cases
}

// argObject returns the object member key of a case, or an empty object when
// the case has none.
func argObject(c fixtureCase, key string) *Object {
	if o, ok := c.members[key].(*Object); ok {
		return o
	}
	return NewObject()
}

func textOptionValue(options *Object, key string) any {
	v, _ := options.Get(key)
	return v
}

// textOptionString reads an option that is text; an absent or null option is "", and any other type fails the case.
func textOptionString(t *testing.T, options *Object, key string) string {
	v := textOptionValue(options, key)
	if v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		t.Fatalf("option %s is %T, not text", key, v)
	}
	return s
}

func textOptionFiles(options *Object) map[string]*Object {
	files := map[string]*Object{}
	if group, ok := textOptionValue(options, "files").(*Object); ok {
		for _, name := range group.Keys() {
			if o, ok := textOptionValue(group, name).(*Object); ok {
				files[name] = o
			}
		}
	}
	return files
}

func listOptionsOf(t *testing.T, options *Object) ListOptions {
	return ListOptions{
		Language: textOptionString(t, options, "language"),
		Data:     textOptionValue(options, "data"),
		Layout:   textOptionValue(options, "layout"),
		Basepath: textOptionString(t, options, "basepath"),
		Files:    textOptionFiles(options),
	}
}

func bindOptionsOf(options *Object) BindOptions {
	return BindOptions{
		IDPrefix:    textOptionValue(options, "idPrefix"),
		Language:    textOptionValue(options, "language"),
		KeyPrefix:   textOptionValue(options, "keyPrefix"),
		Unsupported: textOptionValue(options, "unsupported"),
	}
}

// templateOf decodes the template a case gives as JSON text, or compiles its
// specification when the case gives none.
func templateOf(c fixtureCase) (*FormTemplate, error) {
	if raw, ok := c.raw["template"]; ok {
		// A template decoded from JSON text is checked before its decoding, which
		// reports its shape (CheckBindText).
		if err := checkInputText(text.Input{Name: "template", Value: c.members["template"]}); err != nil {
			return nil, err
		}
		var template FormTemplate
		if err := json.Unmarshal(raw, &template); err != nil {
			return nil, err
		}
		return &template, nil
	}
	return CompileForm(argObject(c, "spec"), CompileOptions{})
}

func rowsOf(c fixtureCase) []any {
	if rows, ok := c.members["rows"].([]any); ok {
		return rows
	}
	return []any{}
}

func asString(t *testing.T, v any) string {
	if v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		t.Fatalf("argument is %T, not text", v)
	}
	return s
}

func asInt(t *testing.T, v any) int {
	if v == nil {
		return 0
	}
	n, ok := v.(float64)
	if !ok {
		t.Fatalf("argument is %T, not a number", v)
	}
	return int(n)
}

// runAction calls the form method that a case's action names, with its args.
func runAction(t *testing.T, form *Form, action *Object) error {
	method := textOptionString(t, action, "method")
	raw := textOptionValue(action, "args")
	args, ok := raw.([]any)
	if !ok && raw != nil {
		t.Fatalf("the action args are %T, not an array", raw)
	}
	arg := func(i int) any {
		if i < len(args) {
			return args[i]
		}
		return nil
	}
	switch method {
	case "setData":
		var data *Object
		if v := arg(0); v != nil {
			o, ok := v.(*Object)
			if !ok {
				t.Fatalf("the data of setData is %T, not an object", v)
			}
			data = o
		}
		return form.SetData(data)
	case "setValue":
		return form.SetValue(asString(t, arg(0)), arg(1))
	case "getValue":
		_, err := form.GetValue(asString(t, arg(0)))
		return err
	case "addRow":
		var options AddRowOptions
		if o, ok := arg(1).(*Object); ok {
			options.Key = textOptionString(t, o, "key")
			options.AfterKey = textOptionString(t, o, "afterKey")
			options.Value = textOptionValue(o, "value")
			options.ValueProvided = o.Has("value")
		}
		_, err := form.AddRow(asString(t, arg(0)), options)
		return err
	case "copyRow":
		_, err := form.CopyRow(asString(t, arg(0)), asString(t, arg(1)), AddRowOptions{})
		return err
	case "removeRow":
		return form.RemoveRow(asString(t, arg(0)), asString(t, arg(1)))
	case "moveRow":
		return form.MoveRow(asString(t, arg(0)), asString(t, arg(1)), asInt(t, arg(2)))
	case "rekeyRow":
		return form.RekeyRow(asString(t, arg(0)), asString(t, arg(1)), asString(t, arg(2)))
	}
	return errors.New("unknown form action " + method)
}

// textOperations runs one case of each generator operation of the input text
// fixtures and returns its error, or nil when the case passes.
var textOperations = map[string]func(t *testing.T, c fixtureCase) error{
	"compileForm": func(t *testing.T, c fixtureCase) error {
		options := argObject(c, "options")
		_, err := CompileForm(argObject(c, "spec"), CompileOptions{
			Files:             textOptionFiles(options),
			Basepath:          textOptionString(t, options, "basepath"),
			KeyPrefix:         textOptionString(t, options, "keyPrefix"),
			KeyPrefixProvided: options.Has("keyPrefix"),
		})
		return err
	},
	"bindForm": func(t *testing.T, c fixtureCase) error {
		template, err := templateOf(c)
		if err != nil {
			return err
		}
		_, err = BindForm(template, argObject(c, "data"), bindOptionsOf(argObject(c, "options")))
		return err
	},
	"createForm": func(t *testing.T, c fixtureCase) error {
		template, err := templateOf(c)
		if err != nil {
			return err
		}
		form, err := NewForm(template, argObject(c, "data"), bindOptionsOf(argObject(c, "options")))
		if err != nil {
			return err
		}
		action, ok := c.members["action"].(*Object)
		if !ok {
			return nil
		}
		return runAction(t, form, action)
	},
	"buildList": func(t *testing.T, c fixtureCase) error {
		_, err := BuildList(argObject(c, "spec"), rowsOf(c), listOptionsOf(t, argObject(c, "options")))
		return err
	},
	"buildDetail": func(t *testing.T, c fixtureCase) error {
		record, ok := c.members["record"]
		if !ok || record == nil {
			record = NewObject()
		}
		_, err := BuildDetail(argObject(c, "spec"), record, listOptionsOf(t, argObject(c, "options")))
		return err
	},
}

// outcomeOf returns the case outcome in the fixture's expect shape: "pass", or
// the failure code, message and path.
func outcomeOf(t *testing.T, err error) any {
	if err == nil {
		return "pass"
	}
	var load *compose.ComposeLoadError
	if errors.As(err, &load) {
		return NewObject("code", string(load.Code), "message", load.Message, "at", strings.Join(load.Trace, "."))
	}
	return NewObject("code", failureCode(t, err), "message", err.Error(), "at", "")
}

// TestInputTextCases runs every case of the five generator fixtures of
// legacy/tests/fixtures/text-validity (CUIT-010..013 and the form operations of
// CUIT-011, CUIT-014..020) through the public generator API, each fixture as a
// subtest named by the fixture. The units of the fixtures are bound to the
// functions below, one each.
func TestInputTextCases(t *testing.T) {
	for _, feature := range []string{"compileForm", "bindForm", "createForm", "buildList", "buildDetail"} {
		t.Run(feature, func(t *testing.T) { runTextCases(t, feature) })
	}
}

// TestInputTextCompileForm runs the cases of the compileForm fixture (the unit text-compile-form).
func TestInputTextCompileForm(t *testing.T) { runTextCases(t, "compileForm") }

// TestInputTextBindForm runs the cases of the bindForm fixture (the unit text-bind-form).
func TestInputTextBindForm(t *testing.T) { runTextCases(t, "bindForm") }

// TestInputTextCreateForm runs the cases of the createForm fixture (the unit text-create-form).
func TestInputTextCreateForm(t *testing.T) { runTextCases(t, "createForm") }

// TestInputTextBuildList runs the cases of the buildList fixture (the unit text-build-list).
func TestInputTextBuildList(t *testing.T) { runTextCases(t, "buildList") }

// TestInputTextBuildDetail runs the cases of the buildDetail fixture (the unit text-build-detail).
func TestInputTextBuildDetail(t *testing.T) { runTextCases(t, "buildDetail") }

// runTextCases runs every case of one fixture through its operation as a direct subtest named by the case.
func runTextCases(t *testing.T, feature string) {
	run := textOperations[feature]
	for _, c := range loadTextFixture(t, feature) {
		name, ok := c.members["name"].(string)
		if !ok {
			t.Fatalf("a %s case has no name", feature)
		}
		t.Run(name, func(t *testing.T) {
			got, err := json.Marshal(outcomeOf(t, run(t, c)))
			if err != nil {
				t.Fatal(err)
			}
			want, err := json.Marshal(c.members["expect"])
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != string(want) {
				t.Errorf("got %s\nwant %s", got, want)
			}
		})
	}
}

// TestInputTextFailureTypes checks CUIT-041: a generation failure of invalid text is a *compose.ComposeLoadError, and an
// input failure is an error with its message that is not a load failure. The type is checked, not only the code.
func TestInputTextFailureTypes(t *testing.T) {
	for _, feature := range []string{"compileForm", "bindForm", "createForm", "buildList", "buildDetail"} {
		run := textOperations[feature]
		for _, c := range loadTextFixture(t, feature) {
			name, ok := c.members["name"].(string)
			if !ok {
				t.Fatalf("a %s case has no name", feature)
			}
			err := run(t, c)
			if c.members["expect"] == "pass" {
				if err != nil {
					t.Errorf("%s/%s: a passing case returned %v", feature, name, err)
				}
				continue
			}
			want, ok := c.members["expect"].(*Object)
			if !ok {
				t.Fatalf("%s/%s: the expectation is not a failure", feature, name)
			}
			code := textOptionString(t, want, "code")
			var load *compose.ComposeLoadError
			isLoad := errors.As(err, &load)
			if (code == "INVALID_TEXT") != isLoad {
				t.Errorf("%s/%s: code %s needs the load failure type of its class, got %T", feature, name, code, err)
			}
		}
	}
}
