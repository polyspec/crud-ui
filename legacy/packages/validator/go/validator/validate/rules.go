package validate

// Rule registry — a self-contained port of the JS reference rules
// (validator-ts/src/rules); the semantics and default messages mirror the JS engine, which is
// the source the shared 4-language fixture is generated from.
//
// A rule receives the field value, the EFFECTIVE param (already resolved from a
// possibly-conditional rule value by validator.go), and a ruleContext. It returns
// the error message and a failed flag. An empty message with failed=false means
// the rule passed (or was skipped).
//
// Empty-value skip: every rule except required / mincount / maxcount passes on an
// empty value (required is the only rule that fails empty; count rules count an
// empty array as 0). Emptiness, whitespace and canonical text are defined in
// value_whitespace.go and value_text.go; the length, membership and pattern
// rules live in their own rule_*.go files.

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

// ruleContext carries the data a rule needs beyond value + param.
type ruleContext struct {
	// pathSegments is the field's path (its own name included).
	pathSegments []string
	// rowKeys are the positions of the row keys in pathSegments.
	rowKeys []int
	// formData is the whole decoded form (map[string]any / []any / scalars).
	formData map[string]any
	// call is the state of the validation the rule runs in.
	call *callState
	// messages is the per-field custom-message map (rule name → message).
	messages map[string]string
	// ruleName is the invoked rule key (pattern vs match alias preserved).
	ruleName string
	// pattern is the matcher of a pattern or match parameter.
	pattern *patternMatcher
}

// ruleFn validates value with the effective param. Returns (message, failed).
type ruleFn func(value any, ruleParam any, ctx ruleContext) (string, bool)

// builtInRules is the model rule registry. "pattern" aliases "match". Any other
// rule name fails the load with UNKNOWN_RULE.
var builtInRules = map[string]ruleFn{
	"required":      ruleRequired,
	"email":         ruleEmail,
	"minlength":     ruleMinLength,
	"maxlength":     ruleMaxLength,
	"min":           ruleMin,
	"max":           ruleMax,
	"match":         ruleMatch,
	"pattern":       ruleMatch,
	"unique":        ruleUnique,
	"in":            ruleIn,
	"range":         ruleRange,
	"rangelength":   ruleRangeLength,
	"number":        ruleNumber,
	"digits":        ruleDigits,
	"equalTo":       ruleEqualTo,
	"containedIn":   ruleContainedIn,
	"typeFrom":      ruleTypeFrom,
	"minFrom":       ruleMinFrom,
	"maxFrom":       ruleMaxFrom,
	"notEqual":      ruleNotEqual,
	"date":          ruleDate,
	"dateISO":       ruleDateISO,
	"enddate":       ruleEndDate,
	"url":           ruleURL,
	"accept":        ruleAccept,
	"mincount":      ruleMinCount,
	"maxcount":      ruleMaxCount,
	"step":          ruleStep,
	"conditionTree": ruleConditionTree,
	"reference":     ruleReference,
}

// getRule returns the rule fn and whether it is registered.
func getRule(name string) (ruleFn, bool) {
	fn, ok := builtInRules[name]
	return fn, ok
}

// msg returns the per-field message override for rule name, or the fallback.
func (ctx ruleContext) msg(name, fallback string) string {
	if ctx.messages != nil {
		if m, ok := ctx.messages[name]; ok {
			return m
		}
	}
	return fallback
}

// ---------------------------------------------------------------------------
// Value helpers (JS String / Number / toNumber parity).
// ---------------------------------------------------------------------------

// jsString mirrors JS String(value) for the rule layer: strings pass; numbers use
// their canonical text; booleans → "true"/"false"; null → "" (rules only reach
// String() on non-empty values, but keep parity).
func jsString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	}
	if n, ok := numberValue(value); ok {
		return CanonicalNumber(n)
	}
	b, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(b)
}

// ---------------------------------------------------------------------------
// Rules.
// ---------------------------------------------------------------------------

// ruleRequired: fails on an empty value when the effective param is true. The
// effective param is already resolved (a conditional required has been evaluated
// to true/false by validator.go). JS requiredRule returns null unless param ===
// true.
func ruleRequired(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if b, ok := ruleParam.(bool); !ok || !b {
		return "", false
	}
	if isEmpty(value) {
		return ctx.msg("required", "This field is required."), true
	}
	return "", false
}

// emailPattern mirrors the JS EMAIL_PATTERN (RFC 5322 simplified).
var emailPattern = regexp.MustCompile(`^[a-zA-Z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$`)

// isValidEmail mirrors JS isValidEmail: a non-string is invalid; the pattern must
// match; the local part may not start/end with a dot or contain "..".
func isValidEmail(value any) bool {
	s, ok := value.(string)
	if !ok {
		return false
	}
	if !emailPattern.MatchString(s) {
		return false
	}
	local, _, _ := strings.Cut(s, "@")
	if strings.HasPrefix(local, ".") || strings.HasSuffix(local, ".") || strings.Contains(local, "..") {
		return false
	}
	return true
}

// ruleEmail: skipped unless param === true; passes on empty; else email format.
func ruleEmail(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if b, ok := ruleParam.(bool); !ok || !b {
		return "", false
	}
	if isEmpty(value) {
		return "", false
	}
	if !isValidEmail(value) {
		return ctx.msg("email", "Please enter a valid email address."), true
	}
	return "", false
}

// ruleMin fails a value that is not numeric or is below the bound. Empty
// values pass.
func ruleMin(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	bound, _ := numericBound(ruleParam)
	if n, ok := numeric(value); !ok || n < bound {
		return withParameters(ctx.msg("min", "Please enter a value greater than or equal to {0}."), bound), true
	}
	return "", false
}

// ruleMax fails a value that is not numeric or is above the bound. Empty
// values pass.
func ruleMax(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	bound, _ := numericBound(ruleParam)
	if n, ok := numeric(value); !ok || n > bound {
		return withParameters(ctx.msg("max", "Please enter a value less than or equal to {0}."), bound), true
	}
	return "", false
}

// canonicalJSON generates canonical JSON with sorted object keys (for uniqueness).
// The result is deterministic: objects with keys in any order produce the same output.
func canonicalJSON(value any) string {
	switch v := value.(type) {
	case nil:
		return "null"
	case bool:
		if v {
			return "true"
		}
		return "false"
	case string:
		return strconv.Quote(v)
	case float64:
		return CanonicalNumber(v)
	case []any:
		var parts []string
		for _, item := range v {
			parts = append(parts, canonicalJSON(item))
		}
		return "[" + strings.Join(parts, ",") + "]"
	case map[string]any:
		keys := sortedKeys(v)
		var parts []string
		for _, k := range keys {
			parts = append(parts, strconv.Quote(k)+":"+canonicalJSON(v[k]))
		}
		return "{" + strings.Join(parts, ",") + "}"
	default:
		// Fallback for unexpected types. Data is a decoded JSON document, so a value that
		// json.Marshal cannot encode (a channel, a function) is a broken invariant.
		b, err := json.Marshal(value)
		if err != nil {
			panic(fmt.Sprintf("validate: canonicalJSON of %T: %v", value, err))
		}
		return string(b)
	}
}

// comparisonKey builds a uniqueness key. Objects/arrays use their JSON form;
// scalars carry a type tag so the string "1" and the number 1 are NOT duplicates
// (JS comparisonKey is a SameValueZero Set key — distinct JS types differ).
func comparisonKey(value any) string {
	switch v := value.(type) {
	case nil:
		return "z:"
	case string:
		return "s:" + v
	case bool:
		return "b:" + strconv.FormatBool(v)
	default:
		if n, ok := numberValue(v); ok {
			return "n:" + CanonicalNumber(n)
		}
		return "j:" + canonicalJSON(value)
	}
}

// areAllUnique reports whether all values are distinct by comparisonKey.
func areAllUnique(values []any) bool {
	seen := make(map[string]bool, len(values))
	for _, v := range values {
		k := comparisonKey(v)
		if seen[k] {
			return false
		}
		seen[k] = true
	}
	return true
}

// ruleUnique: two modes (JS uniqueRule).
//
//	(1) array-level — the value is an array; non-empty elements must be unique. A
//	    string filter condition restricts which elements participate.
//	(2) item-level — a scalar inside a repeated group; the value must not
//	    duplicate the same field of any EARLIER sibling (error lands on the later
//	    item). A filter condition excludes non-matching items.
func ruleUnique(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if ruleOff(ruleParam) {
		return "", false
	}

	paramStr, paramIsStr := ruleParam.(string)
	isFilter := paramIsStr && isConditionExpression(paramStr)
	errMsg := ctx.msg("unique", "Values must be unique.")

	// Array-level.
	if isArray(value) || isObject(value) {
		var arr []any
		var keys []string
		switch rows := value.(type) {
		case []any:
			arr = rows
			for i := range rows {
				keys = append(keys, strconv.Itoa(i))
			}
		case map[string]any:
			keys = sortedKeys(rows)
			for _, key := range keys {
				arr = append(arr, rows[key])
			}
		}
		var toCheck []any
		switch {
		case isFilter:
			for i, el := range arr {
				itemPath := append(append([]string{}, ctx.pathSegments...), keys[i])
				if !itemPassesCondition(paramStr, itemPath, appendRowKey(ctx.rowKeys, len(ctx.pathSegments)), ctx.formData) {
					continue
				}
				if !isEmpty(el) {
					toCheck = append(toCheck, el)
				}
			}
		case paramIsStr:
			// Param is a field name within array items.
			toCheck = extractFieldValues(arr, paramStr)
		default:
			for _, el := range arr {
				if !isEmpty(el) {
					toCheck = append(toCheck, el)
				}
			}
		}
		if len(toCheck) == 0 {
			return "", false
		}
		if !areAllUnique(toCheck) {
			return errMsg, true
		}
		return "", false
	}

	// Item-level: <containerPath>.<itemKey>.<fieldName>.
	// Linear-time check: precompute all duplicates once per group, then O(1) lookup per row.
	if len(ctx.pathSegments) < 2 {
		return "", false
	}
	fieldName := ctx.pathSegments[len(ctx.pathSegments)-1]
	itemKey := ctx.pathSegments[len(ctx.pathSegments)-2]
	containerPath := ctx.pathSegments[:len(ctx.pathSegments)-2]
	container := expr.ValueAtSegments(ctx.formData, containerPath)

	switch container.(type) {
	case []any:
		if !isNumericKey(itemKey) {
			return "", false
		}
	case map[string]any:
	default:
		return "", false
	}
	if isEmpty(value) {
		return "", false
	}
	if isFilter && !itemPassesCondition(paramStr, ctx.pathSegments, ctx.rowKeys, ctx.formData) {
		return "", false
	}

	// The rows of this collection field are walked once per validation: the filter is evaluated
	// once per row and each row whose value an earlier row holds is recorded.
	filterParam := ""
	if isFilter {
		filterParam = paramStr
	}
	cacheKey := strings.Join(containerPath, "\x00") + "\x00" + fieldName + "\x00" + filterParam
	duplicateSet, cached := ctx.call.uniqueDuplicates[cacheKey]
	if !cached {
		type entry struct {
			key  string
			item any
		}
		var entries []entry
		switch c := container.(type) {
		case []any:
			for i, it := range c {
				entries = append(entries, entry{strconv.Itoa(i), it})
			}
		case map[string]any:
			for _, k := range sortedKeys(c) {
				entries = append(entries, entry{k, c[k]})
			}
		}
		duplicateSet = map[string]bool{}
		seenKeys := map[string]bool{}
		for _, e := range entries {
			itemMap, ok := e.item.(map[string]any)
			if !ok {
				continue
			}
			itemValue, ok := itemMap[fieldName]
			if !ok || isEmpty(itemValue) {
				continue
			}
			if isFilter {
				siblingPath := append(append([]string{}, containerPath...), e.key, fieldName)
				if !itemPassesCondition(paramStr, siblingPath, ctx.rowKeys, ctx.formData) {
					continue
				}
			}
			key := comparisonKey(itemValue)
			if seenKeys[key] {
				duplicateSet[e.key] = true
			}
			seenKeys[key] = true
		}
		ctx.call.uniqueDuplicates[cacheKey] = duplicateSet
	}

	// O(1) lookup: is this row a duplicate?
	if duplicateSet[itemKey] {
		return errMsg, true
	}
	return "", false
}

// extractFieldValues pulls non-empty field values from array items by name (JS
// extractFieldValues). Used when unique's param is a bare field name.
func extractFieldValues(items []any, fieldName string) []any {
	var out []any
	segs := parsePathString(strings.TrimLeft(fieldName, "."))
	for _, it := range items {
		if m, ok := it.(map[string]any); ok {
			v := expr.ValueAtSegments(m, segs)
			if !isEmpty(v) {
				out = append(out, v)
			}
		}
	}
	return out
}

// ruleRange fails a value that is not numeric or is outside [minimum,
// maximum]. Empty values pass.
func ruleRange(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	lo, hi, _ := numericRange(ruleParam)
	if n, ok := numeric(value); !ok || n < lo || n > hi {
		return withParameters(ctx.msg("range", "Please enter a value between {0} and {1}."), lo, hi), true
	}
	return "", false
}

// ruleNumber fails a value that is not numeric. Empty values pass.
func ruleNumber(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	if _, ok := numeric(value); !ok {
		return ctx.msg("number", "Please enter a valid number."), true
	}
	return "", false
}

// ruleDigits fails a value that is not ASCII digit text. Empty values pass.
func ruleDigits(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	if !isDigits(value) {
		return ctx.msg("digits", "Please enter only digits."), true
	}
	return "", false
}

// referencedValue returns the value of the field that the reference parameter of a rule names, and false when
// the rule does not apply: no parameter, or an empty value.
func referencedValue(value any, ruleParam any, ctx ruleContext) (any, bool) {
	if ruleParam == nil || isEmpty(value) {
		return nil, false
	}
	return resolveFieldReference(jsString(ruleParam), ctx.pathSegments, ctx.rowKeys, ctx.formData), true
}

// ruleEqualTo: value must equal a referenced field's value. The param is a field
// reference preserved verbatim. Empty skips. Comparison is strict (JS uses value
// !== targetValue) — the JS engine compares with === (SameValue-ish). We mirror
// that with a typed equality (JS strict equality across decoded JSON types).
func ruleEqualTo(value any, ruleParam any, ctx ruleContext) (string, bool) {
	target, applies := referencedValue(value, ruleParam, ctx)
	if !applies {
		return "", false
	}
	if !strictEquals(value, target) {
		return ctx.msg("equalTo", "Please enter the same value again."), true
	}
	return "", false
}

// ruleContainedIn: a string value must occur in the string value of a referenced field
// (CUVR-075). The param is a field reference preserved verbatim. Empty skips; a value
// or a referenced value that is not a string fails.
func ruleContainedIn(value any, ruleParam any, ctx ruleContext) (string, bool) {
	target, applies := referencedValue(value, ruleParam, ctx)
	if !applies {
		return "", false
	}
	text, isText := value.(string)
	within, isWithin := target.(string)
	if isText && isWithin && strings.Contains(within, text) {
		return "", false
	}
	return ctx.msg("containedIn", "Please enter a value that the referenced field contains."), true
}

// ruleTypeFrom: the value has the type that a referenced field's value names
// (CUVR-077): bool a boolean, int a finite number without a fractional part,
// enum a string. Empty skips; a missing or other type fails.
func ruleTypeFrom(value any, ruleParam any, ctx ruleContext) (string, bool) {
	declared, applies := referencedValue(value, ruleParam, ctx)
	if !applies {
		return "", false
	}
	if hasDeclaredType(value, declared) {
		return "", false
	}
	return ctx.msg("typeFrom", "Please enter a value of the declared type."), true
}

// hasDeclaredType reports whether value has the type that declared names.
func hasDeclaredType(value any, declared any) bool {
	switch declared {
	case "bool":
		_, ok := value.(bool)
		return ok
	case "int":
		if _, isBool := value.(bool); isBool {
			return false
		}
		number, ok := finiteNumber(value)
		return ok && number == math.Trunc(number)
	case "enum":
		_, ok := value.(string)
		return ok
	}
	return false
}

// ruleMinFrom and ruleMaxFrom: a finite number at or above, or at or below, the value of
// a referenced field (CUVR-079). Empty skips; a missing or null bound declares none.
func ruleMinFrom(value any, ruleParam any, ctx ruleContext) (string, bool) {
	return boundFrom(value, ruleParam, ctx, "minFrom", "Please enter a value at or above the declared minimum.", func(v, b float64) bool { return v >= b })
}

func ruleMaxFrom(value any, ruleParam any, ctx ruleContext) (string, bool) {
	return boundFrom(value, ruleParam, ctx, "maxFrom", "Please enter a value at or below the declared maximum.", func(v, b float64) bool { return v <= b })
}

// boundFrom applies a bound read from a referenced field.
func boundFrom(value any, ruleParam any, ctx ruleContext, rule string, fallback string, within func(float64, float64) bool) (string, bool) {
	bound, applies := referencedValue(value, ruleParam, ctx)
	if !applies {
		return "", false
	}
	number, isNumber := finiteBound(value)
	if isNumber && bound == nil {
		return "", false
	}
	limit, isLimit := finiteBound(bound)
	if isNumber && isLimit && within(number, limit) {
		return "", false
	}
	return ctx.msg(rule, fallback), true
}

// finiteBound reports the finite number of a decoded JSON value; a boolean is none.
func finiteBound(value any) (float64, bool) {
	if _, isBool := value.(bool); isBool {
		return 0, false
	}
	return finiteNumber(value)
}

// strictEquals mirrors JS === over decoded JSON values: same JS type and equal.
// Numbers compare numerically across Go numeric types; strings, booleans, null
// compare directly; objects/arrays compare by reference (never equal here).
func strictEquals(a, b any) bool {
	switch av := a.(type) {
	case nil:
		return b == nil
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	}
	an, aok := numberValue(a)
	bn, bok := numberValue(b)
	return aok && bok && an == bn
}

// ruleNotEqual: value must differ from a reference (param starts with '.') or a
// literal. Empty skips. The param is preserved verbatim (JS notEqualRule). The JS
// rule compares with String() coercion.
func ruleNotEqual(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if ruleParam == nil {
		return "", false
	}
	if isEmpty(value) {
		return "", false
	}
	compare, ok := ruleParam.(string)
	if !ok {
		compare = jsString(ruleParam)
	}
	if strings.HasPrefix(compare, ".") {
		target := resolveFieldReference(compare, ctx.pathSegments, ctx.rowKeys, ctx.formData)
		if jsString(value) == jsString(target) {
			return ctx.msg("notEqual", "Please enter a different value."), true
		}
	} else {
		if jsString(value) == compare {
			return ctx.msg("notEqual", "Please enter a different value."), true
		}
	}
	return "", false
}

// dateFormats are the date layouts the date / enddate rules accept.
var dateFormats = []string{
	"2006-01-02",
	"01/02/2006",
	"02/01/2006",
	"2006/01/02",
	"2006-01-02T15:04:05Z07:00",
}

// The date layouts of CUVR-058 and CUVR-059: a trimmed string in one of them, naming a calendar day.
var (
	isoDayPattern   = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})$`)
	dateTimePattern = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$`)
	slashYearFirst  = regexp.MustCompile(`^(\d{4})/(\d{2})/(\d{2})$`)
	slashYearLast   = regexp.MustCompile(`^(\d{2})/(\d{2})/(\d{4})$`)
)

// isCalendarDay reports whether year, month and day name a calendar day that exists.
func isCalendarDay(year, month, day int) bool {
	if month < 1 || month > 12 || day < 1 {
		return false
	}
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	return t.Year() == year && int(t.Month()) == month && t.Day() == day
}

// isDayText reports whether a trimmed text is YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY or DD/MM/YYYY with a calendar day.
func isDayText(text string) bool {
	if m := isoDayPattern.FindStringSubmatch(text); m != nil {
		return isCalendarDay(atoi(m[1]), atoi(m[2]), atoi(m[3]))
	}
	if m := slashYearFirst.FindStringSubmatch(text); m != nil {
		return isCalendarDay(atoi(m[1]), atoi(m[2]), atoi(m[3]))
	}
	if m := slashYearLast.FindStringSubmatch(text); m != nil {
		year := atoi(m[3])
		return isCalendarDay(year, atoi(m[1]), atoi(m[2])) || isCalendarDay(year, atoi(m[2]), atoi(m[1]))
	}
	return false
}

// isDateText is the date rule (CUVR-058) for a trimmed text: a layout of isDayText, or an RFC 3339 date-time with a
// valid time and offset.
func isDateText(text string) bool {
	m := dateTimePattern.FindStringSubmatch(text)
	if m == nil {
		return isDayText(text)
	}
	if !isDayText(m[1]) || atoi(m[2]) > 23 || atoi(m[3]) > 59 || atoi(m[4]) > 59 {
		return false
	}
	return m[5] == "Z" || (atoi(m[5][1:3]) <= 23 && atoi(m[5][4:6]) <= 59)
}

// atoi reads digits the patterns above have matched.
func atoi(digits string) int {
	n, err := strconv.Atoi(digits)
	if err != nil {
		panic(fmt.Sprintf("validate: %q is not digits matched by a date pattern: %v", digits, err))
	}
	return n
}

// ruleDate: a string that is a date (CUVR-058), trimmed. A number is not a date. Empty skips.
func ruleDate(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	text, isText := value.(string)
	if !isText || !isDateText(trimText(text)) {
		return ctx.msg("date", "Please enter a valid date."), true
	}
	return "", false
}

var dateISOPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// ruleDateISO: an ISO-8601 (YYYY-MM-DD) date. Empty skips.
func ruleDateISO(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	text, isText := value.(string)
	if !isText || !dateISOPattern.MatchString(trimText(text)) || !isDayText(trimText(text)) {
		return ctx.msg("dateISO", "Please enter a valid date in ISO format (YYYY-MM-DD)."), true
	}
	return "", false
}

// ruleEndDate: the end date must not be before the referenced start date (same
// day passes). Either side unparseable skips. The param is a field reference.
func ruleEndDate(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if ruleParam == nil {
		return "", false
	}
	if isEmpty(value) {
		return "", false
	}
	end := parseDate(jsString(value))
	if end == nil {
		return "", false
	}
	startRef, ok := ruleParam.(string)
	if !ok {
		startRef = jsString(ruleParam)
	}
	startVal := resolveFieldReference(startRef, ctx.pathSegments, ctx.rowKeys, ctx.formData)
	if isEmpty(startVal) {
		return "", false
	}
	start := parseDate(jsString(startVal))
	if start == nil {
		return "", false
	}
	if end.Before(*start) {
		return ctx.msg("enddate", "End date must be after the start date."), true
	}
	return "", false
}

// ruleURL: a valid http/https/ftp URL with a host. Empty skips.
func ruleURL(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if b, ok := ruleParam.(bool); ok && !b {
		return "", false
	}
	if isEmpty(value) {
		return "", false
	}
	if !isValidURL(jsString(value)) {
		return ctx.msg("url", "Please enter a valid URL."), true
	}
	return "", false
}

// ruleAccept: file MIME/extension validation. The param is a literal preserved
// verbatim (.jpg is NOT a relative reference). Empty skips (JS acceptRule).
func ruleAccept(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if ruleOff(ruleParam) {
		return "", false
	}
	if isEmpty(value) {
		return "", false
	}
	acceptList := parseAcceptParam(ruleParam)
	if len(acceptList) == 0 {
		return "", false
	}

	failMsg := ctx.msg("accept", "Please upload a file with a valid format.")

	switch v := value.(type) {
	case string:
		if strings.Contains(v, "/") {
			if !matchesMimeType(v, acceptList) {
				return failMsg, true
			}
		} else {
			if !matchesExtension(v, acceptList) {
				return failMsg, true
			}
		}
		return "", false
	case []any:
		for _, file := range v {
			if m, ok := file.(map[string]any); ok {
				mime := firstString(m, "type", "mimeType")
				name := firstString(m, "name", "filename")
				valid := (mime != "" && matchesMimeType(mime, acceptList)) ||
					(name != "" && matchesExtension(name, acceptList))
				if !valid {
					return ctx.msg("accept", "Please upload files with valid formats."), true
				}
			}
		}
		return "", false
	case map[string]any:
		mime := firstString(v, "type", "mimeType")
		name := firstString(v, "name", "filename")
		valid := (mime != "" && matchesMimeType(mime, acceptList)) ||
			(name != "" && matchesExtension(name, acceptList))
		if !valid {
			return failMsg, true
		}
		return "", false
	default:
		return "", false
	}
}

// firstString returns the first non-empty string among the given keys.
func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// ruleMinCount fails a value whose count is below the limit. Empty values are
// counted.
func ruleMinCount(value any, ruleParam any, ctx ruleContext) (string, bool) {
	limit, _ := lengthLimit(ruleParam)
	if float64(countOf(value)) < limit {
		return withParameters(ctx.msg("mincount", "Please select at least {0} items."), limit), true
	}
	return "", false
}

// ruleMaxCount fails a value whose count is above the limit. Empty values are
// counted.
func ruleMaxCount(value any, ruleParam any, ctx ruleContext) (string, bool) {
	limit, _ := lengthLimit(ruleParam)
	if float64(countOf(value)) > limit {
		return withParameters(ctx.msg("maxcount", "Please select no more than {0} items."), limit), true
	}
	return "", false
}

// ruleStep fails a value that is not numeric or is not an integer multiple of
// the step counted from 0. Empty values pass.
func ruleStep(value any, ruleParam any, ctx ruleContext) (string, bool) {
	if isEmpty(value) {
		return "", false
	}
	step, _ := stepSize(ruleParam)
	if n, ok := numeric(value); !ok || !isStepMultiple(n, step) {
		return withParameters(ctx.msg("step", "Please enter a value that is a multiple of {0}."), step), true
	}
	return "", false
}
