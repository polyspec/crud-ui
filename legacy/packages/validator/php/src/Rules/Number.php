<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Number: a numeric value passes; any other value fails.
 */
class Number extends FlagRule
{
    protected function name(): string
    {
        return 'number';
    }

    protected function accepts(mixed $value): bool
    {
        return Numeric::of($value) !== null;
    }
}
