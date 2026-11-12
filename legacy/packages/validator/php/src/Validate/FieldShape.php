<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

/**
 * The shapes that the traversal of the validator and the ids of a reference both read: a JSON
 * object, and a field that repeats (schema, `multiple`).
 *
 * @internal
 */
final class FieldShape
{
    /** Whether a value is a JSON object: a stdClass or an associative array that is not a list. */
    public static function isObject(mixed $value): bool
    {
        return $value instanceof \stdClass || (\is_array($value) && !array_is_list($value));
    }

    /**
     * Whether a field repeats: `multiple` is `true`, `only` or an object.
     *
     * @param array<string, mixed> $field
     */
    public static function isRepeated(array $field): bool
    {
        $multiple = $field['multiple'] ?? null;
        return $multiple === true || $multiple === 'only' || self::isObject($multiple);
    }
}
