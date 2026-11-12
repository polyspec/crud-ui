<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;

/**
 * Interface for validation rules.
 */
interface RuleInterface
{
    /**
     * Validate a value against this rule.
     *
     * @param mixed $value The value to validate
     * @param mixed $param The rule parameter (e.g., min length, pattern, etc.)
     * @param array $allData All form data (for cross-field validation)
     * @param FieldPath $path The data path of the value with the positions of its row keys
     * @return bool True if valid, false otherwise
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool;
}
