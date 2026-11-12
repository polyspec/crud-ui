<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * The value a conditional parameter resolves to in a row context: a condition map selects the
 * value of its first matching condition, else its `true` default, else null (a condition that
 * cannot be evaluated does not match); a ternary resolves to its branch value and stays the
 * literal string when it cannot be evaluated; a valid condition expression resolves to its
 * value, or false when it cannot be evaluated; any other string, and any other value, is a
 * literal.
 */
final class ConditionalValue
{
    /**
     * @param list<string> $path the row context, row keys included
     * @param list<int> $rowKeys positions of the row keys in $path
     */
    public static function resolve(mixed $value, array|\stdClass $data, array $path, array $rowKeys = []): mixed
    {
        if ($value instanceof \stdClass || (\is_array($value) && $value !== [] && !array_is_list($value))) {
            return self::select((array) $value, $data, $path, $rowKeys);
        }
        if (!\is_string($value)) {
            return $value;
        }
        try {
            $node = Expression::parse($value);
        } catch (ParseError) {
            return $value;
        }
        if ($node instanceof TernaryNode) {
            try {
                return Expression::evaluateValue($value, $data, $path, $rowKeys);
            } catch (\Throwable) {
                return $value;
            }
        }
        if (Expression::isConditionExpression($value) && preg_match('/\?[^:]*:/', $value) !== 1) {
            try {
                return Expression::evaluateValue($value, $data, $path, $rowKeys);
            } catch (\Throwable) {
                return false;
            }
        }
        return $value;
    }

    /**
     * @param array<array-key, mixed> $map
     * @param list<string> $path
     * @param list<int> $rowKeys
     */
    private static function select(array $map, array|\stdClass $data, array $path, array $rowKeys): mixed
    {
        foreach ($map as $condition => $value) {
            if (
                (string) $condition !== ConditionMap::DEFAULT_KEY
                && self::matches((string) $condition, $data, $path, $rowKeys)
            ) {
                return $value;
            }
        }
        return \array_key_exists(ConditionMap::DEFAULT_KEY, $map) ? $map[ConditionMap::DEFAULT_KEY] : null;
    }

    /**
     * @param list<string> $path
     * @param list<int> $rowKeys
     */
    private static function matches(string $condition, array|\stdClass $data, array $path, array $rowKeys): bool
    {
        try {
            return Expression::evaluate($condition, $data, $path, $rowKeys);
        } catch (\Throwable) {
            return false;
        }
    }
}
