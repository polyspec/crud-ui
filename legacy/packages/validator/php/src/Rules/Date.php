<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;
use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * Date validation rule.
 * Validates that a value is a valid date.
 */
class Date implements RuleInterface
{
    /** The date rule (CUVR-058): a string, trimmed, in one of the layouts with a calendar day, or an RFC 3339
     * date-time with a valid time and offset. A number is not a date. */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        if ($param === false) {
            return true;
        }

        if (!is_string($value)) {
            return false;
        }

        $text = Whitespace::trim($value);
        $dateTime = '/^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})'
            . '(Z|[+-][0-9]{2}:[0-9]{2})$/D';
        if (preg_match($dateTime, $text, $m)) {
            if (!self::isDayText($m[1]) || (int)$m[2] > 23 || (int)$m[3] > 59 || (int)$m[4] > 59) {
                return false;
            }

            return $m[5] === 'Z' || ((int)substr($m[5], 1, 2) <= 23 && (int)substr($m[5], 4, 2) <= 59);
        }

        return self::isDayText($text);
    }

    /** Whether a trimmed text is YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY or DD/MM/YYYY naming a calendar day. */
    private static function isDayText(string $text): bool
    {
        if (preg_match('/^([0-9]{4})([-\/])([0-9]{2})\2([0-9]{2})$/D', $text, $m)) {
            return checkdate((int)$m[3], (int)$m[4], (int)$m[1]);
        }

        if (preg_match('/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/D', $text, $m)) {
            $year = (int)$m[3];

            return checkdate((int)$m[1], (int)$m[2], $year) || checkdate((int)$m[2], (int)$m[1], $year);
        }

        return false;
    }
}
