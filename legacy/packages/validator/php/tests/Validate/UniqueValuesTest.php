<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;

/**
 * `unique` compares PHP values by the JSON value they denote (docs/spec/validation-rules.md): an
 * int and a float of the same number are the same number, and an associative array, as a native
 * form submits a language value, is an object whose members compare in any order.
 */
final class UniqueValuesTest extends TestCase
{
    public function testAnIntAndAFloatOfTheSameNumberAreDuplicates(): void
    {
        $spec = [
            'type' => 'group',
            'properties' => ['v' => ['type' => 'number', 'multiple' => true, 'validate' => ['unique' => true]]]
        ];
        $result = Validator::validate($spec, ['v' => ['__0000000000001__' => 1, '__0000000000002__' => 1.0]]);
        self::assertFalse($result->valid);
        self::assertSame('unique', $result->errors[0]->rule);
    }

    public function testAssociativeArraysCompareTheirMembersInAnyOrder(): void
    {
        $spec = [
            'type' => 'group',
            'properties' => ['v' => [
                'type' => 'text',
                'lang' => ['only' => ['ko', 'en']],
                'multiple' => true,
                'validate' => ['unique' => true]
            ]]
        ];
        $duplicate = Validator::validate($spec, ['v' => [
            '__0000000000001__' => ['ko' => 'a', 'en' => 'b'],
            '__0000000000002__' => ['en' => 'b', 'ko' => 'a'],
        ]]);
        self::assertFalse($duplicate->valid);
        $distinct = Validator::validate($spec, ['v' => [
            '__0000000000001__' => ['ko' => 'a', 'en' => 'b'],
            '__0000000000002__' => ['a', 'b'],
        ]]);
        self::assertTrue($distinct->valid, 'an object never equals a list');
    }

    public function testRowsBelongToOneValidation(): void
    {
        $spec = ['type' => 'group', 'properties' => [
            'rows' => ['type' => 'group', 'multiple' => true, 'properties' => [
                'code' => ['type' => 'text', 'validate' => ['unique' => true]],
            ]],
        ]];
        $rows = static fn (string ...$codes): array => ['rows' => array_combine(
            array_map(static fn (int $i): string => sprintf('__%013d__', $i + 1), array_keys($codes)),
            array_map(static fn (string $code): array => ['code' => $code], $codes),
        )];
        self::assertFalse(Validator::validate($spec, $rows('x', 'x'))->valid);
        self::assertTrue(
            Validator::validate($spec, $rows('x', 'y'))->valid,
            'a second validation answers from its own rows'
        );
    }
}
