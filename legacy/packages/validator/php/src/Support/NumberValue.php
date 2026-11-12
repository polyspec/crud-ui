<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Support;

/** Parse decimal and radix strings using binary64 number conversion. */
final class NumberValue
{
    /** Return the parsed number, or null when the complete string is not numeric. */
    public static function parseString(string $value): ?float
    {
        $whitespace = '\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}'
            . '\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';
        $value = preg_replace('/^[' . $whitespace . ']+|[' . $whitespace . ']+$/u', '', $value);
        if ($value === '') {
            return 0.0;
        }
        if (in_array($value, ['Infinity', '+Infinity', '-Infinity'], true)) {
            return $value === '-Infinity' ? -INF : INF;
        }
        if (preg_match('/^0([xbo])([0-9a-f]+)$/iD', $value, $match)) {
            $base = strtolower($match[1]);
            $digits = strtolower($match[2]);
            $width = ['x' => 4, 'b' => 1, 'o' => 3][$base];
            $alphabet = substr('0123456789abcdef', 0, 1 << $width);
            if (strspn($digits, $alphabet) !== strlen($digits)) {
                return null;
            }
            $bits = '';
            foreach (str_split($digits) as $digit) {
                $bits .= str_pad(decbin(strpos($alphabet, $digit)), $width, '0', STR_PAD_LEFT);
            }
            $bits = ltrim($bits, '0');
            $length = strlen($bits);
            if ($length <= 53) {
                return (float) bindec($bits);
            }
            $significand = bindec(substr($bits, 0, 53));
            $round = $bits[53] === '1';
            $remainder = str_contains(substr($bits, 54), '1');
            if ($round && ($remainder || fmod((float) $significand, 2.0) !== 0.0)) {
                $significand++;
            }
            return (float) $significand * 2 ** ($length - 53);
        }
        if (!preg_match('/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/D', $value)) {
            return null;
        }
        return (float) $value;
    }
}
