<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Membership test: value [not] in list. `list` is a Literal-node array; whether
 * the source used brackets ([a,b]) or not (a,b) is NOT preserved in the AST.
 */
final class InNode extends Node
{
    /**
     * Build a membership test.
     *
     * @param list<Node> $list candidate Literal nodes
     */
    public function __construct(
        public readonly bool $negated,
        public readonly Node $value,
        public readonly array $list,
    ) {
    }

    /** Serialize to {type,negated,value,list}. */
    public function toArray(): array
    {
        return [
            'type'    => 'In',
            'negated' => $this->negated,
            'value'   => $this->value->toArray(),
            'list'    => array_map(static fn (Node $n): array => $n->toArray(), $this->list),
        ];
    }
}
