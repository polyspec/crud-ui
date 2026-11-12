<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Step: a numeric value that is an exact integer multiple of the step, counted from 0, passes; any other value fails.
 *
 * @extends NumericRule<float>
 */
class Step extends NumericRule
{
    protected function parameter(mixed $param): float
    {
        return Numeric::step($param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return Numeric::isMultiple($measure, $parameter);
    }
}
