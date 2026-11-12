package generator

import (
	"slices"
)

// Declaration rules of composed list and detail specifications (docs/spec/display-formats.md).

var (
	listRootKeys     = []string{"columns", "search", "sort", "pagination", "actions", "empty", "description", "design"}
	detailRootKeys   = []string{"fields", "actions", "design"}
	columnKeys       = []string{"field", "label", "format", "design", "sortable"}
	fieldKeys        = []string{"field", "label", "format", "design"}
	sortKeys         = []string{"field", "dir"}
	scriptActionKeys = []string{"label", "script"}
	actionKeys       = []string{"label", "format", "behavior", "design"}
	behaviorKeys     = []string{"onchange", "onclick", "onload"}
	formatStrings    = []string{"type", "pattern", "target", "as"}
	formatContent    = []string{"prefix", "suffix", "text", "true", "false", "alt"}
)

const contentExpected = "a string, a language map or null"

// isContent reports whether v is a string, a language map (a non-empty object of strings or
// null) or null.
func isContent(v any) bool {
	switch x := v.(type) {
	case nil, string:
		return true
	case *Object:
		if x == nil || x.Len() == 0 {
			return false
		}
		for _, key := range x.Keys() {
			switch read(x, key).(type) {
			case nil, string:
			default:
				return false
			}
		}
		return true
	}
	return false
}

// isConditionMap reports whether v is an object with at least one member.
func isConditionMap(v any) bool {
	o := object(v)
	return o != nil && o.Len() > 0
}

func isString(v any) bool { _, ok := v.(string); return ok }
func isBool(v any) bool   { _, ok := v.(bool); return ok }
func isArray(v any) bool  { _, ok := v.([]any); return ok }

func expected(key, path, what string) error {
	return inputError("Invalid %s at %s: expected %s", key, path, what)
}

// rejectUnknownKeys rejects the first member of o, in member order, that allowed does not list.
func rejectUnknownKeys(o *Object, prefix string, allowed []string, path string) error {
	for _, key := range o.Keys() {
		if !slices.Contains(allowed, key) {
			return inputError("Invalid %s%s at %s: unknown key", prefix, key, path)
		}
	}
	return nil
}

// checkFormatDeclaration checks a cell format declaration at path.
func checkFormatDeclaration(format any, path string) error {
	if isBool(format) || isString(format) {
		return nil
	}
	o := object(format)
	if o == nil {
		return expected("format", path, "a boolean, a string or an object")
	}
	for _, key := range o.Keys() {
		value := read(o, key)
		switch {
		case slices.Contains(formatStrings, key):
			if !isString(value) {
				return expected("format."+key, path, "a string")
			}
		case slices.Contains(formatContent, key):
			if !isContent(value) {
				return expected("format."+key, path, contentExpected)
			}
		case key == "map":
			labels := object(value)
			if labels == nil {
				return expected("format.map", path, "an object")
			}
			for _, name := range labels.Keys() {
				if !isContent(read(labels, name)) {
					return expected("format.map."+name, path, contentExpected)
				}
			}
		case key == "href":
			if !isString(value) && !isConditionMap(value) {
				return expected("format.href", path, "a string or a condition map")
			}
		case key == "items":
			if !isArray(value) && object(value) == nil {
				return expected("format.items", path, "an array or an object")
			}
			if isChoiceList(value) {
				if _, ok := choicePairs(value, false, false); !ok {
					return expected("format.items", path, choiceListExpected)
				}
			}
		}
	}
	return nil
}

// checkMemberDeclaration checks one column or field declaration.
func checkMemberDeclaration(name string, member any, paths displayPaths) error {
	o := object(member)
	if o == nil {
		return expected(name, paths.members, "an object")
	}
	path := paths.members + "." + name
	allowed := fieldKeys
	if paths.members == "columns" {
		allowed = columnKeys
	}
	if e := rejectUnknownKeys(o, "", allowed, path); e != nil {
		return e
	}
	if o.Has("field") && !isString(read(o, "field")) {
		return expected("field", path, "a string")
	}
	if e := checkLabelAndFormat(o, path); e != nil {
		return e
	}
	if o.Has("design") {
		if e := checkDesignDeclaration(read(o, "design"), path, false, nil, false); e != nil {
			return e
		}
	}
	if sortable := read(o, "sortable"); o.Has("sortable") && !isBool(sortable) && !isString(sortable) && !isConditionMap(sortable) {
		return expected("sortable", path, "a boolean, an expression or a condition map")
	}
	return nil
}

// checkBehaviorEntry checks one behavior entry of an action at path.
func checkBehaviorEntry(event string, entry any, path string) error {
	if isString(entry) {
		return nil
	}
	o := object(entry)
	if o == nil {
		return expected("behavior."+event, path, "a script or an object")
	}
	if e := rejectUnknownKeys(o, "behavior."+event+".", scriptActionKeys, path); e != nil {
		return e
	}
	if o.Has("label") && !isContent(read(o, "label")) {
		return expected("behavior."+event+".label", path, contentExpected)
	}
	if o.Has("script") && !isString(read(o, "script")) {
		return expected("behavior."+event+".script", path, "a string")
	}
	return nil
}

// checkActionDeclaration checks one list action at actions.<name>.
func checkActionDeclaration(name string, action any) error {
	if isString(action) {
		return nil
	}
	o := object(action)
	if o == nil {
		return expected(name, "actions", "a script or an object")
	}
	path := "actions." + name
	if o.Has("script") {
		if e := rejectUnknownKeys(o, "", scriptActionKeys, path); e != nil {
			return e
		}
		if o.Has("label") && !isContent(read(o, "label")) {
			return expected("label", path, contentExpected)
		}
		if !isString(read(o, "script")) {
			return expected("script", path, "a string")
		}
		return nil
	}
	if e := rejectUnknownKeys(o, "", actionKeys, path); e != nil {
		return e
	}
	if e := checkLabelAndFormat(o, path); e != nil {
		return e
	}
	if o.Has("behavior") {
		behavior := read(o, "behavior")
		b := object(behavior)
		if !isBool(behavior) && b == nil {
			return expected("behavior", path, "a boolean or an object")
		}
		if b != nil {
			if e := rejectUnknownKeys(b, "behavior.", behaviorKeys, path); e != nil {
				return e
			}
			for _, event := range b.Keys() {
				if e := checkBehaviorEntry(event, read(b, event), path); e != nil {
					return e
				}
			}
		}
	}
	if o.Has("design") {
		return checkDesignDeclaration(read(o, "design"), path, false, nil, false)
	}
	return nil
}

// checkActionsDeclaration checks the actions of a list or detail at own, each action in member order.
func checkActionsDeclaration(value any, own string) error {
	actions := object(value)
	if actions == nil {
		return expected("actions", own, "an object")
	}
	for _, name := range actions.Keys() {
		// Actions are not composed: a composition key is not an action name.
		if name == "$ref" || name == "$patch" {
			return inputError("Invalid %s at actions: unknown key", name)
		}
		if e := checkActionDeclaration(name, read(actions, name)); e != nil {
			return e
		}
	}
	return nil
}

// checkDisplayDeclarations checks a composed list or detail specification: the root members,
// the own design, each column or field in member order and then, for a list, search, sort,
// actions, empty, description and pagination, and for a detail, actions.
func checkDisplayDeclarations(spec *Object, paths displayPaths) error {
	own := paths.own
	allowed := detailRootKeys
	if own == "list" {
		allowed = listRootKeys
	}
	for _, key := range spec.Keys() {
		if key == "$ref" || key == "$patch" {
			return expected(key, own, "composition inside "+paths.members)
		}
		if !slices.Contains(allowed, key) {
			return inputError("Invalid %s at %s: unknown key", key, own)
		}
	}
	if spec.Has("design") {
		if e := checkDesignDeclaration(read(spec, "design"), own, false, nil, false); e != nil {
			return e
		}
	}
	members := object(read(spec, paths.members))
	for _, name := range members.Keys() {
		if e := checkMemberDeclaration(name, read(members, name), paths); e != nil {
			return e
		}
	}
	if own == "detail" {
		if spec.Has("actions") {
			return checkActionsDeclaration(read(spec, "actions"), own)
		}
		return nil
	}
	if search := read(spec, "search"); spec.Has("search") && !isBool(search) && object(search) == nil {
		return expected("search", own, "a boolean or an object")
	}
	if spec.Has("sort") {
		sort := object(read(spec, "sort"))
		if sort == nil {
			return expected("sort", own, "an object")
		}
		if e := rejectUnknownKeys(sort, "sort.", sortKeys, own); e != nil {
			return e
		}
		if sort.Has("field") && !isString(read(sort, "field")) {
			return expected("sort.field", own, "a string")
		}
		if dir := read(sort, "dir"); sort.Has("dir") && dir != "asc" && dir != "desc" {
			return expected("sort.dir", own, "asc or desc")
		}
	}
	if spec.Has("actions") {
		if e := checkActionsDeclaration(read(spec, "actions"), own); e != nil {
			return e
		}
	}
	if spec.Has("empty") && !isContent(read(spec, "empty")) {
		return expected("empty", own, contentExpected)
	}
	if spec.Has("description") && !isContent(read(spec, "description")) {
		return expected("description", own, contentExpected)
	}
	if spec.Has("pagination") {
		return checkPaginationDeclaration(read(spec, "pagination"), own)
	}
	return nil
}

// checkLabelAndFormat rejects a wrong label (content) or format declaration of o at path.
func checkLabelAndFormat(o *Object, path string) error {
	if o.Has("label") && !isContent(read(o, "label")) {
		return expected("label", path, contentExpected)
	}
	if o.Has("format") {
		return checkFormatDeclaration(read(o, "format"), path)
	}
	return nil
}
