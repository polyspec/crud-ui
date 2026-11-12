<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use stdClass;

/** Serialize evaluated form models as HTML. */
final class Rendering
{
    /** Escape ordinary text or explicit raw-control text. */
    public static function text(string $value, bool $raw = false): string
    {
        return strtr(
            $value,
            $raw
                ? ['&' => '&amp;', '<' => '&lt;', '>' => '&gt;']
                : ['&' => '&amp;', '<' => '&lt;', '>' => '&gt;', '"' => '&quot;', "'" => '&#x27;']
        );
    }

    /** Reject javascript URLs in ordinary link and image attributes. */
    public static function url(string $value): string
    {
        if (
            preg_match(
                '/^[\x00-\x1f ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]'
                    . '*p[\r\n\t]*t[\r\n\t]*:/i',
                $value
            )
        ) {
            return "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')";
        }
        return $value;
    }

    /**
     * The preload link of an image display, or '' for a display that is no image, has no source, a data URL as its
     * source, or a source that `$seen` already holds; the link's source is added to `$seen`.
     *
     * @param array<string, true> $seen the sources that have a link
     */
    public static function imagePreload(mixed $display, array &$seen): string
    {
        if (!$display instanceof stdClass || ($display->kind ?? '') !== 'image') {
            return '';
        }
        $source = $display->src ?? '';
        if ($source === '' || str_starts_with(strtolower($source), 'data:') || isset($seen[$source])) {
            return '';
        }
        $seen[$source] = true;
        return '<link' . self::attrs(['rel' => 'preload', 'as' => 'image', 'href' => self::url($source)]) . '/>';
    }

    /** Escape attributes and serialize ordinary or explicit raw styles. */
    public static function attrs(array|stdClass $attrs, bool $raw = false): string
    {
        $out = '';
        foreach ($attrs as $name => $value) {
            if (!$raw && $name === 'style' && is_string($value)) {
                $value = Style::rendered($value);
            }
            if ($value === null || $value === Missing::Value) {
                continue;
            }
            $escaped = $raw
                ? strtr(Value::scalar($value), ['&' => '&amp;', '"' => '&quot;', '<' => '&lt;'])
                : self::text(Value::scalar($value));
            if (!$raw) {
                $name = [
                    'autocomplete' => 'autoComplete',
                    'readonly' => 'readOnly',
                    'autofocus' => 'autofocus',
                    'tabindex' => 'tabindex',
                    'maxlength' => 'maxLength',
                    'minlength' => 'minLength',
                    'colspan' => 'colSpan',
                    'rowspan' => 'rowSpan',
                ][$name]
                    ?? $name;
            }
            $out .= ' ' . $name . '="' . $escaped . '"';
        }
        return $out;
    }

    /** Serialize a non-void element with an already rendered body. */
    public static function element(
        string $tag,
        array|stdClass $attrs = [],
        string $body = '',
        bool $raw = false
    ): string {
        return '<' . $tag . self::attrs($attrs, $raw) . '>' . $body . '</' . $tag . '>';
    }

    /** Serialize an input, an ordinary one with its name, checked and value last. */
    public static function input(array|stdClass $attrs, bool $raw = false): string
    {
        if (!$raw) {
            $attrs = (array) $attrs;
            $values = [];
            foreach (['name', 'checked', 'value'] as $key) {
                if (array_key_exists($key, $attrs)) {
                    $values[$key] = $attrs[$key];
                    unset($attrs[$key]);
                }
            }
            $attrs = [...self::controlAttrs($attrs), ...$values];
        }
        return '<input' . self::attrs($attrs, $raw) . ($raw ? '>' : '/>');
    }

    private static function controlAttrs(array|stdClass $attrs): array
    {
        $attrs = (array) $attrs;
        if (array_key_exists('style', $attrs)) {
            $style = $attrs['style'];
            unset($attrs['style']);
            $attrs['style'] = $style;
        }
        return $attrs;
    }

    private static function script(string $script): string
    {
        return '<script nonce="">' . $script . '</script>';
    }

    /**
     * Render the complete form: the form element and hidden inputs of the model around the
     * crudui-form block with the root description when it is not empty, the form errors, nodes
     * and footer.
     *
     * @param array{form: ?array<string, string>, hidden: list<array{string, string}>, formErrors: list<string>,
     * nodeErrors: array<int, list<string>>} $model
     */
    public static function form(
        array $nodes,
        array $buttons,
        array $messages,
        array $model = FormRender::EMPTY,
        string $description = ''
    ): string {
        $descriptionHtml = $description === ''
            ? ''
            : self::element('p', ['class' => 'crudui-form__description'], self::text($description));
        $footer = self::element(
            'div',
            ['class' => 'crudui-form__footer'],
            self::element(
                'div',
                ['class' => 'crudui-controls', 'role' => 'group', 'aria-label' => $messages['formActions']],
                Buttons::html($buttons)
            )
        );
        $formErrors = $model['formErrors'] === []
            ? ''
            : self::element(
                'div',
                ['class' => 'crudui-form__errors'],
                implode(
                    '',
                    array_map(
                        static fn (string $text) => self::element(
                            'p',
                            ['class' => 'crudui-form__error'],
                            self::text($text)
                        ),
                        $model['formErrors']
                    )
                )
            );
        $body = implode('', array_map(static fn (stdClass $vm) => self::node($vm, $model['nodeErrors']), $nodes));
        $block = self::element(
            'div',
            ['class' => 'crudui-form'],
            $descriptionHtml . $formErrors . self::element('div', ['class' => 'crudui-form__body'], $body) . $footer
        );
        if ($model['form'] === null) {
            return $block;
        }
        $hidden = implode(
            '',
            array_map(
                static fn (array $pair) => self::input(['type' => 'hidden', 'name' => $pair[0], 'value' => $pair[1]]),
                $model['hidden']
            )
        );
        return self::element('form', $model['form'], $hidden . $block);
    }

    /**
     * The errors slot of a node: one paragraph per message, present only with messages.
     *
     * @param list<string> $messages
     */
    private static function errors(array $messages): string
    {
        return $messages === []
            ? ''
            : self::element(
                'div',
                ['class' => 'crudui-node__errors'],
                implode(
                    '',
                    array_map(
                        static fn (string $text) => self::element(
                            'p',
                            ['class' => 'crudui-node__error'],
                            self::text($text)
                        ),
                        $messages
                    )
                )
            );
    }

    /** Join non-empty class names without normalizing their contents. */
    private static function classes(string ...$parts): string
    {
        return implode(' ', array_filter($parts, static fn ($part) => $part !== ''));
    }

    /** Open a div with an optional valueless hidden attribute and then the declared attributes. */
    private static function open(array $attrs, bool $hidden, array $declared = []): string
    {
        return '<div' . self::attrs($attrs) . ($hidden ? ' hidden=""' : '') . self::attrs($declared) . '>';
    }

    /** @param array<int, list<string>> $errors error texts by node object id */
    private static function node(stdClass $vm, array $errors): string
    {
        $style = $vm->style ?? null;
        if ($vm->sticky ?? false) {
            // A sticky row carries its depth on the root; the stylesheet derives its sticky line from it.
            $style = implode(
                '; ',
                array_filter(
                    [$vm->style ?? '', '--crudui-sticky-depth: ' . ($vm->stickyDepth ?? 0)],
                    static fn ($part) => $part !== ''
                )
            );
        }
        $attrs = [
            'class' => self::classes(
                'crudui-node',
                'crudui-node--' . $vm->kind,
                ($vm->sticky ?? false) ? 'crudui-node--sticky' : '',
                $vm->className
            ),
            'style' => $style,
        ];
        if ($vm->kind !== 'row' && $vm->kind !== 'lang-item' && isset($vm->path)) {
            $attrs['data-field-path'] = $vm->path;
        }
        if (isset($vm->key)) {
            $attrs['data-crudui-row-key'] = $vm->key;
        }
        if (isset($vm->lang)) {
            $attrs['data-lang'] = $vm->lang;
        }
        $footer = ($vm->controls->placement ?? null) === 'footer'
            ? self::element('div', ['class' => 'crudui-node__footer'], self::controls($vm->controls))
            : '';
        $header = self::header($vm);
        if (($vm->sticky ?? false) && $header !== '') {
            $header = self::element('div', ['class' => 'crudui-node__header-container'], $header);
        }
        return self::open($attrs, $vm->hidden, (array) ($vm->attributes ?? []))
            . $header
            . self::body($vm, $errors)
            . self::errors($errors[spl_object_id($vm)] ?? [])
            . $footer
            . '</div>';
    }

    private static function header(stdClass $vm): string
    {
        $header = $vm->header ?? new stdClass();
        $parts = '';
        if ($vm->collapsible ?? false) {
            $parts .= '<button'
                . self::attrs([
                    'type' => 'button',
                    'class' => 'crudui-action',
                    'data-crudui-action' => 'toggle-row',
                    'aria-expanded' => ($vm->expanded ?? false) === true ? 'true' : 'false',
                    'aria-controls' => $vm->body->id ?? null,
                    'aria-label' => $vm->toggleLabel ?? null,
                ])
                . '></button>';
        }
        if (isset($header->label)) {
            $label = self::text(Value::scalar($header->label));
            $parts .= ($header->labelFor ?? '') !== ''
                ? self::element('label', ['class' => 'crudui-node__label', 'for' => $header->labelFor], $label)
                : self::element('span', ['class' => 'crudui-node__label'], $label);
        }
        if (isset($header->description)) {
            $parts .= self::element('p', ['class' => 'crudui-node__description'], self::text($header->description));
        }
        foreach (['number', 'title'] as $part) {
            if (isset($header->{$part})) {
                $parts .= self::element('span', ['class' => 'crudui-node__' . $part], self::text($header->{$part}));
            }
        }
        if (isset($header->summary)) {
            $parts .= '<span class="crudui-node__summary"'
                . (($vm->expanded ?? false) === true ? ' hidden=""' : '')
                . '>'
                . self::text($header->summary)
                . '</span>';
        }
        if (isset($header->count)) {
            $parts .= self::element('span', ['class' => 'crudui-node__count'], self::text($header->count));
        }
        if (($vm->controls->placement ?? null) === 'header') {
            $parts .= self::controls($vm->controls);
        }
        if ($parts === '') {
            return '';
        }
        return self::element(
            'div',
            [
                'class' => self::classes('crudui-node__header', $header->className ?? ''),
                'style' => $header->style ?? '',
            ],
            $parts
        );
    }

    /** @param array<int, list<string>> $errors error texts by node object id */
    private static function body(stdClass $vm, array $errors): string
    {
        $attrs = [
            'class' => self::classes('crudui-node__body', $vm->body->className),
            'style' => $vm->body->style ?? null,
            'id' => $vm->body->id ?? null,
        ];
        if (isset($vm->checkbox)) {
            $box = $vm->checkbox;
            $input = ['class' => $box->className, 'id' => $box->id, 'name' => $box->name, 'type' => 'checkbox'];
            if (isset($box->role)) {
                $input['role'] = $box->role;
            }
            $input['value'] = '1';
            if ($box->checked) {
                $input['checked'] = '';
            }
            $input = [...$input, ...(array) ($box->attributes ?? [])];
            $inner = self::input($input)
                . (isset($box->caption) ? self::element('label', ['for' => $box->id], self::text($box->caption)) : '');
        } elseif (isset($vm->widget)) {
            $inner = self::widget($vm->widget);
        } else {
            $inner = implode(
                '',
                array_map(static fn (stdClass $child) => self::node($child, $errors), $vm->children ?? [])
            );
        }
        return self::open($attrs, ($vm->collapsible ?? false) === true && ($vm->expanded ?? false) !== true)
            . $inner
            . '</div>';
    }

    private static function controls(stdClass $controls): string
    {
        $buttons = '';
        foreach ($controls->actions as $action) {
            $buttons .= '<button'
                . self::attrs([
                    'type' => 'button',
                    'class' => 'crudui-action',
                    'data-crudui-action' => $action->name,
                    'aria-label' => $action->label,
                ])
                . ($action->disabled ? ' aria-disabled="true"' : '')
                . '></button>';
        }
        return self::element(
            'div',
            ['class' => 'crudui-controls', 'role' => 'group', 'aria-label' => $controls->label],
            $buttons
        );
    }

    /** Serialize the prepend or append affix of a widget, or nothing without one. */
    public static function affix(?stdClass $affix, bool $raw = false): string
    {
        return $affix === null
            ? ''
            : self::element(
                'span',
                array_filter(
                    ['class' => $affix->class ?? null, 'style' => $affix->style ?? null],
                    static fn ($v) => $v !== null && $v !== ''
                ),
                self::text($affix->text, $raw),
                $raw
            );
    }

    /** Serialize the control element of a widget model: its input, select, textarea or button. */
    public static function control(stdClass $widget, bool $raw = false): string
    {
        if (($widget->tag ?? '') === 'textarea') {
            $text = $widget->text ?? '';
            return self::element(
                'textarea',
                $raw ? $widget->attrs : self::controlAttrs($widget->attrs),
                (!$raw && str_starts_with($text, "\n") ? "\n" : '') . self::text($text, $raw),
                $raw
            );
        }
        if (($widget->tag ?? '') === 'select') {
            // The options of one group are written inside one optgroup element, in list order.
            $options = '';
            $group = null;
            $run = '';
            foreach ($widget->options ?? [] as $option) {
                $index = $option->group->index ?? null;
                if ($index !== ($group->index ?? null)) {
                    $options .= $group === null
                        ? $run
                        : self::element('optgroup', ['label' => $group->label], $run, $raw);
                    $group = $option->group ?? null;
                    $run = '';
                }
                $attrs = ['value' => $option->value];
                if ($option->selected) {
                    $attrs['selected'] = $widget->kind === 'search' ? 'selected' : '';
                }
                $run .= self::element('option', $attrs, self::text($option->label, $raw), $raw);
            }
            $options .= $group === null ? $run : self::element('optgroup', ['label' => $group->label], $run, $raw);
            return self::element('select', $raw ? $widget->attrs : self::controlAttrs($widget->attrs), $options, $raw);
        }
        return self::input($widget->attrs, $raw);
    }

    private static function hasEvents(stdClass $attrs): bool
    {
        foreach ($attrs as $name => $_value) {
            if (preg_match('/^on[a-z]/', $name)) {
                return true;
            }
        }
        return false;
    }

    private static function widget(stdClass $widget): string
    {
        if ($widget->unsupported ?? false) {
            return self::element(
                'div',
                ['class' => 'crudui-widget crudui-widget--unsupported','data-unsupported-type' => $widget->type]
            );
        }
        $raw = self::hasEvents($widget->attrs);
        switch ($widget->layout) {
            case 'widget':
                return self::element(
                    'div',
                    ['class' => 'crudui-widget'],
                    self::affix($widget->prepend ?? null, $raw)
                        . self::control($widget, $raw)
                        . self::affix($widget->append ?? null, $raw)
                );
            case 'bare':
                return self::control($widget, $raw);
            case 'range':
                $output = self::element(
                    'output',
                    ['class' => 'crudui-widget__output', 'for' => $widget->attrs->id ?? null],
                    self::text($widget->text ?? '', $raw),
                    $raw
                );
                return self::element(
                    'div',
                    ['class' => 'crudui-widget crudui-widget--range'],
                    self::affix($widget->prepend ?? null, $raw)
                        . self::control($widget, $raw)
                        . $output
                        . self::affix($widget->append ?? null, $raw)
                );
            case 'host-script':
                return self::control($widget, $raw) . self::script($widget->script ?? '');
            case 'choices':
                $body = '';
                $radio = $widget->kind === 'choice';
                $raw = self::hasEvents($widget->extra->input ?? new stdClass());
                foreach ($widget->options as $option) {
                    $attrs = [
                        ...(array) ($widget->extra->input ?? new stdClass()),
                        'type' => $radio ? 'radio' : 'checkbox',
                        'value' => $option->value,
                        'autocomplete' => 'off',
                        'class' => 'valid-target crudui-choices__input',
                        'id' => $option->id,
                    ];
                    if ($radio) {
                        $attrs['data-is-default'] = $option->isDefault ? '1' : '';
                    }
                    if ($option->selected) {
                        $attrs['checked'] = '';
                    }
                    // A choice attribute named like a control attribute keeps the control attribute's position.
                    $attrs = [
                        ...$attrs,
                        ...(array) ($widget->extra->option ?? []),
                        ...(array) ($option->attributes ?? []),
                    ];
                    $label = [
                        'for' => $option->id,
                        'class' => Value::classes($widget->itemLabelClass ?? '', $option->className ?? ''),
                    ];
                    if (isset($option->style)) {
                        $label['style'] = $option->style;
                    }
                    $body .= self::input($attrs, $raw)
                        . self::element(
                            'label',
                            $label,
                            self::element('span', [], self::text($option->label, $raw), $raw),
                            $raw
                        );
                }
                return self::element('div', self::controlAttrs($widget->attrs), $body);
            case 'file':
                $raw = self::hasEvents($widget->extra->file);
                $body = self::affix($widget->prepend ?? null, $raw);
                if (isset($widget->extra->display)) {
                    $display = $raw
                        ? [
                            'class' => $widget->extra->display->class ?? '',
                            'readonly' => '',
                            'type' => 'text',
                            'value' => '',
                        ]
                        : $widget->extra->display;
                    $body .= self::input($display, $raw);
                }
                $body .= self::input($widget->extra->file, $raw);
                if (isset($widget->extra->display)) {
                    $body .= self::element(
                        'button',
                        ['class' => 'crudui-widget__button', 'type' => 'button'],
                        '&nbsp;'
                    );
                }
                return self::element('div', ['class' => 'crudui-widget'], $body);
            case 'display':
                return self::element('div', self::controlAttrs($widget->attrs), $widget->rawHtml ?? '');
            case 'search':
                $raw = true;
                return (
                    ($widget->styleChrome ?? '') !== ''
                        ? self::element('style', ['nonce' => ''], $widget->styleChrome)
                        : ''
                )
                    . self::script($widget->script ?? '')
                    . self::element(
                        'div',
                        ['class' => 'crudui-widget crudui-widget--search'],
                        self::affix($widget->prepend ?? null, $raw)
                            . self::control($widget, $raw)
                            . self::affix($widget->append ?? null, $raw)
                    );
            case 'button':
                return self::element(
                    'button',
                    $raw ? $widget->attrs : self::controlAttrs($widget->attrs),
                    self::text($widget->text ?? '', $raw),
                    $raw
                );
            case 'condition':
                return ConditionMarkup::widget($widget);
        }
        throw new \LogicException('Unknown widget layout: ' . $widget->layout);
    }
}
