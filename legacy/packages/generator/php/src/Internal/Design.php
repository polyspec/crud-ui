<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\Validator\Expr\Expression;
use Polyspec\Crudui\Validator\Expr\TernaryNode;
use Polyspec\Crudui\Validator\Expr\Visibility;
use stdClass;

/** Evaluate visibility and appearance with the shared expression engine and visibility rule. */
final class Design
{
    private static function condition(
        string $expression,
        stdClass $data,
        array $path,
        array $rows,
        bool $raw = false
    ): mixed {
        try {
            return $raw
                ? Expression::evaluateValue($expression, $data, $path, $rows)
                : Expression::evaluate($expression, $data, $path, $rows);
        } catch (\InvalidArgumentException | \RuntimeException $error) {
            return false;
        }
    }

    private static function conditionMap(stdClass $map, stdClass $data, array $path, array $rows): mixed
    {
        foreach ($map as $condition => $value) {
            if ($condition !== 'true' && self::condition($condition, $data, $path, $rows)) {
                return $value;
            }
        }
        return $map->true ?? null;
    }

    /**
     * Whether a field is visible, by the validator's visibility rule: only a resolved false hides.
     * $rows are the positions of the row keys in $path.
     */
    public static function show(mixed $value, stdClass $data, array $path, array $rows): bool
    {
        return $value === Missing::Value || Visibility::shown($value, $data, $path, $rows);
    }

    /**
     * A boolean flag other than visibility, such as a list column's `sortable`: a missing value
     * is false, a condition map that selects nothing is false and an expression that cannot be
     * evaluated is false.
     */
    public static function flag(mixed $value, stdClass $data, array $path, array $rows): bool
    {
        if ($value instanceof stdClass) {
            return Value::truthy(self::conditionMap($value, $data, $path, $rows));
        }
        if (is_string($value)) {
            return self::condition($value, $data, $path, $rows);
        }
        return Value::truthy($value);
    }

    /** Whether a string parses completely as an expression. */
    private static function parses(string $value): bool
    {
        try {
            Expression::parse($value);
            return true;
        } catch (\InvalidArgumentException | \RuntimeException $error) {
            return false;
        }
    }

    /**
     * Resolve appearance text from a literal, expression or condition map: a string is an
     * expression only when it parses completely; any other string is literal text.
     */
    public static function appearance(mixed $value, stdClass $data, array $path, array $rows): string
    {
        if ($value === Missing::Value || $value === null) {
            return '';
        }
        if ($value instanceof stdClass) {
            $value = self::conditionMap($value, $data, $path, $rows);
            return $value === null ? '' : Value::string($value);
        }
        if (is_string($value)) {
            if (self::parses($value) && Expression::parse($value) instanceof TernaryNode) {
                $result = Expression::evaluateValue($value, $data, $path, $rows);
                return $result === null ? '' : Value::string($result);
            }
            if (
                Expression::isConditionExpression($value)
                && !preg_match('/\?[^:]*:/', $value)
                && self::parses($value)
            ) {
                $result = self::condition($value, $data, $path, $rows, true);
                return $result === false || $result === null ? '' : Value::string($result);
            }
            return $value;
        }
        return Value::string($value);
    }

    /**
     * Evaluate the visibility and named appearance nodes for one field; $rows are the positions of the row keys in
     * $path.
     */
    public static function resolve(mixed $design, stdClass $data, array $path, array $rows): stdClass
    {
        $design = $design instanceof stdClass ? $design : new stdClass();
        $node = static function (mixed $value) use ($data, $path, $rows): stdClass {
            return (object) [
                'class' => self::appearance(Value::get($value, 'class'), $data, $path, $rows),
                'style' => self::appearance(Value::get($value, 'style'), $data, $path, $rows),
            ];
        };
        return (object) [
            'show' => self::show(Value::get($design, 'show'), $data, $path, $rows),
            'main' => $node($design),
            'label' => $node($design->label ?? null),
            'wrapper' => $node($design->wrapper ?? null),
            'group' => $node($design->group ?? null),
            'prepend' => $node($design->prepend ?? null),
        ];
    }

    /**
     * A copy of the declared control attributes (design.attributes) or, with $wrapper, the node
     * root attributes (design.wrapper.attributes); the missing marker when none is declared.
     */
    public static function declared(mixed $design, bool $wrapper): stdClass|Missing
    {
        if ($wrapper && $design instanceof stdClass) {
            $design = $design->wrapper ?? null;
        }
        $attributes = $design instanceof stdClass ? $design->attributes ?? null : null;
        if (!$attributes instanceof stdClass || get_object_vars($attributes) === []) {
            return Missing::Value;
        }
        return clone $attributes;
    }
}
