package expr

import (
	"errors"
	"strconv"
)

// Lexer turns a condition string into a []Token ending in EOF (GRAMMAR §1, JS
// Lexer parity). WHITESPACE is consumed but never emitted. The token order,
// multi-char operator precedence, multi-dot handling, string escapes, and
// number rules mirror validator-ts exactly, because the shared fixture's tokens
// array is byte-compared across 4 languages.
//
// Single forward scan over bytes — no regex split, no string split (GRAMMAR
// §10). Identifiers are ASCII ([A-Za-z_][A-Za-z0-9_]*), so byte scanning is exact.
type Lexer struct {
	input    string
	position int
	length   int
}

// NewLexer builds a lexer over the given expression string.
func NewLexer(input string) *Lexer {
	return &Lexer{input: input, length: len(input)}
}

// Tokenize scans the whole input. WHITESPACE tokens are dropped; an EOF token is
// always appended last.
func (l *Lexer) Tokenize() []Token {
	tokens := make([]Token, 0, 8)

	for !l.isAtEnd() {
		tok := l.nextToken()
		if tok.Type != TokenWhitespace {
			tokens = append(tokens, tok)
		}
	}

	tokens = append(tokens, Token{Type: TokenEOF, Value: "", Literal: nil})
	return tokens
}

func (l *Lexer) nextToken() Token {
	start := l.position

	// Whitespace
	if l.matchWhitespace() {
		return Token{Type: TokenWhitespace, Value: l.input[start:l.position], Literal: nil}
	}

	// Multi-character operators first (order matters: longest / specific first).
	if l.matchString("not in") || l.matchString("not  in") {
		return Token{Type: TokenNotIn, Value: "not in", Literal: nil}
	}
	if l.matchString("&&") {
		return Token{Type: TokenAnd, Value: "&&", Literal: nil}
	}
	if l.matchString("||") {
		return Token{Type: TokenOr, Value: "||", Literal: nil}
	}
	if l.matchString("==") {
		return Token{Type: TokenEQ, Value: "==", Literal: nil}
	}
	if l.matchString("!=") {
		return Token{Type: TokenNE, Value: "!=", Literal: nil}
	}
	if l.matchString(">=") {
		return Token{Type: TokenGE, Value: ">=", Literal: nil}
	}
	if l.matchString("<=") {
		return Token{Type: TokenLE, Value: "<=", Literal: nil}
	}
	if l.matchString(">") {
		return Token{Type: TokenGT, Value: ">", Literal: nil}
	}
	if l.matchString("<") {
		return Token{Type: TokenLT, Value: "<", Literal: nil}
	}

	// NOT operator (single !), only when not part of !=.
	if l.peek() == '!' && l.peekNext() != '=' {
		l.advance()
		return Token{Type: TokenNot, Value: "!", Literal: nil}
	}

	// Multi-dot (.., ..., etc.) vs single dot.
	if l.peek() == '.' {
		dotCount := 0
		dotStart := l.position
		for l.peek() == '.' {
			dotCount++
			l.advance()
		}
		if dotCount > 1 {
			return Token{Type: TokenDotDot, Value: l.input[dotStart:l.position], Literal: dotCount}
		}
		return Token{Type: TokenDot, Value: ".", Literal: nil}
	}

	if l.matchString("*") {
		return Token{Type: TokenAsterisk, Value: "*", Literal: nil}
	}
	if l.matchString("(") {
		return Token{Type: TokenLParen, Value: "(", Literal: nil}
	}
	if l.matchString(")") {
		return Token{Type: TokenRParen, Value: ")", Literal: nil}
	}
	if l.matchString("[") {
		return Token{Type: TokenLBracket, Value: "[", Literal: nil}
	}
	if l.matchString("]") {
		return Token{Type: TokenRBracket, Value: "]", Literal: nil}
	}
	if l.matchString(",") {
		return Token{Type: TokenComma, Value: ",", Literal: nil}
	}
	if l.matchString("?") {
		return Token{Type: TokenQuestion, Value: "?", Literal: nil}
	}
	if l.matchString(":") {
		return Token{Type: TokenColon, Value: ":", Literal: nil}
	}

	// String literal
	ch := l.peek()
	if ch == '\'' || ch == '"' {
		return l.readString()
	}

	// Number: leading digit, or leading '-' directly followed by a digit.
	if isDigit(ch) || (ch == '-' && isDigit(l.peekNext())) {
		return l.readNumber()
	}

	// Keyword / identifier.
	if isAlpha(ch) {
		return l.readIdentifier()
	}

	// Unknown single character.
	c := l.advance()
	return Token{Type: TokenInvalid, Value: string(c), Literal: nil}
}

func (l *Lexer) readString() Token {
	quote := l.advance()
	var sb []byte

	for !l.isAtEnd() && l.peek() != quote {
		if l.peek() == '\\' {
			l.advance()
			if !l.isAtEnd() {
				escaped := l.advance()
				switch escaped {
				case 'n':
					sb = append(sb, '\n')
				case 't':
					sb = append(sb, '\t')
				case 'r':
					sb = append(sb, '\r')
				case '\\':
					sb = append(sb, '\\')
				case '\'':
					sb = append(sb, '\'')
				case '"':
					sb = append(sb, '"')
				default:
					sb = append(sb, escaped)
				}
			}
		} else {
			sb = append(sb, l.advance())
		}
	}

	if l.isAtEnd() {
		panic(&ParseError{Message: "Unterminated string literal"})
	}

	l.advance() // closing quote

	value := string(sb)
	// JS stores Value = quote + content + quote (raw), Literal = decoded content.
	return Token{Type: TokenString, Value: string(quote) + value + string(quote), Literal: value}
}

func (l *Lexer) readNumber() Token {
	start := l.position

	if l.peek() == '-' {
		l.advance()
	}

	for isDigit(l.peek()) {
		l.advance()
	}

	if l.peek() == '.' && isDigit(l.peekNext()) {
		l.advance() // consume '.'
		for isDigit(l.peek()) {
			l.advance()
		}
	}

	// Scientific notation (JS parity; the 4-language fixture avoids exponents).
	if l.peek() == 'e' || l.peek() == 'E' {
		l.advance()
		if l.peek() == '+' || l.peek() == '-' {
			l.advance()
		}
		for isDigit(l.peek()) {
			l.advance()
		}
	}

	value := l.input[start:l.position]
	literal, err := parseNumberLiteral(value)
	if err != nil {
		// A malformed literal such as "1e" is an invalid token, so the parser rejects it.
		return Token{Type: TokenInvalid, Value: value, Literal: nil}
	}
	return Token{Type: TokenNumber, Value: value, Literal: literal}
}

// parseNumberLiteral parses to int or float64. JS uses parseFloat (always
// float); for JSON byte-parity we keep an int when the source has no fractional
// or exponent part so the fixture's integer literals stay integers. An integer
// too large for int, or a float out of range, keeps the value strconv returns
// (the float, as parseFloat does); any other syntax error is returned.
func parseNumberLiteral(value string) (any, error) {
	if isIntegerLiteral(value) {
		n, err := strconv.Atoi(value)
		if err == nil {
			return n, nil
		}
		if !errors.Is(err, strconv.ErrRange) {
			return nil, err
		}
	}
	f, err := strconv.ParseFloat(value, 64)
	if err != nil && !errors.Is(err, strconv.ErrRange) {
		return nil, err
	}
	return f, nil
}

func isIntegerLiteral(value string) bool {
	if value == "" {
		return false
	}
	i := 0
	if value[0] == '-' {
		i = 1
		if len(value) == 1 {
			return false
		}
	}
	for ; i < len(value); i++ {
		if !isDigit(value[i]) {
			return false
		}
	}
	return true
}

func (l *Lexer) readIdentifier() Token {
	start := l.position

	for isAlphaNumeric(l.peek()) {
		l.advance()
	}

	value := l.input[start:l.position]

	switch value {
	case "true":
		return Token{Type: TokenBoolean, Value: value, Literal: true}
	case "false":
		return Token{Type: TokenBoolean, Value: value, Literal: false}
	case "null":
		return Token{Type: TokenNull, Value: value, Literal: nil}
	case "in":
		return Token{Type: TokenIn, Value: value, Literal: nil}
	case "not":
		// Lookahead for "not in" (whitespace then 'in').
		saved := l.position
		l.matchWhitespace()
		if l.matchString("in") {
			return Token{Type: TokenNotIn, Value: "not in", Literal: nil}
		}
		l.position = saved
	}

	return Token{Type: TokenIdentifier, Value: value, Literal: value}
}

func (l *Lexer) matchWhitespace() bool {
	matched := false
	for !l.isAtEnd() && isWhitespace(l.peek()) {
		l.advance()
		matched = true
	}
	return matched
}

func (l *Lexer) matchString(str string) bool {
	n := len(str)
	if l.position+n <= l.length && l.input[l.position:l.position+n] == str {
		l.position += n
		return true
	}
	return false
}

func (l *Lexer) peek() byte {
	if l.position < l.length {
		return l.input[l.position]
	}
	return 0
}

func (l *Lexer) peekNext() byte {
	if l.position+1 < l.length {
		return l.input[l.position+1]
	}
	return 0
}

func (l *Lexer) advance() byte {
	var ch byte
	if l.position < l.length {
		ch = l.input[l.position]
	}
	l.position++
	return ch
}

func (l *Lexer) isAtEnd() bool {
	return l.position >= l.length
}

func isDigit(c byte) bool {
	return c >= '0' && c <= '9'
}

func isAlpha(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_'
}

func isAlphaNumeric(c byte) bool {
	return isAlpha(c) || isDigit(c)
}

func isWhitespace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\v' || c == '\f'
}
