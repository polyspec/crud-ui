<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests\Internal;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Generator\Numbers;
use PHPUnit\Framework\Attributes\DataProvider;

final class NumberFormattingTest extends TestCase
{
    public static function fixedCases(): array
    {
        return [
            [2.5, 0, '3'],
            [-2.5, 0, '-3'],
            [1.005, 2, '1.00'],
            [2.675, 2, '2.67'],
            [1.25, 1, '1.3'],
            [-1.25, 1, '-1.3'],
            [1.0E+21, 2, '1e+21'],
            [-0.0, 2, '0.00'],
            [-0.001, 2, '-0.00'],
            [0.3, 20, '0.29999999999999998890'],
            [1.0000000000000001E+18, 0, '1000000000000000128'],
            [4.940656458412465E-324, 2, '0.00'],
        ];
    }

    #[DataProvider('fixedCases')]
    public function testFixedUsesExactBinaryValue(float $number, int $places, string $expected): void
    {
        self::assertSame($expected, Numbers::fixed($number, $places));
    }

    public function testShortestFormattingUsesDecimalAndExponentThresholds(): void
    {
        foreach (
            [
                [1.0E-7, '1e-7'],
                [1.0E-6, '0.000001'],
                [1.0E+20, '100000000000000000000'],
                [1.0E+21, '1e+21'],
                [-0.0, '0'],
                [1.2345678901234567, '1.2345678901234567'],
            ] as [$number, $expected]
        ) {
            self::assertSame($expected, Numbers::string($number));
        }
    }


    public function testDecimalPrecisionTruncatesBeforeItsRangeIsChecked(): void
    {
        self::assertSame('1.25', Numbers::fixed(1.25, 2.9));
        self::assertSame('1', Numbers::fixed(1.25, -0.9));
        self::assertSame('1.' . str_repeat('0', 100), Numbers::fixed(1.0, 100.9));
        foreach ([-1, 101, 1e200] as $places) {
            try {
                Numbers::fixed(1.0, $places);
                self::fail('Invalid precision must fail');
            } catch (\Polyspec\Crudui\FormError $error) {
                self::assertSame('INVALID_FORM_INPUT', $error->getErrorCode());
                self::assertSame('Number decimals must be between 0 and 100', $error->getMessage());
            }
        }
    }
}
