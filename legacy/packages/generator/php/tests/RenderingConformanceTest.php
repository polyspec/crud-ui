<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;
use stdClass;
use PHPUnit\Framework\Attributes\DataProvider;

final class RenderingConformanceTest extends TestCase
{
    use LayoutTree;

    public static function forms(): array
    {
        return self::fixtures('form-render');
    }

    private static function fixtures(string $directory): array
    {
        $cases = json_decode(
            file_get_contents(__DIR__ . '/../../../../tests/fixtures/' . $directory . '/cases.json'),
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

    #[DataProvider('forms')]
    public function testFormLayoutMatchesTheSharedFixture(stdClass $case): void
    {
        try {
            $options = (array) ($case->options ?? new stdClass());
            $template = Generator::compileForm($case->spec, $options);
            $actual = Generator::renderForm(new Form($template, $case->data ?? [], $options));
        } catch (\Throwable $error) {
            if (!isset($case->expectError)) {
                throw $error;
            }
            self::assertTrue(method_exists($error, 'getErrorCode'));
            self::assertSame(
                (array) $case->expectError,
                ['code' => $error->getErrorCode(), 'message' => $error->getMessage()],
            );
            return;
        }
        self::assertFalse(isset($case->expectError), 'Expected generation error');
        self::assertSame(self::layout($case->expected_html), self::layout($actual));
    }
}
