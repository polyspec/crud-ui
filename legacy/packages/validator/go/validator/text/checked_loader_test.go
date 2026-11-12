package text

import (
	"errors"
	"reflect"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// documents is a loader of documents held in memory by their key.
type documents map[string]*compose.OMap

func (d documents) Normalize(path, basepath string) string { return basepath + "/" + path }

func (d documents) Load(key string) (*compose.OMap, error) { return d[key], nil }

func TestCheckedLoaderNormalizesThroughTheWrappedLoader(t *testing.T) {
	if key := CheckedLoader(documents{}).Normalize("b.json", "a"); key != "a/b.json" {
		t.Fatalf("Normalize = %q, want a/b.json", key)
	}
}

func TestCheckedLoaderReturnsAValidDocument(t *testing.T) {
	doc := compose.NewOMap()
	doc.Set("label", "Name")
	loaded, err := CheckedLoader(documents{"form.json": doc}).Load("form.json")
	if err != nil || loaded != doc {
		t.Fatalf("Load = %v, %v; want the document", loaded, err)
	}
}

func TestCheckedLoaderLocatesInvalidTextUnderTheKey(t *testing.T) {
	doc := compose.NewOMap()
	doc.Set("label", "\xff")
	_, err := CheckedLoader(documents{"form.json": doc}).Load("form.json")
	var failure *compose.ComposeLoadError
	if !errors.As(err, &failure) || failure.Code != compose.InvalidText || !reflect.DeepEqual(failure.Trace, []string{"form.json", "label"}) {
		t.Fatalf("Load error = %#v, want INVALID_TEXT at form.json, label", err)
	}
}

func TestCheckedLoaderRefusesADocumentBeyondTheLimits(t *testing.T) {
	var value any = "leaf"
	for range NestingLimit {
		value = []any{value}
	}
	doc := compose.NewOMap()
	doc.Set("deep", value)
	_, err := CheckedLoader(documents{"form.json": doc}).Load("form.json")
	if err == nil || err.Error() != LimitMessage+": files" {
		t.Fatalf("Load error = %v, want %q", err, LimitMessage+": files")
	}
}
