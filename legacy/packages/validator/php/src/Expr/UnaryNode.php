<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Unary logical negation: ! operand.
 */
final class UnaryNode extends Node
{
    /** Build a unary op from its operator and operand. */
    public function __construct(
        public readonly string $operator,
        public readonly Node $operand,
    ) {
    }

    /** Serialize to {type,operator,operand}. */
    public function toArray(): array
    {
        return [
            'type'     => 'Unary',
            'operator' => $this->operator,
            'operand'  => $this->operand->toArray(),
        ];
    }
}
