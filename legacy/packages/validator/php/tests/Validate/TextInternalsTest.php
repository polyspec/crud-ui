<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator\Support\JsonText;
use Polyspec\Crudui\Validator\Support\Text;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * Unit tests of the internal text helpers of the library (Support\Text and Support\JsonText). They load the PHP
 * sources, so they run only against the PHP library: the conformance cases of TextValidityConformanceTest use the
 * public API and PHP's json functions alone, and an extension run never loads these classes (P32).
 */
final class TextInternalsTest extends TestCase
{
    public function testTextFailureIsWalkedAsTheTreeItDenotes(): void
    {
        $sequences = [
            \chr(0xff),
            'a' . \chr(0x80),
            \chr(0xe2) . \chr(0x82),
            \chr(0xc0) . \chr(0xaf),
            \chr(0xed) . \chr(0xa0) . \chr(0x80),
            \chr(0xf4) . \chr(0x90) . \chr(0x80) . \chr(0x80),
        ];
        foreach ($sequences as $bytes) {
            self::assertFalse(Text::isScalar($bytes), \bin2hex($bytes));
        }
        $bad = \chr(0xff);
        // Integer member names are decimal names in code point order: "10" precedes "9".
        self::assertSame(['10'], Text::failure((object) ['9' => $bad, '10' => $bad]));
        self::assertSame(['10'], Text::failure([9 => ['a' => $bad], 10 => $bad]));
        self::assertSame(['1'], Text::failure(['ok', $bad]));
        self::assertSame(['0', 'a', '0', 'b'], Text::failure([(object) ['a' => [(object) ['b' => $bad]]]]));
        $shared = (object) ['b' => $bad];
        self::assertSame(['y', 'b'], Text::failure((object) ['y' => $shared, 'z' => $shared]));
        // A value is walked as the tree it denotes: one that contains itself is beyond its limits.
        $cyclic = new stdClass();
        $cyclic->self = $cyclic;
        self::assertFalse(Text::failure($cyclic));
        $cyclic->a = $bad;
        self::assertSame(['a'], Text::failure($cyclic));
    }

    public function testJsonTextDecodesAsJsonDecode(): void
    {
        $same = [
            '{"a":[1,-2.5e3,0,true,false,null,{"b":"\u00e9\ud83d\ude00\n\/"}],"a":"last","":{}}',
            ' [ ] ',
            '123',
            '"\u0000"',
            '12345678901234567890',
            '{"_empty_":1}'
        ];
        foreach ($same as $json) {
            self::assertEquals(\json_decode($json, false, 512, JSON_THROW_ON_ERROR), JsonText::decode($json), $json);
        }
        $surrogate = \chr(0xed) . \chr(0xa0) . \chr(0x80);
        $low = \chr(0xed) . \chr(0xb0) . \chr(0x80);
        self::assertSame(
            $surrogate . 'A' . $low . $surrogate . \chr(0xff),
            JsonText::decode('"\ud800A\udc00\ud800' . \chr(0xff) . '"')
        );
        $decoded = JsonText::decode('{"\ud800":{"\ud800":[1,"x"]}}');
        self::assertSame([1, 'x'], $decoded->{$surrogate}->{$surrogate});
        $rejected = [
            '',
            '{',
            '[1,]',
            '01',
            '"\x"',
            '"a' . \chr(1) . '"',
            '{} {}',
            '"\ud800',
            '{"\u0000a":"\ud800"}',
            \str_repeat('[', 512) . '"\ud800"' . \str_repeat(']', 512)
        ];
        foreach ($rejected as $json) {
            try {
                JsonText::decode($json);
                self::fail("accepted {$json}");
            } catch (\JsonException) {
                self::addToAssertionCount(1);
            }
        }
        self::assertIsArray(JsonText::decode(\str_repeat('[', 511) . '"\ud800"' . \str_repeat(']', 511)));
    }
}
