<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Values;

use Polyspec\Crudui\Validator\Values\UnicodeData;
use Polyspec\Crudui\Validator\Values\Whitespace;
use PHPUnit\Framework\TestCase;

/**
 * The embedded Unicode data equals contracts/unicode-properties.json, and the
 * generated source is what the generator writes today.
 */
final class UnicodeDataTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../../../..';

    /** @return array<string, mixed> */
    private static function contract(): array
    {
        return json_decode(
            (string) file_get_contents(self::ROOT . '/contracts/unicode-properties.json'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    }

    /**
     * @param list<array{int, int}> $ranges
     * @return list<int>
     */
    private static function flat(array $ranges): array
    {
        return array_merge(...array_map(static fn (array $range) => [$range[0], $range[1]], $ranges));
    }

    /** CUVR-018: the embedded data equals contracts/unicode-properties.json. */
    public function testEmbeddedDataEqualsTheContract(): void
    {
        $contract = self::contract();
        self::assertSame($contract['unicodeVersion'], UnicodeData::VERSION);
        self::assertSame(self::flat($contract['whiteSpace']), UnicodeData::WHITE_SPACE);
        self::assertSame(array_keys($contract['generalCategories']), array_keys(UnicodeData::GENERAL_CATEGORIES));
        foreach ($contract['generalCategories'] as $name => $ranges) {
            self::assertSame(self::flat($ranges), UnicodeData::GENERAL_CATEGORIES[$name], $name);
        }
        self::assertSame(array_keys($contract['scripts']), array_keys(UnicodeData::SCRIPTS));
        foreach ($contract['scripts'] as $name => $ranges) {
            self::assertSame(self::flat($ranges), UnicodeData::SCRIPTS[$name], $name);
        }
    }

    public function testWhitespaceIsTheWhiteSpaceTable(): void
    {
        self::assertSame(self::flat(self::contract()['whiteSpace']), Whitespace::set()->bounds());
    }

    public function testGeneratedSourceIsCurrent(): void
    {
        $source = dirname(__DIR__, 2) . '/src/Values/UnicodeData.php';
        $expected = file_get_contents($source);
        $script = dirname(__DIR__, 2) . '/scripts/generate-unicode-data.php';
        $output = [];
        $status = 0;
        exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' --stdout', $output, $status);
        self::assertSame(0, $status);
        self::assertSame($expected, implode("\n", $output) . "\n");
    }
}
