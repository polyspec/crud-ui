<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

/**
 * A group; capturing and naming do not change a whole match.
 *
 * @internal
 */
final class Group implements Node
{
    /** @param Alternation $body the grouped alternatives */
    public function __construct(public readonly Alternation $body)
    {
    }

    /** The pattern size of the group: the size of its alternatives. */
    public function size(): int
    {
        return $this->body->size();
    }
}
