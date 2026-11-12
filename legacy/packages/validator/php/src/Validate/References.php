<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Values\CanonicalText;
use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * References (docs/spec/validation-rules.md, "References"). A `reference` parameter is the
 * declaration path of a field: its property names from the root joined with `.`, without row
 * keys. The ids of the path are the values of that field in the data, read in every row of every
 * repeated field on the path.
 *
 * @internal
 */
final class References
{
    /**
     * Whether `$path` is the declaration path of a field of the form whose type is not `group` and
     * whose `lang` is absent, `false` or `null` (CUVR-074).
     *
     * @param array<string, mixed> $properties the composed root field map
     */
    public static function isTarget(array $properties, string $path): bool
    {
        $fields = $properties;
        $field = null;
        foreach (explode('.', $path) as $name) {
            if (!\is_array($fields) || !\array_key_exists($name, $fields)) {
                return false;
            }
            $next = $fields[$name];
            if (!FieldShape::isObject($next)) {
                return false;
            }
            $field = (array) $next;
            $children = ($field['type'] ?? null) === 'group' ? ($field['properties'] ?? null) : null;
            $fields = FieldShape::isObject($children) ? (array) $children : null;
        }
        if ($field === null || ($field['type'] ?? null) === 'group') {
            return false;
        }
        $lang = $field['lang'] ?? null;
        return $lang === null || $lang === false;
    }

    /**
     * The ids of the declaration path `$path` in `$data` (CUVR-072), in data order. Data of
     * another shape at a step and a missing value hold no ids.
     *
     * @param array<string, mixed> $properties the composed root field map
     * @param array<string, mixed> $data the form data
     * @return list<string|int|float|bool>
     */
    public static function ids(array $properties, array $data, string $path): array
    {
        $ids = [];
        self::collect($properties, $data, explode('.', $path), 0, $ids);
        return $ids;
    }

    /**
     * @param list<string> $segments
     * @param list<string|int|float|bool> $ids
     */
    private static function collect(mixed $fields, mixed $value, array $segments, int $index, array &$ids): void
    {
        if (!FieldShape::isObject($fields) || !FieldShape::isObject($value)) {
            return;
        }
        $name = $segments[$index];
        $fields = (array) $fields;
        $value = (array) $value;
        $field = $fields[$name] ?? null;
        if (!FieldShape::isObject($field) || !\array_key_exists($name, $value)) {
            return;
        }
        $field = (array) $field;
        foreach (self::valuesOf($field, $value[$name]) as $item) {
            if ($index === \count($segments) - 1) {
                if (self::isId($item)) {
                    $ids[] = $item;
                }
            } else {
                self::collect($field['properties'] ?? null, $item, $segments, $index + 1, $ids);
            }
        }
    }

    /**
     * The values a field has in its data: each row of a repeated field, or the value itself.
     *
     * @param array<string, mixed> $field
     * @return list<mixed>
     */
    private static function valuesOf(array $field, mixed $value): array
    {
        if (!FieldShape::isRepeated($field)) {
            return [$value];
        }
        return FieldShape::isObject($value) ? array_values((array) $value) : [];
    }

    /** Whether a value is an id: a string, a finite number or a boolean with a nonempty canonical text. */
    private static function isId(mixed $value): bool
    {
        if (\is_bool($value) || \is_int($value)) {
            return true;
        }
        if (\is_float($value)) {
            return is_finite($value);
        }
        return \is_string($value) && Whitespace::trim((string) CanonicalText::of($value)) !== '';
    }
}
