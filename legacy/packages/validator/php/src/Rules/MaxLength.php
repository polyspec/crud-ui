<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\LengthLimit;

/**
 * Maximum length validation rule on the code points of the canonical text.
 *
 * The canonical text of a scalar has no more than the specified number of code points.
 * An array or object value fails.
 *
 * @extends LengthRule<int>
 */
class MaxLength extends LengthRule
{
    protected function parameter(mixed $param): int
    {
        return LengthLimit::single('maxlength', $param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return $measure <= $parameter;
    }
}
