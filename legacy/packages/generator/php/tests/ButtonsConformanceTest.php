<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use Polyspec\Crudui\Conformance\Evidence;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;
use Throwable;

/**
 * The form button fixtures against the PHP generator: each case of legacy/tests/fixtures/buttons runs bindButtons (CURP-008)
 * or formButtonsHtml (CURP-009), and its observation equals the recorded one as JSON text, so the order of the
 * attributes counts. A failure is observed with its code and message.
 */
final class ButtonsConformanceTest extends TestCase
{
    private const FLAGS = JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /** @return iterable<string, array{stdClass}> */
    public static function cases(): iterable
    {
        $text = (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/buttons/cases.json');
        foreach (json_decode($text, false, 512, JSON_THROW_ON_ERROR) as $case) {
            yield (string) $case->name => [$case];
        }
    }

    #[DataProvider('cases')]
    public function testCaseWritesItsExpectation(stdClass $case): void
    {
        $passed = false;
        try {
            $observed = $case->operation === 'bindButtons'
                ? self::observe(static fn (): array => self::bind($case))
                : self::observe(static fn (): string => Generator::formButtonsHtml($case->buttons));
            self::assertSame(
                json_encode($case->expected, self::FLAGS),
                json_encode($observed, self::FLAGS)
            );
            $passed = true;
        } finally {
            Evidence::record(
                $case->operation,
                'legacy/tests/fixtures/buttons/cases.json',
                (new \ReflectionClass(Generator::class))->isInternal() ? 'php-native' : 'php',
                $case->name,
                $passed,
            );
        }
    }

    /** Compile the spec of a case, or pass its template as it is, then bind its buttons for its record. */
    private static function bind(stdClass $case): array
    {
        $template = property_exists($case, 'spec') ? Generator::compileForm($case->spec) : $case->template;
        $data = property_exists($case, 'data') ? $case->data : new stdClass();
        $options = property_exists($case, 'options') ? (array) $case->options : [];
        return Generator::bindButtons($template, $data, $options);
    }

    /** The observation of one case: the result, or the error by its code and message. */
    private static function observe(callable $run): array
    {
        try {
            return ['result' => json_decode(json_encode($run(), self::FLAGS), true, 512, JSON_THROW_ON_ERROR)];
        } catch (FormError $error) {
            return ['error' => ['code' => $error->getErrorCode(), 'message' => $error->getMessage()]];
        } catch (Throwable $error) {
            return ['error' => ['code' => 'ERROR', 'message' => $error->getMessage()]];
        }
    }
}
