package validate

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// TestComparisonKeyCanonicalJSON tests that comparison keys for objects
// with different key orders are identical.
func TestComparisonKeyCanonicalJSON(t *testing.T) {
	// Two objects with same content but different key order
	obj1 := map[string]any{
		"a": float64(1),
		"b": "test",
		"c": true,
	}

	obj2 := map[string]any{
		"c": true,
		"a": float64(1),
		"b": "test",
	}

	key1 := comparisonKey(obj1)
	key2 := comparisonKey(obj2)

	if key1 != key2 {
		t.Errorf("comparisonKey for objects with different key order should be identical")
		t.Errorf("  obj1 key: %s", key1)
		t.Errorf("  obj2 key: %s", key2)
	}
}

// TestComparisonKeyTypeDistinction tests that comparison keys distinguish types.
func TestComparisonKeyTypeDistinction(t *testing.T) {
	tests := []struct {
		val1  any
		val2  any
		equal bool
	}{
		{float64(1), "1", false},       // number vs string
		{true, float64(1), false},      // bool vs number
		{nil, "null", false},           // null vs string
		{[]any{}, "[]", false},         // array vs string
		{float64(1), float64(1), true}, // same number
		{"1", "1", true},               // same string
	}

	for _, tt := range tests {
		key1 := comparisonKey(tt.val1)
		key2 := comparisonKey(tt.val2)
		keysMatch := key1 == key2

		if keysMatch != tt.equal {
			t.Errorf("comparisonKey(%v) vs comparisonKey(%v): got %v, want %v",
				tt.val1, tt.val2, keysMatch, tt.equal)
		}
	}
}

// TestUniqueManyValues checks 1,000,000 distinct values. A check that keys each value once ends
// within a second; one that compares each value with every earlier one makes 5 * 10^11
// comparisons and does not end before the per-test timeout of the run-tests tool of @polyspec/kit, which fails
// the test.
func TestUniqueManyValues(t *testing.T) {
	values := make([]any, 1_000_000)
	for i := range values {
		values[i] = "item-" + strconv.Itoa(i)
	}
	if !areAllUnique(values) {
		t.Fatal("distinct values were reported as duplicates")
	}
	values[len(values)-1] = "item-0"
	if areAllUnique(values) {
		t.Fatal("the last value repeats the first one")
	}
}

// TestUniqueManyRows validates a repeated group of 200,000 rows whose field declares unique. The
// rows are walked once per validation, which ends within seconds; a walk of every earlier row for
// each row makes 2 * 10^10 row visits and does not end before the per-test timeout of
// the run-tests tool of @polyspec/kit, which fails the test.
func TestUniqueManyRows(t *testing.T) {
	decoded, err := compose.DecodeOrdered([]byte(`{"type":"group","dataLimits":{"values":1000000},"properties":{"rows":{"type":"group","multiple":true,"properties":{"code":{"type":"text","validate":{"unique":true}}}}}}`))
	if err != nil {
		t.Fatal(err)
	}
	rows := map[string]any{}
	for i := 0; i < 200_000; i++ {
		rows[fmt.Sprintf("__%013d__", i+1)] = map[string]any{"code": strconv.Itoa(i)}
	}
	spec, ok := decoded.(*compose.OMap)
	if !ok {
		t.Fatalf("spec decoded as %T, want an object", decoded)
	}
	result, err := Validate(spec, map[string]any{"rows": rows}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !result.Valid {
		t.Fatalf("distinct rows were reported as duplicates: %v", result.Errors[:1])
	}
}

// The duplicates found for one validation never reach another: a second validation of the same
// specification with different data answers from its own rows.
func TestUniqueRowsBelongToOneValidation(t *testing.T) {
	decoded, err := compose.DecodeOrdered([]byte(`{"type":"group","properties":{"rows":{"type":"group","multiple":true,"properties":{"code":{"type":"text","validate":{"unique":true}}}}}}`))
	if err != nil {
		t.Fatal(err)
	}
	spec, ok := decoded.(*compose.OMap)
	if !ok {
		t.Fatalf("spec decoded as %T, want an object", decoded)
	}
	rows := func(codes ...string) map[string]any {
		out := map[string]any{}
		for i, code := range codes {
			out[fmt.Sprintf("__%013d__", i+1)] = map[string]any{"code": code}
		}
		return map[string]any{"rows": out}
	}
	first, err := Validate(spec, rows("x", "x"), Options{})
	if err != nil || first.Valid {
		t.Fatalf("first validation: %+v %v", first, err)
	}
	second, err := Validate(spec, rows("x", "y"), Options{})
	if err != nil || !second.Valid {
		t.Fatalf("second validation took the first one's duplicates: %+v %v", second, err)
	}
}
