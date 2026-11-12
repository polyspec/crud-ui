// Package expr is the Go model expression engine (expressions.md §0-§7).
//
// Pipeline: string -[Lexer]-> []Token -[Parser]-> Node (AST) -[Evaluator + data]-> value.
// The three stages are separate (GRAMMAR §0): the lexer knows no grammar, the
// parser knows no data, the evaluator knows no string. No eval, no regex/string
// split evaluation (GRAMMAR §10) — a single forward scan plus recursive descent.
//
// The single truth is the shared 4-language fixture
// legacy/tests/fixtures/expr/cases.json (already passing in JS and PHP). Tokens, AST
// shape, and evaluated value/truthy are byte-compatible with the JS reference
// (validator-ts ConditionParser.ts + PathResolver.ts). AST serialization omits
// position (Rust holds none → the 4-language equivalence compares position-free
// nodes).
package expr

// TokenType tags a lexical token (expressions.md §1, JS TokenType parity).
//
// String-valued so a fixture's token.type string ("DOT"|"IDENTIFIER"|...) maps
// directly. WHITESPACE never reaches the token slice (the lexer drops it); EOF
// is always the final token. INVALID is one unrecognized character.
//
// Intentionally absent (GRAMMAR §1·§10): arithmetic + - * / %, function calls,
// method calls, regex, assignment =, bitwise, root path /. Do not add them.
type TokenType string

// The Token* constants enumerate every TokenType the lexer emits
// (expressions.md §1). Their string values are the canonical fixture token
// type names and are byte-compatible with the JS reference. TokenWhitespace and
// TokenInvalid are lexer-internal: WHITESPACE is dropped before the token slice
// and INVALID marks one unrecognized character.
const (
	TokenString     TokenType = "STRING"
	TokenNumber     TokenType = "NUMBER"
	TokenBoolean    TokenType = "BOOLEAN"
	TokenNull       TokenType = "NULL"
	TokenIdentifier TokenType = "IDENTIFIER"
	TokenDot        TokenType = "DOT"
	TokenDotDot     TokenType = "DOT_DOT"
	TokenAsterisk   TokenType = "ASTERISK"
	TokenEQ         TokenType = "EQ"
	TokenNE         TokenType = "NE"
	TokenGT         TokenType = "GT"
	TokenGE         TokenType = "GE"
	TokenLT         TokenType = "LT"
	TokenLE         TokenType = "LE"
	TokenAnd        TokenType = "AND"
	TokenOr         TokenType = "OR"
	TokenNot        TokenType = "NOT"
	TokenIn         TokenType = "IN"
	TokenNotIn      TokenType = "NOT_IN"
	TokenLParen     TokenType = "LPAREN"
	TokenRParen     TokenType = "RPAREN"
	TokenLBracket   TokenType = "LBRACKET"
	TokenRBracket   TokenType = "RBRACKET"
	TokenComma      TokenType = "COMMA"
	TokenQuestion   TokenType = "QUESTION"
	TokenColon      TokenType = "COLON"
	TokenEOF        TokenType = "EOF"
	TokenWhitespace TokenType = "WHITESPACE"
	TokenInvalid    TokenType = "INVALID"
)

// Token is a single lexical token. Value is the raw source text; Literal is the
// parsed value for value tokens (string content, number int/float, bool, the
// dot count for DOT_DOT) and nil otherwise.
//
// No position field: the 4-language token contract excludes positions (the Rust
// AST holds none), matching the shared fixture's token shape.
type Token struct {
	Type    TokenType
	Value   string
	Literal any
}

// ToMap serializes to the shared-fixture token shape {type, value, literal}.
func (t Token) ToMap() map[string]any {
	return map[string]any{
		"type":    string(t.Type),
		"value":   t.Value,
		"literal": t.Literal,
	}
}
