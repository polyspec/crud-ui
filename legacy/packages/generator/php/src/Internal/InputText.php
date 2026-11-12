<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Validator\Support\Text;
use stdClass;

/** Input text and value limit checks of the generator operations (docs/spec/input-text.md). */
final class InputText
{
    /** Options of a form binding or instance, in code point order of their names. */
    public const BIND = ['idPrefix', 'keyPrefix', 'language', 'unsupported'];

    /** Options of a list or detail model, in code point order of their names. */
    public const DISPLAY = ['basepath', 'data', 'language', 'layout'];

    /** Check a specification and the files an operation reads. */
    public static function specification(array|stdClass $spec, array $options): void
    {
        $failure = Text::specificationFailure($spec, $options['files'] ?? null);
        if ($failure !== null) {
            throw new FormError('INVALID_FORM_INPUT', $failure);
        }
    }

    /**
     * Check named arguments in order, then the named options.
     *
     * @param list<array{0: string, 1: mixed}> $inputs
     * @param list<string> $names
     */
    public static function inputs(array $inputs, array $options = [], array $names = []): void
    {
        $failure = Text::inputFailure([...$inputs, ...Text::options($options, $names)]);
        if ($failure !== null) {
            throw new FormError('INVALID_FORM_INPUT', $failure);
        }
    }
}
