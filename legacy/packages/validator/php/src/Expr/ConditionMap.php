<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Condition-map resolver (expressions.md §8). A thin wrapper over the
 * expression engine — NOT a separate parser.
 *
 * A condition map is an ordered {expr: value, …}. Keys (each an §2 expression)
 * are evaluated in declaration order; the first truthy key's value wins. On a
 * miss the literal `true` key's value is used if present, else null. PHP assoc
 * arrays preserve insertion order, so declaration order survives natively.
 *
 * The `true` default key is the literal expression `true` (always truthy); R4
 * forbids convention sigils such as `_`. The map's value is returned verbatim
 * (boolean | string | number | null) — the call site decides the expected type.
 */
final class ConditionMap
{
    public const DEFAULT_KEY = 'true';

    /**
     * Resolve a condition map against form data.
     *
     * @param array<string, mixed> $map ordered expr => value
     * @param array<string, mixed> $formData
     * @param list<string>         $currentPath
     * @param list<int>            $rowKeys positions of the row keys in $currentPath
     */
    public static function resolve(
        array|\stdClass $map,
        array|\stdClass $formData,
        array $currentPath = [],
        array $rowKeys = []
    ): mixed {
        $map = (array) $map;
        $evaluator = new Evaluator($formData, $currentPath, $rowKeys);

        foreach ($map as $expr => $value) {
            // The default key is matched by literal text, not by evaluation, so
            // it never short-circuits an earlier real condition.
            if ((string) $expr === self::DEFAULT_KEY) {
                continue;
            }
            if ($evaluator->evaluate(Expression::parse((string) $expr))) {
                return $value;
            }
        }

        if (array_key_exists(self::DEFAULT_KEY, $map)) {
            return $map[self::DEFAULT_KEY];
        }

        return null;
    }
}
