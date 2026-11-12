<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Validator\Compose\Compose;
use Polyspec\Crudui\Validator\Compose\MemoryLoader;
use Polyspec\Crudui\Validator\Validate\GroupSource;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\Numeric;
use stdClass;

/** Compose field structures independently of instance data. */
final class Template
{
    /** Compile composed properties into a serializable ordered template. */
    public static function compile(array|stdClass $spec, array $options): stdClass
    {
        $spec = Value::spec($spec);
        if (($spec->type ?? null) !== 'group' || !($spec->properties ?? null) instanceof stdClass) {
            throw new FormError('INVALID_FORM_INPUT', 'A form spec must be a group with properties');
        }
        self::checkFormDeclarations($spec);
        // The form root takes no layout; a group field declares it.
        if (Value::isObject($spec->design ?? null) && array_key_exists('layout', (array) $spec->design)) {
            throw new FormError('INVALID_FORM_INPUT', 'Invalid design.layout at form: unknown key');
        }
        $properties = Compose::properties(
            (array) $spec->properties,
            self::loader($options),
            $options['basepath'] ?? ''
        );
        return Value::record([
            'kind' => 'crudui/form-template',
            'keyPrefix' => $options['keyPrefix'] ?? Missing::Value,
            'fields' => self::fields($properties, $properties),
            'buttons' => Value::copy(property_exists($spec, 'buttons') ? $spec->buttons : Buttons::DEFAULT),
            'action' => Value::isObject($spec->action ?? null) ? Value::copy($spec->action) : Missing::Value,
            'description' => property_exists($spec, 'description') ? Value::copy($spec->description) : Missing::Value,
        ]);
    }

    /** Create the composition loader from explicitly supplied file objects. */
    public static function loader(array $options): MemoryLoader
    {
        $files = Value::object($options['files'] ?? []);
        $maps = [];
        foreach ($files as $path => $file) {
            if (!$file instanceof stdClass) {
                throw new FormError('INVALID_FORM_INPUT', 'Composition files must contain objects');
            }
            $maps[$path] = (array) Value::spec($file);
        }
        return new MemoryLoader($maps);
    }

    /** Compile the field templates; $root is the composed root, which a group source reads. */
    private static function fields(array $properties, array $root, string $parent = ''): array
    {
        $out = [];
        foreach ($properties as $name => $raw) {
            if (!$raw instanceof stdClass && (!is_array($raw) || array_is_list($raw))) {
                continue;
            }
            $raw = (array) $raw;
            $path = $parent === '' ? (string) $name : $parent . '.' . $name;
            self::checkDeclarations($raw, $path, true);
            $sourceFailure = GroupSource::failure($raw, $path, $root);
            if ($sourceFailure !== null) {
                throw new FormError('INVALID_FORM_INPUT', $sourceFailure);
            }
            $children = $raw['properties'] ?? null;
            unset($raw['properties']);
            $out[] = (object) [
                'name' => (string) $name,
                'spec' => Value::copy((object) $raw),
                'children' => $children instanceof stdClass || is_array($children) && !array_is_list($children)
                    ? self::fields((array) $children, $root, $path)
                    : [],
            ];
        }
        return $out;
    }

    /** A string, or a condition map: a non-empty object. */
    private static function conditionValue(mixed $value): bool
    {
        return is_string($value) || (Value::isObject($value) && (array) $value !== []);
    }

    /** A child that renders one scalar value: not repeated, not a group and not a language field. */
    private static function scalarChild(mixed $child): bool
    {
        if (!Value::isObject($child)) {
            return false;
        }
        $child = (array) $child;
        $repeated = ($child['multiple'] ?? null) === true
            || ($child['multiple'] ?? null) === 'only'
            || Value::isObject($child['multiple'] ?? null);
        $lang = ($child['lang'] ?? null) === true || Value::isObject($child['lang'] ?? null);
        return ($child['type'] ?? null) !== 'group' && !array_key_exists('properties', $child) && !$repeated && !$lang;
    }

    /** Reject a wrong root action or buttons declaration. */
    private static function checkFormDeclarations(stdClass $spec): void
    {
        $fail = static function (string $key, string $expected): never {
            throw new FormError('INVALID_FORM_INPUT', sprintf('Invalid %s at form: expected %s', $key, $expected));
        };
        if (property_exists($spec, 'action')) {
            if (!Value::isObject($spec->action)) {
                $fail('action', 'an object');
            }
            $action = (array) $spec->action;
            foreach (['method', 'url', 'enctype'] as $key) {
                if (array_key_exists($key, $action) && !is_string($action[$key])) {
                    $fail('action.' . $key, 'a string');
                }
            }
        }
        if (!property_exists($spec, 'buttons')) {
            return;
        }
        if (!is_array($spec->buttons) || !array_is_list($spec->buttons)) {
            $fail('buttons', 'a list of buttons');
        }
        // A button type without interface text needs declared text.
        $texts = Messages::forLanguage('ko');
        foreach ($spec->buttons as $index => $button) {
            $key = 'buttons.' . $index;
            if (!Value::isObject($button)) {
                $fail($key, 'an object');
            }
            $declared = (array) $button;
            if (!in_array($declared['type'] ?? null, Buttons::TYPES, true)) {
                $fail($key . '.type', 'submit, reset, button or link');
            }
            foreach (['name', 'value', 'href'] as $name) {
                if (array_key_exists($name, $declared) && !is_string($declared[$name])) {
                    $fail($key . '.' . $name, 'a string');
                }
            }
            if (!array_key_exists($declared['type'], $texts) && !array_key_exists('text', $declared)) {
                $fail($key . '.text', 'content for this button type');
            }
            if ($declared['type'] === 'link' && !array_key_exists('href', $declared)) {
                $fail($key . '.href', 'a link target');
            }
            self::checkDeclarations($declared, 'form.' . $key, false);
        }
    }

    /**
     * Reject a wrong value type or an unknown key in one field's multiple, lang, design and behavior
     * declarations. Only a form field ($field) accepts declared attributes.
     */
    private static function checkDeclarations(array $spec, string $path, bool $field): void
    {
        $fail = static function (string $key, string $expected) use ($path): never {
            self::invalid($key, $path, $expected);
        };
        // Buttons and the submission target belong to the form, not to a field.
        foreach (['buttons', 'action'] as $key) {
            if (array_key_exists($key, $spec)) {
                $fail($key, 'the form root');
            }
        }
        if (array_key_exists('multiple', $spec)) {
            $multiple = $spec['multiple'];
            if (!is_bool($multiple) && $multiple !== 'only' && !Value::isObject($multiple)) {
                $fail('multiple', 'a boolean, only or an object');
            }
            if (Value::isObject($multiple)) {
                $settings = (array) $multiple;
                self::closed(
                    'multiple',
                    $settings,
                    ['only', 'min', 'max', 'copy', 'sortable', 'title', 'controls', 'header', 'onclick', 'keys'],
                    $path
                );
                if (array_key_exists('only', $settings) && !is_bool($settings['only'])) {
                    $fail('multiple.only', 'a boolean');
                }
                // Rows of a data-only collection come from the data: row limits and row controls do not apply.
                if (($settings['only'] ?? null) === true) {
                    self::closed('multiple', $settings, ['only', 'title', 'header', 'keys'], $path);
                }
                // A keyed map is a data-only collection; validation resolves its reference.
                if (array_key_exists('keys', $settings)) {
                    if (($settings['only'] ?? null) !== true) {
                        $fail('multiple.keys', 'multiple.only: true');
                    }
                    if (!is_string($settings['keys'])) {
                        $fail('multiple.keys', 'a reference to a repeated group');
                    }
                }
                foreach (['min', 'max'] as $key) {
                    if (array_key_exists($key, $settings) && !is_int($settings[$key]) && !is_float($settings[$key])) {
                        $fail('multiple.' . $key, 'a number');
                    }
                }
                foreach (['copy', 'sortable'] as $key) {
                    if (array_key_exists($key, $settings) && !is_bool($settings[$key])) {
                        $fail('multiple.' . $key, 'a boolean');
                    }
                }
                if (array_key_exists('title', $settings)) {
                    if (($spec['type'] ?? null) !== 'group') {
                        $fail('multiple.title', 'a repeated group');
                    }
                    $properties = Value::isObject($spec['properties'] ?? null) ? (array) $spec['properties'] : [];
                    if (
                        !is_string($settings['title'])
                        || !array_key_exists($settings['title'], $properties)
                        || !self::scalarChild($properties[$settings['title']])
                    ) {
                        $fail(
                            'multiple.title',
                            'the name of a direct child field without multiple, properties or lang'
                        );
                    }
                }
                if (
                    array_key_exists('controls', $settings)
                    && !in_array($settings['controls'], ['header', 'footer', 'outline'], true)
                ) {
                    $fail('multiple.controls', 'header, footer or outline');
                }
                if (
                    array_key_exists('header', $settings)
                    && !in_array($settings['header'], ['static', 'sticky'], true)
                ) {
                    $fail('multiple.header', 'static or sticky');
                }
            }
        }
        if (array_key_exists('lang', $spec) && !is_bool($spec['lang']) && !Value::isObject($spec['lang'])) {
            $fail('lang', 'a boolean or an object');
        }
        if (Value::isObject($spec['lang'] ?? null)) {
            $lang = (array) $spec['lang'];
            self::closed('lang', $lang, ['mode', 'only', 'name', 'key', 'frame', 'title', 'group_class'], $path);
            if (array_key_exists('only', $lang)) {
                $only = $lang['only'];
                $codes = is_array($only)
                    && array_is_list($only)
                    && array_filter($only, static fn ($code) => !is_string($code)) === [];
                if (!$codes && !Value::isObject($only)) {
                    $fail('lang.only', 'a list of language codes or an object');
                }
            }
        }
        if (array_key_exists('design', $spec)) {
            self::checkDesignDeclaration(
                $spec['design'],
                $path,
                $field,
                $field ? self::groupLayouts($spec) : null,
                $field && self::isCondition($spec)
            );
        }
        if (Value::isObject($spec['behavior'] ?? null)) {
            self::closed('behavior', (array) $spec['behavior'], ['onchange', 'onclick', 'onload'], $path);
        }
        if ($field && is_string($spec['type'] ?? null) && strtolower($spec['type']) === 'range') {
            self::checkRangeDeclaration($spec, $path);
        }
        if ($field && self::isCondition($spec)) {
            self::checkConditionDeclaration($spec, $path);
            ConditionEditor::check($spec, $path);
        } elseif (
            $field && Value::isObject($spec['options'] ?? null) && array_key_exists('fields', (array) $spec['options'])
        ) {
            throw ConditionEditor::fieldsError($path);
        }
    }

    /** Whether a field declares the condition type. */
    private static function isCondition(array $spec): bool
    {
        return is_string($spec['type'] ?? null) && strtolower($spec['type']) === 'condition';
    }

    /**
     * Reject a condition field whose validate.conditionTree is not the literal true or judge: every
     * value of the field is checked as a condition tree.
     */
    private static function checkConditionDeclaration(array $spec, string $path): void
    {
        $validate = Value::isObject($spec['validate'] ?? null) ? (array) $spec['validate'] : [];
        $parameter = $validate['conditionTree'] ?? null;
        if ($parameter !== true && $parameter !== 'judge') {
            self::invalid('validate.conditionTree', $path, 'true or judge');
        }
    }

    /**
     * Reject a range field without literal bounds and a literal step whose multiple the minimum
     * is: the slider moves from the minimum in steps.
     */
    private static function checkRangeDeclaration(array $spec, string $path): void
    {
        $validate = Value::isObject($spec['validate'] ?? null) ? (array) $spec['validate'] : [];
        try {
            [$minimum] = Numeric::range($validate['range'] ?? null);
        } catch (InvalidRuleParameter) {
            self::invalid('validate.range', $path, '[minimum, maximum] finite numbers with minimum not above maximum');
        }
        try {
            $step = Numeric::step($validate['step'] ?? null);
        } catch (InvalidRuleParameter) {
            self::invalid('validate.step', $path, 'a finite number above 0');
        }
        if (!Numeric::isMultiple($minimum, $step)) {
            self::invalid('validate.range', $path, 'a minimum that is a multiple of validate.step');
        }
    }

    /**
     * The design.layout values a group field accepts: a repeated group has no line, and a field
     * that is not a group has no layout.
     *
     * @return list<string>|null
     */
    private static function groupLayouts(array $spec): ?array
    {
        if (($spec['type'] ?? null) !== 'group') {
            return null;
        }
        $multiple = $spec['multiple'] ?? null;
        $repeated = $multiple === true || $multiple === 'only' || Value::isObject($multiple);
        return $repeated ? ['stacked', 'inline'] : ['stacked', 'inline', 'line'];
    }

    /** Prefixes of attribute names crudui writes on a control or a node root. */
    private const OWNED_ATTRIBUTE_PREFIXES = ['data-crudui-', 'data-source-'];

    /** Attribute names crudui writes on a control or a node root. */
    private const OWNED_ATTRIBUTE_NAMES = [
        'data-field-path', 'data-lang', 'data-name', 'data-rule-name', 'data-default', 'data-is-default',
        'data-type', 'data-height', 'data-upload-server', 'data-fileserver', 'data-server', 'data-max-tags',
        'data-keyword-min-length', 'data-delay', 'data-api-server', 'data-max-width', 'data-min-width',
        'data-max-height', 'data-min-height', 'data-preview-max-width', 'data-preview-max-height',
        'data-unsupported-type',
    ];

    /**
     * Whether a name is a data-* or aria-* name crudui does not write: lowercase letters, digits,
     * "-", "_" and "." after the prefix, starting with a letter or a digit.
     */
    private static function declaredAttributeName(string $name): bool
    {
        if (
            preg_match('/\A(?:data|aria)-[a-z0-9][a-z0-9._-]*\z/', $name) !== 1
            || in_array($name, self::OWNED_ATTRIBUTE_NAMES, true)
        ) {
            return false;
        }
        foreach (self::OWNED_ATTRIBUTE_PREFIXES as $prefix) {
            if (str_starts_with($name, $prefix)) {
                return false;
            }
        }
        return true;
    }

    /** Reject declared attributes at $key that are not an object of permitted names to strings; names first. */
    public static function checkDeclaredAttributes(mixed $attributes, string $key, string $path): void
    {
        if (!Value::isObject($attributes)) {
            self::invalid($key, $path, 'an object');
        }
        $attributes = (array) $attributes;
        foreach (array_keys($attributes) as $name) {
            if (!self::declaredAttributeName((string) $name)) {
                self::invalid($key . '.' . $name, $path, 'a data-* or aria-* name that crudui does not write');
            }
        }
        foreach ($attributes as $name => $value) {
            if (!is_string($value)) {
                self::invalid($key . '.' . $name, $path, 'a string');
            }
        }
    }

    /**
     * Reject a wrong value type or an unknown key in one declared design: a form field or button,
     * a list or detail specification, or a list column or detail field. Only a form field ($field)
     * accepts attributes and wrapper.attributes, and only a group field ($layouts) accepts layout,
     * one of $layouts.
     */
    public static function checkDesignDeclaration(
        mixed $design,
        string $path,
        bool $field = false,
        ?array $layouts = null,
        bool $condition = false
    ): void {
        if (!is_bool($design) && !Value::isObject($design)) {
            self::invalid('design', $path, 'a boolean or an object');
        }
        if (!Value::isObject($design)) {
            return;
        }
        $design = (array) $design;
        self::closed('design', $design, match (true) {
            $layouts !== null => [
                'show',
                'class',
                'style',
                'attributes',
                'layout',
                'label',
                'wrapper',
                'group',
                'prepend',
            ],
            // A condition field also declares its editor (docs/spec/schema.md, Structured condition editor).
            $condition => ['show', 'class', 'style', 'attributes', 'editor', 'label', 'wrapper', 'group', 'prepend'],
            $field => ['show', 'class', 'style', 'attributes', 'label', 'wrapper', 'group', 'prepend'],
            default => ['show', 'class', 'style', 'label', 'wrapper', 'group', 'prepend'],
        }, $path);
        if (array_key_exists('show', $design) && !is_bool($design['show']) && !self::conditionValue($design['show'])) {
            self::invalid('design.show', $path, 'an expression, a boolean or a condition map');
        }
        foreach (['class', 'style'] as $key) {
            if (array_key_exists($key, $design) && !self::conditionValue($design[$key])) {
                self::invalid('design.' . $key, $path, 'a string or a condition map');
            }
        }
        if (array_key_exists('attributes', $design)) {
            self::checkDeclaredAttributes($design['attributes'], 'design.attributes', $path);
        }
        if ($layouts !== null && array_key_exists('layout', $design) && !in_array($design['layout'], $layouts, true)) {
            self::invalid(
                'design.layout',
                $path,
                count($layouts) === 3 ? 'stacked, inline or line' : 'stacked or inline'
            );
        }
        foreach (['label', 'wrapper', 'group', 'prepend'] as $node) {
            if (!array_key_exists($node, $design)) {
                continue;
            }
            if (!Value::isObject($design[$node])) {
                self::invalid('design.' . $node, $path, 'an object');
            }
            $values = (array) $design[$node];
            self::closed(
                'design.' . $node,
                $values,
                $field && $node === 'wrapper' ? ['class', 'style', 'attributes'] : ['class', 'style'],
                $path
            );
            foreach (['class', 'style'] as $key) {
                if (array_key_exists($key, $values) && !self::conditionValue($values[$key])) {
                    self::invalid('design.' . $node . '.' . $key, $path, 'a string or a condition map');
                }
            }
            if (array_key_exists('attributes', $values)) {
                self::checkDeclaredAttributes($values['attributes'], 'design.' . $node . '.attributes', $path);
            }
        }
    }

    /** Fail with "Invalid {key} at {path}: expected {expected}". */
    private static function invalid(string $key, string $path, string $expected): never
    {
        throw new FormError('INVALID_FORM_INPUT', sprintf('Invalid %s at %s: expected %s', $key, $path, $expected));
    }

    /** A closed bucket rejects its first undeclared key in member order. */
    private static function closed(string $bucket, array $members, array $allowed, string $path): void
    {
        foreach (array_keys($members) as $key) {
            if (!in_array((string) $key, $allowed, true)) {
                throw new FormError(
                    'INVALID_FORM_INPUT',
                    sprintf('Invalid %s.%s at %s: unknown key', $bucket, $key, $path)
                );
            }
        }
    }

    /**
     * Copy a template input as JSON values, rejecting a value that is not exactly the shape
     * compile produces: the template kind, a field list, a button object list, an optional
     * string keyPrefix, an optional object action, an optional description of any value and no
     * other member; each field has exactly
     * a string name, an object spec and a field list children.
     */
    public static function checked(stdClass $template): stdClass
    {
        $copy = Value::spec($template);
        $members = array_map('strval', array_keys((array) $copy));
        $valid = array_diff($members, ['kind', 'keyPrefix', 'fields', 'buttons', 'action', 'description']) === []
            && ($copy->kind ?? null) === 'crudui/form-template'
            && self::fieldList($copy->fields ?? null)
            && is_array($copy->buttons ?? null)
            && array_filter($copy->buttons, static fn ($button) => !$button instanceof stdClass) === []
            && (!property_exists($copy, 'keyPrefix') || is_string($copy->keyPrefix))
            && (!property_exists($copy, 'action') || $copy->action instanceof stdClass);
        if (!$valid) {
            throw new FormError('INVALID_FORM_INPUT', 'Unsupported form template');
        }
        return $copy;
    }

    /** A JSON list of field templates. */
    private static function fieldList(mixed $fields): bool
    {
        if (!is_array($fields)) {
            return false;
        }
        foreach ($fields as $field) {
            if (!$field instanceof stdClass) {
                return false;
            }
            $members = array_map('strval', array_keys((array) $field));
            sort($members);
            if (
                $members !== ['children', 'name', 'spec'] || !is_string($field->name)
                || !$field->spec instanceof stdClass || !self::fieldList($field->children)
            ) {
                return false;
            }
        }
        return true;
    }
}
