<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\LengthLimit;

/**
 * A rule on the length of the canonical text of the value in code points, which is its measure: an array or object
 * value has none.
 *
 * @template P
 * @extends MeasuredRule<P>
 */
abstract class LengthRule extends MeasuredRule
{
    final protected function measure(mixed $value): int|null
    {
        return LengthLimit::lengthOf($value);
    }
}
