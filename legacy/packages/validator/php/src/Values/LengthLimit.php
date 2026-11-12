<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Length rules count the code points of a scalar's canonical text, untrimmed. Limits
 * are integers from 0 to 9007199254740991; an array or object fails a length rule.
 *
 * @internal
 */
final class LengthLimit
{
    /** Largest length limit. */
    public const MAXIMUM = 9007199254740991;

    /**
     * The limit of `minlength` or `maxlength`.
     *
     * @throws InvalidRuleParameter
     */
    public static function single(string $rule, mixed $parameter): int
    {
        $limit = self::integer($parameter);
        if ($limit === null) {
            throw new InvalidRuleParameter(
                InvalidRuleParameter::PARAMETER,
                "Invalid $rule parameter: expected an integer from 0 to " . self::MAXIMUM,
            );
        }
        return $limit;
    }

    /**
     * The `[minimum, maximum]` limits of `rangelength`.
     *
     * @return array{int, int}
     * @throws InvalidRuleParameter
     */
    public static function range(mixed $parameter): array
    {
        $pair = Numeric::orderedPair($parameter, self::integer(...));
        if ($pair !== null) {
            return $pair;
        }
        throw new InvalidRuleParameter(
            InvalidRuleParameter::PARAMETER,
            'Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum',
        );
    }

    /** The code point length of a value, or null for a value without canonical text. */
    public static function lengthOf(mixed $value): ?int
    {
        $text = CanonicalText::of($value);
        return $text === null ? null : Utf8::length($text);
    }

    /** A number that is an integer from 0 to MAXIMUM, as an int. */
    public static function integer(mixed $value): ?int
    {
        if (\is_int($value)) {
            return $value >= 0 && $value <= self::MAXIMUM ? $value : null;
        }
        if (
            \is_float($value) && is_finite($value) && floor($value) === $value
            && $value >= 0.0 && $value <= (float) self::MAXIMUM
        ) {
            return (int) $value;
        }
        return null;
    }
}
