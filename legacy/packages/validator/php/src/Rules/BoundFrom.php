<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * The bound of the minFrom and maxFrom rules (CUVR-079): a finite number value against the value of the referenced
 * field; a missing or null bound declares none, and a boolean is no number.
 */
final class BoundFrom
{
    /**
     * Whether `$value` holds against the bound `$reference` by `$within`.
     *
     * @param callable(float, float): bool $within
     */
    public static function holds(mixed $value, mixed $reference, callable $within): bool
    {
        $number = Numeric::finite($value);
        if ($number === null) {
            return false;
        }
        if ($reference === null) {
            return true;
        }
        $bound = Numeric::finite($reference);

        return $bound !== null && $within($number, $bound);
    }
}
