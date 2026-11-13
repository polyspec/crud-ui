<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use stdClass;

/**
 * The outcome of one list or detail validity case (legacy/tests/fixtures/list-validity,
 * legacy/tests/fixtures/detail-validity) through the library build: a case with a recorded engine failure is refused
 * with that code and composition trace; a case with expect "fail" and engine "pass" is refused with INVALID_FORM_INPUT
 * (CUDF-036 to CUDF-062); every other case builds.
 */
trait ValidityOutcome
{
    /** @param callable(mixed, array<string, mixed>): mixed $build the library build of the family */
    private static function assertCaseOutcome(stdClass $case, callable $build): void
    {
        $files = (array) ($case->files ?? new stdClass());
        $thrown = null;
        try {
            $build($case->spec, $files);
        } catch (\Throwable $error) {
            $thrown = $error;
        }
        if (is_object($case->engine)) {
            self::assertNotNull($thrown, $case->name . ' must fail with ' . $case->engine->code);
            self::assertTrue(method_exists($thrown, 'getErrorCode'), $thrown->getMessage());
            self::assertSame($case->engine->code, $thrown->getErrorCode());
            $at = method_exists($thrown, 'getCompositionTrace') ? implode('.', $thrown->getCompositionTrace()) : '';
            self::assertSame($case->engine->at, $at);
            return;
        }
        if ($case->expect === 'ok') {
            self::assertNull($thrown, $case->name . ' must build');
            return;
        }
        self::assertNotNull($thrown, $case->name . ' must be refused');
        self::assertTrue(method_exists($thrown, 'getErrorCode'), $thrown->getMessage());
        self::assertSame('INVALID_FORM_INPUT', $thrown->getErrorCode());
    }
}
