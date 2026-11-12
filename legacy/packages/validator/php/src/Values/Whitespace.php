<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Whitespace: exactly the code points with the Unicode White_Space property
 * (UnicodeData::WHITE_SPACE).
 * Trimming removes leading and trailing whitespace and nothing else.
 *
 * @internal
 */
final class Whitespace
{
    private static ?CodePointSet $set = null;

    /** The whitespace set, from the embedded Unicode data. */
    public static function set(): CodePointSet
    {
        return self::$set ??= CodePointSet::fromBounds(UnicodeData::WHITE_SPACE);
    }

    /** Whether a code point is whitespace. */
    public static function contains(int $codePoint): bool
    {
        return self::set()->contains($codePoint);
    }

    /** Remove leading and trailing whitespace from UTF-8 text. */
    public static function trim(string $text): string
    {
        $start = 0;
        $end = \strlen($text);
        while ($start < $end && ($width = self::leading($text, $start, $end)) > 0) {
            $start += $width;
        }
        while ($end > $start && ($width = self::trailing($text, $start, $end)) > 0) {
            $end -= $width;
        }
        return substr($text, $start, $end - $start);
    }

    /** Byte width of the whitespace code point starting at $offset, or 0. */
    private static function leading(string $text, int $offset, int $end): int
    {
        foreach ([1, 2, 3] as $width) {
            if ($offset + $width <= $end && self::encodesWhitespace(substr($text, $offset, $width))) {
                return $width;
            }
        }
        return 0;
    }

    /** Byte width of the whitespace code point ending at $end, or 0. */
    private static function trailing(string $text, int $start, int $end): int
    {
        foreach ([1, 2, 3] as $width) {
            if ($end - $width >= $start && self::encodesWhitespace(substr($text, $end - $width, $width))) {
                return $width;
            }
        }
        return 0;
    }

    /** Whether the bytes are exactly the UTF-8 encoding of one whitespace code point. */
    private static function encodesWhitespace(string $bytes): bool
    {
        $codePoint = Utf8::singleCodePoint($bytes);
        return $codePoint !== null && self::contains($codePoint);
    }
}
