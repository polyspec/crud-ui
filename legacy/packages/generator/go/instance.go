package generator

import (
	"crypto/rand"
	"encoding/hex"
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
	"math"
	"regexp"
	"strings"
)

var sequenceRE = regexp.MustCompile(`^\d{1,13}$`)
var rowKeyRE = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
var numericKeyRE = regexp.MustCompile(`^\d+$`)

// SequenceRowKey converts a nonnegative sequence of at most 13 digits to a scoped row key.
func SequenceRowKey(sequence any) (string, error) {
	switch sequence.(type) {
	case string, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
	default:
		return "", inputError("A sequence must contain 1–13 decimal digits")
	}
	if n, ok := asNumber(sequence); ok && (math.IsNaN(n) || math.IsInf(n, 0) || math.Trunc(n) != n || n < 0 || n > 9999999999999) {
		return "", inputError("A sequence must contain 1–13 decimal digits")
	}
	digits := scalar(sequence)
	if !sequenceRE.MatchString(digits) {
		return "", inputError("A sequence must contain 1–13 decimal digits")
	}
	return "__" + strings.Repeat("0", 13-len(digits)) + digits + "__", nil
}

// CreateRowKey creates a row key containing 13 random hexadecimal characters.
func CreateRowKey() (string, error) {
	var data [7]byte
	if _, e := rand.Read(data[:]); e != nil {
		return "", e
	}
	return "__" + hex.EncodeToString(data[:])[:13] + "__", nil
}
func checkKey(k string) error {
	if !rowKeyRE.MatchString(k) || numericKeyRE.MatchString(k) || k == "__proto__" || k == "prototype" || k == "constructor" {
		return inputError("Invalid row key: %s; use sequenceRowKey for numeric ids", k)
	}
	return nil
}
func checkedSegments(path string) ([]string, error) {
	s := parsePath(path)
	if len(s) == 0 {
		return nil, inputError("Invalid form path: %s", path)
	}
	for _, k := range s {
		if k == "__proto__" || k == "prototype" || k == "constructor" {
			return nil, inputError("Invalid form path: %s", path)
		}
	}
	return s, nil
}

// AddRowOptions preserves explicit null through ValueProvided.
type AddRowOptions struct {
	Key           string
	AfterKey      string
	Value         any
	ValueProvided bool
}

// Form owns an independent record, compiled template and current field models.
type Form struct {
	template *FormTemplate
	data     *Object
	fields   []*Object
	options  BindOptions
	revision uint64
	view     ViewState
	history  History[*Object]
}

// NewForm copies the template and record, applies missing defaults and binds fields.
func NewForm(template *FormTemplate, data *Object, options BindOptions) (*Form, error) {
	if e := CheckBindText(template, data, options); e != nil {
		return nil, e
	}
	if e := checkOrderedValue(data); e != nil {
		return nil, e
	}
	t, e := cloneTemplate(template)
	if e != nil {
		return nil, e
	}
	f := &Form{template: t, options: options, view: InitialView(), history: EmptyHistory[*Object]()}
	var input any = data
	if data == nil {
		input = absent
	}
	d, e := f.normalizeFields(t.Fields, input, "", false)
	if e != nil {
		return nil, e
	}
	fields, e := BindForm(t, d, f.bindOptions(f.view))
	if e != nil {
		return nil, e
	}
	f.data, f.fields = d, fields
	return f, nil
}

// GetData returns a deep copy of the current ordered record.
func (f *Form) GetData() *Object { return copyObject(f.data) }

// Template returns a deep copy of the reusable form structure.
func (f *Form) Template() (*FormTemplate, error) { return cloneTemplate(f.template) }

// Fields returns deep copies of the current field models.
func (f *Form) Fields() []*Object {
	out := make([]*Object, len(f.fields))
	for i, v := range f.fields {
		out[i] = copyObject(v)
	}
	return out
}

// Revision returns the number of successful instance mutations.
func (f *Form) Revision() uint64 { return f.revision }

// GetValue returns a detached value at a record path; absent values return nil.
func (f *Form) GetValue(path string) (any, error) {
	if e := checkInputText(text.Input{Name: "path", Value: path}); e != nil {
		return nil, e
	}
	if _, e := checkedSegments(path); e != nil {
		return nil, e
	}
	v := getPath(f.data, path)
	if isAbsent(v) {
		return nil, nil
	}
	return copyValue(v), nil
}

// SetData replaces the complete record and rebinds fields atomically.
func (f *Form) SetData(data *Object) error {
	if e := checkInputText(text.Input{Name: "data", Value: data}); e != nil {
		return e
	}
	if e := checkOrderedValue(data); e != nil {
		return e
	}
	if data == nil {
		return inputError("Form data must be an object")
	}
	d, e := f.normalizeFields(f.template.Fields, data, "", false)
	if e != nil {
		return e
	}
	if e := f.commitView(d, InitialView(), ""); e != nil {
		return e
	}
	// setData restarts the history (CURT-065).
	f.history = EmptyHistory[*Object]()
	return nil
}

// SetValue replaces one path value and rebinds fields atomically.
func (f *Form) SetValue(path string, value any) error {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "value", Value: value}); e != nil {
		return e
	}
	if e := checkOrderedValue(value); e != nil {
		return e
	}
	s, e := checkedSegments(path)
	if e != nil {
		return e
	}
	d, e := f.normalizeFields(f.template.Fields, putAt(f.data, s, copyValue(value)), "", false)
	if e != nil {
		return e
	}
	return f.commitView(d, f.view, strings.Join(s, "."))
}

// bindOptions returns the options of the form with the collapsed rows of the view.
func (f *Form) bindOptions(view ViewState) BindOptions {
	options := f.options
	options.Collapsed = view.Collapsed
	return options
}

// commit replaces the record and keeps the view; a failure leaves the record and the view unchanged.
func (f *Form) commit(data *Object) error { return f.commitView(data, f.view, "") }

// commitView replaces the record and the view together and records the change in the undo history; path is the
// path of a value edit, and empty for every other change.
func (f *Form) commitView(data *Object, view ViewState, path string) error {
	fields, e := BindForm(f.template, data, f.bindOptions(view))
	if e != nil {
		return e
	}
	f.history = RecordChange(f.history, f.data, path)
	f.data, f.fields, f.view = data, fields, view
	f.revision++
	return nil
}
func putAt(data *Object, path []string, value any) *Object {
	out := NewObject()
	if data != nil {
		out = data.Clone()
	}
	if len(path) == 1 {
		out.Set(path[0], value)
	} else {
		out.Set(path[0], putAt(object(read(data, path[0])), path[1:], value))
	}
	return out
}
func freshKey(used *Object) (string, error) {
	for i := 0; i < 100; i++ {
		k, e := CreateRowKey()
		if e != nil {
			return "", e
		}
		if used == nil || !used.Has(k) {
			return k, nil
		}
	}
	return "", inputError("Unable to generate an unused row key")
}

// initialRowKey is the key of the row that missing repeated data gets; a row that an operation creates gets a fresh
// key instead (normalizeFields with fresh), as the Python and TypeScript references do.
const initialRowKey = "__0000000000000__"

// normalizeFields normalizes record data; path is the full data path, empty at the root. fresh gives the rows that
// missing repeated data creates fresh keys, and is set only for a row that an operation creates.
func (f *Form) normalizeFields(fields []FieldTemplate, value any, path string, fresh bool) (*Object, error) {
	if !isAbsent(value) && object(value) == nil {
		if path == "" {
			return nil, inputError("Form data must be an object")
		}
		return nil, inputError("Group data must be an object: %s", path)
	}
	data := NewObject()
	if !isAbsent(value) {
		data = copyObject(object(value))
	}
	for _, field := range fields {
		raw := read(data, field.Name)
		fieldPath := field.Name
		if path != "" {
			fieldPath = path + "." + field.Name
		}
		if repeated(field) {
			if !isAbsent(raw) && object(raw) == nil {
				return nil, inputError("Repeated data must be a keyed object: %s", fieldPath)
			}
			rows := NewObject()
			if isAbsent(raw) && !dataOnly(field.Spec) {
				k := initialRowKey
				if fresh {
					generated, e := freshKey(nil)
					if e != nil {
						return nil, e
					}
					k = generated
				}
				v, e := f.normalizeRow(field, absent, fieldPath+"."+k, fresh)
				if e != nil {
					return nil, e
				}
				rows.Set(k, v)
			} else if !isAbsent(raw) {
				for _, k := range object(raw).Keys() {
					if e := checkKey(k); e != nil {
						return nil, e
					}
					v, e := f.normalizeRow(field, read(raw, k), fieldPath+"."+k, fresh)
					if e != nil {
						return nil, e
					}
					rows.Set(k, v)
				}
			}
			data.Set(field.Name, rows)
		} else if stringAt(field.Spec, "type") == "group" {
			v, e := f.normalizeFields(field.Children, raw, fieldPath, fresh)
			if e != nil {
				return nil, e
			}
			data.Set(field.Name, v)
		} else if isAbsent(raw) && field.Spec.Has("default") {
			data.Set(field.Name, copyValue(read(field.Spec, "default")))
		}
	}
	return data, nil
}
func (f *Form) normalizeRow(field FieldTemplate, value any, path string, fresh bool) (any, error) {
	if stringAt(field.Spec, "type") == "group" {
		return f.normalizeFields(field.Children, value, path, fresh)
	}
	if isAbsent(value) {
		value = read(field.Spec, "default")
		if value == nil || isAbsent(value) {
			value = ""
		}
	}
	return copyValue(value), nil
}
func (f *Form) collection(path string) (FieldTemplate, *Object, error) {
	segments, e := checkedSegments(path)
	if e != nil {
		return FieldTemplate{}, nil, e
	}
	fields := f.template.Fields
	var found *FieldTemplate
	for i := 0; i < len(segments); i++ {
		found = nil
		for j := range fields {
			if fields[j].Name == segments[i] {
				found = &fields[j]
				break
			}
		}
		if found == nil {
			return FieldTemplate{}, nil, inputError("Unknown collection: %s", path)
		}
		if i == len(segments)-1 {
			break
		}
		if repeated(*found) {
			i++
		}
		fields = found.Children
		found = nil
	}
	rows := object(getPath(f.data, path))
	if found == nil || !repeated(*found) || rows == nil {
		return FieldTemplate{}, nil, inputError("Not a keyed collection: %s", path)
	}
	return *found, rows, nil
}

// editableCollection returns a collection whose rows the form may add, copy, remove, move or rekey.
func (f *Form) editableCollection(path string) (FieldTemplate, *Object, error) {
	field, rows, e := f.collection(path)
	if e != nil {
		return field, rows, e
	}
	if dataOnly(field.Spec) {
		return FieldTemplate{}, nil, inputError("Rows of %s come only from data", path)
	}
	return field, rows, nil
}

// AddRow inserts a default or supplied row in the selected repeated collection.
func (f *Form) AddRow(path string, options AddRowOptions) (string, error) {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "options.afterKey", Value: options.AfterKey}, text.Input{Name: "options.key", Value: options.Key}, text.Input{Name: "options.value", Value: options.Value}); e != nil {
		return "", e
	}
	if e := checkOrderedValue(options.Value); e != nil {
		return "", e
	}
	field, rows, e := f.editableCollection(path)
	if e != nil {
		return "", e
	}
	if max, ok := asNumber(read(read(field.Spec, "multiple"), "max")); ok && float64(rows.Len()) >= max {
		return "", inputError("Maximum row count reached: %s", path)
	}
	key := options.Key
	if key == "" {
		key, e = freshKey(rows)
		if e != nil {
			return "", e
		}
	}
	if e = checkKey(key); e != nil {
		return "", e
	}
	if rows.Has(key) {
		return "", inputError("Row key already exists: %s", key)
	}
	if options.AfterKey != "" && !rows.Has(options.AfterKey) {
		return "", inputError("Unknown row: %s", options.AfterKey)
	}
	v := absent
	if options.ValueProvided || options.Value != nil {
		v = options.Value
	}
	segs, e := checkedSegments(path)
	if e != nil {
		return "", e
	}
	v, e = f.normalizeRow(field, v, strings.Join(append(append([]string{}, segs...), key), "."), true)
	if e != nil {
		return "", e
	}
	out := NewObject()
	for _, k := range rows.Keys() {
		out.Set(k, read(rows, k))
		if k == options.AfterKey {
			out.Set(key, v)
		}
	}
	if options.AfterKey == "" {
		out.Set(key, v)
	}
	if e = f.commit(putAt(f.data, segs, out)); e != nil {
		return "", e
	}
	return key, nil
}

// CopyRow copies a row and generates fresh keys for its repeated descendants.
func (f *Form) CopyRow(path, key string, options AddRowOptions) (string, error) {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "key", Value: key}, text.Input{Name: "options.afterKey", Value: options.AfterKey}, text.Input{Name: "options.key", Value: options.Key}); e != nil {
		return "", e
	}
	field, rows, e := f.editableCollection(path)
	if e != nil {
		return "", e
	}
	if !rows.Has(key) {
		return "", inputError("Unknown row: %s", key)
	}
	v, e := f.copyRowValue(field, read(rows, key))
	if e != nil {
		return "", e
	}
	options.Value = v
	options.ValueProvided = true
	if options.AfterKey == "" {
		options.AfterKey = key
	}
	return f.AddRow(path, options)
}
func (f *Form) copyRowValue(field FieldTemplate, value any) (any, error) {
	if stringAt(field.Spec, "type") != "group" {
		return copyValue(value), nil
	}
	return f.copyChildren(field.Children, object(value))
}
func (f *Form) copyChildren(fields []FieldTemplate, value *Object) (*Object, error) {
	if value == nil {
		return nil, inputError("Group data must be an object")
	}
	out := copyObject(value)
	for _, child := range fields {
		raw := read(out, child.Name)
		if repeated(child) && object(raw) != nil {
			used := object(raw).Clone()
			rows := NewObject()
			for _, old := range object(raw).Keys() {
				key, e := freshKey(used)
				if e != nil {
					return nil, e
				}
				used.Set(key, true)
				v, e := f.copyRowValue(child, read(raw, old))
				if e != nil {
					return nil, e
				}
				rows.Set(key, v)
			}
			out.Set(child.Name, rows)
		} else if stringAt(child.Spec, "type") == "group" && object(raw) != nil {
			v, e := f.copyChildren(child.Children, object(raw))
			if e != nil {
				return nil, e
			}
			out.Set(child.Name, v)
		}
	}
	return out, nil
}

// RemoveRow removes a row when the collection minimum permits removal.
func (f *Form) RemoveRow(path, key string) error {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "key", Value: key}); e != nil {
		return e
	}
	field, rows, e := f.editableCollection(path)
	if e != nil {
		return e
	}
	if !rows.Has(key) {
		return inputError("Unknown row: %s", key)
	}
	if min, ok := asNumber(read(read(field.Spec, "multiple"), "min")); ok && float64(rows.Len()) <= min {
		return inputError("Minimum row count reached: %s", path)
	}
	out := rows.Clone()
	out.Delete(key)
	segs, e := checkedSegments(path)
	if e != nil {
		return e
	}
	return f.commitView(putAt(f.data, segs, out), RemoveRowView(f.view, strings.Join(append(append([]string{}, segs...), key), ".")), "")
}

// MoveRow moves an existing row to a zero-based collection position.
func (f *Form) MoveRow(path, key string, index int) error {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "key", Value: key}); e != nil {
		return e
	}
	_, rows, e := f.editableCollection(path)
	if e != nil {
		return e
	}
	if !rows.Has(key) {
		return inputError("Unknown row: %s", key)
	}
	if index < 0 || index >= rows.Len() {
		return inputError("Invalid row position: %d", index)
	}
	ks := rows.Keys()
	from := 0
	for i, k := range ks {
		if k == key {
			from = i
		}
	}
	if from == index {
		return nil
	}
	ks = append(ks[:from], ks[from+1:]...)
	ks = append(ks, "")
	copy(ks[index+1:], ks[index:])
	ks[index] = key
	out := NewObject()
	for _, k := range ks {
		out.Set(k, read(rows, k))
	}
	segs, e := checkedSegments(path)
	if e != nil {
		return e
	}
	return f.commit(putAt(f.data, segs, out))
}

// RekeyRow replaces a row key without changing its value or collection position.
func (f *Form) RekeyRow(path, oldKey, newKey string) error {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "oldKey", Value: oldKey}, text.Input{Name: "newKey", Value: newKey}); e != nil {
		return e
	}
	_, rows, e := f.editableCollection(path)
	if e != nil {
		return e
	}
	if e = checkKey(newKey); e != nil {
		return e
	}
	if !rows.Has(oldKey) {
		return inputError("Unknown row: %s", oldKey)
	}
	if oldKey == newKey {
		return nil
	}
	if rows.Has(newKey) {
		return inputError("Row key already exists: %s", newKey)
	}
	out := NewObject()
	for _, k := range rows.Keys() {
		v := read(rows, k)
		if k == oldKey {
			k = newKey
		}
		out.Set(k, v)
	}
	segs, e := checkedSegments(path)
	if e != nil {
		return e
	}
	return f.commitView(putAt(f.data, segs, out), RekeyRowView(f.view, strings.Join(append(append([]string{}, segs...), oldKey), "."), strings.Join(append(append([]string{}, segs...), newKey), ".")), "")
}

// ToggleRow expands a collapsed row or collapses an expanded one; the record and the revision do not change.
func (f *Form) ToggleRow(path, key string) error {
	if e := checkInputText(text.Input{Name: "path", Value: path}, text.Input{Name: "key", Value: key}); e != nil {
		return e
	}
	_, rows, e := f.collection(path)
	if e != nil {
		return e
	}
	if !rows.Has(key) {
		return inputError("Unknown row: %s", key)
	}
	segs, e := checkedSegments(path)
	if e != nil {
		return e
	}
	return f.refreshView(ToggleRowView(f.view, strings.Join(append(append([]string{}, segs...), key), ".")))
}

// SetAllExpanded expands every row, or collapses every collapsible row; the record and the revision do not change.
func (f *Form) SetAllExpanded(expanded bool) error {
	return f.refreshView(SetAllExpandedView(f.fields, expanded))
}

// Undo restores the record before the last data change and makes the reverted record redoable (CURT-011); it fails
// when nothing can be undone.
func (f *Form) Undo() error {
	result, e := UndoChange(f.history, f.data)
	if e != nil {
		return e
	}
	return f.restore(result.Value, result.History)
}

// Redo reapplies the most recently undone data change (CURT-012); it fails when nothing can be redone.
func (f *Form) Redo() error {
	result, e := RedoChange(f.history, f.data)
	if e != nil {
		return e
	}
	return f.restore(result.Value, result.History)
}

// CanUndo reports whether Undo restores an earlier record (CURT-061).
func (f *Form) CanUndo() bool { return CanUndo(f.history) }

// CanRedo reports whether Redo reapplies an undone record (CURT-061).
func (f *Form) CanRedo() bool { return CanRedo(f.history) }

// restore replaces the record and its history with the outcome of an undo or a redo and rebinds the fields with the
// current view; a failure leaves the record, the history and the view unchanged.
func (f *Form) restore(data *Object, history History[*Object]) error {
	fields, e := BindForm(f.template, data, f.bindOptions(f.view))
	if e != nil {
		return e
	}
	f.data, f.fields, f.history = data, fields, history
	f.revision++
	return nil
}

// refreshView rebinds the fields with a new view.
func (f *Form) refreshView(view ViewState) error {
	fields, e := BindForm(f.template, f.data, f.bindOptions(view))
	if e != nil {
		return e
	}
	f.fields, f.view = fields, view
	return nil
}
