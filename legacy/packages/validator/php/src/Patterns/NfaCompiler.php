<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

use Polyspec\Crudui\Validator\Values\CodePointSet;

/**
 * Compile a recognized pattern to a Thompson NFA. Bounded repetition copies the
 * item's fragment: the required copies, then the optional copies, or one loop when
 * unbounded. An item of size 0 matches only the empty text and compiles to one
 * EPSILON whatever its quantifier. Copies of one atom share its set.
 *
 * @internal
 */
final class NfaCompiler
{
    /** @var list<int> */
    private array $kinds = [];

    /** @var list<int> */
    private array $setIndexes = [];

    /** @var list<int> */
    private array $next = [];

    /** @var list<int> */
    private array $alternatives = [];

    /** @var list<CodePointSet> */
    private array $sets = [];

    /** @var array<int, int> set index by set object id */
    private array $setIds = [];

    /** Compile a pattern body. */
    public static function compile(Alternation $pattern): Nfa
    {
        $compiler = new self();
        [$start, $holes] = $compiler->node($pattern);
        $match = $compiler->state(Nfa::MATCH);
        $compiler->patch($holes, $match);
        return new Nfa(
            $compiler->kinds,
            $compiler->setIndexes,
            $compiler->next,
            $compiler->alternatives,
            $compiler->sets,
            $start
        );
    }

    /**
     * A fragment: its start state and the unset successor slots ([state, slot]) that
     * continue after it.
     *
     * @return array{int, list<array{int, int}>}
     */
    private function node(Node $node): array
    {
        if ($node instanceof SetAtom) {
            $state = $this->state(Nfa::CHAR, $this->setIndex($node->set));
            return [$state, [[$state, 0]]];
        }
        if ($node instanceof Group) {
            return $this->node($node->body);
        }
        if ($node instanceof Alternation) {
            return $this->alternation($node);
        }
        if ($node instanceof Repeat) {
            return $this->repeat($node);
        }
        throw new \LogicException('Unknown pattern node ' . $node::class);
    }

    /** @return array{int, list<array{int, int}>} */
    private function alternation(Alternation $alternation): array
    {
        $fragments = array_map($this->sequence(...), $alternation->branches);
        $result = array_pop($fragments);
        while ($fragments !== []) {
            $fragment = array_pop($fragments);
            $split = $this->state(Nfa::SPLIT);
            $this->next[$split] = $fragment[0];
            $this->alternatives[$split] = $result[0];
            $result = [$split, array_merge($fragment[1], $result[1])];
        }
        return $result;
    }

    /**
     * @param list<Node> $nodes
     * @return array{int, list<array{int, int}>}
     */
    private function sequence(array $nodes): array
    {
        return $this->concatenate(array_map($this->node(...), $nodes));
    }

    /** @return array{int, list<array{int, int}>} */
    private function repeat(Repeat $repeat): array
    {
        if ($repeat->item->size() === 0) {
            return $this->empty();
        }
        $parts = [];
        for ($copy = 0; $copy < $repeat->minimum; $copy++) {
            $parts[] = $this->node($repeat->item);
        }
        if ($repeat->maximum === null) {
            [$start, $holes] = $this->node($repeat->item);
            $split = $this->state(Nfa::SPLIT);
            $this->next[$split] = $start;
            $this->patch($holes, $split);
            $parts[] = [$split, [[$split, 1]]];
        } else {
            for ($copy = $repeat->minimum; $copy < $repeat->maximum; $copy++) {
                [$start, $holes] = $this->node($repeat->item);
                $split = $this->state(Nfa::SPLIT);
                $this->next[$split] = $start;
                $holes[] = [$split, 1];
                $parts[] = [$split, $holes];
            }
        }
        return $this->concatenate($parts);
    }

    /**
     * @param list<array{int, list<array{int, int}>}> $fragments
     * @return array{int, list<array{int, int}>}
     */
    private function concatenate(array $fragments): array
    {
        if ($fragments === []) {
            return $this->empty();
        }
        $result = array_shift($fragments);
        foreach ($fragments as [$start, $holes]) {
            $this->patch($result[1], $start);
            $result = [$result[0], $holes];
        }
        return $result;
    }

    /** @return array{int, list<array{int, int}>} */
    private function empty(): array
    {
        $state = $this->state(Nfa::EPSILON);
        return [$state, [[$state, 0]]];
    }

    /** @param list<array{int, int}> $holes */
    private function patch(array $holes, int $target): void
    {
        foreach ($holes as [$state, $slot]) {
            if ($slot === 0) {
                $this->next[$state] = $target;
            } else {
                $this->alternatives[$state] = $target;
            }
        }
    }

    private function state(int $kind, int $setIndex = -1): int
    {
        $this->kinds[] = $kind;
        $this->setIndexes[] = $setIndex;
        $this->next[] = -1;
        $this->alternatives[] = -1;
        return \count($this->kinds) - 1;
    }

    private function setIndex(CodePointSet $set): int
    {
        $id = spl_object_id($set);
        if (!isset($this->setIds[$id])) {
            $this->setIds[$id] = \count($this->sets);
            $this->sets[] = $set;
        }
        return $this->setIds[$id];
    }
}
