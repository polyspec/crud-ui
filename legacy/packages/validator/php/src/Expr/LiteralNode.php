<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Literal value. valueType is one of string|number|boolean|null. An unquoted
 * identifier on a comparison right-hand side or in an `in` list is a string
 * literal whose value is the identifier text (e.g. `.country == US` → 'US').
 */
final class LiteralNode extends Node
{
    /** Build a literal from its value kind and concrete value. */
    public function __construct(
        public readonly string $valueType,
        public readonly string|int|float|bool|null $value,
    ) {
    }

    /** Serialize to {type,valueType,value}. */
    public function toArray(): array
    {
        return [
            'type'      => 'Literal',
            'valueType' => $this->valueType,
            'value'     => $this->value,
        ];
    }
}
