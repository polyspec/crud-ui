package generator

import (
	"regexp"

	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

func evalCondition(s string, data map[string]any, path []string, rowKeys []int) bool {
	v, e := expr.Evaluate(s, data, path, rowKeys)
	return e == nil && v
}
func conditionMap(o *Object, data map[string]any, path []string, rowKeys []int) any {
	for _, k := range o.Keys() {
		if k != "true" && evalCondition(k, data, path, rowKeys) {
			return read(o, k)
		}
	}
	if o.Has("true") {
		return read(o, "true")
	}
	return nil
}

// evaluateValue evaluates a parsed expression. It is a variable so that a test can inject an
// evaluation failure; expr.EvaluateValue fails only on a parse error, which Parse has excluded.
var evaluateValue = expr.EvaluateValue

// evalShow resolves design.show like the validators resolve a conditional
// parameter in the row context: a condition map selects its value, a ternary its
// branch and a condition expression that parses completely its result; any
// other string is a literal.
// Only a resolved false hides; a missing show, a map that selects nothing and a
// literal string are visible. An evaluation error is returned.
func evalShow(v any, data map[string]any, path []string, rowKeys []int) (bool, error) {
	if v == nil || isAbsent(v) {
		return true, nil
	}
	x, e := resolveParameter(v, data, path, rowKeys)
	if e != nil {
		return false, e
	}
	return x != false, nil
}

// resolveParameter resolves a conditional parameter value. A string that does not parse is literal
// text; the evaluation error of a ternary or a condition expression is returned.
func resolveParameter(v any, data map[string]any, path []string, rowKeys []int) (any, error) {
	if o := object(v); o != nil {
		return conditionMap(o, data, path, rowKeys), nil
	}
	s, ok := v.(string)
	if !ok {
		return v, nil
	}
	if ast, e := expr.Parse(s); e == nil {
		if _, ok := ast.(*expr.TernaryNode); ok {
			return evaluateValue(s, data, path, rowKeys)
		}
	}
	if _, e := expr.Parse(s); e == nil && expr.IsConditionExpression(s) && !ternaryTextRE.MatchString(s) {
		return evaluateValue(s, data, path, rowKeys)
	}
	return s, nil
}

// evalFlag resolves a boolean flag such as a list column's sortable: a
// condition map that selects nothing, and a failed condition, are false.
func evalFlag(v any, data map[string]any, path []string, rowKeys []int) bool {
	if o := object(v); o != nil {
		return truthy(conditionMap(o, data, path, rowKeys))
	}
	if s, ok := v.(string); ok {
		return evalCondition(s, data, path, rowKeys)
	}
	return truthy(v)
}

var ternaryTextRE = regexp.MustCompile(`\?[^:]*:`)

// evalAppearance resolves an appearance setting such as design.class: a
// condition map selects its value, a ternary its branch and a condition
// expression that parses completely its result; any other string is literal text.
// An evaluation error of a ternary or a condition expression is returned.
func evalAppearance(v any, data map[string]any, path []string, rowKeys []int) (string, error) {
	if v == nil || isAbsent(v) {
		return "", nil
	}
	if o := object(v); o != nil {
		x := conditionMap(o, data, path, rowKeys)
		if x == nil || isAbsent(x) {
			return "", nil
		}
		return jsString(x), nil
	}
	s, ok := v.(string)
	if !ok {
		return jsString(v), nil
	}
	if ast, e := expr.Parse(s); e == nil {
		if _, ok := ast.(*expr.TernaryNode); ok {
			x, e := evaluateValue(s, data, path, rowKeys)
			if e != nil {
				return "", e
			}
			if x == nil {
				return "", nil
			}
			return jsString(x), nil
		}
	}
	if _, e := expr.Parse(s); e == nil && expr.IsConditionExpression(s) && !ternaryTextRE.MatchString(s) {
		x, e := evaluateValue(s, data, path, rowKeys)
		if e != nil {
			return "", e
		}
		if x == nil || x == false {
			return "", nil
		}
		return jsString(x), nil
	}
	return s, nil
}

// resolveNode resolves the class and style of a design node.
func resolveNode(v any, data map[string]any, path []string, rowKeys []int) (*Object, error) {
	class, e := evalAppearance(read(v, "class"), data, path, rowKeys)
	if e != nil {
		return nil, e
	}
	style, e := evalAppearance(read(v, "style"), data, path, rowKeys)
	if e != nil {
		return nil, e
	}
	return NewObject("class", class, "style", style), nil
}

// resolveDesign resolves a design declaration; an evaluation error of any part is returned.
func resolveDesign(v any, data map[string]any, path []string, rowKeys []int) (*Object, error) {
	d := NewObject("show", true, "main", NewObject("class", "", "style", ""))
	for _, k := range []string{"label", "wrapper", "group", "prepend"} {
		d.Set(k, NewObject("class", "", "style", ""))
	}
	if object(v) == nil {
		return d, nil
	}
	show, e := evalShow(read(v, "show"), data, path, rowKeys)
	if e != nil {
		return nil, e
	}
	d.Set("show", show)
	mainNode, e := resolveNode(v, data, path, rowKeys)
	if e != nil {
		return nil, e
	}
	d.Set("main", mainNode)
	for _, k := range []string{"label", "wrapper", "group", "prepend"} {
		node, e := resolveNode(read(v, k), data, path, rowKeys)
		if e != nil {
			return nil, e
		}
		d.Set(k, node)
	}
	return d, nil
}
func nodeClass(design *Object, node string) string { return stringAt(read(design, node), "class") }
func nodeStyle(design *Object, node string) string { return stringAt(read(design, node), "style") }
