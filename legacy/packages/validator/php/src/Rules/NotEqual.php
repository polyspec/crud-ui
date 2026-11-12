<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;

/**
 * Not Equal validation rule.
 * Validates that a value is different from a specified value or another field's value.
 */
class NotEqual implements RuleInterface
{
    /**
     * Validate that a value is different from the specified value or field.
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        if ($param === null) {
            return true;
        }

        $compareValue = $param;

        // Check if param is a field path (starts with .)
        if (is_string($param) && str_starts_with($param, '.')) {
            $compareValue = $path->reference($param, $allData);
        }

        return $value !== $compareValue;
    }
}
