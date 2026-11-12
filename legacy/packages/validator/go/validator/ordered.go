package validator

import (
	"bytes"
	"encoding/json"
	"fmt"
)

// marshalOrdered emits the members of values as a JSON object in the order of keys.
func marshalOrdered[V any](keys []string, values map[string]V) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, key := range keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		name, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(values[key])
		if err != nil {
			return nil, err
		}
		buf.Write(name)
		buf.WriteByte(':')
		buf.Write(value)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// decodeOrdered reads the members of a JSON object in declaration order: keys holds each
// key once, at the place of its first occurrence, and values holds the last value of
// each key decoded into a V. A value that is not an object fails with the error message.
func decodeOrdered[V any](data []byte, message string) ([]string, map[string]V, error) {
	if trimmed := bytes.TrimSpace(data); len(trimmed) == 0 || trimmed[0] != '{' {
		return nil, nil, fmt.Errorf("model: %s", message)
	}
	names, raws, err := objectMembers(data)
	if err != nil {
		return nil, nil, err
	}
	var keys []string
	values := make(map[string]V, len(names))
	for i, key := range names {
		var value V
		if err := json.Unmarshal(raws[i], &value); err != nil {
			return nil, nil, err
		}
		if _, dup := values[key]; !dup {
			keys = append(keys, key)
		}
		values[key] = value
	}
	return keys, values, nil
}

// shaped is a polymorphic slot, which is the false shape, the true shape or a body.
type shaped[T any] interface {
	*T
	shape() (cancel, bare bool)
}

// shapeLiteral is the JSON literal of an absent slot (null), of the false shape (false) or
// of the true shape (true); ok is false for a slot with a body.
func shapeLiteral[T any, P shaped[T]](slot P) (literal []byte, ok bool) {
	if slot == nil {
		return []byte("null"), true
	}
	cancel, bare := slot.shape()
	switch {
	case cancel:
		return []byte("false"), true
	case bare:
		return []byte("true"), true
	}
	return nil, false
}
