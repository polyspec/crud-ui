<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use Polyspec\Crudui\Form;
use Polyspec\Crudui\Conformance\Evidence;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use Polyspec\CruduiTestSupport\FixtureJson;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * The compiled cases also test CURP-019 and CURP-024 (a serialized compiled template is bound).
 * The form template shape (CURT-092) against legacy/tests/fixtures/template-shape: each case's template is the decoded
 * JSON text, and its operation (`bindForm`, `bindButtons` or `createForm`) refuses a shape that is not the
 * compiled one with
 * `INVALID_FORM_INPUT`, `Unsupported form template` and an empty location. One PHPUnit case per fixture case.
 */
final class TemplateShapeTest extends TestCase
{
    private const CASES = 44;

    /**
     * @return iterable<string, array{string, stdClass}>
     */
    public static function shapeCases(): iterable
    {
        $root = \dirname(__DIR__, 5);
        $cases = FixtureJson::decode(
            (string) \file_get_contents($root . '/legacy/tests/fixtures/template-shape/cases.json')
        );
        self::assertCount(self::CASES, $cases, 'The template shape fixture holds 42 cases');
        foreach ($cases as $case) {
            yield $case->name => [$case->operation, $case];
        }
    }

    #[DataProvider('shapeCases')]
    public function testTheOperationAcceptsOrRefusesTheTemplate(string $operation, stdClass $case): void
    {
        $passed = false;
        try {
            if ($operation === 'createRecords') {
                // CURT-050: each record is bound from the serialized template alone, and reads its own values.
                $results = [];
                foreach ($case->data as $index => $record) {
                    $form = new Form($case->template, $record, []);
                    $read = [];
                    foreach ($case->paths[$index] as $path) {
                        $read[$path] = $form->getValue($path);
                    }
                    $results[] = $read;
                }
                self::assertSame(['results' => $results], (array) (json_decode(json_encode($case->expect), true)));
                $passed = true;
                return;
            }
            $expected = \is_string($case->expect) ? $case->expect : (array) $case->expect;
            self::assertSame($expected, self::outcome($operation, $case));
            $passed = true;
        } finally {
            Evidence::record(
                $operation === 'createRecords' ? 'createForm' : $operation,
                'legacy/tests/fixtures/template-shape/cases.json',
                (new \ReflectionClass(Generator::class))->isInternal() ? 'php-native' : 'php',
                $case->name,
                $passed,
            );
        }
    }

    /** @return array<string, mixed>|string The outcome in the expect shape of the fixture. */
    private static function outcome(string $operation, stdClass $case): array|string
    {
        $data = $case->data ?? [];
        $options = (array) ($case->options ?? []);
        try {
            match ($operation) {
                'bindForm' => Generator::bindForm($case->template, $data, $options),
                'bindButtons' => Generator::bindButtons($case->template, $data, $options),
                'createForm' => new Form($case->template, $data, $options),
                default => self::fail('unknown template operation ' . $operation),
            };
        } catch (FormError $error) {
            return ['code' => $error->getErrorCode(), 'message' => $error->getMessage(), 'at' => ''];
        }
        return 'pass';
    }
}
