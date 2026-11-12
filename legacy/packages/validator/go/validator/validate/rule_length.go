package validate

// Length rules minlength, maxlength and rangelength (docs/spec/validation-rules.md,
// Values): they count the code points of a scalar's canonical text, untrimmed; an
// array or object value fails. Their parameters are checked by checkLengthLimit
// and checkLengthRange before a rule runs.

import (
	"math"
	"strings"
	"unicode/utf8"
)

// maxLengthLimit is the largest length limit, 2^53 - 1.
const maxLengthLimit = 9007199254740991

// lengthLimit returns a length limit: an integer from 0 to maxLengthLimit.
func lengthLimit(param any) (float64, bool) {
	n, ok := numberValue(param)
	if !ok || math.IsNaN(n) || n < 0 || n > maxLengthLimit || n != math.Trunc(n) {
		return 0, false
	}
	return n, true
}

// lengthRange returns the [minimum, maximum] limits of rangelength.
func lengthRange(param any) (float64, float64, bool) {
	limits, ok := param.([]any)
	if !ok || len(limits) != 2 {
		return 0, 0, false
	}
	lo, okLo := lengthLimit(limits[0])
	hi, okHi := lengthLimit(limits[1])
	if !okLo || !okHi || lo > hi {
		return 0, 0, false
	}
	return lo, hi, true
}

// checkLengthLimit returns the parameter error of a minlength or maxlength limit.
func checkLengthLimit(rule string, param any) *parameterError {
	if _, ok := lengthLimit(param); ok {
		return nil
	}
	return ruleParameterError("Invalid " + rule + " parameter: expected an integer from 0 to 9007199254740991")
}

// checkLengthRange returns the parameter error of rangelength limits.
func checkLengthRange(param any) *parameterError {
	if _, _, ok := lengthRange(param); ok {
		return nil
	}
	return ruleParameterError("Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum")
}

// textLength returns the code-point length of a value's canonical text; false
// when the value has none (an array, an object or a nonfinite number).
func textLength(value any) (float64, bool) {
	text, ok := canonicalText(value)
	if !ok {
		return 0, false
	}
	return float64(utf8.RuneCountInString(text)), true
}

// ruleMinLength fails a value shorter than the limit. Empty values pass.
func ruleMinLength(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	limit, _ := lengthLimit(ruleParam)
	if length, ok := textLength(value); !ok || length < limit {
		m := ctx.msg("minlength", "Please enter at least {0} characters.")
		return strings.ReplaceAll(m, "{0}", CanonicalNumber(limit)), true
	}
	return "", false
}

// ruleMaxLength fails a value longer than the limit. Empty values pass.
func ruleMaxLength(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	limit, _ := lengthLimit(ruleParam)
	if length, ok := textLength(value); !ok || length > limit {
		m := ctx.msg("maxlength", "Please enter no more than {0} characters.")
		return strings.ReplaceAll(m, "{0}", CanonicalNumber(limit)), true
	}
	return "", false
}

// ruleRangeLength fails a value whose length is outside [minimum, maximum].
// Empty values pass.
func ruleRangeLength(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	lo, hi, _ := lengthRange(ruleParam)
	if length, ok := textLength(value); !ok || length < lo || length > hi {
		m := ctx.msg("rangelength", "Please enter a value between {0} and {1} characters.")
		m = strings.ReplaceAll(m, "{0}", CanonicalNumber(lo))
		m = strings.ReplaceAll(m, "{1}", CanonicalNumber(hi))
		return m, true
	}
	return "", false
}
