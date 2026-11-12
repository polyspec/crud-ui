<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Values;

use Polyspec\Crudui\Validator\Values\EmptyValue;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\LengthLimit;
use Polyspec\Crudui\Validator\Values\Membership;
use Polyspec\Crudui\Validator\Values\Utf8;
use Polyspec\Crudui\Validator\Values\Whitespace;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Whitespace, emptiness, length and membership as the validation rules define them
 * (docs/spec/validation-rules.md, "Values").
 */
final class ValuesTest extends TestCase
{
    /** Every White_Space code point. */
    private const WHITESPACE = [
        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0x85, 0xA0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
        0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000,
    ];

    public function testWhitespaceIsExactlyWhiteSpace(): void
    {
        $found = [];
        for ($codePoint = 0; $codePoint <= 0x10FFFF; $codePoint++) {
            if (($codePoint < 0xD800 || $codePoint > 0xDFFF) && Whitespace::contains($codePoint)) {
                $found[] = $codePoint;
            }
        }
        self::assertSame(self::WHITESPACE, $found);
    }

    public function testTrimRemovesEveryWhitespaceCodePointAtBothEnds(): void
    {
        $all = implode('', array_map(self::utf8(...), self::WHITESPACE));
        foreach (self::WHITESPACE as $codePoint) {
            $space = self::utf8($codePoint);
            self::assertSame(
                'x' . $space . 'y',
                Whitespace::trim($space . 'x' . $space . 'y' . $space),
                sprintf('U+%04X', $codePoint)
            );
        }
        self::assertSame('', Whitespace::trim($all));
        self::assertSame('a', Whitespace::trim($all . 'a' . $all));
    }

    public function testTrimKeepsCodePointsThatAreNotWhitespace(): void
    {
        foreach (["\u{0000}", "\u{180E}", "\u{200B}", "\u{FEFF}", "\u{2060}"] as $text) {
            self::assertSame($text, Whitespace::trim(" $text\u{3000}"));
        }
        // Code points sharing leading bytes with whitespace encodings are kept.
        self::assertSame("\u{2080}x\u{E280}", Whitespace::trim("\u{2080}x\u{E280}"));
        self::assertSame("\u{0100}\u{3001}", Whitespace::trim("\u{0100}\u{3001}\u{3000}"));
    }

    public function testEmptyValues(): void
    {
        foreach ([null, '', " \u{3000}\t\u{2028}", [], new \stdClass()] as $value) {
            self::assertTrue(EmptyValue::is($value), var_export($value, true));
        }
        foreach ([0, 0.0, false, '0', "\u{0000}", "\u{FEFF}", ['a'], (object) ['a' => null]] as $value) {
            self::assertFalse(EmptyValue::is($value), var_export($value, true));
        }
    }

    public function testCodePointLength(): void
    {
        self::assertSame(0, Utf8::length(''));
        self::assertSame(3, Utf8::length("a\u{0000}b"));
        self::assertSame(2, Utf8::length('한글'));
        self::assertSame(5, Utf8::length("\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}"));
        self::assertSame(1, Utf8::length("\u{10FFFF}"));
        $this->expectException(\InvalidArgumentException::class);
        Utf8::length("\xED\xA0\x80");
    }

    public function testDecodeRejectsInvalidUtf8(): void
    {
        self::assertSame([0x41, 0xD800], Utf8::decode("A\xED\xA0\x80", true));
        foreach (["\xC0\x80", "\xE0\x80\x80", "\xF4\x90\x80\x80", "\x80", "\xE2\x80", "\xED\xA0\x80"] as $bytes) {
            try {
                Utf8::decode($bytes);
                self::fail('decoded ' . bin2hex($bytes));
            } catch (\InvalidArgumentException) {
                self::addToAssertionCount(1);
            }
        }
    }

    public function testLengthOfValues(): void
    {
        self::assertSame(2, LengthLimit::lengthOf(12));
        self::assertSame(5, LengthLimit::lengthOf(1e21));
        self::assertSame(1, LengthLimit::lengthOf(false));
        self::assertSame(3, LengthLimit::lengthOf(' x '));
        self::assertNull(LengthLimit::lengthOf(['a']));
        self::assertNull(LengthLimit::lengthOf((object) ['a' => 'b']));
    }

    /** @return iterable<string, array{mixed, int|null}> */
    public static function singleLimits(): iterable
    {
        yield 'zero' => [0, 0];
        yield 'integral float' => [2.0, 2];
        yield 'negative zero' => [-0.0, 0];
        yield 'largest' => [9007199254740991, 9007199254740991];
        yield 'largest as float' => [9007199254740991.0, 9007199254740991];
        yield 'fraction' => [1.5, null];
        yield 'negative' => [-1, null];
        yield 'unsafe' => [9007199254740992, null];
        yield 'unsafe float' => [9007199254740992.0, null];
        yield 'numeric string' => ['5', null];
        yield 'true' => [true, null];
        yield 'list' => [[1], null];
    }

    #[DataProvider('singleLimits')]
    public function testSingleLimit(mixed $parameter, ?int $expected): void
    {
        if ($expected !== null) {
            self::assertSame($expected, LengthLimit::single('maxlength', $parameter));
            return;
        }
        try {
            LengthLimit::single('maxlength', $parameter);
            self::fail('accepted ' . var_export($parameter, true));
        } catch (InvalidRuleParameter $error) {
            self::assertSame('INVALID_RULE_PARAMETER', $error->getErrorCode());
            self::assertSame(
                'Invalid maxlength parameter: expected an integer from 0 to 9007199254740991',
                $error->getMessage()
            );
        }
    }

    public function testRangeLimits(): void
    {
        self::assertSame([2, 2], LengthLimit::range([2, 2.0]));
        foreach ([[3, 2], [1, 2.5], [1], [1, 2, 3], ['a' => 1, 'b' => 2], '1,2', [-1, 2]] as $parameter) {
            try {
                LengthLimit::range($parameter);
                self::fail('accepted ' . var_export($parameter, true));
            } catch (InvalidRuleParameter $error) {
                self::assertSame(
                    'Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not '
                        . 'above maximum',
                    $error->getMessage(),
                );
            }
        }
    }

    public function testMembershipSources(): void
    {
        $comma = Membership::fromParameter("a,\u{3000}b\u{00A0}, 1.50");
        self::assertTrue($comma->contains('b'));
        self::assertTrue($comma->contains(" a\u{2028}"));
        self::assertTrue($comma->contains(1.5));
        self::assertFalse($comma->contains('+1.5'));
        self::assertTrue($comma->contains('01.500'));
        self::assertFalse($comma->contains('1.500.'));
        self::assertTrue($comma->contains(['a', 'b ']));
        self::assertFalse($comma->contains(['a', 'c']));
        self::assertFalse($comma->contains('A'));
        self::assertTrue($comma->contains('1.5e0'));
        self::assertTrue($comma->contains('15E-1'));
        self::assertFalse($comma->contains('0x1.8'));
        self::assertFalse($comma->contains(null));
        self::assertFalse($comma->contains((object) ['a' => 'a']));
        self::assertTrue($comma->contains(['a', null, " \u{3000}", '']));
        self::assertTrue($comma->contains(['a', [], new \stdClass()]));
        self::assertFalse($comma->contains(['a', ['a']]));
        self::assertFalse($comma->contains(['a', (object) ['a' => 'a']]));

        $list = Membership::fromParameter(['a,b', ' c ', 0, true]);
        self::assertTrue($list->contains('a,b'));
        self::assertFalse($list->contains('c'));
        // Values are trimmed, so a padded list member matches no value.
        self::assertFalse($list->contains(' c '));
        self::assertTrue($list->contains('-0'));
        self::assertTrue($list->contains('.0'));
        self::assertTrue($list->contains(false));
        self::assertTrue($list->contains(1));
        self::assertTrue($list->contains('1'));
        self::assertFalse($list->contains('true'));

        $map = Membership::fromParameter((object) ['x' => 'X', '2' => 'Two']);
        self::assertTrue($map->contains('x'));
        self::assertTrue($map->contains(2));
        self::assertTrue($map->contains('2.0'));
        self::assertFalse($map->contains('X'));
        self::assertTrue(Membership::fromParameter(['k' => 'v'])->contains('k'));
    }

    public function testMembershipComparesTextAsCodePoints(): void
    {
        $members = Membership::fromParameter(["\u{00E9}", "\u{FF11}"]);
        self::assertTrue($members->contains("\u{00E9}"));
        self::assertFalse($members->contains("e\u{0301}"));
        self::assertFalse($members->contains('1'));
        self::assertTrue(Membership::fromParameter([1e21])->contains('1000000000000000000000'));
        self::assertTrue(Membership::fromParameter([1e21])->contains('1e+21'));
    }

    public function testEmptyMemberSetsMatchNoValue(): void
    {
        foreach ([[], new \stdClass()] as $parameter) {
            $members = Membership::fromParameter($parameter);
            foreach (['a', '0', 0, 1.5, true, false] as $value) {
                self::assertFalse($members->contains($value), var_export($value, true));
            }
        }
    }

    /** @return iterable<string, array{mixed, string}> */
    public static function invalidMemberSets(): iterable
    {
        yield 'number' => [5, 'expected a list, a comma-separated string or a map'];
        yield 'true' => [true, 'expected a list, a comma-separated string or a map'];
        yield 'empty string' => ['', 'members must not be empty'];
        yield 'empty item' => ['a,,b', 'members must not be empty'];
        yield 'blank element' => [['a', "\u{3000}"], 'members must not be empty'];
        yield 'blank key' => [(object) [' ' => 'x'], 'members must not be empty'];
        yield 'null member' => [['a', null], 'members must be strings, numbers or booleans'];
        yield 'type checked in order' => [['a', ' ', null], 'members must not be empty'];
        yield 'empty checked in order' => [['a', null, ' '], 'members must be strings, numbers or booleans'];
        yield 'list member' => [[['a']], 'members must be strings, numbers or booleans'];
        yield 'object member' => [[new \stdClass()], 'members must be strings, numbers or booleans'];
    }

    #[DataProvider('invalidMemberSets')]
    public function testInvalidMemberSets(mixed $parameter, string $reason): void
    {
        try {
            Membership::fromParameter($parameter);
            self::fail('accepted ' . var_export($parameter, true));
        } catch (InvalidRuleParameter $error) {
            self::assertSame('INVALID_RULE_PARAMETER', $error->getErrorCode());
            self::assertSame('Invalid in parameter: ' . $reason, $error->getMessage());
        }
    }

    /** UTF-8 text of one Basic Multilingual Plane scalar value. */
    private static function utf8(int $codePoint): string
    {
        return match (true) {
            $codePoint < 0x80 => \chr($codePoint),
            $codePoint < 0x800 => \chr(0xC0 | $codePoint >> 6) . \chr(0x80 | $codePoint & 0x3F),
            default => \chr(0xE0 | $codePoint >> 12)
                . \chr(0x80 | ($codePoint >> 6) & 0x3F)
                . \chr(0x80 | $codePoint & 0x3F),
        };
    }
}
