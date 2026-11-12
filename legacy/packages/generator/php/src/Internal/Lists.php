<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Validator\Compose\Compose;
use Polyspec\Crudui\Validator\ForbiddenScan;
use Polyspec\Crudui\Validator\Support\NumberValue;
use stdClass;

/** Compose list declarations, evaluate supplied rows and render table or card HTML. */
final class Lists
{
    /** Build one read-only list model from validated public inputs. */
    public static function buildPublic(mixed $spec, mixed $rows, array $options): stdClass
    {
        self::checkInput($spec, $rows, $options);
        return self::build(Value::object($spec), $rows, $options, 'list', 'columns');
    }

    /**
     * Check the list input in the order every runtime uses (docs/spec/display-formats.md): the argument shapes in
     * argument
     * order, then the declaration, then the options.
     */
    private static function checkInput(mixed $spec, mixed $rows, array $options): void
    {
        if (!Value::isObject($spec)) {
            throw new FormError('INVALID_FORM_INPUT', 'List specification must be an object');
        }
        if (!is_array($rows) || !array_is_list($rows)) {
            throw new FormError('INVALID_FORM_INPUT', 'List rows must be an array');
        }
        foreach ($rows as $row) {
            if (!Value::isObject($row)) {
                throw new FormError('INVALID_FORM_INPUT', 'List rows must be objects');
            }
        }
        if (!array_key_exists('columns', (array) $spec)) {
            throw new FormError('INVALID_FORM_INPUT', 'List specification must declare columns');
        }
        self::optionObject($options, 'data', 'List context must be an object');
        self::countOptions($options);
    }

    /**
     * The actions of a list or detail: <block>__actions with one <block>__action span per action
     * holding a link or a button; empty text without actions.
     *
     * @param list<stdClass> $actions
     */
    public static function actionsHtml(array $actions, string $block): string
    {
        if ($actions === []) {
            return '';
        }
        $html = '';
        foreach ($actions as $action) {
            $attrsAction = [];
            $tag = 'button';
            if (($action->format->type ?? null) === 'link') {
                $tag = 'a';
                $href = $action->format->options->href ?? '#';
                $attrsAction['href'] = is_string($href) ? $href : '#';
                if (is_string($action->format->options->target ?? null)) {
                    $attrsAction['target'] = $action->format->options->target;
                }
            } else {
                $attrsAction['type'] = 'button';
            }
            foreach ($action->behavior ?? [] as $attribute => $script) {
                $attrsAction[$attribute] = $script;
            }
            $html .= Rendering::element(
                'span',
                ['class' => $block . '__action', 'data-action' => $action->key],
                Rendering::element($tag, $attrsAction, Rendering::text($action->label, true), true)
            );
        }
        return Rendering::element('div', ['class' => $block . '__actions'], $html);
    }

    /** Render composed list columns, supplied rows, the description, actions and pagination. */
    public static function render(mixed $spec, mixed $rows, array $options): string
    {
        self::checkInput($spec, $rows, $options);
        $layout = $options['layout'] ?? 'table';
        if ($layout !== 'table' && $layout !== 'card') {
            throw new FormError('INVALID_FORM_INPUT', 'List layout must be table or card');
        }
        $vm = self::build(Value::object($spec), $rows, $options, 'list', 'columns');
        $attrs = self::node('crudui-list', $vm->design->wrapper);
        $body = '';
        if ($vm->description !== '') {
            $body .= Rendering::element(
                'p',
                ['class' => 'crudui-list__description'],
                Rendering::text($vm->description)
            );
        }
        $body .= self::actionsHtml($vm->actions, 'crudui-list');
        if ($vm->rows === []) {
            $body .= Rendering::element('div', ['class' => 'crudui-list__empty'], Rendering::text($vm->empty));
        } elseif ($layout === 'table') {
            $headers = '';
            foreach ($vm->columns as $column) {
                $header = self::node('crudui-list__heading', $column->design->main);
                if ($column->field !== '') {
                    $header['data-field'] = $column->field;
                }
                if ($column->sortable) {
                    $header['data-sortable'] = 'true';
                }
                if (isset($vm->sort) && in_array($vm->sort->field, [$column->field, $column->key], true)) {
                    $header['data-sort-dir'] = $vm->sort->dir;
                }
                $headers .= Rendering::element(
                    'th',
                    $header,
                    Rendering::element(
                        'span',
                        ['class' => 'crudui-list__heading-label'],
                        Rendering::text($column->label)
                    )
                        . ($column->sortable ? Rendering::element('span', ['class' => 'crudui-list__sort'], '↕') : '')
                );
            }
            $bodyRows = '';
            foreach ($vm->rows as $row) {
                $cells = '';
                foreach ($row->cells as $cell) {
                    $cells .= self::cell(
                        $cell,
                        'td',
                        'crudui-list__cell crudui-value crudui-value--' . $cell->format->type
                    );
                }
                $bodyRows .= Rendering::element('tr', [], $cells);
            }
            $body .= Rendering::element(
                'table',
                ['class' => 'crudui-list__table'],
                Rendering::element('thead', [], Rendering::element('tr', [], $headers))
                    . Rendering::element('tbody', [], $bodyRows)
            );
        } else {
            $cards = '';
            foreach ($vm->rows as $row) {
                $cells = '';
                foreach ($row->cells as $i => $cell) {
                    $class = Value::classes(
                        'crudui-list__cell crudui-value crudui-value--' . $cell->format->type,
                        $cell->design->main->class
                    );
                    $cells .= Rendering::element(
                        'div',
                        ['class' => $class],
                        Rendering::element(
                            'span',
                            ['class' => 'crudui-list__card-label'],
                            Rendering::text($vm->columns[$i]->label)
                        )
                            . self::cell($cell, 'span', 'crudui-list__card-value')
                    );
                }
                $cards .= Rendering::element('article', ['class' => 'crudui-list__card'], $cells);
            }
            $body .= Rendering::element('div', ['class' => 'crudui-list__cards'], $cards);
        }
        if ($vm->pagination->enabled) {
            $pagination = [
                'class' => 'crudui-list__pagination',
                'data-mode' => $vm->pagination->mode,
                'data-per-page' => (string) $vm->pagination->perPage,
                'data-page' => (string) $vm->pagination->page,
            ];
            if (property_exists($vm->pagination, 'total')) {
                $pagination['data-total'] = (string) $vm->pagination->total;
            }
            $controls = '';
            foreach ($vm->pagination->buttons as $button) {
                $buttonAttrs = [
                    'type' => 'button',
                    'class' => 'crudui-list__pagination-' . ($button->role === 'previous' ? 'prev' : $button->role),
                    'data-page' => (string) $button->page,
                    'aria-label' => $button->label,
                ];
                if ($button->current) {
                    $buttonAttrs['aria-current'] = 'page';
                }
                if ($button->disabled) {
                    $buttonAttrs['disabled'] = '';
                }
                // The button's text follows its role.
                $controls .= Rendering::element('button', $buttonAttrs, match ($button->role) {
                    'previous' => '‹', 'next' => '›', default => (string) $button->page
                });
            }
            $body .= Rendering::element('nav', $pagination, $controls);
        }
        return self::preloads($vm) . Rendering::element('div', $attrs, $body);
    }

    /**
     * Evaluate ordered list and cell models from checked input. $own is `list` or `detail` and
     * $members names the member map, `columns` or `fields`. The member map and a list `search`
     * with `$ref` or `$patch` are composed, the composed specification is scanned for forbidden
     * keys, and its declarations are checked.
     */
    public static function build(stdClass $spec, array $rows, array $options, string $own, string $members): stdClass
    {
        $spec = Value::spec($spec);
        $language = $options['language'] ?? 'ko';
        self::optionObject($options, 'data', 'List context must be an object');
        $data = Value::object($options['data'] ?? []);
        if (!($spec->{$members} ?? null) instanceof stdClass) {
            throw new FormError('INVALID_FORM_INPUT', sprintf('Invalid %s at %s: expected an object', $members, $own));
        }
        $loader = Template::loader($options);
        $basepath = $options['basepath'] ?? '';
        $columns = Compose::properties((array) $spec->{$members}, $loader, $basepath);
        $search = $spec->search ?? null;
        $composeSearch = $own === 'list'
            && $search instanceof stdClass
            && (property_exists($search, '$ref') || property_exists($search, '$patch'));
        // The composed specification keeps the member order of the declared one.
        $composed = new stdClass();
        foreach ($spec as $key => $value) {
            $composed->{$key} = match (true) {
                $key === $members => (object) $columns,
                $key === 'search' && $composeSearch => (object) Compose::properties(
                    (array) $search,
                    $loader,
                    $basepath
                ),
                default => $value,
            };
        }
        $spec = $composed;
        // The forbidden-key scan and then the declarations, as the display format specification orders them.
        ForbiddenScan::scan($spec);
        DisplayDeclaration::check($spec, $own, $members);
        $columnModels = [];
        $columnSpecs = [];
        foreach ($columns as $key => $raw) {
            $raw = (object) $raw;
            $design = Design::resolve($raw->design ?? null, $data, [], []);
            if (!$design->show) {
                continue;
            }
            $columnModels[] = (object) [
                'key' => (string) $key,
                'field' => is_string($raw->field ?? null) ? $raw->field : '',
                'label' => property_exists($raw, 'label') ? Value::translate($raw->label, $language) : (string) $key,
                'format' => self::format($raw->format ?? null),
                'sortable' => Design::flag($raw->sortable ?? null, $data, [], []),
                'design' => $design,
            ];
            $columnSpecs[] = $raw;
        }
        $rowModels = [];
        foreach ($rows as $row) {
            if (!Value::isObject($row)) {
                throw new FormError('INVALID_FORM_INPUT', 'List rows must be objects');
            }
            $row = Value::object($row);
            $cells = [];
            foreach ($columnModels as $i => $column) {
                $path = $column->field;
                $value = $path !== '' ? Value::path($row, $path) : Missing::Value;
                // A model is JSON: a path absent from the row is null, and the member is always present.
                $cells[] = Value::record([
                    'format' => $column->format,
                    'value' => $value === Missing::Value ? null : $value,
                    'display' => self::display($column->format, $value, $row, Value::segments($path), $language),
                    'design' => Design::resolve($columnSpecs[$i]->design ?? null, $row, Value::segments($path), []),
                ]);
            }
            $rowModels[] = (object) ['cells' => $cells];
        }
        $pagination = self::pagination($spec->pagination ?? null, self::countOptions($options), $language);
        $sort = isset($spec->sort->field) && is_string($spec->sort->field) && $spec->sort->field !== ''
            ? (object) ['field' => $spec->sort->field, 'dir' => ($spec->sort->dir ?? null) === 'desc' ? 'desc' : 'asc']
            : Missing::Value;
        $actions = [];
        if (($spec->actions ?? null) instanceof stdClass) {
            foreach ($spec->actions as $key => $raw) {
                // A script string: a button that runs the script when it is clicked.
                if (is_string($raw)) {
                    $actions[] = (object) ['key' => $key, 'label' => $key, 'behavior' => (object) ['onclick' => $raw]];
                    continue;
                }
                $raw = (object) $raw;
                $label = property_exists($raw, 'label') ? Value::translate($raw->label, $language) : $key;
                // An action object with a script is the object form of a script action.
                if (is_string($raw->script ?? null)) {
                    $actions[] = (object) [
                        'key' => $key,
                        'label' => $label,
                        'behavior' => (object) ['onclick' => $raw->script],
                    ];
                    continue;
                }
                $action = ['key' => $key, 'label' => $label];
                if (property_exists($raw, 'format')) {
                    $action['format'] = self::format($raw->format);
                }
                $behavior = [];
                if (($raw->behavior ?? null) instanceof stdClass) {
                    foreach ($raw->behavior as $event => $entry) {
                        $script = is_string($entry) ? $entry : $entry->script ?? null;
                        if (is_string($script)) {
                            $behavior[$event] = $script;
                        }
                    }
                }
                if ($behavior) {
                    $action['behavior'] = (object) $behavior;
                }
                $actions[] = (object) $action;
            }
        }
        // An absent or null empty uses the interface message; a declared text is used as declared.
        $declaredEmpty = $spec->empty ?? null;
        $empty = $declaredEmpty === null
            ? self::messages($language)['emptyList']
            : Value::translate($declaredEmpty, $language);
        return Value::record([
            'columns' => $columnModels,
            'rows' => $rowModels,
            'pagination' => (object) $pagination,
            'sort' => $sort,
            'actions' => $actions,
            'empty' => $empty,
            'description' => Value::translate($spec->description ?? null, $language),
            'design' => Design::resolve($spec->design ?? null, $data, [], []),
        ]);
    }

    /** An absent or null option is none; any other value must be an object. */
    private static function optionObject(array $options, string $key, string $message): void
    {
        if (isset($options[$key]) && !Value::isObject($options[$key])) {
            throw new FormError('INVALID_FORM_INPUT', $message);
        }
    }

    /**
     * The pagination model, in member order: enabled, then for enabled paging perPage, mode and
     * page with their defaults, the supplied total, pageCount and the previous, numbered and next
     * buttons. Disabled paging keeps only the supplied page and total.
     *
     * @param array{page: ?int, total: ?int} $counts
     */
    private static function pagination(mixed $declared, array $counts, string $language): stdClass
    {
        $enabled = $declared === true || $declared instanceof stdClass;
        $pagination = ['enabled' => $enabled];
        $perPage = 20;
        if ($enabled) {
            $perPage = $declared instanceof stdClass && property_exists($declared, 'per_page')
                ? (int) $declared->per_page
                : 20;
            $pagination['perPage'] = $perPage;
            $pagination['mode'] = $declared instanceof stdClass && property_exists($declared, 'mode')
                ? $declared->mode
                : 'pages';
            $pagination['page'] = $counts['page'] ?? 1;
        } elseif ($counts['page'] !== null) {
            $pagination['page'] = $counts['page'];
        }
        if ($counts['total'] !== null) {
            $pagination['total'] = $counts['total'];
        }
        if ($enabled) {
            $pageCount = $counts['total'] === null ? 0 : max(1, (int) ceil($counts['total'] / $perPage));
            $pagination['pageCount'] = $pageCount;
            // Without a total the current page is 1; a page after the last page selects the last page.
            $current = $pageCount > 0 ? min($pageCount, $pagination['page']) : 1;
            $messages = self::messages($language);
            $button = static fn (string $role, int $page, string $label, bool $isCurrent, bool $disabled): stdClass
                => (object) [
                    'role' => $role,
                    'page' => $page,
                    'label' => $label,
                    'current' => $isCurrent,
                    'disabled' => $disabled,
                ];
            $buttons = [
                $button(
                    'previous',
                    max(1, $current - 1),
                    $messages['previousPage'],
                    false,
                    $current <= 1 || $pageCount === 0
                )
            ];
            foreach (self::paginationPages($current, $pageCount) as $value) {
                $buttons[] = $button(
                    'page',
                    $value,
                    str_replace('{page}', (string) $value, $messages['page']),
                    $value === $current,
                    $value === $current
                );
            }
            $buttons[] = $button(
                'next',
                $pageCount > 0 ? min($pageCount, $current + 1) : 1,
                $messages['nextPage'],
                false,
                $pageCount === 0 || $current >= $pageCount
            );
            $pagination['buttons'] = $buttons;
        }
        return (object) $pagination;
    }

    /**
     * The list interface text of a display language: the table's entry for it, else English.
     *
     * @return array<string, string>
     */
    private static function messages(string $language): array
    {
        return InterfaceMessages::LIST[$language] ?? InterfaceMessages::LIST['en'];
    }

    /** A PHP int or float whose value is an integer from `$min` to 2^53 - 1, as int; otherwise null. */
    public static function safeInteger(mixed $value, int $min): ?int
    {
        $integral = is_int($value) || is_float($value) && is_finite($value) && floor($value) === $value;
        if (!$integral || $value < $min || $value > 9007199254740991) {
            return null;
        }
        // An integral float such as 2.0 or -0.0 is the integer 2 or 0.
        return (int) $value;
    }

    /**
     * The page and total options, checked in that order: absent or null is none; otherwise a PHP
     * int or float whose value is an integer from 1 (page) or 0 (total) to 2^53 - 1, returned as int.
     *
     * @return array{page: ?int, total: ?int}
     */
    private static function countOptions(array $options): array
    {
        $counts = [];
        foreach (
            [
                'page' => [1, 'List page must be a positive integer'],
                'total' => [0, 'List total must be a nonnegative integer'],
            ] as $key => [$min, $message]
        ) {
            $value = $options[$key] ?? null;
            if ($value === null) {
                $counts[$key] = null;
                continue;
            }
            $counts[$key] = self::safeInteger($value, $min) ?? throw new FormError('INVALID_FORM_INPUT', $message);
        }
        return $counts;
    }

    private static function preloads(stdClass $vm): string
    {
        $seen = [];
        $html = '';
        foreach ($vm->rows as $row) {
            foreach ($row->cells as $cell) {
                $html .= Rendering::imagePreload($cell->display, $seen);
            }
        }
        return $html;
    }

    private static function format(mixed $format): stdClass
    {
        $options = $format instanceof stdClass ? $format : new stdClass();
        $type = is_string($format) && $format !== ''
            ? $format
            : (is_string($options->type ?? null) && $options->type !== '' ? $options->type : 'text');
        return (object) ['type' => $type, 'options' => $options];
    }

    private static function display(stdClass $format, mixed $value, stdClass $row, array $path, string $language): mixed
    {
        $options = $format->options;
        $text = Value::scalar($value);
        switch ($format->type) {
            case 'date':
                $date = Dates::parseUtc($text);
                if ($date === null) {
                    return $text;
                }
                $pattern = is_string($options->pattern ?? null) && $options->pattern !== ''
                    ? $options->pattern
                    : 'YYYY-MM-DD';
                return str_replace(
                    ['YYYY', 'MM', 'DD', 'HH', 'mm', 'ss'],
                    [
                        $date->format('Y'),
                        $date->format('m'),
                        $date->format('d'),
                        $date->format('H'),
                        $date->format('i'),
                        $date->format('s'),
                    ],
                    $pattern
                );
            case 'number':
                $number = NumberValue::parseString($text);
                if ($number === null || !is_finite($number)) {
                    return $text;
                }
                $places = $options->decimals ?? null;
                $body = is_int($places) || is_float($places)
                    ? Numbers::fixed($number, $places)
                    : Value::scalar($number);
                if ($options->thousands ?? false) {
                    $parts = explode('.', $body);
                    $parts[0] = preg_replace('/\B(?=(\d{3})+(?!\d))/', ',', $parts[0]);
                    $body = implode('.', $parts);
                }
                return Value::translate($options->prefix ?? null, $language)
                    . $body
                    . Value::translate($options->suffix ?? null, $language);
            case 'badge':
                $variant = Value::get($options->map ?? null, $text);
                if ($variant instanceof stdClass) {
                    $label = Value::translate($variant, $language);
                    return (object) ['kind' => 'badge', 'variant' => $label, 'label' => $label];
                }
                return (object) ['kind' => 'badge', 'variant' => Value::scalar($variant), 'label' => $text];
            case 'link':
                $href = $options->href ?? null;
                $href = is_string($href)
                    ? $href
                    : ($href instanceof stdClass ? Design::appearance($href, $row, $path, []) : '');
                return Value::record([
                    'kind' => 'link',
                    'href' => self::interpolate($href, $row, $value),
                    'text' => isset($options->text) && $options->text !== ''
                        ? Value::translate($options->text, $language)
                        : $text,
                    'target' => is_string($options->target ?? null) && $options->target !== ''
                        ? $options->target
                        : Missing::Value,
                ]);
            case 'choice-label':
                $items = $options->items ?? null;
                if (ChoiceList::is($items)) {
                    foreach (ChoiceList::pairs($items) ?? [] as [$choice, $label]) {
                        if ($choice === $text) {
                            return Value::translate($label, $language);
                        }
                    }
                    return $text;
                }
                if ($items instanceof stdClass && !property_exists($items, 'model') || is_array($items)) {
                    $found = Value::get($items, $text);
                    if ($found !== Missing::Value) {
                        // A choice label is content: a string or a language map.
                        return Value::translate($found, $language);
                    }
                }
                return $text;
            case 'bool':
                $truth = is_bool($value)
                    ? $value
                    : (
                        is_int($value) || is_float($value)
                            ? $value != 0
                            : (
                                is_string($value)
                                    ? !in_array($value, ['', '0', 'false'], true)
                                    : $value !== null && $value !== Missing::Value
                            )
                    );
                $label = Value::get($options, $truth ? 'true' : 'false');
                return (object) [
                    'kind' => 'bool',
                    'value' => $truth,
                    'label' => $label !== Missing::Value && $label !== null
                        ? Value::translate($label, $language)
                        : ($truth ? 'true' : 'false'),
                    'as' => is_string($options->as ?? null) && $options->as !== '' ? $options->as : 'text',
                ];
            case 'image':
                return Value::record([
                    'kind' => 'image',
                    'src' => $text,
                    'alt' => self::interpolate(Value::translate($options->alt ?? null, $language), $row, $value),
                    'width' => property_exists($options, 'width') ? Value::scalar($options->width) : Missing::Value,
                    'height' => property_exists($options, 'height') ? Value::scalar($options->height) : Missing::Value,
                ]);
            case 'html':
                return (object) ['kind' => 'html', 'html' => $text];
            default:
                $limit = $options->truncate ?? null;
                // Only a number limits the text; its integer part counts Unicode code points.
                if ((is_int($limit) || is_float($limit)) && $limit >= 1) {
                    $limit = floor($limit);
                    if (mb_strlen($text, 'UTF-8') > $limit) {
                        return mb_substr($text, 0, (int) $limit, 'UTF-8') . '…';
                    }
                }
                return $text;
        }
    }

    private static function interpolate(string $template, stdClass $row, mixed $cellValue): string
    {
        return preg_replace_callback('/\{=[A-Za-z_][\w.]*\}/', static function ($match) use ($row, $cellValue) {
            $path = substr($match[0], 2, -1);
            $value = $path === 'field' ? $cellValue : Value::path($row, $path);
            return Value::scalar($value === Missing::Value ? $cellValue : $value);
        }, $template);
    }

    private static function node(string $base, stdClass $design): array
    {
        $attrs = ['class' => Value::classes($base, $design->class)];
        $style = Value::style($design->style);
        if ($style !== null) {
            $attrs['style'] = $style;
        }
        return $attrs;
    }

    /** Render one already-evaluated display cell for another read-only renderer. */
    public static function renderCell(stdClass $cell, string $tag, string $base): string
    {
        $display = $cell->display;
        if (is_string($display)) {
            $body = Rendering::text($display);
        } else {
            $body = match ($display->kind) {
                'badge' => Rendering::element(
                    'span',
                    [
                        'class' => 'crudui-badge',
                        ...$display->variant !== '' ? ['data-crudui-variant' => $display->variant] : [],
                    ],
                    Rendering::text($display->label)
                ),
                'link' => Rendering::element(
                    'a',
                    [
                        'href' => Rendering::url($display->href),
                        ...isset($display->target) ? ['target' => $display->target] : [],
                    ],
                    Rendering::text($display->text)
                ),
                'image' => '<img'
                    . Rendering::attrs([
                        'src' => Rendering::url($display->src),
                        'alt' => $display->alt,
                        ...isset($display->width) ? ['width' => $display->width] : [],
                        ...isset($display->height) ? ['height' => $display->height] : [],
                    ])
                    . '/>',
                'bool' => match ($display->as) {
                    'check' => Rendering::element(
                        'span',
                        [
                            'class' => 'crudui-bool crudui-bool--check',
                            'data-crudui-state' => $display->value ? 'true' : 'false',
                            'aria-label' => $display->label,
                        ],
                        $display->value ? '✔' : '✘'
                    ),
                    'icon' => Rendering::element(
                        'span',
                        [
                            'class' => 'crudui-bool crudui-bool--icon',
                            'data-crudui-state' => $display->value ? 'true' : 'false',
                            'aria-label' => $display->label,
                        ]
                    ),
                    default => Rendering::element(
                        'span',
                        [
                            'class' => 'crudui-bool crudui-bool--text',
                            'data-crudui-state' => $display->value ? 'true' : 'false',
                        ],
                        Rendering::text($display->label)
                    ),
                },
                'html' => $display->html,
            };
        }
        return Rendering::element($tag, self::node($base, $cell->design->main), $body);
    }

    /**
     * The bounded page-number window: every page up to seven pages, otherwise the first,
     * previous, current, next and last page.
     *
     * @return list<int>
     */
    private static function paginationPages(int $page, int $pageCount): array
    {
        if ($pageCount <= 7) {
            return $pageCount > 0 ? range(1, $pageCount) : [];
        }
        return array_values(array_unique([1, max(1, $page - 1), $page, min($pageCount, $page + 1), $pageCount]));
    }

    private static function cell(stdClass $cell, string $tag, string $base): string
    {
        return self::renderCell($cell, $tag, $base);
    }
}
