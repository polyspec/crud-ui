"""The CRUDUI pattern language.

A pattern is recognized with the language's grammar and matched by a
linear-time matcher over the embedded Unicode data. No regular-expression
engine ever sees a declared pattern.

The recognizer reads a pattern as code points, left to right, and either
returns its syntax tree or raises `PatternSyntaxError` for the first invalid
construct, with the reason and code-point offset the specification assigns to
it. The matcher compiles the tree to a Thompson NFA of CHAR(set), SPLIT,
EPSILON and MATCH states and simulates every state at once over the code
points of the text: time O(length x states), memory O(states), no
backtracking and no recursion that depends on the text.
"""

from typing import Any, Iterable, Sequence, TypeAlias

from .unicode_data import GENERAL_CATEGORIES, SCRIPTS, WHITE_SPACE

__all__ = [
    "DEPTH_LIMIT",
    "PatternMatcher",
    "PatternSyntaxError",
    "QUANTIFIER_LIMIT",
    "SIZE_LIMIT",
    "CodePointSet",
    "compile_pattern",
    "is_general_category",
    "is_script",
]

# A quantifier: its minimum, its maximum (None when unbounded) and whether it is lazy.
Quantifier: TypeAlias = tuple[int, int | None, bool] | None
# A parsed atom or class member: its kind and its parts, read by the matcher.
Atom: TypeAlias = tuple[Any, ...]
# A term: an atom with its quantifier.
Term: TypeAlias = tuple[Atom, Quantifier]
# The branches of an alternation, each a sequence of terms.
Alternation: TypeAlias = list[list[Term]]

QUANTIFIER_LIMIT = 1000
SIZE_LIMIT = 1000
DEPTH_LIMIT = 100

MAX_CODE_POINT = 0x10FFFF


class PatternSyntaxError(ValueError):
    """A pattern outside the CRUDUI pattern language, with the offset of the invalid construct."""

    def __init__(self, reason: str, offset: int) -> None:
        super().__init__(f"{reason} at {offset}")
        self.name = "PatternSyntaxError"
        self.reason = reason
        self.offset = offset


class CodePointSet:
    """An immutable set of code points: a sorted list of disjoint inclusive ranges."""

    __slots__ = ("ranges",)

    def __init__(self, ranges: list[int]) -> None:
        self.ranges = ranges

    @staticmethod
    def of(*lists: Sequence[int]) -> "CodePointSet":
        """The union of flat inclusive ranges in any order, possibly overlapping."""
        pairs: list[tuple[int, int]] = []
        for one_list in lists:
            for index in range(0, len(one_list), 2):
                pairs.append((one_list[index], one_list[index + 1]))
        pairs.sort()
        merged: list[int] = []
        for start, end in pairs:
            if merged and start <= merged[-1] + 1:
                merged[-1] = max(merged[-1], end)
            else:
                merged.append(start)
                merged.append(end)
        return CodePointSet(merged)

    @staticmethod
    def union(sets: Iterable["CodePointSet"]) -> "CodePointSet":
        """The union of several sets."""
        return CodePointSet.of(*(one_set.ranges for one_set in sets))

    def complement(self) -> "CodePointSet":
        """Every code point from 0 to U+10FFFF outside this set."""
        result = []
        following = 0
        for index in range(0, len(self.ranges), 2):
            if self.ranges[index] > following:
                result.append(following)
                result.append(self.ranges[index] - 1)
            following = self.ranges[index + 1] + 1
        if following <= MAX_CODE_POINT:
            result.append(following)
            result.append(MAX_CODE_POINT)
        return CodePointSet(result)

    def has(self, code_point: int) -> bool:
        """Whether the set contains a code point."""
        low = 0
        high = len(self.ranges) // 2 - 1
        while low <= high:
            middle = (low + high) >> 1
            if code_point < self.ranges[middle * 2]:
                high = middle - 1
            elif code_point > self.ranges[middle * 2 + 1]:
                low = middle + 1
            else:
                return True
        return False


DIGIT = CodePointSet.of([0x30, 0x39])
WORD = CodePointSet.of([0x30, 0x39, 0x41, 0x5A, 0x61, 0x7A, 0x5F, 0x5F])
SPACE = CodePointSet.of(WHITE_SPACE)
ANY = CodePointSet.of([0x0A, 0x0A]).complement()

SHORTHAND_SETS = {"digit": DIGIT, "word": WORD, "space": SPACE}


def is_general_category(name: str) -> bool:
    """Whether a name is a general category a pattern may use."""
    return name in GENERAL_CATEGORIES


def is_script(name: str) -> bool:
    """Whether a name is a script a pattern may use."""
    return name in SCRIPTS


def property_set(name: str, script: bool) -> "CodePointSet":
    """The set of a general category or a script."""
    table = SCRIPTS if script else GENERAL_CATEGORIES
    return CodePointSet.of(table[name])


def _cp(character: str) -> int:
    return ord(character)


SYNTAX_ESCAPES = {_cp(character) for character in "^$\\.*+?()[]{}|/-"}
CONTROL_ESCAPES = {
    _cp("t"): 0x09,
    _cp("n"): 0x0A,
    _cp("r"): 0x0D,
    _cp("f"): 0x0C,
    _cp("v"): 0x0B,
}
SHORTHANDS = {
    _cp("d"): ("digit", False),
    _cp("w"): ("word", False),
    _cp("s"): ("space", False),
    _cp("D"): ("digit", True),
    _cp("W"): ("word", True),
    _cp("S"): ("space", True),
}
NOT_LITERAL = {_cp(character) for character in "\\^$.|?*+()[]{}"}
QUANTIFIER_START = {_cp(character) for character in "*+?{"}

BACKSLASH = _cp("\\")
OPEN_GROUP = _cp("(")
CLOSE_GROUP = _cp(")")
OPEN_CLASS = _cp("[")
CLOSE_CLASS = _cp("]")
OPEN_BRACE = _cp("{")
CLOSE_BRACE = _cp("}")
CARET = _cp("^")
DOLLAR = _cp("$")
DOT = _cp(".")
BAR = _cp("|")
QUESTION = _cp("?")
STAR = _cp("*")
PLUS = _cp("+")
DASH = _cp("-")
COMMA = _cp(",")
COLON = _cp(":")
LESS = _cp("<")
GREATER = _cp(">")
EQUALS = _cp("=")
BANG = _cp("!")


def _is_surrogate(code: int) -> bool:
    return 0xD800 <= code <= 0xDFFF


def _is_digit(code: int | None) -> bool:
    return code is not None and 0x30 <= code <= 0x39


def _is_hex(code: int | None) -> bool:
    return code is not None and (
        _is_digit(code) or 0x41 <= code <= 0x46 or 0x61 <= code <= 0x66
    )


def _is_name_start(code: int | None) -> bool:
    return code is not None and (
        0x41 <= code <= 0x5A or 0x61 <= code <= 0x7A or code == 0x5F
    )


def _is_name_part(code: int | None) -> bool:
    return _is_name_start(code) or _is_digit(code)


def _cap(size: int) -> int:
    """Sizes above the limit are kept at limit + 1, so products never overflow."""
    return min(size, SIZE_LIMIT + 1)


def _alternation_size(node: Alternation) -> int:
    size = 0
    for terms in node:
        for term in terms:
            size = _cap(size + _term_size(term))
    return size


def _term_size(term: Term) -> int:
    """The size of a term: an atom is 1, a group its body; a quantified item is multiplied."""
    atom, quantifier = term
    item = _alternation_size(atom[1]) if atom[0] == "group" else 1
    if quantifier is None:
        return item
    low, high, _lazy = quantifier
    return _cap(item * (low + 1 if high is None else high))


class _Recognizer:
    """The reader of one pattern string."""

    def __init__(self, pattern: str) -> None:
        self.source = [ord(character) for character in pattern]
        self.position = 0
        self.group_names: set[str] = set()
        self.depth = 0

    def peek(self, offset: int = 0) -> int | None:
        index = self.position + offset
        return self.source[index] if index < len(self.source) else None

    def recognize(self) -> Alternation:
        """The alternation tree of the pattern; leading `^` and trailing `$` add nothing."""
        length = len(self.source)
        if length == 0:
            raise PatternSyntaxError("empty pattern", 0)
        if self.source[0] == CARET:
            self.position = 1
        alternation = self._alternation()
        if self.position < length:
            # Only a `)` without an open group stops the top-level alternation early.
            raise PatternSyntaxError("unexpected character", self.position)
        if _alternation_size(alternation) > SIZE_LIMIT:
            raise PatternSyntaxError("pattern too large", 0)
        return alternation

    def _alternation(self) -> Alternation:
        branches = [self._sequence()]
        while self.peek() == BAR:
            self.position += 1
            branches.append(self._sequence())
        return branches

    def _sequence(self) -> list[Term]:
        terms: list[Term] = []
        length = len(self.source)
        while self.position < length:
            code = self.source[self.position]
            if code == BAR or code == CLOSE_GROUP:
                break
            if code == DOLLAR or code == CARET:
                # `^` at 0 was consumed before; `$` is an anchor only as the last character.
                if code == CARET or self.position != length - 1:
                    raise PatternSyntaxError("unexpected character", self.position)
                self.position += 1
                break
            if code in QUANTIFIER_START:
                raise PatternSyntaxError("invalid quantifier", self.position)
            atom = self._atom()
            terms.append((atom, self._quantifier()))
        return terms

    def _atom(self) -> Atom:
        start = self.position
        code = self.source[start]
        if code == OPEN_GROUP:
            return self._group()
        if code == OPEN_CLASS:
            return self._bracket_class()
        if code == DOT:
            self.position += 1
            return ("any",)
        if code == BACKSLASH:
            return self._escape(None)
        if code in NOT_LITERAL or _is_surrogate(code):
            raise PatternSyntaxError("unexpected character", start)
        self.position += 1
        return ("char", code)

    def _group(self) -> Atom:
        start = self.position
        if self.depth == DEPTH_LIMIT:
            raise PatternSyntaxError("nesting too deep", start)
        self.position += 1
        if self.peek() == QUESTION:
            following = self.peek(1)
            if following == COLON:
                self.position += 2
            elif following == LESS and self.peek(2) not in (EQUALS, BANG):
                self.position += 2
                self._group_name(start)
            else:
                raise PatternSyntaxError("unsupported construct", start)
        self.depth += 1
        body = self._alternation()
        self.depth -= 1
        if self.position >= len(self.source):
            raise PatternSyntaxError("unterminated group", len(self.source))
        self.position += 1  # `)`
        return ("group", body)

    def _group_name(self, group_start: int) -> None:
        """`name>` after `(?<`."""
        name_start = self.position
        if not _is_name_start(self.peek()):
            raise PatternSyntaxError("invalid group name", group_start)
        while _is_name_part(self.peek()):
            self.position += 1
        if self.peek() != GREATER:
            raise PatternSyntaxError("invalid group name", group_start)
        name = "".join(chr(code) for code in self.source[name_start : self.position])
        self.position += 1
        if name in self.group_names:
            raise PatternSyntaxError("duplicate group name", group_start)
        self.group_names.add(name)

    def _quantifier(self) -> Quantifier:
        """An optional quantifier with its optional lazy `?`."""
        start = self.position
        code = self.peek()
        if code == STAR:
            low, high = 0, None
            self.position += 1
        elif code == PLUS:
            low, high = 1, None
            self.position += 1
        elif code == QUESTION:
            low, high = 0, 1
            self.position += 1
        elif code == OPEN_BRACE:
            self.position += 1
            low = self._bound(start)
            if self.peek() == CLOSE_BRACE:
                high = low
            elif self.peek() == COMMA:
                self.position += 1
                high = None if self.peek() == CLOSE_BRACE else self._bound(start)
                if high is not None and low > high:
                    raise PatternSyntaxError("invalid quantifier", start)
            else:
                raise PatternSyntaxError("invalid quantifier", start)
            if self.peek() != CLOSE_BRACE:
                raise PatternSyntaxError("invalid quantifier", start)
            self.position += 1
        else:
            return None
        lazy = self.peek() == QUESTION
        if lazy:
            self.position += 1
        return (low, high, lazy)

    def _bound(self, quantifier_start: int) -> int:
        """A decimal bound of at most `QUANTIFIER_LIMIT`."""
        digits_start = self.position
        value = 0
        digit = self.peek()
        while digit is not None and _is_digit(digit):
            value = min(value * 10 + (digit - 0x30), QUANTIFIER_LIMIT + 1)
            self.position += 1
            digit = self.peek()
        if self.position == digits_start or value > QUANTIFIER_LIMIT:
            raise PatternSyntaxError("invalid quantifier", quantifier_start)
        return value

    def _escape(self, class_start: int | None) -> Atom:
        """An escape at the current `\\`.

        Inside a bracket class (`class_start` is the offset of its `[`), `\\D`,
        `\\W` and `\\S` are an invalid class. Returns the atom or class member.
        """
        start = self.position
        kind = self.peek(1)
        if kind is None:
            raise PatternSyntaxError("invalid escape", start)
        if kind in SYNTAX_ESCAPES:
            self.position += 2
            return ("char", kind)
        if kind in CONTROL_ESCAPES:
            self.position += 2
            return ("char", CONTROL_ESCAPES[kind])
        if kind in SHORTHANDS:
            shorthand, negated = SHORTHANDS[kind]
            if negated and class_start is not None:
                raise PatternSyntaxError("invalid class", class_start)
            self.position += 2
            return ("shorthand", shorthand, negated)
        if kind == _cp("x"):
            first_digit, second_digit = self.peek(2), self.peek(3)
            if (
                first_digit is None
                or second_digit is None
                or not _is_hex(first_digit)
                or not _is_hex(second_digit)
            ):
                raise PatternSyntaxError("invalid escape", start)
            value = int(chr(first_digit) + chr(second_digit), 16)
            self.position += 4
            return ("char", value)
        if kind == _cp("u"):
            return self._code_point_escape(start)
        if kind in (_cp("p"), _cp("P")):
            return self._property(start, kind == _cp("P"))
        raise PatternSyntaxError("invalid escape", start)

    def _code_point_escape(self, start: int) -> Atom:
        """`\\u{H...}`: 1-6 hexadecimal digits naming a Unicode scalar value."""
        if self.peek(2) != OPEN_BRACE:
            raise PatternSyntaxError("invalid escape", start)
        index = 3
        digits = ""
        code = self.peek(index)
        while code is not None and _is_hex(code):
            digits += chr(code)
            index += 1
            code = self.peek(index)
        if len(digits) < 1 or len(digits) > 6 or self.peek(index) != CLOSE_BRACE:
            raise PatternSyntaxError("invalid escape", start)
        value = int(digits, 16)
        if value > 0x10FFFF or _is_surrogate(value):
            raise PatternSyntaxError("invalid escape", start)
        self.position += index + 1
        return ("char", value)

    def _property(self, start: int, negated: bool) -> Atom:
        """`\\p{X}` or `\\P{X}` with a general category or `Script=Name`."""
        if self.peek(2) != OPEN_BRACE:
            raise PatternSyntaxError("invalid property", start)
        index = 3
        while self.peek(index) is not None and self.peek(index) != CLOSE_BRACE:
            index += 1
        if self.peek(index) is None:
            raise PatternSyntaxError("invalid property", start)
        text = "".join(
            chr(code) for code in self.source[self.position + 3 : self.position + index]
        )
        if is_general_category(text):
            atom: Atom = ("property", negated, text, False)
        elif text.startswith("Script=") and is_script(text[len("Script=") :]):
            atom = ("property", negated, text[len("Script=") :], True)
        else:
            raise PatternSyntaxError("invalid property", start)
        self.position += index + 1
        return atom

    def _bracket_class(self) -> Atom:
        """`[...]` or `[^...]` with at least one member."""
        start = self.position
        length = len(self.source)
        self.position += 1
        negated = self.peek() == CARET
        if negated:
            self.position += 1
        first_member = self.position
        members: list[Atom] = []
        while True:
            if self.position >= length:
                raise PatternSyntaxError("unterminated class", length)
            if self.peek() == CLOSE_CLASS:
                self.position += 1
                break
            member_start = self.position
            first = self._class_atom(start, member_start == first_member)
            if (
                self.peek() == DASH
                and self.peek(1) is not None
                and self.peek(1) != CLOSE_CLASS
            ):
                # A range `from-to` of single code points in non-descending order. The
                # class is read left to right: the end is read before the range is judged.
                self.position += 1
                to = self._class_atom(start, False)
                if first[0] != "char" or to[0] != "char" or to[1] < first[1]:
                    raise PatternSyntaxError("invalid range", member_start)
                members.append(("range", first[1], to[1]))
            elif first[0] == "shorthand":
                members.append(("shorthand", first[1]))
            else:
                members.append(first)
        if len(members) == 0:
            raise PatternSyntaxError("invalid class", start)
        return ("class", negated, members)

    def _class_atom(self, class_start: int, first: bool) -> Atom:
        """One class member: a literal, an escape, a shorthand or a property."""
        code = self.peek()
        if code == OPEN_CLASS:
            raise PatternSyntaxError("invalid class", class_start)
        if code == BACKSLASH:
            return self._escape(class_start)
        if code == DASH:
            following = self.peek(1)
            boundary = first or following == CLOSE_CLASS or following is None
            if not boundary:
                raise PatternSyntaxError("invalid class", class_start)
        if code is not None and _is_surrogate(code):
            raise PatternSyntaxError("unexpected character", self.position)
        self.position += 1
        return ("char", code)


def _member_set(member: Atom) -> "CodePointSet":
    """The set of one class member."""
    kind = member[0]
    if kind == "char":
        return CodePointSet.of([member[1], member[1]])
    if kind == "range":
        return CodePointSet.of([member[1], member[2]])
    if kind == "shorthand":
        return SHORTHAND_SETS[member[1]]
    _kind, negated, name, script = member
    one_set = property_set(name, script)
    return one_set.complement() if negated else one_set


def _atom_set(atom: Atom) -> "CodePointSet":
    """The set of one atom that is not a group."""
    kind = atom[0]
    if kind == "char":
        return CodePointSet.of([atom[1], atom[1]])
    if kind == "any":
        return ANY
    if kind == "shorthand":
        base = SHORTHAND_SETS[atom[1]]
        return base.complement() if atom[2] else base
    if kind == "property":
        return _member_set(atom)
    _kind, negated, members = atom
    union = CodePointSet.union([_member_set(member) for member in members])
    return union.complement() if negated else union


CHAR, SPLIT, EPSILON, MATCH = 0, 1, 2, 3


class _Builder:
    """The NFA under construction; states are compiled back to front."""

    def __init__(self) -> None:
        self.kinds: list[int] = []
        self.following: list[int] = []
        self.alternative: list[int] = []
        self.sets: list[CodePointSet | None] = []
        self._atom_sets: dict[int, CodePointSet] = {}

    def state(
        self,
        kind: int,
        following: int,
        alternative: int = -1,
        one_set: CodePointSet | None = None,
    ) -> int:
        self.kinds.append(kind)
        self.following.append(following)
        self.alternative.append(alternative)
        self.sets.append(one_set)
        return len(self.kinds) - 1

    def alternation(self, node: Alternation, following: int) -> int:
        start = self._sequence(node[-1], following)
        for index in range(len(node) - 2, -1, -1):
            start = self.state(SPLIT, self._sequence(node[index], following), start)
        return start

    def _sequence(self, terms: list[Term], following: int) -> int:
        start = following
        for index in range(len(terms) - 1, -1, -1):
            start = self._term(terms[index], start)
        return start

    def _term(self, term: Term, following: int) -> int:
        atom, quantifier = term
        if quantifier is None:
            return self._item(atom, following)
        # An item of size 0 matches only empty text, whatever its quantifier.
        if _term_size((atom, None)) == 0:
            return self.state(EPSILON, following)
        start = following
        low, high, _lazy = quantifier
        if high is None:
            # One loop: SPLIT(item -> SPLIT, next).
            loop = self.state(SPLIT, -1, following)
            self.following[loop] = self._item(atom, loop)
            start = loop
        else:
            # Optional copies: each may be skipped straight to `next`.
            for _copy in range(low, high):
                start = self.state(SPLIT, self._item(atom, start), following)
        for _copy in range(low):
            start = self._item(atom, start)
        return start

    def _item(self, atom: Atom, following: int) -> int:
        if atom[0] == "group":
            return (
                self.state(EPSILON, following)
                if _alternation_size(atom[1]) == 0
                else self.alternation(atom[1], following)
            )
        one_set = self._atom_sets.get(id(atom))
        if one_set is None:
            one_set = _atom_set(atom)
            self._atom_sets[id(atom)] = one_set
        return self.state(CHAR, following, -1, one_set)


class PatternMatcher:
    """A compiled pattern: whole-text matching in linear time."""

    def __init__(self, pattern: str | Alternation) -> None:
        if isinstance(pattern, str):
            pattern = _Recognizer(pattern).recognize()
        builder = _Builder()
        self.accept = builder.state(MATCH, -1)
        self.start = builder.alternation(pattern, self.accept)
        self.kinds = builder.kinds
        self.following = builder.following
        self.alternative = builder.alternative
        self.sets = builder.sets
        ids: dict[int, int] = {}
        self.set_ids: list[int] = []
        for one_set in self.sets:
            if one_set is None:
                self.set_ids.append(-1)
            else:
                key = id(one_set)
                if key not in ids:
                    ids[key] = len(ids)
                self.set_ids.append(ids[key])
        self.set_count = len(ids)

    @property
    def state_count(self) -> int:
        """Number of NFA states."""
        return len(self.kinds)

    def test(self, text: str) -> bool:
        """Whether the whole text matches."""
        count = len(self.kinds)
        marks = [-1] * count
        generation = 0

        def close(states: Iterable[int], out: list[int]) -> None:
            """Add the epsilon closure of `states` to `out`, keeping CHAR and MATCH states."""
            stack = list(states)
            while stack:
                state = stack.pop()
                if marks[state] == generation:
                    continue
                marks[state] = generation
                kind = self.kinds[state]
                if kind == SPLIT:
                    stack.append(self.alternative[state])
                    stack.append(self.following[state])
                elif kind == EPSILON:
                    stack.append(self.following[state])
                else:
                    out.append(state)

        current: list[int] = []
        close([self.start], current)
        set_step = [-1] * self.set_count
        set_member = [0] * self.set_count
        index = 0
        while index < len(text) and current:
            # A lone surrogate is one code point.
            code_point = ord(text[index])
            index += 1
            generation += 1
            step = generation
            reached: list[int] = []
            for state in current:
                if self.kinds[state] != CHAR:
                    continue
                identifier = self.set_ids[state]
                if set_step[identifier] != step:
                    set_step[identifier] = step
                    one_set = self.sets[state]
                    assert one_set is not None  # every CHAR state carries its set
                    set_member[identifier] = 1 if one_set.has(code_point) else 0
                if set_member[identifier] == 1:
                    reached.append(self.following[state])
            following_states: list[int] = []
            if reached:
                close(reached, following_states)
            current = following_states
        return self.accept in current


_compiled: dict[str, PatternMatcher] = {}


def compile_pattern(pattern: str) -> "PatternMatcher":
    """The compiled matcher of a pattern, compiled once per pattern string.

    Raises `PatternSyntaxError` when the pattern is outside the language.
    """
    matcher = _compiled.get(pattern)
    if matcher is None:
        matcher = PatternMatcher(pattern)
        _compiled[pattern] = matcher
    return matcher
