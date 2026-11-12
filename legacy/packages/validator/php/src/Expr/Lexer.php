<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * CRUDUI expression lexer (expressions.md §1, JS Lexer parity).
 *
 * Turns a condition string into a Token[] ending in EOF. WHITESPACE is consumed
 * but never emitted. The token order, multi-char operator precedence, multi-dot
 * handling, string escapes, and number rules mirror validator-ts Lexer exactly,
 * because the shared fixture's `tokens` array is byte-compared across 4 languages.
 *
 * NO regex-split / no string-split evaluation anywhere (GRAMMAR §10): this is a
 * single forward scan. PHP identifiers are ASCII (analysis note), so byte-wise
 * scanning is exact.
 */
final class Lexer
{
    private int $position = 0;
    private readonly int $length;

    /** Build a lexer over the given expression string. */
    public function __construct(private readonly string $input)
    {
        $this->length = strlen($input);
    }

    /**
     * Tokenize the whole input. WHITESPACE tokens are dropped; an EOF token is
     * always appended last.
     *
     * @return list<Token>
     */
    public function tokenize(): array
    {
        $tokens = [];

        while (!$this->isAtEnd()) {
            $token = $this->nextToken();
            if ($token->type !== TokenType::WHITESPACE) {
                $tokens[] = $token;
            }
        }

        $tokens[] = new Token(TokenType::EOF, '', null);

        return $tokens;
    }

    private function nextToken(): Token
    {
        $start = $this->position;

        // Whitespace
        if ($this->matchWhitespace()) {
            return new Token(
                TokenType::WHITESPACE,
                substr($this->input, $start, $this->position - $start),
                null,
            );
        }

        // Multi-character operators first (order matters: longest / specific first)
        if ($this->matchString('not in') || $this->matchString('not  in')) {
            return new Token(TokenType::NOT_IN, 'not in', null);
        }
        if ($this->matchString('&&')) {
            return new Token(TokenType::AND, '&&', null);
        }
        if ($this->matchString('||')) {
            return new Token(TokenType::OR, '||', null);
        }
        if ($this->matchString('==')) {
            return new Token(TokenType::EQ, '==', null);
        }
        if ($this->matchString('!=')) {
            return new Token(TokenType::NE, '!=', null);
        }
        if ($this->matchString('>=')) {
            return new Token(TokenType::GE, '>=', null);
        }
        if ($this->matchString('<=')) {
            return new Token(TokenType::LE, '<=', null);
        }
        if ($this->matchString('>')) {
            return new Token(TokenType::GT, '>', null);
        }
        if ($this->matchString('<')) {
            return new Token(TokenType::LT, '<', null);
        }

        // NOT operator (single !), only when not part of !=
        if ($this->peek() === '!' && $this->peekNext() !== '=') {
            $this->advance();
            return new Token(TokenType::NOT, '!', null);
        }

        // Multi-dot (.., ..., etc.) vs single dot
        if ($this->peek() === '.') {
            $dotCount = 0;
            $dotStart = $this->position;
            while ($this->peek() === '.') {
                $dotCount++;
                $this->advance();
            }

            if ($dotCount > 1) {
                return new Token(
                    TokenType::DOT_DOT,
                    substr($this->input, $dotStart, $this->position - $dotStart),
                    $dotCount,
                );
            }

            return new Token(TokenType::DOT, '.', null);
        }

        if ($this->matchString('*')) {
            return new Token(TokenType::ASTERISK, '*', null);
        }
        if ($this->matchString('(')) {
            return new Token(TokenType::LPAREN, '(', null);
        }
        if ($this->matchString(')')) {
            return new Token(TokenType::RPAREN, ')', null);
        }
        if ($this->matchString('[')) {
            return new Token(TokenType::LBRACKET, '[', null);
        }
        if ($this->matchString(']')) {
            return new Token(TokenType::RBRACKET, ']', null);
        }
        if ($this->matchString(',')) {
            return new Token(TokenType::COMMA, ',', null);
        }
        if ($this->matchString('?')) {
            return new Token(TokenType::QUESTION, '?', null);
        }
        if ($this->matchString(':')) {
            return new Token(TokenType::COLON, ':', null);
        }

        // String literal
        $ch = $this->peek();
        if ($ch === "'" || $ch === '"') {
            return $this->readString();
        }

        // Number: leading digit, or leading '-' directly followed by a digit
        if ($this->isDigit($ch) || ($ch === '-' && $this->isDigit($this->peekNext()))) {
            return $this->readNumber();
        }

        // Keyword / identifier
        if ($this->isAlpha($ch)) {
            return $this->readIdentifier();
        }

        // Unknown single character
        $char = $this->advance();
        return new Token(TokenType::INVALID, $char, null);
    }

    private function readString(): Token
    {
        $quote = $this->advance();
        $value = '';

        while (!$this->isAtEnd() && $this->peek() !== $quote) {
            if ($this->peek() === '\\') {
                $this->advance();
                if (!$this->isAtEnd()) {
                    $escaped = $this->advance();
                    $value .= match ($escaped) {
                        'n'  => "\n",
                        't'  => "\t",
                        'r'  => "\r",
                        '\\' => '\\',
                        "'"  => "'",
                        '"'  => '"',
                        default => $escaped,
                    };
                }
            } else {
                $value .= $this->advance();
            }
        }

        if ($this->isAtEnd()) {
            throw new ParseError('Unterminated string literal');
        }

        $this->advance(); // closing quote

        // JS stores value = quote + content + quote (raw), literal = decoded content.
        return new Token(TokenType::STRING, $quote . $value . $quote, $value);
    }

    private function readNumber(): Token
    {
        $start = $this->position;

        if ($this->peek() === '-') {
            $this->advance();
        }

        while ($this->isDigit($this->peek())) {
            $this->advance();
        }

        if ($this->peek() === '.' && $this->isDigit($this->peekNext())) {
            $this->advance(); // consume '.'
            while ($this->isDigit($this->peek())) {
                $this->advance();
            }
        }

        // Scientific notation (JS parity; Go/Rust do not lex this, but the
        // 4-language fixture set avoids exponent cases per analysis note).
        if ($this->peek() === 'e' || $this->peek() === 'E') {
            $this->advance();
            if ($this->peek() === '+' || $this->peek() === '-') {
                $this->advance();
            }
            while ($this->isDigit($this->peek())) {
                $this->advance();
            }
        }

        $value = substr($this->input, $start, $this->position - $start);

        return new Token(TokenType::NUMBER, $value, self::parseNumberLiteral($value));
    }

    /**
     * Parse a numeric literal to int or float. JS uses parseFloat (always
     * float); for JSON byte-parity we keep an int when the source has no
     * fractional/exponent part so the fixture's integer literals stay integers.
     */
    private static function parseNumberLiteral(string $value): int|float
    {
        // An integer literal stays an int while the double it denotes is exact.
        if (preg_match('/^-?\d+$/', $value) === 1 && abs((float) $value) <= 9007199254740992.0) {
            return (int) $value;
        }

        return (float) $value;
    }

    private function readIdentifier(): Token
    {
        $start = $this->position;

        while ($this->isAlphaNumeric($this->peek())) {
            $this->advance();
        }

        $value = substr($this->input, $start, $this->position - $start);

        if ($value === 'true') {
            return new Token(TokenType::BOOLEAN, $value, true);
        }
        if ($value === 'false') {
            return new Token(TokenType::BOOLEAN, $value, false);
        }
        if ($value === 'null') {
            return new Token(TokenType::NULL, $value, null);
        }
        if ($value === 'in') {
            return new Token(TokenType::IN, $value, null);
        }
        if ($value === 'not') {
            // Lookahead for "not in" (whitespace then 'in')
            $saved = $this->position;
            $this->matchWhitespace();
            if ($this->matchString('in')) {
                return new Token(TokenType::NOT_IN, 'not in', null);
            }
            $this->position = $saved;
        }

        return new Token(TokenType::IDENTIFIER, $value, $value);
    }

    private function matchWhitespace(): bool
    {
        $matched = false;
        while (!$this->isAtEnd() && $this->isWhitespace($this->peek())) {
            $this->advance();
            $matched = true;
        }
        return $matched;
    }

    private function matchString(string $str): bool
    {
        $len = strlen($str);
        if (substr($this->input, $this->position, $len) === $str) {
            $this->position += $len;
            return true;
        }
        return false;
    }

    private function peek(): string
    {
        return $this->position < $this->length ? $this->input[$this->position] : "\0";
    }

    private function peekNext(): string
    {
        return ($this->position + 1) < $this->length ? $this->input[$this->position + 1] : "\0";
    }

    private function advance(): string
    {
        $char = $this->position < $this->length ? $this->input[$this->position] : "\0";
        $this->position++;
        return $char;
    }

    private function isAtEnd(): bool
    {
        return $this->position >= $this->length;
    }

    private function isDigit(string $c): bool
    {
        return $c >= '0' && $c <= '9';
    }

    private function isAlpha(string $c): bool
    {
        return ($c >= 'a' && $c <= 'z') || ($c >= 'A' && $c <= 'Z') || $c === '_';
    }

    private function isAlphaNumeric(string $c): bool
    {
        return $this->isAlpha($c) || $this->isDigit($c);
    }

    private function isWhitespace(string $c): bool
    {
        return $c === ' ' || $c === "\t" || $c === "\n" || $c === "\r"
            || $c === "\v" || $c === "\f";
    }
}
