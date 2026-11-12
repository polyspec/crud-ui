<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * CRUDUI expression parser: Token[] -> AST (expressions.md §3/§4, JS Parser parity).
 *
 * Recursive-descent grammar (EBNF, lowest precedence first):
 *
 *   ternary    = or [ "?" ternary ":" ternary ]        (right-associative)
 *   or         = and { "||" and }
 *   and        = not { "&&" not }
 *   not        = "!" not | comparison
 *   comparison = primary [ cmp_op cmp_value | in_op value_list ]
 *   primary    = "(" or ")" | path | literal
 *   path       = [ "." | ".." ] identifier { "." (identifier | number | "*") }
 *
 * Operator precedence and ternary right-associativity come from the grammar
 * productions, not a heuristic. No eval, no split (GRAMMAR §10).
 */
final class Parser
{
    /**
     * The most nodes on a path from the root of an expression's syntax tree to a
     * leaf. A deeper expression is a parse error in every runtime.
     */
    public const MAX_EXPRESSION_DEPTH = 64;

    private int $current = 0;

    /** Nodes whose children are being parsed: each is an ancestor of what comes next. */
    private int $open = 0;

    /** Height of the node the last parse method returned. */
    private int $height = 0;

    /**
     * Build a parser over a lexer's token stream (must end in EOF).
     *
     * @param list<Token> $tokens
     */
    public function __construct(private readonly array $tokens)
    {
    }

    /**
     * Parse the full token stream into one AST root. Throws on trailing tokens.
     */
    public function parse(): Node
    {
        $expression = $this->parseTernaryExpression();

        if (!$this->isAtEnd()) {
            throw new ParseError('Unexpected token after expression: ' . $this->peek()->value);
        }

        return $expression;
    }

    // ternary = or [ "?" ternary ":" ternary ]  (right-associative)
    private function parseTernaryExpression(): Node
    {
        $condition = $this->parseOrExpression();

        if ($this->match(TokenType::QUESTION)) {
            $conditionHeight = $this->height;
            $this->enter();
            $trueValue = $this->parseTernaryExpression();
            $trueHeight = $this->height;

            if (!$this->match(TokenType::COLON)) {
                throw new ParseError('Missing colon in ternary expression');
            }

            $falseValue = $this->parseTernaryExpression();
            $this->open--;

            $this->node(max($conditionHeight, $trueHeight, $this->height));
            return new TernaryNode($condition, $trueValue, $falseValue);
        }

        return $condition;
    }

    // or = and { "||" and }
    private function parseOrExpression(): Node
    {
        $left = $this->parseAndExpression();
        $height = $this->height;

        while ($this->match(TokenType::OR)) {
            $right = $this->parseAndExpression();
            $height = $this->node(max($height, $this->height));
            $left = new BinaryNode('||', $left, $right);
        }

        return $left;
    }

    // and = not { "&&" not }
    private function parseAndExpression(): Node
    {
        $left = $this->parseNotExpression();
        $height = $this->height;

        while ($this->match(TokenType::AND)) {
            $right = $this->parseNotExpression();
            $height = $this->node(max($height, $this->height));
            $left = new BinaryNode('&&', $left, $right);
        }

        return $left;
    }

    // not = "!" not | comparison
    private function parseNotExpression(): Node
    {
        if ($this->match(TokenType::NOT)) {
            $this->enter();
            $operand = $this->parseNotExpression();
            $this->open--;
            $this->node($this->height);
            return new UnaryNode('!', $operand);
        }

        return $this->parseComparison();
    }

    // comparison = primary [ cmp_op cmp_value | in_op value_list ]
    private function parseComparison(): Node
    {
        $left = $this->parsePrimary();
        $leftHeight = $this->height;

        if ($this->match(TokenType::IN, TokenType::NOT_IN)) {
            $negated = $this->previous()->type === TokenType::NOT_IN;
            $list = $this->parseValueList();
            $this->node($leftHeight);
            return new InNode($negated, $left, $list);
        }

        if (
            $this->match(
                TokenType::EQ,
                TokenType::NE,
                TokenType::GT,
                TokenType::GE,
                TokenType::LT,
                TokenType::LE,
            )
        ) {
            $operator = $this->previous()->value;
            $right = $this->parseComparisonValue();
            $this->node(max($leftHeight, $this->height));
            return new BinaryNode($operator, $left, $right);
        }

        return $left;
    }

    // value_list = "[" value { "," value } "]" | value { "," value }
    /** @return list<Node> */
    private function parseValueList(): array
    {
        $values = [];

        $hasBrackets = $this->match(TokenType::LBRACKET);

        $values[] = $this->parseValueListItem();

        while ($this->match(TokenType::COMMA)) {
            $values[] = $this->parseValueListItem();
        }

        if ($hasBrackets && !$this->match(TokenType::RBRACKET)) {
            throw new ParseError('Missing closing bracket in value list');
        }

        return $values;
    }

    private function parseValueListItem(): Node
    {
        // Unquoted identifiers in an "in" list are string literals.
        if ($this->match(TokenType::IDENTIFIER)) {
            return new LiteralNode('string', $this->previous()->value);
        }

        return $this->literal(TokenType::NUMBER, 'number')
            ?? $this->literal(TokenType::STRING, 'string')
            ?? throw new ParseError('Invalid value in list: ' . $this->peek()->value);
    }

    /** Consume a token of `$type` as a literal of `$valueType`, or leave the input and return null. */
    private function literal(TokenType $type, string $valueType): ?LiteralNode
    {
        if (!$this->match($type)) {
            return null;
        }
        return new LiteralNode($valueType, $this->previous()->literal);
    }

    /**
     * Right-hand side of a comparison. An unquoted identifier with NO following
     * dot is a string literal (`.country == US` → 'US'); an identifier followed
     * by a dot is a path reference, so backtrack and parse it as a path.
     */
    private function parseComparisonValue(): Node
    {
        if ($this->check(TokenType::IDENTIFIER)) {
            $saved = $this->current;
            $this->advance(); // consume identifier

            if (!$this->check(TokenType::DOT)) {
                $this->height = 1;
                return new LiteralNode('string', $this->previous()->value);
            }

            // Followed by a dot → path reference; backtrack.
            $this->current = $saved;
        }

        return $this->parsePrimary();
    }

    // primary = "(" or ")" | path | literal
    private function parsePrimary(): Node
    {
        if ($this->match(TokenType::LPAREN)) {
            $this->enter();
            $expression = $this->parseOrExpression();
            $this->open--;
            if (!$this->match(TokenType::RPAREN)) {
                throw new ParseError('Missing closing parenthesis');
            }
            $this->node($this->height);
            return new GroupNode($expression);
        }

        // A path or a literal is a leaf.
        $this->height = 1;

        if (
            $this->check(TokenType::DOT)
            || $this->check(TokenType::DOT_DOT)
            || $this->check(TokenType::IDENTIFIER)
        ) {
            return $this->parsePath();
        }

        $literal = $this->literal(TokenType::STRING, 'string')
            ?? $this->literal(TokenType::NUMBER, 'number')
            ?? $this->literal(TokenType::BOOLEAN, 'boolean');
        if ($literal !== null) {
            return $literal;
        }

        if ($this->match(TokenType::NULL)) {
            return new LiteralNode('null', null);
        }

        throw new ParseError('Unexpected token in expression: ' . $this->peek()->value);
    }

    // path = relative_path | absolute_path
    private function parsePath(): PathNode
    {
        $relative = false;
        $levelsUp = 0;
        $segments = [];

        if ($this->match(TokenType::DOT_DOT)) {
            $relative = true;
            /** @var int $dots */
            $dots = $this->previous()->literal;
            $levelsUp = $dots - 1;
        } elseif ($this->match(TokenType::DOT)) {
            $relative = true;
            $levelsUp = 0;
        }

        if ($this->match(TokenType::IDENTIFIER)) {
            $segments[] = PathSegment::identifier($this->previous()->value);
        } elseif ($relative) {
            throw new ParseError('Missing field name after dot prefix');
        }

        while ($this->match(TokenType::DOT)) {
            if ($this->match(TokenType::ASTERISK)) {
                $segments[] = PathSegment::wildcard();
            } elseif ($this->match(TokenType::NUMBER)) {
                /** @var int|float $lit */
                $lit = $this->previous()->literal;
                $segments[] = PathSegment::index((int) $lit);
            } elseif ($this->match(TokenType::IDENTIFIER)) {
                $segments[] = PathSegment::identifier($this->previous()->value);
            } else {
                throw new ParseError('Invalid path segment after dot: ' . $this->peek()->value);
            }
        }

        return new PathNode($relative, $levelsUp, $segments);
    }

    /** Open a node whose children follow; the tree is at least one level deeper than the open nodes. */
    private function enter(): void
    {
        $this->open++;
        if ($this->open >= self::MAX_EXPRESSION_DEPTH) {
            throw self::tooDeep();
        }
    }

    /** Record a node whose tallest child has $childHeight as the last parsed node; returns its height. */
    private function node(int $childHeight): int
    {
        $this->height = $childHeight + 1;
        if ($this->height > self::MAX_EXPRESSION_DEPTH) {
            throw self::tooDeep();
        }
        return $this->height;
    }

    private static function tooDeep(): ParseError
    {
        return new ParseError('Expression is nested more than ' . self::MAX_EXPRESSION_DEPTH . ' levels deep');
    }

    private function match(TokenType ...$types): bool
    {
        foreach ($types as $type) {
            if ($this->check($type)) {
                $this->advance();
                return true;
            }
        }
        return false;
    }

    private function check(TokenType $type): bool
    {
        if ($this->isAtEnd()) {
            return false;
        }
        return $this->peek()->type === $type;
    }

    private function advance(): Token
    {
        if (!$this->isAtEnd()) {
            $this->current++;
        }
        return $this->previous();
    }

    private function isAtEnd(): bool
    {
        return $this->peek()->type === TokenType::EOF;
    }

    private function peek(): Token
    {
        return $this->tokens[$this->current];
    }

    private function previous(): Token
    {
        return $this->tokens[$this->current - 1];
    }
}
