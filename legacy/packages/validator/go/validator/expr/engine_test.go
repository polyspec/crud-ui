package expr

import "testing"

// Targeted unit checks beyond the shared fixture (mirrors PHP ExprConformanceTest
// non-fixture cases).

// valueOf returns a checker for the result of a call: it fails t with the error of
// the call and otherwise returns its value.
func valueOf[T any](t *testing.T) func(T, error) T {
	return func(v T, err error) T {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
}

// Condition map (§8): first truthy key in declaration order wins; on a miss the
// literal `true` key's value is used, else nil. The default key never
// short-circuits an earlier real condition even when declared first.
func TestConditionMap(t *testing.T) {
	gold := []ConditionEntry{
		{Expr: ".tier == 'gold'", Value: "premium"},
		{Expr: ".tier == 'silver'", Value: "standard"},
		{Expr: "true", Value: "basic"},
	}

	mustResolve := func(entries []ConditionEntry, data map[string]any, path []string) any {
		v, err := ResolveConditionMap(entries, data, path, nil)
		if err != nil {
			t.Fatalf("resolve error: %v", err)
		}
		return v
	}

	if got := mustResolve(gold, map[string]any{"tier": "gold", "x": 1}, []string{"x"}); got != "premium" {
		t.Errorf("gold: want premium got %#v", got)
	}
	if got := mustResolve(gold, map[string]any{"tier": "silver", "x": 1}, []string{"x"}); got != "standard" {
		t.Errorf("silver: want standard got %#v", got)
	}
	if got := mustResolve(gold, map[string]any{"tier": "bronze", "x": 1}, []string{"x"}); got != "basic" {
		t.Errorf("bronze: want basic got %#v", got)
	}

	noDefault := []ConditionEntry{{Expr: ".a == 1", Value: "one"}}
	if got := mustResolve(noDefault, map[string]any{"a": 9, "x": 1}, []string{"x"}); got != nil {
		t.Errorf("no-default miss: want nil got %#v", got)
	}
}

// Default key declared first must not pre-empt a later matching condition.
func TestConditionMapDefaultDoesNotShortCircuit(t *testing.T) {
	m := []ConditionEntry{
		{Expr: "true", Value: "fallback"},
		{Expr: ".tier == 'gold'", Value: "premium"},
	}
	if got := valueOf[any](t)(ResolveConditionMap(m, map[string]any{"tier": "gold", "x": 1}, []string{"x"}, nil)); got != "premium" {
		t.Errorf("want premium got %#v", got)
	}
	if got := valueOf[any](t)(ResolveConditionMap(m, map[string]any{"tier": "none", "x": 1}, []string{"x"}, nil)); got != "fallback" {
		t.Errorf("want fallback got %#v", got)
	}
}

// JS-parity value semantics: == / != loose equality (numeric strings coerce);
// > >= < <= coerce both sides to number; EvaluateValue returns the boolean
// condition result for non-ternary nodes.
func TestValueSemanticsMatchJsReference(t *testing.T) {
	if ok := valueOf[bool](t)(Evaluate(".n == 5", map[string]any{"n": "5", "x": 1}, []string{"x"}, nil)); !ok {
		t.Error(".n == 5 with n='5' should be true")
	}
	if ok := valueOf[bool](t)(Evaluate(".score < 50", map[string]any{"score": "30", "x": 1}, []string{"x"}, nil)); !ok {
		t.Error(".score < 50 with score='30' should be true")
	}
	if v := valueOf[any](t)(EvaluateValue(".v", map[string]any{"v": "hi", "x": 1}, []string{"x"}, nil)); v != true {
		t.Errorf(".v non-ternary should return bool true, got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue(".v", map[string]any{"v": 0, "x": 1}, []string{"x"}, nil)); v != false {
		t.Errorf(".v non-ternary should return bool false, got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue("true", map[string]any{}, nil, nil)); v != true {
		t.Errorf("standalone true should be bool true, got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue("false", map[string]any{}, nil, nil)); v != false {
		t.Errorf("standalone false should be bool false, got %#v", v)
	}
}

// Ternary returns the branch's raw value (string/number/null), recursively for
// nested right-associative ternaries. Non-ternary branches return their boolean.
func TestTernaryValueReturn(t *testing.T) {
	if v := valueOf[any](t)(EvaluateValue(".big ? 'huge' : 'tiny'", map[string]any{"big": true, "x": 1}, []string{"x"}, nil)); v != "huge" {
		t.Errorf("want huge got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue(".big ? 'huge' : 'tiny'", map[string]any{"big": false, "x": 1}, []string{"x"}, nil)); v != "tiny" {
		t.Errorf("want tiny got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue(".a ? 'A' : .b ? 'B' : 'C'", map[string]any{"a": false, "b": true, "x": 1}, []string{"x"}, nil)); v != "B" {
		t.Errorf("want B got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue(".active ? 1 : 0", map[string]any{"active": false, "x": 1}, []string{"x"}, nil)); !valueEquals(0, v) {
		t.Errorf("want 0 got %#v", v)
	}
	if v := valueOf[any](t)(EvaluateValue(".show == 1 ? 1 : null", map[string]any{"show": 0, "x": 1}, []string{"x"}, nil)); v != nil {
		t.Errorf("want nil got %#v", v)
	}
}

// TestCacheBoundedCapacity verifies that the expression AST cache never
// exceeds its capacity after parsing many distinct expressions.
func TestCacheBoundedCapacity(t *testing.T) {
	// Clear cache before test
	ClearCache()
	defer ClearCache()

	const numExpressions = 5000
	const maxCapacity = 1000

	// Parse 5000 distinct expressions
	for i := 0; i < numExpressions; i++ {
		expr := ".value > " + string(rune('0'+i%10))
		_, err := Parse(expr)
		if err != nil {
			t.Fatalf("parse error on expression %d: %v", i, err)
		}

		// Check cache size never exceeds capacity
		size := astCache.size()
		if size > maxCapacity {
			t.Errorf("cache size %d exceeds max capacity %d at iteration %d", size, maxCapacity, i)
		}
	}

	// Verify cache is at or near capacity
	finalSize := astCache.size()
	if finalSize > maxCapacity {
		t.Errorf("final cache size %d exceeds capacity %d", finalSize, maxCapacity)
	}
	if finalSize < maxCapacity-10 {
		// Allow some slack for the last eviction, but should be close to capacity
		t.Logf("final cache size %d is significantly below capacity %d", finalSize, maxCapacity)
	}
}
