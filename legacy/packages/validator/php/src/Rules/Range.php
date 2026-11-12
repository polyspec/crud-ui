<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Inclusive numeric range: a numeric value within [minimum, maximum] passes; any other value fails.
 *
 * @extends NumericRule<array{float, float}>
 */
class Range extends NumericRule
{
    protected function parameter(mixed $param): array
    {
        return Numeric::range($param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return self::within($measure, $parameter);
    }
}
