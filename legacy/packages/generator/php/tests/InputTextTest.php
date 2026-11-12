<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use Polyspec\Crudui\Form;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\CruduiTestSupport\FixtureJson;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * Byte strings that are not UTF-8 are invalid text in every generator input
 * (docs/spec/input-text.md). The shared cases of legacy/tests/fixtures/text-validity run in one test method per
 * generator fixture (testCompileFormCase to testBuildDetailCase), one PHPUnit case each.
 */
final class InputTextTest extends TestCase
{
    private static function failure(callable $run): array
    {
        try {
            $run();
        } catch (ComposeLoadError $error) {
            return [
                'INVALID_TEXT' === $error->getErrorCode() ? 'load' : 'other',
                \implode('.', $error->getCompositionTrace()),
            ];
        } catch (FormError $error) {
            return [$error->getErrorCode(), $error->getMessage()];
        }
        return ['none', ''];
    }

    public function testGeneratorOperationsRejectInvalidUtf8(): void
    {
        $bad = \chr(0xed) . \chr(0xa0) . \chr(0x80);
        $message = static fn (string $name) => ['INVALID_FORM_INPUT', 'Text must be Unicode scalar values: ' . $name];
        $spec = static fn (mixed $label) => (object) [
            'type' => 'group',
            'properties' => (object) [
                'name' => (object) ['type' => 'text', 'label' => $label],
                'rows' => (object) [
                    'type' => 'group',
                    'multiple' => true,
                    'properties' => (object) ['v' => (object) ['type' => 'text']],
                ],
            ],
        ];
        self::assertSame(
            ['load', 'properties.name.label'],
            self::failure(static fn () => Generator::compileForm($spec('x' . $bad)))
        );
        self::assertSame(
            ['load', 'b.yml.x'],
            self::failure(
                static fn () => Generator::compileForm($spec('x'), ['files' => ['b.yml' => (object) ['x' => $bad]]])
            )
        );
        self::assertSame(
            $message('options.keyPrefix'),
            self::failure(static fn () => Generator::compileForm($spec('x'), ['keyPrefix' => $bad]))
        );
        $template = Generator::compileForm($spec('x'));
        self::assertSame(
            $message('data.rows.k.v'),
            self::failure(static fn () => Generator::bindForm($template, ['rows' => ['k' => ['v' => $bad]]]))
        );
        self::assertSame(
            $message('options.language'),
            self::failure(
                static fn () => Generator::bindButtons($template, [], ['unsupported' => $bad, 'language' => $bad])
            )
        );
        $tampered = clone $template;
        $tampered->keyPrefix = $bad;
        self::assertSame(
            $message('template.keyPrefix'),
            self::failure(static fn () => new Form($tampered, [$bad => 1]))
        );
        $form = new Form($template, ['rows' => ['k' => ['v' => 'a']]]);
        self::assertSame($message('path'), self::failure(static fn () => $form->setValue('name' . $bad, 'x')));
        self::assertSame($message('value.1'), self::failure(static fn () => $form->setValue('name', ['ok', $bad])));
        self::assertSame(
            $message('options.afterKey'),
            self::failure(static fn () => $form->addRow('rows', ['key' => $bad, 'afterKey' => $bad]))
        );
        self::assertSame($message('newKey'), self::failure(static fn () => $form->rekeyRow('rows', 'k', $bad)));
        $list = ['columns' => ['v' => ['field' => 'v']]];
        self::assertSame(
            $message('rows.1.v'),
            self::failure(static fn () => Generator::renderList($list, [['v' => 'a'], ['v' => $bad]], ['page' => 0]))
        );
        self::assertSame(
            $message('options.data.a'),
            self::failure(static fn () => Generator::buildList($list, [], ['layout' => $bad, 'data' => ['a' => $bad]]))
        );
        self::assertSame(
            $message('record.v'),
            self::failure(
                static fn () => Generator::renderDetail(['fields' => ['v' => ['field' => 'v']]], ['v' => $bad])
            )
        );
        self::assertSame(
            ['none', ''],
            self::failure(static fn () => Generator::buildDetail(['fields' => new stdClass()], ['v' => "\u{1F600}"]))
        );
    }

    /**
     * Every case of the five generator fixtures, decoded with the reader that keeps unpaired surrogates.
     *
     * @return iterable<string, array{string, stdClass}>
     */
    public static function textCases(): iterable
    {
        $root = \dirname(__DIR__, 5);
        foreach (['compileForm', 'bindForm', 'createForm', 'buildList', 'buildDetail'] as $feature) {
            $cases = FixtureJson::decode(
                (string) \file_get_contents($root . '/legacy/tests/fixtures/text-validity/' . $feature . '/cases.json')
            );
            foreach ($cases as $case) {
                yield $feature . '/' . $case->name => [$feature, $case];
            }
        }
    }

    /** @return array<string, array{0: stdClass}> The cases of one generator fixture by their bare names. */
    public static function compileFormCases(): array
    {
        return self::casesOf('compileForm');
    }

    /** @return array<string, array{0: stdClass}> */
    public static function bindFormCases(): array
    {
        return self::casesOf('bindForm');
    }

    /** @return array<string, array{0: stdClass}> */
    public static function createFormCases(): array
    {
        return self::casesOf('createForm');
    }

    /** @return array<string, array{0: stdClass}> */
    public static function buildListCases(): array
    {
        return self::casesOf('buildList');
    }

    /** @return array<string, array{0: stdClass}> */
    public static function buildDetailCases(): array
    {
        return self::casesOf('buildDetail');
    }

    /** The cases of one generator fixture by their bare names, the keys of its data provider. */
    private static function casesOf(string $feature): array
    {
        $root = \dirname(__DIR__, 5);
        $cases = FixtureJson::decode(
            (string) \file_get_contents($root . '/legacy/tests/fixtures/text-validity/' . $feature . '/cases.json')
        );
        $out = [];
        foreach ($cases as $case) {
            $out[$case->name] = [$case];
        }
        return $out;
    }

    #[DataProvider('compileFormCases')]
    public function testCompileFormCase(stdClass $case): void
    {
        $this->assertGeneratorCase('compileForm', $case);
    }

    #[DataProvider('bindFormCases')]
    public function testBindFormCase(stdClass $case): void
    {
        $this->assertGeneratorCase('bindForm', $case);
    }

    #[DataProvider('createFormCases')]
    public function testCreateFormCase(stdClass $case): void
    {
        $this->assertGeneratorCase('createForm', $case);
    }

    #[DataProvider('buildListCases')]
    public function testBuildListCase(stdClass $case): void
    {
        $this->assertGeneratorCase('buildList', $case);
    }

    #[DataProvider('buildDetailCases')]
    public function testBuildDetailCase(stdClass $case): void
    {
        $this->assertGeneratorCase('buildDetail', $case);
    }

    /** The outcome of one case of a generator fixture equals its expectation. */
    private function assertGeneratorCase(string $feature, stdClass $case): void
    {
        $expected = \is_string($case->expect) ? $case->expect : (array) $case->expect;
        self::assertSame($expected, self::outcome(static fn () => self::runOperation($feature, $case)));
    }

    /** @return array<string, mixed>|string The case outcome in the fixture's expect shape. */
    private static function outcome(callable $run): array|string
    {
        try {
            $run();
        } catch (ComposeLoadError $error) {
            return [
                'code' => $error->getErrorCode(),
                'message' => $error->getMessage(),
                'at' => \implode('.', $error->getCompositionTrace()),
            ];
        } catch (FormError $error) {
            return ['code' => $error->getErrorCode(), 'message' => $error->getMessage(), 'at' => ''];
        }
        return 'pass';
    }

    /** The options of a case as the array the public API takes, with its files as arrays. */
    private static function optionsOf(stdClass $case): array
    {
        $options = (array) ($case->options ?? []);
        if (isset($options['files']) && $options['files'] instanceof stdClass) {
            $options['files'] = (array) $options['files'];
        }
        return $options;
    }

    /**
     * CUIT-041: a generation failure is a ComposeLoadError when its input text is invalid and a FormError when an
     * input is refused, and each case that passes throws nothing. The type is checked, not only the code.
     */
    public function testGenerationFailuresHaveTheRuleTypes(): void
    {
        foreach (self::textCases() as $name => [$feature, $case]) {
            $expect = $case->expect;
            $code = \is_string($expect) ? 'pass' : $expect->code;
            try {
                self::runOperation($feature, $case);
            } catch (ComposeLoadError) {
                self::assertSame('INVALID_TEXT', $code, $name . ': a load failure is a ComposeLoadError');
                continue;
            } catch (FormError) {
                self::assertSame('INVALID_FORM_INPUT', $code, $name . ': an input failure is a FormError');
                continue;
            }
            self::assertSame('pass', $code, $name . ': a case that throws nothing passes');
        }
    }

    private static function runOperation(string $feature, stdClass $case): void
    {
        $spec = $case->spec ?? new stdClass();
        $template = static fn () => \property_exists($case, 'template')
            ? $case->template
            : Generator::compileForm($spec);
        switch ($feature) {
            case 'compileForm':
                Generator::compileForm($spec, self::optionsOf($case));
                return;
            case 'bindForm':
                Generator::bindForm($template(), $case->data ?? [], self::optionsOf($case));
                return;
            case 'createForm':
                $form = new Form($template(), $case->data ?? [], self::optionsOf($case));
                if (\property_exists($case, 'action')) {
                    self::runAction($form, $case->action);
                }
                return;
            case 'buildList':
                Generator::buildList($spec, $case->rows ?? [], self::optionsOf($case));
                return;
            default:
                Generator::buildDetail($spec, $case->record ?? new stdClass(), self::optionsOf($case));
        }
    }

    /** Calls the form method that a case's action names, with its args. */
    private static function runAction(Form $form, stdClass $action): void
    {
        $args = $action->args;
        switch ($action->method) {
            case 'setData':
                $form->setData($args[0]);
                return;
            case 'setValue':
                $form->setValue($args[0], $args[1]);
                return;
            case 'getValue':
                $form->getValue($args[0]);
                return;
            case 'addRow':
                $form->addRow($args[0], isset($args[1]) ? (array) $args[1] : []);
                return;
            case 'copyRow':
                $form->copyRow($args[0], $args[1]);
                return;
            case 'removeRow':
                $form->removeRow($args[0], $args[1]);
                return;
            case 'moveRow':
                $form->moveRow($args[0], $args[1], $args[2]);
                return;
            case 'rekeyRow':
                $form->rekeyRow($args[0], $args[1], $args[2]);
                return;
        }
        throw new \LogicException('unknown form action ' . $action->method);
    }
}
