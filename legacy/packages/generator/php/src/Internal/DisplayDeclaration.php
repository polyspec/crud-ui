<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/** Declaration rules of composed list and detail specifications (docs/spec/display-formats.md). */
final class DisplayDeclaration
{
    private const LIST_KEYS = ['columns', 'search', 'sort', 'pagination', 'actions', 'empty', 'description', 'design'];
    private const DETAIL_KEYS = ['fields', 'actions', 'design'];
    private const COLUMN_KEYS = ['field', 'label', 'format', 'design', 'sortable'];
    private const FIELD_KEYS = ['field', 'label', 'format', 'design'];
    private const SORT_KEYS = ['field', 'dir'];
    private const SCRIPT_ACTION_KEYS = ['label', 'script'];
    private const ACTION_KEYS = ['label', 'format', 'behavior', 'design'];
    private const BEHAVIOR_KEYS = ['onchange', 'onclick', 'onload'];
    private const FORMAT_STRINGS = ['type', 'pattern', 'target', 'as'];
    private const FORMAT_CONTENT = ['prefix', 'suffix', 'text', 'true', 'false', 'alt'];
    private const PAGINATION_MODES = ['pages', 'offset', 'cursor', 'none'];
    private const CONTENT = 'a string, a language map or null';

    /**
     * Check a composed list or detail specification: the root members, the own design, each
     * column or field in member order and then, for a list, search, sort, actions, empty,
     * description and pagination, and for a detail, actions. $own is `list` or `detail` and $members is `columns` or
     * `fields`.
     */
    public static function check(stdClass $spec, string $own, string $members): void
    {
        foreach (array_keys((array) $spec) as $key) {
            $key = (string) $key;
            if ($key === '$ref' || $key === '$patch') {
                self::expected($key, $own, 'composition inside ' . $members);
            }
            if (!in_array($key, $own === 'list' ? self::LIST_KEYS : self::DETAIL_KEYS, true)) {
                self::unknown($key, $own);
            }
        }
        if (property_exists($spec, 'design')) {
            Template::checkDesignDeclaration($spec->design, $own);
        }
        foreach ((array) $spec->{$members} as $name => $member) {
            self::member((string) $name, $member, $own, $members);
        }
        if ($own === 'detail') {
            if (property_exists($spec, 'actions')) {
                self::actions($spec->actions, $own);
            }
            return;
        }
        if (property_exists($spec, 'search') && !is_bool($spec->search) && !Value::isObject($spec->search)) {
            self::expected('search', $own, 'a boolean or an object');
        }
        if (property_exists($spec, 'sort')) {
            if (!Value::isObject($spec->sort)) {
                self::expected('sort', $own, 'an object');
            }
            $sort = (array) $spec->sort;
            self::closed($sort, 'sort.', self::SORT_KEYS, $own);
            if (array_key_exists('field', $sort) && !is_string($sort['field'])) {
                self::expected('sort.field', $own, 'a string');
            }
            if (array_key_exists('dir', $sort) && $sort['dir'] !== 'asc' && $sort['dir'] !== 'desc') {
                self::expected('sort.dir', $own, 'asc or desc');
            }
        }
        if (property_exists($spec, 'actions')) {
            self::actions($spec->actions, $own);
        }
        if (property_exists($spec, 'empty') && !self::isContent($spec->empty)) {
            self::expected('empty', $own, self::CONTENT);
        }
        if (property_exists($spec, 'description') && !self::isContent($spec->description)) {
            self::expected('description', $own, self::CONTENT);
        }
        if (property_exists($spec, 'pagination')) {
            self::pagination($spec->pagination, $own);
        }
    }

    /** Check the actions declaration of a list or detail at $own, each action in member order. */
    private static function actions(mixed $actions, string $own): void
    {
        if (!Value::isObject($actions)) {
            self::expected('actions', $own, 'an object');
        }
        foreach ((array) $actions as $name => $action) {
            $name = (string) $name;
            // Actions are not composed: a composition key is not an action name.
            if ($name === '$ref' || $name === '$patch') {
                self::unknown($name, 'actions');
            }
            self::action($name, $action);
        }
    }

    /** A string, a language map (a non-empty object of strings or null) or null. */
    private static function isContent(mixed $value): bool
    {
        if ($value === null || is_string($value)) {
            return true;
        }
        if (!Value::isObject($value)) {
            return false;
        }
        foreach ((array) $value as $entry) {
            if ($entry !== null && !is_string($entry)) {
                return false;
            }
        }
        return (array) $value !== [];
    }

    /** A condition map: an object with at least one member. */
    private static function isConditionMap(mixed $value): bool
    {
        return Value::isObject($value) && (array) $value !== [];
    }

    private static function expected(string $key, string $path, string $expected): never
    {
        throw new FormError('INVALID_FORM_INPUT', sprintf('Invalid %s at %s: expected %s', $key, $path, $expected));
    }

    private static function unknown(string $key, string $path): never
    {
        throw new FormError('INVALID_FORM_INPUT', sprintf('Invalid %s at %s: unknown key', $key, $path));
    }

    /** Reject the first member, in member order, that $allowed does not list. */
    private static function closed(array $members, string $prefix, array $allowed, string $path): void
    {
        foreach (array_keys($members) as $key) {
            if (!in_array((string) $key, $allowed, true)) {
                self::unknown($prefix . $key, $path);
            }
        }
    }

    /** Check a cell format declaration at $path. */
    private static function format(mixed $format, string $path): void
    {
        if (is_bool($format) || is_string($format)) {
            return;
        }
        if (!Value::isObject($format)) {
            self::expected('format', $path, 'a boolean, a string or an object');
        }
        foreach ((array) $format as $key => $value) {
            $key = (string) $key;
            if (in_array($key, self::FORMAT_STRINGS, true)) {
                if (!is_string($value)) {
                    self::expected('format.' . $key, $path, 'a string');
                }
            } elseif (in_array($key, self::FORMAT_CONTENT, true)) {
                if (!self::isContent($value)) {
                    self::expected('format.' . $key, $path, self::CONTENT);
                }
            } elseif ($key === 'map') {
                if (!Value::isObject($value)) {
                    self::expected('format.map', $path, 'an object');
                }
                foreach ((array) $value as $name => $label) {
                    if (!self::isContent($label)) {
                        self::expected('format.map.' . $name, $path, self::CONTENT);
                    }
                }
            } elseif ($key === 'href') {
                if (!is_string($value) && !self::isConditionMap($value)) {
                    self::expected('format.href', $path, 'a string or a condition map');
                }
            } elseif ($key === 'items') {
                if (!is_array($value) && !$value instanceof stdClass) {
                    self::expected('format.items', $path, 'an array or an object');
                }
                if (ChoiceList::is($value) && ChoiceList::pairs($value) === null) {
                    self::expected('format.items', $path, ChoiceList::EXPECTED);
                }
            }
        }
    }

    /** Check one column or field declaration. */
    private static function member(string $name, mixed $member, string $own, string $members): void
    {
        if (!Value::isObject($member)) {
            self::expected($name, $members, 'an object');
        }
        $path = $members . '.' . $name;
        $member = (array) $member;
        self::closed($member, '', $own === 'list' ? self::COLUMN_KEYS : self::FIELD_KEYS, $path);
        if (array_key_exists('field', $member) && !is_string($member['field'])) {
            self::expected('field', $path, 'a string');
        }
        if (array_key_exists('label', $member) && !self::isContent($member['label'])) {
            self::expected('label', $path, self::CONTENT);
        }
        if (array_key_exists('format', $member)) {
            self::format($member['format'], $path);
        }
        if (array_key_exists('design', $member)) {
            Template::checkDesignDeclaration($member['design'], $path);
        }
        if (array_key_exists('sortable', $member)) {
            $sortable = $member['sortable'];
            if (!is_bool($sortable) && !is_string($sortable) && !self::isConditionMap($sortable)) {
                self::expected('sortable', $path, 'a boolean, an expression or a condition map');
            }
        }
    }

    /** Check one behavior entry of an action at $path. */
    private static function behaviorEntry(string $event, mixed $entry, string $path): void
    {
        if (is_string($entry)) {
            return;
        }
        if (!Value::isObject($entry)) {
            self::expected('behavior.' . $event, $path, 'a script or an object');
        }
        $entry = (array) $entry;
        self::closed($entry, 'behavior.' . $event . '.', self::SCRIPT_ACTION_KEYS, $path);
        if (array_key_exists('label', $entry) && !self::isContent($entry['label'])) {
            self::expected('behavior.' . $event . '.label', $path, self::CONTENT);
        }
        if (array_key_exists('script', $entry) && !is_string($entry['script'])) {
            self::expected('behavior.' . $event . '.script', $path, 'a string');
        }
    }

    /** Check one list or detail action at actions.<name>. */
    private static function action(string $name, mixed $action): void
    {
        if (is_string($action)) {
            return;
        }
        if (!Value::isObject($action)) {
            self::expected($name, 'actions', 'a script or an object');
        }
        $path = 'actions.' . $name;
        $action = (array) $action;
        if (array_key_exists('script', $action)) {
            self::closed($action, '', self::SCRIPT_ACTION_KEYS, $path);
            if (array_key_exists('label', $action) && !self::isContent($action['label'])) {
                self::expected('label', $path, self::CONTENT);
            }
            if (!is_string($action['script'])) {
                self::expected('script', $path, 'a string');
            }
            return;
        }
        self::closed($action, '', self::ACTION_KEYS, $path);
        if (array_key_exists('label', $action) && !self::isContent($action['label'])) {
            self::expected('label', $path, self::CONTENT);
        }
        if (array_key_exists('format', $action)) {
            self::format($action['format'], $path);
        }
        if (array_key_exists('behavior', $action)) {
            $behavior = $action['behavior'];
            if (!is_bool($behavior) && !Value::isObject($behavior)) {
                self::expected('behavior', $path, 'a boolean or an object');
            }
            if (Value::isObject($behavior)) {
                self::closed((array) $behavior, 'behavior.', self::BEHAVIOR_KEYS, $path);
                foreach ((array) $behavior as $event => $entry) {
                    self::behaviorEntry((string) $event, $entry, $path);
                }
            }
        }
        if (array_key_exists('design', $action)) {
            Template::checkDesignDeclaration($action['design'], $path);
        }
    }

    /** Reject a wrong value type or an unknown key in the pagination declaration at $path. */
    private static function pagination(mixed $pagination, string $path): void
    {
        if (!is_bool($pagination) && !Value::isObject($pagination)) {
            self::expected('pagination', $path, 'a boolean or an object');
        }
        if (!Value::isObject($pagination)) {
            return;
        }
        $pagination = (array) $pagination;
        self::closed($pagination, 'pagination.', ['per_page', 'mode'], $path);
        if (array_key_exists('per_page', $pagination) && Lists::safeInteger($pagination['per_page'], 1) === null) {
            self::expected('pagination.per_page', $path, 'a positive integer');
        }
        if (array_key_exists('mode', $pagination) && !in_array($pagination['mode'], self::PAGINATION_MODES, true)) {
            self::expected('pagination.mode', $path, 'pages, offset, cursor or none');
        }
    }
}
