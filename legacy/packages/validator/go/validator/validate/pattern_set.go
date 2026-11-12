package validate

//go:generate go run github.com/polyspec/crudui/scripts/go/unicodedata -contract ../../../../../../contracts/unicode-properties.json -out unicode_data.go

// Code-point sets of the pattern matcher: sorted, disjoint, inclusive ranges
// built when a pattern is compiled, with membership by binary search.

import (
	"sort"
	"unicode"
)

// codeRange is an inclusive code-point range.
type codeRange struct{ lo, hi rune }

// runeSet is a set of code points. Each set of a compiled pattern has its own
// id, which the matcher uses to cache membership within one input step.
type runeSet struct {
	id     int
	ranges []codeRange
}

// containsRune reports whether r is in normalized ranges.
func containsRune(ranges []codeRange, r rune) bool {
	i := sort.Search(len(ranges), func(i int) bool { return ranges[i].hi >= r })
	return i < len(ranges) && ranges[i].lo <= r
}

// normalizeRanges sorts ranges and merges overlapping and adjacent ones.
func normalizeRanges(ranges []codeRange) []codeRange {
	sorted := append([]codeRange(nil), ranges...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].lo < sorted[j].lo })
	out := sorted[:0]
	for _, r := range sorted {
		if n := len(out); n > 0 && r.lo <= out[n-1].hi+1 {
			if r.hi > out[n-1].hi {
				out[n-1].hi = r.hi
			}
			continue
		}
		out = append(out, r)
	}
	return out
}

// complementRanges returns the code points 0..0x10FFFF outside normalized ranges.
func complementRanges(ranges []codeRange) []codeRange {
	var out []codeRange
	next := rune(0)
	for _, r := range ranges {
		if r.lo > next {
			out = append(out, codeRange{next, r.lo - 1})
		}
		next = r.hi + 1
	}
	if next <= unicode.MaxRune {
		out = append(out, codeRange{next, unicode.MaxRune})
	}
	return out
}

// Shorthand ranges.
var (
	digitRanges = []codeRange{{'0', '9'}}
	wordRanges  = []codeRange{{'0', '9'}, {'A', 'Z'}, {'_', '_'}, {'a', 'z'}}
)

// shorthandRanges returns the ranges of \d, \w or \s.
func shorthandRanges(kind rune) []codeRange {
	switch kind {
	case 'd':
		return digitRanges
	case 'w':
		return wordRanges
	default:
		return unicodeWhiteSpace
	}
}

// propertyRanges returns the ranges of a general category or a script.
func propertyRanges(p patternProperty) []codeRange {
	if p.script {
		return unicodeScripts[p.name]
	}
	return unicodeGeneralCategories[p.name]
}
