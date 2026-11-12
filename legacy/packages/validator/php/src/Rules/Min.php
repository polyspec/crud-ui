<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Inclusive lower bound: a numeric value not below the bound passes; any other value fails.
 *
 * @extends NumericRule<float>
 */
class Min extends NumericRule
{
    protected function parameter(mixed $param): float
    {
        return Numeric::bound('min', $param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return $measure >= $parameter;
    }
}
