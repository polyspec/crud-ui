<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;

/**
 * A rule that compares a value with the value of another field: a missing or empty parameter
 * switches it off, the parameter names the other field, and the rule itself compares the two.
 */
abstract class ReferenceRule implements RuleInterface
{
    /**
     * Validate that a value agrees with the value of the field that the parameter names.
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        if ($param === null || $param === '') {
            return true;
        }

        return $this->agrees($value, $path->reference((string)$param, $allData));
    }

    /** Whether the value agrees with the value of the other field. */
    abstract protected function agrees(mixed $value, mixed $reference): bool;
}
