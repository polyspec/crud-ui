package compose

import "testing"

func TestDecodeOrderedRejectsTrailingInput(t *testing.T) {
	for _, input := range []string{`{} {}`, `[] true`, `null 1`, `{} invalid`} {
		if _, err := DecodeOrdered([]byte(input)); err == nil {
			t.Errorf("Accepted trailing input %q", input)
		}
	}
	v, err := DecodeOrdered([]byte(" {\"b\":{},\"a\":[]} \n"))
	if err != nil {
		t.Fatal(err)
	}
	o, ok := v.(*OMap)
	if !ok {
		t.Fatalf("decoded %T, want *OMap", v)
	}
	if keys := o.Keys(); len(keys) != 2 || keys[0] != "b" || keys[1] != "a" {
		t.Fatal(o.Keys())
	}
}
