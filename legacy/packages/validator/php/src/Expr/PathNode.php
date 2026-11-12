<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Path reference. relative=false → resolved from the data root; relative=true →
 * resolved from parentPath (currentPath minus the field name) with levelsUp
 * additional parent ascents. segments are identifier|wildcard|index.
 */
final class PathNode extends Node
{
    /**
     * Build a path reference.
     *
     * @param list<PathSegment> $segments
     */
    public function __construct(
        public readonly bool $relative,
        public readonly int $levelsUp,
        public readonly array $segments,
    ) {
    }

    /** Serialize to {type,relative,levelsUp,segments}. */
    public function toArray(): array
    {
        return [
            'type'     => 'Path',
            'relative' => $this->relative,
            'levelsUp' => $this->levelsUp,
            'segments' => array_map(static fn (PathSegment $s): array => $s->toArray(), $this->segments),
        ];
    }
}
