<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * Type From validation rule (CUVR-077).
 * Validates that a value has the type that the value of another field names: bool a boolean, int a finite number
 * without a fractional part, enum a string; a missing or other type fails.
 */
class TypeFrom extends ReferenceRule
{
    protected function agrees(mixed $value, mixed $reference): bool
    {
        return match ($reference) {
            'bool' => \is_bool($value),
            'int' => \is_int($value) || (\is_float($value) && is_finite($value) && floor($value) === $value),
            'enum' => \is_string($value),
            default => false,
        };
    }
}
