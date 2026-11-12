package validate

// model validator traversal + conditional rule-value resolution (SPEC §3 + §2 G1).
//
// Operates on a COMPOSED properties tree (*compose.OMap, declaration order
// preserved — composition keys already eliminated) and the decoded form data
// (map[string]any / []any / scalars from encoding/json). The traversal mirrors the
// JS Validator (validator-ts/src/validate/validator.ts) field for field; the
// rule-value resolution mirrors its resolveRuleValue / resolveConditionMap /
// tryEvaluateTernary (G1 — the condition is the value's expression, never a
// separate if/when key).
//
// A field whose design.show resolves to false against the data is hidden: its
// rules and the rules of every field it contains are skipped, and its value is
// kept for conditions and references elsewhere (validation-rules.md, Evaluation).

import (
	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

// arrayLevelRules apply to the whole array of a multiple field; the rest apply to
// each element (VALIDATION-RULES §array-level).
var arrayLevelRules = map[string]bool{
	"required": true, "unique": true, "mincount": true, "maxcount": true,
}

// pathReferenceRules carry a field-reference param preserved verbatim — never
// evaluated as a condition expression (PATH-REFERENCE-RULES).
var pathReferenceRules = map[string]bool{
	"equalTo": true, "containedIn": true, "typeFrom": true, "minFrom": true, "maxFrom": true, "notEqual": true, "unique": true, "enddate": true, "reference": true,
}

// literalParamRules carry a literal param (.jpg must not be read as a relative
// reference, nor the conditionTree param judge as a path, nor an object as a
// condition map) — never evaluated (LITERAL-PARAM-RULES).
var literalParamRules = map[string]bool{"accept": true, "conditionTree": true}

// patternParamRules carry a CRUDUI pattern string preserved verbatim.
var patternParamRules = map[string]bool{"match": true, "pattern": true}

// membershipParamRules carry the allowed-value SET (array, comma string, or a
// static value→label map, SPEC §2 G3). The param is data, NOT a condition
// map — an object param is the value→label map (key = option value, value =
// display label), kept verbatim and never evaluated key-by-key as expressions.
var membershipParamRules = map[string]bool{"in": true}

// Validator validates data against a composed model spec. Construct via NewValidator
// from a composed properties OMap.
type Validator struct {
	properties *compose.OMap
	// patterns holds the matcher of every checked pattern parameter.
	patterns map[string]*patternMatcher
}

// NewValidator builds a validator from a COMPOSED properties OMap (composition
// keys already eliminated by the compose pass) and checks its declared rule
// names and parameters. A rule name that is not registered, or a parameter
// outside its rule's definition, returns a *compose.ComposeLoadError
// (UNKNOWN_RULE, INVALID_RULE_PARAMETER or INVALID_RULE_PATTERN) at the field's
// declaration path.
func NewValidator(properties *compose.OMap) (*Validator, error) {
	if properties == nil {
		properties = compose.NewOMap()
	}
	v := &Validator{properties: properties, patterns: map[string]*patternMatcher{}}
	if err := v.checkDeclarations(properties, nil); err != nil {
		return nil, err
	}
	return v, nil
}

// Validate validates data against the composed model spec. Root, group and
// repeated data with the wrong shape return a *FormInputError and no result. A
// rule parameter a condition selects outside its definition returns a
// *compose.ComposeLoadError and no result.
func (v *Validator) Validate(data any) (ValidationResult, error) {
	root, ok := data.(map[string]any)
	if !ok {
		return ValidationResult{}, &FormInputError{Message: "Form data must be an object"}
	}
	var errors []ValidationError
	call := &callState{uniqueDuplicates: map[string]map[string]bool{}, properties: v.properties, referenceIds: map[string][]member{}}
	if err := v.validateProperties(v.properties, root, nil, nil, nil, root, call, false, &errors); err != nil {
		return ValidationResult{}, err
	}
	hidden := []string{}
	if err := v.collectHidden(v.properties, root, nil, nil, root, &hidden); err != nil {
		return ValidationResult{}, err
	}
	return ValidationResult{Valid: len(errors) == 0, Errors: errors, Hidden: hidden}, nil
}

// collectHidden appends the data paths of the fields whose design.show resolves
// to false, in declaration order, each field of a group row under the row's key
// and the fields inside a hidden field included. Data of another shape is a
// *FormInputError, as in validation.
func (v *Validator) collectHidden(properties *compose.OMap, data map[string]any, currentPath []string, rowKeys []int, allData map[string]any, hidden *[]string) error {
	for name, field := range fieldDeclarations(properties) {
		fieldPath := appendPath(currentPath, name)
		if !v.fieldVisible(field, fieldPath, rowKeys, allData) {
			*hidden = append(*hidden, pathToString(fieldPath))
		}
		children := childProperties(field)
		if fieldType(field) != "group" || children == nil {
			continue
		}
		if !fieldIsMultiple(field) {
			value, err := objectValue(data[name], fieldPath, "Group data must be an object: ")
			if err != nil {
				return err
			}
			if err := v.collectHidden(children, value, fieldPath, rowKeys, allData, hidden); err != nil {
				return err
			}
			continue
		}
		rows, err := objectValue(data[name], fieldPath, "Repeated data must be a keyed object: ")
		if err != nil {
			return err
		}
		for _, key := range sortedKeys(rows) {
			rowPath := appendPath(fieldPath, key)
			row, err := objectValue(rows[key], rowPath, "Group data must be an object: ")
			if err != nil {
				return err
			}
			if err := v.collectHidden(children, row, rowPath, appendRowKey(rowKeys, len(fieldPath)), allData, hidden); err != nil {
				return err
			}
		}
	}
	return nil
}

// fieldRun is one field (or one element of a repeated field) being validated.
type fieldRun struct {
	// field is the field declaration.
	field *compose.OMap
	// path is the data path, row keys included.
	path []string
	// rowKeys are the positions of the row keys in path.
	rowKeys []int
	// declaration is the declaration path, without row keys.
	declaration []string
	// allData is the whole form.
	allData map[string]any
	// call is the state of the validation this field belongs to.
	call *callState
}

// callState belongs to one Validate call and is dropped when it returns.
type callState struct {
	// uniqueDuplicates maps a collection field (container path, field name and filter) to the row
	// keys whose value an earlier row already holds.
	uniqueDuplicates map[string]map[string]bool
	// properties is the composed root field map, which a reference parameter names a field of.
	properties *compose.OMap
	// referenceIds maps each declaration path that reference names to its ids in the data,
	// collected once per validation.
	referenceIds map[string][]member
}

// report appends a failed rule to errors.
func (r fieldRun) report(errors *[]ValidationError, rule, message string, value any) {
	*errors = append(*errors, ValidationError{
		Path: pathToString(r.path), Field: getFieldName(r.path),
		Rule: rule, Message: message, Value: value,
	})
}

// validateProperties recurses a properties map (SPEC §3; JS validateProperties).
// Inside a hidden field (hidden is true) no rule runs, but the data shape is
// still checked.
func (v *Validator) validateProperties(properties *compose.OMap, data map[string]any, currentPath []string, rowKeys []int, declaration []string, allData map[string]any, call *callState, hidden bool, errors *[]ValidationError) error {
	for _, name := range sortedKeys(data) {
		if !properties.Has(name) {
			return &FormInputError{Message: "Unknown form data field: " + pathToString(appendPath(currentPath, name))}
		}
	}
	for _, propertyKey := range properties.Keys() {
		raw, _ := properties.Get(propertyKey)
		field, ok := raw.(*compose.OMap)
		if !ok || field == nil {
			continue
		}

		fieldName := propertyKey
		isMultiple := fieldIsMultiple(field)
		run := fieldRun{field: field, path: appendPath(currentPath, fieldName), rowKeys: rowKeys, declaration: appendPath(declaration, fieldName), allData: allData, call: call}
		fieldPath := run.path
		fieldValue, present := data[fieldName]

		childProps := childProperties(field)

		if isMultiple && present && !isObject(fieldValue) {
			return &FormInputError{Message: "Repeated data must be a keyed object: " + pathToString(fieldPath)}
		}
		if rows, ok := fieldValue.(map[string]any); isMultiple && present && ok {
			if err := checkKeyedMapKeys(field, rows, fieldPath, rowKeys, allData); err != nil {
				return err
			}
		}
		if present && isSingleChoice(field) {
			if err := checkSingleChoiceData(fieldValue, fieldPath, isMultiple); err != nil {
				return err
			}
		}
		// A hidden field's rules and its descendants' rules are not evaluated.
		fieldHidden := hidden || !v.fieldVisible(field, fieldPath, rowKeys, allData)

		if fieldType(field) == "group" && childProps != nil {
			if isMultiple {
				// Keyed rows use sorted-key traversal so the first reported
				// error is identical in every validation implementation. Missing
				// data is an empty collection.
				rows, err := objectValue(fieldValue, fieldPath, "Repeated data must be a keyed object: ")
				if err != nil {
					return err
				}
				for _, key := range sortedKeys(rows) {
					rowPath := appendPath(fieldPath, key)
					row, ok := rows[key].(map[string]any)
					if !ok {
						return &FormInputError{Message: "Group data must be an object: " + pathToString(rowPath)}
					}
					if err := v.validateProperties(childProps, row, rowPath, appendRowKey(rowKeys, len(fieldPath)), run.declaration, allData, call, fieldHidden, errors); err != nil {
						return err
					}
				}
				if !fieldHidden {
					if err := v.validateFieldRules(run, fieldValue, errors); err != nil {
						return err
					}
				}
				continue
			}
			if present && !isObject(fieldValue) {
				return &FormInputError{Message: "Group data must be an object: " + pathToString(fieldPath)}
			}
			if err := v.validateProperties(childProps, asMap(fieldValue), fieldPath, rowKeys, run.declaration, allData, call, fieldHidden, errors); err != nil {
				return err
			}
			if !fieldHidden {
				if err := v.validateFieldRules(run, fieldValue, errors); err != nil {
					return err
				}
			}
			continue
		}

		if fieldHidden {
			continue
		}
		var err error
		if isMultiple && present {
			rows, rowsErr := objectValue(fieldValue, fieldPath, "Repeated data must be a keyed object: ")
			if rowsErr != nil {
				return rowsErr
			}
			err = v.validateMultipleFieldRules(run, rows, errors)
		} else {
			err = v.validateFieldRules(run, fieldValue, errors)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// fieldVisible resolves a field's design.show in its row context like a
// conditional parameter: a condition map selects its value, a ternary its
// branch and a condition expression its result. Only a resolved false hides the
// field; a field without design.show, and a condition map that selects nothing,
// are visible.
func (v *Validator) fieldVisible(field *compose.OMap, path []string, rowKeys []int, allData map[string]any) bool {
	design, ok := fieldDesign(field)
	if !ok || !design.Has("show") {
		return true
	}
	show, _ := design.Get("show")
	resolved, _ := v.resolveRuleValue("show", show, path, rowKeys, allData)
	return resolved != false
}

// fieldDesign returns a field's design object.
func fieldDesign(field *compose.OMap) (*compose.OMap, bool) {
	raw, ok := field.Get("design")
	if !ok {
		return nil, false
	}
	design, ok := raw.(*compose.OMap)
	return design, ok && design != nil
}

// validateMultipleFieldRules runs collection rules on the keyed rows, then row
// rules in sorted row-key order (the cross-runtime error-order contract).
func (v *Validator) validateMultipleFieldRules(run fieldRun, values map[string]any, errors *[]ValidationError) error {
	rules := normalizeValidateSlot(run.field)
	if rules != nil {
		for _, ruleName := range rules.Keys() {
			if !arrayLevelRules[ruleName] {
				continue
			}
			ruleValue, _ := rules.Get(ruleName)
			msg, failed, err := v.runRule(run, ruleName, ruleValue, values)
			if err != nil {
				return err
			}
			if failed {
				run.report(errors, ruleName, msg, values)
				return nil
			}
		}
	}

	for _, key := range sortedKeys(values) {
		element := run
		element.path = appendPath(run.path, key)
		element.rowKeys = appendRowKey(run.rowKeys, len(run.path))
		if err := v.runFieldRules(element, values[key], errors, func(rule string) bool { return !arrayLevelRules[rule] }); err != nil {
			return err
		}
	}
	return nil
}

// validateFieldRules runs all rules for a single (scalar or whole-group) field
// (JS validateFieldRules). First error per field stops the field.
func (v *Validator) validateFieldRules(run fieldRun, value any, errors *[]ValidationError) error {
	return v.runFieldRules(run, value, errors, func(string) bool { return true })
}

// runFieldRules runs the implicit number check, then the declared rules that
// applies selects, and stops at the first failure.
func (v *Validator) runFieldRules(run fieldRun, value any, errors *[]ValidationError, applies func(string) bool) error {
	rules := normalizeValidateSlot(run.field)

	// A type:number field with no explicit number rule runs an implicit number
	// rule first (VALIDATION-RULES §2 — reported as rule "number").
	if fieldType(run.field) == "number" && (rules == nil || !rules.Has("number")) {
		msg, failed, err := v.runRule(run, "number", true, value)
		if err != nil {
			return err
		}
		if failed {
			run.report(errors, "number", msg, value)
			return nil
		}
	}
	failed, err := v.runGroupSource(run, value, errors)
	if err != nil || failed {
		return err
	}
	if rules == nil {
		return nil
	}
	for _, ruleName := range rules.Keys() {
		if !applies(ruleName) {
			continue
		}
		ruleValue, _ := rules.Get(ruleName)
		msg, failed, err := v.runRule(run, ruleName, ruleValue, value)
		if err != nil {
			return err
		}
		if failed {
			run.report(errors, ruleName, msg, value)
			return nil
		}
	}
	return nil
}

// runGroupSource runs the implicit in check of a field whose items is a group source, against the choices that the
// source gives for the data (validation-rules.md, Values). It reports whether it recorded a failure, which stops the
// field.
func (v *Validator) runGroupSource(run fieldRun, value any, errors *[]ValidationError) (bool, error) {
	items, _ := run.field.Get("items")
	source, ok := GroupSourceItems(items)
	if !ok {
		return false, nil
	}
	// A repeated value among the source rows is data that the choices cannot express (CUVR-087).
	if repeat := groupSourceRepeat(source, run.allData); repeat != "" {
		return false, &FormInputError{Message: repeat}
	}
	members, err := groupSourceMembers(source, run.allData)
	if err != nil {
		return false, err
	}
	msg, failed, err := v.runRule(run, "in", members, value)
	if err != nil || !failed {
		return false, err
	}
	run.report(errors, "in", msg, value)
	return true, nil
}

// runRule resolves a (possibly conditional) rule value to an effective param,
// checks a param a condition selected (a literal was already checked at load;
// a value taken from the data is checked here), skips when the result disables the rule
// (false/null), else calls the rule fn (JS runRule). Returns (message, failed),
// or the load failure of a selected param outside its definition.
func (v *Validator) runRule(run fieldRun, ruleName string, ruleValue any, value any) (string, bool, error) {
	effective, selected := v.resolveRuleValue(ruleName, ruleValue, run.path, run.rowKeys, run.allData)

	if selected {
		if perr := v.checkParameter(ruleName, effective); perr != nil {
			return "", false, perr.loadError(run.declaration)
		}
	}

	// A false/null effective param disables the rule (VALIDATION-RULES common §3).
	if disablesRule(effective) {
		return "", false, nil
	}

	fn, ok := getRule(ruleName)
	if !ok {
		// Rule names are checked when the specification loads.
		panic("crudui: rule " + ruleName + " is not registered")
	}

	ctx := ruleContext{
		pathSegments: run.path,
		rowKeys:      run.rowKeys,
		formData:     run.allData,
		call:         run.call,
		messages:     fieldMessages(run.field),
		ruleName:     ruleName,
	}
	if source, ok := effective.(string); ok && patternParamRules[ruleName] {
		ctx.pattern = v.patternFor(source)
	}
	msg, failed := fn(value, effective, ctx)
	return msg, failed, nil
}

// isConditionalRuleValue reports whether a rule value is resolved by a
// condition: a condition map, a ternary expression or a condition expression.
// Path-reference, literal, pattern and membership parameters never are.
func isConditionalRuleValue(ruleName string, ruleValue any) bool {
	if pathReferenceRules[ruleName] || literalParamRules[ruleName] || patternParamRules[ruleName] || membershipParamRules[ruleName] {
		return false
	}
	switch value := ruleValue.(type) {
	case *compose.OMap:
		return value != nil
	case string:
		if _, ok := parseTernary(value); ok {
			return true
		}
		return isConditionExpression(value) && !ternaryRE.MatchString(value) && isValidExpression(value)
	}
	return false
}

// isValidExpression reports whether a string parses as a complete expression;
// any other string is a literal.
func isValidExpression(expression string) bool {
	_, err := expr.Parse(expression)
	return err == nil
}

// resolveRuleValue resolves a rule value to the effective param (G1) and reports
// whether a condition selected it.
//
//   - path-reference / literal-param / regex / membership rules keep their param
//     verbatim.
//   - a condition map (a plain object of expression→value, declaration-ordered):
//     first truthy key's value; else the "true" key; else nil (disabled).
//   - a string: a value-returning ternary, or a plain condition expression.
//   - anything else: a literal param.
func (v *Validator) resolveRuleValue(ruleName string, ruleValue any, path []string, rowKeys []int, allData map[string]any) (any, bool) {
	if !isConditionalRuleValue(ruleName, ruleValue) {
		return ruleValue, false
	}
	switch value := ruleValue.(type) {
	case *compose.OMap:
		return resolveConditionMap(value, path, rowKeys, allData), true
	case string:
		if node, ok := parseTernary(value); ok {
			return expr.NewEvaluator(allData, path, rowKeys).EvaluateValue(node), true
		}
		return evaluateExpressionValue(value, path, rowKeys, allData), true
	}
	return ruleValue, false
}

// resolveConditionMap evaluates a condition map (expressions.md §8): keys in
// declaration order, first truthy key's value wins; else the "true" key; else nil
// (rule disabled). JS resolveConditionMap.
func resolveConditionMap(m *compose.OMap, path []string, rowKeys []int, allData map[string]any) any {
	for _, key := range m.Keys() {
		if key == expr.DefaultKey {
			continue // default evaluated last
		}
		if evaluateCondition(key, path, rowKeys, allData) {
			val, _ := m.Get(key)
			return val
		}
	}
	if m.Has(expr.DefaultKey) {
		val, _ := m.Get(expr.DefaultKey)
		return val
	}
	return nil
}

// parseTernary parses a complete ternary expression. Other strings remain
// literal parameters or condition expressions.
func parseTernary(expression string) (expr.Node, bool) {
	node, err := expr.Parse(expression)
	if err != nil {
		return nil, false
	}
	if _, ok := node.(*expr.TernaryNode); !ok {
		return nil, false
	}
	return node, true
}

// evaluateCondition evaluates a condition string to a boolean (JS
// evaluateCondition wrapper — a parse/eval error is false).
func evaluateCondition(expression string, path []string, rowKeys []int, allData map[string]any) bool {
	ok, err := expr.Evaluate(expression, allData, path, rowKeys)
	if err != nil {
		return false
	}
	return ok
}

// evaluateExpressionValue evaluates a plain expression to its value (JS
// evaluateExpressionValue wrapper — a parse/eval error is false).
func evaluateExpressionValue(expression string, path []string, rowKeys []int, allData map[string]any) any {
	val, err := expr.EvaluateValue(expression, allData, path, rowKeys)
	if err != nil {
		return false
	}
	return val
}

// ---------------------------------------------------------------------------
// Field-shape readers over a composed OMap.
// ---------------------------------------------------------------------------

// fieldType returns a field's "type" string ("" when absent).
func fieldType(field *compose.OMap) string {
	if v, ok := field.Get("type"); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// fieldIsMultiple reports whether a field repeats (multiple: true, only or an object).
func fieldIsMultiple(field *compose.OMap) bool {
	v, ok := field.Get("multiple")
	if !ok {
		return false
	}
	switch value := v.(type) {
	case bool:
		return value
	case string:
		return value == "only"
	case *compose.OMap:
		return value != nil
	}
	return false
}

// childProperties returns a group's child-field map, or nil.
func childProperties(field *compose.OMap) *compose.OMap {
	if v, ok := field.Get("properties"); ok {
		if m, ok := v.(*compose.OMap); ok {
			return m
		}
	}
	return nil
}

// normalizeValidateSlot reads the polymorphic validate slot to a rule map: false /
// true / absent → nil (no rules); an object → the rule map. JS
// normalizeValidateSlot.
func normalizeValidateSlot(field *compose.OMap) *compose.OMap {
	v, ok := field.Get("validate")
	if !ok {
		return nil
	}
	if m, ok := v.(*compose.OMap); ok {
		return m
	}
	return nil // false / true / scalar carry no sub-rules
}

// fieldMessages reads the per-field messages map (rule name → string), or nil.
func fieldMessages(field *compose.OMap) map[string]string {
	v, ok := field.Get("messages")
	if !ok {
		return nil
	}
	m, ok := v.(*compose.OMap)
	if !ok {
		return nil
	}
	out := map[string]string{}
	for _, k := range m.Keys() {
		val, _ := m.Get(k)
		if s, ok := val.(string); ok {
			out[k] = s
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Small value/path utilities.
// ---------------------------------------------------------------------------

// appendPath returns a fresh slice base+seg (never mutates base).
func appendPath(base []string, seg string) []string {
	out := make([]string, len(base)+1)
	copy(out, base)
	out[len(base)] = seg
	return out
}

// isArray reports whether v is a JSON array.
func isArray(v any) bool {
	_, ok := v.([]any)
	return ok
}

// isObject reports whether v is a JSON object (map), not an array.
func isObject(v any) bool {
	_, ok := v.(map[string]any)
	return ok
}

// asMap coerces v to a map; a non-map (or nil) yields an empty map so traversal of
// a missing nested group still runs required rules on its children.
func asMap(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

// objectValue returns the object that data holds at path. Missing data (nil) is a nil
// map; any other value that is not an object is a *FormInputError with message.
func objectValue(data any, path []string, message string) (map[string]any, error) {
	if data == nil {
		return nil, nil
	}
	object, ok := data.(map[string]any)
	if !ok {
		return nil, &FormInputError{Message: message + pathToString(path)}
	}
	return object, nil
}

// appendRowKey returns the row key positions of a path extended by a row key at position.
func appendRowKey(rowKeys []int, position int) []int {
	return append(append([]int{}, rowKeys...), position)
}
