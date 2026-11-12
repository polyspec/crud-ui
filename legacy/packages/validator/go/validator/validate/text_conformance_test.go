package validate

// Input text conformance verifies the Go validator against the validation
// families of legacy/tests/fixtures/text-validity. CUIT-041: a load failure is a *compose.ComposeLoadError and an input failure a
// *FormInputError; each run asserts the type it returns. The fixture JSON text carries
// unpaired surrogate escapes; compose.DecodeOrdered keeps them as text that is
// not valid UTF-8, so the JSON entry points and the value entry points report
// the failure the fixture declares.

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/internal/conformance"
)

// textCase holds the raw JSON text of each member of one fixture case.
type textCase map[string][]byte

func loadTextCases(t *testing.T, feature string) []textCase {
	t.Helper()
	path := filepath.Join("..", "..", "..", "..", "..", "tests", "fixtures", "text-validity", feature, "cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("shared text-validity fixture not found at %s: %v", path, err)
	}
	// json.RawMessage keeps each case's text exactly as written.
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		t.Fatalf("fixture json decode: %v", err)
	}
	cases := make([]textCase, 0, len(items))
	for _, item := range items {
		members, err := compose.DecodeRawMembers(item)
		if err != nil {
			t.Fatalf("fixture case decode: %v", err)
		}
		c := textCase{}
		for _, m := range members {
			c[m.Name] = m.Value
		}
		cases = append(cases, c)
	}
	if len(cases) == 0 {
		t.Fatal("fixture is empty")
	}
	return cases
}

func (c textCase) name(t *testing.T) string {
	var name string
	if err := json.Unmarshal(c["name"], &name); err != nil {
		t.Fatalf("case name: %v", err)
	}
	return name
}

// jsonInputs returns the raw files and the decoded base path of a case.
func (c textCase) jsonInputs(t *testing.T) (map[string][]byte, string) {
	t.Helper()
	files := map[string][]byte{}
	if raw, ok := c["files"]; ok {
		members, err := compose.DecodeRawMembers(raw)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range members {
			files[m.Name] = m.Value
		}
	}
	basepath := ""
	if raw, ok := c["options"]; ok {
		options, err := compose.DecodeOrdered(raw)
		if err != nil {
			t.Fatal(err)
		}
		optionsMap, ok := options.(*compose.OMap)
		if !ok {
			t.Fatalf("options decoded as %T, want an object", options)
		}
		if value, found := optionsMap.Get("basepath"); found {
			text, ok := value.(string)
			if !ok {
				t.Fatalf("basepath decoded as %T, want a string", value)
			}
			basepath = text
		}
	}
	return files, basepath
}

// valueInputs returns the decoded specification and options of a case.
func (c textCase) valueInputs(t *testing.T) (*compose.OMap, Options) {
	t.Helper()
	spec, err := compose.DecodeOrdered(c["spec"])
	if err != nil {
		t.Fatal(err)
	}
	files, basepath := c.jsonInputs(t)
	opts := Options{Files: FileSet{}, Basepath: basepath}
	for name, raw := range files {
		doc, err := compose.DecodeOrdered(raw)
		if err != nil {
			t.Fatal(err)
		}
		docMap, ok := doc.(*compose.OMap)
		if !ok {
			t.Fatalf("file %s decoded as %T, want an object", name, doc)
		}
		opts.Files[name] = docMap
	}
	specMap, ok := spec.(*compose.OMap)
	if !ok {
		t.Fatalf("spec decoded as %T, want an object", spec)
	}
	return specMap, opts
}

// textOutcome is the failure {code, message, at, type} or the validation result with type "none". The type names the
// native error (CUIT-041): a load failure is *compose.ComposeLoadError, an input failure is *FormInputError.
func textOutcome(t *testing.T, result any, err error) any {
	var load *compose.ComposeLoadError
	if errors.As(err, &load) {
		return map[string]any{"code": string(load.Code), "message": load.Message, "at": strings.Join(load.Trace, "."), "type": "ComposeLoadError"}
	}
	var input *FormInputError
	if errors.As(err, &input) {
		return map[string]any{"code": input.Code(), "message": input.Message, "at": "", "type": "FormInputError"}
	}
	if err != nil {
		return err.Error()
	}
	encoded, marshalErr := json.Marshal(result)
	if marshalErr != nil {
		t.Fatal(marshalErr)
	}
	var out map[string]any
	if unmarshalErr := json.Unmarshal(encoded, &out); unmarshalErr != nil {
		t.Fatal(unmarshalErr)
	}
	if out["errors"] == nil {
		out["errors"] = []any{}
	}
	out["type"] = "none"
	return out
}

func checkTextOutcome(t *testing.T, c textCase, label string, got any) {
	t.Helper()
	checkOutcome(t, label, got, c["expect"])
}

// checkOutcome compares an outcome with its expectation, and the native type of the error with the type that the
// expectation names: a load failure is a ComposeLoadError, an input failure a FormInputError, and a pass none (CUIT-041).
func checkOutcome(t *testing.T, label string, got any, expect json.RawMessage) {
	t.Helper()
	var want any
	if err := json.Unmarshal(expect, &want); err != nil {
		t.Fatal(err)
	}
	native := ""
	if m, ok := got.(map[string]any); ok {
		typed, found := m["type"].(string)
		if !found {
			t.Fatalf("%s: the outcome %#v names no native type", label, got)
		}
		native = typed
		delete(m, "type")
	}
	expected := "none"
	if m, ok := want.(map[string]any); ok {
		switch m["code"] {
		case "INVALID_TEXT":
			expected = "ComposeLoadError"
		case "INVALID_FORM_INPUT":
			expected = "FormInputError"
		}
	}
	if native != expected {
		t.Errorf("%s: the native type is %q, want %q", label, native, expected)
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("%s: got %#v, want %#v", label, got, want)
	}
}

// TestInputTextMatchesFixture runs the cases of the three validator text-validity fixtures, each under its fixture's name.
// The units of the fixtures are bound to the functions below, one each.
func TestInputTextMatchesFixture(t *testing.T) {
	for _, feature := range []string{"validate", "validateList", "validateDetail"} {
		t.Run(feature, func(t *testing.T) { runTextFixture(t, feature) })
	}
}

// TestInputTextValidate runs the cases of the validate fixture (the unit text-validity-validate).
func TestInputTextValidate(t *testing.T) { runTextFixture(t, "validate") }

// TestInputTextValidateList runs the cases of the validateList fixture (the unit text-validity-validate-list).
func TestInputTextValidateList(t *testing.T) { runTextFixture(t, "validateList") }

// TestInputTextValidateDetail runs the cases of the validateDetail fixture (the unit text-validity-validate-detail).
func TestInputTextValidateDetail(t *testing.T) { runTextFixture(t, "validateDetail") }

// runTextFixture runs every case of one text-validity fixture through the JSON and the value entry points, as a direct subtest
// named by the case.
func runTextFixture(t *testing.T, feature string) {
	type entry struct {
		json  func(c textCase, files map[string][]byte, basepath string) (any, error)
		value func(spec *compose.OMap, data any, opts Options) (any, error)
	}
	decodeData := func(t *testing.T, c textCase) (json.RawMessage, any) {
		raw, ok := c["data"]
		if !ok {
			return nil, map[string]any{}
		}
		decoded, err := compose.DecodeOrdered(raw)
		if err != nil {
			t.Fatal(err)
		}
		return raw, plainValue(decoded)
	}
	features := map[string]entry{
		"validate": {
			json: func(c textCase, files map[string][]byte, basepath string) (any, error) {
				return ValidateJSON(c["spec"], c["data"], files, basepath)
			},
			value: func(spec *compose.OMap, data any, opts Options) (any, error) {
				return Validate(spec, data, opts)
			},
		},
		"validateList": {
			json: func(c textCase, files map[string][]byte, basepath string) (any, error) {
				return ValidateListJSON(c["spec"], files, basepath)
			},
			value: func(spec *compose.OMap, _ any, opts Options) (any, error) {
				return ValidateList(spec, opts)
			},
		},
		"validateDetail": {
			json: func(c textCase, files map[string][]byte, basepath string) (any, error) {
				return ValidateDetailJSON(c["spec"], files, basepath)
			},
			value: func(spec *compose.OMap, _ any, opts Options) (any, error) {
				return ValidateDetail(spec, opts)
			},
		},
	}
	run := features[feature]
	fixture := "legacy/tests/fixtures/text-validity/" + feature + "/cases.json"
	for _, c := range loadTextCases(t, feature) {
		c := c
		name := c.name(t)
		t.Run(name, func(t *testing.T) {
			conformance.Record(t, feature, fixture, name)
			files, basepath := c.jsonInputs(t)
			jsonResult, jsonErr := run.json(c, files, basepath)
			checkTextOutcome(t, c, "JSON text", textOutcome(t, jsonResult, jsonErr))
			spec, opts := c.valueInputs(t)
			_, data := decodeData(t, c)
			valueResult, valueErr := run.value(spec, data, opts)
			checkTextOutcome(t, c, "values", textOutcome(t, valueResult, valueErr))
		})
	}
}

// Byte strings that are not UTF-8 cannot be written in JSON text; they are
// invalid text in Go values and inside JSON strings.
func TestInvalidUTF8Bytes(t *testing.T) {
	spec := func(label string) *compose.OMap {
		field := compose.NewOMap()
		field.Set("type", "text")
		field.Set("label", label)
		properties := compose.NewOMap()
		properties.Set("name", field)
		root := compose.NewOMap()
		root.Set("type", "group")
		root.Set("properties", properties)
		return root
	}
	for name, bytes := range map[string]string{
		"lone byte":          "\xff",
		"continuation":       "a\x80",
		"truncated":          "\xe2\x82",
		"overlong":           "\xc0\xaf",
		"encoded surrogate":  "\xed\xa0\x80",
		"above U+10FFFF":     "\xf4\x90\x80\x80",
		"five-byte sequence": "\xf8\x88\x80\x80\x80",
	} {
		_, err := Validate(spec("A"+bytes), map[string]any{}, Options{})
		var load *compose.ComposeLoadError
		if !errors.As(err, &load) || load.Code != compose.InvalidText || strings.Join(load.Trace, ".") != "properties.name.label" {
			t.Errorf("%s in a label: %v", name, err)
		}
		_, err = Validate(spec("A"), map[string]any{"rows": []any{"ok", map[string]any{bytes: 1}}}, Options{})
		var input *FormInputError
		if !errors.As(err, &input) || input.Message != "Text must be Unicode scalar values: data.rows.1" {
			t.Errorf("%s in a data member name: %v", name, err)
		}
		_, err = Validate(spec("A"), map[string]any{}, Options{Basepath: bytes})
		if !errors.As(err, &input) || input.Message != "Text must be Unicode scalar values: options.basepath" {
			t.Errorf("%s in the base path: %v", name, err)
		}
		// A raw byte inside a JSON string is kept, not replaced.
		_, err = ValidateJSON([]byte(`{"type":"group","properties":{}}`), []byte(`{"name":"`+bytes+`"}`), nil, "")
		if !errors.As(err, &input) || input.Message != "Text must be Unicode scalar values: data.name" {
			t.Errorf("%s in JSON data: %v", name, err)
		}
		_, err = ValidateListJSON([]byte(`{"columns":{}}`), map[string][]byte{"x" + bytes: []byte(`{}`)}, "")
		if !errors.As(err, &load) || load.Code != compose.InvalidText || len(load.Trace) != 0 {
			t.Errorf("%s in a file name: %v", name, err)
		}
	}
}

func TestDecodeOrderedKeepsText(t *testing.T) {
	for input, want := range map[string]string{
		`"😀"`:                  "\U0001F600",
		`"\ud800"`:             "\xed\xa0\x80",
		`"\udc00\ud800"`:       "\xed\xb0\x80\xed\xa0\x80",
		`"\ud800A"`:            "\xed\xa0\x80A",
		`"a\"\\\/\b\f\n\r\tz"`: "a\"\\/\b\f\n\r\tz",
		`"é中"`:                 "é中",
		"\"\xff\"":             "\xff",
	} {
		got, err := compose.DecodeOrdered([]byte(input))
		if err != nil || got != want {
			t.Errorf("%s: got %q, %v", input, got, err)
		}
	}
	for _, input := range []string{`1e400`, `{"a":1,}`, `"\ud80"`, `[1] 2`} {
		if _, err := compose.DecodeOrdered([]byte(input)); err == nil {
			t.Errorf("accepted %s", input)
		}
	}
	got, err := compose.DecodeOrdered([]byte(` {"b" : [1, -2.5e1, true, false, null, {}], "a":"x", "b":0} `))
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"b":0,"a":"x"}` {
		t.Errorf("got %s", encoded)
	}
	members, err := compose.DecodeRawMembers([]byte(`{"\ud800" : [1, "\udc00"] , "b":{"c":2}}`))
	if err != nil || len(members) != 2 || members[0].Name != "\xed\xa0\x80" || string(members[0].Value) != `[1, "\udc00"]` || string(members[1].Value) != `{"c":2}` {
		t.Errorf("raw members: %#v, %v", members, err)
	}
	if _, err := compose.DecodeRawMembers([]byte(`[]`)); err == nil {
		t.Error("accepted an array as members")
	}
}

// graphCase is one case of legacy/tests/fixtures/text-validity/value-graphs.json.
type graphCase struct {
	Name  string          `json:"name"`
	Spec  json.RawMessage `json:"spec"`
	Files json.RawMessage `json:"files"`
	Data  json.RawMessage `json:"data"`
	Graph json.RawMessage `json:"graph"`
	Want  json.RawMessage `json:"expect"`
}

// buildGraph builds the value graph of a case with shared slices and maps.
func buildGraph(t *testing.T, raw json.RawMessage) ([]string, any) {
	t.Helper()
	decoded, err := compose.DecodeOrdered(raw)
	if err != nil {
		t.Fatal(err)
	}
	graph, ok := decoded.(*compose.OMap)
	if !ok {
		t.Fatalf("value graph decoded as %T, want an object", decoded)
	}
	at, _ := graph.Get("at")
	segments, ok := at.([]any)
	if !ok {
		t.Fatalf("value graph path decoded as %T, want an array", at)
	}
	var path []string
	for _, segment := range segments {
		name, ok := segment.(string)
		if !ok {
			t.Fatalf("value graph path segment decoded as %T, want a string", segment)
		}
		path = append(path, name)
	}
	shape, _ := graph.Get("shape")
	if shape == "self-twice" {
		loop := map[string]any{}
		loop["self"] = loop
		loop["again"] = loop
		return path, loop
	}
	sizeValue, _ := graph.Get("size")
	sizeNumber, ok := sizeValue.(float64)
	if !ok {
		t.Fatalf("value graph size decoded as %T, want a number", sizeValue)
	}
	size := int(sizeNumber)
	leaf, _ := graph.Get("leaf")
	if shape == "flat" {
		items := make([]any, size)
		for i := range items {
			items[i] = leaf
		}
		return path, items
	}
	value := leaf
	for i := 0; i < size; i++ {
		if shape == "doubled" {
			value = []any{value, value}
		} else {
			value = []any{value}
		}
	}
	return path, value
}

// TestValueGraphsMatchFixture runs the value limit cases, whose values share
// slices and maps or contain themselves, as Go values can.
func TestValueGraphsMatchFixture(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "..", "tests", "fixtures", "text-validity", "value-graphs.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []graphCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) == 0 {
		t.Fatal("fixture is empty")
	}
	for _, c := range cases {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			decode := func(raw json.RawMessage) *compose.OMap {
				value, err := compose.DecodeOrdered(raw)
				if err != nil {
					t.Fatal(err)
				}
				object, ok := value.(*compose.OMap)
				if !ok {
					t.Fatalf("fixture value decoded as %T, want an object", value)
				}
				return object
			}
			spec := decode(c.Spec)
			opts := Options{Files: FileSet{}}
			if c.Files != nil {
				files := decode(c.Files)
				for _, name := range files.Keys() {
					file, _ := files.Get(name)
					fileMap, ok := file.(*compose.OMap)
					if !ok {
						t.Fatalf("fixture file %s decoded as %T, want an object", name, file)
					}
					opts.Files[name] = fileMap
				}
			}
			plainData := plainValue(decode(c.Data))
			data, ok := plainData.(map[string]any)
			if !ok {
				t.Fatalf("fixture data decoded as %T, want an object", plainData)
			}
			path, graph := buildGraph(t, c.Graph)
			member := path[len(path)-1]
			switch path[0] {
			case "spec":
				spec.Set(member, graph)
			case "files":
				opts.Files[path[1]].Set(member, graph)
			default:
				data[member] = graph
			}
			// Each case is one test within the runner's per-test limit, which a walk that grows
			// with the tree a value denotes (2^40 nodes) never meets.
			result, validateErr := Validate(spec, data, opts)
			checkOutcome(t, c.Name, textOutcome(t, result, validateErr), c.Want)
		})
	}
}
