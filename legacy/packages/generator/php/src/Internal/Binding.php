<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/** Bind compiled fields to data as nodes of the recursive form grammar. */
final class Binding
{
    private const LANGUAGES = ['ko', 'en', 'ja', 'zh'];

    /** Evaluate every field using one template and record. */
    public static function bind(stdClass $template, mixed $data, array $options): array
    {
        $template = Template::checked($template);
        $data = Value::formData($data);
        $options['language'] = self::language($options);
        foreach (['keyPrefix', 'idPrefix'] as $name) {
            if (($options[$name] ?? null) !== null && !is_string($options[$name])) {
                throw new FormError('INVALID_FORM_INPUT', $name . ' must be a string');
            }
        }
        if (
            ($options['unsupported'] ?? null) !== null
            && !in_array($options['unsupported'], ['throw', 'marker'], true)
        ) {
            throw new FormError('INVALID_FORM_INPUT', 'unsupported must be throw or marker');
        }
        $options['messages'] = Messages::forLanguage($options['language']);
        $options['keyPrefix'] ??= $template->keyPrefix ?? null;
        $options = ['rowSegments' => [], 'rowNumbers' => [], 'stickyDepth' => 0, ...$options];
        $options['rowSegments'] = $options['rowNumbers'] = [];
        $options['stickyDepth'] = 0;
        return array_map(static fn ($field) => self::field($field, $field->name, $data, $options), $template->fields);
    }

    /** The checked language option, defaulting to Korean. */
    public static function language(array $options): string
    {
        $language = $options['language'] ?? 'ko';
        // Callers can pass decoded JSON; each text option is a string when present.
        if (!is_string($language)) {
            throw new FormError('INVALID_FORM_INPUT', 'Language must be a string');
        }
        return $language;
    }

    /** Build the node for one field and its group, collection or language children. */
    public static function field(stdClass $field, string $path, stdClass $data, array $state): stdClass
    {
        $spec = $field->spec;
        $design = Design::resolve($spec->design ?? null, $data, Value::segments($path), $state['rowSegments']);
        $label = Value::truthy($spec->label ?? null)
            ? Value::translate($spec->label, $state['language'])
            : Missing::Value;
        $description = Value::truthy($spec->description ?? null)
            ? Value::translate($spec->description, $state['language'])
            : Missing::Value;
        $multiple = self::multiple($spec);
        if ($multiple !== null) {
            return self::collection($field, $path, $data, $design, $label, $description, $multiple, $state);
        }
        if (($spec->type ?? null) === 'group') {
            self::checkGroup(Value::path($data, $path), $path);
            $layout = self::declaredLayout($spec);
            $root = self::root('group', $path, $design, $spec);
            // A line group is one row in an inline layout, and its children take no inline layout.
            if ($layout === 'line') {
                $root['className'] = Value::classes(
                    ($state['layout'] ?? null) === 'inline' ? 'crudui-node--inline' : '',
                    'crudui-node--line',
                    $root['className']
                );
            }
            return Value::record([
                ...$root,
                'header' => self::header(['label' => $label, 'description' => $description], $design),
                'body' => self::body($design->group->class, $design->group->style),
                'children' => self::children($field, $path, $data, self::layoutState($state, $layout)),
            ]);
        }
        $lang = $spec->lang ?? null;
        if ($lang === true || $lang instanceof stdClass) {
            return self::lang($spec, $path, $data, $design, $label, $description, $lang, $state);
        }
        return self::leaf($spec, $path, $data, $design, $label, $description, $state);
    }

    /** The design.layout a group declares; compilation has checked the value. */
    private static function declaredLayout(stdClass $spec): ?string
    {
        $layout = ($spec->design ?? null) instanceof stdClass ? $spec->design->layout ?? null : null;
        return is_string($layout) ? $layout : null;
    }

    /** The state of a group's children: a declared layout replaces the inherited one, and a line ends it. */
    private static function layoutState(array $state, ?string $layout): array
    {
        if ($layout === null) {
            return $state;
        }
        unset($state['layout']);
        if ($layout === 'inline') {
            $state['layout'] = 'inline';
        }
        return $state;
    }

    /** Evaluated controls and limits for a repeated field, or null when the field does not repeat. */
    private static function multiple(stdClass $spec): ?array
    {
        $multiple = $spec->multiple ?? null;
        if ($multiple === true || $multiple === 'only') {
            return [
                'only' => $multiple === 'only',
                'copy' => false,
                'sortable' => false,
                'controls' => 'header',
                'header' => 'static',
            ];
        }
        if (!$multiple instanceof stdClass) {
            return null;
        }
        $settings = ['only' => ($multiple->only ?? null) === true];
        foreach (['min', 'max'] as $key) {
            if (is_int($multiple->{$key} ?? null) || is_float($multiple->{$key} ?? null)) {
                $settings[$key] = $multiple->{$key};
            }
        }
        $settings['copy'] = ($multiple->copy ?? null) === true;
        $settings['sortable'] = ($multiple->sortable ?? null) === true;
        if (is_string($multiple->title ?? null)) {
            $settings['title'] = $multiple->title;
        }
        $settings['controls'] = in_array($multiple->controls ?? null, ['footer', 'outline'], true)
            ? $multiple->controls
            : 'header';
        $settings['header'] = ($multiple->header ?? null) === 'sticky' ? 'sticky' : 'static';
        return $settings;
    }

    private static function root(string $kind, string $path, stdClass $design, stdClass $spec): array
    {
        return [
            'kind' => $kind,
            'path' => $path,
            'className' => $design->wrapper->class,
            'style' => Value::style($design->wrapper->style) ?? Missing::Value,
            'attributes' => Design::declared($spec->design ?? null, true),
            'hidden' => !$design->show,
        ];
    }

    /** Header with the given parts, or the missing marker when every part is empty. */
    private static function header(array $parts, stdClass $design): stdClass|Missing
    {
        $present = array_filter($parts, static fn ($value) => $value !== Missing::Value && $value !== '');
        if ($present === []) {
            return Missing::Value;
        }
        return Value::record([
            'className' => $design->label->class,
            'style' => Value::style($design->label->style) ?? Missing::Value,
            ...$present,
        ]);
    }

    private static function body(string $className = '', mixed $style = null, ?string $id = null): stdClass
    {
        return Value::record([
            'className' => $className,
            'style' => Value::style($style) ?? Missing::Value,
            'id' => $id ?? Missing::Value,
        ]);
    }

    private static function action(string $name, string $label, bool $disabled): stdClass
    {
        return (object) ['name' => $name, 'label' => $label, 'disabled' => $disabled];
    }

    private static function leaf(
        stdClass $spec,
        string $path,
        stdClass $data,
        stdClass $design,
        string|Missing $label,
        string|Missing $description,
        array $state
    ): stdClass {
        $type = Value::string($spec->type ?? '');
        $value = Value::path($data, $path);
        $root = self::root('field', $path, $design, $spec);
        // A field node of an inline layout is one row of a label column and a control column.
        $inline = ($state['layout'] ?? null) === 'inline';
        if ($inline) {
            $root['className'] = Value::classes('crudui-node--inline', $root['className']);
        }
        if ($type === 'checkbox' || $type === 'switcher') {
            $id = Value::controlId($state['idPrefix'] ?? 'crudui', $path);
            // An inline layout writes the label in the label column of the header instead of the caption.
            $headerLabel = $inline && $label !== Missing::Value && $label !== '';
            $checkedValue = $value === Missing::Value ? $spec->default ?? null : $value;
            // A switcher is a checkbox input announced and drawn as a switch.
            $switcher = $type === 'switcher';
            $checkbox = Value::record([
                'id' => $id,
                'name' => Value::name($path, $state['keyPrefix'] ?? null),
                'className' => Value::classes(
                    'valid-target',
                    $switcher ? 'crudui-input crudui-input--switch' : '',
                    $design->main->class
                ),
                'checked' => in_array($checkedValue, [true, 1, '1'], true),
                'role' => $switcher ? 'switch' : Missing::Value,
                'caption' => $headerLabel ? Missing::Value : ($label === Missing::Value ? '' : $label),
                'attributes' => Design::declared($spec->design ?? null, false),
            ]);
            $header = self::header(
                $headerLabel
                    ? ['label' => $label, 'labelFor' => $id, 'description' => $description]
                    : ['description' => $description],
                $design
            );
            return Value::record([...$root, 'header' => $header, 'body' => self::body(), 'checkbox' => $checkbox]);
        }
        $widget = Widget::evaluate(
            ChoiceList::resolve($spec, $data),
            $value,
            $path,
            $design,
            $state,
            $state['rowSegments']
        );
        if ($type === 'hidden') {
            return Value::record([...$root, 'body' => self::body(), 'widget' => $widget]);
        }
        $labelFor = $label !== Missing::Value && $label !== '' && !($widget->unsupported ?? false)
            ? $widget->extra->file->id ?? $widget->attrs->id ?? Missing::Value
            : Missing::Value;
        return Value::record([
            ...$root,
            'header' => self::header(
                ['label' => $label, 'labelFor' => $labelFor, 'description' => $description],
                $design
            ),
            'body' => self::body(),
            'widget' => $widget,
        ]);
    }

    private static function collection(
        stdClass $field,
        string $path,
        stdClass $data,
        stdClass $design,
        string|Missing $label,
        string|Missing $description,
        array $settings,
        array $state
    ): stdClass {
        $value = Value::path($data, $path);
        if ($value === Missing::Value) {
            // Missing data has one initial row, or none in a data-only collection.
            $keys = $settings['only'] ? [] : ['__0000000000000__'];
        } elseif ($value instanceof stdClass) {
            $keys = array_map('strval', array_keys(get_object_vars($value)));
        } else {
            throw new FormError('INVALID_FORM_INPUT', 'Repeated data must be a keyed object: ' . $path);
        }
        $item = ($field->spec->type ?? null) === 'group' ? 'group' : 'field';
        $rowsState = $item === 'group' ? self::layoutState($state, self::declaredLayout($field->spec)) : $state;
        $rows = [];
        foreach ($keys as $index => $key) {
            $rows[] = self::row($field, $path, $key, $index, count($keys), $item, $label, $settings, $data, $rowsState);
        }
        $messages = $state['messages'];
        $controls = Missing::Value;
        if ($keys === [] && !$settings['only']) {
            $full = isset($settings['max']) && count($keys) >= $settings['max'];
            $controls = (object) [
                'placement' => 'footer',
                'label' => $messages['collectionControls'],
                'actions' => [self::action('add-row', $messages['addRow'], $full)],
            ];
        }
        $header = self::header(
            [
                'label' => $label,
                'description' => $description,
                'count' => Messages::count($messages['count'], count($keys)),
            ],
            $design
        );
        return Value::record([
            ...self::root('collection', $path, $design, $field->spec),
            'header' => $header,
            'body' => self::body(),
            'item' => $item,
            'controls' => $controls,
            'children' => $rows,
        ]);
    }

    private static function row(
        stdClass $field,
        string $collectionPath,
        string $key,
        int $index,
        int $count,
        string $item,
        string|Missing $label,
        array $settings,
        stdClass $data,
        array $state
    ): stdClass {
        $spec = $field->spec;
        $messages = $state['messages'];
        $label = $label === '' ? Missing::Value : $label;
        $rowPath = $collectionPath . '.' . $key;
        $rowDesign = Design::resolve(
            $spec->design ?? null,
            $data,
            Value::segments($rowPath),
            [...$state['rowSegments'], count(Value::segments($collectionPath))]
        );
        $numbers = [...$state['rowNumbers'], $index + 1];
        $sticky = $settings['header'] === 'sticky';
        $rowState = [
            'rowSegments' => [...$state['rowSegments'], count(Value::segments($collectionPath))],
            'rowNumbers' => $numbers,
            'stickyDepth' => $state['stickyDepth'] + ($sticky ? 1 : 0),
        ]
            + $state;
        $full = isset($settings['max']) && $count >= $settings['max'];
        $actions = [];
        if ($settings['sortable']) {
            $actions[] = self::action('move-up', $messages['moveUp'], $index === 0);
            $actions[] = self::action('move-down', $messages['moveDown'], $index === $count - 1);
        }
        $actions[] = self::action('add-row', $messages['addRow'], $full);
        if ($settings['copy']) {
            $actions[] = self::action('copy-row', $messages['copyRow'], $full);
        }
        $actions[] = self::action(
            'remove-row',
            $messages['removeRow'],
            isset($settings['min']) && $count <= $settings['min']
        );
        $row = ['kind' => 'row', 'key' => $key, 'className' => '', 'hidden' => false];
        // Rows of a data-only collection have no row controls.
        if (!$settings['only']) {
            $row['controls'] = (object) [
                'placement' => $settings['controls'],
                'label' => $messages['rowControls'],
                'actions' => $actions,
            ];
        }
        if ($sticky) {
            $row += ['sticky' => true, 'stickyDepth' => $state['stickyDepth']];
        }
        $number = implode('.', $numbers);
        if ($item === 'field') {
            $widget = Widget::evaluate(
                ChoiceList::resolve($spec, $data),
                Value::path($data, $rowPath),
                $rowPath,
                $rowDesign,
                $rowState,
                $rowState['rowSegments']
            );
            return Value::record([
                ...$row,
                'header' => Value::record(['className' => '', 'label' => $label, 'number' => $number]),
                'body' => self::body(),
                'widget' => $widget,
            ]);
        }
        self::checkGroup(Value::path($data, $rowPath), $rowPath);
        $children = self::children($field, $rowPath, $data, $rowState);
        $nested = array_filter($children, static fn ($child) => $child->kind === 'collection');
        $summary = $nested === []
            ? $messages['collapsed']
            : Messages::count(
                $messages['children'],
                array_sum(array_map(static fn ($child) => count($child->children), $nested))
            );
        $title = Missing::Value;
        if (isset($settings['title'])) {
            $value = Value::path($data, $rowPath . '.' . $settings['title']);
            $title = $value === Missing::Value || $value === null || $value === ''
                ? $messages['untitled']
                : Value::string($value);
        }
        $header = Value::record([
            'className' => '',
            'label' => $label,
            'number' => $number,
            'title' => $title,
            'summary' => $summary,
        ]);
        $body = self::body(
            $rowDesign->group->class,
            $rowDesign->group->style,
            Value::controlId($state['idPrefix'] ?? 'crudui', $rowPath) . ':body'
        );
        return Value::record([
            ...$row,
            'header' => $header,
            'body' => $body,
            'collapsible' => true,
            'expanded' => !in_array($rowPath, $state['collapsed'] ?? [], true),
            'toggleLabel' => $messages['toggleRow'],
            'children' => $children,
        ]);
    }

    private static function lang(
        stdClass $spec,
        string $path,
        stdClass $data,
        stdClass $design,
        string|Missing $label,
        string|Missing $description,
        true|stdClass $lang,
        array $state
    ): stdClass {
        $settings = $lang instanceof stdClass ? $lang : new stdClass();
        $codes = is_array($settings->only ?? null) && $settings->only !== [] ? $settings->only : self::LANGUAGES;
        $title = Value::truthy($settings->title ?? null) ? Value::translate($settings->title, $state['language']) : '';
        $frame = ($settings->frame ?? null) !== false;
        $groupClass = is_string($settings->group_class ?? null) ? $settings->group_class : '';
        $children = [];
        foreach ($codes as $code) {
            $langPath = $path . '.' . Value::string($code);
            $langDesign = Design::resolve(
                $spec->design ?? null,
                $data,
                Value::segments($langPath),
                $state['rowSegments']
            );
            $children[] = (object) [
                'kind' => 'lang-item',
                'lang' => $code,
                'className' => '',
                'hidden' => false,
                'header' => (object) ['className' => '', 'label' => $code],
                'body' => self::body(),
                'widget' => Widget::evaluate(
                    ChoiceList::resolve($spec, $data),
                    Value::path($data, $langPath),
                    $langPath,
                    $langDesign,
                    $state,
                    $state['rowSegments']
                ),
            ];
        }
        $header = self::header(['label' => $label, 'description' => $description, 'title' => $title], $design);
        $root = self::root('lang', $path, $design, $spec);
        // A framed language group is a node modifier; the stylesheet draws the frame around its body.
        $root['className'] = Value::classes($frame ? 'crudui-node--framed' : '', $root['className']);
        return Value::record([
            ...$root,
            'header' => $header,
            'body' => self::body(Value::classes($groupClass)),
            'children' => $children,
        ]);
    }

    /** Present group data, including a repeated group row, must be an object. */
    private static function checkGroup(mixed $value, string $path): void
    {
        if ($value !== Missing::Value && !$value instanceof stdClass) {
            throw new FormError('INVALID_FORM_INPUT', 'Group data must be an object: ' . $path);
        }
    }

    private static function children(stdClass $field, string $path, stdClass $data, array $state): array
    {
        return array_map(
            static fn ($child) => self::field($child, $path . '.' . $child->name, $data, $state),
            $field->children
        );
    }
}
