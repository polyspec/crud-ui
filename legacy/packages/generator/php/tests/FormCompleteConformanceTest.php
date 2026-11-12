<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use stdClass;

/**
 * The complete form fixtures against the PHP generator: each case of legacy/tests/fixtures/form-complete is compiled from its
 * specification, bound with its data and options, and rendered with its render options. The output equals
 * `expected_html`
 * byte for byte, and a case with `expectError` raises a FormError with the recorded code and message
 * (legacy/tests/fixtures/form-complete/README.md). The same file runs against the native PHP extension, so it uses only the
 * public API of the library: Generator and Form.
 */
final class FormCompleteConformanceTest extends TestCase
{
    /** @return array<string, array{stdClass}> */
    public static function cases(): array
    {
        $cases = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/form-complete/cases.json'),
            false,
            512,
            JSON_THROW_ON_ERROR
        );
        $out = [];
        foreach ($cases as $case) {
            $out[$case->name] = [$case];
        }
        return $out;
    }

    /** The shared suite holds 28 cases; a repeated name would hide one of them from the data provider. */
    public function testEveryCaseIsProvided(): void
    {
        self::assertCount(28, self::cases());
    }

    #[DataProvider('cases')]
    public function testCaseWritesItsExpectation(stdClass $case): void
    {
        $form = new Form(
            Generator::compileForm($case->spec),
            $case->data,
            (array) ($case->options ?? new stdClass())
        );
        if (isset($case->expectError)) {
            try {
                Generator::renderForm($form, $case->render);
            } catch (FormError $error) {
                self::assertSame($case->expectError->code, $error->getErrorCode());
                self::assertSame($case->expectError->message, $error->getMessage());
                return;
            }
            self::fail($case->name . ' must fail');
        }
        self::assertSame($case->expected_html, Generator::renderForm($form, $case->render));
    }
}
