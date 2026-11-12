package compose

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// OMap is an insertion-order-preserving string map — the Go stand-in for a JS
// object. Declaration order is LOAD-BEARING in composition (a key declared after
// $ref overrides the inherited base; a key before it is overridden by it). Go's native map randomizes iteration, and
// encoding/json drops object key order, so the engine carries order explicitly
// in OMap and decodes JSON through it.
//
// The compose engine operates only on OMap / []any / scalars — the same value
// universe the JS engine sees (object / array / primitive). Every node that is a
// JS "plain object" is an *OMap here.
type OMap struct {
	keys   []string
	values map[string]any
}

// NewOMap returns an empty ordered map.
func NewOMap() *OMap {
	return &OMap{values: map[string]any{}}
}

// Keys returns the keys in insertion order (a copy; mutating it is harmless).
func (m *OMap) Keys() []string {
	out := make([]string, len(m.keys))
	copy(out, m.keys)
	return out
}

// Len returns the number of entries.
func (m *OMap) Len() int { return len(m.keys) }

// Has reports whether key is present.
func (m *OMap) Has(key string) bool {
	_, ok := m.values[key]
	return ok
}

// Get returns the value for key and whether it was present.
func (m *OMap) Get(key string) (any, bool) {
	v, ok := m.values[key]
	return v, ok
}

// Set inserts or updates key. A new key appends to the order; an existing key
// keeps its position (matching JS object assignment semantics).
func (m *OMap) Set(key string, value any) {
	if m.values == nil {
		m.values = map[string]any{}
	}
	if _, ok := m.values[key]; !ok {
		m.keys = append(m.keys, key)
	}
	m.values[key] = value
}

// Delete removes key (and its position). A no-op if absent.
func (m *OMap) Delete(key string) {
	if _, ok := m.values[key]; !ok {
		return
	}
	delete(m.values, key)
	for i, k := range m.keys {
		if k == key {
			m.keys = append(m.keys[:i:i], m.keys[i+1:]...)
			break
		}
	}
}

// Clone makes a shallow copy (new key slice + value map; values shared). The
// engine never mutates shared value subtrees in place — it rebuilds (mirrors the
// JS spread `{ ...node }`).
func (m *OMap) Clone() *OMap {
	out := &OMap{
		keys:   make([]string, len(m.keys)),
		values: make(map[string]any, len(m.values)),
	}
	copy(out.keys, m.keys)
	for k, v := range m.values {
		out.values[k] = v
	}
	return out
}

// MarshalJSON emits the entries in insertion order so a round trip is stable.
func (m *OMap) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, k := range m.keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		kb, err := json.Marshal(k)
		if err != nil {
			return nil, err
		}
		buf.Write(kb)
		buf.WriteByte(':')
		vb, err := json.Marshal(m.values[k])
		if err != nil {
			return nil, err
		}
		buf.Write(vb)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// DecodeOrdered parses a JSON document into the engine value universe (*OMap /
// []any / scalars), preserving object declaration order. It is the exported entry
// the model validate pass uses to load a spec into the compose value model before
// composing it. Same semantics as the internal decodeOrdered.
//
// Strings and member names keep their text exactly: an unpaired surrogate escape
// becomes the three-byte encoding of that surrogate and a byte that is not UTF-8
// is kept, so both remain text that is not valid UTF-8 and the input text check
// rejects them (docs/spec/input-text.md). Nothing is replaced with U+FFFD.
func DecodeOrdered(data []byte) (any, error) {
	return decodeOrdered(data)
}

// RawMember is one object member of a JSON document: its name, kept exactly as
// DecodeOrdered keeps text, and the raw JSON text of its value.
type RawMember struct {
	Name  string
	Value []byte
}

// DecodeRawMembers splits a JSON object document into its members in document
// order without decoding the values. A document that is not one JSON object is
// an error.
func DecodeRawMembers(data []byte) ([]RawMember, error) {
	if !json.Valid(data) {
		return nil, fmt.Errorf("Invalid JSON document")
	}
	p := &textParser{data: data}
	p.space()
	if p.data[p.pos] != '{' {
		return nil, fmt.Errorf("Expected a JSON object")
	}
	p.pos++
	members := []RawMember{}
	for {
		p.space()
		if p.data[p.pos] == '}' {
			return members, nil
		}
		if p.data[p.pos] == ',' {
			p.pos++
			p.space()
		}
		name := p.text()
		p.space()
		p.pos++ // ':'
		p.space()
		begin := p.pos
		if _, err := p.value(); err != nil {
			return nil, err
		}
		members = append(members, RawMember{Name: name, Value: data[begin:p.pos]})
	}
}

// decodeOrdered parses a JSON document, decoding every object as an *OMap (order
// preserved), arrays as []any, and primitives as their natural Go types
// (json.Number off; numbers are float64 — JSON loses the int/float distinction,
// matching the JS side). This is how declaration order survives into the engine.
// The grammar is checked by encoding/json first; the values are then read by a
// parser that keeps text as written.
func decodeOrdered(data []byte) (any, error) {
	if !json.Valid(data) {
		// The standard decoder names the syntax error.
		var discard any
		if err := json.Unmarshal(data, &discard); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("Expected one JSON document")
	}
	p := &textParser{data: data}
	return p.value()
}

// textParser reads a document that json.Valid accepted.
type textParser struct {
	data []byte
	pos  int
}

func (p *textParser) space() {
	for p.pos < len(p.data) {
		switch p.data[p.pos] {
		case ' ', '\t', '\n', '\r':
			p.pos++
		default:
			return
		}
	}
}

func (p *textParser) value() (any, error) {
	p.space()
	switch c := p.data[p.pos]; c {
	case '{':
		p.pos++
		m := NewOMap()
		for {
			p.space()
			if p.data[p.pos] == '}' {
				p.pos++
				return m, nil
			}
			if p.data[p.pos] == ',' {
				p.pos++
				p.space()
			}
			key := p.text()
			p.space()
			p.pos++ // ':'
			val, err := p.value()
			if err != nil {
				return nil, err
			}
			m.Set(key, val)
		}
	case '[':
		p.pos++
		arr := []any{}
		for {
			p.space()
			if p.data[p.pos] == ']' {
				p.pos++
				return arr, nil
			}
			if p.data[p.pos] == ',' {
				p.pos++
			}
			val, err := p.value()
			if err != nil {
				return nil, err
			}
			arr = append(arr, val)
		}
	case '"':
		return p.text(), nil
	case 't':
		p.pos += 4
		return true, nil
	case 'f':
		p.pos += 5
		return false, nil
	case 'n':
		p.pos += 4
		return nil, nil
	default:
		begin := p.pos
		for p.pos < len(p.data) && strings.IndexByte("+-.0123456789eE", p.data[p.pos]) >= 0 {
			p.pos++
		}
		number := string(p.data[begin:p.pos])
		f, err := strconv.ParseFloat(number, 64)
		if err != nil {
			return nil, &json.UnmarshalTypeError{Value: "number " + number, Type: reflect.TypeOf(0.0), Offset: int64(begin)}
		}
		return f, nil
	}
}

// text reads a string literal. Escaped surrogate pairs become their character;
// an unpaired escaped surrogate is written as its own three bytes.
func (p *textParser) text() string {
	p.pos++ // opening quote
	var out []byte
	for {
		c := p.data[p.pos]
		switch c {
		case '"':
			p.pos++
			return string(out)
		case '\\':
			p.pos++
			e := p.data[p.pos]
			p.pos++
			switch e {
			case 'b':
				out = append(out, '\b')
			case 'f':
				out = append(out, '\f')
			case 'n':
				out = append(out, '\n')
			case 'r':
				out = append(out, '\r')
			case 't':
				out = append(out, '\t')
			case 'u':
				unit := p.hex()
				if unit >= 0xd800 && unit < 0xdc00 && p.pos+6 <= len(p.data) && p.data[p.pos] == '\\' && p.data[p.pos+1] == 'u' {
					save := p.pos
					p.pos += 2
					if low := p.hex(); low >= 0xdc00 && low < 0xe000 {
						out = utf8.AppendRune(out, utf16.DecodeRune(rune(unit), rune(low)))
						continue
					}
					p.pos = save
				}
				if unit >= 0xd800 && unit < 0xe000 {
					out = append(out, 0xe0|byte(unit>>12), 0x80|byte(unit>>6)&0x3f, 0x80|byte(unit)&0x3f)
				} else {
					out = utf8.AppendRune(out, rune(unit))
				}
			default: // '"', '\\', '/'
				out = append(out, e)
			}
		default:
			out = append(out, c)
			p.pos++
		}
	}
}

func (p *textParser) hex() uint32 {
	var unit uint32
	for _, c := range p.data[p.pos : p.pos+4] {
		unit <<= 4
		switch {
		case c >= '0' && c <= '9':
			unit |= uint32(c - '0')
		case c >= 'a' && c <= 'f':
			unit |= uint32(c-'a') + 10
		default:
			unit |= uint32(c-'A') + 10
		}
	}
	p.pos += 4
	return unit
}

// isOMap reports whether v is a JS "plain object" (an *OMap). Arrays and scalars
// are not. This is the Go equivalent of the JS guard
// `v !== null && typeof v === 'object' && !Array.isArray(v)`.
func isOMap(v any) (*OMap, bool) {
	m, ok := v.(*OMap)
	return m, ok && m != nil
}
