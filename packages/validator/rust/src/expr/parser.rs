//! CRUDUI expression parser: `Vec<Token>` → AST (expressions.md §3/§4, JS/PHP
//! `Parser` parity).
//!
//! Recursive-descent grammar (EBNF, lowest precedence first):
//!
//! ```text
//!   ternary    = or [ "?" ternary ":" ternary ]        (right-associative)
//!   or         = and { "||" and }
//!   and        = not { "&&" not }
//!   not        = "!" not | comparison
//!   comparison = primary [ cmp_op cmp_value | in_op value_list ]
//!   primary    = "(" or ")" | path | literal
//!   path       = [ "." | ".." ] identifier { "." (identifier | number | "*") }
//! ```
//!
//! Priority and right-associativity come from the grammar productions, not a
//! heuristic. No eval, no split (GRAMMAR §10).

use serde_json::Number;

use super::ast::{LiteralValue, Node, PathSegment};
use super::error::ParseError;
use super::token::{Literal, Token, TokenType};

/// The most nodes on a path from the root of an expression's syntax tree to a
/// leaf. A deeper expression is a parse error in every runtime.
pub const MAX_EXPRESSION_DEPTH: usize = 64;

/// Recursive-descent parser over a lexer's token stream (must end in EOF).
pub struct Parser {
    tokens: Vec<Token>,
    current: usize,
    /// Nodes whose children are being parsed: each is an ancestor of what comes next.
    open: usize,
    /// Height of the node the last parse method returned.
    height: usize,
}

impl Parser {
    /// Build a parser over a token stream.
    pub fn new(tokens: Vec<Token>) -> Self {
        Parser {
            tokens,
            current: 0,
            open: 0,
            height: 0,
        }
    }

    /// Parse the full token stream into one AST root. Errors on trailing tokens.
    pub fn parse(&mut self) -> Result<Node, ParseError> {
        let expression = self.parse_ternary_expression()?;

        if !self.is_at_end() {
            return Err(ParseError::new(format!(
                "Unexpected token after expression: {}",
                self.peek().value
            )));
        }

        Ok(expression)
    }

    // ternary = or [ "?" ternary ":" ternary ]  (right-associative)
    fn parse_ternary_expression(&mut self) -> Result<Node, ParseError> {
        let condition = self.parse_or_expression()?;

        if self.match_type(TokenType::Question) {
            let condition_height = self.height;
            self.enter()?;
            let true_value = self.parse_ternary_expression()?;
            let true_height = self.height;

            if !self.match_type(TokenType::Colon) {
                return Err(ParseError::new("Missing colon in ternary expression"));
            }

            let false_value = self.parse_ternary_expression()?;
            self.open -= 1;

            self.node(condition_height.max(true_height).max(self.height))?;
            return Ok(Node::Ternary {
                condition: Box::new(condition),
                true_value: Box::new(true_value),
                false_value: Box::new(false_value),
            });
        }

        Ok(condition)
    }

    // or = and { "||" and }
    fn parse_or_expression(&mut self) -> Result<Node, ParseError> {
        let mut left = self.parse_and_expression()?;
        let mut height = self.height;

        while self.match_type(TokenType::Or) {
            let right = self.parse_and_expression()?;
            height = self.node(height.max(self.height))?;
            left = Node::Binary {
                operator: "||".to_string(),
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    // and = not { "&&" not }
    fn parse_and_expression(&mut self) -> Result<Node, ParseError> {
        let mut left = self.parse_not_expression()?;
        let mut height = self.height;

        while self.match_type(TokenType::And) {
            let right = self.parse_not_expression()?;
            height = self.node(height.max(self.height))?;
            left = Node::Binary {
                operator: "&&".to_string(),
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    // not = "!" not | comparison
    fn parse_not_expression(&mut self) -> Result<Node, ParseError> {
        if self.match_type(TokenType::Not) {
            self.enter()?;
            let operand = self.parse_not_expression()?;
            self.open -= 1;
            self.node(self.height)?;
            return Ok(Node::Unary {
                operator: "!".to_string(),
                operand: Box::new(operand),
            });
        }

        self.parse_comparison()
    }

    // comparison = primary [ cmp_op cmp_value | in_op value_list ]
    fn parse_comparison(&mut self) -> Result<Node, ParseError> {
        let left = self.parse_primary()?;
        let left_height = self.height;

        if self.match_any(&[TokenType::In, TokenType::NotIn]) {
            let negated = self.previous().token_type == TokenType::NotIn;
            let list = self.parse_value_list()?;
            self.node(left_height)?;
            return Ok(Node::In {
                negated,
                value: Box::new(left),
                list,
            });
        }

        if self.match_any(&[
            TokenType::Eq,
            TokenType::Ne,
            TokenType::Gt,
            TokenType::Ge,
            TokenType::Lt,
            TokenType::Le,
        ]) {
            let operator = self.previous().value.clone();
            let right = self.parse_comparison_value()?;
            self.node(left_height.max(self.height))?;
            return Ok(Node::Binary {
                operator,
                left: Box::new(left),
                right: Box::new(right),
            });
        }

        Ok(left)
    }

    // value_list = "[" value { "," value } "]" | value { "," value }
    fn parse_value_list(&mut self) -> Result<Vec<Node>, ParseError> {
        let mut values = Vec::new();

        let has_brackets = self.match_type(TokenType::LBracket);

        values.push(self.parse_value_list_item()?);

        while self.match_type(TokenType::Comma) {
            values.push(self.parse_value_list_item()?);
        }

        if has_brackets && !self.match_type(TokenType::RBracket) {
            return Err(ParseError::new("Missing closing bracket in value list"));
        }

        Ok(values)
    }

    fn parse_value_list_item(&mut self) -> Result<Node, ParseError> {
        // Unquoted identifiers in an "in" list are string literals.
        if self.match_type(TokenType::Identifier) {
            return Ok(Node::Literal(LiteralValue::Str(
                self.previous().value.clone(),
            )));
        }

        if self.match_type(TokenType::Number) {
            return Ok(Node::Literal(number_literal(&self.previous().literal)));
        }

        if self.match_type(TokenType::String) {
            return Ok(Node::Literal(LiteralValue::Str(string_literal(
                &self.previous().literal,
            ))));
        }

        Err(ParseError::new(format!(
            "Invalid value in list: {}",
            self.peek().value
        )))
    }

    /// Right-hand side of a comparison. An unquoted identifier with NO following
    /// dot is a string literal (`.country == US` → 'US'); an identifier followed
    /// by a dot is a path reference, so backtrack and parse it as a path.
    fn parse_comparison_value(&mut self) -> Result<Node, ParseError> {
        if self.check(TokenType::Identifier) {
            let saved = self.current;
            self.advance(); // consume identifier

            if !self.check(TokenType::Dot) {
                self.height = 1;
                return Ok(Node::Literal(LiteralValue::Str(
                    self.previous().value.clone(),
                )));
            }

            // Followed by a dot → path reference; backtrack.
            self.current = saved;
        }

        self.parse_primary()
    }

    // primary = "(" or ")" | path | literal
    fn parse_primary(&mut self) -> Result<Node, ParseError> {
        if self.match_type(TokenType::LParen) {
            self.enter()?;
            let expression = self.parse_or_expression()?;
            self.open -= 1;
            if !self.match_type(TokenType::RParen) {
                return Err(ParseError::new("Missing closing parenthesis"));
            }
            self.node(self.height)?;
            return Ok(Node::Group(Box::new(expression)));
        }

        // A path or a literal is a leaf.
        self.height = 1;

        if self.check(TokenType::Dot)
            || self.check(TokenType::DotDot)
            || self.check(TokenType::Identifier)
        {
            return self.parse_path();
        }

        if self.match_type(TokenType::String) {
            return Ok(Node::Literal(LiteralValue::Str(string_literal(
                &self.previous().literal,
            ))));
        }

        if self.match_type(TokenType::Number) {
            return Ok(Node::Literal(number_literal(&self.previous().literal)));
        }

        if self.match_type(TokenType::Boolean) {
            let b = matches!(self.previous().literal, Literal::Bool(true));
            return Ok(Node::Literal(LiteralValue::Bool(b)));
        }

        if self.match_type(TokenType::Null) {
            return Ok(Node::Literal(LiteralValue::Null));
        }

        Err(ParseError::new(format!(
            "Unexpected token in expression: {}",
            self.peek().value
        )))
    }

    // path = relative_path | absolute_path
    fn parse_path(&mut self) -> Result<Node, ParseError> {
        let mut relative = false;
        let mut levels_up: i64 = 0;
        let mut segments: Vec<PathSegment> = Vec::new();

        if self.match_type(TokenType::DotDot) {
            relative = true;
            let dots = match self.previous().literal {
                Literal::DotCount(n) => n,
                _ => 0,
            };
            levels_up = dots - 1;
        } else if self.match_type(TokenType::Dot) {
            relative = true;
            levels_up = 0;
        }

        if self.match_type(TokenType::Identifier) {
            segments.push(PathSegment::Identifier(self.previous().value.clone()));
        } else if relative {
            return Err(ParseError::new("Missing field name after dot prefix"));
        }

        while self.match_type(TokenType::Dot) {
            if self.match_type(TokenType::Asterisk) {
                segments.push(PathSegment::Wildcard);
            } else if self.match_type(TokenType::Number) {
                let index = match &self.previous().literal {
                    Literal::Int(n) => Number::from(*n),
                    Literal::Float(f) => match Number::from_f64(*f) {
                        Some(number) => number,
                        None => {
                            return Err(ParseError::new(format!(
                                "Invalid path segment after dot: {}",
                                self.previous().value
                            )))
                        }
                    },
                    _ => {
                        return Err(ParseError::new(format!(
                            "Invalid path segment after dot: {}",
                            self.previous().value
                        )))
                    }
                };
                segments.push(PathSegment::Index(index));
            } else if self.match_type(TokenType::Identifier) {
                segments.push(PathSegment::Identifier(self.previous().value.clone()));
            } else {
                return Err(ParseError::new(format!(
                    "Invalid path segment after dot: {}",
                    self.peek().value
                )));
            }
        }

        Ok(Node::Path {
            relative,
            levels_up,
            segments,
        })
    }

    /// Open a node whose children follow; the tree is at least one level deeper
    /// than the open nodes.
    fn enter(&mut self) -> Result<(), ParseError> {
        self.open += 1;
        if self.open >= MAX_EXPRESSION_DEPTH {
            return Err(too_deep());
        }
        Ok(())
    }

    /// Record a node whose tallest child has `child_height` as the last parsed
    /// node and return its height.
    fn node(&mut self, child_height: usize) -> Result<usize, ParseError> {
        self.height = child_height + 1;
        if self.height > MAX_EXPRESSION_DEPTH {
            return Err(too_deep());
        }
        Ok(self.height)
    }

    fn match_type(&mut self, t: TokenType) -> bool {
        if self.check(t) {
            self.advance();
            return true;
        }
        false
    }

    fn match_any(&mut self, types: &[TokenType]) -> bool {
        for &t in types {
            if self.check(t) {
                self.advance();
                return true;
            }
        }
        false
    }

    fn check(&self, t: TokenType) -> bool {
        if self.is_at_end() {
            return false;
        }
        self.peek().token_type == t
    }

    fn advance(&mut self) -> &Token {
        if !self.is_at_end() {
            self.current += 1;
        }
        self.previous()
    }

    fn is_at_end(&self) -> bool {
        self.peek().token_type == TokenType::Eof
    }

    fn peek(&self) -> &Token {
        &self.tokens[self.current]
    }

    fn previous(&self) -> &Token {
        &self.tokens[self.current - 1]
    }
}

fn too_deep() -> ParseError {
    ParseError::new(format!(
        "Expression is nested more than {MAX_EXPRESSION_DEPTH} levels deep"
    ))
}

fn number_literal(lit: &Literal) -> LiteralValue {
    match lit {
        Literal::Int(n) => LiteralValue::Int(*n),
        Literal::Float(f) => LiteralValue::Float(*f),
        _ => LiteralValue::Int(0),
    }
}

fn string_literal(lit: &Literal) -> String {
    match lit {
        Literal::Str(s) => s.clone(),
        _ => String::new(),
    }
}
