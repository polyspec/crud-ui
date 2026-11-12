package generator

import (
	"fmt"
	"slices"
)

// choiceListExpected is the expected-value text of a choice list declaration failure.
const choiceListExpected = "value and label pairs with distinct string or number values"

// choicePair is one choice of a choice list: the canonical text of its value and its label.
type choicePair struct {
	value string
	label any
}

// isChoiceList reports whether items is a choice list: an array with an object element that
// has a value or a choices member.
func isChoiceList(items any) bool {
	a, ok := items.([]any)
	if !ok {
		return false
	}
	for _, item := range a {
		if has(item, "value") || has(item, "choices") {
			return true
		}
	}
	return false
}

// isChoiceGroup reports whether a choice list element is a group: an object with a choices member.
func isChoiceGroup(item any) bool {
	return has(item, "choices")
}

// appearanceMembers are the members a choice of a choice or multichoice field may declare
// besides value and label (docs/spec/schema.md, Choice appearance).
var appearanceMembers = []string{"class", "style", "attributes"}

// choicePairs returns the pairs of a choice list in list order, the choices of each group in place
// of the group, or false when an element has another member (an appearance member is accepted
// with appearance), lacks value or label, has a value that is not a string or a finite number, or
// repeats the canonical text of an earlier value, or when the list has a group without groups or a
// group that is not a label and a non-empty list of choices without appearance members
// (docs/spec/schema.md, Choice groups).
func choicePairs(items any, appearance, groups bool) ([]choicePair, bool) {
	a, isArray := items.([]any)
	if !isArray {
		return nil, false
	}
	pairs := make([]choicePair, 0, len(a))
	seen := map[string]bool{}
	add := func(item any, members []string) bool {
		o := object(item)
		if o == nil || !o.Has("value") || !o.Has("label") {
			return false
		}
		for _, key := range o.Keys() {
			if key != "value" && key != "label" && !slices.Contains(members, key) {
				return false
			}
		}
		value := read(o, "value")
		var text string
		if s, ok := value.(string); ok {
			text = s
		} else if _, isBool := value.(bool); isBool {
			return false
		} else if n, ok := asNumber(value); ok {
			text = numberString(n)
		} else {
			return false
		}
		if seen[text] {
			return false
		}
		seen[text] = true
		pairs = append(pairs, choicePair{text, read(o, "label")})
		return true
	}
	members := []string{}
	if appearance {
		members = appearanceMembers
	}
	for _, item := range a {
		if groups && isChoiceGroup(item) {
			group := object(item)
			choices, ok := read(group, "choices").([]any)
			if group.Len() != 2 || !group.Has("label") || !ok || len(choices) == 0 {
				return nil, false
			}
			for _, choice := range choices {
				if !add(choice, nil) {
					return nil, false
				}
			}
		} else if !add(item, members) {
			return nil, false
		}
	}
	return pairs, true
}

// choiceGroup is the group of a choice: its position in the choice list and its declared label.
type choiceGroup struct {
	index int
	label any
}

// choiceGroups returns the group of each pair of a checked choice list in the order of
// choicePairs, nil for a choice outside groups.
func choiceGroups(items any) []*choiceGroup {
	out := []*choiceGroup{}
	for index, item := range list(items) {
		if isChoiceGroup(item) {
			for range list(read(item, "choices")) {
				out = append(out, &choiceGroup{index, read(item, "label")})
			}
		} else {
			out = append(out, nil)
		}
	}
	return out
}

// choiceLabel returns the label of the pair whose value has the given canonical text.
func choiceLabel(items any, text string) (any, bool) {
	pairs, _ := choicePairs(items, false, false)
	for _, pair := range pairs {
		if pair.value == text {
			return pair.label, true
		}
	}
	return nil, false
}

// checkChoiceAppearance rejects the appearance of a valid choice list whose class or style is not
// a string or whose attributes break the declared attribute rules, choice by choice in list order.
func checkChoiceAppearance(items any, path string) error {
	for index, item := range list(items) {
		choice := object(item)
		for _, member := range []string{"class", "style"} {
			if _, ok := read(choice, member).(string); choice.Has(member) && !ok {
				return inputError("Invalid items.%d.%s at %s: expected a string", index, member, path)
			}
		}
		if choice.Has("attributes") {
			if e := checkDeclaredAttributes(read(choice, "attributes"), fmt.Sprintf("items.%d.attributes", index), path); e != nil {
				return e
			}
		}
	}
	return nil
}

// choiceAppearance adds the appearance a checked choice declares to its option model: the label
// class (className), the normalized label style (style) and the input attributes (attributes),
// each only when declared. checkChoiceAppearance has already rejected a class or style that is not
// a string, so a non-string value is never read here.
func choiceAppearance(option *Object, choice *Object) {
	if class, ok := read(choice, "class").(string); ok && class != "" {
		option.Set("className", class)
	}
	if style, ok := read(choice, "style").(string); ok && styleString(style) != "" {
		option.Set("style", styleString(style))
	}
	if attributes := object(read(choice, "attributes")); attributes != nil && attributes.Len() > 0 {
		option.Set("attributes", copyValue(attributes))
	}
}
