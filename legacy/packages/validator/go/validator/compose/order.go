package compose

import (
	"sort"
	"strconv"
)

// OrderMembers returns a copy of a specification value in specification member
// order, the own-property order of a JavaScript object: member names that are
// array indexes come first in ascending numeric order, then all other names in
// insertion order. Objects are reordered at every depth; arrays stay arrays with
// their elements ordered the same way; scalars are returned unchanged. Record
// data keeps insertion order and is never passed here.
func OrderMembers(value any) any {
	switch v := value.(type) {
	case *OMap:
		if v == nil {
			return v
		}
		keys := v.Keys()
		sort.SliceStable(keys, func(i, j int) bool {
			a, aIndex := arrayIndex(keys[i])
			b, bIndex := arrayIndex(keys[j])
			if aIndex && bIndex {
				return a < b
			}
			return aIndex && !bIndex
		})
		out := NewOMap()
		for _, k := range keys {
			out.Set(k, OrderMembers(v.values[k]))
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, e := range v {
			out[i] = OrderMembers(e)
		}
		return out
	default:
		return value
	}
}

// orderedOMap returns m in specification member order as an *OMap. OrderMembers keeps
// the dynamic type of an *OMap, so the assertion cannot fail for an *OMap input.
func orderedOMap(m *OMap) *OMap {
	out, ok := OrderMembers(m).(*OMap)
	if !ok {
		panic("compose: OrderMembers did not return an *OMap for an *OMap input")
	}
	return out
}

// arrayIndex reports whether name is an array index, a canonical decimal integer
// from 0 to 4294967294 without leading zeros, and returns its numeric value.
func arrayIndex(name string) (uint64, bool) {
	if name == "" || (len(name) > 1 && name[0] == '0') {
		return 0, false
	}
	for i := 0; i < len(name); i++ {
		if name[i] < '0' || name[i] > '9' {
			return 0, false
		}
	}
	n, err := strconv.ParseUint(name, 10, 32)
	if err != nil || n == 4294967295 {
		return 0, false
	}
	return n, true
}
