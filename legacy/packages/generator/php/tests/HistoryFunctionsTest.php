<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Conformance\Evidence;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use stdClass;

/** The history function cases of legacy/tests/fixtures/history-functions (CURT-063, CURT-076 to CURT-080); each case is a data set named by its name. */
final class HistoryFunctionsTest extends TestCase
{
    /** @return array<string, array{stdClass}> */
    public static function cases(): array
    {
        $cases = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/history-functions/cases.json'),
            false,
            512,
            JSON_THROW_ON_ERROR,
        );
        self::assertIsArray($cases);
        $out = [];
        foreach ($cases as $case) {
            $out[$case->name] = [$case];
        }

        return $out;
    }

    #[DataProvider('cases')]
    public function testHistoryFunctionMatchesTheSharedFixture(stdClass $case): void
    {
        $passed = false;
        try {
            self::assertEquals($case->expected, $this->observe($case->op, $case->args));
            $passed = true;
        } finally {
            Evidence::record(
                'formHistory',
                'legacy/tests/fixtures/history-functions/cases.json',
                (new \ReflectionClass(Generator::class))->isInternal() ? 'php-native' : 'php',
                $case->name,
                $passed,
            );
        }
    }

    /** @param list<mixed> $args */
    private function observe(string $op, array $args): stdClass
    {
        try {
            return (object) ['result' => match ($op) {
                'emptyHistory' => Generator::emptyHistory(),
                'recordChange' => Generator::recordChange($args[0], $args[1], $args[2]),
                'canUndoRedo' => [Generator::canUndo($args[0]), Generator::canRedo($args[0])],
                'undoChange' => Generator::undoChange($args[0], $args[1]),
                'redoChange' => Generator::redoChange($args[0], $args[1]),
                default => self::fail("unknown function {$op}"),
            }];
        } catch (FormError $error) {
            return (object) ['error' => (object) ['code' => $error->getErrorCode(), 'message' => $error->getMessage()]];
        }
    }
}
