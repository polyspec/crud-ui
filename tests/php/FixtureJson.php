<?php

declare(strict_types=1);

namespace Polyspec\CruduiTestSupport;

use Polyspec\Json\Kind;
use Polyspec\Json\Value;
use stdClass;

/**
 * Converts fixture JSON through the JSON extension polyspec_json, preserving unpaired surrogate text: a string that
 * holds an unpaired surrogate becomes WTF-8, the UTF-8 form of each of its code points.
 */
final class FixtureJson
{
    public static function decode(string $json): mixed
    {
        return self::native(\Polyspec\Json\parse($json));
    }

    private static function native(Value $value): mixed
    {
        return match ($value->kind()) {
            Kind::Null_ => null,
            Kind::Boolean => $value->booleanValue(),
            Kind::Number => json_decode($value->numberLiteral(), false, 512, JSON_THROW_ON_ERROR),
            Kind::String_ => self::text($value),
            Kind::Array_ => array_map(self::native(...), $value->items()),
            Kind::Object_ => self::object($value),
        };
    }

    private static function object(Value $value): stdClass
    {
        $object = new stdClass();
        foreach ($value->members() as $name => $member) {
            $object->{self::text($name)} = self::native($member);
        }
        return $object;
    }

    /** The UTF-8 text of a string value, or its WTF-8 text when it holds an unpaired surrogate. */
    private static function text(Value $value): string
    {
        $text = $value->stringText();
        if ($text !== null) {
            return $text;
        }
        $units = $value->stringUnits();
        $text = '';
        for ($index = 0, $count = count($units); $index < $count; $index++) {
            $point = $units[$index];
            $next = $units[$index + 1] ?? 0;
            if ($point >= 0xd800 && $point <= 0xdbff && $next >= 0xdc00 && $next <= 0xdfff) {
                $point = 0x10000 + (($point - 0xd800) << 10) + $next - 0xdc00;
                $index++;
            }
            $text .= self::utf8($point);
        }
        return $text;
    }

    private static function utf8(int $point): string
    {
        return match (true) {
            $point < 0x80 => chr($point),
            $point < 0x800 => chr(0xc0 | $point >> 6) . chr(0x80 | $point & 0x3f),
            $point < 0x10000 => chr(0xe0 | $point >> 12) . chr(0x80 | $point >> 6 & 0x3f) . chr(0x80 | $point & 0x3f),
            default => chr(0xf0 | $point >> 18) . chr(0x80 | $point >> 12 & 0x3f)
                . chr(0x80 | $point >> 6 & 0x3f) . chr(0x80 | $point & 0x3f),
        };
    }
}
