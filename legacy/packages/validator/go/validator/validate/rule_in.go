package validate

// Membership rule in (docs/spec/validation-rules.md, Values).
//
// Members come from a list (each element as is), a choice list (the value of each
// choice, inside groups included), a comma-separated string (split at U+002C, each item trimmed) or a map
// (its keys); list elements and map keys are read as written. A choice list is
// checked by the choice list rules before its values are checked as members. A value matches a member when
// their canonical texts are the same code points, or when both are numeric with
// equal values.

import (
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// member is one membership value: its canonical text and, when it is numeric,
// its value.
type member struct {
	text    string
	number  float64
	numeric bool
}

// newMember builds the member of a scalar value as written (a string is numeric
// only when it is numeric text without surrounding whitespace); false when the
// value is not a string, a finite number or a boolean.
func newMember(value any) (member, bool) {
	text, ok := canonicalText(value)
	if !ok {
		return member{}, false
	}
	m := member{text: text}
	if s, ok := value.(string); ok {
		m.number, m.numeric = numericText(s)
	} else {
		m.number, m.numeric = finiteNumber(value)
	}
	return m, true
}

// inMembers returns the members of an in parameter, or its parameter error.
func inMembers(param any) ([]member, *parameterError) {
	var raw []any
	switch p := param.(type) {
	case []any:
		raw = p
		if isChoiceList(p) {
			values, ok := choiceValues(p)
			if !ok {
				return nil, ruleParameterError("Invalid in parameter: expected value and label pairs with distinct string or number values")
			}
			raw = values
		}
	case string:
		for _, item := range strings.Split(p, ",") {
			raw = append(raw, trimText(item))
		}
	case *compose.OMap:
		for _, key := range p.Keys() {
			raw = append(raw, key)
		}
	case map[string]any:
		for _, key := range sortedKeys(p) {
			raw = append(raw, key)
		}
	default:
		return nil, ruleParameterError("Invalid in parameter: expected a list, a comma-separated string or a map")
	}
	members := make([]member, 0, len(raw))
	for _, value := range raw {
		m, ok := newMember(value)
		if !ok {
			return nil, ruleParameterError("Invalid in parameter: members must be strings, numbers or booleans")
		}
		if trimText(m.text) == "" {
			return nil, ruleParameterError("Invalid in parameter: members must not be empty")
		}
		members = append(members, m)
	}
	return members, nil
}

// checkIn returns the parameter error of an in parameter.
func checkIn(param any) *parameterError {
	_, err := inMembers(param)
	return err
}

// inMatches reports whether a value is a member. A string value is trimmed; an
// array value matches when every element matches, where an empty element
// (including an empty array or object) passes as an empty value does and any
// other array or object element fails, having no canonical text.
func inMatches(value any, members []member) bool {
	if elements, ok := value.([]any); ok {
		for _, element := range elements {
			if !isEmpty(element) && !scalarMatches(element, members) {
				return false
			}
		}
		return true
	}
	return scalarMatches(value, members)
}

// scalarMatches reports whether a scalar value is a member; a value without
// canonical text is not.
func scalarMatches(value any, members []member) bool {
	if s, ok := value.(string); ok {
		value = trimText(s)
	}
	candidate, ok := newMember(value)
	if !ok {
		return false
	}
	for _, m := range members {
		if candidate.text == m.text || (candidate.numeric && m.numeric && candidate.number == m.number) {
			return true
		}
	}
	return false
}

// ruleIn fails a value that is not a member. Empty values pass.
func ruleIn(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	members, _ := inMembers(ruleParam)
	if inMatches(value, members) {
		return "", false
	}
	return ctx.msg("in", "Please select a valid option."), true
}

// choiceObject returns the members of a choice list element: an ordered or plain object.
func choiceObject(item any) (map[string]any, bool) {
	switch o := item.(type) {
	case *compose.OMap:
		out := map[string]any{}
		for _, key := range o.Keys() {
			out[key], _ = o.Get(key)
		}
		return out, true
	case map[string]any:
		return o, true
	}
	return nil, false
}

// isChoiceList reports whether a list is a choice list (docs/spec/schema.md, Choice
// lists and Choice groups): one of its elements is an object that has a value or a
// choices member.
func isChoiceList(list []any) bool {
	for _, item := range list {
		if o, ok := choiceObject(item); ok {
			_, hasValue := o["value"]
			_, hasChoices := o["choices"]
			if hasValue || hasChoices {
				return true
			}
		}
	}
	return false
}

// choiceValues returns the values of a choice list in written order, the values of each
// group in place of the group, or false when a choice has another member, lacks value or
// label, has a value that is not a string or a finite number, or repeats the canonical
// text of an earlier value, or when a group has another member, lacks label or has no
// list of one or more choices.
func choiceValues(list []any) ([]any, bool) {
	values := make([]any, 0, len(list))
	seen := map[string]bool{}
	add := func(item any) bool {
		o, ok := choiceObject(item)
		if !ok || len(o) != 2 {
			return false
		}
		value, hasValue := o["value"]
		if _, hasLabel := o["label"]; !hasValue || !hasLabel {
			return false
		}
		if _, isString := value.(string); !isString {
			if _, isBool := value.(bool); isBool {
				return false
			}
			if _, finite := finiteNumber(value); !finite {
				return false
			}
		}
		text, _ := canonicalText(value)
		if seen[text] {
			return false
		}
		seen[text] = true
		values = append(values, value)
		return true
	}
	for _, item := range list {
		if o, ok := choiceObject(item); ok {
			if choices, isGroup := o["choices"]; isGroup {
				_, hasLabel := o["label"]
				group, isList := choices.([]any)
				if len(o) != 2 || !hasLabel || !isList || len(group) == 0 {
					return nil, false
				}
				for _, choice := range group {
					if !add(choice) {
						return nil, false
					}
				}
				continue
			}
		}
		if !add(item) {
			return nil, false
		}
	}
	return values, true
}
