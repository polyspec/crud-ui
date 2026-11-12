<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;

/**
 * The unique rule walks the values of a collection once per validation (validation-rules.md).
 * Each test validates 25,000 distinct values, which a single walk checks within seconds; a check
 * that walks every earlier value again for each value makes 3 * 10^8 value visits and does not
 * end before the per-test timeout of the run-tests tool of @polyspec/kit, which fails the test. No test reads a
 * clock, so the load of the machine cannot change a result.
 */
final class UniqueManyValuesTest extends TestCase
{
    private const COUNT = 25000;

    public function testRowsOfARepeatedGroupAreWalkedOnce(): void
    {
        $spec = ['type' => 'group', 'properties' => ['items' => ['type' => 'group', 'multiple' => true,
            'properties' => ['code' => ['type' => 'text', 'validate' => ['unique' => true]]]]]];
        $items = [];
        for ($i = 0; $i < self::COUNT; $i++) {
            $items[self::key($i)] = ['code' => "item-{$i}"];
        }
        $result = Validator::validate($spec, ['items' => (object) $items]);
        self::assertSame([], $result->errors);
        self::assertTrue($result->valid);
    }

    public function testValuesOfARepeatedFieldAreWalkedOnce(): void
    {
        $spec = ['type' => 'group', 'properties' => ['codes' => ['type' => 'text', 'multiple' => true,
            'validate' => ['unique' => true]]]];
        $codes = [];
        for ($i = 0; $i < self::COUNT; $i++) {
            $codes[self::key($i)] = "item-{$i}";
        }
        $result = Validator::validate($spec, ['codes' => (object) $codes]);
        self::assertSame([], $result->errors);
        self::assertTrue($result->valid);
    }

    private static function key(int $index): string
    {
        return '__' . str_pad((string) ($index + 1), 13, '0', STR_PAD_LEFT) . '__';
    }
}
