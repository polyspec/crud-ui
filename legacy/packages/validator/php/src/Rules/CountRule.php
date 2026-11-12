<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * A rule on the count of the value (array elements, object keys, 0 for a missing or blank value, 1 for another
 * scalar), which is its measure.
 *
 * @extends MeasuredRule<int>
 */
abstract class CountRule extends MeasuredRule
{
    final protected function measure(mixed $value): int
    {
        return Numeric::count($value);
    }
}
