<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use DateTimeImmutable;
use DateTimeZone;

/** Parse supported date strings for UTC control and list display. */
final class Dates
{
    private const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    private const ZONES = [
        'z' => 0,
        'ut' => 0,
        'gmt' => 0,
        'est' => -18000,
        'edt' => -14400,
        'cst' => -21600,
        'cdt' => -18000,
        'mst' => -25200,
        'mdt' => -21600,
        'pst' => -28800,
        'pdt' => -25200,
    ];

    /** Return UTC at whole-second precision, or null for invalid or unsupported input. */
    public static function parseUtc(string $value): ?DateTimeImmutable
    {
        if (
            preg_match(
                '/\A([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[T ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]+)?)?(Z'
                    . '|[+-][0-9]{2}:[0-9]{2})?)?\z/',
                $value,
                $parts,
                PREG_UNMATCHED_AS_NULL
            )
        ) {
            $offset = self::offset($parts[7] ?? 'Z');
            return $offset === null
                ? null
                : self::create(
                    (int) $parts[1],
                    (int) $parts[2],
                    (int) $parts[3],
                    (int) ($parts[4] ?? 0),
                    (int) ($parts[5] ?? 0),
                    (int) ($parts[6] ?? 0),
                    $offset
                );
        }
        if (
            preg_match(
                '/\A(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),[ \t]+)?([0-9]{1,2})[ \t]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug'
                    . '|Sep|Oct|Nov|Dec)[ \t]+([0-9]{4})[ \t]+([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?[ \t]+([+-][0-9]{4'
                    . '}|UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\z/i',
                $value,
                $parts,
                PREG_UNMATCHED_AS_NULL
            )
        ) {
            $offset = self::offset($parts[8]);
            $month = array_search(strtolower($parts[3]), self::MONTHS, true) + 1;
            return $offset === null
                ? null
                : self::create(
                    (int) $parts[4],
                    $month,
                    (int) $parts[2],
                    (int) $parts[5],
                    (int) $parts[6],
                    (int) ($parts[7] ?? 0),
                    $offset,
                    $parts[1]
                );
        }
        return null;
    }

    private static function offset(string $zone): ?int
    {
        $named = self::ZONES[strtolower($zone)] ?? null;
        if ($named !== null) {
            return $named;
        }
        $numeric = str_replace(':', '', $zone);
        $hours = (int) substr($numeric, 1, 2);
        $minutes = (int) substr($numeric, 3, 2);
        if ($hours > 23 || $minutes > 59) {
            return null;
        }
        return ($numeric[0] === '-' ? -1 : 1) * ($hours * 3600 + $minutes * 60);
    }

    private static function create(
        int $year,
        int $month,
        int $day,
        int $hour,
        int $minute,
        int $second,
        int $offset,
        ?string $weekday = null
    ): ?DateTimeImmutable {
        if ($hour > 23 || $minute > 59 || $second > 59) {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat(
            '!Y-m-d H:i:s',
            sprintf('%04d-%02d-%02d %02d:%02d:%02d', $year, $month, $day, $hour, $minute, $second),
            new DateTimeZone('UTC')
        );
        $errors = DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            return null;
        }
        if ($weekday !== null && strtolower($weekday) !== strtolower($date->format('D'))) {
            return null;
        }
        return $date->setTimestamp($date->getTimestamp() - $offset);
    }
}
