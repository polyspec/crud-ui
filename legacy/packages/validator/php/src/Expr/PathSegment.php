<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * A single path segment: identifier (field name), wildcard (*), or index
 * (numeric array index). The index value serializes as a number to match the
 * JS reference's segment shape ({type:'index', value:number}).
 */
final class PathSegment
{
    private function __construct(
        public readonly string $type,
        public readonly ?string $value,
        public readonly ?int $index,
    ) {
    }

    /** A named-field segment. */
    public static function identifier(string $value): self
    {
        return new self('identifier', $value, null);
    }

    /** A wildcard (*) segment matching any array index. */
    public static function wildcard(): self
    {
        return new self('wildcard', null, null);
    }

    /** A fixed numeric array-index segment. */
    public static function index(int $value): self
    {
        return new self('index', null, $value);
    }

    /**
     * Serialize to the JS segment shape (index value emitted as a number).
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return match ($this->type) {
            'identifier' => ['type' => 'identifier', 'value' => $this->value],
            'wildcard'   => ['type' => 'wildcard'],
            'index'      => ['type' => 'index', 'value' => $this->index],
            default      => ['type' => $this->type],
        };
    }
}
