package validate

// Recognizer of the CRUDUI pattern language (docs/spec/validation-rules.md,
// Patterns and Parameter errors). It reads a declared pattern into a syntax tree
// whose atoms are code-point sets, or reports the first construct outside the
// language with its reason and its code-point offset. pattern_match.go compiles
// the tree and matches values with it.

import (
	"strings"
	"unicode/utf8"
)

// Pattern error reasons.
const (
	reasonEmptyPattern         = "empty pattern"
	reasonUnexpectedCharacter  = "unexpected character"
	reasonUnsupportedConstruct = "unsupported construct"
	reasonInvalidEscape        = "invalid escape"
	reasonInvalidClass         = "invalid class"
	reasonInvalidRange         = "invalid range"
	reasonInvalidProperty      = "invalid property"
	reasonInvalidQuantifier    = "invalid quantifier"
	reasonUnterminatedGroup    = "unterminated group"
	reasonUnterminatedClass    = "unterminated class"
	reasonInvalidGroupName     = "invalid group name"
	reasonDuplicateGroupName   = "duplicate group name"
	reasonNestingTooDeep       = "nesting too deep"
	reasonPatternTooLarge      = "pattern too large"
)

// Language limits.
const (
	// maxBound is the largest quantifier bound.
	maxBound = 1000
	// maxPatternSize is the largest pattern size.
	maxPatternSize = 1000
	// maxGroupDepth is the deepest group nesting.
	maxGroupDepth = 100
	// sizeCap saturates size arithmetic far above maxPatternSize.
	sizeCap = 1 << 40
)

// patternError is a construct outside the language: its reason and the
// code-point offset where it starts.
type patternError struct {
	reason string
	offset int
}

// newPatternError returns a pattern error.
func newPatternError(reason string, offset int) *patternError {
	return &patternError{reason: reason, offset: offset}
}

// patternAlternation is a list of alternative sequences and its size.
type patternAlternation struct {
	sequences [][]patternTerm
	size      int64
}

// patternTerm is an atom with an optional quantifier, and its size.
type patternTerm struct {
	atom       patternAtom
	quantifier *patternQuantifier
	size       int64
}

// patternQuantifier is a repetition from min to max times; max is -1 when
// unbounded. Laziness is read but does not change a whole match.
type patternQuantifier struct {
	min, max int
}

// patternAtom is a *runeSet or a patternGroup.
type patternAtom interface{}

// patternGroup is a group of any kind; groups only group in a whole match.
type patternGroup struct {
	body patternAlternation
}

// patternProperty is a general category or, when script is set, a script.
type patternProperty struct {
	name    string
	script  bool
	negated bool
}

// classMember is one member read inside a bracket class: a single code point,
// or a set (shorthand or property).
type classMember struct {
	start  int
	single bool
	r      rune
	ranges []codeRange
}

// patternParser holds the recognizer state.
type patternParser struct {
	src   []rune
	pos   int
	names map[string]bool
	sets  int
}

// parsePattern recognizes a declared pattern. It returns the tree of the pattern
// without its anchors and the number of sets in it, or the first construct
// outside the language; the size limit is checked after the rest is valid.
func parsePattern(source string) (patternAlternation, int, *patternError) {
	p := &patternParser{src: decodeScalars(source), names: map[string]bool{}}
	if len(p.src) == 0 {
		return patternAlternation{}, 0, newPatternError(reasonEmptyPattern, 0)
	}
	body, err := p.alternation(0)
	if err != nil {
		return patternAlternation{}, 0, err
	}
	if body.size > maxPatternSize {
		return patternAlternation{}, 0, newPatternError(reasonPatternTooLarge, 0)
	}
	return body, p.sets, nil
}

// invalidByte stands for a byte that is not part of a UTF-8 encoded scalar
// value; like a surrogate, it is not a Unicode scalar value.
const invalidByte = 0xD800

// decodeScalars decodes a pattern into code points. A byte outside valid UTF-8
// becomes invalidByte, so it counts as one code point and is never a literal.
func decodeScalars(source string) []rune {
	out := make([]rune, 0, len(source))
	for i := 0; i < len(source); {
		r, size := utf8.DecodeRuneInString(source[i:])
		if r == utf8.RuneError && size == 1 {
			r = invalidByte
		}
		out = append(out, r)
		i += size
	}
	return out
}

// isSurrogate reports a surrogate code point, which is not a scalar value.
func isSurrogate(r rune) bool {
	return 0xD800 <= r && r <= 0xDFFF
}

// addSize and mulSize are saturating size arithmetic.
func addSize(a, b int64) int64 { return min(a+b, sizeCap) }

// mulSize multiplies sizes, saturating at sizeCap.
func mulSize(a, b int64) int64 {
	if a == 0 || b == 0 {
		return 0
	}
	if a > sizeCap/b {
		return sizeCap
	}
	return a * b
}

// newSet returns a set of normalized ranges with the next id.
func (p *patternParser) newSet(ranges []codeRange) *runeSet {
	p.sets++
	return &runeSet{id: p.sets - 1, ranges: ranges}
}

// peek returns the character offset positions after the current one, or -1.
func (p *patternParser) peek(offset int) rune {
	if i := p.pos + offset; i < len(p.src) {
		return p.src[i]
	}
	return -1
}

// alternation reads alternatives up to the end or, inside a group, up to its
// closing parenthesis.
func (p *patternParser) alternation(depth int) (patternAlternation, *patternError) {
	body := patternAlternation{sequences: [][]patternTerm{nil}}
	for p.pos < len(p.src) {
		c := p.src[p.pos]
		if c == '|' {
			p.pos++
			body.sequences = append(body.sequences, nil)
			continue
		}
		if c == ')' {
			if depth > 0 {
				break
			}
			return body, newPatternError(reasonUnexpectedCharacter, p.pos)
		}
		term, err := p.term(depth)
		if err != nil {
			return body, err
		}
		if term == nil {
			continue
		}
		last := len(body.sequences) - 1
		body.sequences[last] = append(body.sequences[last], *term)
		body.size = addSize(body.size, term.size)
	}
	return body, nil
}

// term reads an atom and its quantifier. An anchor yields no term.
func (p *patternParser) term(depth int) (*patternTerm, *patternError) {
	atom, size, err := p.atom(depth)
	if err != nil || atom == nil {
		return nil, err
	}
	term := &patternTerm{atom: atom, size: size}
	if p.pos >= len(p.src) || !isQuantifierStart(p.src[p.pos]) {
		return term, nil
	}
	q, err := p.quantifier()
	if err != nil {
		return nil, err
	}
	if p.pos < len(p.src) && isQuantifierStart(p.src[p.pos]) {
		return nil, newPatternError(reasonInvalidQuantifier, p.pos)
	}
	term.quantifier = q
	if q.max < 0 {
		term.size = mulSize(size, int64(q.min)+1)
	} else {
		term.size = mulSize(size, int64(q.max))
	}
	return term, nil
}

// isQuantifierStart reports a character that starts a quantifier.
func isQuantifierStart(c rune) bool {
	return c == '*' || c == '+' || c == '?' || c == '{'
}

// quantifier reads `*`, `+`, `?` or a braced quantifier, then an optional lazy `?`.
func (p *patternParser) quantifier() (*patternQuantifier, *patternError) {
	start := p.pos
	q := &patternQuantifier{}
	switch p.src[start] {
	case '*':
		q.min, q.max = 0, -1
		p.pos++
	case '+':
		q.min, q.max = 1, -1
		p.pos++
	case '?':
		q.min, q.max = 0, 1
		p.pos++
	default:
		p.pos++
		minimum, ok := p.count()
		if !ok {
			return nil, newPatternError(reasonInvalidQuantifier, start)
		}
		q.min, q.max = minimum, minimum
		if p.peek(0) == ',' {
			p.pos++
			q.max = -1
			if p.peek(0) != '}' {
				maximum, ok := p.count()
				if !ok || maximum < minimum {
					return nil, newPatternError(reasonInvalidQuantifier, start)
				}
				q.max = maximum
			}
		}
		if p.peek(0) != '}' {
			return nil, newPatternError(reasonInvalidQuantifier, start)
		}
		p.pos++
	}
	if p.peek(0) == '?' {
		p.pos++
	}
	return q, nil
}

// count reads the decimal digits of a quantifier bound, leading zeros allowed;
// a bound above maxBound is not a count.
func (p *patternParser) count() (int, bool) {
	value, digits := 0, 0
	for isDigit(p.peek(0)) {
		value = min(value*10+int(p.src[p.pos]-'0'), maxBound+1)
		digits++
		p.pos++
	}
	return value, digits > 0 && value <= maxBound
}

// atom reads one atom and returns it with its size; an anchor returns a nil atom.
func (p *patternParser) atom(depth int) (patternAtom, int64, *patternError) {
	start := p.pos
	c := p.src[start]
	switch c {
	case '*', '+', '?', '{':
		return nil, 0, newPatternError(reasonInvalidQuantifier, start)
	case '^':
		if start != 0 {
			return nil, 0, newPatternError(reasonUnexpectedCharacter, start)
		}
		p.pos++
		return nil, 0, nil
	case '$':
		if start != len(p.src)-1 {
			return nil, 0, newPatternError(reasonUnexpectedCharacter, start)
		}
		p.pos++
		return nil, 0, nil
	case ']', '}':
		return nil, 0, newPatternError(reasonUnexpectedCharacter, start)
	case '.':
		p.pos++
		return p.newSet(complementRanges([]codeRange{{'\n', '\n'}})), 1, nil
	case '(':
		group, err := p.group(depth + 1)
		if err != nil {
			return nil, 0, err
		}
		return group, group.body.size, nil
	case '[':
		set, err := p.class()
		return set, 1, err
	case '\\':
		member, err := p.escape()
		if err != nil {
			return nil, 0, err
		}
		if member.single {
			return p.newSet([]codeRange{{member.r, member.r}}), 1, nil
		}
		return p.newSet(member.ranges), 1, nil
	}
	if isSurrogate(c) {
		return nil, 0, newPatternError(reasonUnexpectedCharacter, start)
	}
	p.pos++
	return p.newSet([]codeRange{{c, c}}), 1, nil
}

// group reads a group at nesting level depth, starting at its parenthesis.
func (p *patternParser) group(depth int) (patternGroup, *patternError) {
	start := p.pos
	if depth > maxGroupDepth {
		return patternGroup{}, newPatternError(reasonNestingTooDeep, start)
	}
	p.pos++
	if p.peek(0) == '?' {
		switch {
		case p.peek(1) == ':':
			p.pos += 2
		case p.peek(1) == '<' && (p.peek(2) == '=' || p.peek(2) == '!'):
			return patternGroup{}, newPatternError(reasonUnsupportedConstruct, start)
		case p.peek(1) == '<':
			if err := p.groupName(start); err != nil {
				return patternGroup{}, err
			}
		default:
			return patternGroup{}, newPatternError(reasonUnsupportedConstruct, start)
		}
	}
	body, err := p.alternation(depth)
	if err != nil {
		return patternGroup{}, err
	}
	if p.pos >= len(p.src) {
		return patternGroup{}, newPatternError(reasonUnterminatedGroup, len(p.src))
	}
	p.pos++ // ')'
	return patternGroup{body: body}, nil
}

// groupName reads `?<name>` after the parenthesis of a named group at start.
func (p *patternParser) groupName(start int) *patternError {
	from := p.pos + 2
	end := from
	for end < len(p.src) && isNameChar(p.src[end]) {
		end++
	}
	name := string(p.src[from:end])
	if end >= len(p.src) || p.src[end] != '>' || name == "" || isDigit(p.src[from]) {
		return newPatternError(reasonInvalidGroupName, start)
	}
	if p.names[name] {
		return newPatternError(reasonDuplicateGroupName, start)
	}
	p.names[name] = true
	p.pos = end + 1
	return nil
}

// isNameChar reports a character of [A-Za-z0-9_].
func isNameChar(c rune) bool {
	return c == '_' || isDigit(c) || ('A' <= c && c <= 'Z') || ('a' <= c && c <= 'z')
}

// isDigit reports an ASCII digit.
func isDigit(c rune) bool {
	return '0' <= c && c <= '9'
}

// class reads a bracket class starting at its bracket, left to right.
func (p *patternParser) class() (*runeSet, *patternError) {
	start := p.pos
	p.pos++
	negated := p.peek(0) == '^'
	if negated {
		p.pos++
	}
	var ranges []codeRange
	members := 0
	for {
		if p.pos >= len(p.src) {
			return nil, newPatternError(reasonUnterminatedClass, len(p.src))
		}
		if p.src[p.pos] == ']' {
			if members == 0 {
				return nil, newPatternError(reasonInvalidClass, start)
			}
			p.pos++
			break
		}
		lo, err := p.classMember(start, members == 0)
		if err != nil {
			return nil, err
		}
		members++
		if p.peek(0) == '-' && p.peek(1) != -1 && p.peek(1) != ']' {
			p.pos++ // range operator
			hi, err := p.classMember(start, false)
			if err != nil {
				return nil, err
			}
			if !lo.single || !hi.single || lo.r > hi.r {
				return nil, newPatternError(reasonInvalidRange, lo.start)
			}
			ranges = append(ranges, codeRange{lo.r, hi.r})
			continue
		}
		if lo.single {
			ranges = append(ranges, codeRange{lo.r, lo.r})
		} else {
			ranges = append(ranges, lo.ranges...)
		}
	}
	ranges = normalizeRanges(ranges)
	if negated {
		ranges = complementRanges(ranges)
	}
	return p.newSet(ranges), nil
}

// classMember reads one class member at the current position. A `-` is a
// literal only as the first member or before the closing bracket (or the end of
// the pattern, which leaves the class unterminated).
func (p *patternParser) classMember(classStart int, first bool) (classMember, *patternError) {
	start := p.pos
	c := p.src[start]
	switch c {
	case '\\':
		member, err := p.escape()
		if err != nil {
			return classMember{}, err
		}
		if member.negatedShorthand {
			return classMember{}, newPatternError(reasonInvalidClass, classStart)
		}
		return member.classMember, nil
	case '[', ']':
		return classMember{}, newPatternError(reasonInvalidClass, classStart)
	case '-':
		if !first && p.peek(1) != ']' && p.peek(1) != -1 {
			return classMember{}, newPatternError(reasonInvalidClass, classStart)
		}
	}
	if isSurrogate(c) {
		return classMember{}, newPatternError(reasonUnexpectedCharacter, start)
	}
	p.pos++
	return classMember{start: start, single: true, r: c}, nil
}

// escapeMember is an escape read as a class member; negatedShorthand marks
// \D, \W and \S, which a class may not contain.
type escapeMember struct {
	classMember
	negatedShorthand bool
}

// escapedLiterals are the characters an escape writes as themselves.
const escapedLiterals = `^$\.*+?()[]{}|/-`

// controlEscapes maps control escapes to their code points.
var controlEscapes = map[rune]rune{'t': '\t', 'n': '\n', 'r': '\r', 'f': '\f', 'v': '\v'}

// escape reads an escape starting at its backslash.
func (p *patternParser) escape() (escapeMember, *patternError) {
	start := p.pos
	c := p.peek(1)
	single := func(r rune, width int) (escapeMember, *patternError) {
		p.pos += width
		return escapeMember{classMember: classMember{start: start, single: true, r: r}}, nil
	}
	set := func(ranges []codeRange, negated bool) escapeMember {
		return escapeMember{classMember: classMember{start: start, ranges: ranges}, negatedShorthand: negated}
	}
	switch {
	case c == -1:
		return escapeMember{}, newPatternError(reasonInvalidEscape, start)
	case strings.ContainsRune(escapedLiterals, c):
		return single(c, 2)
	case controlEscapes[c] != 0:
		return single(controlEscapes[c], 2)
	case c == 'd' || c == 'w' || c == 's':
		p.pos += 2
		return set(shorthandRanges(c), false), nil
	case c == 'D' || c == 'W' || c == 'S':
		p.pos += 2
		return set(complementRanges(shorthandRanges(c+('a'-'A'))), true), nil
	case c == 'x':
		h1, ok1 := hexValue(p.peek(2))
		h2, ok2 := hexValue(p.peek(3))
		if !ok1 || !ok2 {
			return escapeMember{}, newPatternError(reasonInvalidEscape, start)
		}
		return single(h1*16+h2, 4)
	case c == 'u':
		r, width, ok := p.codePointEscape()
		if !ok {
			return escapeMember{}, newPatternError(reasonInvalidEscape, start)
		}
		return single(r, width)
	case c == 'p' || c == 'P':
		property, width, ok := p.property(c == 'P')
		if !ok {
			return escapeMember{}, newPatternError(reasonInvalidProperty, start)
		}
		p.pos += width
		ranges := propertyRanges(property)
		if property.negated {
			ranges = complementRanges(ranges)
		}
		return set(ranges, false), nil
	}
	return escapeMember{}, newPatternError(reasonInvalidEscape, start)
}

// codePointEscape reads `\u{H…}` with 1 to 6 hexadecimal digits naming a
// Unicode scalar value, and returns it with the escape's width.
func (p *patternParser) codePointEscape() (rune, int, bool) {
	if p.peek(2) != '{' {
		return 0, 0, false
	}
	var value rune
	digits := 0
	for i := 3; ; i++ {
		c := p.peek(i)
		if c == '}' {
			ok := digits > 0 && value <= 0x10FFFF && !isSurrogate(value)
			return value, i + 1, ok
		}
		h, ok := hexValue(c)
		if !ok || digits == 6 {
			return 0, 0, false
		}
		value = value*16 + h
		digits++
	}
}

// property reads `\p{…}` or `\P{…}` and returns it with the escape's width.
func (p *patternParser) property(negated bool) (patternProperty, int, bool) {
	if p.peek(2) != '{' {
		return patternProperty{}, 0, false
	}
	end := p.pos + 3
	for end < len(p.src) && p.src[end] != '}' {
		end++
	}
	if end >= len(p.src) {
		return patternProperty{}, 0, false
	}
	name := string(p.src[p.pos+3 : end])
	width := end + 1 - p.pos
	if unicodeGeneralCategories[name] != nil {
		return patternProperty{name: name, negated: negated}, width, true
	}
	if script, ok := strings.CutPrefix(name, "Script="); ok && unicodeScripts[script] != nil {
		return patternProperty{name: script, script: true, negated: negated}, width, true
	}
	return patternProperty{}, 0, false
}

// hexValue returns the value of a hexadecimal digit.
func hexValue(c rune) (rune, bool) {
	switch {
	case '0' <= c && c <= '9':
		return c - '0', true
	case 'a' <= c && c <= 'f':
		return c - 'a' + 10, true
	case 'A' <= c && c <= 'F':
		return c - 'A' + 10, true
	}
	return 0, false
}
