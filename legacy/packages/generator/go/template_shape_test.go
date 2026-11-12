package generator

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// The compiled cases of legacy/tests/fixtures/template-shape also test CURP-019 and CURP-024 (a serialized compiled template is bound). A template is decoded from its JSON text first, which refuses a
// shape that is not the compiled one; the operation of the case then runs on the decoded template.
func TestTemplateShapeCases(t *testing.T) {
	const want = 44
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "tests", "fixtures", "template-shape", "cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		t.Fatal(err)
	}
	if len(items) != want {
		t.Fatalf("the fixture holds %d cases, want %d", len(items), want)
	}
	for _, item := range items {
		var name string
		if err := json.Unmarshal(item["name"], &name); err != nil {
			t.Fatal(err)
		}
		t.Run(name, func(t *testing.T) {
			var operation string
			if err := json.Unmarshal(item["operation"], &operation); err != nil {
				t.Fatal(err)
			}
			feature := operation
			if operation == "createRecords" {
				feature = "createForm"
			}
			recordFixtureConformance(t, feature, "template-shape", name)
			if operation == "createRecords" {
				checkRecordCase(t, item)
				return
			}
			got, err := json.Marshal(outcomeOf(t, runTemplateShapeCase(t, item)))
			if err != nil {
				t.Fatal(err)
			}
			expect, err := DecodeJSON(item["expect"])
			if err != nil {
				t.Fatal(err)
			}
			want, err := json.Marshal(expect)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != string(want) {
				t.Errorf("got %s\nwant %s", got, want)
			}
		})
	}
}

// runTemplateShapeCase decodes the template of a case and runs its operation with the case data and default options.
func runTemplateShapeCase(t *testing.T, item map[string]json.RawMessage) error {
	t.Helper()
	var operation string
	if err := json.Unmarshal(item["operation"], &operation); err != nil {
		t.Fatal(err)
	}
	var template FormTemplate
	if err := json.Unmarshal(item["template"], &template); err != nil {
		return err
	}
	value, err := DecodeJSON(item["data"])
	if err != nil {
		t.Fatal(err)
	}
	data, ok := value.(*Object)
	if !ok {
		t.Fatalf("the data of the case is %T, not an object", value)
	}
	switch operation {
	case "bindForm":
		_, err = BindForm(&template, data, BindOptions{})
	case "bindButtons":
		_, err = BindButtons(&template, data, BindOptions{})
	case "createForm":
		_, err = NewForm(&template, data, BindOptions{})
	default:
		t.Fatalf("unknown template operation %s", operation)
	}
	return err
}

// Widget model members follow one output order.
func TestWidgetMemberOrder(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"memo":{"type":"textarea","prepend":"P"},"note":{"type":"dummy"},"go":{"type":"button"},"pick":{"type":"choice","options":{"a":"A"}}}}`)
	nodes, e := BindForm(template, NewObject(), BindOptions{})
	if e != nil {
		t.Fatal(e)
	}
	position := map[string]int{}
	for index, key := range widgetMembers {
		position[key] = index
	}
	for _, node := range nodes {
		keys := object(read(node, "widget")).Keys()
		for index := 1; index < len(keys); index++ {
			if position[keys[index-1]] >= position[keys[index]] {
				t.Fatalf("widget members out of order: %v", keys)
			}
		}
	}
}

// checkRecordCase binds each record of a case from the serialized template alone and reads its paths (CURT-050): the
// result of each binding is the values of its own record, whichever records were bound before it.
func checkRecordCase(t *testing.T, item map[string]json.RawMessage) {
	t.Helper()
	var template FormTemplate
	if err := json.Unmarshal(item["template"], &template); err != nil {
		t.Fatal(err)
	}
	var paths [][]string
	if err := json.Unmarshal(item["paths"], &paths); err != nil {
		t.Fatal(err)
	}
	var records []json.RawMessage
	if err := json.Unmarshal(item["data"], &records); err != nil {
		t.Fatal(err)
	}
	results := make([]any, 0, len(records))
	for index, raw := range records {
		value, err := DecodeJSON(raw)
		if err != nil {
			t.Fatal(err)
		}
		data, ok := value.(*Object)
		if !ok {
			t.Fatalf("record %d is %T, not an object", index, value)
		}
		form, err := NewForm(&template, data, BindOptions{})
		if err != nil {
			t.Fatal(err)
		}
		read := map[string]any{}
		for _, path := range paths[index] {
			v, err := form.GetValue(path)
			if err != nil {
				t.Fatal(err)
			}
			read[path] = v
		}
		results = append(results, read)
	}
	encoded, err := json.Marshal(map[string]any{"results": results})
	if err != nil {
		t.Fatal(err)
	}
	var got, want any
	if err := json.Unmarshal(encoded, &got); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(item["expect"], &want); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %#v, want %#v", got, want)
	}
}
