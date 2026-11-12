package validate

// Matcher of the CRUDUI pattern language (docs/spec/validation-rules.md,
// Patterns). A recognized pattern compiles to a Thompson NFA whose character
// states test code-point sets; a value matches when the NFA accepts its whole
// canonical text. Matching keeps one ordered set of states per input step, so it
// takes time proportional to the value's length times the pattern's size and
// memory proportional to the pattern's size. No regular-expression engine is used.

import "unicode/utf8"

// nfaKind is the kind of an NFA state.
type nfaKind uint8

// NFA state kinds.
const (
	nfaChar    nfaKind = iota // consumes a code point of set, then goes to out
	nfaSplit                  // goes to out and out1
	nfaEpsilon                // goes to out
	nfaMatch                  // accepts
)

// nfaState is one NFA state.
type nfaState struct {
	kind nfaKind
	set  *runeSet
	out  int
	out1 int
}

// patternMatcher is a compiled pattern.
type patternMatcher struct {
	states []nfaState
	start  int
	sets   int
}

// compilePattern recognizes a declared pattern and compiles its matcher, or
// returns the first construct outside the language.
func compilePattern(source string) (*patternMatcher, *patternError) {
	body, sets, err := parsePattern(source)
	if err != nil {
		return nil, err
	}
	m := &patternMatcher{sets: sets}
	accept := m.add(nfaState{kind: nfaMatch})
	m.start = m.alternation(body, accept)
	return m, nil
}

// add appends a state and returns its index.
func (m *patternMatcher) add(s nfaState) int {
	m.states = append(m.states, s)
	return len(m.states) - 1
}

// alternation compiles alternatives that continue at next and returns the start.
func (m *patternMatcher) alternation(body patternAlternation, next int) int {
	start := m.sequence(body.sequences[len(body.sequences)-1], next)
	for i := len(body.sequences) - 2; i >= 0; i-- {
		start = m.add(nfaState{kind: nfaSplit, out: m.sequence(body.sequences[i], next), out1: start})
	}
	return start
}

// sequence compiles terms that continue at next and returns the start.
func (m *patternMatcher) sequence(terms []patternTerm, next int) int {
	start := next
	for i := len(terms) - 1; i >= 0; i-- {
		start = m.term(terms[i], start)
	}
	return start
}

// term compiles a possibly quantified atom: the required copies, then either
// the optional copies or one loop. An item of size 0 only matches empty text and
// compiles to one epsilon state whatever its quantifier.
func (m *patternMatcher) term(t patternTerm, next int) int {
	q := t.quantifier
	if q == nil {
		return m.atom(t.atom, next)
	}
	if t.size == 0 || atomSize(t.atom) == 0 {
		return m.add(nfaState{kind: nfaEpsilon, out: next})
	}
	start := next
	if q.max < 0 {
		loop := m.add(nfaState{kind: nfaSplit, out1: next})
		m.states[loop].out = m.atom(t.atom, loop)
		start = loop
	} else {
		for i := q.min; i < q.max; i++ {
			start = m.add(nfaState{kind: nfaSplit, out: m.atom(t.atom, start), out1: next})
		}
	}
	for i := 0; i < q.min; i++ {
		start = m.atom(t.atom, start)
	}
	return start
}

// atomSize returns the size of an atom.
func atomSize(atom patternAtom) int64 {
	if g, ok := atom.(patternGroup); ok {
		return g.body.size
	}
	return 1
}

// atom compiles an atom that continues at next and returns the start.
func (m *patternMatcher) atom(atom patternAtom, next int) int {
	switch a := atom.(type) {
	case *runeSet:
		return m.add(nfaState{kind: nfaChar, set: a, out: next})
	case patternGroup:
		return m.alternation(a.body, next)
	}
	return next
}

// matchRun holds the per-match working memory.
type matchRun struct {
	m     *patternMatcher
	mark  []uint32
	gen   uint32
	stack []int
	// setStep and setResult cache set membership within one input step.
	setStep   []uint32
	setResult []bool
}

// add adds the epsilon closure of state s to list, iteratively.
func (r *matchRun) add(list []int, s int) []int {
	r.stack = append(r.stack[:0], s)
	for len(r.stack) > 0 {
		s := r.stack[len(r.stack)-1]
		r.stack = r.stack[:len(r.stack)-1]
		if r.mark[s] == r.gen {
			continue
		}
		r.mark[s] = r.gen
		switch st := r.m.states[s]; st.kind {
		case nfaEpsilon:
			r.stack = append(r.stack, st.out)
		case nfaSplit:
			r.stack = append(r.stack, st.out1, st.out)
		default:
			list = append(list, s)
		}
	}
	return list
}

// matches reports whether the matcher accepts the whole text. Each byte that is
// not valid UTF-8 is read as U+FFFD, as Go reads strings.
func (m *patternMatcher) matches(text string) bool {
	r := &matchRun{
		m:         m,
		mark:      make([]uint32, len(m.states)),
		setStep:   make([]uint32, m.sets),
		setResult: make([]bool, m.sets),
	}
	r.gen = 1
	current := r.add(nil, m.start)
	var next []int
	step := uint32(0)
	for i := 0; i < len(text) && len(current) > 0; {
		c, width := utf8.DecodeRuneInString(text[i:])
		i += width
		step++
		r.gen++
		next = next[:0]
		for _, s := range current {
			st := m.states[s]
			if st.kind != nfaChar {
				continue
			}
			id := st.set.id
			if r.setStep[id] != step {
				r.setStep[id] = step
				r.setResult[id] = containsRune(st.set.ranges, c)
			}
			if r.setResult[id] {
				next = r.add(next, st.out)
			}
		}
		current, next = next, current
	}
	for _, s := range current {
		if m.states[s].kind == nfaMatch {
			return true
		}
	}
	return false
}
