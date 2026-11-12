package expr

import (
	"encoding/json"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
)

// Evaluator walks an AST against form data (GRAMMAR §5/§6/§7, JS PathResolver
// parity). The shared 4-language fixture is generated from the JS reference
// engine, so this evaluator mirrors validator-ts PathResolver function for
// function:
//
//   - Evaluate(node)      → bool  (JS evaluateCondition): isTruthy of the
//     resolved value for Path/Literal; logical short-circuit; comparison; in;
//     unary; a ternary is isTruthy(its branch value).
//   - EvaluateValue(node) → value (JS evaluateExpressionValue): a ternary
//     returns its branch value; everything else returns the boolean condition.
//
// truthy (GRAMMAR §6): null/false/0/"" falsy; "0", "false", [], {}, and every
// non-empty value truthy (matches JS Boolean: empty array/object are truthy).
// == / != use JS loose equality; > >= < <= coerce BOTH sides to number and
// compare numerically — no lexicographic branch.
//
// No eval / no regex evaluation (GRAMMAR §10) — pure AST walk.
type Evaluator struct {
	formData    map[string]any
	currentPath []string
	rowKeys     []int
}

// NewEvaluator binds form data, the current field path (the path of the field
// carrying the condition, including its own name) and the positions of the row
// keys in that path.
func NewEvaluator(formData map[string]any, currentPath []string, rowKeys []int) *Evaluator {
	return &Evaluator{formData: formData, currentPath: currentPath, rowKeys: rowKeys}
}

// RelativeBase returns the path that a relative path with levelsUp further dots
// starts from: the current field is one level and each further dot moves one more
// level up, and a row key leaves together with the name of its collection
// (expressions.md, "Evaluation").
func RelativeBase(currentPath []string, rowKeys []int, levelsUp int) []string {
	base := append([]string{}, currentPath...)
	for level := 0; level <= levelsUp && len(base) > 0; level++ {
		leaving := 1
		for _, position := range rowKeys {
			if position == len(base)-1 {
				leaving = 2
			}
		}
		if leaving > len(base) {
			leaving = len(base)
		}
		base = base[:len(base)-leaving]
	}
	return base
}

// Evaluate evaluates a node to a boolean condition result (JS evaluateCondition).
func (e *Evaluator) Evaluate(node Node) bool {
	switch n := node.(type) {
	case *BinaryNode:
		return e.evaluateBinary(n)
	case *UnaryNode:
		return e.evaluateUnary(n)
	case *InNode:
		return e.evaluateIn(n)
	case *GroupNode:
		return e.Evaluate(n.Expression)
	case *TernaryNode:
		return IsTruthy(e.evaluateTernary(n))
	case *PathNode:
		return IsTruthy(e.resolveValue(n))
	case *LiteralNode:
		return IsTruthy(e.resolveValue(n))
	default:
		return false
	}
}

// EvaluateValue evaluates a node to a value (JS evaluateExpressionValue). A
// ternary returns its chosen branch's raw value; every other node returns its
// boolean condition result (the shared fixture's value for non-ternary mirrors
// truthy).
func (e *Evaluator) EvaluateValue(node Node) any {
	switch n := node.(type) {
	case *TernaryNode:
		return e.evaluateTernary(n)
	case *GroupNode:
		return e.EvaluateValue(n.Expression)
	default:
		return e.Evaluate(node)
	}
}

// resolveTernaryBranchValue resolves a ternary branch to its raw value (JS
// resolveTernaryBranchValue): nested ternary recurses; literal/path return their
// value; logical/in/comparison/unary return their boolean.
func (e *Evaluator) resolveTernaryBranchValue(node Node) any {
	switch n := node.(type) {
	case *TernaryNode:
		return e.evaluateTernary(n)
	case *GroupNode:
		return e.resolveTernaryBranchValue(n.Expression)
	case *LiteralNode:
		return n.Value
	case *PathNode:
		return e.resolveValue(n)
	case *BinaryNode:
		return e.evaluateBinary(n)
	case *UnaryNode:
		return e.evaluateUnary(n)
	case *InNode:
		return e.evaluateIn(n)
	default:
		return nil
	}
}

func (e *Evaluator) evaluateTernary(node *TernaryNode) any {
	if e.Evaluate(node.Condition) {
		return e.resolveTernaryBranchValue(node.TrueValue)
	}
	return e.resolveTernaryBranchValue(node.FalseValue)
}

func (e *Evaluator) evaluateBinary(node *BinaryNode) bool {
	// Short-circuit logical operators.
	if node.Operator == "&&" {
		return e.Evaluate(node.Left) && e.Evaluate(node.Right)
	}
	if node.Operator == "||" {
		return e.Evaluate(node.Left) || e.Evaluate(node.Right)
	}

	left, candidates := e.resolveOperand(node.Left)
	right := e.resolveValue(node.Right)

	// A wildcard path resolves to a list of candidate values: ANY match
	// (CURRENT strategy already collapses to a scalar before this point). An
	// array that a plain path names is one value.
	if candidates {
		for _, lv := range candidateValues(left) {
			if compareOp(lv, right, node.Operator) {
				return true
			}
		}
		return false
	}

	return compareOp(left, right, node.Operator)
}

func compareOp(left, right any, operator string) bool {
	switch operator {
	case "==":
		return looseEquals(left, right)
	case "!=":
		return !looseEquals(left, right)
	case ">":
		return coerceNumber(left) > coerceNumber(right)
	case ">=":
		return coerceNumber(left) >= coerceNumber(right)
	case "<":
		return coerceNumber(left) < coerceNumber(right)
	case "<=":
		return coerceNumber(left) <= coerceNumber(right)
	default:
		return false
	}
}

func (e *Evaluator) evaluateUnary(node *UnaryNode) bool {
	if node.Operator == "!" {
		return !e.Evaluate(node.Operand)
	}
	return false
}

func (e *Evaluator) evaluateIn(node *InNode) bool {
	value, candidates := e.resolveOperand(node.Value)
	list := make([]any, len(node.List))
	for i, item := range node.List {
		list[i] = e.resolveValue(item)
	}

	// Wildcard value resolved to a list: ANY element passing membership.
	if candidates {
		for _, v := range candidateValues(value) {
			included := inList(v, list)
			if node.Negated {
				included = !included
			}
			if included {
				return true
			}
		}
		return false
	}

	included := inList(value, list)
	if node.Negated {
		return !included
	}
	return included
}

func inList(value any, list []any) bool {
	for _, item := range list {
		if looseEquals(value, item) {
			return true
		}
	}
	return false
}

// resolveValue resolves a node to its raw value (JS resolveValue): Literal → its
// value; Path → the data at the resolved path (wildcards handled); Group → the
// inner condition's boolean.
func (e *Evaluator) resolveValue(node Node) any {
	switch n := node.(type) {
	case *LiteralNode:
		return n.Value
	case *PathNode:
		return e.resolvePath(n)
	case *GroupNode:
		return e.Evaluate(n.Expression)
	default:
		return nil
	}
}

// resolveOperand resolves the left operand of a comparison: the list of candidate
// values of a wildcard path with true, or the one value of any other node with
// false.
func (e *Evaluator) resolveOperand(node Node) (any, bool) {
	if path, ok := node.(*PathNode); ok {
		return e.resolvePathOperand(path)
	}
	return e.resolveValue(node), false
}

// --- path resolution (JS resolvePathSegments + resolveValue parity) ----------

func (e *Evaluator) resolvePath(node *PathNode) any {
	value, _ := e.resolvePathOperand(node)
	return value
}

// resolvePathOperand returns the value of a path with false, or the list of
// candidate values of a wildcard that the current path does not resolve with
// true.
func (e *Evaluator) resolvePathOperand(node *PathNode) (any, bool) {
	resolvedPath := e.resolvePathSegments(node)

	if hasWildcard(resolvedPath) {
		// CURRENT strategy: replace wildcards with the current array indices.
		resolvedPath = replaceWildcardWithIndex(resolvedPath, e.currentPath)

		if hasWildcard(resolvedPath) {
			// Still wildcarded: resolve to the list of all matching values.
			resolved := e.resolveWildcardPath(resolvedPath)
			out := make([]any, len(resolved))
			for i, r := range resolved {
				out[i] = r.value
			}
			return out, true
		}
	}

	return e.getValueByPath(resolvedPath), false
}

// resolvePathSegments computes absolute path segments (JS resolvePathSegments).
func (e *Evaluator) resolvePathSegments(node *PathNode) []string {
	var basePath []string

	if node.Relative {
		basePath = RelativeBase(e.currentPath, e.rowKeys, node.LevelsUp)
	} else {
		basePath = []string{}
	}

	for _, seg := range node.Segments {
		switch seg.Type {
		case "identifier":
			basePath = append(basePath, seg.Value)
		case "index":
			basePath = append(basePath, strconv.Itoa(seg.Index))
		case "wildcard":
			basePath = append(basePath, "*")
		}
	}

	return basePath
}

// ValueAtSegments reads the value at concrete path segments (JS getValueByPath). A
// missing key, or a descent into a value that is neither an object nor an array, yields
// nil. Numeric segments index into arrays.
func ValueAtSegments(data any, path []string) any {
	current := data
	for _, segment := range path {
		if current == nil {
			return nil
		}
		switch c := current.(type) {
		case map[string]any:
			v, ok := c[segment]
			if !ok {
				return nil
			}
			current = v
		case []any:
			idx, err := strconv.Atoi(segment)
			if err != nil || idx < 0 || idx >= len(c) {
				return nil
			}
			current = c[idx]
		default:
			return nil
		}
	}
	return current
}

// getValueByPath reads the value at a concrete path (JS getValueByPath).
func (e *Evaluator) getValueByPath(path []string) any {
	return ValueAtSegments(e.formData, path)
}

type pathValue struct {
	path  []string
	value any
}

// resolveWildcardPath resolves a wildcard path to all concrete {path,value}
// pairs (JS resolveWildcardPath, ANY strategy across the array; an object source
// skips the wildcard index per multiple:'only').
func (e *Evaluator) resolveWildcardPath(path []string) []pathValue {
	wildcardIndex := indexOfWildcard(path)
	if wildcardIndex == -1 {
		return []pathValue{{path: path, value: e.getValueByPath(path)}}
	}

	arrayPath := path[:wildcardIndex]
	remainingPath := path[wildcardIndex+1:]
	arrayData := e.getValueByPath(arrayPath)

	// Object source: skip the wildcard index, access remaining directly.
	if m, ok := arrayData.(map[string]any); ok {
		_ = m
		concrete := concatStrings(arrayPath, remainingPath)
		return e.resolveWildcardPath(concrete)
	}

	arr, ok := arrayData.([]any)
	if !ok {
		return []pathValue{}
	}

	var results []pathValue
	for i := range arr {
		concrete := concatStrings(arrayPath, []string{strconv.Itoa(i)}, remainingPath)
		results = append(results, e.resolveWildcardPath(concrete)...)
	}

	return results
}

func concatStrings(parts ...[]string) []string {
	total := 0
	for _, p := range parts {
		total += len(p)
	}
	out := make([]string, 0, total)
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

// replaceWildcardWithIndex replaces each wildcard with the corresponding array
// index from currentPath, in order (JS replaceWildcardWithIndex). Wildcards with
// no matching index stay as '*' for later list resolution.
func replaceWildcardWithIndex(path, currentPath []string) []string {
	var arrayIndices []string
	for _, segment := range currentPath {
		if isNumericSegment(segment) {
			arrayIndices = append(arrayIndices, segment)
		}
	}

	result := make([]string, 0, len(path))
	cursor := 0
	for _, segment := range path {
		if segment == "*" {
			if cursor < len(arrayIndices) {
				result = append(result, arrayIndices[cursor])
				cursor++
			} else {
				result = append(result, "*")
			}
		} else {
			result = append(result, segment)
		}
	}

	return result
}

func hasWildcard(path []string) bool {
	return slices.Contains(path, "*")
}

func indexOfWildcard(path []string) int {
	return slices.Index(path, "*")
}

func isNumericSegment(segment string) bool {
	if segment == "" {
		return false
	}
	for i := 0; i < len(segment); i++ {
		if segment[i] < '0' || segment[i] > '9' {
			return false
		}
	}
	return true
}

// --- value semantics (JS truthy / looseEquals / coerceNumber parity) ---------

// IsTruthy is the truthy test (JS Boolean, GRAMMAR §6). null/false/0/0.0/"" are
// falsy; "0", "false", empty list, empty object, and every non-empty value are
// truthy.
func IsTruthy(value any) bool {
	switch v := value.(type) {
	case nil:
		return false
	case bool:
		return v
	case string:
		return v != ""
	default:
		if n, ok := NumberValue(value); ok {
			return n != 0 && !math.IsNaN(n)
		}
		// Lists and objects (and any other reference value) are truthy in JS.
		return true
	}
}

// looseEquals is JS loose equality. Same JS-type compares with Go ==; null equals
// only null; otherwise numeric equality when both Number()-parse, else string
// equality.
func looseEquals(a, b any) bool {
	ta, tb := jsTypeOf(a), jsTypeOf(b)
	if ta == tb {
		return sameTypeEquals(a, b, ta)
	}

	if a == nil {
		return b == nil
	}
	if b == nil {
		return false
	}

	aNum, aOk := jsNumber(a)
	bNum, bOk := jsNumber(b)
	if aOk && bOk {
		return aNum == bNum
	}

	return jsToString(a) == jsToString(b)
}

// candidateValues returns the candidate values of a wildcard operand. resolvePathOperand
// returns its candidates as a []any with candidates set to true, so the assertion cannot fail.
func candidateValues(v any) []any {
	values, ok := v.([]any)
	if !ok {
		panic(fmt.Sprintf("expr: wildcard operand is %T, not []any", v))
	}
	return values
}

// sameKindEquals compares two values that jsTypeOf put in the same bucket, whose Go type T
// both values have, so both assertions cannot fail.
func sameKindEquals[T comparable](a, b any) bool {
	x, okA := a.(T)
	y, okB := b.(T)
	if !okA || !okB {
		panic(fmt.Sprintf("expr: values of one JS type are %T and %T", a, b))
	}
	return x == y
}

// sameTypeEquals compares two values of the same JS typeof bucket. Numbers
// compare numerically (so int 5 and float64 5 are equal); booleans/strings/null
// compare directly; lists and objects compare as JSON values (jsonEquals).
func sameTypeEquals(a, b any, t string) bool {
	switch t {
	case "number":
		return toFloat(a) == toFloat(b)
	case "boolean":
		return sameKindEquals[bool](a, b)
	case "string":
		return sameKindEquals[string](a, b)
	case "null":
		return true
	default:
		return jsonEquals(a, b)
	}
}

// jsonEquals is JSON-value structural equality (docs/spec/expressions.md,
// Evaluation): two lists hold equal elements in the same order, two objects the
// same keys with equal values in any key order; other values compare without
// conversion, numbers by value. A list never equals an object.
func jsonEquals(a, b any) bool {
	switch x := a.(type) {
	case []any:
		y, ok := b.([]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for i := range x {
			if !jsonEquals(x[i], y[i]) {
				return false
			}
		}
		return true
	case map[string]any:
		y, ok := b.(map[string]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for key, value := range x {
			other, ok := y[key]
			if !ok || !jsonEquals(value, other) {
				return false
			}
		}
		return true
	case nil:
		return b == nil
	case bool:
		y, ok := b.(bool)
		return ok && x == y
	case string:
		y, ok := b.(string)
		return ok && x == y
	}
	an, aOk := NumberValue(a)
	bn, bOk := NumberValue(b)
	return aOk && bOk && an == bn
}

func jsTypeOf(v any) string {
	switch v.(type) {
	case nil:
		return "null"
	case bool:
		return "boolean"
	case string:
		return "string"
	default:
		if IsNumber(v) {
			return "number"
		}
		return "object"
	}
}

func toFloat(v any) float64 {
	n, _ := NumberValue(v)
	return n
}

// coerceNumber coerces a value to a number for comparison (JS coerceNumber):
// numbers pass through; a string is parseFloat-ed (NaN→0); booleans → 1/0;
// else 0.
func coerceNumber(value any) float64 {
	if n, ok := NumberValue(value); ok {
		return n
	}
	switch v := value.(type) {
	case bool:
		if v {
			return 1
		}
		return 0
	case string:
		if f, ok := parseFloatPrefix(v); ok {
			return f
		}
		return 0
	default:
		return 0
	}
}

// jsNumber is JS Number(value) for equality: numbers pass; a string is numeric
// only when the WHOLE string parses (JS Number('12abc') is NaN); booleans → 1/0.
func jsNumber(value any) (float64, bool) {
	if n, ok := NumberValue(value); ok {
		return n, true
	}
	switch v := value.(type) {
	case bool:
		if v {
			return 1, true
		}
		return 0, true
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, true // JS Number('') === 0
		}
		if f, err := strconv.ParseFloat(trimmed, 64); err == nil {
			return f, true
		}
		return 0, false
	default:
		return 0, false
	}
}

// parseFloatPrefix is parseFloat-style: read an optional sign, digits, fraction,
// exponent prefix; fail when no number leads the string.
func parseFloatPrefix(value string) (float64, bool) {
	s := value
	i := 0
	// Leading whitespace.
	for i < len(s) && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r') {
		i++
	}
	start := i
	if i < len(s) && (s[i] == '+' || s[i] == '-') {
		i++
	}
	digitsBefore := 0
	for i < len(s) && isDigit(s[i]) {
		i++
		digitsBefore++
	}
	digitsAfter := 0
	if i < len(s) && s[i] == '.' {
		i++
		for i < len(s) && isDigit(s[i]) {
			i++
			digitsAfter++
		}
	}
	if digitsBefore == 0 && digitsAfter == 0 {
		return 0, false
	}
	// Exponent.
	if i < len(s) && (s[i] == 'e' || s[i] == 'E') {
		j := i + 1
		if j < len(s) && (s[j] == '+' || s[j] == '-') {
			j++
		}
		expDigits := 0
		for j < len(s) && isDigit(s[j]) {
			j++
			expDigits++
		}
		if expDigits > 0 {
			i = j
		}
	}
	f, err := strconv.ParseFloat(s[start:i], 64)
	if err != nil {
		return 0, false
	}
	return f, true
}

func jsToString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, uintptr, json.Number:
		n, _ := NumberValue(v)
		return jsToString(n)
	case float64:
		if v == 0 {
			return "0"
		}
		if !math.IsInf(v, 0) && !math.IsNaN(v) && v == math.Floor(v) && math.Abs(v) < 1e21 {
			return strconv.FormatFloat(v, 'f', -1, 64)
		}
		return strconv.FormatFloat(v, 'g', -1, 64)
	case float32:
		return jsToString(float64(v))
	default:
		return ""
	}
}
