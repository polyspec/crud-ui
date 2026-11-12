<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Polyspec\Crudui\Conformance\Evidence;

/**
 * CRUDUI detail-spec validation conformance.
 *
 * The runtime composes $ref and $patch on the detail root exactly as on a list
 * root, then on the `fields` map with properties composition. It scans the
 * complete composed detail tree for forbidden keys. A detail has no search and
 * the runtime validates no record data.
 *
 * The shared fixture legacy/tests/fixtures/detail-validity/cases.json separates
 * meta-schema shape checks from runtime structure checks with its `engine` field:
 *  - engine: "pass"          — the runtime returns { valid:true, errors:[] }.
 *  - engine: { code, at }    — composition or forbidden-key scanning throws a
 *    ComposeLoadError. The test compares its code and complete dotted trace.
 *
 * Every runtime must produce the declared result.
 */
final class DetailValidateConformanceTest extends TestCase
{
    private const SHARED_FIXTURE = __DIR__ . '/../../../../../tests/fixtures/detail-validity/cases.json';

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function fixtureProvider(): array
    {
        $path = \realpath(self::SHARED_FIXTURE);
        self::assertNotFalse($path, 'shared detail-validity fixture not found: ' . self::SHARED_FIXTURE);
        $raw = \file_get_contents($path);
        self::assertNotFalse($raw);
        /** @var list<array<string, mixed>> $cases */
        $cases = \json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        $objects = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        $out = [];
        foreach ($cases as $index => $case) {
            foreach (['spec', 'files'] as $key) {
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
    public function testDetailEngineMatchesFixture(array $case): void
    {
        $passed = false;
        try {
            $this->assertCase($case);
            $passed = true;
        } finally {
            Evidence::record(
                'validateDetail',
                'legacy/tests/fixtures/detail-validity/cases.json',
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

        $spec = $case['spec'];
        $files = $case['files'] ?? [];
        $engine = $case['engine'];

        if ($engine === 'pass') {
            $result = Validator::validateDetail($spec, ['files' => $files]);
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
            Validator::validateDetail($spec, ['files' => $files]);
            self::fail(
                "case {$case['name']} expected load error {$want['code']} at {$want['at']} but loaded successfully"
            );
        } catch (ComposeLoadError $e) {
            self::assertSame(
                $want['code'],
                $e->getErrorCode(),
                "error code mismatch for {$case['name']}: {$e->getMessage()}"
            );
            self::assertSame(
                $want['at'],
                \implode('.', $e->getCompositionTrace()),
                "error path mismatch for {$case['name']}: {$e->getMessage()}",
            );
        }
    }

    public function testDetailAcceptsArraySpecsAndEmptyOptions(): void
    {
        $spec = ['fields' => ['name' => ['field' => '.name']]];
        self::assertEquals((object) ['valid' => true, 'errors' => []], Validator::validateDetail($spec));
        self::assertEquals((object) ['valid' => true, 'errors' => []], Validator::validateDetail([], ['files' => []]));
        self::assertSame(
            ['spec', 'options'],
            array_map(
                static fn ($parameter) => $parameter->getName(),
                (new \ReflectionMethod(Validator::class, 'validateDetail'))->getParameters()
            ),
        );
    }
}
