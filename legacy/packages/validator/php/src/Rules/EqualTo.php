<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * Equal To validation rule.
 * Validates that a value matches another field's value.
 */
class EqualTo extends ReferenceRule
{
    protected function agrees(mixed $value, mixed $reference): bool
    {
        return $value === $reference;
    }
}
