<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Generator;
use stdClass;

final class OutlineTest extends TestCase
{
    /** @return array<string, array{stdClass}> */
    public static function cases(): array
    {
        $cases = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/form-outline/cases.json'),
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

    #[DataProvider('cases')]
    public function testBuildOutlineMatchesTheSharedFixture(stdClass $case): void
    {
        $template = Generator::compileForm($case->spec);
        $nodes = Generator::bindForm($template, $case->data, (array) $case->options);
        self::assertSame(
            json_encode($case->expected_outline_rows, JSON_THROW_ON_ERROR),
            json_encode(Generator::buildOutline($nodes), JSON_THROW_ON_ERROR),
            $case->name
        );
    }
}
