<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * A set of code points: sorted, disjoint, non-adjacent inclusive ranges stored as a
 * flat list of bounds (start, end, start, end, …), with binary-search membership.
 *
 * @internal
 */
final class CodePointSet
{
    /** Largest code point. */
    public const MAXIMUM = 0x10FFFF;

    /** @param list<int> $bounds normalized flat bounds */
    private function __construct(private readonly array $bounds)
    {
    }

    /**
     * A set from flat inclusive bounds in any order, overlapping or not.
     *
     * @param list<int> $bounds start, end, start, end, …
     */
    public static function fromBounds(array $bounds): self
    {
        $ranges = [];
        for ($index = 0, $count = \count($bounds); $index + 1 < $count; $index += 2) {
            $ranges[] = [$bounds[$index], $bounds[$index + 1]];
        }
        usort($ranges, static fn (array $left, array $right) => $left[0] <=> $right[0]);
        $merged = [];
        foreach ($ranges as [$start, $end]) {
            $last = \count($merged) - 1;
            if ($last > 0 && $start <= $merged[$last] + 1) {
                $merged[$last] = max($merged[$last], $end);
            } else {
                $merged[] = $start;
                $merged[] = $end;
            }
        }
        return new self($merged);
    }

    /** The union of sets. */
    public static function union(self ...$sets): self
    {
        return self::fromBounds(array_merge(...array_map(static fn (self $set) => $set->bounds, $sets)));
    }

    /** Every code point outside this set. */
    public function complement(): self
    {
        $bounds = [];
        $next = 0;
        for ($index = 0, $count = \count($this->bounds); $index < $count; $index += 2) {
            if ($this->bounds[$index] > $next) {
                $bounds[] = $next;
                $bounds[] = $this->bounds[$index] - 1;
            }
            $next = $this->bounds[$index + 1] + 1;
        }
        if ($next <= self::MAXIMUM) {
            $bounds[] = $next;
            $bounds[] = self::MAXIMUM;
        }
        return new self($bounds);
    }

    /** Whether the set contains a code point. */
    public function contains(int $codePoint): bool
    {
        $low = 0;
        $high = (\count($this->bounds) >> 1) - 1;
        while ($low <= $high) {
            $middle = ($low + $high) >> 1;
            if ($codePoint < $this->bounds[$middle << 1]) {
                $high = $middle - 1;
            } elseif ($codePoint > $this->bounds[($middle << 1) + 1]) {
                $low = $middle + 1;
            } else {
                return true;
            }
        }
        return false;
    }

    /**
     * The normalized flat bounds.
     *
     * @return list<int>
     */
    public function bounds(): array
    {
        return $this->bounds;
    }
}
