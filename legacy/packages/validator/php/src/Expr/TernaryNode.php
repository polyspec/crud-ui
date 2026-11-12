<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Ternary conditional: condition ? trueValue : falseValue.
 *
 * EBNF is right-associative (then=ternary, else=ternary). evaluateValue returns
 * the chosen branch's RAW value (string|number|boolean|null), not just a boolean.
 */
final class TernaryNode extends Node
{
    /** Build a ternary from its condition and two branch expressions. */
    public function __construct(
        public readonly Node $condition,
        public readonly Node $trueValue,
        public readonly Node $falseValue,
    ) {
    }

    /** Serialize to {type,condition,trueValue,falseValue}. */
    public function toArray(): array
    {
        return [
            'type'       => 'Ternary',
            'condition'  => $this->condition->toArray(),
            'trueValue'  => $this->trueValue->toArray(),
            'falseValue' => $this->falseValue->toArray(),
        ];
    }
}
