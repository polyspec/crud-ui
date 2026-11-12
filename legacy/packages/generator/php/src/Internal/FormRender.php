<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;
use stdClass;

/**
 * Render options of a complete form (form-runtime.md, "Complete form"): the form element, the
 * hidden fields, form errors and node errors.
 */
final class FormRender
{
    /** The model of empty options: the crudui-form block alone. */
    public const EMPTY = ['form' => null, 'hidden' => [], 'formErrors' => [], 'nodeErrors' => []];

    private const MEMBERS = ['action', 'hidden', 'formErrors', 'errors'];
    private const ACTION_MEMBERS = ['method', 'url', 'enctype'];

    /**
     * Check render options and build the model the renderer writes.
     *
     * @param list<stdClass> $nodes top-level nodes that the renderer writes
     * @return array{form: ?array<string, string>, hidden: list<array{string, string}>, formErrors: list<string>,
     * nodeErrors: array<int, list<string>>}
     * @throws FormError for the first option outside the contract, in the documented order
     */
    public static function model(array $nodes, mixed $templateAction, mixed $options): array
    {
        $members = self::members($options);
        if ($members === null) {
            throw self::failure('Render options must be an object');
        }
        foreach (array_keys($members) as $name) {
            if (!\in_array((string) $name, self::MEMBERS, true)) {
                throw self::failure('Unknown render option: ' . $name);
            }
        }
        $action = array_key_exists('action', $members) ? self::members($members['action']) : null;
        if (array_key_exists('action', $members) && ($action === null || self::invalidAction($action))) {
            throw self::failure('action must be an object with string method, url and enctype');
        }
        $hidden = array_key_exists('hidden', $members) ? self::members($members['hidden']) : null;
        if (
            array_key_exists('hidden', $members)
            && ($hidden === null || array_filter($hidden, static fn ($value) => !\is_string($value)) !== [])
        ) {
            throw self::failure('hidden must be an object of strings');
        }
        if ($hidden !== null && $action === null) {
            throw self::failure('hidden requires action');
        }
        $formErrors = $members['formErrors'] ?? [];
        if (
            !\is_array($formErrors)
            || !array_is_list($formErrors)
            || array_filter($formErrors, static fn ($text) => !\is_string($text)) !== []
        ) {
            throw self::failure('formErrors must be a list of strings');
        }
        $errors = $members['errors'] ?? [];
        $records = \is_array($errors) && array_is_list($errors) ? array_map(self::members(...), $errors) : null;
        if (
            $records === null
            || array_filter(
                $records,
                static fn ($record) => $record === null
                    || !\is_string($record['path'] ?? null)
                    || !\is_string($record['message'] ?? null)
            ) !== []
        ) {
            throw self::failure('errors must be a list of objects with string path and message');
        }
        $nodeErrors = [];
        if ($records !== []) {
            $byPath = [];
            self::nodesByPath($nodes, null, $byPath);
            foreach ($records as $record) {
                $node = $byPath[$record['path']] ?? null;
                if ($node === null) {
                    throw self::failure('Unknown error path: ' . $record['path']);
                }
                $nodeErrors[spl_object_id($node)][] = $record['message'];
            }
        }
        $form = null;
        if ($action !== null) {
            $declared = self::members($templateAction) ?? [];
            $value = static function (string $key) use ($action, $declared): ?string {
                $value = $action[$key] ?? $declared[$key] ?? null;
                return \is_string($value) ? $value : null;
            };
            $form = array_filter(
                [
                    'action' => $value('url') === null ? null : Rendering::url($value('url')),
                    'encType' => $value('enctype'),
                    'method' => $value('method'),
                ],
                static fn ($v) => $v !== null
            );
        }
        $pairs = [];
        foreach ($hidden ?? [] as $name => $value) {
            $pairs[] = [(string) $name, $value];
        }
        return ['form' => $form, 'hidden' => $pairs, 'formErrors' => $formErrors, 'nodeErrors' => $nodeErrors];
    }

    /**
     * The members of a JSON object: a stdClass, an associative array or an empty array.
     *
     * @return array<string|int, mixed>|null
     */
    private static function members(mixed $value): ?array
    {
        if ($value instanceof stdClass) {
            return get_object_vars($value);
        }
        return \is_array($value) && ($value === [] || !array_is_list($value)) ? $value : null;
    }

    private static function invalidAction(array $action): bool
    {
        foreach ($action as $key => $value) {
            if (!\in_array((string) $key, self::ACTION_MEMBERS, true) || !\is_string($value)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Every node with a data path, by that path: a row's path is its collection path, `.` and its key.
     *
     * @param array<string, stdClass> $out
     */
    private static function nodesByPath(array $nodes, ?string $parent, array &$out): void
    {
        foreach ($nodes as $node) {
            $path = match ($node->kind) {
                'row' => $parent . '.' . $node->key,
                'lang-item' => null,
                default => $node->path ?? null,
            };
            if ($path !== null) {
                $out[$path] = $node;
            }
            self::nodesByPath($node->children ?? [], $path, $out);
        }
    }

    private static function failure(string $message): FormError
    {
        return new FormError('INVALID_FORM_INPUT', $message);
    }
}
