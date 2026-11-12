package validate

// Rule parameter checks (docs/spec/validation-rules.md, Parameter errors).
//
// A parameter outside its rule's definition, and a rule name that is not
// registered, is a load failure located at the field's declaration path (property names without row keys). Parameters are
// checked when the specification loads, after composition and the forbidden-key
// scan, fields in declaration order (a group before its children) and each
// field's rules in declaration order, including every literal a condition map or
// a ternary can select. A value a condition takes from the data is checked when
// it is selected, before the empty-value skip.

import (
	"strconv"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

// parameterError is a rule parameter outside its definition.
type parameterError struct {
	code    compose.ComposeErrorCode
	message string
}

// ruleParameterError returns an INVALID_RULE_PARAMETER error.
func ruleParameterError(message string) *parameterError {
	return &parameterError{code: compose.InvalidRuleParameter, message: message}
}

// loadError returns the load failure of a parameter error at a declaration path.
func (e *parameterError) loadError(declaration []string) *compose.ComposeLoadError {
	return &compose.ComposeLoadError{Code: e.code, Message: e.message, Trace: append([]string{}, declaration...)}
}

// disablesRule reports a resolved parameter that disables its rule.
func disablesRule(param any) bool {
	b, isBool := param.(bool)
	return param == nil || (isBool && !b)
}

// checkParameter checks a resolved parameter of a rule and returns its
// parameter error. Pattern parameters are compiled once into v.patterns.
func (v *Validator) checkParameter(rule string, param any) *parameterError {
	if disablesRule(param) {
		return nil
	}
	switch rule {
	case "minlength", "maxlength":
		return checkLengthLimit(rule, param)
	case "rangelength":
		return checkLengthRange(param)
	case "number", "digits", "min", "max", "range", "step", "mincount", "maxcount":
		return checkNumericParameter(rule, param)
	case "in":
		return checkIn(param)
	case "equalTo", "containedIn", "typeFrom", "minFrom", "maxFrom", "enddate", "notEqual", "unique", "reference":
		return checkReferenceParameter(rule, param)
	case "conditionTree":
		return checkConditionTreeParameter(param)
	case "match", "pattern":
		source, ok := param.(string)
		if !ok {
			return ruleParameterError("Invalid " + rule + " parameter: expected a pattern string")
		}
		if _, done := v.patterns[source]; done {
			return nil
		}
		matcher, perr := compilePattern(source)
		if perr != nil {
			return &parameterError{
				code:    compose.InvalidRulePattern,
				message: "Invalid " + rule + " pattern: " + perr.reason + " at " + strconv.Itoa(perr.offset),
			}
		}
		v.patterns[source] = matcher
	}
	return nil
}

// checkReferenceParameter returns the parameter error of a rule that references a
// field: equalTo, containedIn, typeFrom, minFrom, maxFrom and enddate take a field reference string, notEqual a string,
// number or boolean, unique true or a string, and reference a string.
func checkReferenceParameter(rule string, param any) *parameterError {
	_, isString := param.(string)
	_, isBool := param.(bool)
	switch rule {
	case "equalTo", "containedIn", "typeFrom", "minFrom", "maxFrom", "enddate":
		if !isString {
			return ruleParameterError("Invalid " + rule + " parameter: expected a field reference string")
		}
	case "notEqual":
		if _, isNumber := finiteNumber(param); !isString && !isBool && !isNumber {
			return ruleParameterError("Invalid notEqual parameter: expected a string, number or boolean")
		}
	case "unique":
		if !isString && !isBool {
			return ruleParameterError("Invalid unique parameter: expected true, false or a string")
		}
	case "reference":
		if !isString {
			return ruleParameterError(referenceParameterMessage)
		}
	}
	return nil
}

// checkRuleName returns the UNKNOWN_RULE load failure of a validate or messages
// key that is not a registered rule, located at the field's declaration path.
func checkRuleName(rule string, declaration []string) error {
	if _, ok := getRule(rule); ok {
		return nil
	}
	return &compose.ComposeLoadError{Code: compose.UnknownRule, Message: "Unknown rule: " + rule, Trace: append([]string{}, declaration...)}
}

// checkDeclarations checks the declared rule names and parameters of a properties
// map in declaration order: each rule name with each literal parameter, and each
// literal a condition can select, then the field's messages keys, before the
// fields it contains. Values a condition takes from the data are left for runRule.
func (v *Validator) checkDeclarations(properties *compose.OMap, declaration []string) error {
	for name, field := range fieldDeclarations(properties) {
		path := appendPath(declaration, name)
		// The shape of multiple is checked before the field's group source and rules (schema.md, CUSC-081).
		if multiple, declared := field.Get("multiple"); declared && !isMultipleShape(multiple) {
			return ruleParameterError("Invalid multiple at " + pathToString(path) + ": expected a boolean, only or an object").loadError(path)
		}
		// A group source is checked before the field's rules (validation-rules.md, Parameter errors).
		if message := GroupSourceFailure(field, pathToString(path), v.properties); message != "" {
			return ruleParameterError(message).loadError(path)
		}
		if rules := normalizeValidateSlot(field); rules != nil {
			for _, rule := range rules.Keys() {
				if err := checkRuleName(rule, path); err != nil {
					return err
				}
				param, _ := rules.Get(rule)
				for _, literal := range selectableLiterals(rule, param) {
					if perr := v.checkParameter(rule, literal); perr != nil {
						return perr.loadError(path)
					}
					if target, ok := literal.(string); ok && rule == "reference" && !isReferenceTarget(v.properties, target) {
						return ruleParameterError(referenceParameterMessage).loadError(path)
					}
				}
			}
		}
		if raw, ok := field.Get("messages"); ok {
			if messages, ok := raw.(*compose.OMap); ok && messages != nil {
				for _, rule := range messages.Keys() {
					if err := checkRuleName(rule, path); err != nil {
						return err
					}
				}
			}
		}
		if err := checkKeyedMapReference(field, path, v.properties); err != nil {
			return err
		}
		if children := childProperties(field); fieldType(field) == "group" && children != nil {
			if err := v.checkDeclarations(children, path); err != nil {
				return err
			}
		}
	}
	return nil
}

// selectableLiterals returns the literal parameters a rule value can resolve to:
// the value itself when it is not conditional, every value of a condition map,
// and every literal branch of a ternary, through nested ternaries. Branches that
// take their value from the data, and plain condition expressions, contribute
// nothing.
func selectableLiterals(rule string, param any) []any {
	if !isConditionalRuleValue(rule, param) {
		return []any{param}
	}
	switch value := param.(type) {
	case *compose.OMap:
		literals := make([]any, 0, value.Len())
		for _, key := range value.Keys() {
			selected, _ := value.Get(key)
			literals = append(literals, selected)
		}
		return literals
	case string:
		if node, ok := parseTernary(value); ok {
			return ternaryLiterals(node, nil)
		}
	}
	return nil
}

// ternaryLiterals appends the literal branch values of a ternary node.
func ternaryLiterals(node expr.Node, literals []any) []any {
	switch n := node.(type) {
	case *expr.TernaryNode:
		literals = ternaryLiterals(n.TrueValue, literals)
		return ternaryLiterals(n.FalseValue, literals)
	case *expr.GroupNode:
		return ternaryLiterals(n.Expression, literals)
	case *expr.LiteralNode:
		return append(literals, n.Value)
	}
	return literals
}

// patternFor returns the matcher of a checked pattern parameter.
func (v *Validator) patternFor(source string) *patternMatcher {
	return v.patterns[source]
}

// isMultipleShape reports whether a multiple declaration is a boolean, only or an object (schema.md, CUSC-041).
func isMultipleShape(multiple any) bool {
	switch value := multiple.(type) {
	case bool, *compose.OMap:
		return true
	case string:
		return value == "only"
	}
	return false
}
