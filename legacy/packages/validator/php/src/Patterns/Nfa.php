<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

use Polyspec\Crudui\Validator\Values\CodePointSet;
use Polyspec\Crudui\Validator\Values\Utf8;

/**
 * A Thompson NFA that matches whole texts. It is simulated state set by state set:
 * time is proportional to the text length times the number of states, and memory to
 * the number of states.
 *
 * @internal
 */
final class Nfa
{
    /** Consumes one code point of `set` and continues at `next`. */
    public const CHAR = 0;

    /** Continues at both `next` and `alternative`. */
    public const SPLIT = 1;

    /** Continues at `next` without reading a code point. */
    public const EPSILON = 2;

    /** Accepts. */
    public const MATCH = 3;

    /**
     * @param list<int> $kinds state kinds
     * @param list<int> $setIndexes index into $sets of each CHAR state, else -1
     * @param list<int> $next first successor of each state, else -1
     * @param list<int> $alternatives second successor of each SPLIT state, else -1
     * @param list<CodePointSet> $sets the distinct sets of the pattern
     * @param int $start the start state
     */
    public function __construct(
        private readonly array $kinds,
        private readonly array $setIndexes,
        private readonly array $next,
        private readonly array $alternatives,
        private readonly array $sets,
        private readonly int $start,
    ) {
    }

    /** The number of states. */
    public function stateCount(): int
    {
        return \count($this->kinds);
    }

    /**
     * Whether the whole UTF-8 text is accepted.
     *
     * @throws \InvalidArgumentException when the text is not valid UTF-8
     */
    public function matches(string $text): bool
    {
        $marks = array_fill(0, \count($this->kinds), -1);
        $generation = 0;
        $states = $this->closure([$this->start], $marks, $generation);
        $length = \strlen($text);
        $offset = 0;
        while ($offset < $length) {
            $codePoint = Utf8::next($text, $offset);
            $generation++;
            $members = [];
            $targets = [];
            foreach ($states as $state) {
                if ($this->kinds[$state] !== self::CHAR) {
                    continue;
                }
                $index = $this->setIndexes[$state];
                $member = $members[$index] ??= $this->sets[$index]->contains($codePoint);
                if ($member) {
                    $targets[] = $this->next[$state];
                }
            }
            if ($targets === []) {
                return false;
            }
            $states = $this->closure($targets, $marks, $generation);
        }
        foreach ($states as $state) {
            if ($this->kinds[$state] === self::MATCH) {
                return true;
            }
        }
        return false;
    }

    /**
     * The CHAR and MATCH states reachable from $roots without reading input.
     *
     * @param list<int> $roots
     * @param list<int> $marks generation of the last visit of each state
     * @return list<int>
     */
    private function closure(array $roots, array &$marks, int $generation): array
    {
        $states = [];
        $stack = array_reverse($roots);
        while ($stack !== []) {
            $state = array_pop($stack);
            if ($marks[$state] === $generation) {
                continue;
            }
            $marks[$state] = $generation;
            switch ($this->kinds[$state]) {
                case self::SPLIT:
                    $stack[] = $this->alternatives[$state];
                    $stack[] = $this->next[$state];
                    break;
                case self::EPSILON:
                    $stack[] = $this->next[$state];
                    break;
                default:
                    $states[] = $state;
            }
        }
        return $states;
    }
}
