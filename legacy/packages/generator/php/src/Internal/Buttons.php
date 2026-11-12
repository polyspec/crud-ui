<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/** Form buttons: the actions a spec declares with root buttons, rendered in the form footer. */
final class Buttons
{
    /** Button kinds a spec can declare. A link renders an anchor. */
    public const TYPES = ['submit', 'reset', 'button', 'link'];

    /** The buttons of a form whose spec declares none: one submit button. */
    public const DEFAULT = [['type' => 'submit']];

    /** Attribute names of an evaluated button, in output order. */
    public const ATTRIBUTES = ['type', 'class', 'style', 'name', 'value', 'href', 'onclick'];

    /** Evaluate the template buttons for a record in declaration order. */
    public static function bind(stdClass $template, stdClass $data, string $language): array
    {
        $messages = Messages::forLanguage($language);
        $buttons = [];
        foreach ($template->buttons as $button) {
            $button = Value::object($button);
            $type = $button->type;
            if (!is_string($type) || !in_array($type, self::TYPES, true)) {
                $name = is_scalar($type) ? (string) $type : '';
                throw new FormError('INVALID_FORM_INPUT', 'Invalid button type: ' . $name);
            }
            $design = Design::resolve($button->design ?? null, $data, [], []);
            $attrs = new stdClass();
            if ($type !== 'link') {
                $attrs->type = $type;
            }
            $attrs->class = implode(
                ' ',
                array_filter(
                    ['crudui-action', 'crudui-action--text', $design->main->class],
                    static fn ($part) => $part !== ''
                )
            );
            $style = Value::style($design->main->style);
            if ($style !== null) {
                $attrs->style = $style;
            }
            foreach (['name', 'value', 'href'] as $name) {
                if (is_string($button->{$name} ?? null)) {
                    $attrs->{$name} = $button->{$name};
                }
            }
            $onclick = self::script($button->behavior ?? null, 'onclick');
            if ($onclick !== null) {
                $attrs->onclick = $onclick;
            }
            $buttons[] = (object) [
                'type' => $type,
                'tag' => $type === 'link' ? 'a' : 'button',
                'text' => Value::translate($button->text ?? null, $language, $messages[$type] ?? ''),
                'attrs' => $attrs,
            ];
        }
        return $buttons;
    }

    /** Evaluate public input with the same template, data and option checks as form binding. */
    public static function bindPublic(stdClass $template, mixed $data, array $options): array
    {
        return self::bind(Template::checked($template), Value::formData($data), Binding::language($options));
    }

    /** Markup of public input after checking that every element is an evaluated button. */
    public static function htmlPublic(mixed $buttons): string
    {
        if (!is_array($buttons) || !array_is_list($buttons)) {
            throw new FormError('INVALID_FORM_INPUT', 'Form buttons must be a list');
        }
        foreach ($buttons as $button) {
            if (!self::evaluated($button)) {
                throw new FormError('INVALID_FORM_INPUT', 'Form buttons must be evaluated button objects');
            }
        }
        return self::html($buttons);
    }

    /** Whether a value has the tag, text and string attributes that the markup reads. */
    private static function evaluated(mixed $button): bool
    {
        if (
            !$button instanceof stdClass
            || !in_array($button->tag ?? null, ['a', 'button'], true)
            || !is_string($button->text ?? null)
            || !($button->attrs ?? null) instanceof stdClass
        ) {
            return false;
        }
        foreach ((array) $button->attrs as $name => $value) {
            if (!in_array((string) $name, self::ATTRIBUTES, true) || !is_string($value)) {
                return false;
            }
        }
        return true;
    }

    /** Markup of the form buttons; every renderer inserts this one string into the footer controls group. */
    public static function html(array $buttons): string
    {
        $out = '';
        foreach ($buttons as $button) {
            $out .= '<' . $button->tag;
            foreach ((array) $button->attrs as $name => $value) {
                $out .= ' ' . $name . '="' . strtr($value, ['&' => '&amp;', '"' => '&quot;', '<' => '&lt;']) . '"';
            }
            $out .= '>'
                . strtr($button->text, ['&' => '&amp;', '<' => '&lt;', '>' => '&gt;'])
                . '</'
                . $button->tag
                . '>';
        }
        return $out;
    }

    /** A behavior script: a string, or the script of a label and script action. */
    private static function script(mixed $behavior, string $action): ?string
    {
        $entry = $behavior instanceof stdClass
            ? ($behavior->{$action} ?? null)
            : (is_array($behavior) ? ($behavior[$action] ?? null) : null);
        $script = $entry instanceof stdClass
            ? ($entry->script ?? null)
            : (is_array($entry) ? ($entry['script'] ?? null) : $entry);
        return is_string($script) && $script !== '' ? $script : null;
    }
}
