<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use PHPUnit\Framework\TestCase;

/**
 * Parameter errors are load failures (docs/spec/validation-rules.md, "Parameter
 * errors"): declared parameters are checked in declaration order, a field's own rules
 * before the fields it contains, and selected parameters when they are selected.
 */
final class RuleParametersTest extends TestCase
{
    public function testCompositionErrorPreservesPreviousCauseAndTrace(): void
    {
        $cause = new \InvalidArgumentException('Invalid parameter');
        $error = new ComposeLoadError('INVALID_RULE_PARAMETER', 'Invalid declaration', ['rows', 'name'], $cause);
        self::assertSame('INVALID_RULE_PARAMETER', $error->getErrorCode());
        self::assertSame('Invalid declaration', $error->getMessage());
        self::assertSame(['rows', 'name'], $error->getCompositionTrace());
        self::assertSame(0, $error->getCode());
        self::assertSame($cause, $error->getPrevious());
        self::assertNull((new ComposeLoadError('INVALID_RULE_PARAMETER', 'Invalid declaration'))->getPrevious());
    }

    public function testInvalidPatternPreservesCompletePreviousCauseChain(): void
    {
        $spec = (object) [
            'type' => 'group',
            'properties' => (object) [
                'name' => (object) ['type' => 'text', 'validate' => (object) ['pattern' => '\\q']],
            ],
        ];
        try {
            Validator::validate($spec, new \stdClass());
            self::fail('Invalid pattern must fail declaration checking');
        } catch (ComposeLoadError $error) {
            self::assertSame('INVALID_RULE_PATTERN', $error->getErrorCode());
            self::assertSame(['name'], $error->getCompositionTrace());
            $parameter = $error->getPrevious();
            self::assertInstanceOf(\Polyspec\Crudui\Validator\Values\InvalidRuleParameter::class, $parameter);
            self::assertSame($parameter->getErrorCode(), $error->getErrorCode());
            self::assertSame($parameter->getMessage(), $error->getMessage());
            $syntax = $parameter->getPrevious();
            self::assertInstanceOf(\Polyspec\Crudui\Validator\Patterns\PatternSyntaxError::class, $syntax);
            self::assertSame('invalid escape', $syntax->reason);
            self::assertSame(0, $syntax->offset);
        }
    }

    /** @return array{code: string, message: string, at: string} */
    private static function failure(string $spec, string $data = '{}'): array
    {
        try {
            Validator::validate(json_decode($spec), json_decode($data));
        } catch (ComposeLoadError $error) {
            return [
                'code' => $error->getErrorCode(),
                'message' => $error->getMessage(),
                'at' => implode('.', $error->getCompositionTrace())
            ];
        }
        self::fail('no load failure for ' . $spec);
    }

    public function testFirstInvalidParameterInDeclarationOrder(): void
    {
        self::assertSame(
            [
                'code' => 'INVALID_RULE_PATTERN',
                'message' => 'Invalid pattern pattern: invalid escape at 0',
                'at' => 'a'
            ],
            self::failure(
                '{"type":"group","properties":{"a":{"type":"text","validate":{"required":true,'
                    . '"pattern":"\\\\q","in":5}},"b":{"type":"text","validate":{"maxlength":-1}}}}'
            ),
        );
        self::assertSame(
            [
                'code' => 'INVALID_RULE_PARAMETER',
                'message' => 'Invalid rangelength parameter: expected [minimum, maximum] integers with minimum '
                    . 'not above maximum',
                'at' => 'g.h.i'
            ],
            self::failure(
                '{"type":"group","properties":{"g":{"type":"group","validate":{"required":true},'
                    . '"properties":{"h":{"type":"group","multiple":true,"properties":{"i":{"type":"text",'
                    . '"validate":{"rangelength":[2,1]}}}}}}}}'
            ),
        );
    }

    public function testParametersAreCheckedWithoutData(): void
    {
        $spec = json_decode(
            '{"type":"group","properties":{"rows":{"type":"group","multiple":true,'
                . '"properties":{"name":{"type":"text","validate":{"in":["a",null]}}}}}}'
        );
        foreach (['{}', '{"rows":{}}', '{"rows":{"r1":{"name":"a"}}}'] as $data) {
            try {
                Validator::validate($spec, json_decode($data));
                self::fail('no load failure for ' . $data);
            } catch (ComposeLoadError $error) {
                self::assertSame('rows.name', implode('.', $error->getCompositionTrace()));
                self::assertSame(
                    'Invalid in parameter: members must be strings, numbers or booleans',
                    $error->getMessage()
                );
            }
        }
    }

    public function testDisabledRulesAreNotChecked(): void
    {
        $spec = json_decode(
            '{"type":"group","properties":{"a":{"type":"text","validate":{"pattern":null,"match":false,'
                . '"in":false,"minlength":null}}}}'
        );
        self::assertTrue(Validator::validate($spec, json_decode('{"a":""}'))->valid);
    }

    public function testUnregisteredRuleNamesFailTheLoad(): void
    {
        self::assertSame(
            ['code' => 'UNKNOWN_RULE', 'message' => 'Unknown rule: custom', 'at' => 'a'],
            self::failure(
                '{"type":"group","properties":{"a":{"type":"text","validate":{"pattern":null,"custom":false}}}}'
            ),
        );
        self::assertSame(
            ['code' => 'UNKNOWN_RULE', 'message' => 'Unknown rule: 7', 'at' => 'g.a'],
            self::failure(
                '{"type":"group","properties":{"g":{"type":"group","properties":{"a":{"type":"text",'
                    . '"messages":{"7":"x"}}}}}}'
            ),
        );
    }

    public function testEveryLiteralAConditionCanSelectIsCheckedAtLoad(): void
    {
        $message = 'Invalid minlength parameter: expected an integer from 0 to 9007199254740991';
        foreach (['{".a":2,".b":"3","true":1}', '".a ? 2 : .b ? 1 : 1.5"', '".a ? (.b) : -1"'] as $parameter) {
            self::assertSame(
                ['code' => 'INVALID_RULE_PARAMETER', 'message' => $message, 'at' => 'v'],
                self::failure(
                    '{"type":"group","properties":{"v":{"type":"text","validate":{"minlength":' . $parameter . '}}}}'
                ),
                $parameter,
            );
        }
        $valid = '{"type":"group","properties":{"v":{"type":"text","validate":{"minlength":{".a":2,"true":null},'
            . '"maxlength":".a ? false : 3"}}}}';
        self::assertTrue(Validator::validate(json_decode($valid), json_decode('{"v":"ab"}'))->valid);
    }

    public function testDataValuesAreCheckedWhenSelected(): void
    {
        $spec = '{"type":"group","properties":{"big":{"type":"text"},"limit":{"type":"text"},"value":{"type":"text",'
            . '"validate":{"maxlength":".big ? .limit : 3"}}}}';
        self::assertTrue(Validator::validate(
            json_decode($spec),
            json_decode('{"big":0,"limit":-1,"value":"abc"}')
        )->valid);
        self::assertSame(
            [
                'code' => 'INVALID_RULE_PARAMETER',
                'message' => 'Invalid maxlength parameter: expected an integer from 0 to 9007199254740991',
                'at' => 'value'
            ],
            self::failure($spec, '{"big":1,"limit":-1}'),
        );
        $rows = '{"type":"group","properties":{"rows":{"type":"group","multiple":true,'
            . '"properties":{"flag":{"type":"text"},"limit":{"type":"text"},"name":{"type":"text",'
            . '"validate":{"minlength":".flag ? .limit : 1"}}}}}}';
        self::assertTrue(Validator::validate(
            json_decode($rows),
            json_decode('{"rows":{"r1":{"flag":0,"limit":"2","name":"x"}}}')
        )->valid);
        self::assertSame(
            [
                'code' => 'INVALID_RULE_PARAMETER',
                'message' => 'Invalid minlength parameter: expected an integer from 0 to 9007199254740991',
                'at' => 'rows.name'
            ],
            self::failure($rows, '{"rows":{"r1":{"flag":0,"name":"x"},"r2":{"flag":1,"limit":"2","name":"x"}}}'),
        );
    }

    public function testBooleanConditionLimits(): void
    {
        $spec = '{"type":"group","properties":{"on":{"type":"text"},"value":{"type":"text",'
            . '"validate":{"maxlength":".on"}}}}';
        self::assertTrue(Validator::validate(json_decode($spec), json_decode('{"on":0,"value":"abcdef"}'))->valid);
        self::assertSame(
            [
                'code' => 'INVALID_RULE_PARAMETER',
                'message' => 'Invalid maxlength parameter: expected an integer from 0 to 9007199254740991',
                'at' => 'value'
            ],
            self::failure($spec, '{"on":1,"value":""}'),
        );
    }

    public function testLiteralStringLimitIsADeclaredParameter(): void
    {
        self::assertSame(
            [
                'code' => 'INVALID_RULE_PARAMETER',
                'message' => 'Invalid minlength parameter: expected an integer from 0 to 9007199254740991',
                'at' => 'a'
            ],
            self::failure('{"type":"group","properties":{"a":{"type":"text","validate":{"minlength":"5"}}}}'),
        );
    }


    public function testForbiddenKeysAreReportedBeforeParameters(): void
    {
        self::assertSame(
            'FORBIDDEN_META_KEY',
            self::failure(
                '{"type":"group","properties":{"a":{"type":"text","validate":{"pattern":"("}},'
                    . '"b":{"type":"text","xnote":"x"}}}'
            )['code'],
        );
    }
}
