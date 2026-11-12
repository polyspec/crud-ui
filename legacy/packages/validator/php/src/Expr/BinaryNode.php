<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Binary operation: logical (&& ||) or comparison (== != > >= < <=).
 */
final class BinaryNode extends Node
{
    /** Build a binary op from its operator and two operands. */
    public function __construct(
        public readonly string $operator,
        public readonly Node $left,
        public readonly Node $right,
    ) {
    }

    /** Serialize to {type,operator,left,right}. */
    public function toArray(): array
    {
        return [
            'type'     => 'Binary',
            'operator' => $this->operator,
            'left'     => $this->left->toArray(),
            'right'    => $this->right->toArray(),
        ];
    }
}
