package generator

// Input text checks of the generator operations (docs/spec/input-text.md).
// Every string and member name a caller passes is valid UTF-8; invalid text is
// rejected before any other check of the operation.

import (
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/text"
	"github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

// checkSpecText checks a specification and the files the operation reads, and
// returns the loader it composes with: a custom loader checks each document it
// loads.
func checkSpecText(spec *Object, files map[string]*Object, loader compose.FileLoader) (compose.FileLoader, error) {
	if loader != nil {
		files = nil
	}
	if failure, message := text.CheckSpecification(spec, files); failure != nil {
		return nil, failure
	} else if message != "" {
		return nil, &validate.FormInputError{Message: message}
	}
	if loader != nil {
		return text.CheckedLoader(loader), nil
	}
	return compose.NewMemoryLoader(files), nil
}

// checkInputText checks named caller values in order.
func checkInputText(inputs ...text.Input) error {
	if message := text.CheckInputs(inputs...); message != "" {
		return &validate.FormInputError{Message: message}
	}
	return nil
}

// CheckBindText runs the input text checks BindForm, BindButtons and NewForm
// run first: the template, the data, then the options in code point order of
// their names. template is a *FormTemplate or its decoded JSON object; a caller
// that decodes a template from JSON text checks the decoded object before
// decoding it into a FormTemplate, whose JSON encoding replaces invalid text.
func CheckBindText(template any, data *Object, options BindOptions) error {
	if t, ok := template.(*FormTemplate); ok {
		template = templateText(t)
	}
	return checkInputText(
		text.Input{Name: "template", Value: template},
		text.Input{Name: "data", Value: data},
		text.Input{Name: "options.idPrefix", Value: options.IDPrefix},
		text.Input{Name: "options.keyPrefix", Value: options.KeyPrefix},
		text.Input{Name: "options.language", Value: options.Language},
		text.Input{Name: "options.unsupported", Value: options.Unsupported},
	)
}

// templateText is the JSON object form of a template for the text check.
func templateText(t *FormTemplate) any {
	if t == nil {
		return nil
	}
	var fields func([]FieldTemplate) []any
	fields = func(list []FieldTemplate) []any {
		out := make([]any, len(list))
		for i, f := range list {
			out[i] = map[string]any{"name": f.Name, "spec": f.Spec, "children": fields(f.Children)}
		}
		return out
	}
	return map[string]any{"kind": t.Kind, "keyPrefix": t.KeyPrefix, "fields": fields(t.Fields), "buttons": t.Buttons, "action": t.Action, "description": t.Description}
}

// checkDisplayText checks a list or detail specification, its files, the named
// record input and the options in code point order of their names.
func checkDisplayText(spec *Object, input text.Input, options ListOptions) (ListOptions, error) {
	loader, e := checkSpecText(spec, options.Files, options.Loader)
	if e != nil {
		return options, e
	}
	if e := checkInputText(
		input,
		text.Input{Name: "options.basepath", Value: options.Basepath},
		text.Input{Name: "options.data", Value: options.Data},
		text.Input{Name: "options.language", Value: options.Language},
		text.Input{Name: "options.layout", Value: options.Layout},
	); e != nil {
		return options, e
	}
	options.Loader = loader
	return options, nil
}
