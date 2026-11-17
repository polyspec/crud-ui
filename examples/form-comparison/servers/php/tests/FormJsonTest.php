<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison\Tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\FormComparison\FormJson;

/** FormJson decodes and encodes with the order, values and empty types of the extension polyspec_json, and refuses malformed JSON and unsupported numbers. */
final class FormJsonTest extends TestCase
{
    public function testJsonKeepsOrderValuesAndEmptyTypes(): void
    {
        $source = '{"form":{"companies":{"__0000000000005__":{"stores":{}},'
            . '"__abcde01234567__":{"stores":{"__0000000000007__":{"departments":{}}}},'
            . '"__0000000000001__":{"stores":{}}}},"items":[{},[],false,null,1.25,"서울"]}';
        $decoded = FormJson::decode($source);
        self::assertTrue(
            FormJson::encode($decoded) === $source,
            'Order, values and empty types must survive decoding and encoding'
        );
        self::assertSame('서울', FormJson::decode('"\\uc11c\\uc6b8"'), 'Escapes decode to their text');
        $data = FormJson::arrays($decoded->form);
        self::assertTrue(
            array_keys($data['companies']) === ['__0000000000005__', '__abcde01234567__', '__0000000000001__'],
            'Arrays must preserve row key order'
        );
        self::assertTrue($data['companies']['__0000000000005__']['stores'] === [], 'Arrays keep an empty collection');
        foreach (["\"\xff\"", '{"form":{},}', '9007199254740993', '1e400'] as $source) {
            $failed = false;
            try {
                FormJson::decode($source);
            } catch (InvalidArgumentException) {
                $failed = true;
            }
            self::assertTrue($failed, 'Malformed JSON and unsupported numbers must fail');
        }
    }
}
