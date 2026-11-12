<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Polyspec\Crudui\Conformance\Evidence;

/**
 * CRUDUI recursive forbidden-scan conformance (SPEC §6 global meta-key rejection).
 *
 * The shared fixture legacy/tests/fixtures/spec-validity/cases.json defines the expected
 * result. A clean spec passes; a forbidden meta key found at any depth
 * (slot/bucket body and one level below, deep child subtrees, array elements,
 * $ref-inherited bases) is a LOAD ERROR, never valid:true. PHP loads this ONE
 * file and runs the complete load path (Validate::run = compose →
 * forbidden-scan → validate).
 *
 * Each `engine: "pass"` case must return {valid:true, errors:[]}. Each
 * `engine: {code, at}` case must throw a ComposeLoadError whose code equals
 * `code` AND whose trace (dotted) equals `at`. The case `files` are the
 * composition files passed to the runtime.
 */
final class ForbiddenScanConformanceTest extends TestCase
{
    private const SHARED_FIXTURE = __DIR__ . '/../../../../../tests/fixtures/spec-validity/cases.json';

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function fixtureProvider(): array
    {
        $path = \realpath(self::SHARED_FIXTURE);
        self::assertNotFalse($path, 'shared spec-validity fixture not found: ' . self::SHARED_FIXTURE);
        $raw = \file_get_contents($path);
        self::assertNotFalse($raw);
        /** @var list<array<string, mixed>> $cases */
        $cases = \json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        $objects = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        $out = [];
        foreach ($cases as $index => $case) {
            foreach (['spec', 'data', 'files'] as $key) {
                if (property_exists($objects[$index], $key)) {
                    $case[$key] = $objects[$index]->{$key};
                }
            }
            $out[$case['name']] = [$case];
        }
        return $out;
    }

    /**
     * @param array<string, mixed> $case
     */
    #[DataProvider('fixtureProvider')]
    public function testForbiddenScanMatchesFixture(array $case): void
    {
        $passed = false;
        try {
            $this->assertCase($case);
            $passed = true;
        } finally {
            Evidence::record(
                'validate',
                'legacy/tests/fixtures/spec-validity/cases.json',
                'php',
                $case['name'],
                $passed
            );
        }
    }

    /** @param array<string, mixed> $case */
    private function assertCase(array $case): void
    {
        self::assertArrayHasKey('engine', $case, "case {$case['name']} must declare an engine expectation");

        /** @var array<string, mixed> $spec */
        $spec = $case['spec'];
        /** @var array<string, array<string, mixed>>|null $files */
        $files = $case['files'] ?? null;
        $engine = $case['engine'];

        // Data is irrelevant to the scan; pass an empty map. The scan runs in the
        // load path before any data-driven validation.
        if ($engine === 'pass') {
            $result = Validator::validate($spec, [], ['files' => $files ?? []]);
            self::assertTrue(
                $result->valid,
                "case {$case['name']} must not be rejected by runtime structure validation"
            );
            self::assertSame([], $result->errors, "case {$case['name']} must produce no errors on a clean load");
            return;
        }

        /** @var array{code: string, at: string} $want */
        $want = $engine;
        self::assertIsArray($want, "case {$case['name']} engine must be 'pass' | {code, at}");
        self::assertArrayHasKey('code', $want, "case {$case['name']} engine.code missing");
        self::assertArrayHasKey('at', $want, "case {$case['name']} engine.at missing");

        try {
            Validator::validate($spec, [], ['files' => $files ?? []]);
            self::fail(
                "case {$case['name']} expected load error {$want['code']} at {$want['at']} but validated successfully"
            );
        } catch (ComposeLoadError $e) {
            self::assertSame(
                $want['code'],
                $e->code,
                "error code mismatch for {$case['name']}: {$e->getMessage()}",
            );
            self::assertSame(
                $want['at'],
                \implode('.', $e->getCompositionTrace()),
                "error path mismatch for {$case['name']}: {$e->getMessage()}",
            );
        }
    }
}
