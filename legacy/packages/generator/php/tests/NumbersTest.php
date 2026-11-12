<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Generator;

final class NumbersTest extends TestCase
{
    public function testListNumberStringsAndDecimalOptionTypes(): void
    {
        foreach (
            [
                ['0x10', 2, '16.00'],
                ['0b101', 0, '5'],
                ['0o17', 0, '15'],
                [1.25, '1', '1.25'],
                ["\u{FEFF}16\u{00A0}", 1, '16.0'],
                ['1e999', 2, '1e999'],
                ['-0x10', 2, '-0x10'],
            ] as [$value, $places, $expected]
        ) {
            $spec = (object) [
                'columns' => (object) [
                    'number' => (object) [
                        'field' => 'value',
                        'format' => (object) ['type' => 'number', 'decimals' => $places],
                    ]
                ]
            ];
            $html = Generator::renderList($spec, [(object) ['value' => $value]]);
            self::assertStringContainsString(
                '<td class="crudui-list__cell crudui-value crudui-value--number">' . $expected . '</td>',
                $html
            );
        }
    }
}
