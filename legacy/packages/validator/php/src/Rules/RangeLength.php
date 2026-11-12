<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\LengthLimit;

/**
 * Range length validation rule on the code points of the canonical text.
 *
 * The length of the canonical text of a scalar is within [minimum, maximum] code points.
 * An array or object value fails.
 *
 * @extends LengthRule<array{int, int}>
 */
class RangeLength extends LengthRule
{
    protected function parameter(mixed $param): array
    {
        return LengthLimit::range($param);
    }

    protected function accepts(int|float $measure, mixed $parameter): bool
    {
        return self::within($measure, $parameter);
    }
}
