<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

/**
 * CRUDUI validation result — { valid, errors, hidden } (SPEC G-B). Port of the JS
 * ValidationResult shape. `errors` is a flat list of error records, each
 * { path, field, rule, message, value }, identical in every runtime so the
 * 4-language fixture compares bit-for-bit.
 */
final class ValidationResult
{
    /**
     * @param bool $valid true when `errors` is empty
     * @param list<array<string, mixed>> $errors flat list of error records
     * @param list<string> $hidden data paths of the fields whose design.show resolves to false
     */
    public function __construct(
        public readonly bool $valid,
        public readonly array $errors,
        public readonly array $hidden,
    ) {
    }

    /**
     * Plain-array form for fixture comparison (matches the shared fixture's
     * `expected` shape exactly).
     *
     * @return array{valid: bool, errors: list<array<string, mixed>>, hidden: list<string>}
     */
    public function toArray(): array
    {
        return [
            'valid' => $this->valid,
            'errors' => $this->errors,
            'hidden' => $this->hidden,
        ];
    }
}
