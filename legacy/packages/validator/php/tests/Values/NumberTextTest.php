<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Values;

use Polyspec\Crudui\Validator\Values\CanonicalText;
use Polyspec\Crudui\Validator\Values\NumberText;
use PHPUnit\Framework\TestCase;

/**
 * Canonical number text is ECMAScript Number.prototype.toString. number-text.json holds
 * doubles and the text JavaScript writes for them (see number-text.generate.mjs).
 */
final class NumberTextTest extends TestCase
{
    public function testEveryDoubleIsWrittenAsEcmaScriptWritesIt(): void
    {
        $raw = file_get_contents(__DIR__ . '/number-text.json');
        self::assertNotFalse($raw);
        $cases = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        self::assertGreaterThan(8000, \count($cases));
        $mismatches = [];
        foreach ($cases as [$hex, $expected]) {
            $number = unpack('E', (string) hex2bin($hex))[1];
            $actual = NumberText::of($number);
            if ($actual !== $expected) {
                $mismatches[] = "$hex: expected $expected, got $actual";
            }
        }
        self::assertSame([], \array_slice($mismatches, 0, 20));
    }

    public function testTextDoesNotDependOnPrecisionSettings(): void
    {
        $precision = ini_get('precision');
        $serialize = ini_get('serialize_precision');
        try {
            ini_set('precision', '3');
            ini_set('serialize_precision', '17');
            self::assertSame('0.30000000000000004', NumberText::of(0.1 + 0.2));
            self::assertSame('0.1', NumberText::of(0.1));
        } finally {
            ini_set('precision', (string) $precision);
            ini_set('serialize_precision', (string) $serialize);
        }
    }

    public function testLayoutBoundaries(): void
    {
        self::assertSame('123456789012345680000', NumberText::of(123456789012345680000.0));
        self::assertSame('1e+21', NumberText::of(1e21));
        self::assertSame('0.000001', NumberText::of(0.000001));
        self::assertSame('1e-7', NumberText::of(1e-7));
        self::assertSame('1.5e-7', NumberText::of(1.5e-7));
        self::assertSame('-2.5e+300', NumberText::of(-2.5e300));
        self::assertSame('0', NumberText::of(-0.0));
        self::assertSame('5e-324', NumberText::of(5e-324));
        self::assertSame('1.7976931348623157e+308', NumberText::of(PHP_FLOAT_MAX));
    }

    public function testNonFiniteNumbersHaveNoText(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        NumberText::of(NAN);
    }

    public function testCanonicalTextOfScalars(): void
    {
        self::assertSame(' x ', CanonicalText::of(' x '));
        self::assertSame('1', CanonicalText::of(true));
        self::assertSame('0', CanonicalText::of(false));
        self::assertSame('12', CanonicalText::of(12));
        self::assertSame('12', CanonicalText::of(12.0));
        self::assertSame('9007199254740992', CanonicalText::of(9007199254740993));
        self::assertSame('9223372036854776000', CanonicalText::of(PHP_INT_MAX));
        self::assertSame('-9223372036854776000', CanonicalText::of(PHP_INT_MIN));
        self::assertNull(CanonicalText::of(null));
        self::assertNull(CanonicalText::of([]));
        self::assertNull(CanonicalText::of(['a']));
        self::assertNull(CanonicalText::of(new \stdClass()));
    }
}
