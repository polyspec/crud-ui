package validate

import "sort"

// conditionTreeDepth is the deepest level of a condition tree; the root condition
// is level 1 (CUSC-075).
const conditionTreeDepth = 32

// conditionTreeOperators are the operators of a field comparison (CUSC-073).
var conditionTreeOperators = map[string]bool{
	"eq": true, "ne": true, "lt": true, "le": true, "gt": true, "ge": true, "in": true, "has": true,
}

// conditionTreeParameterError is the parameter error of conditionTree (CUVR-068).
const conditionTreeParameterError = "Invalid conditionTree parameter: expected true, false or judge"

// checkConditionTreeParameter returns the parameter error of a conditionTree
// parameter that is neither true nor judge.
func checkConditionTreeParameter(param any) *parameterError {
	if b, isBool := param.(bool); isBool && b {
		return nil
	}
	if s, isString := param.(string); isString && s == "judge" {
		return nil
	}
	return ruleParameterError(conditionTreeParameterError)
}

// ruleConditionTree: the value is a condition tree (docs/spec/schema.md,
// Condition trees); the parameter judge permits judged text. Empty skips.
func ruleConditionTree(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	judge, isText := ruleParam.(string)
	if isConditionTree(value, isText && judge == "judge", 1) {
		return "", false
	}
	return ctx.msg("conditionTree", "Please enter a valid condition."), true
}

// isConditionTree reports whether node, at level, is a condition; judge permits
// judged text. It reads no level below conditionTreeDepth.
func isConditionTree(node any, judge bool, level int) bool {
	members, isObject := choiceObject(node)
	if level > conditionTreeDepth || !isObject {
		return false
	}
	names := make([]string, 0, len(members))
	for name := range members {
		names = append(names, name)
	}
	sort.Strings(names)
	switch {
	case len(names) == 1 && (names[0] == "all" || names[0] == "any"):
		list, isList := members[names[0]].([]any)
		if !isList {
			return false
		}
		for _, item := range list {
			if !isConditionTree(item, judge, level+1) {
				return false
			}
		}
		return true
	case len(names) == 3 && names[0] == "field" && names[1] == "op" && names[2] == "value":
		op, isString := members["op"].(string)
		if !isConditionText(members["field"]) || !isString || !conditionTreeOperators[op] {
			return false
		}
		if op != "in" {
			return isConditionScalar(members["value"])
		}
		list, isList := members["value"].([]any)
		if !isList {
			return false
		}
		for _, item := range list {
			if !isConditionScalar(item) {
				return false
			}
		}
		return true
	case len(names) == 1 && names[0] == "judge":
		return judge && isConditionText(members["judge"])
	}
	return false
}

// isConditionScalar reports a string, a finite number or a boolean.
func isConditionScalar(value any) bool {
	switch value.(type) {
	case string, bool:
		return true
	}
	_, isNumber := finiteNumber(value)
	return isNumber
}

// isConditionText reports a string that is not empty after trimming.
func isConditionText(value any) bool {
	text, isString := value.(string)
	return isString && trimText(text) != ""
}
