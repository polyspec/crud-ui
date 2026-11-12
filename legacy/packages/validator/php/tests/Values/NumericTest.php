<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Values;

use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\NumberText;
use Polyspec\Crudui\Validator\Values\Numeric;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Numeric values, exact step multiples, digits, counts and numeric parameters
 * (docs/spec/validation-rules.md, "Numbers").
 */
final class NumericTest extends TestCase
{
    public function testNumericText(): void
    {
        foreach (
            [
                '12' => 12.0,
                '-.5e+2' => -50.0,
                "\u{3000}1E3\t" => 1000.0,
                '007' => 7.0,
                '1e-400' => 0.0,
                '-0' => -0.0
            ] as $text => $expected
        ) {
            self::assertSame($expected, Numeric::of((string) $text), (string) $text);
        }
        foreach (
            [
                '+1',
                '1.',
                '.',
                '-',
                '0x10',
                '0b1',
                'Infinity',
                'NaN',
                '1_000',
                '1e',
                'e5',
                '--1',
                '1e999',
                '-1e999',
                '1,5',
                '1 2',
                "\u{0661}",
                '',
                ' '
            ] as $text
        ) {
            self::assertNull(Numeric::of($text), $text);
        }
        self::assertSame(9007199254740992.0, Numeric::of(9007199254740993));
        self::assertSame(
            [100.0, null, null, 5.0],
            [Numeric::asWritten('100'), Numeric::asWritten(' 100'), Numeric::asWritten("100\t"), Numeric::asWritten(5)]
        );
        foreach ([true, false, null, [], ['1'], new \stdClass(), INF, NAN] as $value) {
            self::assertNull(Numeric::of($value));
        }
    }

    public function testDecimalOfCanonicalText(): void
    {
        self::assertSame([3, -1], NumberText::decimal(0.3));
        self::assertSame([30000000000000004, -17], NumberText::decimal(0.30000000000000004));
        self::assertSame([1, 21], NumberText::decimal(1e21));
        self::assertSame([5, -324], NumberText::decimal(5e-324));
        self::assertSame([17976931348623157, 292], NumberText::decimal(PHP_FLOAT_MAX));
        self::assertSame([12, 0], NumberText::decimal(12.0));
    }

    /** @return array<string, array{float, float, bool}> */
    public static function multiples(): array
    {
        return [
            'zero' => [0.0, 0.1, true],
            'negative zero' => [-0.0, 3.0, true],
            'decimal' => [0.3, 0.1, true],
            'drift' => [0.30000000000000004, 0.1, false],
            'negative' => [-0.6, 0.1, true],
            'below step' => [2e-7, 0.1, false],
            'far apart' => [1e300, 1e-300, true],
            'smallest' => [1e-323, 5e-324, true],
            'smallest odd' => [1.5e-323, 1e-323, false],
            'largest' => [PHP_FLOAT_MAX, 1.0, true],
            'largest by 7' => [PHP_FLOAT_MAX, 7.0, false],
            'large step' => [1.5e21, 1e20, true],
            'large miss' => [1.05e21, 1e20, false],
            'beyond int by tenth' => [1e26, 0.1, true],
            'beyond int by 3' => [1e26, 3.0, false],
            'beyond int by 1e25' => [1e26, 1e25, true],
            'beyond int by fraction' => [1.2345e26, 0.0003, true],
            'long significand' => [98765432109876540.0, 9876543210987654.0, true],
            'long step' => [98765432109876540.0, 98765432109876.55, false],
            'step above value' => [3.0, 7.0, false],
            'quarter' => [1.75, 0.25, true],
            'quarter miss' => [1.8, 0.25, false],
            'fine value' => [1.23456789, 1e-8, true],
            'fine miss' => [1.23456789, 1e-7, false],
            'wide shift' => [12345678901234567.0, 1e-5, true],
            'shift over digits' => [1e-30, 1e-10, false],
        ];
    }

    #[DataProvider('multiples')]
    public function testExactMultiples(float $value, float $step, bool $expected): void
    {
        self::assertSame($expected, Numeric::isMultiple($value, $step));
    }

    public function testDigits(): void
    {
        foreach (['123', ' 007 ', 42, 0, -0.0, 1e20] as $value) {
            self::assertTrue(Numeric::isDigits($value), var_export($value, true));
        }
        foreach (['12a', '-1', '1.0', 1.5, 1e21, -1, true, false, null, ['1'], "\u{0661}", '1 2', '', INF] as $value) {
            self::assertFalse(Numeric::isDigits($value), var_export($value, true));
        }
    }

    public function testCounts(): void
    {
        self::assertSame(0, Numeric::count(null));
        self::assertSame(0, Numeric::count(" \u{3000}"));
        self::assertSame(0, Numeric::count([]));
        self::assertSame(0, Numeric::count(new \stdClass()));
        self::assertSame(2, Numeric::count(['a', 'b']));
        self::assertSame(2, Numeric::count((object) ['x' => 1, '2' => 2]));
        foreach (['x', 0, 0.0, false, true] as $scalar) {
            self::assertSame(1, Numeric::count($scalar));
        }
    }

    public function testParameters(): void
    {
        self::assertTrue(Numeric::flag('number', true));
        self::assertSame(5.0, Numeric::bound('min', 5));
        self::assertSame(-0.5, Numeric::bound('max', -0.5));
        self::assertSame([1.0, 1.0], Numeric::range([1, 1.0]));
        self::assertSame(1e-300, Numeric::step(1e-300));
        $failures = [
            [fn () => Numeric::flag('digits', 1), 'Invalid digits parameter: expected true or false'],
            [fn () => Numeric::flag('number', 'true'), 'Invalid number parameter: expected true or false'],
            [fn () => Numeric::bound('min', '5'), 'Invalid min parameter: expected a finite number'],
            [fn () => Numeric::bound('max', INF), 'Invalid max parameter: expected a finite number'],
            [fn () => Numeric::bound('min', false), 'Invalid min parameter: expected a finite number'],
            [
                fn () => Numeric::range(['min' => 1, 'max' => 2]),
                'Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum'
            ],
            [
                fn () => Numeric::range([2, 1]),
                'Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum'
            ],
            [
                fn () => Numeric::range([1, '2']),
                'Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum'
            ],
            [fn () => Numeric::step(-0.0), 'Invalid step parameter: expected a finite number above 0'],
            [fn () => Numeric::step(NAN), 'Invalid step parameter: expected a finite number above 0'],
            [fn () => Numeric::step('1'), 'Invalid step parameter: expected a finite number above 0'],
        ];
        foreach ($failures as [$call, $message]) {
            try {
                $call();
                self::fail('no failure for ' . $message);
            } catch (InvalidRuleParameter $error) {
                self::assertSame('INVALID_RULE_PARAMETER', $error->getErrorCode());
                self::assertSame($message, $error->getMessage());
            }
        }
    }
}
