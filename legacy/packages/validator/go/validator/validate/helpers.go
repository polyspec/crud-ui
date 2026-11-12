package validate

// Shared helpers for the model validate engine: path-string parsing, field-reference
// resolution (the verbatim path-param rules equalTo / notEqual / unique / enddate
// need it), the condition-expression heuristic, accept MIME/extension matching,
// date parsing, and URL validation. All mirror the JS reference
// (validator-ts/src/parser/PathResolver.ts, ConditionParser.ts and
// src/rules/accept.ts, date.ts and url.ts).
//
// Field-reference resolution is the ONE piece of path logic this package owns
// directly: the model expr engine resolves paths inside expressions, but a rule param
// that is a verbatim field reference (".password") is not parsed as an expression,
// so it is resolved here with the same relative-path semantics
// (".x" = sibling, "..x" = parent's sibling, array indices not counted as levels).

import (
	"iter"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
	"github.com/polyspec/crudui/packages/validator/go/validator/expr"
)

// parsePathString splits a dotted path string into non-empty segments (JS
// parsePathString).
func parsePathString(pathString string) []string {
	if pathString == "" {
		return nil
	}
	var out []string
	for _, s := range strings.Split(pathString, ".") {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

// resolveFieldReference resolves a field-reference param to its value, mirroring
// JS resolveFieldReference:
//
//   - ".field" / "..field" relative (levelsUp = leadingDots-1), a row being one
//     level.
//   - "a.b.c" (dots inside, no leading dot) from the root.
//   - a bare "field", resolved as ".field".
func resolveFieldReference(expression string, currentPath []string, rowKeys []int, formData map[string]any) any {
	trimmed := trimText(expression)
	if trimmed == "" {
		return nil
	}

	dots := 0
	for dots < len(trimmed) && trimmed[dots] == '.' {
		dots++
	}

	if dots > 0 || !strings.Contains(trimmed, ".") {
		levelsUp := dots - 1
		if levelsUp < 0 {
			levelsUp = 0
		}
		base := expr.RelativeBase(currentPath, rowKeys, levelsUp)
		return expr.ValueAtSegments(formData, append(base, parsePathString(trimmed[dots:])...))
	}
	return expr.ValueAtSegments(formData, parsePathString(trimmed))
}

// conditionOpRE matches an infix comparison/logical/membership operator with
// surrounding whitespace (JS isConditionExpression).
var conditionOpRE = regexp.MustCompile(`\s+(==|!=|>|>=|<|<=|&&|\|\||in|not\s+in)\s+`)

// identDotRE matches an identifier immediately followed by a dot (a.b path form).
var identDotRE = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*\.`)

// ternaryRE matches a ternary "?...:" form anywhere.
var ternaryRE = regexp.MustCompile(`\?.*:`)

// isConditionExpression mirrors JS isConditionExpression: a string is a condition
// when it starts with '.', is an identifier-dot path, contains an infix operator,
// or contains a ternary "?...:".
func isConditionExpression(value string) bool {
	trimmed := trimText(value)
	if strings.HasPrefix(trimmed, ".") {
		return true
	}
	if identDotRE.MatchString(trimmed) {
		return true
	}
	if conditionOpRE.MatchString(trimmed) {
		return true
	}
	if ternaryRE.MatchString(trimmed) {
		return true
	}
	return false
}

// itemPassesCondition evaluates a filter condition as if validating the same field
// on a given item path (JS itemPassesCondition). A parse / evaluation error is
// false (the item does not pass).
func itemPassesCondition(condition string, itemFieldPath []string, rowKeys []int, formData map[string]any) bool {
	ok, err := expr.Evaluate(condition, formData, itemFieldPath, rowKeys)
	if err != nil {
		return false
	}
	return ok
}

// isNumericKey reports whether a path segment is an array index (all digits).
func isNumericKey(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// sortedKeys returns a map's keys in ascending order (deterministic traversal for
// object-key multiple groups, matching the engine's sorted-key traversal).
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// ---------------------------------------------------------------------------
// accept (JS rules/accept parity).
// ---------------------------------------------------------------------------

// extensionToMime maps an extension to its MIME type(s) (JS EXTENSION_TO_MIME).
var extensionToMime = map[string][]string{
	"jpg": {"image/jpeg"}, "jpeg": {"image/jpeg"}, "png": {"image/png"},
	"gif": {"image/gif"}, "webp": {"image/webp"}, "svg": {"image/svg+xml"},
	"bmp": {"image/bmp"}, "ico": {"image/x-icon", "image/vnd.microsoft.icon"},
	"pdf": {"application/pdf"}, "doc": {"application/msword"},
	"docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
	"xls":  {"application/vnd.ms-excel"},
	"xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
	"ppt":  {"application/vnd.ms-powerpoint"},
	"pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
	"txt":  {"text/plain"}, "csv": {"text/csv", "application/csv"},
	"mp3": {"audio/mpeg", "audio/mp3"}, "wav": {"audio/wav", "audio/x-wav"},
	"ogg": {"audio/ogg"}, "flac": {"audio/flac"},
	"mp4": {"video/mp4"}, "webm": {"video/webm"}, "avi": {"video/x-msvideo"},
	"mov": {"video/quicktime"}, "mkv": {"video/x-matroska"},
	"zip": {"application/zip", "application/x-zip-compressed"},
	"rar": {"application/x-rar-compressed", "application/vnd.rar"},
	"tar": {"application/x-tar"}, "gz": {"application/gzip"},
	"7z":   {"application/x-7z-compressed"},
	"json": {"application/json"}, "xml": {"application/xml", "text/xml"},
	"html": {"text/html"}, "css": {"text/css"},
	"js": {"application/javascript", "text/javascript"},
}

// parseAcceptParam normalizes the accept param to a list of MIME entries
// (JS parseAcceptParam): a comma-string splits/trims/lowercases; a known ".ext"
// expands to its MIME(s); an unknown ".ext" is kept verbatim; a MIME ("image/*")
// is kept; an array flattens.
func parseAcceptParam(param any) []string {
	var out []string
	switch p := param.(type) {
	case string:
		for _, raw := range strings.Split(p, ",") {
			part := strings.ToLower(trimText(raw))
			if strings.HasPrefix(part, ".") {
				ext := part[1:]
				if mimes, ok := extensionToMime[ext]; ok {
					out = append(out, mimes...)
				} else {
					out = append(out, part)
				}
			} else if strings.Contains(part, "/") {
				out = append(out, part)
			}
		}
	case []any:
		for _, item := range p {
			out = append(out, parseAcceptParam(item)...)
		}
	}
	return out
}

// matchesMimeType reports whether a MIME type matches the accept list (JS
// matchesMimeType): */* always; type/* prefix; exact MIME; ".ext" entries are
// skipped here (handled by matchesExtension).
func matchesMimeType(mimeType string, acceptList []string) bool {
	normalized := strings.ToLower(mimeType)
	for _, accept := range acceptList {
		if accept == "*/*" {
			return true
		}
		if strings.HasSuffix(accept, "/*") {
			prefix := accept[:len(accept)-1] // drop the trailing *
			if strings.HasPrefix(normalized, prefix) {
				return true
			}
		} else if strings.HasPrefix(accept, ".") {
			continue
		} else if normalized == accept {
			return true
		}
	}
	return false
}

// matchesExtension reports whether a filename's extension matches the accept list
// (JS matchesExtension): a direct ".ext" entry, or the extension's inferred MIME
// matching a MIME entry/wildcard.
func matchesExtension(filename string, acceptList []string) bool {
	parts := strings.Split(strings.ToLower(filename), ".")
	if len(parts) < 2 {
		return false
	}
	ext := parts[len(parts)-1]
	if ext == "" {
		return false
	}
	for _, accept := range acceptList {
		if strings.HasPrefix(accept, ".") && accept[1:] == ext {
			return true
		}
	}
	for _, mime := range extensionToMime[ext] {
		if matchesMimeType(mime, acceptList) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// date / url (JS rules/date|url parity).
// ---------------------------------------------------------------------------

// parseDate tries the accepted date layouts; nil when none parse.
func parseDate(s string) *time.Time {
	for _, f := range dateFormats {
		if t, err := time.Parse(f, s); err == nil {
			return &t
		}
	}
	return nil
}


// isValidURL reports a valid http/https/ftp URL with a host (JS-equivalent URL
// rule semantics).
func isValidURL(s string) bool {
	parsed, err := url.Parse(s)
	if err != nil {
		return false
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" && scheme != "ftp" {
		return false
	}
	return parsed.Host != ""
}

// ruleOff reports whether a rule parameter switches the rule off: an absent parameter
// or false.
func ruleOff(param any) bool {
	if param == nil {
		return true
	}
	b, ok := param.(bool)
	return ok && !b
}

// fieldDeclarations yields the declarations of a properties map in declaration order;
// a member that is not a field declaration is skipped.
func fieldDeclarations(properties *compose.OMap) iter.Seq2[string, *compose.OMap] {
	return func(yield func(string, *compose.OMap) bool) {
		for _, name := range properties.Keys() {
			raw, _ := properties.Get(name)
			field, ok := raw.(*compose.OMap)
			if !ok || field == nil {
				continue
			}
			if !yield(name, field) {
				return
			}
		}
	}
}
