<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * Max From validation rule (CUVR-079).
 * Validates that a finite number is at or below the value of another field; a missing or null bound declares none.
 */
class MaxFrom extends ReferenceRule
{
    protected function agrees(mixed $value, mixed $reference): bool
    {
        return BoundFrom::holds($value, $reference, static fn (float $number, float $bound): bool => $number <= $bound);
    }
}
