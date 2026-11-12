<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Parenthesized group wrapping an inner expression. A group parses only down to
 * the or-level (JS parity): a bare ternary inside parentheses is rejected.
 */
final class GroupNode extends Node
{
    /** Build a group wrapping the given inner expression. */
    public function __construct(
        public readonly Node $expression,
    ) {
    }

    /** Serialize to {type,expression}. */
    public function toArray(): array
    {
        return [
            'type'       => 'Group',
            'expression' => $this->expression->toArray(),
        ];
    }
}
