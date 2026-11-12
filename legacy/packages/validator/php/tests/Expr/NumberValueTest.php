<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Expr;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Validator\Expr\Expression;
use Polyspec\Crudui\Validator\Support\NumberValue;
use PHPUnit\Framework\Attributes\DataProvider;

final class NumberValueTest extends TestCase
{
    public static function numericStrings(): array
    {
        return [
            ['', 0.0], ["\u{FEFF}\u{00A0}16\u{2029}", 16.0], ['0x10', 16.0], ['0b101', 5.0], ['0o17', 15.0],
            ['-0x10', null], ['0o8', null], ['0b2', null], ['NaN', null], ['1.2x', null], ["\x00", null], [
                "\u{0085}1",
                null
            ],
            ['+1.25e2', 125.0], ['0x20000000000001', 9007199254740992.0], ['0x20000000000003', 9007199254740996.0],
            ['0xbeddbd88a491d408d0415072f52b9a13fda', 1.0391742914815888e42],
            ['0x9364712a5828e40bc42df9393a93b83d56', 5.01550183253474e40],
            ['0x2259d87f99903d0001520afa30aaae', 1.7836038041825528e35],
        ];
    }

    #[DataProvider('numericStrings')]
    public function testCompleteNumberConversionUsesOneRounding(string $text, ?float $expected): void
    {
        self::assertSame($expected, NumberValue::parseString($text));
    }

    public function testExpressionEqualityUsesTheSharedNumberConversion(): void
    {
        self::assertTrue(Expression::evaluate('.value == 16', ['value' => '0x10']));
        self::assertTrue(Expression::evaluate('.value == 5', ['value' => '0b101']));
        self::assertFalse(Expression::evaluate('.value == 16', ['value' => '-0x10']));
    }

    public function testNumbersBeyondTheIntegerRangeKeepTheirValue(): void
    {
        self::assertTrue(Expression::evaluate('.value == 100000000000000000000000000', ['value' => 1e26]));
        self::assertTrue(Expression::evaluate(".value == '1e+26'", ['value' => 1e26]));
        self::assertTrue(Expression::evaluate(
            ".value == '-9223372036854776000'",
            ['value' => -9223372036854775807 - 1]
        ));
        self::assertTrue(Expression::evaluate(".value != 'x'", ['value' => 1e26]));
        self::assertTrue(Expression::evaluateValue(
            '.flag ? 100000000000000000000000000 : 0',
            ['flag' => true]
        ) === 1e26);
    }
}
