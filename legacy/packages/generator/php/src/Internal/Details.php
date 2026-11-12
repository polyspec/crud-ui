<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/** Compose detail declarations and render one supplied record read-only. */
final class Details
{
    /** Build a detail model by delegating fields and cells to the list engine. */
    public static function build(mixed $spec, mixed $record, array $options): stdClass
    {
        // Argument shapes in argument order, then the declaration, then options (docs/spec/display-formats.md).
        if (!Value::isObject($spec)) {
            throw new FormError('INVALID_FORM_INPUT', 'Detail specification must be an object');
        }
        if (!Value::isObject($record)) {
            throw new FormError('INVALID_FORM_INPUT', 'Detail record must be an object');
        }
        $spec = Value::spec($spec);
        $record = Value::object($record);
        if (!property_exists($spec, 'fields')) {
            throw new FormError('INVALID_FORM_INPUT', 'Detail specification must declare fields');
        }
        // An absent or null context is empty; data is an object option.
        $data = $options['data'] ?? null;
        if ($data !== null && !Value::isObject($data)) {
            throw new FormError('INVALID_FORM_INPUT', 'Detail context must be an object');
        }
        // Page and total are list options; a detail neither checks nor uses them.
        $model = Lists::build(
            $spec,
            [$record],
            array_diff_key($options, ['page' => true, 'total' => true]),
            'detail',
            'fields'
        );
        $fields = [];
        $columns = $model->columns;
        $cells = $model->rows[0]->cells ?? [];
        foreach ($columns as $index => $column) {
            if (!isset($cells[$index])) {
                continue;
            }
            $cell = $cells[$index];
            $fields[] = (object) [
                'key' => $column->key,
                'label' => $column->label,
                'format' => $cell->format,
                'value' => $cell->value,
                'display' => $cell->display,
                'design' => $cell->design,
            ];
        }
        return (object) ['fields' => $fields, 'actions' => $model->actions, 'design' => $model->design];
    }

    /** Render one read-only detail: image preload links, the actions and the definition list. */
    public static function render(mixed $spec, mixed $record, array $options): string
    {
        $model = self::build($spec, $record, $options);
        $design = $model->design;
        $attrs = ['class' => Value::classes('crudui-detail', $design->wrapper->class)];
        $style = Value::style($design->wrapper->style);
        if ($style !== null) {
            $attrs['style'] = $style;
        }
        $body = '';
        foreach ($model->fields as $field) {
            $cell = (object) ['display' => $field->display, 'design' => $field->design, 'format' => $field->format];
            $body .= Rendering::element(
                'div',
                ['class' => 'crudui-detail__field'],
                Rendering::element('dt', ['class' => 'crudui-detail__label'], Rendering::text($field->label)) .
                Lists::renderCell(
                    $cell,
                    'dd',
                    'crudui-detail__value crudui-value crudui-value--' . $field->format->type
                )
            );
        }
        return self::preloads($model)
            . Lists::actionsHtml($model->actions, 'crudui-detail')
            . Rendering::element('dl', $attrs, $body);
    }

    private static function preloads(stdClass $model): string
    {
        $seen = [];
        $html = '';
        foreach ($model->fields as $field) {
            $html .= Rendering::imagePreload($field->display, $seen);
        }
        return $html;
    }
}
