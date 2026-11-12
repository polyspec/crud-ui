package generator

import (
	"strings"
)

// formButtonTypes lists the button types a spec can declare. A link renders an anchor.
var formButtonTypes = map[string]bool{"submit": true, "reset": true, "button": true, "link": true}

// buttonText returns the interface text of a button type; only submit and reset have one.
func buttonText(m formMessages, kind string) string {
	switch kind {
	case "submit":
		return m.submit
	case "reset":
		return m.reset
	}
	return ""
}

// buttonLabel returns the declared content, or the interface text when there is none.
func buttonLabel(button *Object, language, fallback string) string {
	text := read(button, "text")
	if s, ok := text.(string); ok {
		return s
	}
	if object(text) != nil {
		if s := translate(text, language); s != "" {
			return s
		}
	}
	return fallback
}

// buttonScript returns the behavior script of an action: a string or the script of a { label, script }
// action, "" when the button declares none.
func buttonScript(button *Object, action string) (string, error) {
	v := read(read(button, "behavior"), action)
	if object(v) != nil {
		v = read(v, "script")
	}
	return optionalString(v, "button behavior "+action+" script")
}

// BindButtons evaluates the template's buttons for a record in declaration order.
// Each button is an object with type, tag, text and attrs; attrs keeps the output order
// type, class, style, name, value, href, onclick. Only the Language option applies.
func BindButtons(template *FormTemplate, data *Object, options BindOptions) ([]*Object, error) {
	data, e := checkedBinding(template, data, options)
	if e != nil {
		return nil, e
	}
	language, e := bindLanguage(options)
	if e != nil {
		return nil, e
	}
	m, e := messagesFor(language)
	if e != nil {
		return nil, e
	}
	return bindButtons(template.Buttons, data, language, m)
}

// bindLanguage returns the Language option, defaulting to ko and rejecting a non-string value.
func bindLanguage(options BindOptions) (string, error) {
	if options.Language == nil {
		return "ko", nil
	}
	s, ok := options.Language.(string)
	if !ok {
		return "", inputError("Language must be a string")
	}
	return s, nil
}

// bindButtons evaluates declared buttons for a record; design rules read the record data.
func bindButtons(buttons []*Object, data *Object, language string, m formMessages) ([]*Object, error) {
	lookup := plainObject(data)
	out := make([]*Object, 0, len(buttons))
	for _, button := range buttons {
		kind := stringAt(button, "type")
		if !formButtonTypes[kind] {
			return nil, inputError("Invalid button type: %s", kind)
		}
		design, e := resolveDesign(read(button, "design"), lookup, []string{}, nil)
		if e != nil {
			return nil, e
		}
		tag, attrs := "button", NewObject()
		if kind == "link" {
			tag = "a"
		} else {
			attrs.Set("type", kind)
		}
		class := "crudui-action crudui-action--text"
		if c := nodeClass(design, "main"); c != "" {
			class += " " + c
		}
		attrs.Set("class", class)
		if style := styleString(nodeStyle(design, "main")); style != "" {
			attrs.Set("style", style)
		}
		for _, name := range []string{"name", "value", "href"} {
			if s, ok := read(button, name).(string); ok {
				attrs.Set(name, s)
			}
		}
		script, e := buttonScript(button, "onclick")
		if e != nil {
			return nil, e
		}
		if script != "" {
			attrs.Set("onclick", script)
		}
		out = append(out, NewObject("type", kind, "tag", tag, "text", buttonLabel(button, language, buttonText(m, kind)), "attrs", attrs))
	}
	return out, nil
}

// buttonAttributes lists the attribute names an evaluated button may carry.
var buttonAttributes = map[string]bool{"type": true, "class": true, "style": true, "name": true, "value": true, "href": true, "onclick": true}

// FormButtonsHTML renders evaluated buttons as the markup every renderer inserts into the form footer. The buttons
// are a list: a Go slice of button objects, or the list of a decoded JSON value, and nil is the empty list. Each button
// must be an object whose tag is a or button, whose text is a string and whose attrs object has only the named button
// attributes with string values; other members are ignored.
func FormButtonsHTML(buttons any) (string, error) {
	var items []any
	switch list := buttons.(type) {
	case nil:
	case []*Object:
		for _, button := range list {
			items = append(items, button)
		}
	case []any:
		items = list
	default:
		return "", errNotButtonList
	}
	var out strings.Builder
	for _, button := range items {
		tag, tagOK := read(button, "tag").(string)
		text, textOK := read(button, "text").(string)
		attrs := object(read(button, "attrs"))
		if !tagOK || (tag != "a" && tag != "button") || !textOK || attrs == nil {
			return "", errNotEvaluatedButtons
		}
		out.WriteString("<" + tag)
		for _, name := range attrs.Keys() {
			value, ok := read(attrs, name).(string)
			if !ok || !buttonAttributes[name] {
				return "", errNotEvaluatedButtons
			}
			out.WriteString(" " + name + `="` + rawEscape(value) + `"`)
		}
		out.WriteString(">" + escapeText(text) + "</" + tag + ">")
	}
	return out.String(), nil
}

// errNotButtonList rejects form button input that is no list.
var errNotButtonList = inputError("Form buttons must be a list")

// errNotEvaluatedButtons rejects form button input that bindButtons did not produce.
var errNotEvaluatedButtons = inputError("Form buttons must be evaluated button objects")
