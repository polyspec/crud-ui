<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * Write a finite double as ECMAScript Number.prototype.toString does: the fewest
 * significant digits that read back as the same double (the closest such digits
 * when several exist), plain notation for magnitudes from 10^-6 up to below 10^21,
 * exponent notation otherwise, and `0` for both zeros.
 *
 * The digits come from PHP's correctly rounded `%.Ne` conversion and PHP's correctly
 * rounded string-to-double conversion, so neither `precision` nor
 * `serialize_precision` affects the result.
 *
 * @internal
 */
final class NumberText
{
    /** @throws \InvalidArgumentException for NaN or an infinity */
    public static function of(float $number): string
    {
        if (!is_finite($number)) {
            throw new \InvalidArgumentException('Only finite numbers have canonical text');
        }
        if ($number == 0.0) {
            return '0';
        }
        $sign = $number < 0 ? '-' : '';
        [$digits, $exponent] = self::shortest(abs($number));
        return $sign . self::layout($digits, $exponent + 1);
    }

    /**
     * The decimal a positive finite double's canonical text writes, as an integer
     * significand of at most 17 digits and a power of ten.
     *
     * @return array{int, int} significand and exponent: the number is significand × 10^exponent
     */
    public static function decimal(float $number): array
    {
        if (!is_finite($number) || $number <= 0.0) {
            throw new \InvalidArgumentException('Only positive finite numbers have a decimal significand');
        }
        [$digits, $exponent] = self::shortest($number);
        return [(int) $digits, $exponent - (\strlen($digits) - 1)];
    }

    /**
     * Shortest round-trip significant digits of a positive finite double.
     *
     * @return array{string, int} digits without trailing zeros, and the decimal exponent of the first digit
     */
    private static function shortest(float $number): array
    {
        for ($precision = 1; $precision <= 17; $precision++) {
            [$digits, $exponent] = self::rounded($number, $precision);
            if (self::read($digits, $exponent) === $number) {
                return self::stripped($digits, $exponent);
            }
            // The correctly rounded digits miss, but the decimal on the other side of
            // the number may still read back when the rounding interval is asymmetric.
            $other = self::read($digits, $exponent) > $number
                ? self::step($digits, $exponent, -1)
                : self::step($digits, $exponent, 1);
            if (self::read($other[0], $other[1]) === $number) {
                return self::stripped($other[0], $other[1]);
            }
        }
        throw new \LogicException('No 17-digit decimal reads back as ' . sprintf('%.17e', $number));
    }

    /**
     * Correctly rounded significant digits at a precision.
     *
     * @return array{string, int}
     */
    private static function rounded(float $number, int $precision): array
    {
        $text = sprintf('%.' . ($precision - 1) . 'e', $number);
        if (preg_match('/^([0-9])(?:\.([0-9]+))?e([+-][0-9]+)$/D', $text, $match) !== 1) {
            throw new \LogicException('Unexpected exponent text: ' . $text);
        }
        return [$match[1] . ($match[2] ?? ''), (int) $match[3]];
    }

    /** The double a digit string reads as. */
    private static function read(string $digits, int $exponent): float
    {
        return (float) ($digits[0] . '.' . substr($digits, 1) . 'e' . $exponent);
    }

    /**
     * The adjacent decimal with the same number of significant digits.
     *
     * @return array{string, int}
     */
    private static function step(string $digits, int $exponent, int $direction): array
    {
        $width = \strlen($digits);
        $value = $digits;
        $index = $width - 1;
        if ($direction > 0) {
            while ($index >= 0 && $value[$index] === '9') {
                $value[$index] = '0';
                $index--;
            }
            if ($index < 0) {
                return ['1' . substr($value, 0, $width - 1), $exponent + 1];
            }
            $value[$index] = (string) ((int) $value[$index] + 1);
            return [$value, $exponent];
        }
        while ($index >= 0 && $value[$index] === '0') {
            $value[$index] = '9';
            $index--;
        }
        $value[$index] = (string) ((int) $value[$index] - 1);
        if ($value[0] !== '0') {
            return [$value, $exponent];
        }
        // Below a power of ten the adjacent decimal is all nines one place lower.
        return [str_repeat('9', $width), $exponent - 1];
    }

    /**
     * Remove trailing zeros.
     *
     * @return array{string, int}
     */
    private static function stripped(string $digits, int $exponent): array
    {
        $trimmed = rtrim($digits, '0');
        return [$trimmed === '' ? '0' : $trimmed, $exponent];
    }

    /** Number::toString layout for digits s with k digits and position n. */
    private static function layout(string $digits, int $position): string
    {
        $count = \strlen($digits);
        if ($count <= $position && $position <= 21) {
            return $digits . str_repeat('0', $position - $count);
        }
        if (0 < $position && $position <= 21) {
            return substr($digits, 0, $position) . '.' . substr($digits, $position);
        }
        if (-6 < $position && $position <= 0) {
            return '0.' . str_repeat('0', -$position) . $digits;
        }
        $power = $position - 1;
        $exponent = 'e' . ($power < 0 ? '-' : '+') . abs($power);
        return $count === 1 ? $digits . $exponent : $digits[0] . '.' . substr($digits, 1) . $exponent;
    }
}
