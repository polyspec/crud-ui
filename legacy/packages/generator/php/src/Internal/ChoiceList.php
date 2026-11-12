<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Validator\Validate\GroupSource;
use Polyspec\Crudui\Validator\Validate\FormInputError;
use stdClass;

/** Read choice lists: `items` arrays of value and label pairs kept in list order. */
final class ChoiceList
{
    /** The expected-value text of a choice list declaration failure. */
    public const EXPECTED = 'value and label pairs with distinct string or number values';

    /** Whether `items` is a choice list: an array with an object element that has a `value` or a `choices` member. */
    public static function is(mixed $items): bool
    {
        if (!is_array($items)) {
            return false;
        }
        foreach ($items as $item) {
            if ($item instanceof stdClass && (property_exists($item, 'value') || property_exists($item, 'choices'))) {
                return true;
            }
        }
        return false;
    }

    /**
     * The spec of a field whose `items` is a group source, with `items` replaced by the choices that
     * the source gives for the root form data as a choice list of value and label pairs; any other
     * spec is returned as it is.
     */
    public static function resolve(stdClass $spec, stdClass $data): stdClass
    {
        if (!GroupSource::isSource($spec->items ?? null)) {
            return $spec;
        }
        try {
            $choices = GroupSource::choices((array) $spec->items, $data);
        } catch (FormInputError $error) {
            throw new FormError($error->getErrorCode(), $error->getMessage(), previous: $error);
        }
        $items = [];
        foreach ($choices as [$value, $label]) {
            $items[] = (object) ['value' => $value, 'label' => $label];
        }
        $resolved = clone $spec;
        $resolved->items = $items;
        return $resolved;
    }

    /** The members a choice of a choice or multichoice field may declare besides value and label. */
    private const APPEARANCE_MEMBERS = ['class', 'style', 'attributes'];

    /** Whether a choice list element is a group: an object that has a `choices` member. */
    private static function isGroup(mixed $item): bool
    {
        return $item instanceof stdClass && property_exists($item, 'choices');
    }

    /**
     * The value text and label pairs in list order, the choices of each group in place of the
     * group, or null when an element has another member (an appearance member is accepted with
     * $appearance), lacks value or label, has a value that is not a string or a finite number,
     * or repeats the canonical text of an earlier value, or when the list has a group without
     * $groups or a group that is not a label and a non-empty list of choices without appearance
     * members.
     *
     * @param list<mixed> $items
     * @return list<array{0: string, 1: mixed}>|null
     */
    public static function pairs(array $items, bool $appearance = false, bool $groups = false): ?array
    {
        $pairs = [];
        $seen = [];
        $add = static function (mixed $item, array $members) use (&$pairs, &$seen): bool {
            if (!$item instanceof stdClass || !property_exists($item, 'value') || !property_exists($item, 'label')) {
                return false;
            }
            foreach (array_keys(get_object_vars($item)) as $member) {
                if ($member !== 'value' && $member !== 'label' && !in_array($member, $members, true)) {
                    return false;
                }
            }
            $value = $item->value;
            if (!is_string($value) && !is_int($value) && !(is_float($value) && is_finite($value))) {
                return false;
            }
            $text = Value::scalar($value);
            if (isset($seen[$text])) {
                return false;
            }
            $seen[$text] = true;
            $pairs[] = [$text, $item->label];
            return true;
        };
        foreach ($items as $item) {
            if ($groups && self::isGroup($item)) {
                $choices = $item->choices;
                if (
                    count(get_object_vars($item)) !== 2
                    || !property_exists($item, 'label')
                    || !is_array($choices)
                    || !array_is_list($choices)
                    || $choices === []
                ) {
                    return null;
                }
                foreach ($choices as $choice) {
                    if (!$add($choice, [])) {
                        return null;
                    }
                }
            } elseif (!$add($item, $appearance ? self::APPEARANCE_MEMBERS : [])) {
                return null;
            }
        }
        return $pairs;
    }

    /**
     * The group of each pair of a checked choice list in the order of pairs(): the index of the
     * group in the list and its declared label, or null for a choice outside groups.
     *
     * @param list<mixed> $items
     * @return list<array{index: int, label: mixed}|null>
     */
    public static function groups(array $items): array
    {
        $out = [];
        foreach ($items as $index => $item) {
            if (self::isGroup($item)) {
                foreach ($item->choices as $_choice) {
                    $out[] = ['index' => $index, 'label' => $item->label];
                }
            } else {
                $out[] = null;
            }
        }
        return $out;
    }

    /**
     * Reject the appearance of a valid choice list whose class or style is not a string or whose
     * attributes break the declared attribute rules, choice by choice in list order.
     *
     * @param list<stdClass> $items
     */
    public static function checkAppearance(array $items, string $path): void
    {
        foreach ($items as $index => $choice) {
            foreach (['class', 'style'] as $member) {
                if (property_exists($choice, $member) && !is_string($choice->{$member})) {
                    throw new FormError(
                        'INVALID_FORM_INPUT',
                        sprintf('Invalid items.%d.%s at %s: expected a string', $index, $member, $path)
                    );
                }
            }
            if (property_exists($choice, 'attributes')) {
                Template::checkDeclaredAttributes($choice->attributes, 'items.' . $index . '.attributes', $path);
            }
        }
    }

    /**
     * The appearance of each choice of a checked choice list in list order: className, style
     * (normalized as a design style) and attributes, each only when declared.
     *
     * @param list<stdClass> $items
     * @return list<array<string, mixed>>
     */
    public static function appearances(array $items): array
    {
        return array_map(static function (stdClass $choice): array {
            $out = [];
            if (is_string($choice->class ?? null) && $choice->class !== '') {
                $out['className'] = $choice->class;
            }
            $style = Value::style($choice->style ?? null);
            if ($style !== null && $style !== '') {
                $out['style'] = $style;
            }
            if (($choice->attributes ?? null) instanceof stdClass && get_object_vars($choice->attributes) !== []) {
                $out['attributes'] = clone $choice->attributes;
            }
            return $out;
        }, $items);
    }
}
