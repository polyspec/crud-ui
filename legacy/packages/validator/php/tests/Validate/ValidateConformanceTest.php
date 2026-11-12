<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Validate\FormInputError;
use Polyspec\Crudui\Validator;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Polyspec\Crudui\Conformance\Evidence;

/**
 * CRUDUI validator conformance verifies SPEC §2 G5, §3 and §2 G1. The shared
 * fixture legacy/tests/fixtures/validate/cases.json defines each expected result or
 * failure record. Result cases match `expected` (same valid +
 * errors[] including path/field/rule/message/value); failure cases throw a
 * ComposeLoadError or FormInputError with the exact `expectFailure` code,
 * message and location.
 */
final class ValidateConformanceTest extends TestCase
{
    private const SHARED_FIXTURE = __DIR__ . '/../../../../../tests/fixtures/validate/cases.json';

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function fixtureProvider(): array
    {
        $path = \realpath(self::SHARED_FIXTURE);
        self::assertNotFalse($path, 'shared validate fixture not found: ' . self::SHARED_FIXTURE);
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
    public function testValidateMatchesFixture(array $case): void
    {
        $passed = false;
        try {
            $this->assertCase($case);
            $passed = true;
        } finally {
            Evidence::record('validate', 'legacy/tests/fixtures/validate/cases.json', 'php', $case['name'], $passed);
        }
    }

    /** @param array<string, mixed> $case */
    private function assertCase(array $case): void
    {
        self::assertTrue(
            \array_key_exists('expected', $case) !== \array_key_exists('expectFailure', $case),
            "case {$case['name']} must declare exactly one of expected or expectFailure",
        );

        /** @var array<string, mixed> $spec */
        $spec = $case['spec'];
        $data = $case['data'];
        /** @var array<string, array<string, mixed>>|null $files */
        $files = $case['files'] ?? null;

        if (\array_key_exists('expectFailure', $case)) {
            /** @var array{code: string, message: string, at: string} $expect */
            $expect = $case['expectFailure'];
            try {
                Validator::validate($spec, $data, ['files' => $files ?? []]);
                self::fail("case {$case['name']} expected failure {$expect['code']} but validated successfully");
            } catch (ComposeLoadError $e) {
                $actual = [
                    'code' => $e->getErrorCode(),
                    'message' => $e->getMessage(),
                    'at' => implode('.', $e->getCompositionTrace())
                ];
                self::assertSame($expect, $actual, "failure mismatch for {$case['name']}");
            } catch (FormInputError $e) {
                $actual = ['code' => $e->getErrorCode(), 'message' => $e->getMessage(), 'at' => ''];
                self::assertSame($expect, $actual, "failure mismatch for {$case['name']}");
            }
            return;
        }

        $result = Validator::validate($spec, $data, ['files' => $files ?? []]);

        /** @var array{valid: bool, errors: list<array<string, mixed>>} $expected */
        $expected = $case['expected'];

        self::assertSame(
            self::normalize($expected),
            self::normalize(json_decode(json_encode($result, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR)),
            "validation result mismatch for {$case['name']}",
        );
    }

    /**
     * Recursively normalize for comparison: canonicalize numbers so int/float
     * spellings match (JSON loses the distinction; e.g. min 10 vs 10.0, qty 5).
     * Associative arrays (error records) keep their keys; lists keep order (the
     * error order IS part of the contract).
     */
    private static function normalize(mixed $v): mixed
    {
        if (\is_array($v)) {
            return \array_map([self::class, 'normalize'], $v);
        }
        if (\is_int($v) || \is_float($v)) {
            return (float) $v;
        }
        return $v;
    }
}
