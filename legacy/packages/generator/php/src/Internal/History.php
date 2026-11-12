<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/**
 * The undo history rules of form instances (CURT-062, CURT-063, CURT-076 to CURT-080), as pure functions. A history
 * is an object with the lists `entries` and `redoEntries` and, after a value edit, the string `lastPath`; no function
 * changes its argument.
 */
final class History
{
    /** The number of records a history keeps in each direction. */
    public const LIMIT = 100;

    /** The history with no record. */
    public static function empty(): stdClass
    {
        return (object) ['entries' => [], 'redoEntries' => []];
    }

    /**
     * The history after a change from `$previous`: the record is appended unless `$path` equals the path of the last
     * value edit, the last 100 entries stay, the redo entries are cleared and `$path` becomes the last path.
     */
    public static function record(stdClass $history, mixed $previous, ?string $path = null): stdClass
    {
        $entries = self::list($history, 'entries');
        if ($path === null || $path !== ($history->lastPath ?? null)) {
            $entries[] = $previous;
        }
        $result = (object) ['entries' => self::last($entries), 'redoEntries' => []];
        if ($path !== null) {
            $result->lastPath = $path;
        }

        return $result;
    }

    /** Whether the history has a record to restore. */
    public static function canUndo(stdClass $history): bool
    {
        return self::list($history, 'entries') !== [];
    }

    /** Whether the history has a record to restore in the forward direction. */
    public static function canRedo(stdClass $history): bool
    {
        return self::list($history, 'redoEntries') !== [];
    }

    /**
     * The history without its last entry, with `$current` appended to the redo entries, and the last entry as the
     * record.
     *
     * @throws FormError when the history has no entry
     */
    public static function undo(stdClass $history, mixed $current): stdClass
    {
        $entries = self::list($history, 'entries');
        if ($entries === []) {
            throw new FormError('INVALID_FORM_INPUT', 'Nothing to undo');
        }
        $value = array_pop($entries);
        $redo = self::list($history, 'redoEntries');
        $redo[] = $current;

        return (object) [
            'history' => (object) ['entries' => $entries, 'redoEntries' => self::last($redo)],
            'value' => $value,
        ];
    }

    /**
     * The history with `$current` appended to the entries and without its last redo entry, and that redo entry as
     * the record.
     *
     * @throws FormError when the history has no redo entry
     */
    public static function redo(stdClass $history, mixed $current): stdClass
    {
        $redo = self::list($history, 'redoEntries');
        if ($redo === []) {
            throw new FormError('INVALID_FORM_INPUT', 'Nothing to redo');
        }
        $value = array_pop($redo);
        $entries = self::list($history, 'entries');
        $entries[] = $current;

        return (object) [
            'history' => (object) ['entries' => self::last($entries), 'redoEntries' => $redo],
            'value' => $value,
        ];
    }

    /** @return list<mixed> */
    private static function list(stdClass $history, string $name): array
    {
        $records = $history->{$name} ?? [];

        return is_array($records) ? array_values($records) : [];
    }

    /**
     * @param list<mixed> $records
     * @return list<mixed>
     */
    private static function last(array $records): array
    {
        return array_slice($records, -self::LIMIT);
    }
}
