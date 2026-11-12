<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * `design.show` resolves like a conditional parameter in the field's row context
 * ({@see ConditionalValue}), and only a resolved `false` hides the field: a field without
 * `design.show`, a condition map that selects nothing and a string that is not a valid
 * expression leave it visible. The validator and the form both use this resolution, so a server
 * reaches the visibility the form showed.
 */
final class Visibility
{
    /**
     * Whether a field with this `design.show` value is visible.
     *
     * @param list<string> $path the field's path, row keys included
     * @param list<int> $rowKeys positions of the row keys in $path
     */
    public static function shown(mixed $show, array|\stdClass $data, array $path, array $rowKeys = []): bool
    {
        return ConditionalValue::resolve($show, $data, $path, $rowKeys) !== false;
    }

    /**
     * The `design.show` value of a field declaration, or null.
     *
     * @param array<string, mixed>|\stdClass $field
     */
    public static function declared(array|\stdClass $field): mixed
    {
        $design = ((array) $field)['design'] ?? null;
        if ($design instanceof \stdClass || \is_array($design)) {
            return ((array) $design)['show'] ?? null;
        }
        return null;
    }
}
