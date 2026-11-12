package generator

import (
	"encoding/json"
	"strings"
	"testing"
)

func decodeObject(t *testing.T, input string) *Object {
	t.Helper()
	v, err := DecodeJSON([]byte(input))
	if err != nil {
		t.Fatal(err)
	}
	o, ok := v.(*Object)
	if !ok {
		t.Fatalf("decoded %T, want *Object", v)
	}
	return o
}

// inOrder reports whether each marker occurs in s after the previous one.
func inOrder(s string, markers ...string) bool {
	at := 0
	for _, m := range markers {
		i := strings.Index(s[at:], m)
		if i < 0 {
			return false
		}
		at += i + len(m)
	}
	return true
}

func fieldNames(fields []FieldTemplate) string {
	names := []string{}
	for _, f := range fields {
		names = append(names, f.Name)
	}
	return strings.Join(names, ",")
}

func TestCompileFormUsesMemberOrder(t *testing.T) {
	spec := decodeObject(t, `{"type":"group","properties":{"b":{"type":"select","items":{"y":"Y","5":"Five"}},"10":{"type":"text"},"a":{"type":"text"}}}`)
	template, err := CompileForm(spec, CompileOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if got := fieldNames(template.Fields); got != "10,b,a" {
		t.Fatalf("got %s, want 10,b,a", got)
	}
	got, err := json.Marshal(read(template.Fields[1].Spec, "items"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != `{"5":"Five","y":"Y"}` {
		t.Fatalf("items %s", got)
	}
	properties := object(read(spec, "properties"))
	if properties == nil {
		t.Fatal("the specification lost its properties")
	}
	if keys := properties.Keys(); strings.Join(keys, ",") != "b,10,a" {
		t.Fatalf("the specification was modified: %v", keys)
	}
}

func TestCompileFormOrdersFilesAndComposition(t *testing.T) {
	files := map[string]*Object{"base.yml": decodeObject(t, `{"properties":{"b":{"type":"text"},"a":{"type":"text"}}}`)}
	spec := decodeObject(t, `{"type":"group","properties":{"$ref":"base.yml","$patch":{"10":{"type":"text"}}}}`)
	template, err := CompileForm(spec, CompileOptions{Files: files})
	if err != nil {
		t.Fatal(err)
	}
	if got := fieldNames(template.Fields); got != "10,b,a" {
		t.Fatalf("got %s, want 10,b,a", got)
	}
}

func TestCompileFormReportsUnknownKeyInMemberOrder(t *testing.T) {
	spec := decodeObject(t, `{"type":"group","properties":{"rows":{"type":"text","multiple":{"z":1,"5":1}}}}`)
	_, err := CompileForm(spec, CompileOptions{})
	if err == nil || err.Error() != "Invalid multiple.5 at rows: unknown key" {
		t.Fatalf("got %v", err)
	}
}

func TestTemplateDecodingUsesMemberOrder(t *testing.T) {
	var template FormTemplate
	input := `{"kind":"crudui/form-template","fields":[{"name":"b","spec":{"type":"select","items":{"y":"Y","5":"Five"}},"children":[]}],"buttons":[{"type":"submit","design":{"z":1,"0":2}}]}`
	if err := json.Unmarshal([]byte(input), &template); err != nil {
		t.Fatal(err)
	}
	got, err := json.Marshal(template)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"kind":"crudui/form-template","fields":[{"name":"b","spec":{"type":"select","items":{"5":"Five","y":"Y"}},"children":[]}],"buttons":[{"type":"submit","design":{"0":2,"z":1}}]}`
	if string(got) != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestFormDataKeepsInsertionOrder(t *testing.T) {
	template, err := CompileForm(decodeObject(t, `{"type":"group","properties":{"b":{"type":"text"},"10":{"type":"text"}}}`), CompileOptions{})
	if err != nil {
		t.Fatal(err)
	}
	form, err := NewForm(template, decodeObject(t, `{"b":"x","10":"y","extra":{"z":1,"3":2}}`), BindOptions{})
	if err != nil {
		t.Fatal(err)
	}
	got, err := json.Marshal(form.GetData())
	if err != nil {
		t.Fatal(err)
	}
	if !inOrder(string(got), `"b":"x"`, `"10":"y"`, `"z":1`, `"3":2`) {
		t.Fatalf("data reordered: %s", got)
	}
}

func TestListAndDetailUseMemberOrder(t *testing.T) {
	columns := `{"b":{"field":"b","label":"B"},"10":{"field":"ten","label":"Ten"},"a":{"field":"a","label":"A"}}`
	record := `{"a":"x","b":"y","ten":"z"}`
	html, err := RenderList(decodeObject(t, `{"columns":`+columns+`}`), []*Object{decodeObject(t, record)}, ListOptions{Language: "en"})
	if err != nil {
		t.Fatal(err)
	}
	if !inOrder(html, ">Ten<", ">B<", ">A<", ">z<", ">y<", ">x<") {
		t.Fatalf("list order: %s", html)
	}
	html, err = RenderDetail(decodeObject(t, `{"fields":`+columns+`}`), decodeObject(t, record), DetailOptions{Language: "en"})
	if err != nil {
		t.Fatal(err)
	}
	if !inOrder(html, ">Ten<", ">z<", ">B<", ">y<", ">A<", ">x<") {
		t.Fatalf("detail order: %s", html)
	}
}
