package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestServerGeneratesValidatesSavesAndReloadsBothTransports(t *testing.T) {
	s, e := newServer(filepath.Join(t.TempDir(), "record.json"), "")
	if e != nil {
		t.Fatal(e)
	}
	requests := []struct{ body, contentType, name string }{{`{"name":"Ada","email":"ada@example.test"}`, "application/json", "Ada"}, {"profile%5Bname%5D=Grace&profile%5Bemail%5D=grace%40example.test", "application/x-www-form-urlencoded", "Grace"}}
	for _, input := range requests {
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(input.body))
		r.Header.Set("Content-Type", input.contentType)
		w := httptest.NewRecorder()
		s.form(w, r)
		if w.Code != http.StatusOK && w.Code != http.StatusSeeOther {
			t.Fatalf("Save failed: %d %s", w.Code, w.Body.String())
		}
		stored, e := os.ReadFile(s.file)
		if e != nil {
			t.Fatal(e)
		}
		var record map[string]any
		if e = json.Unmarshal(stored, &record); e != nil {
			t.Fatal(e)
		}
		if record["name"] != input.name {
			t.Fatal(record)
		}
		get := httptest.NewRecorder()
		s.form(get, httptest.NewRequest(http.MethodGet, "/", nil))
		if get.Code != http.StatusOK || !strings.Contains(get.Body.String(), `value="`+input.name+`"`) {
			t.Fatal("Saved data not rendered by Go", get.Body.String())
		}
	}
	before, e := os.ReadFile(s.file)
	if e != nil {
		t.Fatal(e)
	}
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"","email":"invalid"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.form(w, r)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatal("Invalid data accepted", w.Code)
	}
	after, e := os.ReadFile(s.file)
	if e != nil {
		t.Fatal(e)
	}
	if string(before) != string(after) {
		t.Fatal("Invalid submission changed stored record")
	}
}

func get(t *testing.T, handler http.HandlerFunc, path string) string {
	t.Helper()
	w := httptest.NewRecorder()
	handler(w, httptest.NewRequest(http.MethodGet, path, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET %s failed: %d %s", path, w.Code, w.Body.String())
	}
	return w.Body.String()
}

func TestListAndDetailRenderTheStoredRecord(t *testing.T) {
	s, e := newServer(filepath.Join(t.TempDir(), "record.json"), ".crudui-marker{}")
	if e != nil {
		t.Fatal(e)
	}
	// Without a stored record the list has no rows and the detail shows an empty record.
	if body := get(t, s.list, "/list"); !strings.Contains(body, `<div class="crudui-list">`) || strings.Contains(body, "<a href=\"/detail\">Ada") {
		t.Fatal("Empty list not rendered", body)
	}
	if body := get(t, s.detail, "/detail"); !strings.Contains(body, `<dt class="crudui-detail__label">Name</dt>`) {
		t.Fatal("Empty detail not rendered", body)
	}

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("profile%5Bname%5D=Ada&profile%5Bemail%5D=ada%40example.test&profile%5Bjoined%5D=2026-01-02"))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	s.form(w, r)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("Save failed: %d %s", w.Code, w.Body.String())
	}

	list := get(t, s.list, "/list")
	for _, want := range []string{
		`<td class="crudui-list__cell crudui-value crudui-value--link"><a href="/detail">Ada</a></td>`,
		`<td class="crudui-list__cell crudui-value crudui-value--text">ada@example.test</td>`,
		`<td class="crudui-list__cell crudui-value crudui-value--date">2026-01-02</td>`,
		`.crudui-marker{}`,
	} {
		if !strings.Contains(list, want) {
			t.Fatalf("List misses %s: %s", want, list)
		}
	}
	if strings.Count(list, "<tr>") != 2 {
		t.Fatal("List must show the header and the one stored record", list)
	}

	detail := get(t, s.detail, "/detail")
	for _, want := range []string{
		`<dl class="crudui-detail">`,
		`<dd class="crudui-detail__value crudui-value crudui-value--text">Ada</dd>`,
		`<a href="mailto:ada@example.test">ada@example.test</a>`,
		`<dd class="crudui-detail__value crudui-value crudui-value--date">2026-01-02</dd>`,
		`.crudui-marker{}`,
	} {
		if !strings.Contains(detail, want) {
			t.Fatalf("Detail misses %s: %s", want, detail)
		}
	}

	post := httptest.NewRecorder()
	s.list(post, httptest.NewRequest(http.MethodPost, "/list", nil))
	if post.Code != http.StatusMethodNotAllowed {
		t.Fatal("List accepted POST", post.Code)
	}
}
