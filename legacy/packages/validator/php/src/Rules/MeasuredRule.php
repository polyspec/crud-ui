<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

/**
 * A rule on a measure of the value (its number, its length or its count): a value without a measure fails, and the
 * rule decides for a measure.
 *
 * @template P
 * @extends ParameterRule<P>
 */
abstract class MeasuredRule extends ParameterRule
{
    /**
     * @param P $parameter
     */
    final protected function holds(mixed $value, mixed $parameter): bool
    {
        $measure = $this->measure($value);
        return $measure !== null && $this->accepts($measure, $parameter);
    }

    /** The measure of the value, or null for a value without one. */
    abstract protected function measure(mixed $value): int|float|null;

    /**
     * Whether the measure is accepted under the parameter.
     *
     * @param P $parameter
     */
    abstract protected function accepts(int|float $measure, mixed $parameter): bool;

    /**
     * Whether the measure lies within the inclusive range.
     *
     * @param array{int|float, int|float} $range the minimum and the maximum
     */
    final protected static function within(int|float $measure, array $range): bool
    {
        return $measure >= $range[0] && $measure <= $range[1];
    }
}
