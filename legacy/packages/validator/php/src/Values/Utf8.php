<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Code point access to UTF-8 text.
 *
 * @internal
 */
final class Utf8
{
    /**
     * Decode UTF-8 text into code points. With $surrogates, an encoded surrogate code
     * point (as in WTF-8) is decoded too, so a caller can reject it by its position.
     *
     * @return list<int>
     * @throws \InvalidArgumentException when the text is not valid UTF-8
     */
    public static function decode(string $text, bool $surrogates = false): array
    {
        $codePoints = [];
        $length = \strlen($text);
        $offset = 0;
        while ($offset < $length) {
            $width = self::sequenceWidth(\ord($text[$offset]));
            $codePoint = $width === 0 || $offset + $width > $length
                ? null
                : self::singleCodePoint(substr($text, $offset, $width), $surrogates);
            if ($codePoint === null) {
                throw new \InvalidArgumentException('Text must be valid UTF-8');
            }
            $codePoints[] = $codePoint;
            $offset += $width;
        }
        return $codePoints;
    }

    /**
     * Read the code point at $offset of valid UTF-8 text and advance $offset past it.
     *
     * @throws \InvalidArgumentException when the text is not valid UTF-8 there
     */
    public static function next(string $text, int &$offset): int
    {
        $lead = \ord($text[$offset]);
        if ($lead < 0x80) {
            $offset++;
            return $lead;
        }
        $width = self::sequenceWidth($lead);
        $codePoint = $width === 0 ? null : self::singleCodePoint(substr($text, $offset, $width));
        if ($codePoint === null) {
            throw new \InvalidArgumentException('Text must be valid UTF-8');
        }
        $offset += $width;
        return $codePoint;
    }

    /**
     * Count the code points of valid UTF-8 text.
     *
     * @throws \InvalidArgumentException when the text is not valid UTF-8
     */
    public static function length(string $text): int
    {
        if (preg_match('//u', $text) !== 1) {
            throw new \InvalidArgumentException('Text must be valid UTF-8');
        }
        $continuation = 0;
        foreach (count_chars($text, 1) as $byte => $count) {
            if ($byte >= 0x80 && $byte <= 0xBF) {
                $continuation += $count;
            }
        }
        return \strlen($text) - $continuation;
    }

    /**
     * The scalar value when the bytes are exactly one well-formed UTF-8 sequence, else
     * null. With $surrogates, an encoded surrogate code point is accepted as well.
     */
    public static function singleCodePoint(string $bytes, bool $surrogates = false): ?int
    {
        $length = \strlen($bytes);
        if ($length === 0 || self::sequenceWidth(\ord($bytes[0])) !== $length) {
            return null;
        }
        $lead = \ord($bytes[0]);
        if ($length === 1) {
            return $lead;
        }
        $codePoint = $lead & (0xFF >> ($length + 1));
        for ($index = 1; $index < $length; $index++) {
            $byte = \ord($bytes[$index]);
            if (($byte & 0xC0) !== 0x80) {
                return null;
            }
            $codePoint = ($codePoint << 6) | ($byte & 0x3F);
        }
        $minimum = [2 => 0x80, 3 => 0x800, 4 => 0x10000][$length];
        if (
            $codePoint < $minimum
            || $codePoint > 0x10FFFF
            || (!$surrogates && $codePoint >= 0xD800 && $codePoint <= 0xDFFF)
        ) {
            return null;
        }
        return $codePoint;
    }

    /** Sequence length announced by a lead byte, or 0 for a byte that cannot start one. */
    private static function sequenceWidth(int $lead): int
    {
        return match (true) {
            $lead < 0x80 => 1,
            $lead >= 0xC2 && $lead <= 0xDF => 2,
            $lead >= 0xE0 && $lead <= 0xEF => 3,
            $lead >= 0xF0 && $lead <= 0xF4 => 4,
            default => 0,
        };
    }
}
