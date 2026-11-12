<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Extension\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Conformance\Evidence;
use Polyspec\CruduiTestSupport\PhpProcess;
use Polyspec\CruduiTestSupport\FixtureJson;
use RuntimeException;
use stdClass;

/**
 * The PHP API of the extension against the PHP library: the same public signatures, checks and form models, with and
 * without the Composer library loaded beside the extension, the value limits of its conversion and the same results
 * for every validation fixture. Each runtime runs in its own child process; PHP_EXTENSION names the module.
 */
final class ApiTest extends TestCase
{
    /** @return iterable<string, array{bool}> */
    public static function composerStates(): iterable
    {
        yield 'without the Composer library' => [false];
        yield 'with the Composer library' => [true];
    }

    #[DataProvider('composerStates')]
    public function testTheApiOfTheExtensionEqualsTheApiOfTheLibrary(bool $composer): void
    {
        $pure = self::report(ApiReport::class, false, true);
        $native = self::report(ApiReport::class, true, $composer);
        self::assertEquals($pure['signatures'], $native['signatures'], 'PHP signatures differ');
        self::assertSame($pure['checks'], $native['checks']);
        // Each model is JSON text, so a member order difference is a difference.
        self::assertNotSame([], $pure['models'], 'No form fixture was compared');
        self::assertSame(array_keys($pure['models']), array_keys($native['models']), 'Compared form fixtures differ');
        $differing = array_keys(array_filter(
            $pure['models'],
            static fn(string $model, string $name): bool => $native['models'][$name] !== $model,
            ARRAY_FILTER_USE_BOTH,
        ));
        self::assertSame([], $differing, 'Native and PHP form models differ, including member order');
    }

    // Button members that the markup does not read are converted too; a shared list forty levels deep denotes more
    // than 2^40 nodes and fails at the node limit, within the process limit.
    public function testTheExtensionStopsConvertingAValueAtTheValueLimits(): void
    {
        $script = implode("\n", [
            '$shared = "x";',
            'for ($i = 0; $i < 40; $i++) $shared = [$shared, $shared];',
            '$button = (object) ["tag" => "a", "text" => "", "attrs" => new stdClass(), "extra" => $shared];',
            'try { Polyspec\\Crudui\\Generator::formButtonsHtml([$button]); echo "converted"; }',
            'catch (Polyspec\\Crudui\\FormError $error) { echo $error->getErrorCode(), " ", $error->getMessage(); }',
        ]);
        $result = PhpProcess::run([self::extension()], $script, [], false);
        self::assertSame('', $result->stderr);
        self::assertSame('INVALID_FORM_INPUT Recursive or excessively nested PHP value', $result->stdout);
    }

    public function testNativeErrorConstructorsPreservePreviousThrowable(): void
    {
        $script = <<<'PHP'
        $results = [];
        foreach ([
            Polyspec\Crudui\FormError::class,
            Polyspec\Crudui\Validator\Compose\ComposeLoadError::class,
        ] as $class) {
            $detail = $class === Polyspec\Crudui\FormError::class ? 'rows[0]' : ['spec.fields.name'];
            $cause = new Error('original failure');
            $weak = WeakReference::create($cause);
            $error = new $class('CODE', 'wrapped failure', $detail, previous: $cause);
            $results[$class] = [
                'same' => $error->getPrevious() === $cause,
                'code' => $error->getErrorCode(),
                'message' => $error->getMessage(),
                'detail' => $class === Polyspec\Crudui\FormError::class
                    ? $error->getPath()
                    : $error->getCompositionTrace(),
                'default' => (new $class('CODE', 'default'))->getPrevious() === null,
                'null' => (new $class('CODE', 'null', previous: null))->getPrevious() === null,
            ];
            unset($cause);
            gc_collect_cycles();
            $results[$class]['retained'] = $weak->get() !== null;
            unset($error);
            gc_collect_cycles();
            $results[$class]['released'] = $weak->get() === null;
            try {
                new $class('CODE', 'invalid', previous: new stdClass());
                $results[$class]['rejectsInvalid'] = false;
            } catch (TypeError) {
                $results[$class]['rejectsInvalid'] = true;
            }
        }
        echo json_encode($results, JSON_THROW_ON_ERROR);
        PHP;
        $result = PhpProcess::run([self::extension()], $script, [], false);
        self::assertSame(0, $result->status, $result->stderr . $result->stdout);
        self::assertSame('', $result->stderr);
        $expected = [];
        $classes = [
            \Polyspec\Crudui\FormError::class,
            \Polyspec\Crudui\Validator\Compose\ComposeLoadError::class,
        ];
        foreach ($classes as $class) {
            $expected[$class] = [
                'same' => true,
                'code' => 'CODE',
                'message' => 'wrapped failure',
                'detail' => $class === \Polyspec\Crudui\FormError::class ? 'rows[0]' : ['spec.fields.name'],
                'default' => true,
                'null' => true,
                'retained' => true,
                'released' => true,
                'rejectsInvalid' => true,
            ];
        }
        self::assertSame($expected, json_decode($result->stdout, true, 512, JSON_THROW_ON_ERROR));
    }

    public function testNativeErrorConstructorSignaturesMatchSource(): void
    {
        $script = <<<'PHP'
        $results = [];
        foreach ([
            Polyspec\Crudui\FormError::class,
            Polyspec\Crudui\Validator\Compose\ComposeLoadError::class,
        ] as $class) {
            $results[$class] = array_map(
                static fn(ReflectionParameter $parameter): array => [
                    $parameter->getName(), (string) $parameter->getType(), $parameter->isOptional(),
                    $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
                ],
                (new ReflectionMethod($class, '__construct'))->getParameters(),
            );
        }
        echo json_encode($results, JSON_THROW_ON_ERROR);
        PHP;
        $native = PhpProcess::run([self::extension()], $script, [], false);
        $source = PhpProcess::run([], $script);
        self::assertSame(0, $native->status, $native->stderr);
        self::assertSame(0, $source->status, $source->stderr);
        self::assertSame(
            json_decode($source->stdout, true, 512, JSON_THROW_ON_ERROR),
            json_decode($native->stdout, true, 512, JSON_THROW_ON_ERROR),
        );
    }

    public function testTheExtensionValidatesEveryValidationFixtureAsTheLibraryDoes(): void
    {
        $pure = self::report(ValidateReport::class, false, true);
        $native = self::report(ValidateReport::class, true, false);
        // The report fails on a differing input text result, so each reported case passed; it proves the input text
        // checks of the extension, which run on PHP values before the engine.
        $text = array_values(array_filter(
            $native['results'],
            static fn(array $result): bool => str_starts_with($result['case'], 'text-validity/'),
        ));
        self::assertCount(32, $text, 'The input text fixture inventory changed; review coverage before changing this');
        foreach ($text as $result) {
            preg_match('/^text-validity\/(\w+):(.+)$/D', $result['case'], $match);
            $same = array_values(array_filter(
                $pure['results'],
                static fn(array $other): bool => $other['case'] === $result['case'],
            )) === [$result];
            Evidence::record(
                $match[1],
                "legacy/tests/fixtures/text-validity/{$match[1]}/cases.json",
                'php-native',
                $match[2],
                $same
            );
        }
        // The cases hold unpaired surrogate escapes, which FixtureJson preserves and json_decode refuses.
        $graphs = FixtureJson::decode(
            (string) file_get_contents(dirname(__DIR__, 4) . '/legacy/tests/fixtures/text-validity/value-graphs.json')
        );
        self::assertSame(
            array_map(static fn(stdClass $case): string => 'value-graphs:' . $case->name, $graphs),
            array_values(array_map(
                static fn(array $result): string => $result['case'],
                array_filter(
                    $native['results'],
                    static fn(array $result): bool => str_starts_with($result['case'], 'value-graphs:'),
                ),
            )),
            'Every value graph case runs in the extension'
        );
        self::assertEquals($pure['results'], $native['results'], 'Native and PHP validation results differ');
        self::assertGreaterThan(0, $pure['checks']);
    }

    /**
     * The report of `$class` in a child process of the extension (`$native`) or of the PHP library; with
     * `$composer` the process loads the checkout autoloader; otherwise it loads the report and its fixture decoder
     * dependencies.
     *
     * @return array<string, mixed>
     */
    private static function report(string $class, bool $native, bool $composer): array
    {
        $file = __DIR__ . '/' . substr($class, strrpos($class, '\\') + 1) . '.php';
        $files = $composer ? [] : [$file];
        if (!$composer && $class === ValidateReport::class) {
            $orderedSource = (new \ReflectionClass(\Polyspec\OrderedJson\Value::class))->getFileName();
            if ($orderedSource === false) {
                throw new RuntimeException('The fixture decoder requires the installed OrderedJSON PHP source');
            }
            $directory = dirname($orderedSource);
            $files = [
                $directory . '/OrderedJson.php',
                $directory . '/ParseError.php',
                $orderedSource,
                dirname(__DIR__, 4) . '/tests/php/FixtureJson.php',
                $file,
            ];
        }
        $script = implode('', array_map(
            static fn(string $required): string => 'require ' . var_export($required, true) . ';',
            $files,
        ))
            . 'echo json_encode(\\' . $class . '::report(' . var_export($native, true) . '),'
            . ' JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);';
        $result = PhpProcess::run($native ? [self::extension()] : [], $script, [], $composer);
        self::assertSame(0, $result->status, $result->stderr . $result->stdout);
        self::assertSame('', $result->stderr, 'Unexpected PHP diagnostics');
        $report = json_decode($result->stdout, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame($native, $report['native']);
        return $report;
    }

    /** The extension module that PHP_EXTENSION names, relative to the checkout or absolute. */
    private static function extension(): string
    {
        $name = getenv('PHP_EXTENSION') ?: 'var/php-ext/polyspec_crudui.so';
        $module = str_starts_with($name, '/') ? $name : dirname(__DIR__, 4) . '/' . $name;
        if (!is_file($module)) {
            throw new RuntimeException("Build the extension first: $module");
        }
        return $module;
    }
}
