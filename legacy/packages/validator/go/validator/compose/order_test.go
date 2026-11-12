package compose

import (
	"encoding/json"
	"fmt"
	"testing"
)

func decodeObject(t *testing.T, input string) *OMap {
	t.Helper()
	v, err := DecodeOrdered([]byte(input))
	if err != nil {
		t.Fatal(err)
	}
	o, ok := v.(*OMap)
	if !ok {
		t.Fatalf("decoded %T, want *OMap", v)
	}
	return o
}

func encode(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestArrayIndexBoundaries(t *testing.T) {
	for _, name := range []string{"0", "1", "10", "4294967294"} {
		if _, ok := arrayIndex(name); !ok {
			t.Errorf("%q is an array index", name)
		}
	}
	for _, name := range []string{"", "01", "00", "-1", "+1", "1.5", "1e3", " 1", "4294967295", "4294967296", "18446744073709551616", "a", "１"} {
		if _, ok := arrayIndex(name); ok {
			t.Errorf("%q is not an array index", name)
		}
	}
}

func TestOrderMembersPutsArrayIndexesFirst(t *testing.T) {
	in := decodeObject(t, `{"b":1,"10":2,"a":3,"4294967295":4,"01":5,"2":6,"-1":7,"0":8,"4294967294":9}`)
	got := encode(t, OrderMembers(in))
	want := `{"0":8,"2":6,"10":2,"4294967294":9,"b":1,"a":3,"4294967295":4,"01":5,"-1":7}`
	if got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
	if encode(t, in) != `{"b":1,"10":2,"a":3,"4294967295":4,"01":5,"2":6,"-1":7,"0":8,"4294967294":9}` {
		t.Fatal("the input was modified")
	}
}

func TestOrderMembersNestedObjectsAndArrays(t *testing.T) {
	in := decodeObject(t, `{"z":{"y":[{"b":1,"1":2},[{"c":1,"0":2}],"s",null],"3":true},"1":[]}`)
	got := encode(t, OrderMembers(in))
	want := `{"1":[],"z":{"3":true,"y":[{"1":2,"b":1},[{"0":2,"c":1}],"s",null]}}`
	if got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
	for _, scalar := range []any{nil, "10", 1.5, true} {
		if OrderMembers(scalar) != scalar {
			t.Errorf("scalar %v changed", scalar)
		}
	}
}

func TestComposeUsesMemberOrder(t *testing.T) {
	base := decodeObject(t, `{"properties":{"b":{"type":"text"},"a":{"type":"text"}}}`)
	loader := NewMemoryLoader(map[string]*OMap{"base.yml": base})
	entry := decodeObject(t, `{"$ref":"base.yml","$patch":{"10":{"type":"text"},"b.items":{"y":"Y","5":"Five"}}}`)
	got, err := ComposeProperties(entry, loader, ComposeOptions{})
	if err != nil {
		t.Fatal(err)
	}
	want := `{"10":{"type":"text"},"b":{"type":"text","items":{"5":"Five","y":"Y"}},"a":{"type":"text"}}`
	if encode(t, got) != want {
		t.Fatalf("got %s, want %s", encode(t, got), want)
	}
}

// orderLoader returns documents in the order written, as a custom loader may.
type orderLoader struct{ doc string }

func (l orderLoader) Normalize(path, _ string) string { return path }
func (l orderLoader) Load(string) (*OMap, error) {
	v, err := DecodeOrdered([]byte(l.doc))
	if err != nil {
		return nil, err
	}
	o, ok := v.(*OMap)
	if !ok {
		return nil, fmt.Errorf("orderLoader: document is %T, not an object", v)
	}
	return o, nil
}

func TestComposeOrdersCustomLoaderDocuments(t *testing.T) {
	loader := orderLoader{doc: `{"properties":{"b":{"type":"text"},"7":{"type":"text","design":{"z":1,"0":2}}}}`}
	spec := decodeObject(t, `{"type":"group","properties":{"$ref":"x.yml"}}`)
	got, err := ComposeSpec(spec, loader, ComposeOptions{})
	if err != nil {
		t.Fatal(err)
	}
	want := `{"type":"group","properties":{"7":{"type":"text","design":{"0":2,"z":1}},"b":{"type":"text"}}}`
	if encode(t, got) != want {
		t.Fatalf("got %s, want %s", encode(t, got), want)
	}
}
