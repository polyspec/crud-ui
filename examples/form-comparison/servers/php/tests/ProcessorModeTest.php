<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use Polyspec\CruduiTestSupport\PhpProcess;
use Polyspec\Crudui\FormComparison\FormGeneration;
use Polyspec\Crudui\FormComparison\ServerMode;
use Polyspec\Crudui\Validator\Support\JsonText;
use RuntimeException;

/**
 * The processor modes of the PHP server, each in a child process with the extension modules that
 * FORM_ORDERED_JSON_MODULE and FORM_CRUDUI_MODULE name: a mode refuses the extensions of the other mode, the PHP
 * extension mode requires the hash of its module, and it refuses a CRUDUI class that PHP loaded from source
 * (docs/operations/form-comparison.md, "Implementations and requests").
 */
#[Group('modules')]
final class ProcessorModeTest extends TestCase
{
    /** @return iterable<string, array{string, list<string>, string}> */
    public static function mismatchedExtensions(): iterable
    {
        yield 'php-ext without extensions' => ['php-ext', [], 'OrderedJSON extension state does not match'];
        yield 'php-ext without crudui' => ['php-ext', ['ordered-json'], 'CRUDUI extension state does not match'];
        yield 'php-ext without OrderedJSON' => [
            'php-ext',
            ['polyspec_crudui'],
            'OrderedJSON extension state does not match',
        ];
        yield 'php with OrderedJSON' => ['php', ['ordered-json'], 'OrderedJSON extension state does not match'];
        yield 'php with crudui' => ['php', ['polyspec_crudui'], 'CRUDUI extension state does not match'];
    }

    /** @param list<string> $extensions */
    #[DataProvider('mismatchedExtensions')]
    public function testAModeRefusesTheExtensionsOfTheOtherMode(string $mode, array $extensions, string $message): void
    {
        $result = PhpProcess::run(
            array_map(self::module(...), $extensions),
            '\\' . ServerMode::class . '::current();',
            ['FORM_PHP_SERVER' => $mode],
        );
        self::assertNotSame(0, $result->status);
        self::assertStringContainsString($message, $result->stderr . $result->stdout);
    }

    public function testThePhpExtensionModeUsesTheSelectedOrderedJsonExtension(): void
    {
        $result = self::extensionProcess(
            'echo json_encode([' . '\\' . ServerMode::class . '::current(), '
            . '(new \\ReflectionClass(\\Polyspec\\OrderedJson\\Value::class))->getExtensionName()]);'
        );
        self::assertSame(0, $result->status, $result->stderr . $result->stdout);
        self::assertSame(['php-ext', getenv('FORM_JSON_EXTENSION')], (array) $result->json());
    }

    /** @return iterable<string, array{string, string}> */
    public static function unmatchedExtensionNames(): iterable
    {
        yield 'missing declaration' => ['', 'FORM_JSON_EXTENSION must name'];
        yield 'another loaded extension' => ['json', 'OrderedJSON extension state does not match'];
        yield 'unloaded declaration' => ['missing_ordered_json', 'OrderedJSON extension state does not match'];
    }

    #[DataProvider('unmatchedExtensionNames')]
    public function testThePhpExtensionModeRequiresItsSelectedExtensionName(string $name, string $message): void
    {
        $result = self::extensionProcess(
            '\\' . ServerMode::class . '::current();',
            ['FORM_JSON_EXTENSION' => $name],
        );
        self::assertNotSame(0, $result->status);
        self::assertStringContainsString($message, $result->stderr . $result->stdout);
    }

    public function testThePhpExtensionModeRequiresTheHashOfItsModule(): void
    {
        $result = self::extensionProcess('new ' . self::generation() . '("php-ext", ' . self::arguments() . ', null);');
        self::assertNotSame(0, $result->status);
        self::assertStringContainsString(
            'A verified CRUDUI module hash is required',
            $result->stderr . $result->stdout
        );
    }

    public function testThePhpExtensionModeRunsOnlyClassesOfTheExtension(): void
    {
        $hash = var_export(hash_file('sha256', self::module('polyspec_crudui')), true);
        $result = self::extensionProcess(
            'new ' . self::generation() . '("php-ext", ' . self::arguments() . ', ' . $hash . ');'
            . self::generation() . '::assertNativeClasses(); echo "native";',
        );
        self::assertSame(0, $result->status, $result->stderr . $result->stdout);
        self::assertSame('native', $result->stdout);
    }

    public function testThePhpExtensionModeConvertsScoreWithoutLoadingPhpClasses(): void
    {
        $recordStore = '\\Polyspec\\Crudui\\FormComparison\\RecordStore';
        $result = PhpProcess::run(
            [self::module('polyspec_crudui')],
            '$score = ' . $recordStore . '::number("9021.25");'
            . self::generation() . '::assertNativeClasses(); echo json_encode($score);',
        );
        self::assertSame(0, $result->status, $result->stderr . $result->stdout);
        self::assertSame(9021.25, $result->json());
    }

    public function testThePhpExtensionModeRefusesAClassThatPhpLoadedFromSource(): void
    {
        $source = dirname(__DIR__, 5) . '/legacy/packages/validator/php/src/Support/JsonText.php';
        $result = self::extensionProcess(
            'require ' . var_export($source, true) . ';' . self::generation() . '::assertNativeClasses();',
        );
        self::assertNotSame(0, $result->status);
        self::assertStringContainsString(
            'A CRUDUI class loaded from PHP source in the PHP extension process: ' . JsonText::class,
            $result->stderr . $result->stdout
        );
    }

    /**
     * A child process of the PHP extension mode with both modules.
     *
     * @param array<string, string> $environment
     */
    private static function extensionProcess(string $script, array $environment = []): PhpProcess
    {
        return PhpProcess::run(
            [self::module('ordered-json'), self::module('polyspec_crudui')],
            $script,
            ['FORM_PHP_SERVER' => 'php-ext', ...$environment],
        );
    }

    private static function generation(): string
    {
        return '\\' . FormGeneration::class;
    }

    /** The source root and the source identity of a construction, as PHP code. */
    private static function arguments(): string
    {
        return var_export(dirname(__DIR__, 5), true)
            . ', (object) ["commit" => str_repeat("a", 40), "changes" => null]';
    }

    /** The absolute module of one extension, which FORM_ORDERED_JSON_MODULE or FORM_CRUDUI_MODULE names. */
    private static function module(string $extension): string
    {
        $variable = $extension === 'polyspec_crudui' ? 'FORM_CRUDUI_MODULE' : 'FORM_ORDERED_JSON_MODULE';
        $module = getenv($variable);
        if (!is_string($module) || !str_starts_with($module, '/') || !is_file($module)) {
            throw new RuntimeException("$variable must name the absolute $extension module of the run");
        }
        return $module;
    }
}
