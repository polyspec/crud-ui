package generator

import (
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
)

// DetailOptions supplies composition, display language and caller-owned data options.
// The list-only Layout, Page and Total are ignored; detail output is always a read-only definition list.
type DetailOptions = ListOptions

// BuildDetail creates a read-only detail model from one supplied record.
// Field composition, design evaluation and cell formatting are shared with BuildList.
// record is an *Object or a decoded JSON value; any other value is no object (CUDF-033).
func BuildDetail(spec *Object, record any, options DetailOptions) (*Object, error) {
	// Input text is checked first (docs/spec/input-text.md).
	options, e := checkDisplayText(spec, text.Input{Name: "record", Value: record}, options)
	if e != nil {
		return nil, e
	}
	if spec == nil {
		return nil, inputError("Detail specification must be an object")
	}
	obj, ok := record.(*Object)
	if !ok || obj == nil {
		return nil, inputError("Detail record must be an object")
	}
	if !has(spec, "fields") {
		return nil, inputError("Detail specification must declare fields")
	}
	if _, ok := optionObject(options.Data); !ok {
		return nil, inputError("Detail context must be an object")
	}
	// Page and total are list-only options: a detail neither checks nor uses them.
	options.Page, options.Total = nil, nil
	list, err := buildDisplay(spec, []*Object{obj}, options, displayPaths{own: "detail", members: "fields"})
	if err != nil {
		return nil, err
	}
	columns := objectList(read(list, "columns"))
	rows := objectList(read(list, "rows"))
	var cells []*Object
	if len(rows) > 0 {
		cells = objectList(read(rows[0], "cells"))
	}
	fields := []*Object{}
	for i, column := range columns {
		if i >= len(cells) {
			break
		}
		cell := cells[i]
		fields = append(fields, NewObject(
			"key", stringAt(column, "key"),
			"label", stringAt(column, "label"),
			"format", read(cell, "format"),
			"value", read(cell, "value"),
			"display", read(cell, "display"),
			"design", read(cell, "design"),
		))
	}
	return NewObject("fields", fields, "actions", read(list, "actions"), "design", read(list, "design")), nil
}

// RenderDetail renders one read-only detail: the image preload links, the actions when the
// detail has any, and the definition list.
func RenderDetail(spec *Object, record any, options DetailOptions) (string, error) {
	vm, err := BuildDetail(spec, record, options)
	if err != nil {
		return "", err
	}
	design := object(read(vm, "design"))
	attrs := NewObject("class", joinClass("crudui-detail", nodeClass(design, "wrapper")))
	if style := nodeStyle(design, "wrapper"); style != "" {
		attrs.Set("style", style)
	}
	body := ""
	for _, field := range objectList(read(vm, "fields")) {
		cell := NewObject("display", read(field, "display"), "design", read(field, "design"), "format", read(field, "format"))
		body += element("div", NewObject("class", "crudui-detail__field"),
			element("dt", NewObject("class", "crudui-detail__label"), escapeText(stringAt(field, "label")))+
				cellHTML(cell, "dd", joinClass("crudui-detail__value crudui-value crudui-value--"+stringAt(object(read(field, "format")), "type"), "")))
	}
	return detailImagePreloads(vm) + actionsHTML(objectList(read(vm, "actions")), "crudui-detail") + element("dl", attrs, body), nil
}

func detailImagePreloads(vm *Object) string {
	preloads := newPreloadLinks()
	for _, field := range objectList(read(vm, "fields")) {
		preloads.add(object(read(field, "display")))
	}
	return preloads.String()
}
