<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use stdClass;

/**
 * The markup of the structured condition widget (docs/spec/form-markup.md, Structured condition editor).
 *
 * @internal
 */
final class ConditionMarkup
{
    /**
     * The prepend affix, the named error of a value that the editor does not show, the textarea, the editor of a value
     * that it shows and the append affix.
     */
    public static function widget(stdClass $widget): string
    {
        $editor = $widget->condition;
        $body = Rendering::affix($widget->prepend ?? null, true);
        if (property_exists($editor, 'error')) {
            $error = ['class' => 'crudui-condition__error', 'role' => 'alert'];
            $body .= Rendering::element('p', $error, Rendering::text($editor->error, true), true);
        }
        $body .= Rendering::control($widget, true);
        if (!property_exists($editor, 'error')) {
            $wrapper = ['class' => 'crudui-condition', 'data-condition-for' => $editor->for];
            $body .= Rendering::element('div', $wrapper, self::node($editor->root, $editor), true);
        }
        $body .= Rendering::affix($widget->append ?? null, true);
        return Rendering::element('div', ['class' => 'crudui-widget crudui-widget--condition'], $body);
    }

    private static function button(string $action, string $label): string
    {
        return Rendering::element(
            'button',
            ['type' => 'button', 'class' => 'crudui-action crudui-action--text', 'data-condition-action' => $action],
            Rendering::text($label, true),
            true
        );
    }

    private static function input(string $class, string $part, string $value): string
    {
        return Rendering::input(['class' => $class, 'data-condition-part' => $part, 'value' => $value], true);
    }

    /** @param list<string> $choices */
    private static function select(array $select, array $choices, string $selected): string
    {
        $options = '';
        foreach ($choices as $choice) {
            $attrs = ['value' => $choice, ...($choice === $selected ? ['selected' => ''] : [])];
            $options .= Rendering::element('option', $attrs, Rendering::text($choice, true), true);
        }
        return Rendering::element('select', $select, $options, true);
    }

    /** One condition of the editor: a group, a field comparison or a judged text (CUMK-067). */
    private static function node(stdClass $node, stdClass $editor): string
    {
        $labels = $editor->labels;
        $remove = $node->path === '' ? '' : self::button('remove', $labels->remove);
        if ($node->kind === 'group') {
            $items = '';
            foreach ($node->items as $item) {
                $items .= Rendering::element(
                    'li',
                    ['class' => 'crudui-condition__item'],
                    self::node($item, $editor),
                    true
                );
            }
            return Rendering::element(
                'fieldset',
                ['class' => 'crudui-condition__group', 'data-condition-path' => $node->path],
                self::select(
                    [
                        'class' => 'crudui-condition__mode',
                        'data-condition-part' => 'mode',
                        'aria-label' => $labels->mode,
                    ],
                    ['all', 'any'],
                    $node->mode
                )
                    . Rendering::element('ol', ['class' => 'crudui-condition__list'], $items)
                    . self::button('add-comparison', $labels->addComparison)
                    . self::button('add-group', $labels->addGroup)
                    . ($editor->judge ? self::button('add-judge', $labels->addJudge) : '')
                    . $remove,
                true
            );
        }
        if ($node->kind === 'judge') {
            return Rendering::element(
                'div',
                ['class' => 'crudui-condition__judge', 'data-condition-path' => $node->path],
                self::input('crudui-condition__text', 'judge', $node->text) . $remove,
                true
            );
        }
        $field = $editor->fields === null
            ? self::input('crudui-condition__field', 'field', $node->field)
            : self::select(
                ['class' => 'crudui-condition__field', 'data-condition-part' => 'field'],
                in_array($node->field, $editor->fields, true) ? $editor->fields : [$node->field, ...$editor->fields],
                $node->field
            );
        return Rendering::element(
            'div',
            ['class' => 'crudui-condition__comparison', 'data-condition-path' => $node->path],
            $field
                . self::select(
                    ['class' => 'crudui-condition__op', 'data-condition-part' => 'op'],
                    ConditionEditor::OPS,
                    $node->op
                )
                . self::input('crudui-condition__value', 'value', $node->value)
                . $remove,
            true
        );
    }
}
