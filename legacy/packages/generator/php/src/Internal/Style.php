<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

/** Parse CSS declarations without splitting quoted or nested values. */
final class Style
{
    /** Read complete property and value pairs in declaration order. */
    public static function declarations(string $style): array
    {
        $out = [];
        $start = 0;
        $colon = null;
        $quote = null;
        $escape = false;
        $comment = false;
        $stack = [];
        $length = strlen($style);
        $finish = static function (int $end) use ($style, &$start, &$colon, &$out): void {
            if ($colon !== null) {
                $property = trim(preg_replace('~/\*.*?\*/~s', ' ', substr($style, $start, $colon - $start)));
                $value = trim(substr($style, $colon + 1, $end - $colon - 1));
                if ($property !== '' && $value !== '') {
                    $out[] = [$property, $value];
                }
            }
            $start = $end + 1;
            $colon = null;
        };
        for ($index = 0; $index < $length; $index++) {
            $char = $style[$index];
            $next = $index + 1 < $length ? $style[$index + 1] : '';
            if ($comment) {
                if ($char === '*' && $next === '/') {
                    $comment = false;
                    $index++;
                }
                continue;
            }
            if ($escape) {
                $escape = false;
                continue;
            }
            if ($char === '\\') {
                $escape = true;
                continue;
            }
            if ($quote !== null) {
                if ($char === $quote) {
                    $quote = null;
                }
                continue;
            }
            if ($char === '/' && $next === '*') {
                $comment = true;
                $index++;
                continue;
            }
            if ($char === '"' || $char === "'") {
                $quote = $char;
                continue;
            }
            if (in_array($char, ['(', '[', '{'], true)) {
                $stack[] = $char;
                continue;
            }
            if (in_array($char, [')', ']', '}'], true)) {
                if ($stack !== [] && end($stack) === [')' => '(', ']' => '[', '}' => '{'][$char]) {
                    array_pop($stack);
                }
                continue;
            }
            if ($stack !== []) {
                continue;
            }
            if ($char === ':' && $colon === null) {
                $colon = $index;
                continue;
            }
            if ($char === ';') {
                $finish($index);
            }
        }
        $finish($length);
        return $out;
    }

    /** Normalize declaration spacing while retaining values and duplicate properties. */
    public static function canonical(mixed $style): ?string
    {
        if (!is_string($style)) {
            return null;
        }
        $declarations = self::declarations($style);
        return $declarations
            ? implode('; ', array_map(static fn ($entry) => $entry[0] . ': ' . $entry[1], $declarations))
            : null;
    }

    /** Serialize final property values in their first insertion order. */
    public static function rendered(string $style): ?string
    {
        $properties = [];
        foreach (self::declarations($style) as [$property, $value]) {
            if (!str_starts_with($property, '--')) {
                $key = preg_replace_callback('/-([a-z])/', static fn ($match) => strtoupper($match[1]), $property);
                $property = preg_replace_callback('/[A-Z]/', static fn ($match) => '-' . strtolower($match[0]), $key);
                if (str_starts_with($property, 'ms-')) {
                    $property = '-' . $property;
                }
            }
            $properties[$property] = $value;
        }
        return $properties
            ? implode(
                ';',
                array_map(static fn ($key, $value) => $key . ':' . $value, array_keys($properties), $properties)
            )
            : null;
    }
}
