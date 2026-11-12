<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Patterns;

use Polyspec\Crudui\Validator\Patterns\PatternParameter;
use Polyspec\Crudui\Validator\Patterns\PatternParser;
use Polyspec\Crudui\Validator\Patterns\PatternSyntaxError;
use Polyspec\Crudui\Validator\Patterns\WholeMatchPattern;
use Polyspec\Crudui\Validator\Values\CodePointSet;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\UnicodeData;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The CRUDUI pattern language (docs/spec/validation-rules.md, "Patterns" and
 * "Parameter errors"): recognition with reasons and code point offsets, the size and
 * nesting limits, and whole matches by the package's own NFA over the Unicode data.
 */
final class PatternLanguageTest extends TestCase
{
    /** @return iterable<string, array{string, string, int}> */
    public static function invalidPatterns(): iterable
    {
        yield 'empty' => ['', 'empty pattern', 0];
        yield 'trailing backslash' => ['a\\', 'invalid escape', 1];
        yield 'control escape' => ['\\cA', 'invalid escape', 0];
        yield 'octal escape' => ['\\0', 'invalid escape', 0];
        yield 'non-ASCII escape' => ['a\\한', 'invalid escape', 1];
        yield 'empty code point' => ['\\u{}', 'invalid escape', 0];
        yield 'seven digits' => ['\\u{0000041}', 'invalid escape', 0];
        yield 'unclosed code point' => ['\\u{41', 'invalid escape', 0];
        yield 'short hex' => ['\\xG1', 'invalid escape', 0];
        yield 'escape in class' => ['a[\\q]', 'invalid escape', 2];
        yield 'bare group question' => ['(?', 'unsupported construct', 0];
        yield 'negative lookahead' => ['x(?!y)', 'unsupported construct', 1];
        yield 'negative lookbehind' => ['(?<!y)x', 'unsupported construct', 0];
        yield 'named with P' => ['(?P<n>x)', 'unsupported construct', 0];
        yield 'unclosed name' => ['(?<n', 'invalid group name', 0];
        yield 'empty name' => ['(?<>x)', 'invalid group name', 0];
        yield 'non-ASCII name' => ['(?<é>x)', 'invalid group name', 0];
        yield 'nested duplicate' => ['(?<a>(?<a>x))', 'duplicate group name', 5];
        yield 'unterminated nested' => ['((a)', 'unterminated group', 4];
        yield 'unterminated after class' => ['[a', 'unterminated class', 2];
        yield 'unterminated negated' => ['[^', 'unterminated class', 2];
        yield 'empty negated class' => ['[^]', 'invalid class', 0];
        yield 'dash after range' => ['x[a-z-0]', 'invalid class', 1];
        yield 'shorthand start' => ['[\\w-a]', 'invalid range', 1];
        yield 'property end' => ['[a-\\p{L}]', 'invalid range', 1];
        yield 'complement start' => ['x[\\W-a]', 'invalid class', 1];
        yield 'bad escape as range end' => ['[a-\\q]', 'invalid escape', 3];
        yield 'bad property as range end' => ['[a-\\p{X}]', 'invalid property', 3];
        yield 'complement in negated class' => ['[^\\D]', 'invalid class', 0];
        yield 'escaped reversed range' => ['[\\x42-\\x41]', 'invalid range', 1];
        yield 'lazy repeated' => ['a*??', 'invalid quantifier', 3];
        yield 'brace after lazy' => ['a+?{2}', 'invalid quantifier', 3];
        yield 'quantified anchor' => ['^*', 'invalid quantifier', 1];
        yield 'quantified alternation' => ['a|+', 'invalid quantifier', 2];
        yield 'quantifier in group' => ['(*)', 'invalid quantifier', 1];
        yield 'text bound' => ['a{2,x}', 'invalid quantifier', 1];
        yield 'unclosed bound' => ['a{2,3', 'invalid quantifier', 1];
        yield 'large open bound' => ['a{1001,}', 'invalid quantifier', 1];
        yield 'huge bound' => ['a{99999999999999999999}', 'invalid quantifier', 1];
        yield 'closing brace' => ['a}', 'unexpected character', 1];
        yield 'inner end anchor' => ['a$b', 'unexpected character', 1];
        yield 'end anchor in group' => ['(a$)', 'unexpected character', 2];
        yield 'second start anchor' => ['^^', 'unexpected character', 1];
        yield 'surrogate literal' => ["a\xED\xB0\x80", 'unexpected character', 1];
        yield 'surrogate class member' => ["[\xED\xA0\x80]", 'unexpected character', 1];
        yield 'unknown category' => ['\\p{Lx}', 'invalid property', 0];
        yield 'surrogate category' => ['\\P{Cs}', 'invalid property', 0];
        yield 'unassigned category' => ['\\p{Cn}', 'invalid property', 0];
        yield 'script short name' => ['\\p{Script=Hang}', 'invalid property', 0];
        yield 'lowercase script' => ['\\p{Script=hangul}', 'invalid property', 0];
        yield 'short script key' => ['\\p{sc=Hangul}', 'invalid property', 0];
        yield 'bare script' => ['\\p{Hangul}', 'invalid property', 0];
        yield 'script extensions' => ['\\p{Script_Extensions=Hangul}', 'invalid property', 0];
        yield 'unclosed property' => ['\\p{Lu', 'invalid property', 0];
        yield 'property in class' => ['[\\p{Foo}]', 'invalid property', 1];
        yield 'size of a sum' => [str_repeat('a', 1001), 'pattern too large', 0];
        yield 'size of a star' => ['(?:a{500})*b{500}c', 'pattern too large', 0];
        yield 'size of a plus' => ['(?:a{500})+b', 'pattern too large', 0];
        yield 'size of alternatives' => ['a{500}|b{501}', 'pattern too large', 0];
        yield 'size after other errors' => ['a{1000}b\\q', 'invalid escape', 8];
        yield 'depth before content' => [str_repeat('(', 100) . '(?i)', 'nesting too deep', 100];
        yield 'depth of named groups' => [
            str_repeat('(?<a>', 1) . str_repeat('(?:', 100) . ')',
            'nesting too deep',
            5 + 99 * 3
        ];
    }

    #[DataProvider('invalidPatterns')]
    public function testInvalidPatternReasonAndOffset(string $pattern, string $reason, int $offset): void
    {
        try {
            PatternParser::parse($pattern);
            self::fail('accepted ' . $pattern);
        } catch (PatternSyntaxError $error) {
            self::assertSame([$reason, $offset], [$error->reason, $error->offset]);
        }
    }

    /** @return iterable<string, array{string, list<string>, list<string>}> */
    public static function wholeMatches(): iterable
    {
        yield 'delimiters and PCRE syntax are text' => ['~#/%@\\{\\}', ['~#/%@{}'], ['~#/%@']];
        yield 'dollar sign literal at end' => ['a\\$', ['a$'], ['a']];
        yield 'escaped backslash then anchor' => ['a\\\\$', ['a\\'], ['a']];
        yield 'dash boundaries' => ['[-a][a-][^-]', ['-ax', 'a-x'], ['-a-']];
        yield 'range to dash' => ['[+--]+', ['+,-'], ['.']];
        yield 'class metacharacters' => ['[.*+?(){}|$^]+', ['.*+?(){}|$^'], ['a']];
        yield 'negated whitespace' => ['\\S+', ["a\u{200B}\u{FEFF}"], ["a\u{3000}"]];
        yield 'dot matches separators' => ['.{3}', ["\r\u{2028}\u{0}"], ["\r\n\u{0}"]];
        yield 'control escapes' => ['\\t\\n\\r\\f\\v', ["\t\n\r\f\v"], ["\t\n\r\f "]];
        yield 'supplementary code point' => ['\\u{10FFFF}\\x7e', ["\u{10FFFF}~"], ['~']];
        yield 'script is not script extensions' => ['\\p{Script=Hangul}', ['한'], ["\u{3001}"]];
        yield 'one-character anchors' => ['^', [''], ['x']];
        yield 'quantified group' => ['(ab|c)+?', ['abc', 'cab'], ['', 'a']];
        yield 'zero-size repetition' => ['((){1000}){1000}x', ['x'], ['', 'xx']];
        yield 'nullable loop' => ['(a?)*b', ['b', 'aab'], ['a']];
        yield 'optional copies' => ['a{2,4}', ['aa', 'aaaa'], ['a', 'aaaaa']];
        yield 'zero bound' => ['a{0}b', ['b'], ['ab']];
        yield 'leading zero bounds' => ['a{000,01}', ['', 'a'], ['aa']];
        yield 'class literals' => ['[.$^*a-a|]+', ['.$^*a|'], ['b']];
        yield 'unassigned is C' => ['\\p{C}\\P{L}', ["\u{088F}\u{0378}"], ['a ']];
        yield 'nesting at the limit' => [str_repeat('(', 100) . 'a' . str_repeat(')', 100) . '*', ['', 'aa'], ['b']];
        yield 'script complement in class' => ['[\\P{Script=Han}\\d]+', ['a1'], ['漢']];
        yield 'category complement in class' => ['[^\\P{Lu}]', ['A'], ['a']];
        yield 'counted lazy' => ['a{2,3}?', ['aa', 'aaa'], ['a', 'aaaa']];
        yield 'open bound' => ['(?:ab){2,}', ['abab', 'ababab'], ['ab']];
        yield 'empty group' => ['()x', ['x'], ['']];
        yield 'long group name' => ['(?<a_very_long_group_name_beyond_thirty_two_units>x)', ['x'], ['y']];
        yield 'many groups' => [str_repeat('(a)?', 300), ['', 'aaa'], ['b']];
    }

    /**
     * @param list<string> $matching
     * @param list<string> $failing
     */
    #[DataProvider('wholeMatches')]
    public function testWholeMatch(string $pattern, array $matching, array $failing): void
    {
        $compiled = WholeMatchPattern::compile($pattern);
        foreach ($matching as $text) {
            self::assertTrue($compiled->matches($text), 'expected a match for ' . json_encode($text));
        }
        foreach ($failing as $text) {
            self::assertFalse($compiled->matches($text), 'expected no match for ' . json_encode($text));
        }
    }

    public function testShorthandsAreExactSets(): void
    {
        $digit = WholeMatchPattern::compile('\\d');
        $word = WholeMatchPattern::compile('[\\w]');
        $space = WholeMatchPattern::compile('\\s');
        $notSpace = WholeMatchPattern::compile('[^\\s]');
        for ($codePoint = 0; $codePoint <= 0x3100; $codePoint++) {
            $text = self::utf8($codePoint);
            $isDigit = $codePoint >= 0x30 && $codePoint <= 0x39;
            $isWord = $isDigit
                || ($codePoint >= 0x41 && $codePoint <= 0x5A)
                || ($codePoint >= 0x61 && $codePoint <= 0x7A)
                || $codePoint === 0x5F;
            $isSpace = \in_array(
                $codePoint,
                [0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0x85, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000],
                true
            )
                || ($codePoint >= 0x2000 && $codePoint <= 0x200A);
            self::assertSame($isDigit, $digit->matches($text), sprintf('\\d U+%04X', $codePoint));
            self::assertSame($isWord, $word->matches($text), sprintf('\\w U+%04X', $codePoint));
            self::assertSame($isSpace, $space->matches($text), sprintf('\\s U+%04X', $codePoint));
            self::assertSame(!$isSpace, $notSpace->matches($text), sprintf('[^\\s] U+%04X', $codePoint));
        }
    }

    public function testPropertiesUseTheEmbeddedData(): void
    {
        foreach (UnicodeData::GENERAL_CATEGORIES as $name => $bounds) {
            $set = CodePointSet::fromBounds($bounds);
            $inside = WholeMatchPattern::compile("\\p{{$name}}");
            $outside = WholeMatchPattern::compile("[\\P{{$name}}]");
            foreach ([$bounds[0], $bounds[\count($bounds) - 1], $bounds[0] - 1] as $codePoint) {
                if ($codePoint < 0 || ($codePoint >= 0xD800 && $codePoint <= 0xDFFF)) {
                    continue;
                }
                $text = self::utf8($codePoint);
                self::assertSame($set->contains($codePoint), $inside->matches($text), "$name U+" . dechex($codePoint));
                self::assertSame(
                    !$set->contains($codePoint),
                    $outside->matches($text),
                    "not $name U+" . dechex($codePoint)
                );
            }
        }
        foreach (array_keys(UnicodeData::SCRIPTS) as $script) {
            $first = UnicodeData::SCRIPTS[$script][0];
            self::assertTrue(WholeMatchPattern::compile("\\p{Script=$script}")->matches(self::utf8($first)), $script);
            self::assertFalse(WholeMatchPattern::compile("\\P{Script=$script}")->matches(self::utf8($first)), $script);
        }
        // U+A7CE is unassigned in Unicode 16.0 whatever the platform's Unicode version.
        self::assertTrue(WholeMatchPattern::compile('\\p{C}')->matches("\u{A7CE}"));
        // Surrogates are in C and in every complement; valid UTF-8 text cannot carry
        // them, so the sets are checked directly.
        self::assertTrue(CodePointSet::fromBounds(UnicodeData::GENERAL_CATEGORIES['C'])->contains(0xD800));
        self::assertTrue(
            CodePointSet::fromBounds(UnicodeData::GENERAL_CATEGORIES['L'])->complement()->contains(0xDFFF)
        );
    }

    public function testCodePointSets(): void
    {
        $set = CodePointSet::fromBounds([10, 20, 0, 3, 4, 5, 15, 30, 40, 40]);
        self::assertSame([0, 5, 10, 30, 40, 40], $set->bounds());
        self::assertSame([6, 9, 31, 39, 41, 0x10FFFF], $set->complement()->bounds());
        self::assertSame([0, 5, 10, 30, 40, 40], $set->complement()->complement()->bounds());
        self::assertSame([0, 0x10FFFF], CodePointSet::fromBounds([])->complement()->bounds());
        self::assertSame([], CodePointSet::fromBounds([0, 0x10FFFF])->complement()->bounds());
        self::assertSame(
            [0, 7],
            CodePointSet::union(CodePointSet::fromBounds([0, 3]), CodePointSet::fromBounds([4, 7]))->bounds()
        );
        foreach (
            [
                [0, true],
                [5, true],
                [6, false],
                [9, false],
                [10, true],
                [30, true],
                [35, false],
                [40, true],
                [41, false]
            ] as [$codePoint, $member]
        ) {
            self::assertSame($member, $set->contains($codePoint), (string) $codePoint);
        }
    }

    public function testRepetitionCompilesToBoundedStates(): void
    {
        self::assertLessThan(10, WholeMatchPattern::compile('((){1000}){1000}')->stateCount());
        self::assertLessThan(10, WholeMatchPattern::compile('(|()*)+')->stateCount());
        self::assertLessThan(1100, WholeMatchPattern::compile('\\p{L}{1000}')->stateCount());
        self::assertLessThan(1300, WholeMatchPattern::compile('((a{10})*){100}')->stateCount());
    }

    /**
     * Inputs that take exponential time in a backtracking engine: a linear matcher ends them
     * within milliseconds, and a backtracking one does not end before the per-test timeout of
     * the run-tests tool of @polyspec/kit.
     */
    public function testMatchingIsLinear(): void
    {
        self::assertFalse(WholeMatchPattern::compile('(?:[^\\n]*a){12}c')->matches(str_repeat('a', 20000)));
        self::assertFalse(WholeMatchPattern::compile('(?:a|aa)*c')->matches(str_repeat('a', 20000)));
        self::assertTrue(WholeMatchPattern::compile('.*\\p{L}{900}')->matches(str_repeat('한', 1000)));
    }

    public function testInvalidUtf8TextIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        WholeMatchPattern::compile('.*')->matches("a\xFF");
    }

    public function testParameterFailures(): void
    {
        foreach (
            [[5, 'Invalid match parameter: expected a pattern string', 'INVALID_RULE_PARAMETER'],
            [['a'], 'Invalid match parameter: expected a pattern string', 'INVALID_RULE_PARAMETER'],
            [
                'a(',
                'Invalid match pattern: unterminated group at 2',
                'INVALID_RULE_PATTERN'
            ]] as [$parameter, $message, $code]
        ) {
            try {
                PatternParameter::compile('match', $parameter);
                self::fail('accepted ' . var_export($parameter, true));
            } catch (InvalidRuleParameter $error) {
                self::assertSame([$code, $message], [$error->getErrorCode(), $error->getMessage()]);
            }
        }
        // A cached failure is reported again with the same reason and offset.
        try {
            PatternParameter::compile('pattern', 'a(');
            self::fail('accepted a(');
        } catch (InvalidRuleParameter $error) {
            self::assertSame('Invalid pattern pattern: unterminated group at 2', $error->getMessage());
        }
    }

    /** UTF-8 text of one scalar value. */
    private static function utf8(int $codePoint): string
    {
        return match (true) {
            $codePoint < 0x80 => \chr($codePoint),
            $codePoint < 0x800 => \chr(0xC0 | $codePoint >> 6) . \chr(0x80 | $codePoint & 0x3F),
            $codePoint < 0x10000 => \chr(0xE0 | $codePoint >> 12)
                . \chr(0x80 | ($codePoint >> 6) & 0x3F)
                . \chr(0x80 | $codePoint & 0x3F),
            default => \chr(0xF0 | $codePoint >> 18) . \chr(0x80 | ($codePoint >> 12) & 0x3F)
                . \chr(0x80 | ($codePoint >> 6) & 0x3F) . \chr(0x80 | $codePoint & 0x3F),
        };
    }
}
