package generator

import (
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

// Object preserves JSON member order. Arrays use []any and null uses nil.
type Object = compose.OMap

// NewObject creates an ordered object from alternating string keys and values.
func NewObject(pairs ...any) *Object {
	o := compose.NewOMap()
	if len(pairs)%2 != 0 {
		panic("NewObject requires key/value pairs")
	}
	for i := 0; i < len(pairs); i += 2 {
		key, ok := pairs[i].(string)
		if !ok {
			panic("Object keys must be strings")
		}
		o.Set(key, pairs[i+1])
	}
	return o
}

// DecodeJSON preserves object order and rejects malformed or multiple documents.
func DecodeJSON(data []byte) (any, error) {
	if !json.Valid(data) {
		return nil, inputError("Invalid JSON document")
	}
	return compose.DecodeOrdered(data)
}

type absentValue struct{}

var absent any = absentValue{}

func isAbsent(v any) bool { _, ok := v.(absentValue); return ok }
func object(v any) *Object {
	o, ok := v.(*Object)
	if !ok {
		return nil
	}
	return o
}
func read(v any, key string) any {
	if o := object(v); o != nil {
		if x, ok := o.Get(key); ok {
			return x
		}
	}
	return absent
}
func stringAt(v any, key string) string { return scalar(read(v, key)) }
func has(v any, key string) bool        { o := object(v); return o != nil && o.Has(key) }
func list(v any) []any {
	a, ok := v.([]any)
	if !ok {
		return nil
	}
	return a
}

// optionalString returns the string v, or "" when v is absent or null. Any other type is an
// error that names what carries it.
func optionalString(v any, what string) (string, error) {
	if v == nil || isAbsent(v) {
		return "", nil
	}
	s, ok := v.(string)
	if !ok {
		return "", inputError("%s must be a string", what)
	}
	return s, nil
}

// copyObject deep-copies an object. copyValue keeps the dynamic type of a non-nil *Object,
// so the assertion cannot fail for one; a nil object is a broken invariant of the caller.
func copyObject(o *Object) *Object {
	copied := copyValue(o)
	out, ok := copied.(*Object)
	if !ok {
		panic(fmt.Sprintf("copyValue returned %T for an *Object", copied))
	}
	return out
}

// orderedObject returns o in specification member order. OrderMembers keeps the dynamic type of an
// *Object, so the assertion cannot fail for one.
func orderedObject(o *Object) *Object {
	ordered := compose.OrderMembers(o)
	out, ok := ordered.(*Object)
	if !ok {
		panic(fmt.Sprintf("compose.OrderMembers returned %T for an *Object", ordered))
	}
	return out
}

// plainObject returns the lookup map of an object. plainLookup keeps the map type of an
// object, so the assertion cannot fail for one; a nil object is a broken invariant of the caller.
func plainObject(o *Object) map[string]any {
	plain := plainLookup(o)
	lookup, ok := plain.(map[string]any)
	if !ok {
		panic(fmt.Sprintf("plainLookup returned %T for an *Object", plain))
	}
	return lookup
}
func copyValue(v any) any {
	switch x := v.(type) {
	case *Object:
		if x == nil {
			return nil
		}
		o := NewObject()
		for _, k := range x.Keys() {
			a, _ := x.Get(k)
			o.Set(k, copyValue(a))
		}
		return o
	case []*Object:
		out := make([]*Object, len(x))
		for i, v := range x {
			out[i] = copyObject(v)
		}
		return out
	case []any:
		a := make([]any, len(x))
		for i, v := range x {
			a[i] = copyValue(v)
		}
		return a
	default:
		return v
	}
}
func merge(dst *Object, src any) {
	if o := object(src); o != nil {
		for _, k := range o.Keys() {
			v, _ := o.Get(k)
			dst.Set(k, v)
		}
	}
}
func scalar(v any) string {
	if v == nil || isAbsent(v) {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	case bool:
		if x {
			return "1"
		}
		return ""
	case *Object, []any:
		return ""
	case float64:
		return numberString(x)
	case float32:
		return numberString(float64(x))
	default:
		return fmt.Sprint(x)
	}
}
func jsString(v any) string {
	if isAbsent(v) {
		return "undefined"
	}
	if v == nil {
		return "null"
	}
	switch x := v.(type) {
	case bool:
		if x {
			return "true"
		}
		return "false"
	case *Object:
		return "[object Object]"
	case []any:
		a := []string{}
		for _, e := range x {
			if e == nil || isAbsent(e) {
				a = append(a, "")
			} else {
				a = append(a, jsString(e))
			}
		}
		return strings.Join(a, ",")
	default:
		return scalar(v)
	}
}
func truthy(v any) bool {
	if v == nil || isAbsent(v) {
		return false
	}
	switch x := v.(type) {
	case bool:
		return x
	case string:
		return x != ""
	case float64:
		return x != 0 && !math.IsNaN(x)
	case int:
		return x != 0
	default:
		if n, ok := asNumber(v); ok {
			return n != 0 && !math.IsNaN(n)
		}
		return true
	}
}
func defaultString(value, def any) string {
	if isAbsent(value) && def != nil && !isAbsent(def) {
		if _, array := def.([]any); !array {
			return scalar(def)
		}
	}
	return scalar(value)
}

// asNumber is the double value of a number of any Go numeric type or json.Number.
func asNumber(v any) (float64, bool) {
	return expr.NumberValue(v)
}
func keys(v any) []string {
	if o := object(v); o != nil {
		return o.Keys()
	}
	if a, ok := v.([]any); ok {
		out := make([]string, len(a))
		for i := range a {
			out[i] = strconv.Itoa(i)
		}
		return out
	}
	return nil
}
func item(v any, k string) any {
	if o := object(v); o != nil {
		return read(o, k)
	}
	if a, ok := v.([]any); ok {
		n, e := strconv.Atoi(k)
		if e == nil && n >= 0 && n < len(a) {
			return a[n]
		}
	}
	return absent
}

// translate resolves content: a string is itself; a language map yields the first non-empty
// string entry for the language, en, ko and then its first key; any other value is empty.
func translate(v any, language string) string {
	if s, ok := v.(string); ok {
		return s
	}
	if o := object(v); o != nil {
		keys := []string{language, "en", "ko"}
		if ks := o.Keys(); len(ks) > 0 {
			keys = append(keys, ks[0])
		}
		for _, k := range keys {
			if s, ok := read(o, k).(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}
func parsePath(path string) []string {
	return strings.FieldsFunc(path, func(r rune) bool { return r == '.' || r == '[' || r == ']' })
}
func getPath(v any, path string) any {
	for _, s := range parsePath(path) {
		v = item(v, s)
		if isAbsent(v) {
			return v
		}
	}
	return v
}

func bracketName(path, prefix string) string {
	segs := parsePath(path)
	if prefix != "" {
		segs = append([]string{prefix}, segs...)
	}
	if len(segs) == 0 {
		if prefix != "" {
			return prefix + "[]"
		}
		return ""
	}
	return segs[0] + func() string {
		var b strings.Builder
		for _, s := range segs[1:] {
			b.WriteString("[" + s + "]")
		}
		return b.String()
	}()
}
func containsInt(a []int, n int) bool {
	for _, i := range a {
		if i == n {
			return true
		}
	}
	return false
}

// splitRowSuffix splits a path into the path without its trailing "[]", that suffix and the segments
// of the path without it.
func splitRowSuffix(path string) (string, string, []string) {
	suffix := ""
	if strings.HasSuffix(path, "[]") {
		suffix = "[]"
		path = strings.TrimSuffix(path, "[]")
	}
	return path, suffix, parsePath(path)
}
func leafName(path string, rows []int) string {
	path, suffix, s := splitRowSuffix(path)
	if len(s) == 0 {
		return path + suffix
	}
	n := len(s) - 1
	if containsInt(rows, n) && n > 0 {
		return s[n-1] + "[]"
	}
	return s[n] + suffix
}
func ruleName(path string, rows []int) string {
	path, suffix, s := splitRowSuffix(path)
	if len(s) == 0 {
		return path + suffix
	}
	out := s[0]
	for i, v := range s[1:] {
		if containsInt(rows, i+1) {
			out += "[]"
		} else {
			out += "[" + v + "]"
		}
	}
	return out + suffix
}
func uriComponent(s string) string {
	return strings.NewReplacer("+", "%20", "%21", "!", "%27", "'", "%28", "(", "%29", ")", "%2A", "*").Replace(url.QueryEscape(s))
}
func controlID(prefix, path string) string { return uriComponent(prefix) + ":" + uriComponent(path) }
func joinClass(parts ...string) string {
	return strings.Join(strings.Fields(strings.Join(parts, " ")), " ")
}
func styleString(source string) string {
	parts := []string{}
	for _, d := range parseStyle(source) {
		parts = append(parts, d.property+": "+d.value)
	}
	return strings.Join(parts, "; ")
}
func compactStyle(source string) string {
	values := NewObject()
	for _, d := range parseStyle(source) {
		values.Set(d.property, d.value)
	}
	parts := []string{}
	for _, k := range values.Keys() {
		parts = append(parts, k+":"+stringAt(values, k))
	}
	return strings.Join(parts, ";")
}
func plainLookup(v any) any {
	switch x := v.(type) {
	case *Object:
		m := map[string]any{}
		for _, k := range x.Keys() {
			a, _ := x.Get(k)
			m[k] = plainLookup(a)
		}
		return m
	case []any:
		a := make([]any, len(x))
		for i, v := range x {
			a[i] = plainLookup(v)
		}
		return a
	default:
		return v
	}
}

// checkOrderedValue rejects values whose object member order is unavailable.
// Every caller checks the value's text first, whose walk fails a value that
// contains itself or passes the value limits (docs/spec/input-text.md).
func checkOrderedValue(value any) error {
	switch v := value.(type) {
	case nil, string, bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return nil
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return inputError("Form numbers must be finite")
		}
		return nil
	case float32:
		if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) {
			return inputError("Form numbers must be finite")
		}
		return nil
	case *Object:
		if v == nil {
			return nil
		}
		for _, k := range v.Keys() {
			child, _ := v.Get(k)
			if e := checkOrderedValue(child); e != nil {
				return e
			}
		}
		return nil
	case []any:
		for _, child := range v {
			if e := checkOrderedValue(child); e != nil {
				return e
			}
		}
		return nil
	default:
		return inputError("Unsupported form value %T; objects must preserve member order", value)
	}
}
