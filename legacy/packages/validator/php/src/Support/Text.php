<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Support;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use stdClass;

/**
 * Input text checks (docs/spec/input-text.md). Every string and object member name of a
 * specification, a composition file and caller data is valid UTF-8, the PHP form of a sequence
 * of Unicode scalar values. Invalid text is rejected before any other check of an operation; it
 * is never replaced and never passed on.
 */
final class Text
{
    /** Message of every input text failure. */
    public const MESSAGE = 'Text must be Unicode scalar values';

    /** Whether a string is valid UTF-8 without encoded surrogates. */
    public static function isScalar(string $text): bool
    {
        return preg_match('//u', $text) === 1;
    }

    /** Message of every value beyond the limits of a value. */
    public const LIMIT_MESSAGE = 'Recursive or excessively nested value';

    /** Levels of arrays and objects a value may nest, the value itself included. */
    public const NESTING_LIMIT = 512;

    /** Nodes a value may hold: every array, object, string, number, boolean and null, itself included. */
    public const NODE_LIMIT = 1000000;

    /**
     * The first failure in a value, walked as the tree it denotes: the path of its first invalid
     * text, false when the value is beyond its limits there, or null when there is no failure.
     * Invalid text is located at the path of its string, or of the object whose member name is
     * invalid. Members are visited in code point order of their names, which is the byte order of
     * UTF-8, and list items in index order. A value that nests more than NESTING_LIMIT levels or
     * holds more than NODE_LIMIT nodes is beyond its limits. A shared array or object is walked at
     * each place, so the limits bound every walk, including one around a reference or an object
     * that contains itself.
     *
     * @return list<string>|false|null
     */
    public static function failure(mixed $value): array|false|null
    {
        $nodes = 0;
        if (!self::holds($value, 0, $nodes)) {
            return null;
        }
        $nodes = 0;
        return self::first($value, [], 0, $nodes);
    }

    /**
     * The levels of arrays and objects that a value nests, the value itself the first, and the
     * nodes it holds, counted as the limits count them.
     *
     * @return array{int, int}
     */
    public static function size(mixed $value): array
    {
        $levels = 0;
        $nodes = 0;
        self::measure($value, 1, $levels, $nodes);
        return [$levels, $nodes];
    }

    /** Count a checked value depth-first without retaining all siblings in a pending list. */
    private static function measure(mixed $value, int $level, int &$levels, int &$nodes): void
    {
        ++$nodes;
        if ($value instanceof stdClass || is_array($value)) {
            $levels = max($levels, $level);
            foreach ($value as $child) {
                self::measure($child, $level + 1, $levels, $nodes);
            }
        }
    }

    /** Count a node at $depth; false when it takes the value beyond its limits. */
    private static function admit(mixed $value, int $depth, int &$nodes): bool
    {
        return ++$nodes <= self::NODE_LIMIT
            && ($depth < self::NESTING_LIMIT || !$value instanceof stdClass && !is_array($value));
    }

    /** Whether a value holds a failure; a quick walk in member order before the ordered one. */
    private static function holds(mixed $value, int $depth, int &$nodes): bool
    {
        if (!self::admit($value, $depth, $nodes)) {
            return true;
        }
        if (is_string($value)) {
            return !self::isScalar($value);
        }
        if (!$value instanceof stdClass && !is_array($value)) {
            return false;
        }
        foreach ($value as $key => $child) {
            if (is_string($key) && !self::isScalar($key) || self::holds($child, $depth + 1, $nodes)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param list<string> $path
     * @return list<string>|false|null
     */
    private static function first(mixed $value, array $path, int $depth, int &$nodes): array|false|null
    {
        if (!self::admit($value, $depth, $nodes)) {
            return false;
        }
        if (is_string($value)) {
            return self::isScalar($value) ? null : $path;
        }
        if (!$value instanceof stdClass && !is_array($value)) {
            return null;
        }
        if (is_array($value) && array_is_list($value)) {
            foreach ($value as $index => $child) {
                $found = self::first($child, [...$path, (string) $index], $depth + 1, $nodes);
                if ($found !== null) {
                    return $found;
                }
            }
            return null;
        }
        $members = [];
        foreach ($value as $key => $child) {
            $name = (string) $key;
            if (!self::isScalar($name)) {
                return $path;
            }
            $members[] = [$name, $child];
        }
        usort($members, static fn (array $left, array $right): int => strcmp($left[0], $right[0]));
        foreach ($members as [$name, $child]) {
            $found = self::first($child, [...$path, $name], $depth + 1, $nodes);
            if ($found !== null) {
                return $found;
            }
        }
        return null;
    }

    /**
     * Check a specification and then the composition files an operation reads. Invalid text is
     * the INVALID_TEXT load failure located at its specification path, or at the file name
     * followed by its path in the file; an invalid file name is located at the empty path. A
     * value beyond its limits is an input failure, whose message naming spec or files is
     * returned; null when both pass.
     */
    public static function specificationFailure(mixed $spec, mixed $files): ?string
    {
        foreach (['spec' => $spec, 'files' => $files] as $name => $value) {
            $failure = self::failure($value);
            if ($failure === false) {
                return self::LIMIT_MESSAGE . ': ' . $name;
            }
            if ($failure !== null) {
                throw new ComposeLoadError('INVALID_TEXT', self::MESSAGE, $failure);
            }
        }
        return null;
    }

    /**
     * The failure message of the first invalid text among named caller values, which names the
     * value and its path, or of the first value beyond its limits, which names the value; null
     * when every value passes.
     *
     * @param list<array{0: string, 1: mixed}> $inputs
     */
    public static function inputFailure(array $inputs): ?string
    {
        foreach ($inputs as [$name, $value]) {
            $failure = self::failure($value);
            if ($failure === false) {
                return self::LIMIT_MESSAGE . ': ' . $name;
            }
            if ($failure !== null) {
                return self::MESSAGE . ': ' . implode('.', [$name, ...$failure]);
            }
        }
        return null;
    }

    /**
     * The present options named in $names, given in code point order, as named inputs.
     *
     * @param list<string> $names
     * @return list<array{0: string, 1: mixed}>
     */
    public static function options(array $options, array $names): array
    {
        $inputs = [];
        foreach ($names as $name) {
            if (array_key_exists($name, $options)) {
                $inputs[] = ['options.' . $name, $options[$name]];
            }
        }
        return $inputs;
    }
}
