<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Extension\Tests;

use Polyspec\Crudui\Validator;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\CruduiTestSupport\FixtureJson;
use Polyspec\Crudui\Validator\Validate\FormInputError;
use ReflectionClass;
use RuntimeException;
use stdClass;

/**
 * The validation results of one runtime for every validation fixture, which ApiTest compares between the extension and
 * the PHP library.
 */
final class ValidateReport
{
    private static int $checks = 0;

    /**
     * The report of the runtime that this process loads: the extension when `$native`, the PHP library otherwise.
     *
     * @return array<string, mixed>
     */
    public static function report(bool $native): array
    {
        self::$checks = 0;
        if ((new ReflectionClass(Validator::class))->isInternal() !== $native) {
            throw new RuntimeException('Incorrect validator implementation');
        }
        $root = dirname(__DIR__, 4);
        $results = [];
        $differences = [];
        foreach (
            json_decode(
                file_get_contents($root . '/legacy/tests/fixtures/validate/cases.json'),
                false,
                512,
                JSON_THROW_ON_ERROR
            ) as $case
        ) {
            $options = [];
            foreach (['files','basepath'] as $option) {
                if (property_exists($case, $option)) {
                    $options[$option] = $case->{$option};
                }
            }
            $failure = null;
            try {
                $actual = Validator::validate($case->spec, $case->data, $options);
            } catch (ComposeLoadError $error) {
                $failure = [
                    'code' => $error->getErrorCode(),
                    'message' => $error->getMessage(),
                    'at' => implode('.', $error->getCompositionTrace())
                ];
            } catch (FormInputError $error) {
                $failure = ['code' => $error->getErrorCode(),'message' => $error->getMessage(),'at' => ''];
            }
            if ($failure !== null) {
                if (
                    !property_exists($case, 'expectFailure')
                    || json_encode($failure, JSON_THROW_ON_ERROR) !== json_encode(
                        $case->expectFailure,
                        JSON_THROW_ON_ERROR
                    )
                ) {
                    throw new RuntimeException($case->name . ': failure differs: ' . json_encode($failure));
                }
                $results[] = ['case' => $case->name,'failure' => $failure];
                continue;
            }
            if (!property_exists($case, 'expected')) {
                throw new RuntimeException($case->name . ': expected a validation failure');
            }
            // Every differing case is reported by name, not only the first one.
            if (json_encode($actual, JSON_THROW_ON_ERROR) !== json_encode($case->expected, JSON_THROW_ON_ERROR)) {
                $differences[] = $case->name . ': ' . json_encode($actual);
                continue;
            }
            $results[] = ['case' => $case->name,'result' => $actual];
        }
        if ($differences !== []) {
            throw new RuntimeException(
                count($differences) . " validation results differ:\n" . implode("\n", $differences)
            );
        }
        foreach (['spec-validity','list-validity','detail-validity'] as $family) {
            foreach (
                json_decode(
                    file_get_contents($root . '/legacy/tests/fixtures/' . $family . '/cases.json'),
                    false,
                    512,
                    JSON_THROW_ON_ERROR
                ) as $case
            ) {
                $options = [];
                foreach (['files','basepath'] as $option) {
                    if (property_exists($case, $option)) {
                        $options[$option] = $case->{$option};
                    }
                }
                $expectation = $case->engine;
                try {
                    $actual = match ($family) {
                        'spec-validity' => Validator::validate($case->spec, new stdClass(), $options),
                        'list-validity' => Validator::validateList($case->spec, $options),
                        'detail-validity' => Validator::validateDetail($case->spec, $options),
                    };
                    $clean = $family === 'spec-validity'
                        ? '{"valid":true,"errors":[],"hidden":[]}'
                        : '{"valid":true,"errors":[]}';
                    if (json_encode($actual, JSON_THROW_ON_ERROR) !== $clean) {
                        throw new RuntimeException($case->name . ': clean load result differs');
                    }
                    if ($expectation instanceof stdClass) {
                        throw new RuntimeException($case->name . ': expected a composition error');
                    }
                    $results[] = ['case' => $family . ':' . $case->name,'result' => $actual];
                } catch (ComposeLoadError $error) {
                    if (!$expectation instanceof stdClass) {
                        throw $error;
                    }
                    if (
                        $expectation->code !== $error->getErrorCode()
                        || $expectation->at !== implode('.', $error->getCompositionTrace())
                    ) {
                        throw new RuntimeException($case->name . ': error code or path differs');
                    }
                    $results[] = [
                        'case' => $family . ':' . $case->name,
                        'error' => $error->getErrorCode(),
                        'path' => implode('.', $error->getCompositionTrace())
                    ];
                }
            }
        }
        // Input text cases are JSON text with unpaired surrogate escapes (docs/spec/input-text.md). The
        // decoder has no dependencies, so the native run without an autoloader loads its file.
        foreach (['validate','validateList','validateDetail'] as $feature) {
            foreach (
                FixtureJson::decode(
                    file_get_contents($root . '/legacy/tests/fixtures/text-validity/' . $feature . '/cases.json')
                ) as $case
            ) {
                $options = (array) ($case->options ?? []);
                if (property_exists($case, 'files')) {
                    $options['files'] = $case->files;
                }
                // A PHP data argument is an array or an object: a root string is the list [string], located at data.0.
                $rootString = is_string($case->data ?? null);
                $expected = json_decode(
                    json_encode($case->expect, JSON_THROW_ON_ERROR),
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );
                if ($rootString) {
                    $expected['message'] .= '.0';
                }
                try {
                    $outcome = match ($feature) {
                        'validate' => Validator::validate(
                            $case->spec,
                            $rootString ? [$case->data] : ($case->data ?? new stdClass()),
                            $options
                        ),
                        'validateList' => Validator::validateList($case->spec, $options),
                        'validateDetail' => Validator::validateDetail($case->spec, $options),
                    };
                } catch (ComposeLoadError $error) {
                    $outcome = [
                        'code' => $error->getErrorCode(),
                        'message' => $error->getMessage(),
                        'at' => implode('.', $error->getCompositionTrace())
                    ];
                } catch (FormInputError $error) {
                    $outcome = ['code' => $error->getErrorCode(),'message' => $error->getMessage(),'at' => ''];
                }
                $outcome = json_decode(json_encode($outcome, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
                if ($outcome !== $expected) {
                    throw new RuntimeException(
                        $feature . '/' . $case->name . ': input text result differs: ' . json_encode($outcome)
                    );
                }
                $results[] = ['case' => 'text-validity/' . $feature . ':' . $case->name,'outcome' => $outcome];
            }
        }
        // Value limits (docs/spec/input-text.md): each case builds its value graph with shared arrays and
        // references, which JSON text cannot carry, and completes in bounded time.
        $graph = static function (stdClass $graph): mixed {
            if ($graph->shape === 'self-twice') {
                $loop = [];
                $loop['self'] = &$loop;
                $loop['again'] = &$loop;
                return $loop;
            }
            if ($graph->shape === 'flat') {
                return array_fill(0, $graph->size, $graph->leaf);
            }
            $value = $graph->leaf;
            for ($i = 0; $i < $graph->size; $i++) {
                $value = $graph->shape === 'doubled' ? [$value, $value] : [$value];
            }
            return $value;
        };
        $graphsPath = $root . '/legacy/tests/fixtures/text-validity/value-graphs.json';
        foreach (FixtureJson::decode(file_get_contents($graphsPath)) as $case) {
            $inputs = ['spec' => $case->spec,'files' => $case->files ?? null,'data' => $case->data];
            $target = $inputs[$case->graph->at[0]];
            $members = array_slice($case->graph->at, 1);
            foreach (array_slice($members, 0, -1) as $member) {
                $target = $target->{$member};
            }
            $target->{end($members)} = $graph($case->graph);
            try {
                $outcome = Validator::validate(
                    $inputs['spec'],
                    $inputs['data'],
                    $inputs['files'] === null ? [] : ['files' => $inputs['files']]
                );
            } catch (ComposeLoadError $error) {
                $outcome = [
                    'code' => $error->getErrorCode(),
                    'message' => $error->getMessage(),
                    'at' => implode('.', $error->getCompositionTrace())
                ];
            } catch (FormInputError $error) {
                $outcome = ['code' => $error->getErrorCode(),'message' => $error->getMessage(),'at' => ''];
            }
            $outcome = json_decode(json_encode($outcome, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
            if (
                $outcome !== json_decode(
                    json_encode($case->expect, JSON_THROW_ON_ERROR),
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                )
            ) {
                throw new RuntimeException(
                    'value-graphs/' . $case->name . ': result differs: ' . json_encode($outcome)
                );
            }
            $results[] = ['case' => 'value-graphs:' . $case->name,'outcome' => $outcome];
        }
        return ['native' => $native,'checks' => count($results),'results' => $results];
    }
}
