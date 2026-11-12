<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Support\JsonValue;
use Polyspec\Crudui\Validator\Values\CanonicalText;
use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * Choices from a repeated group (docs/spec/schema.md, "Choices from a repeated group"): a choice
 * field whose `items` is a group source `{ from, label? }` takes its choices from the rows of a
 * repeated group of the same form. This class checks the declaration and reads the choices from
 * the data; the generator lists them and the validator checks a value against them
 * (docs/spec/validation-rules.md, "Values").
 *
 * @internal
 */
final class GroupSource
{
    /** The field types that take a group source. */
    private const CHOICE_TYPES = [
        'select', 'dropdown', 'selectbox', 'choice', 'radio', 'multichoice', 'checkboxes', 'checkcontainer',
    ];

    /** The field types whose stored value is a boolean, which a group source refuses (CUSC-068). */
    private const BOOLEAN_TYPES = ['checkbox', 'switcher'];

    /** Whether `items` is a group source: an object with the member `from`. */
    public static function isSource(mixed $items): bool
    {
        return JsonValue::isObject($items) && array_key_exists('from', (array) $items);
    }

    /**
     * The message of the first rule that the group source of a field breaks under the root
     * properties, or null: the members of `items` in declaration order, the field, `from`, the type
     * of its field, `label` and then the type of its field.
     *
     * @param array<array-key, mixed> $field the composed field declaration
     * @param array<array-key, mixed> $root the composed root properties
     */
    public static function failure(array $field, string $path, array $root): ?string
    {
        $items = $field['items'] ?? null;
        if (!self::isSource($items)) {
            return null;
        }
        $source = (array) $items;
        foreach (array_keys($source) as $key) {
            if ($key !== 'from' && $key !== 'label' && $key !== 'choices') {
                return sprintf('Invalid items.%s at %s: unknown key', $key, $path);
            }
        }
        if (!in_array($field['type'] ?? null, self::CHOICE_TYPES, true) || self::hasLang($field)) {
            return sprintf('Invalid items.from at %s: expected a choice field without lang', $path);
        }
        $group = self::sourceGroup($source['from'], $root);
        if ($group === null) {
            return sprintf(
                'Invalid items.from at %s: expected {group}.*.{field} for a field of a repeated group '
                . 'outside repeated groups',
                $path
            );
        }
        $segments = explode('.', (string) $source['from']);
        $groupPath = implode('.', array_slice($segments, 0, -2));
        $valueName = $segments[count($segments) - 1];
        if (self::holdsBoolean($group, $valueName)) {
            return self::booleanFailure('from', $path, $groupPath . '.' . $valueName);
        }
        if (array_key_exists('label', $source) && !self::scalarChild($group, $source['label'])) {
            return sprintf(
                'Invalid items.label at %s: expected the name of a direct child field of the group '
                . 'without multiple, properties or lang',
                $path
            );
        }
        if (array_key_exists('label', $source) && self::holdsBoolean($group, $source['label'])) {
            return self::booleanFailure('label', $path, $groupPath . '.' . (string) $source['label']);
        }
        if (array_key_exists('choices', $source) && self::literalChoices($source['choices']) === null) {
            return sprintf(
                'Invalid items.choices at %s: expected value and label pairs with distinct string or number values',
                $path
            );
        }
        return null;
    }

    /**
     * The literal choices of a group source (schema.md, CUSC-089) as [value text, label] pairs, or null
     * when they are not a list of `{ value, label }` pairs whose values are strings or finite numbers
     * with distinct canonical texts that are not empty after trimming.
     *
     * @return list<array{0: string, 1: mixed}>|null
     */
    private static function literalChoices(mixed $choices): ?array
    {
        if (!\is_array($choices) || !array_is_list($choices)) {
            return null;
        }
        $literal = [];
        foreach ($choices as $choice) {
            if (!JsonValue::isObject($choice)) {
                return null;
            }
            $choice = (array) $choice;
            if (\count($choice) !== 2 || !array_key_exists('value', $choice) || !array_key_exists('label', $choice)) {
                return null;
            }
            $value = self::choiceText($choice['value']);
            if ($value === null || array_key_exists($value, $literal)) {
                return null;
            }
            $literal[$value] = [$value, $choice['label']];
        }
        return array_values($literal);
    }

    /**
     * The literal choices of a checked group source, none when it declares no `choices`.
     *
     * @param array<array-key, mixed> $source
     * @return list<array{0: string, 1: mixed}>
     */
    private static function sourceLiteral(array $source): array
    {
        return array_key_exists('choices', $source) ? (self::literalChoices($source['choices']) ?? []) : [];
    }

    /**
     * The choices of a checked group source for the root data, as [value text, label text] pairs:
     * one per row of the group in data order whose value is a string or a finite number with a
     * non-empty canonical text, each value once, labelled with the text of its `label` field or
     * else its value.
     *
     * @param array<array-key, mixed> $source the group source `{ from, label? }`
     * @return list<array{0: string, 1: mixed}>
     */
    public static function choices(array $source, mixed $data): array
    {
        $literalRepeat = self::firstRepeat($source, $data, false);
        if ($literalRepeat !== null) {
            throw new FormInputError($literalRepeat);
        }
        $segments = explode('.', (string) $source['from']);
        $valueName = (string) end($segments);
        $label = $source['label'] ?? null;
        $choices = self::sourceLiteral($source);
        $seen = [];
        foreach (self::rows($source, $data) as $row) {
            if (!JsonValue::isObject($row)) {
                continue;
            }
            $row = (array) $row;
            $value = self::choiceText($row[$valueName] ?? null);
            if ($value === null || isset($seen[$value])) {
                continue;
            }
            $seen[$value] = true;
            $text = is_string($label) ? self::choiceText($row[$label] ?? null) : null;
            $choices[] = [$value, $text ?? $value];
        }
        return $choices;
    }

    /**
     * The input failure message of the first row of a checked group source, in data order, whose
     * choice value repeats a literal choice (CUSC-089) or that of an earlier row (CUVR-087), or null.
     *
     * @param array<array-key, mixed> $source the group source `{ from, label?, choices? }`
     */
    public static function repeat(array $source, mixed $data): ?string
    {
        return self::firstRepeat($source, $data, true);
    }

    /**
     * The message of the first row whose choice value is a literal choice or, with $rows, the value
     * of an earlier row; null when none repeats.
     *
     * @param array<array-key, mixed> $source
     */
    private static function firstRepeat(array $source, mixed $data, bool $rows): ?string
    {
        $segments = explode('.', (string) $source['from']);
        $valueName = (string) end($segments);
        $groupPath = implode('.', array_slice($segments, 0, -2));
        $literal = array_column(self::sourceLiteral($source), 0);
        $seen = [];
        foreach (self::rows($source, $data) as $key => $row) {
            if (!JsonValue::isObject($row)) {
                continue;
            }
            $value = self::choiceText(((array) $row)[$valueName] ?? null);
            if ($value === null) {
                continue;
            }
            $at = $groupPath . '.' . (string) $key . '.' . $valueName;
            if (\in_array($value, $literal, true)) {
                return sprintf('Group source value repeats a literal choice at %s: %s', $at, $value);
            }
            if ($rows && isset($seen[$value])) {
                return sprintf('Group source value repeats an earlier row: %s at %s', $value, $at);
            }
            $seen[$value] = true;
        }
        return null;
    }

    /**
     * The rows of the group that a checked group source names in the root data, keyed by row key
     * in data order; a group without object data has none.
     *
     * @param array<array-key, mixed> $source the group source `{ from, label? }`
     * @return array<array-key, mixed>
     */
    private static function rows(array $source, mixed $data): array
    {
        $segments = explode('.', (string) $source['from']);
        $rows = $data;
        foreach (array_slice($segments, 0, -2) as $name) {
            if (!JsonValue::isObject($rows) || !array_key_exists($name, (array) $rows)) {
                return [];
            }
            $rows = ((array) $rows)[$name];
        }
        return JsonValue::isObject($rows) ? (array) $rows : [];
    }

    /**
     * The child fields of the repeated group that `from` names under the root properties, or null
     * when `from` is not `{group}.*.{field}` for a field of a repeated group outside repeated groups.
     *
     * @param array<array-key, mixed> $root
     * @return array<array-key, mixed>|null
     */
    private static function sourceGroup(mixed $from, array $root): ?array
    {
        if (!is_string($from)) {
            return null;
        }
        $segments = explode('.', $from);
        $count = count($segments);
        if ($count < 3 || $segments[$count - 2] !== '*') {
            return null;
        }
        $properties = $root;
        foreach (array_slice($segments, 0, -2) as $index => $name) {
            if ($name === '' || !array_key_exists($name, $properties) || !JsonValue::isObject($properties[$name])) {
                return null;
            }
            $field = (array) $properties[$name];
            if (
                ($field['type'] ?? null) !== 'group'
                || !JsonValue::isObject($field['properties'] ?? null)
                || self::repeated($field) !== ($index === $count - 3)
            ) {
                return null;
            }
            $properties = (array) $field['properties'];
        }
        return self::scalarChild($properties, $segments[$count - 1]) ? $properties : null;
    }

    /** Whether a direct child `name` of a group is a scalar child: not a group, not repeated and without lang. */
    private static function scalarChild(array $properties, mixed $name): bool
    {
        if (!is_string($name) || !array_key_exists($name, $properties) || !JsonValue::isObject($properties[$name])) {
            return false;
        }
        $child = (array) $properties[$name];
        return ($child['type'] ?? null) !== 'group'
            && !array_key_exists('properties', $child)
            && !self::repeated($child)
            && !self::hasLang($child);
    }

    /** Whether the scalar child `name` of a group is of a type that stores a boolean. */
    private static function holdsBoolean(array $properties, mixed $name): bool
    {
        if (!is_string($name) || !JsonValue::isObject($properties[$name] ?? null)) {
            return false;
        }
        return in_array(((array) $properties[$name])['type'] ?? null, self::BOOLEAN_TYPES, true);
    }

    /** The message of a group source whose `member` names the field `field` that holds a boolean (CUSC-068). */
    private static function booleanFailure(string $member, string $path, string $field): string
    {
        return sprintf(
            'Invalid items.%s at %s: %s holds a boolean, expected a field whose values are strings or numbers',
            $member,
            $path,
            $field
        );
    }

    /** Whether a field repeats: multiple is true, only or an object. */
    private static function repeated(array $field): bool
    {
        $multiple = $field['multiple'] ?? null;
        return $multiple === true || $multiple === 'only' || JsonValue::isObject($multiple);
    }

    /** Whether a field declares lang: true or an object. */
    private static function hasLang(array $field): bool
    {
        $lang = $field['lang'] ?? null;
        return $lang === true || JsonValue::isObject($lang);
    }

    /** The canonical text of a string or a finite number that is not empty after trimming, or null. */
    private static function choiceText(mixed $value): ?string
    {
        if (!is_string($value) && !is_int($value) && !(is_float($value) && is_finite($value))) {
            return null;
        }
        $text = CanonicalText::of($value);
        return $text !== null && Whitespace::trim($text) !== '' ? $text : null;
    }
}
