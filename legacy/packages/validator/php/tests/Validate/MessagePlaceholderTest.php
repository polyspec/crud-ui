<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Message placeholders (docs/spec/validation-rules.md, "Numbers"): `{0}` and `{1}` are replaced
 * only when the rule has that parameter; any other placeholder stays as written.
 */
final class MessagePlaceholderTest extends TestCase
{
    /** @return array<string, array{string, string, string}> */
    public static function messages(): array
    {
        return [
            'required has no parameter' => ['{"required":true}', '""', 'need {0}'],
            'in has no placeholder parameter' => ['{"in":["a","b"]}', '"c"', 'one of {0} {1}'],
            'equalTo has no placeholder parameter' => ['{"equalTo":".other"}', '"x"', 'same as {0}'],
            'min has no second parameter' => ['{"min":3}', '1', 'at least 3, not {1}'],
            'range has both' => ['{"range":[1.5,1e21]}', '0', 'from 1.5 to 1e+21 {2}'],
            'step canonical text' => ['{"step":0.1}', '0.15', 'by 0.1 and 0.1'],
        ];
    }

    #[DataProvider('messages')]
    public function testPlaceholdersOfTheRuleParametersOnly(string $rules, string $value, string $expected): void
    {
        $rule = array_key_first((array) json_decode($rules));
        $template = match ($rule) {
            'required' => 'need {0}',
            'in' => 'one of {0} {1}',
            'equalTo' => 'same as {0}',
            'min' => 'at least {0}, not {1}',
            'range' => 'from {0} to {1} {2}',
            default => 'by {0} and {0}',
        };
        $spec = json_decode(
            '{"type":"group","properties":{"other":{"type":"text"},"value":{"type":"text","validate":'
                . $rules
                . ',"messages":'
                . json_encode([$rule => $template])
                . '}}}'
        );
        $result = json_decode(
            json_encode(Validator::validate($spec, json_decode('{"other":"y","value":' . $value . '}'))),
            true
        );
        self::assertSame($expected, $result['errors'][0]['message'] ?? null);
    }
}
