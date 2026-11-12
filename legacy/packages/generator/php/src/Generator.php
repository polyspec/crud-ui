<?php

declare(strict_types=1);

namespace Polyspec\Crudui;

use Polyspec\Crudui\Generator\Binding;
use Polyspec\Crudui\Generator\Buttons;
use Polyspec\Crudui\Generator\Details;
use Polyspec\Crudui\Generator\FormRender;
use Polyspec\Crudui\Generator\History;
use Polyspec\Crudui\Generator\InputText;
use Polyspec\Crudui\Generator\Lists;
use Polyspec\Crudui\Generator\Outline;
use Polyspec\Crudui\Generator\Rendering;
use Polyspec\Crudui\Generator\Template;
use Polyspec\Crudui\Generator\View;
use Polyspec\Crudui\Generator\Value;
use stdClass;

/** Compile form structures, bind values and render forms or lists. */
final class Generator
{
    /** The operations that an action button can request (CURT-081). */
    private const ACTIONS = [
        'move-up', 'move-down', 'add-row', 'copy-row', 'remove-row', 'toggle-row', 'select-row',
        'expand-all', 'collapse-all', 'undo', 'redo',
    ];

    /** Compile a JSON-serializable structure without record data. */
    public static function compileForm(array|stdClass $spec, array $options = []): stdClass
    {
        InputText::specification($spec, $options);
        InputText::inputs([], $options, ['basepath', 'keyPrefix']);
        return Template::compile($spec, $options);
    }

    /** Return the history with no record (CURT-076). */
    public static function emptyHistory(): stdClass
    {
        return History::empty();
    }

    /** Return the history after a change from the previous record, with at most 100 records in each direction (CURT-077). */
    public static function recordChange(stdClass $history, mixed $previous, ?string $path = null): stdClass
    {
        return History::record($history, $previous, $path);
    }

    /** Return whether a record can be restored (CURT-078). */
    public static function canUndo(stdClass $history): bool
    {
        return History::canUndo($history);
    }

    /** Return whether an undone change can be reapplied (CURT-078). */
    public static function canRedo(stdClass $history): bool
    {
        return History::canRedo($history);
    }

    /** Return the history and the record before the last change; fail when there is none (CURT-079). */
    public static function undoChange(stdClass $history, mixed $current): stdClass
    {
        return History::undo($history, $current);
    }

    /** Return the history and the record after the last undone change; fail when there is none (CURT-080). */
    public static function redoChange(stdClass $history, mixed $current): stdClass
    {
        return History::redo($history, $current);
    }

    /**
     * Evaluate fields without modifying template or record data. The option `collapsed` lists the row paths
     * `{collection}.{key}` rendered collapsed.
     */
    public static function bindForm(stdClass $template, mixed $data = [], array $options = []): array
    {
        InputText::inputs([['template', $template], ['data', $data]], $options, InputText::BIND);
        return Binding::bind($template, $data, $options);
    }

    /**
     * Build the structure map of evaluated nodes: the rows of the form, each with the rows nested in it and the
     * row controls placed in the map (`multiple.controls: outline`).
     *
     * @param list<stdClass> $nodes the evaluated nodes that bindForm returns
     * @return list<stdClass>
     */
    public static function buildOutline(array $nodes): array
    {
        return Outline::build($nodes);
    }

    /** The view with no collapsed row; a view is `['collapsed' => list of row paths]`. */
    public static function initialView(): array
    {
        return View::initial();
    }

    /** Expand a collapsed row or collapse an expanded one. */
    public static function toggleRowView(array $view, string $rowPath): array
    {
        return View::toggle($view, $rowPath);
    }

    /**
     * The row paths `{collection}.{key}` of every collapsible row of the evaluated nodes.
     *
     * @param list<stdClass> $nodes the evaluated nodes that bindForm returns
     * @return list<string>
     */
    public static function collapsibleRows(array $nodes): array
    {
        return View::collapsibleRows($nodes);
    }

    /**
     * The view with no collapsed row, or the view that collapses every collapsible row of the nodes.
     *
     * @param list<stdClass> $nodes the evaluated nodes that bindForm returns
     */
    public static function setAllExpandedView(array $nodes, bool $expanded): array
    {
        return View::setAllExpanded($nodes, $expanded);
    }

    /** Drop the collapsed state of a removed row and of the rows inside it. */
    public static function removeRowView(array $view, string $rowPath): array
    {
        return View::removeRow($view, $rowPath);
    }

    /** Move the collapsed state of a rekeyed row and of the rows inside it to the new row path. */
    public static function rekeyRowView(array $view, string $oldPath, string $newPath): array
    {
        return View::rekeyRow($view, $oldPath, $newPath);
    }

    /**
     * Resolve the target of an action button from the values it declares (CURT-081): `action`, the collection `path`
     * and the row `key`. An action that is none of the eleven resolves to null; an empty path or key is left out.
     *
     * @param array{action?: mixed, path?: mixed, key?: mixed}|stdClass $input
     */
    public static function resolveAction(array|stdClass $input): ?stdClass
    {
        $values = (array) $input;
        $name = $values['action'] ?? null;
        if (!is_string($name) || !in_array($name, self::ACTIONS, true)) {
            return null;
        }
        $target = new stdClass();
        $target->name = $name;
        foreach (['path', 'key'] as $member) {
            $value = self::actionText($values, $member);
            if ($value !== null && $value !== '') {
                $target->{$member} = $value;
            }
        }
        return $target;
    }

    /**
     * Run a resolved action on the form (CURT-082 to CURT-090) and return its result: `focus` names the row or the
     * collection that receives focus, and an action that moves no focus returns an empty result. A target without the
     * path or the key that the action needs returns null and changes nothing. A failing operation throws its FormError
     * and leaves the form unchanged.
     *
     * @param array{name?: mixed, path?: mixed, key?: mixed}|stdClass $target
     */
    public static function runAction(Form $form, array|stdClass $target): ?stdClass
    {
        $values = (array) $target;
        $name = $values['name'] ?? null;
        if (!is_string($name) || !in_array($name, self::ACTIONS, true)) {
            throw new FormError('INVALID_FORM_INPUT', 'Unknown action: ' . (is_string($name) ? $name : 'none'));
        }
        if ($name === 'expand-all' || $name === 'collapse-all') {
            $form->setAllExpanded($name === 'expand-all');
            return new stdClass();
        }
        if ($name === 'undo') {
            $form->undo();
            return new stdClass();
        }
        if ($name === 'redo') {
            $form->redo();
            return new stdClass();
        }
        $path = self::actionText($values, 'path');
        $key = self::actionText($values, 'key');
        if ($path === null || $path === '') {
            return null;
        }
        if ($name === 'add-row') {
            return self::focus($path, $form->addRow($path, $key === null ? [] : ['afterKey' => $key]));
        }
        if ($key === null || $key === '') {
            return null;
        }
        if ($name === 'copy-row') {
            return self::focus($path, $form->copyRow($path, $key));
        }
        if ($name === 'remove-row') {
            $keys = self::rowKeys($form, $path);
            $index = array_search($key, $keys, true);
            if ($index === false) {
                throw new FormError('INVALID_FORM_INPUT', 'Unknown row: ' . $key);
            }
            // The row that receives focus is the previous one, else the next one, else the collection.
            $neighbour = $keys[$index - 1] ?? $keys[$index + 1] ?? null;
            $form->removeRow($path, $key);
            return self::focus($path, $neighbour);
        }
        if ($name === 'toggle-row') {
            $form->toggleRow($path, $key);
            return new stdClass();
        }
        if ($name === 'select-row') {
            // Selecting changes no state: it only moves focus to the row.
            return self::focus($path, $key);
        }
        $keys = self::rowKeys($form, $path);
        $index = array_search($key, $keys, true);
        if ($index === false) {
            throw new FormError('INVALID_FORM_INPUT', 'Unknown row: ' . $key);
        }
        $form->moveRow($path, $key, $index + ($name === 'move-up' ? -1 : 1));
        return self::focus($path, $key);
    }

    /** The text of an action value: null when absent; a value that is no string is an invalid input. */
    private static function actionText(array $values, string $member): ?string
    {
        $value = $values[$member] ?? null;
        if ($value !== null && !is_string($value)) {
            throw new FormError('INVALID_FORM_INPUT', 'An action ' . $member . ' must be a string');
        }
        return $value;
    }

    /** The result of an action that moves the focus to a row, or to the collection when the key is null. */
    private static function focus(string $path, ?string $key = null): stdClass
    {
        $focus = new stdClass();
        $focus->path = $path;
        if ($key !== null) {
            $focus->key = $key;
        }
        $result = new stdClass();
        $result->focus = $focus;
        return $result;
    }

    /** The row keys of the collection at `$path` in order; a value that is no keyed object has none. */
    private static function rowKeys(Form $form, string $path): array
    {
        $rows = $form->getValue($path);
        if (!$rows instanceof stdClass) {
            throw new FormError('INVALID_FORM_INPUT', 'Repeated data must be a keyed object: ' . $path);
        }
        return array_keys((array) $rows);
    }

    /** Evaluate the template buttons for a record as objects with type, tag, text and ordered attrs. */
    public static function bindButtons(stdClass $template, mixed $data = [], array $options = []): array
    {
        InputText::inputs([['template', $template], ['data', $data]], $options, InputText::BIND);
        return Buttons::bindPublic($template, $data, $options);
    }

    /** Render evaluated buttons as the markup every renderer places in the form footer; reject any other element. */
    public static function formButtonsHtml(mixed $buttons): string
    {
        return Buttons::htmlPublic($buttons);
    }

    /**
     * Render the current instance as the complete form (form-runtime.md, "Complete form").
     *
     * @param mixed $options an object with optional action, hidden, formErrors and errors members
     * @throws FormError INVALID_FORM_INPUT for options outside the contract
     */
    public static function renderForm(Form $form, mixed $options = []): string
    {
        $fields = $form->getFields();
        $model = FormRender::model($fields, $form->getTemplate()->action ?? null, $options);
        return Rendering::form($fields, $form->getButtons(), $form->getMessages(), $model, $form->getDescription());
    }

    /** Render supplied list rows using the table or card layout. */
    public static function renderList(mixed $spec, mixed $rows, array $options = []): string
    {
        self::checkDisplay($spec, ['rows', $rows], $options);
        return Lists::render($spec, $rows, $options);
    }

    /** Build one read-only list model from supplied rows. */
    public static function buildList(mixed $spec, mixed $rows = [], array $options = []): stdClass
    {
        self::checkDisplay($spec, ['rows', $rows], $options);
        return Lists::buildPublic($spec, $rows, $options);
    }

    /** Render one read-only detail from a supplied record. */
    public static function renderDetail(
        mixed $spec,
        mixed $record = new stdClass(),
        array $options = []
    ): string {
        self::checkDisplay($spec, ['record', $record], $options);
        return Details::render($spec, $record, $options);
    }

    /** Build one read-only detail model from a supplied record. */
    public static function buildDetail(
        mixed $spec,
        mixed $record = new stdClass(),
        array $options = []
    ): stdClass {
        self::checkDisplay($spec, ['record', $record], $options);
        return Details::build($spec, $record, $options);
    }

    /**
     * Input text of a list or detail operation: the specification, the files, the rows or record,
     * then the display options. A value that is no object or array has no text to check here; its
     * shape fails in the operation, in argument order.
     *
     * @param array{0: string, 1: mixed} $input
     */
    private static function checkDisplay(mixed $spec, array $input, array $options): void
    {
        if (Value::isObject($spec)) {
            InputText::specification($spec, $options);
        }
        if (is_array($input[1]) || $input[1] instanceof stdClass) {
            InputText::inputs([$input], $options, InputText::DISPLAY);
        }
    }

    /** Format a nonnegative sequence with thirteen decimal digits. */
    public static function sequenceRowKey(int|string $sequence): string
    {
        if (!preg_match('/^\d{1,13}$/D', (string) $sequence)) {
            throw new FormError('INVALID_FORM_INPUT', 'A sequence must contain 1–13 decimal digits');
        }
        return '__' . str_pad((string) $sequence, 13, '0', STR_PAD_LEFT) . '__';
    }

    /** Generate a thirteen-character hexadecimal row key. */
    public static function createRowKey(): string
    {
        return '__' . substr(bin2hex(random_bytes(7)), 0, 13) . '__';
    }
}
