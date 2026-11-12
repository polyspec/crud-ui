<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Canonical text of a scalar: a string itself, `true` as `1`, `false` as `0` and a
 * finite number as ECMAScript writes the double it denotes.
 *
 * @internal
 */
final class CanonicalText
{
    /** Largest integer magnitude whose decimal text is its double's text. */
    private const EXACT_INTEGER = 9007199254740992;

    /** The canonical text, or null for null, arrays and objects. */
    public static function of(mixed $value): ?string
    {
        if (\is_string($value)) {
            return $value;
        }
        if (\is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (\is_int($value)) {
            return $value >= -self::EXACT_INTEGER && $value <= self::EXACT_INTEGER
                ? (string) $value
                : NumberText::of((float) $value);
        }
        if (\is_float($value)) {
            return NumberText::of($value);
        }
        return null;
    }
}
