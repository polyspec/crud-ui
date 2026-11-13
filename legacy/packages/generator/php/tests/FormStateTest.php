<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Conformance\Evidence;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use Polyspec\Crudui\Validator;
use stdClass;

/**
 * The form state fixtures against the PHP generator: the cases of legacy/tests/fixtures/form-view run their steps on a
 * form instance and those of legacy/tests/fixtures/view-functions call the view functions. Each observation equals the
 * one that the TypeScript reference recorded, as JSON text so that the order of object members counts. A row key that a
 * case does not write is one that an operation generated, and the observation names it `$1`, `$2` in the order of its
 * first appearance (legacy/tests/fixtures/form-state/README.md).
 */
final class FormStateTest extends TestCase
{
    private const KEY = '/__[0-9A-Za-z]{13}__/';

    /** @return array<string, array{stdClass}> */
    public static function cases(string $family): array
    {
        $cases = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../tests/fixtures/' . $family . '/cases.json'),
            false,
            512,
            JSON_THROW_ON_ERROR
        );
        $out = [];
        foreach ($cases as $case) {
            $out[$case->name] = [$case];
        }
        return $out;
    }

    /** @return array<string, array{stdClass}> */
    public static function viewSessions(): array
    {
        return self::cases('form-view');
    }

    /** @return array<string, array{stdClass}> */
    public static function historySessions(): array
    {
        return self::cases('form-history');
    }

    /** @return array<string, array{stdClass}> */
    public static function actionSessions(): array
    {
        return self::cases('form-actions');
    }

    /** @return array<string, array{stdClass}> */
    public static function choiceSessions(): array
    {
        return self::cases('form-choices');
    }

    /** @return array<string, array{stdClass}> */
    public static function viewFunctions(): array
    {
        return self::cases('view-functions');
    }

    #[DataProvider('viewSessions')]
    public function testViewSessionsEqualTheRecordedObservations(stdClass $case): void
    {
        $this->assertSession($case, false, 'viewState', 'form-view');
    }

    #[DataProvider('historySessions')]
    public function testHistorySessionsEqualTheRecordedObservations(stdClass $case): void
    {
        $this->assertSession($case, true, 'formHistory', 'form-history');
    }

    /**
     * Run the steps of a session; `$history` adds the flags `canUndo` and `canRedo` of the form to each observation.
     */
    private function assertSession(stdClass $case, bool $history, string $feature, string $family): void
    {
        $passed = false;
        try {
            $namer = new FixtureNamer(json_encode([$case->spec, $case->data, $case->steps], JSON_THROW_ON_ERROR));
            $form = new Form(Generator::compileForm($case->spec), $case->data);
            foreach ($case->steps as $index => $step) {
                $observed = [];
                try {
                    $result = self::perform($form, $step->op, $step->args, $case->spec);
                    // An action reports its result even when it is none, as the TypeScript reference does (null).
                    if ($result !== null || in_array($step->op, ['runAction', 'resolveAction'], true)) {
                        $observed['result'] = $namer->walk($result);
                    }
                } catch (FormError $error) {
                    $observed['error'] = ['code' => $error->getErrorCode(), 'message' => $error->getMessage()];
                }
                $observed['data'] = $namer->walk($form->getData());
                $observed['revision'] = $form->getRevision();
                if ($history) {
                    $observed['canUndo'] = $form->canUndo();
                    $observed['canRedo'] = $form->canRedo();
                }
                $observed['collapsed'] = $namer->walk(self::collapsedRows($form->getFields()));
                self::assertSame(
                    self::text($case->expected[$index]),
                    self::text($observed),
                    $case->name . ' step ' . $index . ' ' . self::text($step)
                );
            }
            $passed = true;
        } finally {
            Evidence::record(
                $feature,
                "legacy/tests/fixtures/{$family}/cases.json",
                (new \ReflectionClass(Generator::class))->isInternal() ? 'php-native' : 'php',
                $case->name,
                $passed,
            );
        }
    }

    #[DataProvider('actionSessions')]
    public function testActionSessionsEqualTheRecordedObservations(stdClass $case): void
    {
        $this->assertSession($case, true, 'runAction', 'form-actions');
    }

    #[DataProvider('choiceSessions')]
    public function testChoiceSessionsEqualTheRecordedObservations(stdClass $case): void
    {
        $this->assertSession($case, true, 'createForm', 'form-choices');
    }

    #[DataProvider('viewFunctions')]
    public function testViewFunctionCallsEqualTheRecordedResults(stdClass $case): void
    {
        $passed = false;
        try {
            self::assertSame(
                self::text($case->expected),
                self::text(['result' => self::call($case->op, $case->args)]),
                $case->name
            );
            $passed = true;
        } finally {
            Evidence::record(
                'viewState',
                'legacy/tests/fixtures/view-functions/cases.json',
                (new \ReflectionClass(Generator::class))->isInternal() ? 'php-native' : 'php',
                $case->name,
                $passed,
            );
        }
    }

    private static function text(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /** Run one step on the form and return what the step returned. */
    /**
     * The errors of the validator for the specification and the current record, in the validator's order.
     * The observation of a validate step is the flag `valid` and each error's data path, field name, rule and message.
     */
    private static function validation(stdClass $spec, stdClass $data): array
    {
        $result = Validator::validate($spec, $data);
        $errors = [];
        foreach ($result->errors as $error) {
            $errors[] = [
                'path' => $error->path,
                'field' => $error->field,
                'rule' => $error->rule,
                'message' => $error->message,
            ];
        }
        return ['valid' => $result->valid, 'errors' => $errors];
    }

    private static function perform(Form $form, string $op, array $args, stdClass $spec): mixed
    {
        return match ($op) {
            'validate' => self::validation($spec, $form->getData()),
            'choices' => self::fieldChoices($form->getFields(), $args[0])
                ?? throw new \LogicException('no field node at ' . $args[0]),
            'addRow' => $form->addRow($args[0], isset($args[1]) ? (array) $args[1] : []),
            'copyRow' => $form->copyRow($args[0], $args[1], isset($args[2]) ? (array) $args[2] : []),
            'removeRow' => $form->removeRow($args[0], $args[1]),
            'moveRow' => $form->moveRow($args[0], $args[1], $args[2]),
            'rekeyRow' => $form->rekeyRow($args[0], $args[1], $args[2]),
            'setValue' => $form->setValue($args[0], $args[1]),
            'setData' => $form->setData($args[0]),
            'toggleRow' => $form->toggleRow($args[0], $args[1]),
            'setAllExpanded' => $form->setAllExpanded($args[0]),
            'undo' => $form->undo(),
            'redo' => $form->redo(),
            'runAction' => Generator::runAction($form, $args[0]),
            'resolveAction' => Generator::resolveAction($args[0]),
            default => throw new \LogicException('unknown step ' . $op),
        };
    }

    /** @return list<array{value: string, label: string}>|null the options of the field node at a data path, depth first */
    private static function fieldChoices(array $nodes, string $path): ?array
    {
        foreach ($nodes as $node) {
            if (($node->kind ?? null) === 'field' && ($node->path ?? null) === $path) {
                return array_map(
                    static fn (object $option): array => ['value' => $option->value, 'label' => $option->label],
                    $node->widget->options ?? []
                );
            }
            $found = self::fieldChoices($node->children ?? [], $path);
            if ($found !== null) {
                return $found;
            }
        }
        return null;
    }

    /** @return list<string> the row paths of the collapsed rows of the evaluated nodes, depth first */
    private static function collapsedRows(array $nodes): array
    {
        $rows = [];
        foreach ($nodes as $node) {
            $children = $node->children ?? [];
            if (($node->kind ?? null) !== 'collection') {
                array_push($rows, ...self::collapsedRows($children));
                continue;
            }
            foreach ($children as $row) {
                if (($row->collapsible ?? false) === true && ($row->expanded ?? true) === false) {
                    $rows[] = $node->path . '.' . $row->key;
                }
                array_push($rows, ...self::collapsedRows($row->children ?? []));
            }
        }
        return $rows;
    }

    private static function nodes(mixed $spec, mixed $data, mixed $collapsed = null): array
    {
        $options = $collapsed === null ? [] : ['collapsed' => $collapsed];
        return Generator::bindForm(Generator::compileForm($spec), $data, $options);
    }

    private static function view(stdClass $view): array
    {
        return ['collapsed' => $view->collapsed];
    }

    private static function call(string $op, array $args): mixed
    {
        return match ($op) {
            'initialView' => Generator::initialView(),
            'toggleRowView' => Generator::toggleRowView(self::view($args[0]), $args[1]),
            'collapsibleRows' => Generator::collapsibleRows(self::nodes($args[0], $args[1])),
            'setAllExpandedView' => Generator::setAllExpandedView(self::nodes($args[0], $args[1]), $args[2]),
            'removeRowView' => Generator::removeRowView(self::view($args[0]), $args[1]),
            'rekeyRowView' => Generator::rekeyRowView(self::view($args[0]), $args[1], $args[2]),
            'bindCollapsed' => self::collapsedRows(self::nodes($args[0], $args[1], $args[2])),
            default => throw new \LogicException('unknown function ' . $op),
        };
    }
}
