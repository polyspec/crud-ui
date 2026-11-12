<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Validator\Values\Whitespace;
use stdClass;

/**
 * The structured condition editor (docs/spec/schema.md and docs/spec/form-markup.md, Structured condition editor):
 * the model of a value that the editor shows or the named error of a value that it does not show, and the
 * compilation checks of design.editor and options.fields.
 *
 * @internal
 */
final class ConditionEditor
{
    /** The comparison operators that the editor offers, in their order (CUSC-073, CUSC-085). */
    public const OPS = ['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'in', 'has'];

    /** The deepest level of a condition tree; the root is level 1 (CUSC-075). */
    private const MAX_DEPTH = 32;

    /** An empty value (CUVR-020): missing, null, a string empty after trimming, an empty list or object. */
    public static function isEmpty(mixed $value): bool
    {
        return $value === Missing::Value || $value === null || $value === []
            || (is_string($value) && Whitespace::trim($value) === '')
            || ($value instanceof stdClass && get_object_vars($value) === []);
    }

    private static function scalar(mixed $value): bool
    {
        return is_string($value) || is_bool($value) || is_int($value) || (is_float($value) && is_finite($value));
    }

    /** The editor node of a condition, or null when the editor does not show it (CUSC-086). */
    private static function node(mixed $value, string $path, int $depth, bool $judge): ?stdClass
    {
        if ($depth > self::MAX_DEPTH || !$value instanceof stdClass) {
            return null;
        }
        $members = get_object_vars($value);
        $keys = array_map('strval', array_keys($members));
        if (count($keys) === 1 && ($keys[0] === 'all' || $keys[0] === 'any')) {
            $mode = $keys[0];
            $list = $members[$mode];
            if (!is_array($list) || !array_is_list($list)) {
                return null;
            }
            $items = [];
            foreach ($list as $index => $item) {
                $child = self::node($item, "{$path}/{$mode}/{$index}", $depth + 1, $judge);
                if ($child === null) {
                    return null;
                }
                $items[] = $child;
            }
            return (object) ['kind' => 'group', 'path' => $path, 'mode' => $mode, 'items' => $items];
        }
        if ($keys === ['judge']) {
            return $judge && is_string($members['judge'])
                ? (object) ['kind' => 'judge', 'path' => $path, 'text' => $members['judge']]
                : null;
        }
        $sorted = $keys;
        sort($sorted);
        if ($sorted === ['field', 'op', 'value']) {
            $field = $members['field'];
            $op = $members['op'];
            $operand = $members['value'];
            if (!is_string($field) || !is_string($op) || !in_array($op, self::OPS, true)) {
                return null;
            }
            $valid = $op === 'in'
                ? is_array($operand) && array_is_list($operand)
                    && array_filter($operand, static fn (mixed $item): bool => !self::scalar($item)) === []
                : self::scalar($operand);
            if (!$valid) {
                return null;
            }
            return (object) [
                'kind' => 'comparison',
                'path' => $path,
                'field' => $field,
                'op' => $op,
                'value' => Value::condition($operand),
            ];
        }
        return null;
    }

    /**
     * The editor model of a structured condition field (CUMK-067), or its named error (CUMK-068).
     *
     * @param array<string, string> $messages
     */
    public static function model(mixed $value, string $id, stdClass $spec, string $path, array $messages): stdClass
    {
        $validate = $spec->validate ?? null;
        $judge = $validate instanceof stdClass && ($validate->conditionTree ?? null) === 'judge';
        $root = self::isEmpty($value)
            ? (object) ['kind' => 'group', 'path' => '', 'mode' => 'all', 'items' => []]
            : self::node($value, '', 1, $judge);
        if ($root === null) {
            return (object) ['for' => $id, 'error' => str_replace('{path}', $path, $messages['conditionInvalid'])];
        }
        $options = $spec->options ?? null;
        $fields = $options instanceof stdClass && is_array($options->fields ?? null) ? $options->fields : null;
        return (object) [
            'for' => $id,
            'judge' => $judge,
            'fields' => $fields,
            'labels' => (object) [
                'mode' => $messages['conditionMode'],
                'addComparison' => $messages['conditionAddComparison'],
                'addGroup' => $messages['conditionAddGroup'],
                'addJudge' => $messages['conditionAddJudge'],
                'remove' => $messages['conditionRemove'],
            ],
            'root' => $root,
        ];
    }

    /** The error of an options.fields that breaks its rule (CUSC-084). */
    public static function fieldsError(string $path): FormError
    {
        return new FormError(
            'INVALID_FORM_INPUT',
            "Invalid options.fields at {$path}: expected distinct field names of a structured condition editor"
        );
    }

    /**
     * Reject a design.editor other than text or structured (CUSC-083) and an options.fields outside a structured
     * editor or with names that break its rule (CUSC-084).
     *
     * @param array<string, mixed> $spec
     */
    public static function check(array $spec, string $path): void
    {
        $design = $spec['design'] ?? null;
        $editor = Value::isObject($design) && array_key_exists('editor', (array) $design)
            ? ((array) $design)['editor']
            : 'text';
        if ($editor !== 'text' && $editor !== 'structured') {
            throw new FormError('INVALID_FORM_INPUT', "Invalid design.editor at {$path}: expected text or structured");
        }
        $options = $spec['options'] ?? null;
        if (!Value::isObject($options) || !array_key_exists('fields', (array) $options)) {
            return;
        }
        $names = ((array) $options)['fields'];
        $valid = is_array($names) && array_is_list($names)
            && array_filter($names, static fn (mixed $name): bool => !is_string($name) || self::isEmpty($name)) === []
            && count(array_unique($names)) === count($names);
        if ($editor !== 'structured' || !$valid) {
            throw self::fieldsError($path);
        }
    }
}
