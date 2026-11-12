package generator

import "fmt"

// renderModel holds checked render options of a complete form (form-runtime.md, "Complete form").
type renderModel struct {
	// form holds the form element attributes in the order React writes them; nil without action.
	form *Object
	// hidden holds the hidden inputs as name and value pairs in member order.
	hidden [][2]string
	// formErrors holds the errors of the whole form.
	formErrors []string
	// nodeErrors holds the error texts of each node that has errors.
	nodeErrors map[*Object][]string
}

var renderOptionMembers = map[string]bool{"action": true, "hidden": true, "formErrors": true, "errors": true}
var renderActionMembers = map[string]bool{"method": true, "url": true, "enctype": true}

// formRenderModel checks render options and builds the model the renderer writes. A nil options
// value is empty options. It returns the first option outside the contract, in the documented order.
func formRenderModel(nodes []*Object, templateAction *Object, options any) (*renderModel, error) {
	model := &renderModel{nodeErrors: map[*Object][]string{}}
	if options == nil {
		return model, nil
	}
	o, ok := options.(*Object)
	if !ok {
		return nil, inputError("Render options must be an object")
	}
	if o == nil {
		return model, nil
	}
	for _, name := range o.Keys() {
		if !renderOptionMembers[name] {
			return nil, inputError("Unknown render option: %s", name)
		}
	}
	action, hasAction := o.Get("action")
	actionObject := object(action)
	if hasAction && (actionObject == nil || !stringMembers(actionObject, renderActionMembers)) {
		return nil, inputError("action must be an object with string method, url and enctype")
	}
	hidden, hasHidden := o.Get("hidden")
	hiddenObject := object(hidden)
	if hasHidden && (hiddenObject == nil || !stringMembers(hiddenObject, nil)) {
		return nil, inputError("hidden must be an object of strings")
	}
	if hasHidden && !hasAction {
		return nil, inputError("hidden requires action")
	}
	if formErrors, has := o.Get("formErrors"); has {
		list, ok := formErrors.([]any)
		if !ok {
			return nil, inputError("formErrors must be a list of strings")
		}
		for _, text := range list {
			s, ok := text.(string)
			if !ok {
				return nil, inputError("formErrors must be a list of strings")
			}
			model.formErrors = append(model.formErrors, s)
		}
	}
	var records [][2]string
	if errors, has := o.Get("errors"); has {
		list, ok := errors.([]any)
		if !ok {
			return nil, inputError("errors must be a list of objects with string path and message")
		}
		for _, item := range list {
			path, pathOK := read(item, "path").(string)
			message, messageOK := read(item, "message").(string)
			if object(item) == nil || !pathOK || !messageOK {
				return nil, inputError("errors must be a list of objects with string path and message")
			}
			records = append(records, [2]string{path, message})
		}
	}
	if len(records) > 0 {
		byPath := map[string]*Object{}
		nodesByPath(nodes, "", byPath)
		for _, record := range records {
			node := byPath[record[0]]
			if node == nil {
				return nil, inputError("Unknown error path: %s", record[0])
			}
			model.nodeErrors[node] = append(model.nodeErrors[node], record[1])
		}
	}
	if hasAction {
		member := func(key string) (string, bool) {
			if v, ok := actionObject.Get(key); ok {
				// stringMembers has checked every member of the action object, so v is a string.
				s, isString := v.(string)
				if !isString {
					panic(fmt.Sprintf("action member %s is %T after stringMembers", key, v))
				}
				return s, true
			}
			s, ok := read(templateAction, key).(string)
			return s, ok
		}
		model.form = NewObject()
		if url, ok := member("url"); ok {
			model.form.Set("action", sanitizeURL(url))
		}
		if encType, ok := member("enctype"); ok {
			model.form.Set("encType", encType)
		}
		if method, ok := member("method"); ok {
			model.form.Set("method", method)
		}
	}
	if hiddenObject != nil {
		for _, name := range hiddenObject.Keys() {
			v, _ := hiddenObject.Get(name)
			value, isString := v.(string)
			if !isString {
				return nil, inputError("hidden must be an object of strings")
			}
			model.hidden = append(model.hidden, [2]string{name, value})
		}
	}
	return model, nil
}

// stringMembers reports whether every member is a string and, with allowed, an allowed name.
func stringMembers(o *Object, allowed map[string]bool) bool {
	for _, key := range o.Keys() {
		v, _ := o.Get(key)
		if _, ok := v.(string); !ok || (allowed != nil && !allowed[key]) {
			return false
		}
	}
	return true
}

// nodesByPath maps every node with a data path to that path: a row's path is its collection
// path, "." and its key; a lang-item has no path.
func nodesByPath(nodes []*Object, parent string, out map[string]*Object) {
	for _, node := range nodes {
		path, hasPath := "", false
		switch stringAt(node, "kind") {
		case "row":
			path, hasPath = parent+"."+stringAt(node, "key"), true
		case "lang-item":
		default:
			path, hasPath = stringAt(node, "path"), has(node, "path")
		}
		if hasPath {
			out[path] = node
		}
		nodesByPath(objectList(read(node, "children")), path, out)
	}
}

// errorsHTML renders the errors slot of a node: one paragraph per message, present only with messages.
func errorsHTML(class string, messages []string) string {
	if len(messages) == 0 {
		return ""
	}
	body := ""
	for _, text := range messages {
		body += element("p", NewObject("class", class+"__error"), escape(text))
	}
	return element("div", NewObject("class", class+"__errors"), body)
}
