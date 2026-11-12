package generator

import (
	"strings"
	"testing"
)

func TestUTCDateValues(t *testing.T) {
	cases := []struct{ input, date, datetime string }{
		{"2026-09-09", "2026-09-09", "2026-09-09T00:00:00"},
		{"2026-09-09T01:02", "2026-09-09", "2026-09-09T01:02:00"},
		{"2026-09-09 01:02:03.987654321123", "2026-09-09", "2026-09-09T01:02:03"},
		{"2026-09-09T00:30:00+09:00", "2026-09-08", "2026-09-08T15:30:00"},
		{"2026-12-31T23:30:00-02:30", "2027-01-01", "2027-01-01T02:00:00"},
		{"Wed, 09 Sep 2026 01:02:03 +0900", "2026-09-08", "2026-09-08T16:02:03"},
		{"9 sep 2026 01:02 GMT", "2026-09-09", "2026-09-09T01:02:00"},
		{"Wed, 09 Sep 2026 01:02:03 est", "2026-09-09", "2026-09-09T06:02:03"},
		{"0000-01-01T00:00:00+01:00", "-0001-12-31", "-0001-12-31T23:00:00"},
		{"9999-12-31T23:30:00-01:00", "10000-01-01", "10000-01-01T00:30:00"},
	}
	for _, c := range cases {
		if got := dateValue(c.input); got != c.date {
			t.Errorf("date %q: %q != %q", c.input, got, c.date)
		}
		if got := datetimeValue(c.input); got != c.datetime {
			t.Errorf("datetime %q: %q != %q", c.input, got, c.datetime)
		}
		html, err := RenderList(NewObject("columns", NewObject("value", NewObject("field", ".value", "format", NewObject("type", "date", "pattern", "YYYY-MM-DD HH:mm:ss")))), []*Object{NewObject("value", c.input)}, ListOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(html, `class="crudui-list__cell crudui-value crudui-value--date">`+strings.Replace(c.datetime, "T", " ", 1)+`</td>`) {
			t.Errorf("list date %q: %s", c.input, html)
		}
	}
	for _, value := range []string{"2026-02-30", "2026-02-30T12:00:00Z", "2026-09-09T24:00", "2026-09-09T23:60:00", "2026-09-09T23:59:60Z", "2026-09-09T01:02:03+24:00", "2026-09-09T01:02:03+09:60", "2026-09-09T01:02:03Z trailing", "Tue, 09 Sep 2026 01:02:03 +0000", "Wed, 09 Sep 2026 01:02:03", "Wed, 09 Sep 26 01:02:03 GMT", "yesterday", "2026/09/09", " 2026-09-09"} {
		if dateValue(value) != value || datetimeValue(value) != value {
			t.Errorf("changed unsupported or invalid date %q", value)
		}
	}
}

func TestDateRenderingRetainsSourceData(t *testing.T) {
	template, err := CompileForm(NewObject("type", "group", "properties", NewObject("date", NewObject("type", "date"), "datetime", NewObject("type", "datetime"))), CompileOptions{})
	if err != nil {
		t.Fatal(err)
	}
	data := NewObject("date", "2026-09-09T00:30:00+09:00", "datetime", "2026-09-09T00:30:00+09:00")
	initial, err := NewForm(template, data, BindOptions{})
	if err != nil {
		t.Fatal(err)
	}
	empty, err := NewForm(template, NewObject(), BindOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if err := empty.SetData(data); err != nil {
		t.Fatal(err)
	}
	initialHTML := renderHTML(t, initial)
	injectedHTML := renderHTML(t, empty)
	if initialHTML != injectedHTML {
		t.Fatal("date injection changed HTML")
	}
	got := encode(t, empty.GetData())
	want := encode(t, data)
	if got != want {
		t.Fatal("date formatting changed the stored record")
	}
}
