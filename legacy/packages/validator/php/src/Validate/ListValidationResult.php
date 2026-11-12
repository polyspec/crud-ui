<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

/**
 * CRUDUI list-spec validation result — { valid, errors } (SPEC §9). Read sister of
 * ValidationResult. A list carries no data (rows are injected, SPEC §9), so the
 * four-language engine runs only compose + forbidden-scan: a clean structure load
 * is always { valid:true, errors:[] }. A composition/forbidden-key failure is a
 * LOAD failure (a thrown ComposeLoadError), NOT a valid:false result — so this
 * shape is the clean-load companion, idempotent with the JS validateList return.
 */
final class ListValidationResult
{
    /**
     * @param bool $valid true when `errors` is empty
     * @param list<array<string, mixed>> $errors flat list of error records (empty on a clean structure load)
     */
    public function __construct(
        public readonly bool $valid,
        public readonly array $errors,
    ) {
    }

    /**
     * Plain-array form for fixture comparison.
     *
     * @return array{valid: bool, errors: list<array<string, mixed>>}
     */
    public function toArray(): array
    {
        return [
            'valid' => $this->valid,
            'errors' => $this->errors,
        ];
    }
}
