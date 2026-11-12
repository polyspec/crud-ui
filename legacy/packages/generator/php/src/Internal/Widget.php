<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/** Evaluate field controls without generating HTML. */
final class Widget
{
    private const KINDS = [
        'text' => 'text',
        'string' => 'text',
        'email' => 'email',
        'number' => 'number',
        'integer' => 'number',
        'float' => 'number',
        'decimal' => 'number',
        'range' => 'range',
        'password' => 'password',
        'textarea' => 'textarea',
        'condition' => 'condition',
        'select' => 'select',
        'dropdown' => 'select',
        'selectbox' => 'select',
        'hidden' => 'hidden',
        'choice' => 'choice',
        'radio' => 'choice',
        'multichoice' => 'multichoice',
        'checkboxes' => 'multichoice',
        'checkcontainer' => 'multichoice',
        'date' => 'date',
        'datetime' => 'datetime',
        'datetime-local' => 'datetime',
        'dummy' => 'dummy',
        'html' => 'dummy',
        'static' => 'dummy',
        'dummy-input' => 'dummy-input',
        'image' => 'image',
        'file' => 'file',
        'cover' => 'cover',
        'cover-simple' => 'cover',
        'image-viewer' => 'image-viewer',
        'search' => 'search',
        'autocomplete' => 'search',
        'tinymce' => 'tinymce',
        'wysiwyg' => 'tinymce',
        'summernote' => 'summernote',
        'editorjs' => 'editorjs',
        'tui' => 'tui',
        'button' => 'button',
        'action' => 'button',
        'tagify' => 'tagify',
        'tagify2' => 'tagify2',
    ];

    private string $id;

    private string $name;

    private string $language;

    private function __construct(
        private stdClass $spec,
        private mixed $value,
        private string $path,
        private stdClass $design,
        private array $options,
        private array $rows
    ) {
        $this->id = Value::controlId($options['idPrefix'] ?? 'crudui', $path);
        $this->name = Value::name($path, $options['keyPrefix'] ?? null);
        $this->language = $options['language'] ?? 'ko';
    }

    /** Evaluate a supported widget model or report its unsupported field type. */
    public static function evaluate(
        stdClass $spec,
        mixed $value,
        string $path,
        stdClass $design,
        array $options,
        array $rows
    ): stdClass {
        $type = Value::string($spec->type ?? '');
        $kind = self::KINDS[strtolower($type)] ?? null;
        if (ChoiceList::is($spec->items ?? null)) {
            // Only the choices of a choice or multichoice field declare their appearance.
            $appearance = $kind === 'choice' || $kind === 'multichoice';
            // Only the choice list of a select field has groups.
            if (ChoiceList::pairs($spec->items, $appearance, $kind === 'select') === null) {
                throw new FormError(
                    'INVALID_FORM_INPUT',
                    'Invalid items at ' . $path . ': expected ' . ChoiceList::EXPECTED
                );
            }
            if ($appearance) {
                ChoiceList::checkAppearance($spec->items, $path);
            }
        }
        if ($kind === null) {
            if (($options['unsupported'] ?? 'throw') === 'marker') {
                return (object) ['unsupported' => true, 'type' => $type];
            }
            throw new FormError(
                'UNSUPPORTED_FIELD_TYPE',
                'Unsupported field type "' . $type . '" at "' . $path . '"',
                $path
            );
        }
        $ctx = new self($spec, $value, $path, $design, $options, $rows);
        $model = match ($kind) {
            'text', 'email', 'number', 'password', 'hidden', 'date', 'datetime', 'dummy-input' => $ctx->input($kind),
            'range' => $ctx->range(),
            'textarea' => $ctx->textarea(),
            'condition' => $ctx->condition(),
            'select', 'search' => $ctx->select($kind),
            'choice', 'multichoice' => $ctx->choices($kind),
            'image', 'file', 'cover' => $ctx->file($kind),
            'dummy', 'image-viewer' => $ctx->display($kind),
            'tinymce', 'summernote', 'editorjs', 'tui', 'tagify', 'tagify2' => $ctx->editor($kind),
            'button' => $ctx->button(),
        };
        if (in_array($model->tag ?? '', ['input', 'select', 'textarea'], true)) {
            $model->attrs->id = $ctx->id;
        }
        if (isset($model->extra->file)) {
            $model->extra->file->id = $ctx->id;
        }
        if ($model->layout === 'choices') {
            foreach ($model->options as $i => $option) {
                $option->id = $ctx->id . ':' . $i;
            }
        }
        // Declared control attributes follow the attributes crudui writes on the control.
        $attributes = Design::declared($spec->design ?? null, false);
        if ($attributes !== Missing::Value) {
            if ($model->layout === 'choices') {
                if (isset($model->extra->input)) {
                    $model->extra->option = $attributes;
                }
            } else {
                $target = $model->extra->file ?? $model->attrs;
                foreach (get_object_vars($attributes) as $name => $attribute) {
                    $target->{$name} = $attribute;
                }
            }
        }
        return $model;
    }

    private function t(mixed $value): string
    {
        return Value::translate($value, $this->language);
    }

    private function opt(string $key, ?string $default = null): ?string
    {
        $value = $this->spec->options->{$key} ?? null;
        return $value === null ? $default : Value::scalar($value);
    }

    private function data(): array
    {
        return [
            'data-name' => Value::leaf($this->path, $this->rows),
            'data-rule-name' => Value::rule($this->path, $this->rows),
            'data-default' => Value::scalar($this->spec->default ?? null),
        ];
    }

    private function main(string $base): string
    {
        return Value::classes($base, $this->design->main->class);
    }

    private function style(): array
    {
        $style = Value::style($this->design->main->style);
        return $style === null ? [] : ['style' => $style];
    }

    /** The one option of a select or search field with no option: value '' and the untranslated text select (CUSC-080). */
    private static function placeholderOption(): object
    {
        return (object) ['value' => '', 'label' => 'select', 'selected' => false, 'isDefault' => false];
    }

    private function placeholder(): array
    {
        $text = $this->t($this->spec->placeholder ?? null);
        return $text === '' ? [] : ['placeholder' => $text];
    }

    private function behavior(): array
    {
        $out = [];
        if (!($this->spec->behavior ?? null) instanceof stdClass) {
            return $out;
        }
        foreach ($this->spec->behavior as $action => $entry) {
            $script = is_string($entry) ? $entry : $entry->script ?? null;
            if (is_string($script) && $script !== '') {
                $out[$action] = $script;
            }
        }
        return $out;
    }

    private function affix(string $kind): mixed
    {
        $text = $this->t($this->spec->{$kind} ?? null);
        if ($text === '') {
            return Missing::Value;
        }
        return Value::record([
            'text' => $text,
            'class' => $kind === 'prepend'
                ? Value::classes('crudui-widget__affix', $this->design->prepend->class)
                : 'crudui-widget__affix',
            'style' => $kind === 'prepend'
                ? Value::style($this->design->prepend->style) ?? Missing::Value
                : Missing::Value,
        ]);
    }

    private function displayValue(): string
    {
        return Value::display($this->value, Value::get($this->spec, 'default'));
    }

    /** Widget model members in their output order (docs/spec/form-runtime.md). */
    private const MEMBERS = [
        'kind',
        'layout',
        'tag',
        'attrs',
        'text',
        'rawHtml',
        'source',
        'options',
        'itemLabelClass',
        'script',
        'styleChrome',
        'prepend',
        'append',
        'extra',
        'condition',
    ];

    private function model(string $kind, string $layout, array $attrs, array $extra = []): stdClass
    {
        $members = array_replace(['kind' => $kind, 'layout' => $layout, 'attrs' => (object) $attrs], $extra);
        return Value::record(array_merge(array_intersect_key(array_flip(self::MEMBERS), $members), $members));
    }

    private function affixes(): array
    {
        return ['prepend' => $this->affix('prepend'), 'append' => $this->affix('append')];
    }

    private function input(string $kind): stdClass
    {
        $type = match ($kind) {
            'datetime' => 'datetime-local',
            'dummy-input' => 'text',
            default => $kind,
        };
        $value = $kind === 'password' ? Value::scalar($this->value) : $this->displayValue();
        if ($kind === 'date' || $kind === 'datetime') {
            $value = Dates::parseUtc($value)?->format($kind === 'datetime' ? 'Y-m-d\TH:i:s' : 'Y-m-d') ?? $value;
        }
        $attrs = ['type' => $type, 'name' => $this->name, 'value' => $value];
        if ($kind === 'number') {
            $attrs['step'] = 'any';
        }
        if ($kind === 'dummy-input') {
            $attrs['readonly'] = '';
        }
        $attrs['class'] = $this->main(
            $kind === 'hidden'
                ? 'valid-target'
                : ($kind === 'dummy-input' ? 'crudui-input' : 'valid-target crudui-input')
        );
        if (in_array($kind, ['text', 'email', 'number', 'dummy-input'], true)) {
            $attrs = array_replace($attrs, $this->placeholder());
        }
        if ($kind !== 'hidden') {
            $attrs = array_replace($attrs, $this->style());
        }
        if (!in_array($kind, ['password', 'hidden', 'dummy-input'], true)) {
            $attrs = array_replace($attrs, $this->behavior());
        }
        $attrs = array_replace(
            $attrs,
            $kind === 'dummy-input' ? ['data-default' => Value::scalar($this->spec->default ?? null)] : $this->data()
        );
        $bare = in_array($kind, ['password', 'hidden', 'datetime'], true);
        return $this->model(
            $kind,
            $bare ? 'bare' : 'widget',
            $attrs,
            ['tag' => 'input', ...$bare ? [] : $this->affixes()]
        );
    }

    /**
     * A range input with the bounds and the step of its required validate.range and validate.step;
     * compilation has checked them.
     */
    private function range(): stdClass
    {
        $value = $this->displayValue();
        $validate = $this->spec->validate;
        $attrs = [
            'type' => 'range',
            'name' => $this->name,
            'value' => $value,
            'min' => Value::scalar($validate->range[0]),
            'max' => Value::scalar($validate->range[1]),
            'step' => Value::scalar($validate->step),
            'class' => $this->main('valid-target crudui-input crudui-input--range'),
            ...$this->style(),
            ...$this->behavior(),
            ...$this->data(),
        ];
        return $this->model('range', 'range', $attrs, ['tag' => 'input', 'text' => $value, ...$this->affixes()]);
    }

    private function textarea(): stdClass
    {
        return $this->model(
            'textarea',
            'widget',
            [
                'name' => $this->name,
                'class' => $this->main('valid-target crudui-input'),
                'rows' => '5',
                ...$this->style(),
                ...$this->behavior(),
                ...$this->data(),
            ],
            ['tag' => 'textarea', 'text' => $this->displayValue(), ...$this->affixes()]
        );
    }

    /**
     * A condition field: a textarea holding the condition text of its tree, marked for the browser
     * bindings that decode it (docs/spec/form-markup.md, Condition fields).
     */
    private function condition(): stdClass
    {
        $default = Value::get($this->spec, 'default');
        $value = $this->value === Missing::Value ? $default : $this->value;
        $design = $this->spec->design ?? null;
        // A structured editor (docs/spec/form-markup.md, Structured condition editor): the textarea keeps the value,
        // hidden while the editor shows it (CUMK-067), visible with a named error otherwise (CUMK-068).
        $editor = $design instanceof stdClass && ($design->editor ?? null) === 'structured'
            ? ConditionEditor::model(
                $value,
                $this->id,
                $this->spec,
                $this->path,
                Messages::forLanguage($this->language)
            )
            : null;
        return $this->model(
            'condition',
            $editor === null ? 'widget' : 'condition',
            [
                'name' => $this->name,
                'class' => $this->main('valid-target crudui-input crudui-input--condition'),
                'rows' => '5',
                'data-crudui-value' => 'json',
                ...$this->style(),
                ...$this->behavior(),
                ...$this->data(),
                'data-default' => Value::condition($default),
                ...($editor === null || property_exists($editor, 'error') ? [] : ['hidden' => '']),
            ],
            [
                'tag' => 'textarea',
                'text' => Value::condition($value),
                ...$this->affixes(),
                ...($editor === null ? [] : ['condition' => $editor]),
            ]
        );
    }

    private function dynamic(): bool
    {
        return ($this->spec->items ?? null) instanceof stdClass && property_exists($this->spec->items, 'model');
    }

    private function source(): stdClass
    {
        $items = $this->spec->items;
        return (object) [
            'data-source-model' => Value::scalar($items->model),
            'data-source-method' => Value::scalar($items->method ?? null),
            'data-source-table' => Value::scalar($items->table ?? null),
            'data-source-relations' => self::json($items->relations ?? []),
        ];
    }

    private function items(): array
    {
        $items = $this->spec->items ?? null;
        if (ChoiceList::is($items)) {
            $out = [];
            foreach (ChoiceList::pairs($items, true, true) ?? [] as [$value, $label]) {
                $out[] = [$value, $label];
            }
            return $out;
        }
        if ($this->dynamic() || (!$items instanceof stdClass && !is_array($items))) {
            return [];
        }
        $out = [];
        foreach ((array) $items as $key => $label) {
            $out[] = [(string) $key, $label];
        }
        return $out;
    }

    private function options(bool $choice = false): array
    {
        $effective = $this->value === Missing::Value
            ? Value::scalar($this->spec->default ?? null)
            : Value::scalar($this->value);
        $out = [];
        foreach ($this->items() as [$value, $label]) {
            $out[] = (object) [
                'value' => $value,
                'label' => $this->t($label) ?: Value::scalar($label),
                'selected' => $effective === $value,
                'isDefault' => $choice
                    && ($this->spec->default ?? null) !== null
                    && !is_array($this->spec->default)
                    && Value::scalar($this->spec->default) === $value,
            ];
        }
        return $out;
    }

    private function select(string $kind): stdClass
    {
        $dynamic = $this->dynamic();
        $source = $dynamic ? $this->source() : null;
        $options = $this->options();
        if ($kind === 'select' && ChoiceList::is($this->spec->items ?? null)) {
            foreach (ChoiceList::groups($this->spec->items) as $index => $group) {
                if ($group !== null) {
                    $options[$index]->group = (object) [
                        'index' => $group['index'],
                        'label' => $this->t($group['label']) ?: Value::scalar($group['label']),
                    ];
                }
            }
        }
        if (!$options) {
            $options = [self::placeholderOption()];
        }
        if ($kind === 'select') {
            $attrs = [
                'name' => $this->name,
                'class' => $this->main(
                    $dynamic
                        ? 'valid-target crudui-input crudui-input--select valid-target-async'
                        : 'valid-target crudui-input crudui-input--select'
                ),
                ...(array) $source,
                ...$this->style(),
                ...$this->behavior(),
                ...$this->data(),
            ];
            return $this->model(
                'select',
                'widget',
                $attrs,
                ['tag' => 'select', 'source' => $source, 'options' => $options, ...$this->affixes()]
            );
        }
        $min = $this->opt('keyword_min_length', '2');
        $delay = $this->opt('delay', '250');
        $attrs = [
            'class' => $this->main(
                $dynamic
                    ? 'valid-target crudui-input crudui-input--select valid-target-async'
                    : 'valid-target crudui-input crudui-input--select'
            ),
            ...$this->style(),
            'name' => $this->name,
            'data-keyword-min-length' => $min,
            'data-delay' => $delay,
            'data-api-server' => $this->opt('api_server', ''),
            ...(array) $source,
            'data-name' => Value::leaf($this->path, $this->rows),
            'data-rule-name' => Value::rule($this->path, $this->rows),
            'id' => $this->id,
        ];
        if (isset($this->behavior()['onchange'])) {
            $attrs['onchange'] = $this->behavior()['onchange'];
        }
        $attrs['data-default'] = Value::scalar($this->spec->default ?? null);
        $callback = $this->opt('callback');
        $callbackJs = $callback
            ? "\$(document.getElementById(" . self::js($this->id) . ")).on('select2:select', " . $callback . ");"
            : '';
        $container = $this->id . '_select2';
        $script = "\$(function() {select2(CSS.escape("
            . self::js($this->id)
            . "), "
            . self::js($min)
            . ", "
            . self::js($delay)
            . ", "
            . self::js($container)
            . ");"
            . $callbackJs
            . "});";
        $style = $this->opt('hide_searching') !== ''
            ? '[class~=' . self::js($container) . '] .loading-results { display: none; }'
            : '';
        return $this->model(
            'search',
            'search',
            $attrs,
            [
                'tag' => 'select',
                'source' => $source,
                'options' => $options,
                ...$this->affixes(),
                'script' => $script,
                'styleChrome' => $style,
            ]
        );
    }

    private function choices(string $kind): stdClass
    {
        $radio = $kind === 'choice';
        // The choices element: its classes, then the class and style of design.group.
        $attrs = [
            'class' => Value::classes(
                $radio ? 'crudui-choices' : 'crudui-choices crudui-choices--multiple',
                $this->design->group->class
            ),
            ...array_filter(
                ['style' => Value::style($this->design->group->style)],
                static fn ($style) => $style !== null && $style !== ''
            ),
        ];
        $labelClass = $this->main('crudui-choices__label');
        if ($this->dynamic()) {
            return $this->model(
                $kind,
                'choices',
                [...$attrs, ...(array) $this->source()],
                ['source' => $this->source(), 'options' => [], 'itemLabelClass' => $labelClass]
            );
        }
        $options = $this->options($radio);
        // Each option has its id (assigned with the control id) before the appearance of its choice.
        $appearances = ChoiceList::is($this->spec->items ?? null) ? ChoiceList::appearances($this->spec->items) : [];
        foreach ($options as $index => $option) {
            $options[$index] = (object) [...get_object_vars($option), 'id' => '', ...$appearances[$index] ?? []];
        }
        if (!$radio) {
            $value = $this->value === Missing::Value ? $this->spec->default ?? null : $this->value;
            $selected = is_array($value)
                ? array_map(Value::string(...), $value)
                : (Value::truthy($value) ? [Value::string($value)] : []);
            foreach ($options as $option) {
                $option->selected = in_array($option->value, $selected, true);
            }
        }
        $shared = [
            'name' => $this->name . ($radio ? '' : '[]'),
            'data-name' => Value::leaf($this->path, $this->rows),
            'data-rule-name' => Value::rule($this->path, $this->rows),
        ];
        foreach ($this->behavior() as $action => $script) {
            if ($action === 'onchange' || $radio && $action === 'onclick') {
                $shared[$action] = $script;
            }
        }
        return $this->model(
            $kind,
            'choices',
            $attrs,
            [
                'source' => null,
                'options' => $options,
                'itemLabelClass' => $labelClass,
                'extra' => (object) ['input' => (object) $shared],
            ]
        );
    }

    private function file(string $kind): stdClass
    {
        $cover = $kind === 'cover';
        $file = ['type' => 'file', 'class' => $this->main('valid-target crudui-input crudui-input--file')];
        foreach (
            ['max_width', 'min_width', 'max_height', 'min_height', 'preview_max_width', 'preview_max_height'] as $size
        ) {
            $file['data-' . str_replace('_', '-', $size)] = $this->opt($size, '0');
        }
        $file['name'] = $this->name . ($cover ? '[name]' : '');
        $file['data-name'] = Value::leaf($this->path, $this->rows);
        $file['data-rule-name'] = Value::rule($this->path, $this->rows);
        $file = array_replace($file, $this->behavior());
        if (!$cover) {
            $file['value'] = '';
        }
        $accept = $this->spec->validate->accept
            ?? $this->spec->options->accept
            ?? ($kind === 'file' ? '*/*' : 'image/*');
        $file['accept'] = Value::scalar($accept);
        $extra = [];
        if (!$cover) {
            $extra['display'] = (object) ['type' => 'text', 'class' => 'crudui-input', 'value' => '', 'readonly' => ''];
        }
        $extra['file'] = (object) $file;
        return $this->model($kind, 'file', [], ['prepend' => $this->affix('prepend'), 'extra' => (object) $extra]);
    }

    private function display(string $kind): stdClass
    {
        if ($kind === 'image-viewer') {
            $height = $this->opt('height', '');
            $html = '이미지가 없습니다.';
            if (is_array($this->value) && $this->value !== []) {
                $html = implode(
                    '',
                    array_map(
                        static fn ($v) => '<img src="'
                            . Value::scalar($v)
                            . '"'
                            . ($height !== '' ? ' height="' . $height . '"' : '')
                            . '>',
                        $this->value
                    )
                );
            }
            return $this->model(
                $kind,
                'display',
                $this->design->main->class !== '' ? ['class' => $this->design->main->class] : [],
                ['tag' => 'div', 'rawHtml' => $html]
            );
        }
        $value = $this->value;
        $default = Value::scalar($this->spec->default ?? null);
        if ($value === Missing::Value && $default !== '' && $default !== '0') {
            $value = $this->spec->default;
        }
        if (ChoiceList::is($this->spec->items ?? null)) {
            $text = Value::scalar($value);
            foreach (ChoiceList::pairs($this->spec->items) ?? [] as [$choice, $label]) {
                if ($choice === $text) {
                    $value = $label;
                    break;
                }
            }
        } elseif (($this->spec->items ?? null) instanceof stdClass && !$this->dynamic()) {
            $found = Value::get($this->spec->items, Value::scalar($value));
            if ($found !== Missing::Value) {
                $value = $found;
            }
        }
        $html = Value::scalar($value);
        if ($html !== '' && $html !== '0') {
            $html = preg_replace('/(\r\n|\n\r|\r|\n)/', '<br />$1', $html);
        }
        return $this->model(
            'dummy',
            'display',
            [...$this->design->main->class !== '' ? ['class' => $this->design->main->class] : [], ...$this->style()],
            ['tag' => 'div', 'rawHtml' => $html]
        );
    }

    private function editor(string $kind): stdClass
    {
        $tagify = $kind === 'tagify' || $kind === 'tagify2';
        $height = $this->opt('height', '300');
        $base = match ($kind) {
            'tinymce' => 'valid-target crudui-input tinymcearea',
            'summernote' => 'valid-target crudui-input summernote',
            'editorjs' => 'valid-target crudui-input contentjs',
            'tui' => 'valid-target crudui-input tuiarea',
            default => 'valid-target crudui-input',
        };
        $attrs = $tagify
            ? [
                'type' => 'text',
                'id' => $this->id,
                'class' => $this->main($base),
                'name' => $this->name,
                'value' => $this->displayValue(),
                'data-max-tags' => $this->opt('max_tags', '0'),
            ]
            : [
                'id' => $this->id,
                'class' => $this->main($base),
                'name' => $this->name,
                'rows' => $this->opt('rows', $kind === 'summernote' ? '5' : '3'),
            ];
        if ($kind === 'tinymce') {
            $attrs = array_replace(
                $attrs,
                [
                    'data-type' => Value::string($this->spec->type ?? 'tinymce'),
                    'data-height' => $height,
                    'data-upload-server' => $this->opt('fileserver', 'upload'),
                ]
            );
        }
        if ($kind === 'editorjs' || $kind === 'tui') {
            $attrs['data-fileserver'] = $this->opt('fileserver', '');
        }
        if ($kind === 'tagify2') {
            $attrs['data-server'] = $this->opt('server', '');
        }
        if ($tagify) {
            $attrs = array_replace($attrs, $this->placeholder());
        }
        $attrs = array_replace($attrs, $this->behavior(), $this->data());
        $selector = "'#'+CSS.escape(" . self::js($this->id) . ')';
        $arguments = match ($kind) {
            'tinymce' => $selector . ', ' . $height . ', ' . self::js($this->opt('fileserver', 'upload')) . ', false',
            'summernote' => $selector . ', ' . self::js($this->opt('upload', 'upload')),
            'editorjs', 'tui' => $selector . ', ' . self::js($this->opt('fileserver', '')),
            'tagify' => $selector . ', ' . $this->opt('max_tags', '0'),
            'tagify2' => $selector . ', ' . $this->opt('max_tags', '0') . ', ' . self::js($this->opt('server', '')),
        };
        return $this->model(
            $kind,
            'host-script',
            $attrs,
            [
                'tag' => $tagify ? 'input' : 'textarea',
                'text' => $tagify ? Missing::Value : $this->displayValue(),
                'script' => '$(function() {editor_' . $kind . '(' . $arguments . ');});',
            ]
        );
    }

    /** A button element with the content text; behavior scripts are its event attributes. */
    private function button(): stdClass
    {
        $text = property_exists($this->spec, 'content') ? $this->t($this->spec->content) : '';
        return $this->model(
            'button',
            'button',
            [
                'type' => 'button',
                'class' => $this->main('crudui-action crudui-action--text'),
                ...$this->style(),
                'id' => $this->id,
                ...$this->behavior(),
            ],
            ['tag' => 'button', 'text' => $text]
        );
    }

    /** JSON text as JSON.stringify writes it, each number as Numbers::string writes it. */
    private static function json(mixed $value): string
    {
        if (is_int($value) || is_float($value)) {
            return Numbers::string($value);
        }
        if (is_array($value) && array_is_list($value)) {
            return '[' . implode(',', array_map(self::json(...), $value)) . ']';
        }
        if (is_array($value) || $value instanceof stdClass) {
            $members = [];
            foreach ((array) $value as $key => $member) {
                $members[] = self::json((string) $key) . ':' . self::json($member);
            }
            return '{' . implode(',', $members) . '}';
        }
        return json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR
        );
    }

    private static function js(string $value): string
    {
        return str_replace(
            '<',
            '\u003c',
            json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
        );
    }
}
