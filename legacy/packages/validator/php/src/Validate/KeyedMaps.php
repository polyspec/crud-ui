<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Expr\Evaluator;

/**
 * Keyed maps (docs/spec/schema.md and docs/spec/validation-rules.md, "Keyed maps"): a field that
 * declares `multiple.keys` holds rows only under the row keys of the repeated group that the
 * reference names.
 *
 * @internal
 */
final class KeyedMaps
{
    /**
     * Whether the field declares `multiple.keys`, and its value.
     *
     * @param array<string, mixed> $field
     * @return array{bool, mixed}
     */
    private static function reference(array $field): array
    {
        $multiple = $field['multiple'] ?? null;
        if ($multiple instanceof \stdClass || (\is_array($multiple) && !array_is_list($multiple))) {
            $settings = (array) $multiple;
            if (\array_key_exists('keys', $settings)) {
                return [true, $settings['keys']];
            }
        }
        return [false, null];
    }

    /** An object of a declaration: stdClass or an associative array. */
    private static function declared(mixed $value): ?array
    {
        if ($value instanceof \stdClass || (\is_array($value) && ($value === [] || !array_is_list($value)))) {
            return (array) $value;
        }
        return null;
    }

    /**
     * Whether the reference, declared by the field at $declarationPath, names a repeated group of
     * the form whose root field map is $root (CUSC-077).
     *
     * @param list<string> $declarationPath
     * @param array<string, mixed> $root
     */
    private static function namesRepeatedGroup(mixed $reference, array $declarationPath, array $root): bool
    {
        if (!\is_string($reference)) {
            return false;
        }
        $dots = strspn($reference, '.');
        $rest = substr($reference, $dots);
        // A path with a dot inside and no leading dot starts at the root; a bare name leaves the field.
        $fromRoot = $dots === 0 && str_contains($rest, '.');
        $leave = $fromRoot ? \count($declarationPath) : max($dots, 1);
        if ($leave > \count($declarationPath)) {
            return false;
        }
        $names = explode('.', $rest);
        foreach ($names as $name) {
            if ($name === '' || $name === '*') {
                return false;
            }
        }
        $properties = $root;
        foreach (\array_slice($declarationPath, 0, \count($declarationPath) - $leave) as $name) {
            $field = self::declared($properties[$name] ?? null);
            $properties = self::declared($field['properties'] ?? null) ?? [];
        }
        $last = \count($names) - 1;
        foreach ($names as $index => $name) {
            $field = \array_key_exists($name, $properties) ? self::declared($properties[$name]) : null;
            $children = $field === null ? null : self::declared($field['properties'] ?? null);
            if ($field === null || ($field['type'] ?? null) !== 'group' || $children === null) {
                return false;
            }
            if ($index === $last) {
                return Validator::isMultiple($field);
            }
            if (Validator::isMultiple($field)) {
                return false;
            }
            $properties = $children;
        }
        return false;
    }

    /**
     * Fail the load when the field declares a `multiple.keys` that names no repeated group (CUVR-070).
     *
     * @param array<string, mixed> $field
     * @param list<string> $declarationPath
     * @param array<string, mixed> $root
     * @throws FormInputError with the field's declaration path
     */
    public static function assertReference(array $field, array $declarationPath, array $root): void
    {
        [$declares, $reference] = self::reference($field);
        if ($declares && !self::namesRepeatedGroup($reference, $declarationPath, $root)) {
            throw new FormInputError(
                'Invalid multiple.keys at ' . implode('.', $declarationPath)
                . ': expected a reference to a repeated group'
            );
        }
    }

    /**
     * Fail when a key of the field's keyed object is not a row key of the group that its
     * `multiple.keys` names, read in the field's row context (CUVR-069); keys in code point order, the byte
     * order of their UTF-8 text.
     *
     * @param array<string, mixed> $field
     * @param list<string> $fieldPath
     * @param list<int> $rowKeys
     * @param array<string, mixed>|\stdClass $allData
     * @throws FormInputError with the data path of the first row whose key is not an id
     */
    public static function assertKeys(
        array $field,
        mixed $value,
        array $fieldPath,
        array $rowKeys,
        array|\stdClass $allData,
    ): void {
        [$declares, $reference] = self::reference($field);
        if (!$declares || !\is_string($reference)) {
            return;
        }
        $group = (new Evaluator($allData, $fieldPath, $rowKeys))->reference($reference);
        $ids = self::declared($group) ?? [];
        $keys = array_map('strval', array_keys((array) $value));
        sort($keys, SORT_STRING);
        foreach ($keys as $key) {
            if (!\array_key_exists($key, $ids)) {
                throw new FormInputError(
                    'Row key is not an id of ' . $reference . ': ' . implode('.', [...$fieldPath, $key])
                );
            }
        }
    }
}
