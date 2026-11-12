"""The condition expression parser.

Parses condition expressions like `.field == 'value'`,
`.field1 == 'a' && .field2 > 5`, `items.*.is_close == 0` and
`.is_display in 2,3`. A parsed expression is an abstract syntax tree of Binary,
Unary, In, Path, Literal, Group and Ternary nodes; every node records its
source position. An expression nested more than `MAX_EXPRESSION_DEPTH` levels
deep is a parse error.
"""

import re
from typing import Any, TypeAlias, cast

__all__ = [
    "MAX_EXPRESSION_DEPTH",
    "ParseError",
    "is_condition_expression",
    "parse_condition",
]

MAX_EXPRESSION_DEPTH = 64

# A token of the lexer: its `type`, `value`, `literal` and `position`.
Token: TypeAlias = dict[str, Any]
# A node of the expression tree: its `type` and the members that type declares.
Node: TypeAlias = dict[str, Any]

_WHITESPACE = re.compile(r"\s")


class ParseError(ValueError):
    """A condition expression that does not parse, with its source position."""

    def __init__(
        self,
        message: str,
        position: dict[str, int],
        context: dict[str, Any] | None = None,
    ) -> None:
        context = context or {}
        parts = [message]
        parts.append(
            f"  at line {position['line']}, column {position['column']} (position {position['start']})"
        )
        found = context.get("foundToken")
        if found is not None:
            parts.append(f"  Found: {describe_token(found)}")
        expected = context.get("expected")
        if expected:
            if len(expected) == 1:
                parts.append(f"  Expected: {expected[0]}")
            else:
                parts.append(f"  Expected one of: {', '.join(expected)}")
        if context.get("hint"):
            parts.append(f"  Hint: {context['hint']}")
        super().__init__("\n".join(parts))
        self.name = "ParseError"
        self.position = position
        self.context = context


def describe_token(token: Token) -> str:
    """A human-readable description of a token."""
    kind = token["type"]
    value = token.get("value")
    literal = token.get("literal")
    names = {
        "EOF": "end of expression",
        "NULL": "null",
        "DOT": "dot (.)",
        "ASTERISK": "wildcard (*)",
        "LPAREN": "opening parenthesis (",
        "RPAREN": "closing parenthesis )",
        "LBRACKET": "opening bracket [",
        "RBRACKET": "closing bracket ]",
        "COMMA": "comma (,)",
        "QUESTION": "question mark (?)",
        "COLON": "colon (:)",
        "AND": "AND operator (&&)",
        "OR": "OR operator (||)",
        "NOT": "NOT operator (!)",
        "EQ": "equality operator (==)",
        "NE": "not-equal operator (!=)",
        "GT": "greater-than operator (>)",
        "GE": "greater-or-equal operator (>=)",
        "LT": "less-than operator (<)",
        "LE": "less-or-equal operator (<=)",
        "IN": "IN operator",
        "NOT_IN": "NOT IN operator",
        "INVALID": f'invalid character "{value}"',
    }
    if kind in names:
        return names[kind]
    if kind == "STRING":
        return f'string "{literal}"'
    if kind == "NUMBER":
        return f"number {literal}"
    if kind == "BOOLEAN":
        return f"boolean {literal}"
    if kind == "IDENTIFIER":
        return f'identifier "{value}"'
    if kind == "DOT_DOT":
        return f"dots ({'.' * cast(int, literal)})"
    return f'"{value}"'


class _Lexer:
    """The tokenizer of condition expressions."""

    _SIMPLE = (
        ("not in", "NOT_IN"),
        ("&&", "AND"),
        ("||", "OR"),
        ("==", "EQ"),
        ("!=", "NE"),
        (">=", "GE"),
        ("<=", "LE"),
        (">", "GT"),
        ("<", "LT"),
        ("*", "ASTERISK"),
        ("(", "LPAREN"),
        (")", "RPAREN"),
        ("[", "LBRACKET"),
        ("]", "RBRACKET"),
        (",", "COMMA"),
        ("?", "QUESTION"),
        (":", "COLON"),
    )

    def __init__(self, source: str) -> None:
        self.source = source
        self.position = 0
        self.line = 1
        self.column = 1

    def tokenize(self) -> list[Token]:
        """Every token of the source, whitespace dropped, ending with EOF."""
        tokens = []
        while not self._at_end():
            token = self._next_token()
            if token["type"] != "WHITESPACE":
                tokens.append(token)
        tokens.append(self._token("EOF", "", None))
        return tokens

    def _next_token(self) -> Token:
        start = self.position
        if self._match_whitespace():
            return self._token("WHITESPACE", self.source[start : self.position], None)
        for text, kind in self._SIMPLE:
            if self.source.startswith(text, self.position):
                for _ in text:
                    self._advance()
                return self._token(kind, text, None)
        if self.source.startswith("not  in", self.position):
            for _ in "not  in":
                self._advance()
            return self._token("NOT_IN", "not in", None)
        # NOT operator (single !)
        if self._peek() == "!" and self._peek_next() != "=":
            self._advance()
            return self._token("NOT", "!", None)
        # Multi-dot (.., ..., etc.)
        if self._peek() == ".":
            dot_start = self.position
            dot_count = 0
            while self._peek() == ".":
                dot_count += 1
                self._advance()
            if dot_count > 1:
                return self._token(
                    "DOT_DOT", self.source[dot_start : self.position], dot_count
                )
            return self._token("DOT", ".", None)
        if self._peek() in ("'", '"'):
            return self._read_string()
        if self._peek().isdigit() or (
            self._peek() == "-" and self._peek_next().isdigit()
        ):
            return self._read_number()
        if self._is_alpha(self._peek()):
            return self._read_identifier()
        character = self._advance()
        return self._token("INVALID", character, None)

    def _read_string(self) -> Token:
        quote = self._advance()
        start = self.position
        value = ""
        while not self._at_end() and self._peek() != quote:
            if self._peek() == "\\":
                self._advance()
                if not self._at_end():
                    escaped = self._advance()
                    value += {
                        "n": "\n",
                        "t": "\t",
                        "r": "\r",
                        "\\": "\\",
                        "'": "'",
                        '"': '"',
                    }.get(escaped, escaped)
            else:
                value += self._advance()
        if self._at_end():
            raise ParseError(
                "Unterminated string literal",
                self._position_at(start),
                {
                    "phase": "lexer",
                    "expected": [f"closing {quote} quote"],
                    "hint": (
                        f"String starting at position {start - 1} was not closed. "
                        f"Add a {quote} at the end."
                    ),
                },
            )
        self._advance()  # closing quote
        return self._token("STRING", quote + value + quote, value)

    def _read_number(self) -> Token:
        start = self.position
        if self._peek() == "-":
            self._advance()
        while self._peek().isdigit():
            self._advance()
        if self._peek() == "." and self._peek_next().isdigit():
            self._advance()
            while self._peek().isdigit():
                self._advance()
        if self._peek() in ("e", "E"):
            self._advance()
            if self._peek() in ("+", "-"):
                self._advance()
            while self._peek().isdigit():
                self._advance()
        value = self.source[start : self.position]
        return self._token("NUMBER", value, float(value))

    def _read_identifier(self) -> Token:
        start = self.position
        while self._is_alpha_numeric(self._peek()):
            self._advance()
        value = self.source[start : self.position]
        if value == "true":
            return self._token("BOOLEAN", value, True)
        if value == "false":
            return self._token("BOOLEAN", value, False)
        if value == "null":
            return self._token("NULL", value, None)
        if value == "in":
            return self._token("IN", value, None)
        if value == "not":
            saved = (self.position, self.line, self.column)
            self._match_whitespace()
            if self.source.startswith("in", self.position):
                for _ in "in":
                    self._advance()
                return self._token("NOT_IN", "not in", None)
            self.position, self.line, self.column = saved
        return self._token("IDENTIFIER", value, value)

    def _match_whitespace(self) -> bool:
        matched = False
        while not self._at_end() and _WHITESPACE.match(self._peek()):
            self._advance()
            matched = True
        return matched

    def _peek(self) -> str:
        return self.source[self.position] if self.position < len(self.source) else "\0"

    def _peek_next(self) -> str:
        next_position = self.position + 1
        return self.source[next_position] if next_position < len(self.source) else "\0"

    def _advance(self) -> str:
        character = self._peek()
        self.position += 1
        if character == "\n":
            self.line += 1
            self.column = 1
        else:
            self.column += 1
        return character

    def _at_end(self) -> bool:
        return self.position >= len(self.source)

    @staticmethod
    def _is_alpha(character: str) -> bool:
        return "a" <= character <= "z" or "A" <= character <= "Z" or character == "_"

    def _is_alpha_numeric(self, character: str) -> bool:
        return self._is_alpha(character) or character.isdigit()

    def _position_at(self, start: int) -> dict[str, int]:
        return {
            "start": start,
            "end": self.position,
            "line": self.line,
            "column": self.column,
        }

    def _token(self, kind: str, value: str, literal: object) -> Token:
        return {
            "type": kind,
            "value": value,
            "literal": literal,
            "position": {
                "start": self.position - len(str(value)),
                "end": self.position,
                "line": self.line,
                "column": self.column - len(str(value)),
            },
        }


class _Parser:
    """The recursive-descent parser building the syntax tree."""

    def __init__(self, tokens: list[Token]) -> None:
        self.tokens = tokens
        self.current = 0
        self.partial_ast: Node | None = None
        # Nodes being parsed whose children are still open: each is an ancestor of what comes next.
        self.open = 0
        # Height of the node the last parse method returned.
        self.height = 0

    def parse(self) -> Node:
        expression = self._parse_ternary()
        self.partial_ast = expression
        if not self._at_end():
            token = self._peek()
            raise ParseError(
                "Unexpected token after expression",
                token["position"],
                {
                    "foundToken": token,
                    "expected": ["end of expression"],
                    "phase": "parser",
                    "partialAST": self.partial_ast,
                    "hint": (
                        "The expression appears complete, but there are additional tokens. "
                        "Check for missing operators or extra characters."
                    ),
                },
            )
        return expression

    # ternary_expression = or_expression [ "?" ternary_expression ":" ternary_expression ]
    def _parse_ternary(self) -> Node:
        condition = self._parse_or()
        self.partial_ast = condition
        if self._match("QUESTION"):
            condition_height = self.height
            self._enter()
            true_value = self._parse_ternary()
            true_height = self.height
            if not self._match("COLON"):
                token = self._peek()
                raise ParseError(
                    "Missing colon in ternary expression",
                    token["position"],
                    {
                        "foundToken": token,
                        "expected": ["colon (:)"],
                        "phase": "parser",
                        "partialAST": condition,
                        "hint": "Ternary expressions require the format: condition ? trueValue : falseValue",
                    },
                )
            false_value = self._parse_ternary()
            self.open -= 1
            return self._node(
                max(condition_height, true_height, self.height),
                {
                    "type": "Ternary",
                    "condition": condition,
                    "trueValue": true_value,
                    "falseValue": false_value,
                    "position": {
                        "start": condition["position"]["start"],
                        "end": false_value["position"]["end"],
                    },
                },
            )
        return condition

    # or_expression = and_expression { "||" and_expression }
    def _parse_or(self) -> Node:
        left = self._parse_and()
        height = self.height
        while self._match("OR"):
            right = self._parse_and()
            left = self._node(
                max(height, self.height),
                {
                    "type": "Binary",
                    "operator": "||",
                    "left": left,
                    "right": right,
                    "position": {
                        "start": left["position"]["start"],
                        "end": right["position"]["end"],
                    },
                },
            )
            height = self.height
        return left

    # and_expression = not_expression { "&&" not_expression }
    def _parse_and(self) -> Node:
        left = self._parse_not()
        height = self.height
        while self._match("AND"):
            right = self._parse_not()
            left = self._node(
                max(height, self.height),
                {
                    "type": "Binary",
                    "operator": "&&",
                    "left": left,
                    "right": right,
                    "position": {
                        "start": left["position"]["start"],
                        "end": right["position"]["end"],
                    },
                },
            )
            height = self.height
        return left

    # not_expression = "!" not_expression | comparison
    def _parse_not(self) -> Node:
        if self._match("NOT"):
            start = self._previous()["position"]["start"]
            self._enter()
            operand = self._parse_not()
            self.open -= 1
            return self._node(
                self.height,
                {
                    "type": "Unary",
                    "operator": "!",
                    "operand": operand,
                    "position": {"start": start, "end": operand["position"]["end"]},
                },
            )
        return self._parse_comparison()

    # comparison = primary [ comparison_op value | in_op value_list ]
    def _parse_comparison(self) -> Node:
        left = self._parse_primary()
        left_height = self.height
        if self._match("IN", "NOT_IN"):
            negated = self._previous()["type"] == "NOT_IN"
            items = self._parse_value_list()
            last = items[-1] if items else left
            return self._node(
                left_height,
                {
                    "type": "In",
                    "negated": negated,
                    "value": left,
                    "list": items,
                    "position": {
                        "start": left["position"]["start"],
                        "end": last["position"]["end"],
                    },
                },
            )
        if self._match("EQ", "NE", "GT", "GE", "LT", "LE"):
            operator = self._previous()["value"]
            # The right side allows unquoted identifiers as string literals.
            right = self._parse_comparison_value()
            return self._node(
                max(left_height, self.height),
                {
                    "type": "Binary",
                    "operator": operator,
                    "left": left,
                    "right": right,
                    "position": {
                        "start": left["position"]["start"],
                        "end": right["position"]["end"],
                    },
                },
            )
        return left

    # value_list = "[" value { "," value } "]" | value { "," value }
    def _parse_value_list(self) -> list[Node]:
        values = []
        has_brackets = self._match("LBRACKET")
        values.append(self._parse_value_list_item())
        while self._match("COMMA"):
            values.append(self._parse_value_list_item())
        if has_brackets and not self._match("RBRACKET"):
            token = self._peek()
            raise ParseError(
                "Missing closing bracket in value list",
                token["position"],
                {
                    "foundToken": token,
                    "expected": ["closing bracket (])"],
                    "phase": "parser",
                    "hint": (
                        "List started with '[' but was not closed. "
                        f"Found {len(values)} value(s) so far."
                    ),
                },
            )
        return values

    def _parse_value_list_item(self) -> Node:
        token = self._peek()
        # For the "in" operator, unquoted identifiers are treated as strings.
        if self._match("IDENTIFIER"):
            previous = self._previous()
            return {
                "type": "Literal",
                "valueType": "string",
                "value": previous["value"],
                "position": previous["position"],
            }
        if self._match("NUMBER"):
            previous = self._previous()
            return {
                "type": "Literal",
                "valueType": "number",
                "value": previous["literal"],
                "position": previous["position"],
            }
        if self._match("STRING"):
            previous = self._previous()
            return {
                "type": "Literal",
                "valueType": "string",
                "value": previous["literal"],
                "position": previous["position"],
            }
        raise ParseError(
            "Invalid value in list",
            token["position"],
            {
                "foundToken": token,
                "expected": ["identifier", "number", "string"],
                "phase": "parser",
                "hint": 'Values in an "in" list must be identifiers, numbers, or quoted strings.',
            },
        )

    def _parse_comparison_value(self) -> Node:
        """The right side of a comparison: a lone identifier is a string literal."""
        if self._check("IDENTIFIER"):
            current = self.current
            self._advance()
            if not self._check("DOT"):
                previous = self._previous()
                self.height = 1
                return {
                    "type": "Literal",
                    "valueType": "string",
                    "value": previous["value"],
                    "position": previous["position"],
                }
            self.current = current
        return self._parse_primary()

    # primary = path | literal | "(" expression ")"
    def _parse_primary(self) -> Node:
        if self._match("LPAREN"):
            start = self._previous()["position"]["start"]
            self._enter()
            expression = self._parse_or()
            self.open -= 1
            if not self._match("RPAREN"):
                token = self._peek()
                raise ParseError(
                    "Missing closing parenthesis",
                    token["position"],
                    {
                        "foundToken": token,
                        "expected": ["closing parenthesis )"],
                        "phase": "parser",
                        "partialAST": expression,
                        "hint": (
                            "Opening parenthesis was found but not closed. "
                            "Check for matching parentheses."
                        ),
                    },
                )
            return self._node(
                self.height,
                {
                    "type": "Group",
                    "expression": expression,
                    "position": {
                        "start": start,
                        "end": self._previous()["position"]["end"],
                    },
                },
            )
        # A path or a literal is a leaf.
        self.height = 1
        if self._check("DOT") or self._check("DOT_DOT") or self._check("IDENTIFIER"):
            return self._parse_path()
        for kind, value_type in (
            ("STRING", "string"),
            ("NUMBER", "number"),
            ("BOOLEAN", "boolean"),
            ("NULL", "null"),
        ):
            if self._match(kind):
                previous = self._previous()
                return {
                    "type": "Literal",
                    "valueType": value_type,
                    "value": previous["literal"],
                    "position": previous["position"],
                }
        token = self._peek()
        raise ParseError(
            "Unexpected token in expression",
            token["position"],
            {
                "foundToken": token,
                "expected": [
                    "path (.field)",
                    "literal (string, number, boolean, null)",
                    "grouped expression (...)",
                ],
                "phase": "parser",
                "partialAST": self.partial_ast,
                "hint": "Expected a value, field reference, or grouped expression.",
            },
        )

    # path = relative_path | absolute_path
    def _parse_path(self) -> Node:
        start = self._peek()["position"]["start"]
        relative = False
        levels_up = 0
        segments = []
        if self._match("DOT_DOT"):
            relative = True
            levels_up = self._previous()["literal"] - 1
        elif self._match("DOT"):
            relative = True
            levels_up = 0
        if self._match("IDENTIFIER"):
            segments.append({"type": "identifier", "value": self._previous()["value"]})
        elif relative:
            token = self._peek()
            raise ParseError(
                "Missing field name after dot prefix",
                token["position"],
                {
                    "foundToken": token,
                    "expected": ["identifier (field name)"],
                    "phase": "parser",
                    "hint": (
                        "A dot prefix must be followed by a field name, e.g., "
                        '".fieldName" or "..parentField".'
                    ),
                },
            )
        while self._match("DOT"):
            if self._match("ASTERISK"):
                segments.append({"type": "wildcard"})
            elif self._match("NUMBER"):
                segments.append({"type": "index", "value": self._previous()["literal"]})
            elif self._match("IDENTIFIER"):
                segments.append(
                    {"type": "identifier", "value": self._previous()["value"]}
                )
            else:
                token = self._peek()
                raise ParseError(
                    "Invalid path segment after dot",
                    token["position"],
                    {
                        "foundToken": token,
                        "expected": [
                            "identifier (field name)",
                            "number (array index)",
                            "wildcard (*)",
                        ],
                        "phase": "parser",
                        "hint": (
                            "Path segments after '.' must be a field name, array index, or "
                            f"wildcard. Got: {describe_token(token)}"
                        ),
                    },
                )
        end = self._previous()["position"]["end"]
        return {
            "type": "Path",
            "relative": relative,
            "levelsUp": levels_up,
            "segments": segments,
            "position": {"start": start, "end": end},
        }

    def _enter(self) -> None:
        """Open a node whose children follow; the tree is at least one level deeper."""
        self.open += 1
        if self.open >= MAX_EXPRESSION_DEPTH:
            self._too_deep()

    def _node(self, child_height: int, node: Node) -> Node:
        """Record a node whose tallest child has `child_height`."""
        self.height = child_height + 1
        if self.height > MAX_EXPRESSION_DEPTH:
            self._too_deep()
        return node

    def _too_deep(self) -> bool:
        token = self._peek()
        raise ParseError(
            f"Expression is nested more than {MAX_EXPRESSION_DEPTH} levels deep",
            token["position"],
            {
                "foundToken": token,
                "phase": "parser",
                "hint": "Split the condition or remove redundant parentheses and negations.",
            },
        )

    def _match(self, *types: str) -> bool:
        for kind in types:
            if self._check(kind):
                self._advance()
                return True
        return False

    def _check(self, kind: str) -> bool:
        if self._at_end():
            return False
        return bool(self._peek()["type"] == kind)

    def _advance(self) -> Token:
        if not self._at_end():
            self.current += 1
        return self._previous()

    def _at_end(self) -> bool:
        return bool(self._peek()["type"] == "EOF")

    def _peek(self) -> Token:
        return self.tokens[self.current]

    def _previous(self) -> Token:
        return self.tokens[self.current - 1]


_cache: dict[str, Node] = {}


def parse_condition(expression: str) -> Node:
    """Parse a condition expression string into its syntax tree, cached by string.

    Raises `ParseError` when the expression is invalid.
    """
    cached = _cache.get(expression)
    if cached is not None:
        return cached
    tokens = _Lexer(expression).tokenize()
    ast = _Parser(tokens).parse()
    if len(_cache) >= 1000:
        _cache.clear()
    _cache[expression] = ast
    return ast


_CONDITION_LOOKS = (
    re.compile(r"^\."),
    re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*\."),
    re.compile(r"\s+(==|!=|>|>=|<|<=|&&|\|\||in|not\s+in)\s+"),
    re.compile(r"\?.*:"),
)


def is_condition_expression(value: object) -> bool:
    """Whether a rule value is a condition expression: a string that looks like one."""
    if not isinstance(value, str):
        return False
    trimmed = value.strip()
    return any(look.search(trimmed) is not None for look in _CONDITION_LOOKS)
