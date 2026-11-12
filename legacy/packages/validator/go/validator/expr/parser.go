package expr

import (
	"fmt"
	"slices"
)

// MaxExpressionDepth is the most nodes on a path from the root of an
// expression's syntax tree to a leaf. A deeper expression is a parse error in
// every runtime.
const MaxExpressionDepth = 64

// ParseError is raised by the lexer or parser on malformed input. It is panicked
// internally and recovered by Parse/Tokenize wrappers into a returned error.
type ParseError struct {
	Message string
}

// Error returns the parse failure message (implements the error interface).
func (e *ParseError) Error() string {
	return e.Message
}

// Parser builds an AST from a token stream (GRAMMAR §3/§4, JS Parser parity).
//
// Recursive descent (EBNF, lowest precedence first):
//
//	ternary    = or [ "?" ternary ":" ternary ]        (right-associative)
//	or         = and { "||" and }
//	and        = not { "&&" not }
//	not        = "!" not | comparison
//	comparison = primary [ cmp_op cmp_value | in_op value_list ]
//	primary    = "(" or ")" | path | literal
//	path       = [ "." | ".." ] identifier { "." (identifier | number | "*") }
//
// Precedence and right-associativity come from the productions, not a heuristic.
// No eval, no split (GRAMMAR §10).
type Parser struct {
	tokens  []Token
	current int
	// open counts nodes whose children are being parsed: each is an ancestor of what comes next.
	open int
	// height is the height of the node the last parse method returned.
	height int
}

// NewParser builds a parser over a lexer's token stream (must end in EOF).
func NewParser(tokens []Token) *Parser {
	return &Parser{tokens: tokens}
}

// Parse parses the full token stream into one AST root. Panics with *ParseError
// on trailing tokens or malformed input; callers use Parse() in expression.go to
// recover into an error.
func (p *Parser) Parse() Node {
	expression := p.parseTernaryExpression()

	if !p.isAtEnd() {
		panic(&ParseError{Message: "Unexpected token after expression: " + p.peek().Value})
	}

	return expression
}

// ternary = or [ "?" ternary ":" ternary ]  (right-associative)
func (p *Parser) parseTernaryExpression() Node {
	condition := p.parseOrExpression()

	if p.match(TokenQuestion) {
		conditionHeight := p.height
		p.enter()
		trueValue := p.parseTernaryExpression()
		trueHeight := p.height

		if !p.match(TokenColon) {
			panic(&ParseError{Message: "Missing colon in ternary expression"})
		}

		falseValue := p.parseTernaryExpression()
		p.open--

		p.node(max(conditionHeight, trueHeight, p.height))
		return &TernaryNode{Condition: condition, TrueValue: trueValue, FalseValue: falseValue}
	}

	return condition
}

// or = and { "||" and }
func (p *Parser) parseOrExpression() Node {
	left := p.parseAndExpression()
	height := p.height

	for p.match(TokenOr) {
		right := p.parseAndExpression()
		height = p.node(max(height, p.height))
		left = &BinaryNode{Operator: "||", Left: left, Right: right}
	}

	return left
}

// and = not { "&&" not }
func (p *Parser) parseAndExpression() Node {
	left := p.parseNotExpression()
	height := p.height

	for p.match(TokenAnd) {
		right := p.parseNotExpression()
		height = p.node(max(height, p.height))
		left = &BinaryNode{Operator: "&&", Left: left, Right: right}
	}

	return left
}

// not = "!" not | comparison
func (p *Parser) parseNotExpression() Node {
	if p.match(TokenNot) {
		p.enter()
		operand := p.parseNotExpression()
		p.open--
		p.node(p.height)
		return &UnaryNode{Operator: "!", Operand: operand}
	}

	return p.parseComparison()
}

// comparison = primary [ cmp_op cmp_value | in_op value_list ]
func (p *Parser) parseComparison() Node {
	left := p.parsePrimary()
	leftHeight := p.height

	if p.match(TokenIn, TokenNotIn) {
		negated := p.previous().Type == TokenNotIn
		list := p.parseValueList()
		p.node(leftHeight)
		return &InNode{Negated: negated, Value: left, List: list}
	}

	if p.match(TokenEQ, TokenNE, TokenGT, TokenGE, TokenLT, TokenLE) {
		operator := p.previous().Value
		right := p.parseComparisonValue()
		p.node(max(leftHeight, p.height))
		return &BinaryNode{Operator: operator, Left: left, Right: right}
	}

	return left
}

// value_list = "[" value { "," value } "]" | value { "," value }
func (p *Parser) parseValueList() []Node {
	values := make([]Node, 0, 2)

	hasBrackets := p.match(TokenLBracket)

	values = append(values, p.parseValueListItem())

	for p.match(TokenComma) {
		values = append(values, p.parseValueListItem())
	}

	if hasBrackets && !p.match(TokenRBracket) {
		panic(&ParseError{Message: "Missing closing bracket in value list"})
	}

	return values
}

func (p *Parser) parseValueListItem() Node {
	// Unquoted identifiers in an "in" list are string literals.
	if p.match(TokenIdentifier) {
		return &LiteralNode{ValueType: "string", Value: p.previous().Value}
	}

	if p.match(TokenNumber) {
		return &LiteralNode{ValueType: "number", Value: p.previous().Literal}
	}

	if p.match(TokenString) {
		return &LiteralNode{ValueType: "string", Value: p.previous().Literal}
	}

	panic(&ParseError{Message: "Invalid value in list: " + p.peek().Value})
}

// parseComparisonValue parses the right-hand side of a comparison. An unquoted
// identifier with NO following dot is a string literal (`.country == US` →
// 'US'); an identifier followed by a dot is a path reference, so backtrack and
// parse it as a path.
func (p *Parser) parseComparisonValue() Node {
	if p.check(TokenIdentifier) {
		saved := p.current
		p.advance() // consume identifier

		if !p.check(TokenDot) {
			p.height = 1
			return &LiteralNode{ValueType: "string", Value: p.previous().Value}
		}

		// Followed by a dot → path reference; backtrack.
		p.current = saved
	}

	return p.parsePrimary()
}

// primary = "(" or ")" | path | literal
func (p *Parser) parsePrimary() Node {
	if p.match(TokenLParen) {
		p.enter()
		expression := p.parseOrExpression()
		p.open--
		if !p.match(TokenRParen) {
			panic(&ParseError{Message: "Missing closing parenthesis"})
		}
		p.node(p.height)
		return &GroupNode{Expression: expression}
	}

	// A path or a literal is a leaf.
	p.height = 1

	if p.check(TokenDot) || p.check(TokenDotDot) || p.check(TokenIdentifier) {
		return p.parsePath()
	}

	if p.match(TokenString) {
		return &LiteralNode{ValueType: "string", Value: p.previous().Literal}
	}

	if p.match(TokenNumber) {
		return &LiteralNode{ValueType: "number", Value: p.previous().Literal}
	}

	if p.match(TokenBoolean) {
		return &LiteralNode{ValueType: "boolean", Value: p.previous().Literal}
	}

	if p.match(TokenNull) {
		return &LiteralNode{ValueType: "null", Value: nil}
	}

	panic(&ParseError{Message: "Unexpected token in expression: " + p.peek().Value})
}

// path = relative_path | absolute_path
func (p *Parser) parsePath() *PathNode {
	relative := false
	levelsUp := 0
	segments := make([]PathSegment, 0, 2)

	if p.match(TokenDotDot) {
		relative = true
		dots, ok := p.previous().Literal.(int)
		if !ok {
			// The lexer sets an int count on every TokenDotDot, so the assertion cannot fail.
			panic(fmt.Sprintf("expr: dot-run token holds %T, not int", p.previous().Literal))
		}
		levelsUp = dots - 1
	} else if p.match(TokenDot) {
		relative = true
		levelsUp = 0
	}

	if p.match(TokenIdentifier) {
		segments = append(segments, PathSegment{Type: "identifier", Value: p.previous().Value})
	} else if relative {
		panic(&ParseError{Message: "Missing field name after dot prefix"})
	}

	for p.match(TokenDot) {
		switch {
		case p.match(TokenAsterisk):
			segments = append(segments, PathSegment{Type: "wildcard"})
		case p.match(TokenNumber):
			segments = append(segments, PathSegment{Type: "index", Index: literalToInt(p.previous().Literal)})
		case p.match(TokenIdentifier):
			segments = append(segments, PathSegment{Type: "identifier", Value: p.previous().Value})
		default:
			panic(&ParseError{Message: "Invalid path segment after dot: " + p.peek().Value})
		}
	}

	return &PathNode{Relative: relative, LevelsUp: levelsUp, Segments: segments}
}

// enter opens a node whose children follow; the tree is at least one level
// deeper than the open nodes.
func (p *Parser) enter() {
	p.open++
	if p.open >= MaxExpressionDepth {
		p.tooDeep()
	}
}

// node records a node whose tallest child has childHeight as the last parsed
// node and returns its height.
func (p *Parser) node(childHeight int) int {
	p.height = childHeight + 1
	if p.height > MaxExpressionDepth {
		p.tooDeep()
	}
	return p.height
}

func (p *Parser) tooDeep() {
	panic(&ParseError{Message: fmt.Sprintf("Expression is nested more than %d levels deep", MaxExpressionDepth)})
}

func literalToInt(lit any) int {
	switch v := lit.(type) {
	case int:
		return v
	case float64:
		return int(v)
	default:
		return 0
	}
}

func (p *Parser) match(types ...TokenType) bool {
	if slices.ContainsFunc(types, p.check) {
		p.advance()
		return true
	}
	return false
}

func (p *Parser) check(t TokenType) bool {
	if p.isAtEnd() {
		return false
	}
	return p.peek().Type == t
}

func (p *Parser) advance() Token {
	if !p.isAtEnd() {
		p.current++
	}
	return p.previous()
}

func (p *Parser) isAtEnd() bool {
	return p.peek().Type == TokenEOF
}

func (p *Parser) peek() Token {
	return p.tokens[p.current]
}

func (p *Parser) previous() Token {
	return p.tokens[p.current-1]
}
