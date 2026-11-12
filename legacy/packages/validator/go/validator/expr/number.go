package expr

import "encoding/json"

// NumberValue returns the double value of a number, whatever Go numeric type
// carries it: every signed and unsigned integer width, both float widths and a
// json.Number. An integer converts to the nearest double. A json.Number whose
// text does not read as a double is not a number.
func NumberValue(value any) (float64, bool) {
	switch n := value.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int8:
		return float64(n), true
	case int16:
		return float64(n), true
	case int32:
		return float64(n), true
	case int64:
		return float64(n), true
	case uint:
		return float64(n), true
	case uint8:
		return float64(n), true
	case uint16:
		return float64(n), true
	case uint32:
		return float64(n), true
	case uint64:
		return float64(n), true
	case uintptr:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

// IsNumber reports whether a value is carried by a Go numeric type.
func IsNumber(value any) bool {
	_, ok := NumberValue(value)
	return ok
}
