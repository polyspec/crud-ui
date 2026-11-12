package generator

import (
	"encoding/json"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

func parseObject(t *testing.T, source string) *Object {
	t.Helper()
	v, e := DecodeJSON([]byte(source))
	if e != nil {
		t.Fatal(e)
	}
	o := object(v)
	if o == nil {
		t.Fatal("Expected object")
	}
	return o
}
func compile(t *testing.T, source string) *FormTemplate {
	t.Helper()
	v, e := CompileForm(parseObject(t, source), CompileOptions{KeyPrefix: "form"})
	if e != nil {
		t.Fatal(e)
	}
	return v
}
func encode(t *testing.T, v any) string {
	t.Helper()
	b, e := json.Marshal(v)
	if e != nil {
		t.Fatal(e)
	}
	return string(b)
}

// renderHTML renders a form with no render options and fails the test on an error.
func renderHTML(t *testing.T, f *Form) string {
	t.Helper()
	html, e := RenderForm(f, nil)
	if e != nil {
		t.Fatal(e)
	}
	return html
}
func newForm(t *testing.T, template *FormTemplate, data *Object) *Form {
	t.Helper()
	f, e := NewForm(template, data, BindOptions{Language: "en"})
	if e != nil {
		t.Fatal(e)
	}
	return f
}

const companySpec = `{"type":"group","properties":{"companies":{"type":"group","multiple":{"copy":true,"sortable":true},"properties":{"name":{"type":"text","default":"New company"},"stores":{"type":"group","multiple":true,"properties":{"name":{"type":"text","default":"New store"},"active":{"type":"checkbox"}}}}}}}`

func companyData(t *testing.T) *Object {
	return parseObject(t, `{"companies":{"__0000000000005__":{"name":"Five","stores":{"__0000000000005__":{"name":"Store five","active":true}}},"__0000000000007__":{"name":"Seven","stores":{}},"__0000000000001__":{"name":"One","stores":{}}}}`)
}
func TestTemplateCacheAndDataReplacement(t *testing.T) {
	template := compile(t, companySpec)
	before := encode(t, template)
	var restored FormTemplate
	if e := json.Unmarshal([]byte(before), &restored); e != nil {
		t.Fatal(e)
	}
	data := companyData(t)
	initial := newForm(t, template, data)
	injected := newForm(t, &restored, NewObject("companies", NewObject()))
	if e := injected.SetData(data); e != nil {
		t.Fatal(e)
	}
	a := renderHTML(t, initial)
	b := renderHTML(t, injected)
	if a != b {
		t.Fatal("Initial data and later injection must produce identical raw HTML")
	}
	if encode(t, initial.GetData()) != encode(t, injected.GetData()) {
		t.Fatal("Submission data differs")
	}
	if e := injected.SetData(data); e != nil {
		t.Fatal(e)
	}
	again := renderHTML(t, injected)
	if a != again {
		t.Fatal("Repeated injection changed HTML")
	}
	if e := injected.SetData(NewObject("companies", NewObject())); e != nil {
		t.Fatal(e)
	}
	if e := injected.SetData(data); e != nil {
		t.Fatal(e)
	}
	again = renderHTML(t, injected)
	if a != again {
		t.Fatal("Restoring record changed HTML")
	}
	if before != encode(t, template) {
		t.Fatal("Template changed")
	}
}
func TestScopedRowsAndDocumentOrder(t *testing.T) {
	f := newForm(t, compile(t, companySpec), companyData(t))
	rows := object(read(f.GetData(), "companies"))
	if !reflect.DeepEqual(rows.Keys(), []string{"__0000000000005__", "__0000000000007__", "__0000000000001__"}) {
		t.Fatal(rows.Keys())
	}
	p := "companies.__0000000000005__.stores"
	k, e := f.AddRow(p, AddRowOptions{Key: "__abc0123456789__", AfterKey: "__0000000000005__", Value: NewObject("name", "Added")})
	if e != nil {
		t.Fatal(e)
	}
	if k != "__abc0123456789__" {
		t.Fatal(k)
	}
	data := f.GetData()
	if !reflect.DeepEqual(object(read(data, "companies")).Keys(), rows.Keys()) {
		t.Fatal("Nested addition changed company order")
	}
	if e = f.RekeyRow(p, k, "__0000000000042__"); e != nil {
		t.Fatal(e)
	}
	html := renderHTML(t, f)
	if !strings.Contains(html, `name="form[companies][__0000000000005__][stores][__0000000000042__][name]"`) {
		t.Fatal("Rekey did not update descendant input names")
	}
	if !strings.Contains(html, `data-rule-name="companies[][stores][][name]"`) {
		t.Fatal("Rule path depends on row encoding")
	}
	if e = f.MoveRow("companies", "__0000000000001__", 0); e != nil {
		t.Fatal(e)
	}
	if object(read(f.GetData(), "companies")).Keys()[0] != "__0000000000001__" {
		t.Fatal("Move did not preserve requested order")
	}
}
func TestNestedCopyRegeneratesIdentities(t *testing.T) {
	f := newForm(t, compile(t, companySpec), companyData(t))
	key, e := f.CopyRow("companies", "__0000000000005__", AddRowOptions{Key: "__copy00000000__"})
	if e != nil {
		t.Fatal(e)
	}
	data := f.GetData()
	copied := read(read(data, "companies"), key)
	stores := object(read(copied, "stores"))
	if stores.Len() != 1 {
		t.Fatal("Copy lost nested rows")
	}
	newKey := stores.Keys()[0]
	if newKey == "__0000000000005__" || !regexp.MustCompile(`^__[a-f0-9]{13}__$`).MatchString(newKey) {
		t.Fatal(newKey)
	}
	if stringAt(read(stores, newKey), "name") != "Store five" {
		t.Fatal("Copy lost current values")
	}
	if original := object(getPath(data, "companies.__0000000000005__.stores")); !original.Has("__0000000000005__") {
		t.Fatal("Copy modified original row")
	}
}
func TestRejectedOperationsAreAtomic(t *testing.T) {
	f := newForm(t, compile(t, companySpec), companyData(t))
	before, fields, rev := encode(t, f.GetData()), encode(t, f.Fields()), f.Revision()
	operations := []func() error{func() error { _, e := f.AddRow("companies", AddRowOptions{Key: "__0000000000005__"}); return e }, func() error { _, e := f.AddRow("companies", AddRowOptions{Key: "5"}); return e }, func() error { _, e := f.AddRow("companies", AddRowOptions{Key: "new", AfterKey: "missing"}); return e }, func() error { return f.RemoveRow("companies", "missing") }, func() error { return f.MoveRow("companies", "__0000000000005__", 9) }, func() error { return f.RekeyRow("companies", "__0000000000005__", "__0000000000007__") }, func() error { return f.SetValue("companies", []any{}) }, func() error { return f.SetValue("__proto__.companies", NewObject()) }, func() error { _, e := f.AddRow("companies", AddRowOptions{ValueProvided: true, Value: nil}); return e }}
	for i, op := range operations {
		if e := op(); e == nil {
			t.Errorf("Operation %d unexpectedly succeeded", i)
		}
		if before != encode(t, f.GetData()) || fields != encode(t, f.Fields()) || rev != f.Revision() {
			t.Fatalf("Operation %d changed state after failure", i)
		}
	}
}
func TestEmptyMissingNullAndArrayValues(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"tags":{"type":"text","multiple":true,"default":"new"}}}`)
	empty := newForm(t, template, NewObject("tags", NewObject()))
	html := renderHTML(t, empty)
	if !strings.Contains(html, `<div class="crudui-node__footer"><div class="crudui-controls" role="group" aria-label="Collection controls"><button type="button" class="crudui-action" data-crudui-action="add-row" aria-label="Add"></button></div></div>`) || strings.Contains(html, `name="form[tags]`) {
		t.Fatal("Empty collection must retain only its add control")
	}
	missing := newForm(t, template, nil)
	if object(read(missing.GetData(), "tags")).Len() != 1 {
		t.Fatal("Missing collection must create one row")
	}
	if _, e := NewForm(template, NewObject("tags", nil), BindOptions{}); e == nil {
		t.Fatal("Null collection accepted")
	}
	if _, e := NewForm(template, NewObject("tags", []any{}), BindOptions{}); e == nil {
		t.Fatal("Array collection accepted")
	}
	if _, e := empty.AddRow("tags", AddRowOptions{Key: "null_row", ValueProvided: true, Value: nil}); e != nil {
		t.Fatal(e)
	}
	if v := getPath(empty.GetData(), "tags.null_row"); v != nil {
		t.Fatalf("Explicit null changed: %#v", v)
	}
	if e := empty.RemoveRow("tags", "null_row"); e != nil {
		t.Fatal(e)
	}
	if _, e := empty.AddRow("tags", AddRowOptions{Key: "new_row"}); e != nil {
		t.Fatal(e)
	}
	if v := getPath(empty.GetData(), "tags.new_row"); v != "new" {
		t.Fatal(v)
	}
}
func TestDetachedDataAndFields(t *testing.T) {
	f := newForm(t, compile(t, companySpec), companyData(t))
	before := encode(t, f.GetData())
	d := f.GetData()
	object(read(d, "companies")).Delete("__0000000000005__")
	if encode(t, f.GetData()) != before {
		t.Fatal("GetData exposes instance values")
	}
	fields := f.Fields()
	row := objectList(read(fields[0], "children"))[0]
	child := objectList(read(row, "children"))[0]
	child.Set("path", "modified")
	if strings.Contains(encode(t, f.Fields()), "modified") {
		t.Fatal("Fields exposes nested model state")
	}
	template, e := f.Template()
	if e != nil {
		t.Fatal(e)
	}
	template.Fields[0].Spec.Set("type", "text")
	if stringAt(f.template.Fields[0].Spec, "type") != "group" {
		t.Fatal("Template exposes instance structure")
	}
}
func TestSequencesAndRandomKeys(t *testing.T) {
	for _, v := range []any{0, 42, "42", "0000000000042", uint64(9999999999999)} {
		k, e := SequenceRowKey(v)
		if e != nil || len(k) != 17 {
			t.Fatalf("%v: %s %v", v, k, e)
		}
	}
	for _, v := range []any{true, -1, 1.5, "", "1e2", "10000000000000", nil} {
		if _, e := SequenceRowKey(v); e == nil {
			t.Errorf("Invalid sequence accepted: %#v", v)
		}
	}
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		k, e := CreateRowKey()
		if e != nil {
			t.Fatal(e)
		}
		if seen[k] || !regexp.MustCompile(`^__[a-f0-9]{13}__$`).MatchString(k) {
			t.Fatal(k)
		}
		seen[k] = true
	}
}
func TestMinimumAndMaximum(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"tags":{"type":"text","multiple":{"min":1,"max":2}}}}`)
	f := newForm(t, template, NewObject("tags", NewObject("one", "a")))
	if e := f.RemoveRow("tags", "one"); e == nil {
		t.Fatal("Minimum count ignored")
	}
	if _, e := f.AddRow("tags", AddRowOptions{Key: "two"}); e != nil {
		t.Fatal(e)
	}
	before := encode(t, f.GetData())
	if _, e := f.AddRow("tags", AddRowOptions{Key: "three"}); e == nil {
		t.Fatal("Maximum count ignored")
	}
	if encode(t, f.GetData()) != before {
		t.Fatal("Failed maximum check modified data")
	}
}
func TestNativeBindingLabelsAndSelections(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"active":{"type":"checkbox","label":"Active"},"memo":{"type":"textarea","label":"Memo","design":{"show":".active","wrapper":{"class":".active ? 'enabled' : 'disabled'"}}},"choices":{"type":"multichoice","label":"Choices","items":{"z":"Z","a":"A","q":"Q"}}}}`)
	data := NewObject("active", true, "memo", "hello <world>", "choices", []any{"q", "z"})
	f := newForm(t, template, data)
	html := renderHTML(t, f)
	if !strings.Contains(html, `for="crudui:memo"`) || !strings.Contains(html, `name="form[choices][]"`) || strings.Count(html, `checked=""`) != 3 {
		t.Fatal(html)
	}
	if !strings.Contains(html, `hello &lt;world&gt;`) {
		t.Fatal("Textarea not escaped")
	}
	if e := f.SetValue("active", false); e != nil {
		t.Fatal(e)
	}
	html = renderHTML(t, f)
	if !strings.Contains(html, `<div class="crudui-node crudui-node--field disabled" data-field-path="memo" hidden="">`) {
		t.Fatal("Conditional display was not reevaluated")
	}
}

func TestNodeGrammarRowsAndControls(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"items":{"type":"group","label":"Item","multiple":{"title":"name","sortable":true,"copy":true,"min":1,"max":2,"header":"sticky","controls":"footer"},"properties":{"name":{"type":"text"},"tags":{"type":"text","multiple":true}}}}}`)
	f := newForm(t, template, parseObject(t, `{"items":{"first":{"name":"","tags":{"a1":"x","a2":"y"}},"second":{"name":"Two","tags":{}}}}`))
	collection := f.Fields()[0]
	if stringAt(collection, "kind") != "collection" || stringAt(read(collection, "header"), "count") != "Rows: 2" || has(collection, "controls") {
		t.Fatal(encode(t, collection))
	}
	rows := objectList(read(collection, "children"))
	first, second := rows[0], rows[1]
	if encode(t, read(first, "header")) != `{"className":"","label":"Item","number":"1","title":"(untitled)","summary":"Nested rows: 2"}` {
		t.Fatal(encode(t, read(first, "header")))
	}
	if stringAt(read(second, "header"), "title") != "Two" || stringAt(read(second, "header"), "summary") != "Nested rows: 0" {
		t.Fatal(encode(t, read(second, "header")))
	}
	want := `{"placement":"footer","label":"Row controls","actions":[{"name":"move-up","label":"Move up","disabled":true},{"name":"move-down","label":"Move down","disabled":false},{"name":"add-row","label":"Add","disabled":true},{"name":"copy-row","label":"Copy","disabled":true},{"name":"remove-row","label":"Remove","disabled":false}]}`
	if encode(t, read(first, "controls")) != want {
		t.Fatal(encode(t, read(first, "controls")))
	}
	if read(first, "expanded") != true || read(first, "sticky") != true || read(first, "stickyDepth") != 0 {
		t.Fatal(encode(t, first))
	}
	nested := objectList(read(objectList(read(first, "children"))[1], "children"))[1]
	if stringAt(read(nested, "header"), "number") != "1.2" || stringAt(read(nested, "controls"), "placement") != "header" {
		t.Fatal(encode(t, nested))
	}
	html := renderHTML(t, f)
	for _, part := range []string{
		`<div class="crudui-form"><div class="crudui-form__body"><div class="crudui-node crudui-node--collection" data-field-path="items">`,
		`<div class="crudui-node crudui-node--row crudui-node--sticky" style="--crudui-sticky-depth:0" data-crudui-row-key="first"><div class="crudui-node__header-container"><div class="crudui-node__header"><button type="button" class="crudui-action" data-crudui-action="toggle-row" aria-expanded="true" aria-controls="crudui:items.first:body" aria-label="Expand or collapse"></button>`,
		`<span class="crudui-node__summary" hidden="">Nested rows: 2</span>`,
		`data-crudui-action="move-up" aria-label="Move up" aria-disabled="true"></button>`,
	} {
		if !strings.Contains(html, part) {
			t.Fatalf("Missing %s in %s", part, html)
		}
	}
	for _, old := range []string{"form-element", "input-group-wrapper", "data-uniqid", "btn-plus", "<h6"} {
		if strings.Contains(html, old) {
			t.Fatalf("Replaced markup %s rendered", old)
		}
	}
}

func TestInterfaceLanguagesAndRejections(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"tags":{"type":"text","multiple":true}}}`)
	for language, count := range map[string]string{"ko": "0개", "en": "Rows: 0", "ja": "0件", "zh": "0 项"} {
		fields, e := BindForm(template, parseObject(t, `{"tags":{}}`), BindOptions{Language: language})
		if e != nil || stringAt(read(fields[0], "header"), "count") != count {
			t.Fatal(language, e)
		}
	}
	if fields, e := BindForm(template, parseObject(t, `{"tags":{}}`), BindOptions{}); e != nil || stringAt(read(fields[0], "header"), "count") != "0개" {
		t.Fatal("A nil language must default to ko", e)
	}
	for language, message := range map[any]string{"fr": "Unsupported language: fr", "": "Unsupported language: ", 5: "Language must be a string", true: "Language must be a string"} {
		if _, e := BindForm(template, NewObject(), BindOptions{Language: language}); e == nil || e.Error() != message {
			t.Fatal(language, e)
		}
	}
	for _, language := range []any{[]any{"ko"}, NewObject("ko", 1)} {
		if _, e := BindForm(template, NewObject(), BindOptions{Language: language}); e == nil || e.Error() != "Language must be a string" {
			t.Fatal(language, e)
		}
	}
	for _, c := range []struct {
		options BindOptions
		message string
	}{
		{BindOptions{Language: 5, KeyPrefix: 5}, "Language must be a string"},
		{BindOptions{Language: "fr", KeyPrefix: 5}, "keyPrefix must be a string"},
		{BindOptions{KeyPrefix: 5, IDPrefix: []any{}}, "keyPrefix must be a string"},
		{BindOptions{IDPrefix: []any{}, Unsupported: true}, "idPrefix must be a string"},
		{BindOptions{Unsupported: true, Language: "fr"}, "unsupported must be throw or marker"},
		{BindOptions{Unsupported: "other", Language: "fr"}, "unsupported must be throw or marker"},
		{BindOptions{Unsupported: "", Language: "fr"}, "unsupported must be throw or marker"},
		{BindOptions{Language: "fr", IDPrefix: nil}, "Unsupported language: fr"},
	} {
		if _, e := BindForm(template, NewObject(), c.options); e == nil || e.Error() != c.message {
			t.Fatal(c.message, e)
		}
	}
	// Nil keeps a default; an empty prefix string is used as given.
	fields, e := BindForm(template, parseObject(t, `{"tags":{"a1":"x"}}`), BindOptions{IDPrefix: "", KeyPrefix: nil})
	if e != nil {
		t.Fatal(e)
	}
	attrs := read(read(objectList(read(fields[0], "children"))[0], "widget"), "attrs")
	if stringAt(attrs, "name") != "form[tags][a1]" || stringAt(attrs, "id") != ":tags.a1" {
		t.Fatal(encode(t, attrs))
	}
	unknown := compile(t, `{"type":"group","properties":{"odd":{"type":"no-such-widget"}}}`)
	if _, e := BindForm(unknown, NewObject(), BindOptions{}); e == nil {
		t.Fatal("Unsupported field type accepted by default")
	}
	if _, e := BindForm(unknown, NewObject(), BindOptions{Unsupported: "throw"}); e == nil {
		t.Fatal("Unsupported field type accepted in throw mode")
	}
	if fields, e := BindForm(unknown, NewObject(), BindOptions{Unsupported: "marker"}); e != nil || read(read(fields[0], "widget"), "unsupported") != true {
		t.Fatal("Marker mode did not mark the unsupported field", e)
	}
	// NewForm rejects wrong data before the language, like the JavaScript instance.
	if _, e := NewForm(template, NewObject("tags", []any{}), BindOptions{Language: 5}); e == nil || e.Error() != "Repeated data must be a keyed object: tags" {
		t.Fatal(e)
	}
	if _, e := NewForm(template, NewObject(), BindOptions{Language: 5}); e == nil || e.Error() != "Language must be a string" {
		t.Fatal(e)
	}
	for source, message := range map[string]string{
		`{"type":"text","multiple":{"title":"name"}}`:                                                    "Invalid multiple.title at rows: expected a repeated group",
		`{"type":"group","multiple":{"title":"missing"},"properties":{"name":{"type":"text"}}}`:          "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang",
		`{"type":"group","multiple":{"title":"name"},"properties":{"name":{"type":"text","lang":true}}}`: "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang",
		`{"type":"group","multiple":{"title":1},"properties":{"name":{"type":"text"}}}`:                  "Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang",
		`{"type":"text","multiple":{"controls":"side"}}`:                                                 "Invalid multiple.controls at rows: expected header, footer or outline",
		`{"type":"text","lang":{"only":"ko"}}`:                                                           "Invalid lang.only at rows: expected a list of language codes or an object",
		`{"type":"text","lang":{"only":null}}`:                                                           "Invalid lang.only at rows: expected a list of language codes or an object",
		`{"type":"text","lang":{"only":["ko",3]}}`:                                                       "Invalid lang.only at rows: expected a list of language codes or an object",
		`{"type":"text","lang":{"only":1},"design":[]}`:                                                  "Invalid lang.only at rows: expected a list of language codes or an object",
		`{"type":"text","lang":null}`:                                                                    "Invalid lang at rows: expected a boolean or an object",
		`{"type":"text","lang":"ko"}`:                                                                    "Invalid lang at rows: expected a boolean or an object",
		`{"type":"text","lang":["ko"]}`:                                                                  "Invalid lang at rows: expected a boolean or an object",
		`{"type":"text","multiple":"yes","lang":null}`:                                                   "Invalid multiple at rows: expected a boolean, only or an object",
		`{"type":"text","lang":1,"design":[]}`:                                                           "Invalid lang at rows: expected a boolean or an object",
		`{"type":"text","multiple":{"header":true}}`:                                                     "Invalid multiple.header at rows: expected static or sticky",
	} {
		_, e := CompileForm(parseObject(t, `{"type":"group","properties":{"rows":`+source+`}}`), CompileOptions{})
		if e == nil || e.Error() != message {
			t.Fatal(source, e)
		}
	}
}

func TestExplicitEmptyPrefixOverridesTemplatePrefix(t *testing.T) {
	template := compile(t, `{"type":"group","properties":{"name":{"type":"text"}}}`)
	fields, e := BindForm(template, NewObject("name", "Ada"), BindOptions{KeyPrefix: ""})
	if e != nil {
		t.Fatal(e)
	}
	if name := stringAt(read(read(fields[0], "widget"), "attrs"), "name"); name != "name" {
		t.Fatal(name)
	}
	empty, e := CompileForm(parseObject(t, `{"type":"group","properties":{}}`), CompileOptions{KeyPrefix: "", KeyPrefixProvided: true})
	if e != nil {
		t.Fatal(e)
	}
	if !strings.Contains(encode(t, empty), `"keyPrefix":""`) {
		t.Fatal("Explicit empty template prefix was omitted")
	}
	var restored FormTemplate
	if e = json.Unmarshal([]byte(encode(t, empty)), &restored); e != nil {
		t.Fatal(e)
	}
	if encode(t, empty) != encode(t, &restored) {
		t.Fatal("Template prefix changed after cache restoration")
	}
}

func TestClosedDeclarationBucketsRejectUnknownKeys(t *testing.T) {
	for _, c := range []struct{ source, message string }{
		{`{"type":"text","multiple":{"min":1,"foo":1,"bar":2}}`, "Invalid multiple.foo at rows: unknown key"},
		{`{"type":"text","multiple":{"min":"x","foo":1}}`, "Invalid multiple.foo at rows: unknown key"},
		{`{"type":"text","lang":{"mode":"append","append":true}}`, "Invalid lang.append at rows: unknown key"},
		{`{"type":"text","lang":{"only":"ko","extra":1}}`, "Invalid lang.extra at rows: unknown key"},
		{`{"type":"text","design":{"class":"a","label_class":"b"}}`, "Invalid design.label_class at rows: unknown key"},
		{`{"type":"text","design":{"class":1,"input":{}}}`, "Invalid design.input at rows: unknown key"},
		{`{"type":"text","design":{"label":{"class":"a","text":"b"}}}`, "Invalid design.label.text at rows: unknown key"},
		{`{"type":"text","design":{"prepend":{"style":1,"id":"x"}}}`, "Invalid design.prepend.id at rows: unknown key"},
		{`{"type":"text","design":{"wrapper":{"class":1},"group":{"id":"x"}}}`, "Invalid design.wrapper.class at rows: expected a string or a condition map"},
		{`{"type":"text","behavior":{"onchange":"f()","onsubmit":"g()"}}`, "Invalid behavior.onsubmit at rows: unknown key"},
		{`{"type":"text","multiple":{"foo":1},"lang":{"bar":1}}`, "Invalid multiple.foo at rows: unknown key"},
		{`{"type":"text","lang":{"only":1},"design":{"foo":1}}`, "Invalid lang.only at rows: expected a list of language codes or an object"},
		{`{"type":"text","design":{"foo":1},"behavior":{"bar":1}}`, "Invalid design.foo at rows: unknown key"},
	} {
		_, e := CompileForm(parseObject(t, `{"type":"group","properties":{"rows":`+c.source+`}}`), CompileOptions{})
		if e == nil || e.Error() != c.message {
			t.Fatal(c.source, e)
		}
	}
	if _, e := CompileForm(parseObject(t, `{"type":"group","properties":{"name":{"type":"text","design":{"label":{"text":"x"}}}}}`), CompileOptions{}); e == nil || e.Error() != "Invalid design.label.text at name: unknown key" {
		t.Fatal(e)
	}
	if _, e := CompileForm(parseObject(t, `{"type":"group","buttons":[{"type":"submit","behavior":{"onsubmit":"x"}}],"properties":{}}`), CompileOptions{}); e == nil || e.Error() != "Invalid behavior.onsubmit at form.buttons.0: unknown key" {
		t.Fatal(e)
	}
	// Open buckets keep unknown keys, and a behavior that is not an object is not checked here.
	compile(t, `{"type":"group","properties":{"name":{"type":"text","validate":{"custom":1},"options":{"custom":1},"behavior":"f()"}}}`)
}
