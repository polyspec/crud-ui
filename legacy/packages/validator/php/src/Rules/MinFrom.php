<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * Min From validation rule (CUVR-079).
 * Validates that a finite number is at or above the value of another field; a missing or null bound declares none.
 */
class MinFrom extends ReferenceRule
{
    protected function agrees(mixed $value, mixed $reference): bool
    {
        return BoundFrom::holds($value, $reference, static fn (float $number, float $bound): bool => $number >= $bound);
    }
}
