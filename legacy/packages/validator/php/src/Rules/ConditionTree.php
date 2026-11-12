<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * Condition tree: a value passes when it is a group `{all: [...]}` or `{any: [...]}`, a field comparison
 * `{field, op, value}` or, under the parameter `judge`, a judged text `{judge}`, at most 32 levels deep
 * (schema.md, "Condition trees"). A JSON object is a stdClass or a non-empty associative array, a list a
 * list array. The check reads no level below the limit.
 *
 * @extends ParameterRule<bool>
 */
class ConditionTree extends ParameterRule
{
    /** The deepest level of a condition tree; the root condition is level 1 (CUSC-075). */
    private const DEPTH = 32;

    /** The operators of a field comparison (CUSC-073). */
    private const OPERATORS = ['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'in', 'has'];

    /**
     * Whether judged text is permitted: `true` permits none, `judge` permits it.
     *
     * @throws InvalidRuleParameter when the parameter is neither
     */
    protected function parameter(mixed $param): bool
    {
        return self::judges($param);
    }

    /**
     * Whether the parameter `$param` permits judged text; the parameter check of the rule (CUVR-068), which the
     * load check runs as well.
     *
     * @throws InvalidRuleParameter when the parameter is neither `true` nor `judge`
     */
    public static function judges(mixed $param): bool
    {
        if ($param !== true && $param !== 'judge') {
            throw new InvalidRuleParameter(
                InvalidRuleParameter::PARAMETER,
                'Invalid conditionTree parameter: expected true, false or judge',
            );
        }
        return $param === 'judge';
    }

    /** @param bool $parameter */
    protected function holds(mixed $value, mixed $parameter): bool
    {
        return self::isCondition($value, $parameter, 1);
    }

    /** Whether `$node`, at `$level`, is a condition; `$judge` permits judged text. */
    private static function isCondition(mixed $node, bool $judge, int $level): bool
    {
        $members = self::members($node);
        if ($level > self::DEPTH || $members === null) {
            return false;
        }
        $names = array_map('strval', array_keys($members));
        sort($names, SORT_STRING);
        if ($names === ['all'] || $names === ['any']) {
            $list = $members[$names[0]];
            if (!\is_array($list) || !array_is_list($list)) {
                return false;
            }
            foreach ($list as $item) {
                if (!self::isCondition($item, $judge, $level + 1)) {
                    return false;
                }
            }
            return true;
        }
        if ($names === ['field', 'op', 'value']) {
            $op = $members['op'];
            if (!self::isText($members['field']) || !\in_array($op, self::OPERATORS, true)) {
                return false;
            }
            $value = $members['value'];
            if ($op !== 'in') {
                return self::isScalar($value);
            }
            if (!\is_array($value) || !array_is_list($value)) {
                return false;
            }
            foreach ($value as $item) {
                if (!self::isScalar($item)) {
                    return false;
                }
            }
            return true;
        }
        return $names === ['judge'] && $judge && self::isText($members['judge']);
    }

    /**
     * The members of a JSON object, or null for any other value.
     *
     * @return array<array-key, mixed>|null
     */
    private static function members(mixed $node): ?array
    {
        if ($node instanceof \stdClass) {
            return get_object_vars($node);
        }
        if (\is_array($node) && $node !== [] && !array_is_list($node)) {
            return $node;
        }
        return null;
    }

    /** Whether a value is a string, a finite number or a boolean. */
    private static function isScalar(mixed $value): bool
    {
        return \is_string($value) || \is_bool($value) || \is_int($value) || (\is_float($value) && is_finite($value));
    }

    /** Whether a value is a string that is not empty after trimming. */
    private static function isText(mixed $value): bool
    {
        return \is_string($value) && Whitespace::trim($value) !== '';
    }
}
