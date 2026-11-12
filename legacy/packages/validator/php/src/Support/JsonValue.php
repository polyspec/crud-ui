<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Support;

use stdClass;

/** Preserve JSON object and array types when accepting PHP values. */
final class JsonValue
{
    /** Copy a root object, accepting an empty PHP array for the root. */
    public static function object(array|stdClass $value): stdClass
    {
        if (is_array($value) && $value !== [] && array_is_list($value)) {
            throw new \TypeError('Expected an object');
        }
        return self::copy((object) $value);
    }

    /**
     * Copy JSON values and reject unsupported values or invalid UTF-8 strings and keys. A copy
     * stops at the value limits of Text: a shared array is copied at each place, so the limits
     * bound a value that denotes a large tree or contains itself through a reference.
     */
    public static function copy(mixed $value): mixed
    {
        $nodes = 0;
        return self::copyValue($value, 0, $nodes);
    }

    /**
     * Copy a specification value in specification member order: every object lists array-index
     * member names (canonical decimal integers 0..4294967294) first in ascending numeric order,
     * then all other names in insertion order. Objects become stdClass values; lists stay lists.
     */
    public static function ordered(mixed $value): mixed
    {
        $nodes = 0;
        return self::order($value, 0, false, $nodes);
    }

    /** Copy a root specification object in specification member order. */
    public static function orderedObject(array|stdClass $value): stdClass
    {
        return self::ordered(self::object($value));
    }

    /**
     * Order a structural member map in specification member order, keeping it a PHP array keyed
     * by member name; nested stdClass values and PHP associative arrays keep their own types.
     */
    public static function orderedMembers(array $members): array
    {
        $nodes = 0;
        return (array) self::order((object) $members, 0, true, $nodes);
    }

    /** Count a node at $depth, or reject a value beyond the limits of Text. */
    private static function admit(mixed $value, int $depth, int &$nodes): void
    {
        if (
            ++$nodes > Text::NODE_LIMIT
            || $depth >= Text::NESTING_LIMIT
            && ($value instanceof stdClass || is_array($value))
        ) {
            throw new \InvalidArgumentException('Recursive or excessively nested PHP value');
        }
    }

    private static function copyValue(mixed $value, int $depth, int &$nodes): mixed
    {
        self::admit($value, $depth, $nodes);
        if ($value instanceof stdClass || is_array($value)) {
            $object = $value instanceof stdClass || !array_is_list($value);
            $out = $object ? new stdClass() : [];
            foreach ($value as $key => $child) {
                if (is_string($key) && preg_match('//u', $key) !== 1) {
                    throw new \InvalidArgumentException('Object keys must contain valid UTF-8');
                }
                $child = self::copyValue($child, $depth + 1, $nodes);
                if ($object) {
                    $out->{(string) $key} = $child;
                } else {
                    $out[] = $child;
                }
            }
            return $out;
        }
        if (is_string($value) && preg_match('//u', $value) !== 1) {
            throw new \InvalidArgumentException('Strings must contain valid UTF-8');
        }
        if (
            $value === null
            || is_string($value)
            || is_bool($value)
            || is_int($value)
            || is_float($value)
            && is_finite($value)
        ) {
            return $value;
        }
        throw new \InvalidArgumentException('Unsupported PHP value: ' . get_debug_type($value));
    }

    /** Order objects recursively; $arrays keeps nested associative arrays as arrays. */
    private static function order(mixed $value, int $depth, bool $arrays, int &$nodes): mixed
    {
        if (!$value instanceof stdClass && !is_array($value)) {
            return self::copyValue($value, $depth, $nodes);
        }
        self::admit($value, $depth, $nodes);
        if (is_array($value) && array_is_list($value)) {
            $out = [];
            foreach ($value as $child) {
                $out[] = self::order($child, $depth + 1, $arrays, $nodes);
            }
            return $out;
        }
        $indexes = [];
        $names = [];
        foreach ($value as $key => $child) {
            $name = (string) $key;
            if (is_string($key) && preg_match('//u', $key) !== 1) {
                throw new \InvalidArgumentException('Object keys must contain valid UTF-8');
            }
            if (self::isArrayIndex($name)) {
                $indexes[$name] = $child;
            } else {
                $names[$name] = $child;
            }
        }
        uksort($indexes, static fn ($left, $right) => (int) $left <=> (int) $right);
        $keepArray = $arrays && is_array($value);
        $out = $keepArray ? [] : new stdClass();
        foreach ([$indexes, $names] as $members) {
            foreach ($members as $name => $child) {
                $child = self::order($child, $depth + 1, $arrays, $nodes);
                if ($keepArray) {
                    $out[(string) $name] = $child;
                } else {
                    $out->{(string) $name} = $child;
                }
            }
        }
        return $out;
    }

    /** Whether a member name is an array index: a canonical decimal integer 0..4294967294. */
    public static function isArrayIndex(string $name): bool
    {
        return preg_match('/^(?:0|[1-9][0-9]{0,9})$/D', $name) === 1 && (int) $name <= 4294967294;
    }

    /** Identify explicit JSON objects and PHP associative arrays. */
    public static function isObject(mixed $value): bool
    {
        return $value instanceof stdClass || is_array($value) && !array_is_list($value);
    }

    /** Return a structural map without converting its child values. */
    public static function members(mixed $value): array
    {
        return $value instanceof stdClass || is_array($value) ? (array) $value : [];
    }
}
