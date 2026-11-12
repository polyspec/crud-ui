package expr

import (
	"regexp"
	"strings"
	"unicode"
)

var expressionIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*\.`)

const expressionSpace = `[\t\n\v\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]`

var expressionOperator = regexp.MustCompile(expressionSpace + `+(==|!=|>|>=|<|<=|&&|\|\||in|not` + expressionSpace + `+in)` + expressionSpace + `+`)
var expressionTernary = regexp.MustCompile(`\?[^\r\n\x{2028}\x{2029}]*:`)

// IsConditionExpression distinguishes expression strings from literal appearance values.
func IsConditionExpression(value any) bool {
	s, ok := value.(string)
	if !ok {
		return false
	}
	s = strings.TrimFunc(s, func(r rune) bool { return r == 0xfeff || (r != 0x85 && unicode.IsSpace(r)) })
	return strings.HasPrefix(s, ".") || expressionIdentifier.MatchString(s) || expressionOperator.MatchString(s) || expressionTernary.MatchString(s)
}
