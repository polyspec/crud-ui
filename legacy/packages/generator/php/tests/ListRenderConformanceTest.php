<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Generator;
use stdClass;

/**
 * The list layout fixtures against the PHP generator: each case of legacy/tests/fixtures/list-render renders its
 * supplied rows with its options. The layout of the output equals `expected_html` after the image preload links are
 * removed, as the Python runner compares it (legacy/tests/fixtures/list-render/README.md); a case with `expectError`
 * raises a FormError with the recorded code and, when the case records one, its message. The same file runs against the
 * native PHP extension, so it uses only the public API of the library: Generator.
 */
final class ListRenderConformanceTest extends TestCase
{
    use LayoutTree;

    /** @return array<string, array{stdClass}> */
    public static function cases(): array
    {
        $cases = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/list-render/cases.json'),
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

    /** The shared suite holds 165 cases; a repeated name would hide one of them from the data provider. */
    public function testEveryCaseIsProvided(): void
    {
        self::assertCount(165, self::cases());
    }

    #[DataProvider('cases')]
    public function testCaseWritesItsExpectation(stdClass $case): void
    {
        $options = (array) ($case->options ?? new stdClass());
        if (isset($case->expectError)) {
            try {
                Generator::renderList($case->spec, $case->rows ?? [], $options);
            } catch (\Throwable $error) {
                // A composition error carries its code too, as FormError does (the Python runner reads both the same
                // way).
                self::assertTrue(method_exists($error, 'getErrorCode'), $error->getMessage());
                self::assertSame($case->expectError->code, $error->getErrorCode());
                if (isset($case->expectError->message)) {
                    self::assertStringContainsString($case->expectError->message, $error->getMessage());
                }
                return;
            }
            self::fail($case->name . ' must fail');
        }
        self::assertSame(
            self::layout(self::withoutPreloads($case->expected_html)),
            self::layout(self::withoutPreloads(Generator::renderList($case->spec, $case->rows ?? [], $options)))
        );
    }
}
