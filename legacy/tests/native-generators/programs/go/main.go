// Command go is the Go generator process of the native generator conformance suite. It reads
// one JSON request on standard input, calls the public API of the generator-go package and
// writes one JSON value on standard output; ../../README.md defines the protocol.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	gen "github.com/polyspec/crudui/packages/generator/go"
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

func val(o *gen.Object, k string) any {
	if o == nil {
		return nil
	}
	v, _ := o.Get(k)
	return v
}

// obj reads a value as an object; any other value is nil, and each caller reports a nil object as its own error
// or reads it as absent, as the request protocol defines.
func obj(v any) *gen.Object {
	o, ok := v.(*gen.Object)
	if !ok {
		return nil
	}
	return o
}

// optionText reads an optional text member as the Rust program does: an absent member is ("", false), a
// string is its value, and any other value, null included, is an input error.
func optionText(o *gen.Object, key string) (string, bool, error) {
	if o == nil || !o.Has(key) {
		return "", false, nil
	}
	s, ok := val(o, key).(string)
	if !ok {
		return "", true, fmt.Errorf("%s must be a string", key)
	}
	return s, true, nil
}

// stringArg reads the positional text argument n of a form action; a missing or non-string argument is an
// input error, as the Rust program reports it.
func stringArg(args []any, n int) (string, error) {
	if n >= len(args) {
		return "", fmt.Errorf("Argument %d must be a string", n)
	}
	s, ok := args[n].(string)
	if !ok {
		return "", fmt.Errorf("Argument %d must be a string", n)
	}
	return s, nil
}

// str is the text of a value that names an operation or a method; any other value names none, and the
// dispatch reports that name as unknown, as the Rust program does.
func str(v any) string {
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}
func compileOptions(o *gen.Object) (gen.CompileOptions, error) {
	files := map[string]*gen.Object{}
	if o != nil && o.Has("files") {
		f := obj(val(o, "files"))
		if f == nil {
			return gen.CompileOptions{}, fmt.Errorf("files must be an object")
		}
		for _, k := range f.Keys() {
			files[k] = obj(val(f, k))
		}
	}
	basepath, _, e := optionText(o, "basepath")
	if e != nil {
		return gen.CompileOptions{}, e
	}
	keyPrefix, provided, e := optionText(o, "keyPrefix")
	if e != nil {
		return gen.CompileOptions{}, e
	}
	return gen.CompileOptions{Files: files, Basepath: basepath, KeyPrefix: keyPrefix, KeyPrefixProvided: provided}, nil
}
func bindOptions(o *gen.Object) gen.BindOptions {
	// Decoded values are passed unchanged; BindForm defaults nil and rejects non-string values.
	return gen.BindOptions{IDPrefix: val(o, "idPrefix"), Language: val(o, "language"), KeyPrefix: val(o, "keyPrefix"), Unsupported: val(o, "unsupported")}
}
func errorObject(err error) *gen.Object {
	code, message, at := "INVALID_FORM_INPUT", err.Error(), ""
	var loadErr *compose.ComposeLoadError
	if errors.As(err, &loadErr) {
		code, message = string(loadErr.Code), loadErr.Message
		if len(loadErr.Trace) > 0 {
			at = strings.Join(loadErr.Trace, ".")
		}
	}
	var fieldErr *gen.UnsupportedFieldTypeError
	if errors.As(err, &fieldErr) {
		code, at = fieldErr.Code(), fieldErr.Path
	}
	return gen.NewObject("code", code, "message", message, "at", at)
}
func snapshot(f *gen.Form) (*gen.Object, error) {
	html, err := gen.RenderForm(f, nil)
	if err != nil {
		return nil, err
	}
	return gen.NewObject("data", f.GetData(), "fields", f.Fields(), "html", html, "revision", f.Revision()), nil
}
func arg(args []any, n int) any {
	if n >= len(args) {
		return nil
	}
	return args[n]
}

// addOptions reads the optional row options at position n; a missing argument is the empty options, and any
// value that is not an object is an input error.
func addOptions(args []any, n int) (gen.AddRowOptions, error) {
	if n >= len(args) {
		return gen.AddRowOptions{}, nil
	}
	o := obj(args[n])
	if o == nil {
		return gen.AddRowOptions{}, fmt.Errorf("Row options must be an object")
	}
	key, _, e := optionText(o, "key")
	if e != nil {
		return gen.AddRowOptions{}, e
	}
	afterKey, _, e := optionText(o, "afterKey")
	if e != nil {
		return gen.AddRowOptions{}, e
	}
	return gen.AddRowOptions{Key: key, AfterKey: afterKey, Value: val(o, "value"), ValueProvided: o.Has("value")}, nil
}
func action(f *gen.Form, method string, args []any) (any, error) {
	switch method {
	case "setData":
		o := obj(arg(args, 0))
		if o == nil {
			return nil, fmt.Errorf("Form data must be an object")
		}
		return nil, f.SetData(o)
	case "getData":
		return f.GetData(), nil
	case "setValue":
		path, e := stringArg(args, 0)
		if e != nil {
			return nil, e
		}
		if len(args) < 2 {
			return nil, fmt.Errorf("setValue requires a value")
		}
		return nil, f.SetValue(path, args[1])
	case "getValue":
		path, e := stringArg(args, 0)
		if e != nil {
			return nil, e
		}
		return f.GetValue(path)
	case "addRow":
		path, e := stringArg(args, 0)
		if e != nil {
			return nil, e
		}
		options, e := addOptions(args, 1)
		if e != nil {
			return nil, e
		}
		return f.AddRow(path, options)
	case "copyRow":
		path, e := stringArg(args, 0)
		if e != nil {
			return nil, e
		}
		key, e := stringArg(args, 1)
		if e != nil {
			return nil, e
		}
		options, e := addOptions(args, 2)
		if e != nil {
			return nil, e
		}
		return f.CopyRow(path, key, options)
	case "removeRow", "rekeyRow":
		path, e := stringArg(args, 0)
		if e != nil {
			return nil, e
		}
		key, e := stringArg(args, 1)
		if e != nil {
			return nil, e
		}
		if method == "removeRow" {
			return nil, f.RemoveRow(path, key)
		}
		newKey, e := stringArg(args, 2)
		if e != nil {
			return nil, e
		}
		return nil, f.RekeyRow(path, key, newKey)
	case "moveRow":
		path, e := stringArg(args, 0)
		if e != nil {
			return nil, e
		}
		key, e := stringArg(args, 1)
		if e != nil {
			return nil, e
		}
		n, ok := arg(args, 2).(float64)
		if !ok || float64(int(n)) != n {
			return nil, fmt.Errorf("Invalid row position")
		}
		return nil, f.MoveRow(path, key, int(n))
	}
	return nil, fmt.Errorf("Invalid form action")
}

// actionMethods are the form methods a request action can call.
var actionMethods = map[string]bool{"setData": true, "setValue": true, "addRow": true, "copyRow": true, "removeRow": true, "moveRow": true, "rekeyRow": true, "getValue": true, "getData": true}

func run(request *gen.Object) (any, error) {
	options := obj(val(request, "options"))
	if options == nil && request.Has("options") {
		return nil, fmt.Errorf("Options must be an object")
	}
	switch str(val(request, "operation")) {
	case "compileForm":
		c, e := compileOptions(options)
		if e != nil {
			return nil, e
		}
		return gen.CompileForm(obj(val(request, "spec")), c)
	case "buildList", "renderList":
		// List input is checked in the shared order: specification, rows, each row, then options.
		if obj(val(request, "spec")) == nil {
			return nil, fmt.Errorf("List specification must be an object")
		}
		rows := []*gen.Object{}
		if a, ok := val(request, "rows").([]any); ok {
			for _, v := range a {
				o := obj(v)
				if o == nil {
					return nil, fmt.Errorf("List rows must be objects")
				}
				rows = append(rows, o)
			}
		} else if request.Has("rows") {
			return nil, fmt.Errorf("List rows must be an array")
		}
		c, e := compileOptions(options)
		if e != nil {
			return nil, e
		}
		language, _, e := optionText(options, "language")
		if e != nil {
			return nil, e
		}
		listOptions := gen.ListOptions{Language: language, Data: val(options, "data"), Page: val(options, "page"), Total: val(options, "total"), Files: c.Files, Basepath: c.Basepath, Layout: val(options, "layout")}
		if str(val(request, "operation")) == "buildList" {
			return gen.BuildList(obj(val(request, "spec")), rows, listOptions)
		}
		return gen.RenderList(obj(val(request, "spec")), rows, listOptions)
	case "buildDetail", "renderDetail":
		c, e := compileOptions(options)
		if e != nil {
			return nil, e
		}
		// The record is typed at this JSON boundary; a non-object specification is reported first by the library.
		spec := obj(val(request, "spec"))
		record := obj(val(request, "record"))
		if spec != nil && record == nil && request.Has("record") {
			return nil, fmt.Errorf("Detail record must be an object")
		}
		language, _, e := optionText(options, "language")
		if e != nil {
			return nil, e
		}
		detailOptions := gen.DetailOptions{Language: language, Data: val(options, "data"), Files: c.Files, Basepath: c.Basepath, Layout: val(options, "layout")}
		if str(val(request, "operation")) == "buildDetail" {
			return gen.BuildDetail(spec, record, detailOptions)
		}
		return gen.RenderDetail(spec, record, detailOptions)
	case "buildOutline":
		nodes, ok := val(request, "nodes").([]any)
		if !ok {
			return nil, fmt.Errorf("Outline nodes must be a list")
		}
		evaluated := make([]*gen.Object, 0, len(nodes))
		for _, v := range nodes {
			o := obj(v)
			if o == nil {
				return nil, fmt.Errorf("Outline nodes must be evaluated node objects")
			}
			evaluated = append(evaluated, o)
		}
		return gen.BuildOutline(evaluated), nil
	case "formButtonsHtml":
		list, ok := val(request, "buttons").([]any)
		if !ok {
			return nil, fmt.Errorf("Form buttons must be a list")
		}
		buttons := make([]*gen.Object, 0, len(list))
		for _, v := range list {
			o := obj(v)
			if o == nil {
				return nil, fmt.Errorf("Form buttons must be evaluated button objects")
			}
			buttons = append(buttons, o)
		}
		return gen.FormButtonsHTML(buttons)
	case "bindForm", "bindButtons", "form", "renderForm":
		// A form template is a JSON object; the library checks its kind.
		if obj(val(request, "template")) == nil {
			return nil, fmt.Errorf("Unsupported form template")
		}
		// The text checks run on the decoded template, whose JSON encoding would
		// replace invalid text.
		if e := gen.CheckBindText(val(request, "template"), obj(val(request, "data")), bindOptions(options)); e != nil {
			return nil, e
		}
		b, e := json.Marshal(val(request, "template"))
		if e != nil {
			return nil, e
		}
		var template gen.FormTemplate
		if e = json.Unmarshal(b, &template); e != nil {
			return nil, e
		}
		data := obj(val(request, "data"))
		if data == nil && request.Has("data") {
			return nil, fmt.Errorf("Form data must be an object")
		}
		switch str(val(request, "operation")) {
		case "bindForm":
			return gen.BindForm(&template, data, bindOptions(options))
		case "bindButtons":
			return gen.BindButtons(&template, data, bindOptions(options))
		}
		f, e := gen.NewForm(&template, data, bindOptions(options))
		if e != nil {
			return nil, e
		}
		if str(val(request, "operation")) == "renderForm" {
			// Render options are passed as decoded; RenderForm checks their shape.
			render, provided := request.Get("render")
			if !provided {
				render = gen.NewObject()
			}
			return gen.RenderForm(f, render)
		}
		steps := []*gen.Object{}
		if a, ok := val(request, "actions").([]any); ok {
			for _, raw := range a {
				a := obj(raw)
				args, isList := val(a, "args").([]any)
				method := str(val(a, "method"))
				var result any
				e := fmt.Errorf("Invalid form action")
				if a != nil && isList && actionMethods[method] {
					result, e = action(f, method, args)
				}
				step := gen.NewObject("result", result, "error", nil)
				if e != nil {
					step.Set("result", nil)
					step.Set("error", errorObject(e))
				}
				state, e := snapshot(f)
				if e != nil {
					return nil, e
				}
				for _, k := range state.Keys() {
					step.Set(k, val(state, k))
				}
				steps = append(steps, step)
			}
		} else if request.Has("actions") {
			return nil, fmt.Errorf("Actions must be an array")
		}
		out, e := snapshot(f)
		if e != nil {
			return nil, e
		}
		out.Set("steps", steps)
		return out, nil
	default:
		return nil, fmt.Errorf("Unknown generator operation")
	}
}
func main() {
	data, e := io.ReadAll(os.Stdin)
	var result any
	if e == nil {
		// Standard input that is not UTF-8 is not JSON text; a decoded request
		// keeps its text exactly, so the generator checks it.
		v, decodeErr := gen.DecodeJSON(data)
		if !utf8.Valid(data) || decodeErr != nil {
			e = fmt.Errorf("Request must be valid JSON")
		} else if request := obj(v); request != nil {
			result, e = run(request)
		} else {
			e = fmt.Errorf("Request must be an object")
		}
	}
	if e != nil {
		result = gen.NewObject("error", errorObject(e))
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(result); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if e != nil {
		os.Exit(1)
	}
}
