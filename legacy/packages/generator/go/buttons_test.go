package generator

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestFormButtonsDefaultDeclaredAndRejected(t *testing.T) {
	plain := compile(t, `{"type":"group","properties":{"name":{"type":"text"}}}`)
	if encode(t, plain.Buttons) != `[{"type":"submit"}]` {
		t.Fatal(encode(t, plain.Buttons))
	}
	f, e := NewForm(plain, parseObject(t, `{}`), BindOptions{Language: "en"})
	if e != nil {
		t.Fatal(e)
	}
	html := renderHTML(t, f)
	if !strings.HasSuffix(html, `</div><div class="crudui-form__footer"><div class="crudui-controls" role="group" aria-label="Form actions"><button type="submit" class="crudui-action crudui-action--text">Save</button></div></div></div>`) {
		t.Fatal(html)
	}
	declared := compile(t, `{"type":"group","action":{"method":"post","url":"/save"},"buttons":[
		{"type":"submit","name":"__submitted__","value":"go","text":{"ko":"저장하기","en":"Save now"},"design":{"class":"primary"}},
		{"type":"reset"},
		{"type":"button","text":"Cancel","behavior":{"onclick":"history.back()"}},
		{"type":"link","text":"List","href":"../?a=1&b=\"2\""}],"properties":{"name":{"type":"text"}}}`)
	if encode(t, declared.Action) != `{"method":"post","url":"/save"}` {
		t.Fatal(encode(t, declared.Action))
	}
	f, e = NewForm(declared, parseObject(t, `{}`), BindOptions{Language: "ko"})
	if e != nil {
		t.Fatal(e)
	}
	html = renderHTML(t, f)
	want := `<button type="submit" class="crudui-action crudui-action--text primary" name="__submitted__" value="go">저장하기</button><button type="reset" class="crudui-action crudui-action--text">초기화</button><button type="button" class="crudui-action crudui-action--text" onclick="history.back()">Cancel</button><a class="crudui-action crudui-action--text" href="../?a=1&amp;b=&quot;2&quot;">List</a>`
	if !strings.Contains(html, want) {
		t.Fatal(html)
	}
	for source, message := range map[string]string{
		`{"type":"group","buttons":{},"properties":{}}`:                                        "Invalid buttons at form: expected a list of buttons",
		`{"type":"group","buttons":[{"type":"image"}],"properties":{}}`:                        "Invalid buttons.0.type at form: expected submit, reset, button or link",
		`{"type":"group","buttons":[{"type":"button"}],"properties":{}}`:                       "Invalid buttons.0.text at form: expected content for this button type",
		`{"type":"group","buttons":[{"type":"link","text":"List"}],"properties":{}}`:           "Invalid buttons.0.href at form: expected a link target",
		`{"type":"group","buttons":[{"type":"submit","value":1}],"properties":{}}`:             "Invalid buttons.0.value at form: expected a string",
		`{"type":"group","action":"post","properties":{}}`:                                     "Invalid action at form: expected an object",
		`{"type":"group","properties":{"rows":{"type":"group","buttons":[],"properties":{}}}}`: "Invalid buttons at rows: expected the form root",
	} {
		if _, e := CompileForm(parseObject(t, source), CompileOptions{}); e == nil || e.Error() != message {
			t.Fatalf("%s: %v", source, e)
		}
	}
}

// buttonsSpec declares a link, a submit with name, value and a record-dependent design, and a behavior button.
const buttonsSpec = `{"type":"group","buttons":[{"type":"link","text":{"ko":"목록","en":"List"},"href":"../?a=1&b=\"2\""},{"type":"submit","name":"__submitted__","value":"go","design":{"class":{"name == \"a\"":"primary","true":"plain"},"style":"color: red; width: 5px"}},{"type":"button","text":"Back <now>","behavior":{"onclick":{"label":"x","script":"history.back()"}}}],"properties":{"name":{"type":"text"}}}`

// Expected values below are produced by the JavaScript bindButtons and formButtonsHtml.
func TestBindButtonsAndFormButtonsHTMLMatchJavaScript(t *testing.T) {
	declared := compile(t, buttonsSpec)
	for _, c := range []struct{ data, class string }{{`{"name":"a"}`, "primary"}, {`{}`, "plain"}} {
		buttons, e := BindButtons(declared, parseObject(t, c.data), BindOptions{Language: "en"})
		if e != nil {
			t.Fatal(e)
		}
		wantVM := `[{"type":"link","tag":"a","text":"List","attrs":{"class":"crudui-action crudui-action--text","href":"../?a=1&b=\"2\""}},{"type":"submit","tag":"button","text":"Save","attrs":{"type":"submit","class":"crudui-action crudui-action--text ` + c.class + `","style":"color: red; width: 5px","name":"__submitted__","value":"go"}},{"type":"button","tag":"button","text":"Back <now>","attrs":{"type":"button","class":"crudui-action crudui-action--text","onclick":"history.back()"}}]`
		if got := plainJSON(t, buttons); got != wantVM {
			t.Fatalf("%s\n%s", got, wantVM)
		}
		html, e := FormButtonsHTML(buttons)
		wantHTML := `<a class="crudui-action crudui-action--text" href="../?a=1&amp;b=&quot;2&quot;">List</a><button type="submit" class="crudui-action crudui-action--text ` + c.class + `" style="color: red; width: 5px" name="__submitted__" value="go">Save</button><button type="button" class="crudui-action crudui-action--text" onclick="history.back()">Back &lt;now&gt;</button>`
		if e != nil || html != wantHTML {
			t.Fatalf("%v\n%s", e, html)
		}
	}
	plain := compile(t, `{"type":"group","properties":{}}`)
	buttons, e := BindButtons(plain, nil, BindOptions{})
	if e != nil || encode(t, buttons) != `[{"type":"submit","tag":"button","text":"저장","attrs":{"type":"submit","class":"crudui-action crudui-action--text"}}]` {
		t.Fatal(e, encode(t, buttons))
	}
	if html, e := FormButtonsHTML(buttons); e != nil || html != `<button type="submit" class="crudui-action crudui-action--text">저장</button>` {
		t.Fatal(e, html)
	}
	if html, e := FormButtonsHTML(nil); e != nil || html != "" {
		t.Fatal(e, html)
	}
	for _, c := range []struct {
		template *FormTemplate
		options  BindOptions
		message  string
	}{
		{nil, BindOptions{}, "Unsupported form template"},
		{&FormTemplate{Kind: "other"}, BindOptions{}, "Unsupported form template"},
		{plain, BindOptions{Language: 1}, "Language must be a string"},
		{plain, BindOptions{Language: "fr"}, func() string { _, e := BindForm(plain, nil, BindOptions{Language: "fr"}); return e.Error() }()},
	} {
		if _, e := BindButtons(c.template, nil, c.options); e == nil || e.Error() != c.message {
			t.Fatalf("%v: %v", c.message, e)
		}
	}
	for _, bad := range []*Object{
		nil,
		NewObject(),
		NewObject("tag", "div", "text", "x", "attrs", NewObject()),
		NewObject("tag", "a", "text", 1, "attrs", NewObject()),
		NewObject("tag", "a", "text", "x"),
		NewObject("tag", "a", "text", "x", "attrs", []any{}),
		NewObject("tag", "a", "text", "x", "attrs", NewObject("id", "i")),
		NewObject("tag", "a", "text", "x", "attrs", NewObject("href", 1)),
	} {
		if _, e := FormButtonsHTML([]*Object{buttons[0], bad}); e == nil || e.Error() != "Form buttons must be evaluated button objects" {
			t.Fatalf("%v: %v", bad, e)
		}
	}
	// Members other than tag, text and attrs are ignored.
	if html, e := FormButtonsHTML([]*Object{NewObject("type", 1, "tag", "a", "text", "x", "attrs", NewObject("href", "/"), "extra", true)}); e != nil || html != `<a href="/">x</a>` {
		t.Fatal(e, html)
	}
}

// plainJSON encodes a value as JavaScript JSON.stringify does; ordered objects escape HTML characters internally, so those escapes are undone.
func plainJSON(t *testing.T, v any) string {
	t.Helper()
	var b strings.Builder
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		t.Fatal(err)
	}
	return strings.NewReplacer(`\u0026`, "&", `\u003c`, "<", `\u003e`, ">").Replace(strings.TrimSuffix(b.String(), "\n"))
}
