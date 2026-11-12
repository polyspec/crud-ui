<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\LengthLimit;

/**
 * Maximum collection size: array elements, object keys, 0 for a missing or blank value, 1 for another scalar.
 */
class MaxCount extends CountRule
{
    protected function parameter(mixed $param): int
    {
        return LengthLimit::single('maxcount', $param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return $measure <= $parameter;
    }
}
