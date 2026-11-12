//! CRUDUI expression lexer (expressions.md §1, JS/PHP `Lexer` parity).
//!
//! Turns a condition string into a `Vec<Token>` ending in EOF. WHITESPACE is
//! consumed but never emitted. The token order, multi-char operator precedence,
//! multi-dot handling, string escapes, and number rules mirror validator-ts
//! `Lexer` exactly, because the shared fixture's `tokens` array is byte-compared
//! across 4 languages.
//!
//! NO regex-split / no string-split evaluation anywhere (GRAMMAR §10): a single
//! forward scan over the characters of the source, never its bytes (CUXP-024), so
//! a string literal keeps every character and a character that starts no token
//! is one `INVALID` token of that character.

use super::error::ParseError;
use super::token::{Literal, Token, TokenType};

/// Forward-scanning tokenizer over a single expression string.
pub struct Lexer {
    input: Vec<char>,
    position: usize,
}

impl Lexer {
    /// Build a lexer over the given expression string.
    pub fn new(input: &str) -> Self {
        Lexer {
            input: input.chars().collect(),
            position: 0,
        }
    }

    /// Tokenize the whole input. WHITESPACE tokens are dropped; an EOF token is
    /// always appended last.
    pub fn tokenize(&mut self) -> Result<Vec<Token>, ParseError> {
        let mut tokens = Vec::new();

        while !self.is_at_end() {
            let token = self.next_token()?;
            if token.token_type != TokenType::Whitespace {
                tokens.push(token);
            }
        }

        tokens.push(Token::new(TokenType::Eof, "", Literal::None));
        Ok(tokens)
    }

    fn next_token(&mut self) -> Result<Token, ParseError> {
        let start = self.position;

        // Whitespace
        if self.match_whitespace() {
            let raw = self.slice(start, self.position);
            return Ok(Token::new(TokenType::Whitespace, raw, Literal::None));
        }

        // Multi-character operators first (order matters: longest / specific first)
        if self.match_string("not in") || self.match_string("not  in") {
            return Ok(Token::new(TokenType::NotIn, "not in", Literal::None));
        }
        if self.match_string("&&") {
            return Ok(Token::new(TokenType::And, "&&", Literal::None));
        }
        if self.match_string("||") {
            return Ok(Token::new(TokenType::Or, "||", Literal::None));
        }
        if self.match_string("==") {
            return Ok(Token::new(TokenType::Eq, "==", Literal::None));
        }
        if self.match_string("!=") {
            return Ok(Token::new(TokenType::Ne, "!=", Literal::None));
        }
        if self.match_string(">=") {
            return Ok(Token::new(TokenType::Ge, ">=", Literal::None));
        }
        if self.match_string("<=") {
            return Ok(Token::new(TokenType::Le, "<=", Literal::None));
        }
        if self.match_string(">") {
            return Ok(Token::new(TokenType::Gt, ">", Literal::None));
        }
        if self.match_string("<") {
            return Ok(Token::new(TokenType::Lt, "<", Literal::None));
        }

        // NOT operator (single !), only when not part of !=
        if self.peek() == Some('!') && self.peek_next() != Some('=') {
            self.advance();
            return Ok(Token::new(TokenType::Not, "!", Literal::None));
        }

        // Multi-dot (.., ..., etc.) vs single dot
        if self.peek() == Some('.') {
            let mut dot_count: i64 = 0;
            let dot_start = self.position;
            while self.peek() == Some('.') {
                dot_count += 1;
                self.advance();
            }

            if dot_count > 1 {
                let raw = self.slice(dot_start, self.position);
                return Ok(Token::new(
                    TokenType::DotDot,
                    raw,
                    Literal::DotCount(dot_count),
                ));
            }
            return Ok(Token::new(TokenType::Dot, ".", Literal::None));
        }

        if self.match_string("*") {
            return Ok(Token::new(TokenType::Asterisk, "*", Literal::None));
        }
        if self.match_string("(") {
            return Ok(Token::new(TokenType::LParen, "(", Literal::None));
        }
        if self.match_string(")") {
            return Ok(Token::new(TokenType::RParen, ")", Literal::None));
        }
        if self.match_string("[") {
            return Ok(Token::new(TokenType::LBracket, "[", Literal::None));
        }
        if self.match_string("]") {
            return Ok(Token::new(TokenType::RBracket, "]", Literal::None));
        }
        if self.match_string(",") {
            return Ok(Token::new(TokenType::Comma, ",", Literal::None));
        }
        if self.match_string("?") {
            return Ok(Token::new(TokenType::Question, "?", Literal::None));
        }
        if self.match_string(":") {
            return Ok(Token::new(TokenType::Colon, ":", Literal::None));
        }

        // String literal
        let ch = self.peek();
        if ch == Some('\'') || ch == Some('"') {
            return self.read_string();
        }

        // Number: leading digit, or leading '-' directly followed by a digit
        if is_digit(ch) || (ch == Some('-') && is_digit(self.peek_next())) {
            return self.read_number();
        }

        // Keyword / identifier
        if is_alpha(ch) {
            return Ok(self.read_identifier());
        }

        // Unknown single character
        let raw = self.slice(start, start + 1);
        self.advance();
        Ok(Token::new(TokenType::Invalid, raw, Literal::None))
    }

    fn read_string(&mut self) -> Result<Token, ParseError> {
        let Some(quote) = self.advance() else {
            return Err(ParseError::new("Unterminated string literal"));
        };
        let mut value = String::new();

        loop {
            match self.advance() {
                None => return Err(ParseError::new("Unterminated string literal")),
                Some(ch) if ch == quote => break,
                Some('\\') => match self.advance() {
                    Some('n') => value.push('\n'),
                    Some('t') => value.push('\t'),
                    Some('r') => value.push('\r'),
                    // CUXP-024: a backslash before any other character is that character.
                    Some(other) => value.push(other),
                    None => return Err(ParseError::new("Unterminated string literal")),
                },
                Some(ch) => value.push(ch),
            }
        }

        // JS stores value = quote + content + quote (raw), literal = decoded.
        let raw = format!("{quote}{value}{quote}");
        Ok(Token::new(TokenType::String, raw, Literal::Str(value)))
    }

    fn read_number(&mut self) -> Result<Token, ParseError> {
        let start = self.position;

        if self.peek() == Some('-') {
            self.advance();
        }

        while is_digit(self.peek()) {
            self.advance();
        }

        let mut is_float = false;
        if self.peek() == Some('.') && is_digit(self.peek_next()) {
            is_float = true;
            self.advance(); // consume '.'
            while is_digit(self.peek()) {
                self.advance();
            }
        }

        // Scientific notation (JS parity).
        if self.peek() == Some('e') || self.peek() == Some('E') {
            is_float = true;
            self.advance();
            if self.peek() == Some('+') || self.peek() == Some('-') {
                self.advance();
            }
            while is_digit(self.peek()) {
                self.advance();
            }
        }

        let raw = self.slice(start, self.position);

        // Keep integers as integers so fixture integer literals stay integers;
        // fractional/exponent forms become floats.
        let literal = if is_float {
            Literal::Float(parse_float(&raw)?)
        } else {
            match raw.parse::<i64>() {
                Ok(n) => Literal::Int(n),
                // An integer beyond i64 is a float, as in JS; the float parse below
                // cannot fail for digits alone, and it reports the error if it does.
                Err(_) => Literal::Float(parse_float(&raw)?),
            }
        };

        Ok(Token::new(TokenType::Number, raw, literal))
    }

    fn read_identifier(&mut self) -> Token {
        let start = self.position;

        while is_alpha_numeric(self.peek()) {
            self.advance();
        }

        let value = self.slice(start, self.position);

        match value.as_str() {
            "true" => Token::new(TokenType::Boolean, value, Literal::Bool(true)),
            "false" => Token::new(TokenType::Boolean, value, Literal::Bool(false)),
            "null" => Token::new(TokenType::Null, value, Literal::None),
            "in" => Token::new(TokenType::In, value, Literal::None),
            "not" => {
                // Lookahead for "not in" (whitespace then 'in')
                let saved = self.position;
                self.match_whitespace();
                if self.match_string("in") {
                    return Token::new(TokenType::NotIn, "not in", Literal::None);
                }
                self.position = saved;
                Token::new(TokenType::Identifier, value.clone(), Literal::Str(value))
            }
            _ => Token::new(TokenType::Identifier, value.clone(), Literal::Str(value)),
        }
    }

    fn match_whitespace(&mut self) -> bool {
        let mut matched = false;
        while !self.is_at_end() && is_whitespace(self.peek()) {
            self.advance();
            matched = true;
        }
        matched
    }

    fn match_string(&mut self, s: &str) -> bool {
        let mut position = self.position;
        for expected in s.chars() {
            if self.input.get(position) != Some(&expected) {
                return false;
            }
            position += 1;
        }
        self.position = position;
        true
    }

    /// The characters from `start` to `end`, positions of the scan.
    fn slice(&self, start: usize, end: usize) -> String {
        self.input.get(start..end).into_iter().flatten().collect()
    }

    /// The character at the scan position; none past the end.
    fn peek(&self) -> Option<char> {
        self.input.get(self.position).copied()
    }

    /// The character after the scan position; none past the end.
    fn peek_next(&self) -> Option<char> {
        self.input.get(self.position + 1).copied()
    }

    /// The character at the scan position, which the scan passes; none past the end.
    fn advance(&mut self) -> Option<char> {
        let ch = self.peek();
        if ch.is_some() {
            self.position += 1;
        }
        ch
    }

    fn is_at_end(&self) -> bool {
        self.position >= self.input.len()
    }
}

/// The float value of number text; text such as a bare exponent `1e` is an error.
fn parse_float(raw: &str) -> Result<f64, ParseError> {
    raw.parse::<f64>()
        .map_err(|error| ParseError::new(format!("invalid number `{raw}`: {error}")))
}

fn is_digit(c: Option<char>) -> bool {
    c.is_some_and(|c| c.is_ascii_digit())
}

fn is_alpha(c: Option<char>) -> bool {
    c.is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
}

fn is_alpha_numeric(c: Option<char>) -> bool {
    is_alpha(c) || is_digit(c)
}

fn is_whitespace(c: Option<char>) -> bool {
    matches!(c, Some(' ' | '\t' | '\n' | '\r' | '\u{0b}' | '\u{0c}'))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens(source: &str) -> Vec<(TokenType, String)> {
        match Lexer::new(source).tokenize() {
            Ok(tokens) => tokens
                .into_iter()
                .map(|token| (token.token_type, token.value))
                .collect(),
            Err(error) => panic!("{source} does not tokenize: {}", error.message),
        }
    }

    /// CUXP-024: a character that starts no token is one INVALID token of that whole character.
    #[test]
    fn a_character_outside_ascii_is_one_invalid_token() {
        assert_eq!(
            tokens("§é"),
            vec![
                (TokenType::Invalid, "§".to_owned()),
                (TokenType::Invalid, "é".to_owned()),
                (TokenType::Eof, String::new()),
            ]
        );
    }

    /// CUXP-024: a string keeps its characters, and an escape of another character is that character.
    #[test]
    fn a_string_keeps_its_characters() {
        assert_eq!(
            tokens("'Zürich' \"\\é\" '😀'"),
            vec![
                (TokenType::String, "'Zürich'".to_owned()),
                (TokenType::String, "\"é\"".to_owned()),
                (TokenType::String, "'😀'".to_owned()),
                (TokenType::Eof, String::new()),
            ]
        );
    }
}
