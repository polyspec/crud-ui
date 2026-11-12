<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Base for every CRUDUI expression AST node (expressions.md §4).
 *
 * toArray() emits the canonical fixture shape, byte-matching the JS reference
 * field names (Ternary{condition,trueValue,falseValue} / Binary{operator,left,
 * right} / etc.). The JS/Go `position` field is DELIBERATELY ABSENT — Rust holds
 * no position, so the 4-language AST contract excludes it; including it would
 * break cross-language fixture equality.
 *
 * CRUDUI-only.
 */
abstract class Node
{
    /** @return array<string, mixed> */
    abstract public function toArray(): array;
}
