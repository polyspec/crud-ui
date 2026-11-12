<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Polyspec\Crudui\Conformance\Evidence;

/**
 * CRUDUI list-spec validation conformance verifies SPEC §9.
 *
 * The runtime composes $ref and $patch on the columns map and on a search
 * overlay. It scans the complete composed list tree for forbidden keys. It does
 * not validate rows because the server supplies them separately (SPEC §9).
 *
 * The shared fixture legacy/tests/fixtures/list-validity/cases.json separates
 * meta-schema shape checks from runtime structure checks with its `engine` field:
 *  - engine: "pass"          — required, enum, additionalProperties and anyOf
 *    remain meta-schema checks. The runtime returns { valid:true,
 *    errors:[] }.
 *  - engine: { code, at }    — composition or forbidden-key scanning throws a
 *    ComposeLoadError. The test compares its code and complete dotted trace.
 *
 * Every runtime must produce the declared result.
 */
final class ListValidateConformanceTest extends TestCase
{
    private const SHARED_FIXTURE = __DIR__ . '/../../../../../tests/fixtures/list-validity/cases.json';

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function fixtureProvider(): array
    {
        $path = \realpath(self::SHARED_FIXTURE);
        self::assertNotFalse($path, 'shared list-validity fixture not found: ' . self::SHARED_FIXTURE);
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
    public function testListEngineMatchesFixture(array $case): void
    {
        $passed = false;
        try {
            $this->assertCase($case);
            $passed = true;
        } finally {
            Evidence::record(
                'validateList',
                'legacy/tests/fixtures/list-validity/cases.json',
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

        if ($engine === 'pass') {
            // The runtime does not reject a meta-schema-only shape error
            // (required/enum/additionalProperties/anyOf). No rows means no data
            // validation: a clean load is always { valid:true, errors:[] }.
            $result = Validator::validateList($spec, ['files' => $files ?? []]);
            self::assertTrue(
                $result->valid,
                "case {$case['name']} must not be rejected by runtime structure validation"
            );
            self::assertSame([], $result->errors, "case {$case['name']} must produce no errors on a clean load");
            return;
        }

        // engine: { code, at } requires a ComposeLoadError.
        /** @var array{code: string, at: string} $want */
        $want = $engine;
        self::assertIsArray($want, "case {$case['name']} engine must be 'pass' | {code, at}");
        self::assertArrayHasKey('code', $want, "case {$case['name']} engine.code missing");
        self::assertArrayHasKey('at', $want, "case {$case['name']} engine.at missing");

        try {
            Validator::validateList($spec, ['files' => $files ?? []]);
            self::fail(
                "case {$case['name']} expected load error {$want['code']} at {$want['at']} but loaded successfully"
            );
        } catch (ComposeLoadError $e) {
            self::assertSame($want['code'], $e->code, "error code mismatch for {$case['name']}: {$e->getMessage()}");
            self::assertSame(
                $want['at'],
                \implode('.', $e->getCompositionTrace()),
                "error path mismatch for {$case['name']}: {$e->getMessage()}",
            );
        }
    }
}
