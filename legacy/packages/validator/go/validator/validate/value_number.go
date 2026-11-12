package validate

// Numbers (docs/spec/validation-rules.md, Values, Numbers): numeric values,
// exact step multiples, digit text and collection counts.

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"regexp"
	"strconv"
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

// numberValue returns the double value of a number, whatever Go numeric type
// carries it; an integer converts to the nearest double.
func numberValue(value any) (float64, bool) {
	return expr.NumberValue(value)
}

// finiteNumber returns the value of a finite number.
func finiteNumber(value any) (float64, bool) {
	n, ok := numberValue(value)
	if !ok || math.IsInf(n, 0) || math.IsNaN(n) {
		return 0, false
	}
	return n, true
}

// numericTextPattern is the HTML valid floating-point number.
var numericTextPattern = regexp.MustCompile(`^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$`)

// numericText returns the value of numeric text: the nearest double of the
// text, which is not numeric when that value overflows. Underflow reads as 0.
func numericText(text string) (float64, bool) {
	if !numericTextPattern.MatchString(text) {
		return 0, false
	}
	n, err := strconv.ParseFloat(text, 64)
	if err != nil && !(errors.Is(err, strconv.ErrRange) && !math.IsInf(n, 0)) {
		return 0, false
	}
	if math.IsInf(n, 0) || math.IsNaN(n) {
		return 0, false
	}
	return n, true
}

// numeric returns the value of a numeric value: a finite number, or a string
// that after trimming is numeric text. Booleans, null, arrays and objects are
// not numeric.
func numeric(value any) (float64, bool) {
	if s, ok := value.(string); ok {
		return numericText(trimText(s))
	}
	return finiteNumber(value)
}

// decimal reads the canonical text of a finite double as significand ×
// 10^exponent, with a nonnegative significand.
func decimal(n float64) (*big.Int, int) {
	mantissa, exponent, _ := strings.Cut(strconv.FormatFloat(math.Abs(n), 'e', -1, 64), "e")
	whole, fraction, _ := strings.Cut(mantissa, ".")
	// FormatFloat with 'e' writes a signed decimal exponent, so Atoi cannot fail.
	e, err := strconv.Atoi(exponent)
	if err != nil {
		panic(fmt.Sprintf("validate: exponent %q of FormatFloat: %v", exponent, err))
	}
	significand, _ := new(big.Int).SetString(whole+fraction, 10)
	return significand, e - len(fraction)
}

// isStepMultiple reports whether value is an integer multiple of a positive
// step, deciding exactly on the decimal numbers their canonical texts write.
func isStepMultiple(value, step float64) bool {
	if value == 0 {
		return true
	}
	a, p := decimal(value)
	b, q := decimal(step)
	if b.Sign() == 0 {
		return false
	}
	ten := big.NewInt(10)
	if p >= q {
		a.Mul(a, new(big.Int).Exp(ten, big.NewInt(int64(p-q)), nil))
	} else {
		b.Mul(b, new(big.Int).Exp(ten, big.NewInt(int64(q-p)), nil))
	}
	return new(big.Int).Rem(a, b).Sign() == 0
}

// asciiDigitsPattern is a nonempty run of ASCII digits.
var asciiDigitsPattern = regexp.MustCompile(`^[0-9]+$`)

// isDigits reports a string whose trimmed text, or a number whose canonical
// text, consists only of ASCII digits.
func isDigits(value any) bool {
	var text string
	switch v := value.(type) {
	case string:
		text = trimText(v)
	case bool:
		return false
	default:
		n, ok := finiteNumber(value)
		if !ok {
			return false
		}
		text = CanonicalNumber(n)
	}
	return asciiDigitsPattern.MatchString(text)
}

// countOf returns the collection count of a value: an array's elements, an
// object's keys, 0 for a missing value, null and a blank string, and 1 for any
// other scalar.
func countOf(value any) int {
	switch v := value.(type) {
	case []any:
		return len(v)
	case map[string]any:
		return len(v)
	case nil:
		return 0
	case string:
		if trimText(v) == "" {
			return 0
		}
	}
	return 1
}

// numericBound returns a min or max parameter: a finite number.
func numericBound(param any) (float64, bool) {
	return finiteNumber(param)
}

// numericRange returns the [minimum, maximum] parameter of range.
func numericRange(param any) (float64, float64, bool) {
	bounds, ok := param.([]any)
	if !ok || len(bounds) != 2 {
		return 0, 0, false
	}
	lo, okLo := finiteNumber(bounds[0])
	hi, okHi := finiteNumber(bounds[1])
	if !okLo || !okHi || lo > hi {
		return 0, 0, false
	}
	return lo, hi, true
}

// stepSize returns a step parameter: a finite number above 0.
func stepSize(param any) (float64, bool) {
	n, ok := finiteNumber(param)
	if !ok || n <= 0 {
		return 0, false
	}
	return n, true
}

// checkNumericParameter returns the parameter error of a number, digits, min,
// max, range, step, mincount or maxcount parameter.
func checkNumericParameter(rule string, param any) *parameterError {
	switch rule {
	case "number", "digits":
		if _, ok := param.(bool); !ok {
			return ruleParameterError("Invalid " + rule + " parameter: expected true or false")
		}
	case "min", "max":
		if _, ok := numericBound(param); !ok {
			return ruleParameterError("Invalid " + rule + " parameter: expected a finite number")
		}
	case "range":
		if _, _, ok := numericRange(param); !ok {
			return ruleParameterError("Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum")
		}
	case "step":
		if _, ok := stepSize(param); !ok {
			return ruleParameterError("Invalid step parameter: expected a finite number above 0")
		}
	case "mincount", "maxcount":
		return checkLengthLimit(rule, param)
	}
	return nil
}

// withParameters replaces every {0} and {1} of a message with the canonical
// texts of the parameters.
func withParameters(message string, params ...float64) string {
	for i, param := range params {
		message = strings.ReplaceAll(message, "{"+strconv.Itoa(i)+"}", CanonicalNumber(param))
	}
	return message
}

// NumberRange returns the minimum and maximum of a literal range parameter:
// two finite numbers with the minimum not above the maximum.
func NumberRange(param any) (float64, float64, bool) {
	return numericRange(param)
}

// StepSize returns a literal step parameter: a finite number above 0.
func StepSize(param any) (float64, bool) {
	return stepSize(param)
}

// IsStepMultiple reports whether value is an integer multiple of a positive
// step counted from 0, decided exactly as the step rule decides it.
func IsStepMultiple(value, step float64) bool {
	return isStepMultiple(value, step)
}
