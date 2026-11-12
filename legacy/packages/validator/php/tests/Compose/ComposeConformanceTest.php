<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Compose;

use Polyspec\Crudui\Validator\Compose\Compose;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Compose\MemoryLoader;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Polyspec\Crudui\Conformance\Evidence;

/**
 * Compare composed values and load error codes with the shared fixtures.
 * This test normalizes object member order and numeric representations.
 * Public generator conformance separately checks complete templates and order.
 */
final class ComposeConformanceTest extends TestCase
{
    private const SHARED_FIXTURE = __DIR__ . '/../../../../../tests/fixtures/compose/cases.json';

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function fixtureProvider(): array
    {
        $path = \realpath(self::SHARED_FIXTURE);
        self::assertNotFalse($path, 'shared compose fixture not found: ' . self::SHARED_FIXTURE);
        $raw = \file_get_contents($path);
        self::assertNotFalse($raw);
        /** @var list<array<string, mixed>> $specs */
        $specs = \json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        $objects = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        $out = [];
        foreach ($specs as $index => $spec) {
            $input = $objects[$index]->input;
            $spec['input']['entry'] = (array) $input->entry;
            $spec['input']['files'] = array_map(
                static fn($file) => (array) $file,
                (array) ($input->files ?? new \stdClass())
            );
            $out[$spec['name']] = [$spec];
        }
        return $out;
    }

    /**
     * @param array<string, mixed> $spec
     */
    #[DataProvider('fixtureProvider')]
    public function testComposeMatchesFixture(array $spec): void
    {
        $passed = false;
        try {
            $this->assertCase($spec);
            $passed = true;
        } finally {
            Evidence::record(
                'compileForm',
                'legacy/tests/fixtures/compose/cases.json',
                'php',
                $spec['name'],
                $passed
            );
        }
    }

    /** @param array<string, mixed> $spec */
    private function assertCase(array $spec): void
    {
        /** @var array<string, mixed> $input */
        $input = $spec['input'];
        /** @var array<string, array<string, mixed>> $files */
        $files = $input['files'] ?? [];
        $loader = new MemoryLoader($files);
        $kind = $input['kind'] ?? 'properties';
        $basepath = $input['basepath'] ?? '';
        /** @var array<string, mixed> $entry */
        $entry = $input['entry'];

        if (\array_key_exists('expectError', $spec)) {
            /** @var array{code: string} $expectError */
            $expectError = $spec['expectError'];
            try {
                $kind === 'spec'
                    ? Compose::spec($entry, $loader, $basepath)
                    : Compose::properties($entry, $loader, $basepath);
                self::fail("case {$spec['name']} expected load error {$expectError['code']} but composed successfully");
            } catch (ComposeLoadError $e) {
                self::assertSame(
                    $expectError['code'],
                    $e->code,
                    "error code mismatch for {$spec['name']}: {$e->getMessage()}",
                );
            }
            return;
        }

        $result = $kind === 'spec'
            ? Compose::spec($entry, $loader, $basepath)
            : Compose::properties($entry, $loader, $basepath);

        self::assertSame(
            self::normalize($spec['expected']),
            self::normalize($result),
            "composed spec mismatch for {$spec['name']}",
        );
    }

    /** Compare composed values without requiring identical member or numeric representations. */
    private static function normalize(mixed $v): mixed
    {
        if ($v instanceof \stdClass) {
            $v = (array) $v;
        }
        if (\is_array($v)) {
            if (\array_is_list($v)) {
                return \array_map([self::class, 'normalize'], $v);
            }
            $copy = $v;
            \ksort($copy);
            return \array_map([self::class, 'normalize'], $copy);
        }
        if (\is_int($v) || \is_float($v)) {
            return (float) $v;
        }
        return $v;
    }
}
