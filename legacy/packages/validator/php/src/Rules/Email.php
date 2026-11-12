<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * Email format validation rule.
 */
class Email extends StringRule
{
    protected function accepts(string $text): bool
    {
        return filter_var($text, FILTER_VALIDATE_EMAIL) !== false;
    }
}
