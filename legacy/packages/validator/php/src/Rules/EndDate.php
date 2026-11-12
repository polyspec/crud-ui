<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * End Date validation rule.
 * Validates that an end date is greater than or equal to a start date field.
 */
class EndDate extends ReferenceRule
{
    protected function agrees(mixed $value, mixed $reference): bool
    {
        // Parse the end date (current field value)
        $endDate = $this->parseDate($value);
        if ($endDate === null) {
            return true; // Invalid date format, let date rule handle it
        }

        // Skip if start date is empty
        if ($reference === null || $reference === '') {
            return true;
        }

        // Parse the start date
        $startDate = $this->parseDate($reference);
        if ($startDate === null) {
            return true; // Invalid start date, skip validation
        }

        // Compare dates
        return $endDate >= $startDate;
    }

    /**
     * Parse a date value to timestamp.
     */
    private function parseDate(mixed $value): ?int
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }

        if (!is_string($value) && !is_numeric($value)) {
            return null;
        }

        $stringValue = Whitespace::trim((string)$value);
        if ($stringValue === '') {
            return null;
        }

        $timestamp = strtotime($stringValue);
        return $timestamp === false ? null : $timestamp;
    }
}
