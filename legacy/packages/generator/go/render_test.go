package generator

import (
	"reflect"
	"strings"
	"testing"
)

func TestScriptControlsUseTheRenderedID(t *testing.T) {
	for _, typ := range []string{"tinymce", "summernote", "editorjs", "tui", "tagify", "tagify2", "search"} {
		t.Run(typ, func(t *testing.T) {
			template, e := CompileForm(NewObject("type", "group", "properties", NewObject("editor field", NewObject("type", typ, "options", NewObject("callback", "onSelected", "fileserver", "</script>\"&>", "upload", "</script>\"&>")))), CompileOptions{})
			if e != nil {
				t.Fatal(e)
			}
			fields, e := BindForm(template, NewObject(), BindOptions{IDPrefix: "custom scope"})
			if e != nil {
				t.Fatal(e)
			}
			widget := read(fields[0], "widget")
			id := stringAt(read(widget, "attrs"), "id")
			script := stringAt(widget, "script")
			if id == "" || !strings.Contains(script, scriptString(id)) {
				t.Fatalf("Rendered ID %q not present in script %q", id, script)
			}
			if strings.Contains(script, "</script>") {
				t.Fatal("A string value can close the script element")
			}
			if typ != "search" && !strings.Contains(script, "CSS.escape(") {
				t.Fatal("Control selector is not escaped")
			}
		})
	}
}
func TestEveryRepeatedControlUsesStructuralRulePaths(t *testing.T) {
	for _, typ := range []string{"choice", "multichoice", "image", "file", "cover", "search"} {
		t.Run(typ, func(t *testing.T) {
			template, e := CompileForm(NewObject("type", "group", "properties", NewObject("groups", NewObject("type", "group", "multiple", true, "properties", NewObject("field", NewObject("type", typ, "items", NewObject("a", "A")))))), CompileOptions{})
			if e != nil {
				t.Fatal(e)
			}
			data := NewObject("groups", NewObject("arbitrary_key", NewObject("field", "a")))
			fields, e := BindForm(template, data, BindOptions{})
			if e != nil {
				t.Fatal(e)
			}
			child := objectList(read(objectList(read(fields[0], "children"))[0], "children"))[0]
			w := read(child, "widget")
			attrs := object(read(w, "attrs"))
			switch typ {
			case "choice", "multichoice":
				attrs = object(read(read(w, "extra"), "input"))
			case "image", "file", "cover":
				attrs = object(read(read(w, "extra"), "file"))
			}
			if stringAt(attrs, "data-rule-name") != "groups[][field]" {
				t.Fatal(encode(t, attrs))
			}
			if stringAt(attrs, "data-name") != "field" {
				t.Fatal(encode(t, attrs))
			}
		})
	}
}
func TestListColumnAndOptionOrder(t *testing.T) {
	spec := parseObject(t, `{"columns":{"z":{"field":"last","label":"Last","sortable":true},"a":{"field":"first","format":{"type":"link","href":"/users/{=id}","text":"Open"}},"hidden":{"field":"password","design":{"show":false}}},"sort":{"field":"last","dir":"desc"},"pagination":{"per_page":20,"mode":"offset"}}`)
	rows := []*Object{NewObject("id", 7, "last", "Zulu", "first", "Alpha")}
	vm, e := BuildList(spec, rows, ListOptions{Page: 2, Total: 41})
	if e != nil {
		t.Fatal(e)
	}
	cols := objectList(read(vm, "columns"))
	if len(cols) != 2 || stringAt(cols[0], "key") != "z" || stringAt(cols[1], "key") != "a" {
		t.Fatal(encode(t, vm))
	}
	html, e := RenderList(spec, rows, ListOptions{Page: 2, Total: 41})
	if e != nil {
		t.Fatal(e)
	}
	for _, want := range []string{`data-sort-dir="desc"`, `href="/users/7"`, `data-page="2"`, `data-total="41"`} {
		if !strings.Contains(html, want) {
			t.Fatalf("Missing %s in %s", want, html)
		}
	}
	if strings.Contains(html, "password") {
		t.Fatal("Hidden column rendered")
	}
	card, e := RenderList(spec, rows, ListOptions{Layout: "card"})
	if e != nil || !strings.Contains(card, `class="crudui-list__card"`) || strings.Contains(card, "<table") {
		t.Fatal(card, e)
	}
}
func TestOrderedJSONPreservesEmptyValueTypes(t *testing.T) {
	data := parseObject(t, `{"z":{},"a":[],"n":null,"o":{"third":3,"first":1}}`)
	if !reflect.DeepEqual(data.Keys(), []string{"z", "a", "n", "o"}) {
		t.Fatal(data.Keys())
	}
	if object(read(data, "z")) == nil {
		t.Fatal("Empty object changed type")
	}
	if _, ok := read(data, "a").([]any); !ok {
		t.Fatal("Empty array changed type")
	}
	if read(data, "n") != nil {
		t.Fatal("Null changed type")
	}
	if encode(t, data) != `{"z":{},"a":[],"n":null,"o":{"third":3,"first":1}}` {
		t.Fatal(encode(t, data))
	}
	if _, e := DecodeJSON([]byte(`{} {}`)); e == nil {
		t.Fatal("Multiple JSON values accepted")
	}
}
func TestRejectUnorderedAndRecursiveValues(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"name":{"type":"text"}}}`)
	unordered := NewObject("name", map[string]any{"a": 1})
	if _, e := NewForm(template, unordered, BindOptions{}); e == nil {
		t.Fatal("Unordered object accepted")
	}
	cycle := NewObject()
	cycle.Set("self", cycle)
	if _, e := NewForm(template, cycle, BindOptions{}); e == nil {
		t.Fatal("Recursive object accepted")
	}
	f := newForm(t, template, NewObject("name", "before"))
	if e := f.SetValue("name", cycle); e == nil {
		t.Fatal("Recursive replacement accepted")
	}
	if stringAt(f.GetData(), "name") != "before" {
		t.Fatal("Failed replacement changed state")
	}
}
func TestListFormattingEscapesValuesAndPreservesDeclaredHTML(t *testing.T) {
	spec := parseObject(t, `{"columns":{"text":{"field":"text"},"number":{"field":"number","format":{"type":"number","decimals":2,"thousands":true,"prefix":"$"}},"bool":{"field":"enabled","format":{"type":"bool","as":"check"}},"html":{"field":"html","format":"html"}}}`)
	html, e := RenderList(spec, []*Object{NewObject("text", "<x & y>", "number", 1234.5, "enabled", "false", "html", "<b>allowed</b>")}, ListOptions{})
	if e != nil {
		t.Fatal(e)
	}
	for _, want := range []string{"&lt;x &amp; y&gt;", "$1,234.50", "✘", "<b>allowed</b>"} {
		if !strings.Contains(html, want) {
			t.Fatal(want, html)
		}
	}
}

func TestListImageResourcesPreserveFirstUseOrder(t *testing.T) {
	spec := parseObject(t, `{"columns":{"image":{"field":"image","format":"image"},"html":{"field":"html","format":"html"}}}`)
	rows := []*Object{NewObject("image", "/b.png", "html", `<img src="/raw.png">`), NewObject("image", "/a.png"), NewObject("image", "/b.png"), NewObject("image", "data:image/png;base64,AA==")}
	html, e := RenderList(spec, rows, ListOptions{})
	if e != nil {
		t.Fatal(e)
	}
	prefix := `<link rel="preload" as="image" href="/b.png"/><link rel="preload" as="image" href="/a.png"/>`
	if !strings.HasPrefix(html, prefix) || strings.Count(html, `rel="preload"`) != 2 {
		t.Fatal(html)
	}
	if !strings.Contains(html, `<img src="/raw.png">`) {
		t.Fatal("Declared raw image content changed")
	}
}

func TestOrdinaryURLAttributesRejectJavascriptProtocols(t *testing.T) {
	for _, value := range []string{"javascript:alert(1)", " \x00JaVaScRiPt:alert(1)", "j\na\tv\rascript:alert(1)"} {
		rendered := attrs(NewObject("href", value), false, false)
		if strings.Contains(rendered, "alert(1)") || !strings.Contains(rendered, "blocked a javascript:") {
			t.Fatal(rendered)
		}
	}
	for _, value := range []string{"/javascript:filename", "https://example.test/javascript:", "data:image/png;base64,AA=="} {
		if sanitizeURL(value) != value {
			t.Fatal("Valid URL changed", value)
		}
	}
}

func TestConditionEditorUsesRawHTML(t *testing.T) {
	spec := parseObject(t, `{"type":"group","properties":{"pass":{"type":"condition","validate":{"conditionTree":true},"design":{"editor":"structured"}}}}`)
	template, err := CompileForm(spec, CompileOptions{})
	if err != nil {
		t.Fatal(err)
	}
	data := parseObject(t, `{"pass":{"field":"a'b","op":"eq","value":"\"<&>'"}}`)
	form, err := NewForm(template, data, BindOptions{IDPrefix: "a'b", Language: "en"})
	if err != nil {
		t.Fatal(err)
	}
	html := renderHTML(t, form)
	for _, want := range []string{
		`data-condition-for="a'b:pass"`,
		`>{"field":"a'b","op":"eq","value":"\"&lt;&amp;&gt;'"}</textarea>`,
		`<input class="crudui-condition__field" data-condition-part="field" value="a'b">`,
		`<input class="crudui-condition__value" data-condition-part="value" value="&quot;&lt;&amp;>'">`,
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("condition editor lacks raw markup %q in %s", want, html)
		}
	}
}
