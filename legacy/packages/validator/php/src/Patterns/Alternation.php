<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

/**
 * Alternatives separated by `|`; each alternative is a sequence of nodes. Its size is
 * the sum of the sizes of all its nodes.
 *
 * @internal
 */
final class Alternation implements Node
{
    private readonly int $size;

    /** @param list<list<Node>> $branches */
    public function __construct(public readonly array $branches)
    {
        $size = 0;
        foreach ($branches as $branch) {
            foreach ($branch as $node) {
                $size = PatternParser::capSize($size + $node->size());
            }
        }
        $this->size = $size;
    }

    /** The pattern size of the alternatives. */
    public function size(): int
    {
        return $this->size;
    }
}
