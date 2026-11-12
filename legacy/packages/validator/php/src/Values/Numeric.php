<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Numeric values: a finite number, or a string that after trimming is numeric text (the
 * HTML valid floating-point number) whose value is finite. Booleans, null, arrays and
 * objects are not numeric. Numeric rule parameters, exact step multiples, digit-only
 * values and collection counts are defined here as well.
 *
 * @internal
 */
final class Numeric
{
    /** The HTML valid floating-point number. */
    private const TEXT = '/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/D';

    /** The value of a numeric value as the nearest double, or null when it is not numeric. */
    public static function of(mixed $value): ?float
    {
        return self::asWritten(\is_string($value) ? Whitespace::trim($value) : $value);
    }

    /**
     * The value of a number, or of a string read as written (not trimmed), as the nearest
     * double; null when it is not numeric. `in` members are read this way.
     */
    public static function asWritten(mixed $value): ?float
    {
        if (\is_int($value)) {
            return (float) $value;
        }
        if (\is_float($value)) {
            return is_finite($value) ? $value : null;
        }
        if (!\is_string($value)) {
            return null;
        }
        $text = $value;
        if (preg_match(self::TEXT, $text) !== 1) {
            return null;
        }
        // PHP reads a decimal string as the correctly rounded double; overflow reads as an infinity.
        $number = (float) $text;
        return is_finite($number) ? $number : null;
    }

    /**
     * Whether a value is an integer multiple of a positive step, decided exactly on the
     * decimals the canonical texts of |value| and the step write.
     */
    public static function isMultiple(float $value, float $step): bool
    {
        if ($value == 0.0) {
            return true;
        }
        // value = a × 10^p and step = b × 10^q, with a and b below 10^17.
        [$a, $p] = NumberText::decimal(abs($value));
        [$b, $q] = NumberText::decimal($step);
        if ($p >= $q) {
            // b divides a × 10^(p−q): reduce modulo b one power of ten at a time.
            $remainder = $a % $b;
            for ($power = $q; $power < $p && $remainder !== 0; $power++) {
                $remainder = ($remainder * 10) % $b;
            }
            return $remainder === 0;
        }
        // 10^(q−p) must divide a, and b must divide the quotient.
        $shift = $q - $p;
        if ($shift > 17) {
            return false;
        }
        $scale = 10 ** $shift;
        return $a % $scale === 0 && intdiv($a, $scale) % $b === 0;
    }

    /** Whether a string (trimmed) or a number has a canonical text of ASCII digits only. */
    public static function isDigits(mixed $value): bool
    {
        if (\is_string($value)) {
            $text = Whitespace::trim($value);
        } elseif (\is_int($value) || (\is_float($value) && is_finite($value))) {
            $text = (string) CanonicalText::of($value);
        } else {
            return false;
        }
        return preg_match('/^[0-9]+$/D', $text) === 1;
    }

    /**
     * The count of a value: the elements of an array or the keys of an object; 0 for a
     * missing value, null and a string that is empty after trimming; 1 for any other scalar.
     */
    public static function count(mixed $value): int
    {
        if (\is_array($value)) {
            return \count($value);
        }
        if (\is_object($value)) {
            return \count(get_object_vars($value));
        }
        if ($value === null || (\is_string($value) && Whitespace::trim($value) === '')) {
            return 0;
        }
        return 1;
    }

    /**
     * The parameter of `number` or `digits`.
     *
     * @throws InvalidRuleParameter
     */
    public static function flag(string $rule, mixed $parameter): bool
    {
        if (!\is_bool($parameter)) {
            throw self::failure("Invalid $rule parameter: expected true or false");
        }
        return $parameter;
    }

    /**
     * The bound of `min` or `max`.
     *
     * @throws InvalidRuleParameter
     */
    public static function bound(string $rule, mixed $parameter): float
    {
        $bound = self::finite($parameter);
        if ($bound === null) {
            throw self::failure("Invalid $rule parameter: expected a finite number");
        }
        return $bound;
    }

    /**
     * The two members of a `[minimum, maximum]` parameter, each read by `$read`, or null when the
     * parameter is not a list of two readable numbers with the minimum not above the maximum.
     *
     * @template T of int|float
     * @param \Closure(mixed): (T|null) $read
     * @return array{T, T}|null
     */
    public static function orderedPair(mixed $parameter, \Closure $read): ?array
    {
        if (!\is_array($parameter) || !array_is_list($parameter) || \count($parameter) !== 2) {
            return null;
        }
        $minimum = $read($parameter[0]);
        $maximum = $read($parameter[1]);
        return $minimum !== null && $maximum !== null && $minimum <= $maximum ? [$minimum, $maximum] : null;
    }

    /**
     * The `[minimum, maximum]` bounds of `range`.
     *
     * @return array{float, float}
     * @throws InvalidRuleParameter
     */
    public static function range(mixed $parameter): array
    {
        $pair = self::orderedPair($parameter, self::finite(...));
        if ($pair !== null) {
            return $pair;
        }
        throw self::failure(
            'Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum'
        );
    }

    /**
     * The increment of `step`.
     *
     * @throws InvalidRuleParameter
     */
    public static function step(mixed $parameter): float
    {
        $step = self::finite($parameter);
        if ($step === null || $step <= 0.0) {
            throw self::failure('Invalid step parameter: expected a finite number above 0');
        }
        return $step;
    }

    /** A JSON number that is finite, as a double; a boolean is none. */
    public static function finite(mixed $value): ?float
    {
        if (\is_int($value)) {
            return (float) $value;
        }
        return \is_float($value) && is_finite($value) ? $value : null;
    }

    private static function failure(string $message): InvalidRuleParameter
    {
        return new InvalidRuleParameter(InvalidRuleParameter::PARAMETER, $message);
    }
}
