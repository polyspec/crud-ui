<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * Contained In validation rule (CUVR-075).
 * Validates that a string value occurs in the string value of another field; a value or a referenced value
 * that is not a string fails.
 */
class ContainedIn extends ReferenceRule
{
    protected function agrees(mixed $value, mixed $reference): bool
    {
        return \is_string($value) && \is_string($reference) && str_contains($reference, $value);
    }
}
