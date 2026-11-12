<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

/**
 * A quantified atom or group. Laziness is not kept: only whole values are matched,
 * so a lazy quantifier matches the same values as its greedy form.
 *
 * @internal
 */
final class Repeat implements Node
{
    private readonly int $size;

    /**
     * @param Node $item the repeated atom or group
     * @param int $minimum the lower bound
     * @param int|null $maximum the upper bound, or null when unbounded
     */
    public function __construct(
        public readonly Node $item,
        public readonly int $minimum,
        public readonly ?int $maximum,
    ) {
        $this->size = PatternParser::capSize($item->size() * ($maximum ?? $minimum + 1));
    }

    /** The item's size times the maximum, or times the minimum plus one when unbounded. */
    public function size(): int
    {
        return $this->size;
    }
}
