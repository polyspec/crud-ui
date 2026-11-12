<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

/**
 * A node of a recognized CRUDUI pattern.
 *
 * @internal
 */
interface Node
{
    /** The pattern size of the node, capped at PatternParser::MAXIMUM_SIZE + 1. */
    public function size(): int;
}
