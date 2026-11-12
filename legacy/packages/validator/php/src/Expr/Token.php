<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * A single lexical token. `value` is the raw source text; `literal` is the
 * parsed value for value tokens (string content, number int/float, bool, null,
 * or the dot count for DOT_DOT) and null otherwise.
 *
 * No position field: the 4-language token contract excludes positions (the Rust
 * AST holds none), matching the shared fixture's token shape.
 */
final class Token
{
    /** Build a token from its type, raw text, and parsed literal (or null). */
    public function __construct(
        public readonly TokenType $type,
        public readonly string $value,
        public readonly string|int|float|bool|null $literal,
    ) {
    }

    /**
     * Serialize to the shared-fixture token shape: {type, value, literal}.
     *
     * @return array{type: string, value: string, literal: string|int|float|bool|null}
     */
    public function toArray(): array
    {
        return [
            'type'    => $this->type->value,
            'value'   => $this->value,
            'literal' => $this->literal,
        ];
    }
}
