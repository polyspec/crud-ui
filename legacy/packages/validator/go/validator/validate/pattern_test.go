package validate

import (
	"strings"
	"testing"
)

func TestPatternOutsideTheLanguage(t *testing.T) {
	cases := []struct {
		source string
		reason string
		offset int
	}{
		{"", "empty pattern", 0},
		{"a@", "invalid escape", 1},
		{"@U0001F600@q", "invalid escape", 1},
		{"@cA", "invalid escape", 0},
		{"@0", "invalid escape", 0},
		{"@k<a>", "invalid escape", 0},
		{"@B", "invalid escape", 0},
		{"@h", "invalid escape", 0},
		{"@x4G", "invalid escape", 0},
		{"@u{}", "invalid escape", 0},
		{"@u{g}", "invalid escape", 0},
		{"@u{0000041}", "invalid escape", 0},
		{"@u{DFFF}", "invalid escape", 0},
		{"@u{41", "invalid escape", 0},
		{"(?", "unsupported construct", 0},
		{"(?!a)", "unsupported construct", 0},
		{"x(?<!a)", "unsupported construct", 1},
		{"(?P<a>x)", "unsupported construct", 0},
		{"(?<a", "invalid group name", 0},
		{"(?<>a)", "invalid group name", 0},
		{"(?<a-b>x)", "invalid group name", 0},
		{"(?<a>x)(?<b>y)(?<a>z)", "duplicate group name", 14},
		{"(?<a>(?<a>x))", "duplicate group name", 5},
		{"a{1,1001}", "invalid quantifier", 1},
		{"a{1001,}", "invalid quantifier", 1},
		{"a{ 1}", "invalid quantifier", 1},
		{"a{1,2", "invalid quantifier", 1},
		{"a*??", "invalid quantifier", 3},
		{"a{2}{3}", "invalid quantifier", 4},
		{"^*", "invalid quantifier", 1},
		{"|*", "invalid quantifier", 1},
		{"(*)", "invalid quantifier", 1},
		{"((a{10}){10}){11}", "pattern too large", 0},
		{"((a{10})+){51}", "pattern too large", 0},
		{"(a{2,}){334}", "pattern too large", 0},
		{"(a|b{11}){100}", "pattern too large", 0},
		{"a{1000}b", "pattern too large", 0},
		{"(?:a+){500}b", "pattern too large", 0},
		{"(?:a{1000}){2}(", "unterminated group", 15},
		{"(?:a{1000}){2}@q", "invalid escape", 14},
		{strings.Repeat("(", 101) + strings.Repeat(")", 101), "nesting too deep", 100},
		{"(" + strings.Repeat("(?:", 100) + strings.Repeat(")", 101), "nesting too deep", 298},
		{strings.Repeat("(", 100) + strings.Repeat(")", 100) + "(", "unterminated group", 201},
		{"(?<abc", "invalid group name", 0},
		{"@p{Cs}", "invalid property", 0},
		{"[@p{Cs}]", "invalid property", 1},
		{"[a-@D]", "invalid class", 0},
		{"[@d-@D]", "invalid class", 0},
		{"[@q]", "invalid escape", 1},
		{"[a-@q]", "invalid escape", 3},
		{"[a", "unterminated class", 2},
		{"[^", "unterminated class", 2},
		{"[a-", "unterminated class", 3},
		{"(a", "unterminated group", 2},
		{"((a)", "unterminated group", 4},
		{"(a$", "unterminated group", 3},
		{"[^]", "invalid class", 0},
		{"[]]", "invalid class", 0},
		{"[@D]", "invalid class", 0},
		{"x[a@W]", "invalid class", 1},
		{"[a[]", "invalid class", 0},
		{"[@b]", "invalid escape", 1},
		{"[a-b-c]", "invalid class", 0},
		{"[a--b]", "invalid class", 0},
		{"x[a-bc-]-d]", "unexpected character", 10},
		{"[@D-a]", "invalid class", 0},
		{"a\xff", "unexpected character", 1},
		{"[\xffb]", "unexpected character", 1},
		{"\xe2\x82", "unexpected character", 0},
		{"[a--]", "invalid range", 1},
		{"[@w-a]", "invalid range", 1},
		{"x[a-@d]", "invalid range", 2},
		{"[@p{L}-z]", "invalid range", 1},
		{"[b-a]", "invalid range", 1},
		{"@p{Script=hangul}", "invalid property", 0},
		{"@P{Script=Hangul", "invalid property", 0},
		{"@p{sc=Hangul}", "invalid property", 0},
		{"@p{Script=Tolong_Siki}", "invalid property", 0},
		{"@p{Lu", "invalid property", 0},
		{"@p{Cn}", "invalid property", 0},
		{"@p{LC}", "invalid property", 0},
		{"@p{lu}", "invalid property", 0},
		{"[@p{Letter}]", "invalid property", 1},
		{"a$b", "unexpected character", 1},
		{"a$$", "unexpected character", 1},
		{"^^", "unexpected character", 1},
		{"a}", "unexpected character", 1},
		{")", "unexpected character", 0},
		{"(a)b)", "unexpected character", 4},
		{"(a$)", "unexpected character", 2},
	}
	for _, c := range cases {
		source := unescapeTest(c.source)
		_, perr := compilePattern(source)
		if perr == nil || perr.reason != c.reason || perr.offset != c.offset {
			t.Errorf("%q: got %+v, want %s at %d", source, perr, c.reason, c.offset)
		}
	}
}

func TestPatternMatchesTheWholeCanonicalText(t *testing.T) {
	cases := []struct {
		source string
		match  []string
		differ []string
	}{
		{"a|", []string{"a", ""}, []string{"aa", "b"}},
		{"^$", []string{""}, []string{"x"}},
		{"$", []string{""}, []string{"$"}},
		{"x*", []string{"", "xxx"}, []string{"xy"}},
		{"x$", []string{"x"}, []string{"x\n", "\nx"}},
		{"a{0}", []string{""}, []string{"a"}},
		{"(?:a|b){2,3}?", []string{"ab", "aba"}, []string{"a", "abab"}},
		{".", []string{"\r", "@u2028", "@u0000", "@U0001F600"}, []string{"\n", "ab", "e@u0301"}},
		{"[@s]", []string{" ", "@u3000", "@u0085", "@u000b"}, []string{"@ufeff", "@u200b", "@u180e", "@u0000"}},
		{"@S", []string{"@ufeff", "x"}, []string{" ", "@u2029"}},
		{"@w@W", []string{"_@u00e9", "9-"}, []string{"@u00e9_", "@u0661-", "a1"}},
		{"@d+", []string{"0123456789"}, []string{"@u0661", "@uff11"}},
		{"[^@d]", []string{"@u0661", "a"}, []string{"5"}},
		{"@p{C}", []string{"@u0378", "@u0000", "@ue000", "@U000E0080"}, []string{"a", " "}},
		{"@P{C}", []string{"a", " "}, []string{"@u0378", "@u0000"}},
		{"[x@P{L}]", []string{"x", "1"}, []string{"y"}},
		{"@P{Script=Latin}+", []string{"@ud55c", "12"}, []string{"x", "1x"}},
		{"[@P{Script=Latin}x]+", []string{"@ud55cx"}, []string{"y"}},
		{"a|(|b)c", []string{"a", "c", "bc"}, []string{"ac"}},
		{"()", []string{""}, []string{"x"}},
		{"[!--]", []string{"!", "-", ","}, []string{"."}},
		{"[--a]", []string{"-", "a", "0"}, []string{","}},
		{"@p{Script=Hangul}+@p{Nd}", []string{"@ud55c@uae001"}, []string{"@ud55c@u0661x"}},
		{"@p{Zs}@p{Zl}@p{Zp}", []string{"@u3000@u2028@u2029"}, []string{"\t@u2028@u2029"}},
		{"[$^.*+?(){}|/]+", []string{"$^.*+?(){}|/"}, []string{"a"}},
		{"[--/]", []string{"-", ".", "/"}, []string{","}},
		{"[-a]", []string{"-", "a"}, []string{"b"}},
		{"[a-]", []string{"-", "a"}, []string{"b"}},
		{"[@]@[@@@-]+", []string{"][@-"}, []string{"a"}},
		{"@x41@u{1f600}@u{10FFFF}@v@f", []string{"A@U0001F600@U0010FFFF\v\f"}, []string{"a@U0001F600@U0010FFFF\v\f"}},
		{"@^@$@.@*@+@?@(@)@{@}@|@/@-", []string{"^$.*+?(){}|/-"}, []string{"x"}},
		{"/x/i", []string{"/x/i"}, []string{"x", "X"}},
		{"(?<first>a)(?<second_2>b)", []string{"ab"}, []string{"a"}},
		{"((a{10}){10}){10}", []string{strings.Repeat("a", 1000)}, []string{strings.Repeat("a", 999)}},
		{"((a{10})+){50}", []string{strings.Repeat("a", 500), strings.Repeat("a", 5000)}, []string{strings.Repeat("a", 490)}},
		{"((a{10})*){100}", []string{"", strings.Repeat("a", 30), strings.Repeat("a", 5000)}, []string{"a"}},
		{"(a{2,}){333}", []string{strings.Repeat("a", 666)}, []string{strings.Repeat("a", 665)}},
		{"((a{10}){0}){1000}", []string{""}, []string{"a"}},
		{"a{002,0003}", []string{"aa", "aaa"}, []string{"a", "aaaa"}},
		{"^", []string{""}, []string{"^"}},
		{"()*a", []string{"a"}, []string{"^a"}},
		{"[.$^*a-a|]{2}", []string{".$", "^*", "a|"}, []string{"b.", "-a"}},
		{"(a)+b?", []string{"a", "aab"}, []string{"b"}},
		{"(?:|a)*b", []string{"b", "aab"}, []string{"a"}},
		{"(?:a*)*b", []string{"b", "aaab"}, []string{"ba"}},
		{"@P{L}@p{C}@P{Script=Arabic}", []string{"1@u0378a"}, []string{"a@u0378a", "1a@u0627"}},
		{"@p{Co}@p{C}", []string{"@ue000@U0010FFFD"}, []string{"@ufffd@ue000"}},
		{".@P{L}@p{So}", []string{"\xff\xff\xff"}, []string{"\xff\xffa"}},
	}
	for _, c := range cases {
		source := unescapeTest(c.source)
		re, perr := compilePattern(source)
		if perr != nil {
			t.Errorf("%q: %+v", source, perr)
			continue
		}
		for _, text := range c.match {
			if !re.matches(unescapeTest(text)) {
				t.Errorf("%q should match %q", source, unescapeTest(text))
			}
		}
		for _, text := range c.differ {
			if re.matches(unescapeTest(text)) {
				t.Errorf("%q should not match %q", source, unescapeTest(text))
			}
		}
	}
}

// unescapeTest writes @ as a backslash, and @u/@U escapes as their code points.
func unescapeTest(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '@' {
			b.WriteByte(s[i])
			continue
		}
		if i+1 < len(s) && (s[i+1] == 'u' || s[i+1] == 'U') && i+2 < len(s) && s[i+2] != '{' {
			width := 4
			if s[i+1] == 'U' {
				width = 8
			}
			var r rune
			for _, h := range s[i+2 : i+2+width] {
				v, _ := hexValue(h)
				r = r*16 + v
			}
			b.WriteRune(r)
			i += 1 + width
			continue
		}
		b.WriteByte('\\')
	}
	return b.String()
}

func TestPatternZeroSizeRepetitionStaysSmall(t *testing.T) {
	m, perr := compilePattern("((){1000}){1000}")
	if perr != nil {
		t.Fatal(perr)
	}
	if len(m.states) > 4 || !m.matches("") || m.matches("a") {
		t.Fatalf("%d states", len(m.states))
	}
}

func TestPatternRepeatedAtomsShareOneSet(t *testing.T) {
	m, perr := compilePattern(unescapeTest("@p{L}{1000}"))
	if perr != nil {
		t.Fatal(perr)
	}
	sets := map[*runeSet]bool{}
	for _, st := range m.states {
		if st.set != nil {
			sets[st.set] = true
		}
	}
	if len(sets) != 1 || m.sets != 1 {
		t.Fatalf("%d sets", len(sets))
	}
}

// TestPatternMatchingIsLinear matches inputs that take exponential or large polynomial time in
// backtracking engines. A linear matcher ends them within milliseconds; a backtracking one does
// not end before the per-test timeout of the run-tests tool of @polyspec/kit, which fails the test.
func TestPatternMatchingIsLinear(t *testing.T) {
	cases := []struct {
		source string
		text   string
		want   bool
	}{
		{"(?:.*a){12}c", strings.Repeat("a", 5000), false},
		{"(?:a|aa)*c", strings.Repeat("a", 10000), false},
		{"(?:a*)*b", strings.Repeat("a", 10000), false},
		{"@p{L}{1000}", strings.Repeat("@ud55c", 1000), true},
		{"(?:(?:a?){100}){10}a{0}", strings.Repeat("a", 1000), true},
	}
	for _, c := range cases {
		source, text := unescapeTest(c.source), unescapeTest(c.text)
		m, perr := compilePattern(source)
		if perr != nil {
			t.Fatalf("%q: %+v", source, perr)
		}
		if got := m.matches(text); got != c.want {
			t.Errorf("%q matched %v", source, got)
		}
	}
}

func TestRuneSets(t *testing.T) {
	ranges := normalizeRanges([]codeRange{{'x', 'z'}, {'a', 'c'}, {'d', 'f'}, {'b', 'b'}, {0x10FFFF, 0x10FFFF}})
	want := []codeRange{{'a', 'f'}, {'x', 'z'}, {0x10FFFF, 0x10FFFF}}
	if len(ranges) != len(want) {
		t.Fatalf("normalized %v", ranges)
	}
	for i := range want {
		if ranges[i] != want[i] {
			t.Fatalf("normalized %v", ranges)
		}
	}
	complement := complementRanges(ranges)
	wantComplement := []codeRange{{0, 'a' - 1}, {'f' + 1, 'x' - 1}, {'z' + 1, 0x10FFFE}}
	if len(complement) != len(wantComplement) {
		t.Fatalf("complement %v", complement)
	}
	for i := range wantComplement {
		if complement[i] != wantComplement[i] {
			t.Fatalf("complement %v", complement)
		}
	}
	if full := complementRanges(nil); len(full) != 1 || full[0] != (codeRange{0, 0x10FFFF}) {
		t.Fatalf("complement of nothing %v", full)
	}
	if len(complementRanges(complementRanges(nil))) != 0 {
		t.Fatal("complement of everything must be empty")
	}
	for r := rune(0); r <= 0x10FFFF; r += 97 {
		in := containsRune(ranges, r)
		if in == containsRune(complement, r) {
			t.Fatalf("U+%04X is in both or neither", r)
		}
	}
	for _, r := range []rune{'a', 'f', 'x', 'z', 0x10FFFF} {
		if !containsRune(ranges, r) {
			t.Errorf("U+%04X missing", r)
		}
	}
}
