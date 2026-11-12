package validate

import (
	"strconv"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
)

// dataLimits bounds the submitted data: its levels and its nodes
// (validation-rules.md, "Data limits").
type dataLimits struct {
	depth, values int
}

// defaultDataLimits are the limits of a form root that declares none (CUVR-083).
var defaultDataLimits = dataLimits{depth: 64, values: 100000}

// badDataLimits is the load failure of a bad dataLimits (CUVR-084).
func badDataLimits() error {
	return &compose.ComposeLoadError{
		Code:    compose.InvalidRuleParameter,
		Message: "Invalid dataLimits parameter: expected depth from 1 to " + strconv.Itoa(text.NestingLimit) + " and values from 1 to " + strconv.Itoa(text.NodeLimit),
		Trace:   []string{},
	}
}

// readDataLimits returns the dataLimits of a form root, a missing member
// taking its default.
func readDataLimits(root *compose.OMap) (dataLimits, error) {
	limits := defaultDataLimits
	declared, ok := root.Get("dataLimits")
	if !ok {
		return limits, nil
	}
	members := map[string]any{}
	switch object := declared.(type) {
	case *compose.OMap:
		if object == nil {
			return limits, badDataLimits()
		}
		for _, key := range object.Keys() {
			members[key], _ = object.Get(key)
		}
	case map[string]any:
		members = object
	default:
		return limits, badDataLimits()
	}
	for key, value := range members {
		bound, maximum := &limits.depth, text.NestingLimit
		switch key {
		case "depth":
		case "values":
			bound, maximum = &limits.values, text.NodeLimit
		default:
			return limits, badDataLimits()
		}
		n, ok := lengthLimit(value)
		if !ok || n < 1 || n > float64(maximum) {
			return limits, badDataLimits()
		}
		*bound = int(n)
	}
	return limits, nil
}

// checkDataLimits returns a *FormInputError for data beyond its limits, its
// levels checked before its nodes (CUVR-082).
func checkDataLimits(data any, limits dataLimits) error {
	levels, nodes := text.Size(data)
	if levels > limits.depth {
		return &FormInputError{Message: "Submitted data exceeds the depth limit of " + strconv.Itoa(limits.depth)}
	}
	if nodes > limits.values {
		return &FormInputError{Message: "Submitted data exceeds the values limit of " + strconv.Itoa(limits.values)}
	}
	return nil
}
