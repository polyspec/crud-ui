<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Empty values: a missing value or null, a string that is empty after trimming,
 * an empty array and an empty object. `0` and `false` are supplied values.
 *
 * @internal
 */
final class EmptyValue
{
    /** Whether a value is empty. A missing value is passed as null. */
    public static function is(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (\is_string($value)) {
            return Whitespace::trim($value) === '';
        }
        if (\is_array($value)) {
            return $value === [];
        }
        if ($value instanceof \stdClass) {
            return (array) $value === [];
        }
        return false;
    }
}
