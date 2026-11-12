// Package text checks input text (docs/spec/input-text.md). Every string and
// object member name in a specification, a composition file and caller data is
// valid UTF-8, the Go form of a sequence of Unicode scalar values. Invalid text
// is rejected before any other check of an operation; it is never replaced and
// never passed on.
package text

import (
	"errors"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// Message is the message of every input text failure.
const Message = "Text must be Unicode scalar values"

// LimitMessage is the message of every value beyond the limits of a value.
const LimitMessage = "Recursive or excessively nested value"

// NestingLimit is the number of levels of arrays and objects a value may nest,
// the value itself included.
const NestingLimit = 512

// NodeLimit is the number of nodes a value may hold: every array, object,
// string, number, boolean and null, the value itself included.
const NodeLimit = 1000000

// Failure is the first failure in a value: invalid text at Path, or, when
// Limit is true, a value beyond its limits.
type Failure struct {
	Path  []string
	Limit bool
}

// Size returns the levels of lists and objects that value nests, value itself
// the first, and the nodes it holds, counted as the value limits count them.
func Size(value any) (levels, nodes int) {
	var visit func(node any, level int)
	visit = func(node any, level int) {
		nodes++
		if _, isString := node.(string); isString {
			return
		}
		_, values, _, container := children(node)
		if !container {
			return
		}
		levels = max(levels, level)
		for _, child := range values {
			visit(child, level+1)
		}
	}
	visit(value, 1)
	return levels, nodes
}

// ValueFailure returns the first failure in value, walked as the tree it
// denotes: list items in index order; for an object, every member name first,
// then the members in code point order of their names, which is the byte order
// of valid UTF-8. Invalid text is located at the path of its string, or of the
// object whose member name is invalid. A value that nests more than
// NestingLimit levels or holds more than NodeLimit nodes, which includes every
// value that contains itself, is beyond its limits where the walk passes them.
// The result is nil when there is no failure.
func ValueFailure(value any) *Failure {
	if !holds(value, 0, &walk{}) {
		return nil
	}
	return first(value, []string{}, 0, &walk{})
}

// walk counts the nodes of one walk. A map, slice or object reached twice,
// through sharing or because it contains itself, is walked at each place, so
// the node count and the nesting limit bound every walk, including one around
// a cycle.
type walk struct {
	nodes int
}

// admit counts a node at depth and returns false when it takes the value
// beyond its limits.
func (w *walk) admit(container bool, depth int) bool {
	w.nodes++
	return w.nodes <= NodeLimit && (!container || depth < NestingLimit)
}

// member is one named child of an object value.
type member struct {
	name  string
	value any
}

// children returns the members of an object value, the items of a list value
// (with a nil name slice) and whether value is either.
func children(value any) (names []string, values []any, object bool, ok bool) {
	switch v := value.(type) {
	case *compose.OMap:
		if v == nil {
			return nil, nil, true, true
		}
		for _, key := range v.Keys() {
			child, _ := v.Get(key)
			names = append(names, key)
			values = append(values, child)
		}
		return names, values, true, true
	case map[string]any:
		for key, child := range v {
			names = append(names, key)
			values = append(values, child)
		}
		return names, values, true, true
	case []any:
		return nil, v, false, true
	}
	reflected := reflect.ValueOf(value)
	switch reflected.Kind() {
	case reflect.Map:
		if reflected.Type().Key().Kind() != reflect.String {
			return nil, nil, false, false
		}
		iterator := reflected.MapRange()
		for iterator.Next() {
			names = append(names, iterator.Key().String())
			values = append(values, iterator.Value().Interface())
		}
		return names, values, true, true
	case reflect.Slice, reflect.Array:
		if reflected.Type().Elem().Kind() == reflect.Uint8 {
			return nil, nil, false, false
		}
		for i := 0; i < reflected.Len(); i++ {
			values = append(values, reflected.Index(i).Interface())
		}
		return nil, values, false, true
	}
	return nil, nil, false, false
}

// holds reports whether value holds a failure: a quick walk in member order
// before the ordered one.
func holds(value any, depth int, w *walk) bool {
	if s, isString := value.(string); isString {
		return !w.admit(false, depth) || !utf8.ValidString(s)
	}
	names, values, _, container := children(value)
	if !w.admit(container, depth) {
		return true
	}
	for _, name := range names {
		if !utf8.ValidString(name) {
			return true
		}
	}
	for _, child := range values {
		if holds(child, depth+1, w) {
			return true
		}
	}
	return false
}

func first(value any, path []string, depth int, w *walk) *Failure {
	if s, isString := value.(string); isString {
		if !w.admit(false, depth) {
			return &Failure{Limit: true}
		}
		if utf8.ValidString(s) {
			return nil
		}
		return &Failure{Path: path}
	}
	names, values, object, container := children(value)
	if !w.admit(container, depth) {
		return &Failure{Limit: true}
	}
	if !object {
		for i, child := range values {
			if found := first(child, append(append([]string{}, path...), strconv.Itoa(i)), depth+1, w); found != nil {
				return found
			}
		}
		return nil
	}
	members := make([]member, len(names))
	for i, name := range names {
		if !utf8.ValidString(name) {
			return &Failure{Path: path}
		}
		members[i] = member{name, values[i]}
	}
	sort.SliceStable(members, func(i, j int) bool { return members[i].name < members[j].name })
	for _, m := range members {
		if found := first(m.value, append(append([]string{}, path...), m.name), depth+1, w); found != nil {
			return found
		}
	}
	return nil
}

// LoadFailure returns the INVALID_TEXT load failure at trace.
func LoadFailure(trace []string) *compose.ComposeLoadError {
	return &compose.ComposeLoadError{Code: compose.InvalidText, Message: Message, Trace: trace}
}

// CheckSpecification checks a specification and then the composition files an
// operation reads. Invalid text is the INVALID_TEXT load failure located at its
// specification path, or at the file name followed by its path in the file; an
// invalid file name is located at the empty path. A value beyond its limits is
// an input failure, whose message naming spec or files is the second result.
func CheckSpecification(spec any, files any) (*compose.ComposeLoadError, string) {
	for _, input := range []Input{{"spec", spec}, {"files", files}} {
		if failure := ValueFailure(input.Value); failure != nil {
			if failure.Limit {
				return nil, LimitMessage + ": " + input.Name
			}
			return LoadFailure(failure.Path), ""
		}
	}
	return nil, ""
}

// Input is one named caller value of an operation.
type Input struct {
	// Name is the documented argument name, such as data or options.basepath.
	Name string
	// Value is the caller value.
	Value any
}

// CheckInputs checks named caller values in order and returns the failure
// message of the first invalid text, which names the value and its path, or of
// the first value beyond its limits, which names the value; the empty string
// when every value passes.
func CheckInputs(inputs ...Input) string {
	for _, input := range inputs {
		if failure := ValueFailure(input.Value); failure != nil {
			if failure.Limit {
				return LimitMessage + ": " + input.Name
			}
			return Message + ": " + strings.Join(append([]string{input.Name}, failure.Path...), ".")
		}
	}
	return ""
}

// checkedLoader checks each document its loader returns.
type checkedLoader struct {
	loader compose.FileLoader
}

// CheckedLoader returns a loader that checks each document it loads, located
// as a composition file.
func CheckedLoader(loader compose.FileLoader) compose.FileLoader {
	return checkedLoader{loader}
}

// Normalize delegates to the wrapped loader.
func (l checkedLoader) Normalize(path, basepath string) string {
	return l.loader.Normalize(path, basepath)
}

// Load returns the wrapped loader's document, the INVALID_TEXT failure of its
// first invalid text, or the input failure of a document beyond its limits,
// named as the files.
func (l checkedLoader) Load(key string) (*compose.OMap, error) {
	doc, err := l.loader.Load(key)
	if err != nil {
		return nil, err
	}
	if failure := ValueFailure(doc); failure != nil {
		if failure.Limit {
			return nil, errors.New(LimitMessage + ": files")
		}
		return nil, LoadFailure(append([]string{key}, failure.Path...))
	}
	return doc, nil
}
