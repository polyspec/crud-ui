<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison;

use InvalidArgumentException;
use Polyspec\Json\Kind;
use Polyspec\Json\OrderedMap;
use Polyspec\Json\Value;
use stdClass;

/** Convert the JSON values of the extension polyspec_json to objects, arrays and scalar values. */
final class FormJson
{
    public static function decode(string $source): mixed
    {
        // The loaded extensions must match the verified PHP server mode.
        ServerMode::current();
        return self::data(\Polyspec\Json\parse($source));
    }

    public static function encode(mixed $data): string
    {
        return \Polyspec\Json\stringify(self::value($data));
    }

    /** Convert objects only after request shape validation has completed. */
    public static function arrays(mixed $data): mixed
    {
        if ($data instanceof stdClass) {
            $data = get_object_vars($data);
        }
        return is_array($data) ? array_map(self::arrays(...), $data) : $data;
    }

    /** Write one number as JavaScript's Number to String conversion writes it. */
    public static function numberText(int|float $number): string
    {
        if (is_int($number)) {
            return (string) $number;
        }
        if (!is_finite($number)) {
            throw new InvalidArgumentException('JSON numbers are finite');
        }
        if ($number == 0.0) {
            return '0';
        }
        $magnitude = abs($number);
        // The shortest scientific form that reads back as the same binary64 value.
        for ($precision = 0; $precision < 17; $precision++) {
            $scientific = sprintf('%.' . $precision . 'e', $magnitude);
            if ((float) $scientific === $magnitude) {
                break;
            }
        }
        [$mantissa, $exponent] = explode('e', $scientific);
        $digits = str_replace('.', '', $mantissa);
        $count = strlen($digits);
        $point = (int) $exponent + 1;
        $sign = $number < 0 ? '-' : '';
        if ($count <= $point && $point <= 21) {
            return $sign . $digits . str_repeat('0', $point - $count);
        }
        if (0 < $point && $point <= 21) {
            return $sign . substr($digits, 0, $point) . '.' . substr($digits, $point);
        }
        if (-6 < $point && $point <= 0) {
            return $sign . '0.' . str_repeat('0', -$point) . $digits;
        }
        $power = $point - 1;
        return $sign . $digits[0] . ($count > 1 ? '.' . substr($digits, 1) : '')
            . 'e' . ($power < 0 ? '-' : '+') . abs($power);
    }

    private static function data(Value $value): mixed
    {
        return match ($value->kind()) {
            Kind::Object_ => self::object($value->members()),
            Kind::Array_ => array_map(self::data(...), $value->items()),
            Kind::String_ => $value->stringValue(),
            Kind::Boolean => $value->booleanValue(),
            Kind::Number => self::number($value->numberLiteral()),
            Kind::Null_ => null,
        };
    }

    private static function object(OrderedMap $members): stdClass
    {
        $object = new stdClass();
        foreach ($members as $name => $member) {
            $object->{$name->stringValue()} = self::data($member);
        }
        return $object;
    }

    private static function number(string $literal): int|float
    {
        $number = strpbrk($literal, '.eE') === false
            ? filter_var($literal, FILTER_VALIDATE_INT) : (float) $literal;
        if ($number === false || !is_finite((float) $number) || abs($number) > 9007199254740991) {
            throw new InvalidArgumentException('JSON number exceeds the form data range');
        }
        return $number;
    }

    private static function value(mixed $data): Value
    {
        if ($data === null) {
            return Value::null();
        }
        if (is_string($data)) {
            return Value::string($data);
        }
        if (is_bool($data)) {
            return Value::boolean($data);
        }
        if (is_int($data) || is_float($data)) {
            $literal = self::numberText($data);
            self::number($literal);
            return Value::number($literal);
        }
        if ($data instanceof stdClass) {
            return self::members(get_object_vars($data));
        }
        if (is_array($data)) {
            return array_is_list($data) ? Value::array(array_map(self::value(...), $data)) : self::members($data);
        }
        throw new InvalidArgumentException('Expected JSON form data');
    }

    /** @param array<array-key, mixed> $data */
    private static function members(array $data): Value
    {
        $members = new OrderedMap();
        foreach ($data as $name => $item) {
            $members->insert(Value::string((string) $name), self::value($item));
        }
        return Value::object($members);
    }
}
