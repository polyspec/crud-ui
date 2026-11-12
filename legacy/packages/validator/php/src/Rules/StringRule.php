<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;

/**
 * A rule on the text of a string: a parameter of false switches it off, a value that is not a
 * string fails, and the string is accepted or not by the rule itself.
 */
abstract class StringRule implements RuleInterface
{
    /**
     * Validate that a value is a string that the rule accepts.
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        if ($param === false) {
            return true;
        }

        return is_string($value) && $this->accepts($value);
    }

    /** Whether the rule accepts the string. */
    abstract protected function accepts(string $text): bool;
}
