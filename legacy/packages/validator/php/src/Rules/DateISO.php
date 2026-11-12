<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * ISO Date validation rule.
 * Validates that a value is a valid ISO 8601 date format (YYYY-MM-DD).
 */
class DateISO extends StringRule
{
    protected function accepts(string $text): bool
    {
        $stringValue = Whitespace::trim($text);

        // Check format YYYY-MM-DD
        if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D', $stringValue)) {
            return false;
        }

        // Validate the date components
        [$year, $month, $day] = explode('-', $stringValue);

        return checkdate((int)$month, (int)$day, (int)$year);
    }
}
