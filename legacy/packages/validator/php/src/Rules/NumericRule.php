<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * A rule on the numeric value of the value, which is its measure.
 *
 * @template P
 * @extends MeasuredRule<P>
 */
abstract class NumericRule extends MeasuredRule
{
    final protected function measure(mixed $value): float|null
    {
        return Numeric::of($value);
    }
}
