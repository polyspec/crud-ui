<?php

declare(strict_types=1);

namespace Polyspec\Crudui;

use Polyspec\Crudui\Validator\Compose\Compose;
use Polyspec\Crudui\Validator\Compose\MemoryLoader;
use Polyspec\Crudui\Validator\Compose\Patch;
use Polyspec\Crudui\Validator\Compose\Ref;
use Polyspec\Crudui\Validator\ForbiddenScan;
use Polyspec\Crudui\Validator\Support\JsonValue;
use Polyspec\Crudui\Validator\Support\Text;
use Polyspec\Crudui\Validator\Validate\DataLimits;
use Polyspec\Crudui\Validator\Validate\FormInputError;
use Polyspec\Crudui\Validator\Validate\Validator as DataValidator;
use stdClass;

/** Compose specifications and validate submitted data or list declarations. */
final class Validator
{
    /**
     * Return the validation result object { valid, errors, hidden }, where hidden lists the data
     * paths of the fields that design.show hides. Invalid input text raises ComposeLoadError in the
     * specification and files and FormInputError elsewhere, before any other check. Root data
     * that is a non-empty list raises
     * FormInputError before composition; composition failures raise
     * ComposeLoadError; group or repeated data with the wrong shape raises
     * FormInputError.
     */
    public static function validate(array|stdClass $spec, array|stdClass $data, array $options = []): stdClass
    {
        // Input text is checked first: the specification and files, the data, then the options.
        self::checkText($spec, $options, [['data', $data]]);
        if (is_array($data) && $data !== [] && array_is_list($data)) {
            throw new FormInputError('Form data must be an object');
        }
        $spec = (array) JsonValue::orderedObject($spec);
        $data = JsonValue::object($data);
        $loader = self::loader($options);
        $basepath = $options['basepath'] ?? '';
        $hasProperties = ($spec['properties'] ?? null) instanceof stdClass;
        $composition = array_key_exists('$ref', $spec) || array_key_exists('$patch', $spec);
        if ($composition && !$hasProperties) {
            $properties = Compose::properties($spec, $loader, $basepath);
        } else {
            $composed = Compose::spec($spec, $loader, $basepath);
            $properties = JsonValue::members($composed['properties'] ?? null);
        }
        ForbiddenScan::scan($properties, ['properties']);
        // The form root declarations are scanned like the fields they sit beside.
        foreach (['buttons', 'action'] as $key) {
            if (array_key_exists($key, $spec)) {
                ForbiddenScan::scan($spec[$key], [$key]);
            }
        }
        // The data limits are checked after the forbidden-key scan and before the rule parameters.
        $limits = DataLimits::read($spec);
        $validator = new DataValidator(['type' => 'group', 'properties' => $properties]);
        // The data is measured before any rule.
        DataLimits::check($data, $limits);
        $result = $validator->validate((array) $data);
        return (object) [
            'valid' => $result->valid,
            'errors' => array_map(static fn ($error) => JsonValue::copy((object) $error), $result->errors),
            'hidden' => $result->hidden
        ];
    }

    /**
     * Validate list composition and metadata without validating row data: the root, the `columns` map and the
     * `search` form-spec reference of a list compose, and a forbidden member fails.
     */
    public static function validateList(array|stdClass $spec, array $options = []): stdClass
    {
        return self::validateComposition($spec, $options, ['columns' => false, 'search' => true]);
    }

    /**
     * Validate detail composition and metadata without validating record data: the root and the `fields` map of a
     * detail compose, and a forbidden member fails.
     */
    public static function validateDetail(array|stdClass $spec, array $options = []): stdClass
    {
        return self::validateComposition($spec, $options, ['fields' => false]);
    }

    /**
     * Compose the root of a specification and the object maps that `$maps` names, then scan the result for
     * forbidden members. A composition failure throws.
     *
     * @param array<string, bool> $maps the object maps to compose; true composes a map only when it declares `$ref`
     *                                  or `$patch`
     */
    private static function validateComposition(array|stdClass $spec, array $options, array $maps): stdClass
    {
        self::checkText($spec, $options, []);
        $loader = self::loader($options);
        $basepath = $options['basepath'] ?? '';
        $composed = self::composeRoot($spec, $loader, $basepath);
        foreach ($maps as $key => $onlyComposed) {
            if (!$onlyComposed || self::declaresComposition($composed[$key] ?? null)) {
                self::composeMap($composed, $key, $loader, $basepath);
            }
        }
        ForbiddenScan::scan($composed);
        return (object) ['valid' => true, 'errors' => []];
    }

    /** Whether a member is an object that declares `$ref` or `$patch`. */
    private static function declaresComposition(mixed $member): bool
    {
        return JsonValue::isObject($member)
            && (array_key_exists('$ref', (array) $member) || array_key_exists('$patch', (array) $member));
    }

    /**
     * Compose a list or detail root: `$ref` replaces the members before it,
     * later own members override the base and `$patch` applies last.
     *
     * @return array<string, mixed>
     */
    private static function composeRoot(array|stdClass $spec, MemoryLoader $loader, string $basepath): array
    {
        $base = [];
        $own = [];
        $hasPatch = false;
        $patch = null;
        foreach ((array) JsonValue::orderedObject($spec) as $key => $value) {
            if ($key === '$ref') {
                $base = JsonValue::orderedMembers(array_replace($own, Ref::resolve($value, $basepath, $loader)));
                $own = [];
            } elseif ($key === '$patch') {
                $patch = $value;
                $hasPatch = true;
            } else {
                $own[$key] = $value;
            }
        }
        $composed = JsonValue::orderedMembers(array_replace($base, $own));
        return $hasPatch ? Patch::apply($composed, $patch) : $composed;
    }

    /** Expand an object map member with properties composition. */
    private static function composeMap(array &$composed, string $key, MemoryLoader $loader, string $basepath): void
    {
        if (JsonValue::isObject($composed[$key] ?? null)) {
            $composed[$key] = Compose::properties((array) $composed[$key], $loader, $basepath);
        }
    }

    /**
     * Check the text and the limits of a specification, its files, the named inputs and the base
     * path option (docs/spec/input-text.md).
     *
     * @param list<array{0: string, 1: mixed}> $inputs
     */
    private static function checkText(array|stdClass $spec, array $options, array $inputs): void
    {
        $failure = Text::specificationFailure($spec, $options['files'] ?? null)
            ?? Text::inputFailure([...$inputs, ...Text::options($options, ['basepath'])]);
        if ($failure !== null) {
            throw new FormInputError($failure);
        }
    }

    private static function loader(array $options): MemoryLoader
    {
        $files = JsonValue::object($options['files'] ?? []);
        $maps = [];
        foreach ($files as $key => $file) {
            if (!$file instanceof stdClass) {
                throw new \TypeError('Composition files must contain objects');
            }
            $maps[$key] = (array) JsonValue::ordered($file);
        }
        return new MemoryLoader($maps);
    }
}
