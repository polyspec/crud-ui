<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Inclusive upper bound: a numeric value not above the bound passes; any other value fails.
 *
 * @extends NumericRule<float>
 */
class Max extends NumericRule
{
    protected function parameter(mixed $param): float
    {
        return Numeric::bound('max', $param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return $measure <= $parameter;
    }
}
