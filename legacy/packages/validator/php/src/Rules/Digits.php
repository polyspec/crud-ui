<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Digits: a string or number whose canonical text (a string trimmed) is ASCII digits passes.
 */
class Digits extends FlagRule
{
    protected function name(): string
    {
        return 'digits';
    }

    protected function accepts(mixed $value): bool
    {
        return Numeric::isDigits($value);
    }
}
