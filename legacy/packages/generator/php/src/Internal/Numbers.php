<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;

/** Decimal display of binary64 values. */
final class Numbers
{
    /** Format a number with decimal and exponent thresholds matching the form model. */
    public static function string(int|float $number): string
    {
        // CURP-028: a number is the double that ECMAScript reads for it, so an integer beyond 2^53 is
        // written as its nearest double.
        if (is_int($number) && ($number > 9007199254740992 || $number < -9007199254740992)) {
            $number = (float) $number;
        }
        if ($number == 0) {
            return '0';
        }
        $raw = strtolower(json_encode($number, JSON_THROW_ON_ERROR));
        if (!str_contains($raw, 'e')) {
            return $raw;
        }
        [$mantissa, $exponent] = explode('e', $raw);
        $negative = str_starts_with($mantissa, '-');
        $mantissa = ltrim($mantissa, '-');
        $parts = explode('.', $mantissa);
        $digits = rtrim(implode('', $parts), '0');
        $position = strlen($parts[0]) + (int) $exponent;
        $sign = $negative ? '-' : '';
        if (abs($number) >= 1.0E-6 && abs($number) < 1.0E+21) {
            if ($position <= 0) {
                return $sign . '0.' . str_repeat('0', -$position) . $digits;
            }
            if ($position >= strlen($digits)) {
                return $sign . $digits . str_repeat('0', $position - strlen($digits));
            }
            return $sign . substr($digits, 0, $position) . '.' . substr($digits, $position);
        }
        $exp = $position - 1;
        return $sign
            . $digits[0]
            . (strlen($digits) > 1 ? '.' . substr($digits, 1) : '')
            . 'e'
            . ($exp >= 0 ? '+' : '')
            . $exp;
    }

    /** Truncate the precision and round the exact binary value; ties increase magnitude. */
    public static function fixed(float $number, int|float $decimals): string
    {
        $decimals = $decimals < 0 ? ceil($decimals) : floor($decimals);
        if (!is_finite($decimals) || $decimals < 0 || $decimals > 100) {
            throw new FormError('INVALID_FORM_INPUT', 'Number decimals must be between 0 and 100');
        }
        $decimals = (int) $decimals;
        if (abs($number) >= 1.0E+21) {
            return self::string($number);
        }
        $negative = $number < 0;
        $bits = unpack('J', pack('E', abs($number)))[1];
        $exponentBits = $bits >> 52 & 0x7ff;
        $significand = $bits & 0xfffffffffffff;
        if ($exponentBits !== 0) {
            $significand |= 1 << 52;
        }
        $exponent = ($exponentBits === 0 ? -1022 : $exponentBits - 1023) - 52 + $decimals;
        $integer = (string) $significand;
        for ($i = 0; $i < $decimals; $i++) {
            $integer = self::multiply($integer, 5);
        }
        if ($exponent >= 0) {
            for ($i = 0; $i < $exponent; $i++) {
                $integer = self::multiply($integer, 2);
            }
        } else {
            $remainder = 0;
            for ($i = 0; $i < -$exponent; $i++) {
                [$integer, $remainder] = self::divideTwo($integer);
            }
            if ($remainder === 1) {
                $integer = self::increment($integer);
            }
        }
        if ($decimals > 0) {
            $integer = str_pad($integer, $decimals + 1, '0', STR_PAD_LEFT);
            $integer = substr($integer, 0, -$decimals) . '.' . substr($integer, -$decimals);
        }
        return ($negative ? '-' : '') . $integer;
    }

    private static function multiply(string $digits, int $factor): string
    {
        $out = '';
        $carry = 0;
        for ($i = strlen($digits) - 1; $i >= 0; $i--) {
            $value = (int) $digits[$i] * $factor + $carry;
            $out = $value % 10 . $out;
            $carry = intdiv($value, 10);
        }
        return ($carry ? (string) $carry : '') . $out;
    }

    private static function divideTwo(string $digits): array
    {
        $out = '';
        $remainder = 0;
        for ($i = 0; $i < strlen($digits); $i++) {
            $value = $remainder * 10 + (int) $digits[$i];
            $out .= (string) intdiv($value, 2);
            $remainder = $value % 2;
        }
        return [ltrim($out, '0') ?: '0', $remainder];
    }

    private static function increment(string $digits): string
    {
        for ($i = strlen($digits) - 1; $i >= 0; $i--) {
            if ($digits[$i] !== '9') {
                $digits[$i] = (string) ((int) $digits[$i] + 1);
                return $digits;
            }
            $digits[$i] = '0';
        }
        return '1' . $digits;
    }
}
