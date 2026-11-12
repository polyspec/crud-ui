package generator

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
)

func TestListInputRulesInOrder(t *testing.T) {
	spec := NewObject("columns", NewObject("v", NewObject("field", ".v")))
	rows := []*Object{NewObject("v", 1)}
	cases := []struct {
		name    string
		spec    *Object
		rows    []*Object
		options ListOptions
		want    string
	}{
		{"spec before rows", nil, []*Object{nil}, ListOptions{Layout: 5}, "List specification must be an object"},
		{"row before options", spec, []*Object{nil}, ListOptions{Data: []any{}}, "List rows must be objects"},
		{"data array", spec, rows, ListOptions{Data: []any{}, Page: 0.0}, "List context must be an object"},
		{"data string", spec, rows, ListOptions{Data: "s"}, "List context must be an object"},
		{"page before total and layout", spec, rows, ListOptions{Page: 0.0, Total: -1.0, Layout: "grid"}, "List page must be a positive integer"},
		{"page string", spec, rows, ListOptions{Page: "2"}, "List page must be a positive integer"},
		{"page boolean", spec, rows, ListOptions{Page: true}, "List page must be a positive integer"},
		{"page object", spec, rows, ListOptions{Page: NewObject("page", 2.0)}, "List page must be a positive integer"},
		{"page array", spec, rows, ListOptions{Page: []any{2.0}}, "List page must be a positive integer"},
		{"page fraction", spec, rows, ListOptions{Page: 1.5}, "List page must be a positive integer"},
		{"page negative", spec, rows, ListOptions{Page: -1}, "List page must be a positive integer"},
		{"page unsafe", spec, rows, ListOptions{Page: 9007199254740992.0}, "List page must be a positive integer"},
		{"page unsafe int64", spec, rows, ListOptions{Page: int64(9007199254740993)}, "List page must be a positive integer"},
		{"page NaN", spec, rows, ListOptions{Page: math.NaN()}, "List page must be a positive integer"},
		{"page infinite", spec, rows, ListOptions{Page: math.Inf(1)}, "List page must be a positive integer"},
		{"total before layout", spec, rows, ListOptions{Total: -1.0, Layout: "grid"}, "List total must be a nonnegative integer"},
		{"total string", spec, rows, ListOptions{Total: "0"}, "List total must be a nonnegative integer"},
		{"total boolean", spec, rows, ListOptions{Total: true}, "List total must be a nonnegative integer"},
		{"total fraction", spec, rows, ListOptions{Total: 2.5}, "List total must be a nonnegative integer"},
		{"total unsafe", spec, rows, ListOptions{Total: 9007199254740992.0}, "List total must be a nonnegative integer"},
		{"layout string", spec, rows, ListOptions{Layout: "grid"}, "List layout must be table or card"},
		{"layout number", spec, rows, ListOptions{Layout: 5}, "List layout must be table or card"},
		{"layout empty", spec, rows, ListOptions{Layout: ""}, "List layout must be table or card"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := RenderList(c.spec, c.rows, c.options)
			if err == nil || err.Error() != c.want {
				t.Fatalf("got %v, want %s", err, c.want)
			}
		})
	}
	var nilObject *Object
	for _, options := range []ListOptions{{}, {Data: nilObject}, {Data: NewObject(), Layout: "table"}} {
		html, err := RenderList(spec, rows, options)
		if err != nil || !strings.Contains(html, "<table") {
			t.Fatalf("%#v: %s %v", options, html, err)
		}
	}
	if _, err := BuildList(spec, rows, ListOptions{Page: "x"}); err == nil || err.Error() != "List page must be a positive integer" {
		t.Fatalf("BuildList accepted a string page: %v", err)
	}
	if _, err := BuildList(spec, rows, ListOptions{Total: -1.0}); err == nil || err.Error() != "List total must be a nonnegative integer" {
		t.Fatalf("BuildList accepted a negative total: %v", err)
	}
	if _, err := BuildList(spec, rows, ListOptions{Data: 5.0, Page: "x"}); err == nil || err.Error() != "List context must be an object" {
		t.Fatalf("BuildList must check data before page: %v", err)
	}
}

func TestListPageAndTotalAreIntegers(t *testing.T) {
	spec := NewObject("columns", NewObject("v", NewObject("field", ".v")), "pagination", true)
	cases := []struct {
		name    string
		options ListOptions
		want    string
	}{
		{"none", ListOptions{}, `{"enabled":true,"perPage":20,"mode":"pages","page":1,"pageCount":0,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}`},
		{"null", ListOptions{Page: nil, Total: nil}, `{"enabled":true,"perPage":20,"mode":"pages","page":1,"pageCount":0,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}`},
		{"integral floats", ListOptions{Page: 2.0, Total: 99.0}, `{"enabled":true,"perPage":20,"mode":"pages","page":2,"total":99,"pageCount":5,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":false},{"role":"page","page":1,"label":"1페이지","current":false,"disabled":false},{"role":"page","page":2,"label":"2페이지","current":true,"disabled":true},{"role":"page","page":3,"label":"3페이지","current":false,"disabled":false},{"role":"page","page":4,"label":"4페이지","current":false,"disabled":false},{"role":"page","page":5,"label":"5페이지","current":false,"disabled":false},{"role":"next","page":3,"label":"다음 페이지","current":false,"disabled":false}]}`},
		{"bounds", ListOptions{Page: 9007199254740991.0, Total: 0.0}, `{"enabled":true,"perPage":20,"mode":"pages","page":9007199254740991,"total":0,"pageCount":1,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"page","page":1,"label":"1페이지","current":true,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}`},
		{"negative zero total", ListOptions{Total: math.Copysign(0, -1)}, `{"enabled":true,"perPage":20,"mode":"pages","page":1,"total":0,"pageCount":1,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"page","page":1,"label":"1페이지","current":true,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}`},
		{"go integers", ListOptions{Page: 1, Total: int64(9007199254740991)}, `{"enabled":true,"perPage":20,"mode":"pages","page":1,"total":9007199254740991,"pageCount":450359962737050,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"page","page":1,"label":"1페이지","current":true,"disabled":true},{"role":"page","page":2,"label":"2페이지","current":false,"disabled":false},{"role":"page","page":450359962737050,"label":"450359962737050페이지","current":false,"disabled":false},{"role":"next","page":2,"label":"다음 페이지","current":false,"disabled":false}]}`},
		{"page only", ListOptions{Page: 3.0}, `{"enabled":true,"perPage":20,"mode":"pages","page":3,"pageCount":0,"buttons":[{"role":"previous","page":1,"label":"이전 페이지","current":false,"disabled":true},{"role":"next","page":1,"label":"다음 페이지","current":false,"disabled":true}]}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			vm, err := BuildList(spec, []*Object{}, c.options)
			if err != nil {
				t.Fatal(err)
			}
			b, err := json.Marshal(read(vm, "pagination"))
			if err != nil || string(b) != c.want {
				t.Fatalf("got %s %v, want %s", b, err, c.want)
			}
		})
	}
	html, err := RenderList(spec, []*Object{}, ListOptions{Page: 9007199254740991.0, Total: math.Copysign(0, -1)})
	if err != nil || !strings.Contains(html, `class="crudui-list__pagination-page" data-page="1" aria-label="1페이지" aria-current="page" disabled=""`) {
		t.Fatalf("%s %v", html, err)
	}
}

func TestDetailContextMustBeAnObject(t *testing.T) {
	spec := NewObject("fields", NewObject("v", NewObject("field", ".v")))
	for _, data := range []any{[]any{}, "s", 5.0} {
		if _, err := RenderDetail(spec, NewObject(), DetailOptions{Data: data}); err == nil || err.Error() != "Detail context must be an object" {
			t.Fatalf("RenderDetail data %#v: %v", data, err)
		}
		if _, err := BuildDetail(spec, NewObject(), DetailOptions{Data: data}); err == nil || err.Error() != "Detail context must be an object" {
			t.Fatalf("BuildDetail data %#v: %v", data, err)
		}
	}
	if _, err := RenderDetail(NewObject(), NewObject(), DetailOptions{Data: []any{}}); err == nil || err.Error() != "Detail specification must declare fields" {
		t.Fatalf("fields check must come first: %v", err)
	}
	var nilObject *Object
	for _, data := range []any{nil, nilObject, NewObject()} {
		if _, err := RenderDetail(spec, NewObject(), DetailOptions{Data: data}); err != nil {
			t.Fatalf("data %#v: %v", data, err)
		}
	}
}

func detailValue(t *testing.T, format *Object, value any) (string, error) {
	t.Helper()
	spec := NewObject("fields", NewObject("v", NewObject("field", ".v", "label", "V", "format", format)))
	html, err := RenderDetail(spec, NewObject("v", value), DetailOptions{})
	if err != nil {
		return "", err
	}
	start := strings.Index(html, "<dd")
	end := strings.Index(html, "</dd>")
	return html[start : end+len("</dd>")], nil
}

func TestTextTruncateCountsCodePoints(t *testing.T) {
	cases := []struct {
		truncate any
		value    string
		want     string
	}{
		{2.0, "a😀bc", "a😀…"},
		{3.0, "가나다라마", "가나다…"},
		{"2", "abcd", "abcd"},
		{0.5, "abc", "abc"},
		{2.9, "abcd", "ab…"},
		{-3.0, "abcd", "abcd"},
		{4.0, "abcd", "abcd"},
		{true, "abcd", "abcd"},
	}
	for _, c := range cases {
		got, err := detailValue(t, NewObject("type", "text", "truncate", c.truncate), c.value)
		want := `<dd class="crudui-detail__value crudui-value crudui-value--text">` + c.want + `</dd>`
		if err != nil || got != want {
			t.Fatalf("truncate %#v of %q: got %s %v, want %s", c.truncate, c.value, got, err, want)
		}
	}
}

func TestNumberDecimalsRange(t *testing.T) {
	for _, decimals := range []any{101.0, -1.0, 100.9 + 1} {
		_, err := detailValue(t, NewObject("type", "number", "decimals", decimals), 1.0)
		if err == nil || err.Error() != "Number decimals must be between 0 and 100" {
			t.Fatalf("decimals %v: %v", decimals, err)
		}
	}
	got, err := detailValue(t, NewObject("type", "number", "decimals", 100.0), 1.0)
	if want := `<dd class="crudui-detail__value crudui-value crudui-value--number">1.` + strings.Repeat("0", 100) + `</dd>`; err != nil || got != want {
		t.Fatalf("got %s %v", got, err)
	}
	for _, decimals := range []any{-0.5, 100.5, "101"} {
		if _, err := detailValue(t, NewObject("type", "number", "decimals", decimals), 1.0); err != nil {
			t.Fatalf("decimals %#v: %v", decimals, err)
		}
	}
}
