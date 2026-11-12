<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Support\JsonValue;

/**
 * Check the declared rule names and parameters of a composed field map: fields in
 * declaration order, each field's rules in declaration order and then its `messages`
 * keys, before the fields it contains. A name that is not a registered rule is
 * `UNKNOWN_RULE`.
 * Every literal a condition map or ternary can select is checked, selected or not.
 *
 * @internal
 */
final class DeclarationCheck
{
    /**
     * @param array<string, mixed> $properties a composed field map
     * @param list<string> $path the declaration path of the map's group
     * @param array<string, mixed> $root the composed root field map, read by a group source, a `multiple.keys`
     *        reference and a `reference` parameter
     * @throws ComposeLoadError at the first unknown rule name or invalid parameter
     * @throws FormInputError at the first `multiple.keys` that names no repeated group
     */
    public static function run(array $properties, array $path, array $root): void
    {
        foreach ($properties as $name => $field) {
            if (!\is_array($field) && !$field instanceof \stdClass) {
                continue;
            }
            $field = (array) $field;
            $fieldPath = [...$path, (string) $name];
            // The shape of multiple is checked before the group source and the rules of the field (CUSC-081).
            if (array_key_exists('multiple', $field) && !self::isMultipleShape($field['multiple'])) {
                throw new ComposeLoadError(
                    'INVALID_RULE_PARAMETER',
                    sprintf('Invalid multiple at %s: expected a boolean, only or an object', implode('.', $fieldPath)),
                    $fieldPath
                );
            }
            // A group source is checked before the rules of its field (schema.md, "Choices from a repeated group").
            $sourceFailure = GroupSource::failure($field, implode('.', $fieldPath), $root);
            if ($sourceFailure !== null) {
                throw new ComposeLoadError('INVALID_RULE_PARAMETER', $sourceFailure, $fieldPath);
            }
            $rules = $field['validate'] ?? null;
            if ($rules instanceof \stdClass || (\is_array($rules) && !array_is_list($rules))) {
                foreach ((array) $rules as $rule => $parameter) {
                    self::checkName((string) $rule, $fieldPath);
                    foreach (RuleParameters::declaredValues((string) $rule, $parameter) as $value) {
                        RuleParameters::check((string) $rule, $value, $fieldPath);
                        if ($rule === 'reference' && \is_string($value) && !References::isTarget($root, $value)) {
                            throw new ComposeLoadError(
                                'INVALID_RULE_PARAMETER',
                                RuleParameters::REFERENCE_MESSAGE,
                                $fieldPath,
                            );
                        }
                    }
                }
            }
            $messages = $field['messages'] ?? null;
            if ($messages instanceof \stdClass || (\is_array($messages) && !array_is_list($messages))) {
                foreach (array_keys((array) $messages) as $rule) {
                    self::checkName((string) $rule, $fieldPath);
                }
            }
            KeyedMaps::assertReference($field, $fieldPath, $root);
            $children = $field['properties'] ?? null;
            if (
                ($field['type'] ?? null) === 'group'
                && ($children instanceof \stdClass || (\is_array($children) && !array_is_list($children)))
            ) {
                self::run((array) $children, $fieldPath, $root);
            }
        }
    }

    /**
     * @param list<string> $path the field's declaration path
     * @throws ComposeLoadError when the name is not a registered rule
     */
    private static function checkName(string $rule, array $path): void
    {
        if (!\array_key_exists($rule, Validator::DEFAULT_MESSAGES)) {
            throw new ComposeLoadError('UNKNOWN_RULE', 'Unknown rule: ' . $rule, $path);
        }
    }

    /** Whether a multiple declaration is a boolean, only or an object (schema.md, CUSC-041). */
    private static function isMultipleShape(mixed $multiple): bool
    {
        return \is_bool($multiple) || $multiple === 'only' || JsonValue::isObject($multiple);
    }
}
