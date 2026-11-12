<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

use Polyspec\Crudui\Validator\Values\CodePointSet;
use Polyspec\Crudui\Validator\Values\UnicodeData;
use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * The shared code point sets of the pattern language, built once from the embedded
 * Unicode data.
 *
 * @internal
 */
final class PropertySets
{
    /** @var array<string, CodePointSet> */
    private static array $sets = [];

    /** A general category by name, or null when the language has no such category. */
    public static function category(string $name): ?CodePointSet
    {
        $bounds = UnicodeData::GENERAL_CATEGORIES[$name] ?? null;
        if ($bounds === null) {
            return null;
        }
        return self::$sets["gc:$name"] ??= CodePointSet::fromBounds($bounds);
    }

    /** A script by name, or null when the Unicode data has no such script. */
    public static function script(string $name): ?CodePointSet
    {
        $bounds = UnicodeData::SCRIPTS[$name] ?? null;
        if ($bounds === null) {
            return null;
        }
        return self::$sets["sc:$name"] ??= CodePointSet::fromBounds($bounds);
    }

    /**
     * `\d` = [0-9], `\w` = [0-9A-Za-z_], `\s` = whitespace.
     *
     * @param string $letter d, w or s
     */
    public static function shorthand(string $letter): CodePointSet
    {
        return self::$sets["shorthand:$letter"] ??= match ($letter) {
            'd' => CodePointSet::fromBounds([0x30, 0x39]),
            'w' => CodePointSet::fromBounds([0x30, 0x39, 0x41, 0x5A, 0x5F, 0x5F, 0x61, 0x7A]),
            's' => Whitespace::set(),
        };
    }

    /** The complement of a set, kept for sets that are reused. */
    public static function complement(string $key, CodePointSet $set): CodePointSet
    {
        return self::$sets["not:$key"] ??= $set->complement();
    }

    /** `.`: every code point except U+000A. */
    public static function any(): CodePointSet
    {
        return self::$sets['any'] ??= CodePointSet::fromBounds([0x0A, 0x0A])->complement();
    }
}
