<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Generator;
use stdClass;

/**
 * The detail-validity cases through Generator::buildDetail: each case of legacy/tests/fixtures/detail-validity is a
 * data set named by the case (the detail-render-validity unit). The same file runs against the native PHP extension.
 */
final class DetailRenderValidityTest extends TestCase
{
    use ValidityOutcome;

    /** @return array<string, array{stdClass}> */
    public static function cases(): array
    {
        $cases = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/detail-validity/cases.json'),
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
    public function testDetailRefusesOrAcceptsCase(stdClass $case): void
    {
        self::assertCaseOutcome($case, static fn (mixed $spec, array $files): mixed => Generator::buildDetail(
            $spec,
            new stdClass(),
            ['files' => $files]
        ));
    }
}
