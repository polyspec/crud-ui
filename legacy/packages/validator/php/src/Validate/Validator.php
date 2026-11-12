<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Rules\Required;
use Polyspec\Crudui\Validator\Rules\Email;
use Polyspec\Crudui\Validator\Rules\MinLength;
use Polyspec\Crudui\Validator\Rules\MaxLength;
use Polyspec\Crudui\Validator\Rules\Min;
use Polyspec\Crudui\Validator\Rules\Max;
use Polyspec\Crudui\Validator\Rules\Pattern;
use Polyspec\Crudui\Validator\Rules\In;
use Polyspec\Crudui\Validator\Rules\Range;
use Polyspec\Crudui\Validator\Rules\RangeLength;
use Polyspec\Crudui\Validator\Rules\Number;
use Polyspec\Crudui\Validator\Rules\Digits;
use Polyspec\Crudui\Validator\Rules\ContainedIn;
use Polyspec\Crudui\Validator\Rules\EqualTo;
use Polyspec\Crudui\Validator\Rules\MaxFrom;
use Polyspec\Crudui\Validator\Rules\MinFrom;
use Polyspec\Crudui\Validator\Rules\TypeFrom;
use Polyspec\Crudui\Validator\Rules\NotEqual;
use Polyspec\Crudui\Validator\Rules\Date;
use Polyspec\Crudui\Validator\Rules\DateISO;
use Polyspec\Crudui\Validator\Rules\EndDate;
use Polyspec\Crudui\Validator\Rules\Url;
use Polyspec\Crudui\Validator\Rules\Accept;
use Polyspec\Crudui\Validator\Rules\MinCount;
use Polyspec\Crudui\Validator\Rules\MaxCount;
use Polyspec\Crudui\Validator\Rules\Step;
use Polyspec\Crudui\Validator\Rules\ConditionTree;
use Polyspec\Crudui\Validator\Rules\RuleInterface;
use Polyspec\Crudui\Validator\Expr\Expression;
use Polyspec\Crudui\Validator\Expr\ConditionalValue;
use Polyspec\Crudui\Validator\Expr\FieldPath;
use Polyspec\Crudui\Validator\Expr\Visibility;
use Polyspec\Crudui\Validator\Values\CanonicalText;
use Polyspec\Crudui\Validator\Values\EmptyValue;
use Polyspec\Crudui\Validator\Values\Membership;
use Polyspec\Crudui\Validator\Values\NumberText;

/**
 * CRUDUI form validator — SPEC §2 G5→§3→§2 G1. Port of
 * validator-ts/src/validate/validator.ts (Validator), function-for-function.
 *
 * This is the THIRD pass of the CRUDUI pipeline. It consumes a CRUDUI field model (the
 * validate/design/behavior/options role slots) AFTER the compose pass has
 * expanded $ref/$patch into a single spec (Validate::run runs compose first).
 * It does NOT re-implement the rule semantics or the expression engine — it CALLS
 * the rule instances (Polyspec\Crudui\Validator\Rules) and the CRUDUI expression engine
 * (Polyspec\Crudui\Validator\Expr). The logic here is:
 *   (a) reading the `validate` slot,
 *   (b) evaluating a rule value that is an expression OR a condition map (G1 —
 *       the condition is the value's expression, never a separate if/when key),
 *   (c) skipping every field hidden by `design.show`, with everything it contains.
 *
 * The rule instances return a bool and skip nothing on empty values, so this engine
 * applies the empty-value skip of the validation rules centrally and builds the error
 * message itself (DEFAULT_MESSAGES + per-field `messages` override). Declared rule
 * parameters, including every literal a condition can select, are checked when the
 * validator is constructed (DeclarationCheck); a value a ternary takes from the data
 * is checked when it is selected, before the empty-value skip. Both raise ComposeLoadError at the field's declaration
 * path.
 */
final class Validator
{
    /**
     * Rules that apply to the whole array of a `multiple` field (the rest apply
     * to each element). VALIDATION-RULES §array-level.
     */
    private const ARRAY_LEVEL_RULES = ['required', 'unique', 'mincount', 'maxcount'];

    /**
     * Default error messages per rule (identical in every runtime). Every registered
     * rule has one, so the keys are the registered rule names. The
     * `pattern` and `match` aliases share one message. {0}/{1} are replaced by the
     * parameters of the rules that have them.
     */
    public const DEFAULT_MESSAGES = [
        'required' => 'This field is required.',
        'email' => 'Please enter a valid email address.',
        'minlength' => 'Please enter at least {0} characters.',
        'maxlength' => 'Please enter no more than {0} characters.',
        'min' => 'Please enter a value greater than or equal to {0}.',
        'max' => 'Please enter a value less than or equal to {0}.',
        'match' => 'Please enter a valid format.',
        'pattern' => 'Please enter a valid format.',
        'unique' => 'Values must be unique.',
        'in' => 'Please select a valid option.',
        'range' => 'Please enter a value between {0} and {1}.',
        'rangelength' => 'Please enter a value between {0} and {1} characters.',
        'number' => 'Please enter a valid number.',
        'digits' => 'Please enter only digits.',
        'equalTo' => 'Please enter the same value again.',
        'containedIn' => 'Please enter a value that the referenced field contains.',
        'typeFrom' => 'Please enter a value of the declared type.',
        'minFrom' => 'Please enter a value at or above the declared minimum.',
        'maxFrom' => 'Please enter a value at or below the declared maximum.',
        'notEqual' => 'Please enter a different value.',
        'date' => 'Please enter a valid date.',
        'dateISO' => 'Please enter a valid date in ISO format (YYYY-MM-DD).',
        'enddate' => 'End date must be after the start date.',
        'url' => 'Please enter a valid URL.',
        'accept' => 'Please upload a file with a valid format.',
        'mincount' => 'Please select at least {0} items.',
        'maxcount' => 'Please select no more than {0} items.',
        'step' => 'Please enter a value that is a multiple of {0}.',
        'conditionTree' => 'Please enter a valid condition.',
        'reference' => 'Please select an existing value.',
    ];

    /** @var array<string, RuleInterface> rule instances by rule name */
    private array $rules;

    /** @var array<string, mixed> the composed root field map (composition-free) */
    private readonly array $properties;

    /**
     * For each collection field of the validation in progress (container path, field name and
     * filter), the row keys whose `unique` value an earlier row already holds.
     *
     * @var array<string, array<string, bool>>
     */
    private array $duplicatesByField = [];

    /**
     * For each declaration path that `reference` names, the member set of its ids in the data of
     * the validation in progress (docs/spec/validation-rules.md, "References").
     *
     * @var array<string, Membership>
     */
    private array $idsByPath = [];

    /**
     * @param array<string, mixed> $composedSpec a composed CRUDUI root spec — a group
     *        with `properties` (already free of $ref/$patch and forbidden keys).
     * @throws \Polyspec\Crudui\Validator\Compose\ComposeLoadError when a declared rule name or parameter is invalid
     */
    public function __construct(array $composedSpec)
    {
        $props = $composedSpec['properties'] ?? null;
        $this->properties = (is_array($props) && !array_is_list($props)) ? $props : [];
        DeclarationCheck::run($this->properties, [], $this->properties);
        $this->registerRules();
    }

    /**
     * Validate `data` against the composed CRUDUI spec.
     *
     * @param array<string, mixed> $data
     */
    public function validate(array $data): ValidationResult
    {
        try {
            $errors = [];
            $this->validateProperties($this->properties, $data, [], [], [], $data, $errors);

            $hidden = [];
            $this->collectHidden($this->properties, $data, [], [], $data, $hidden);
            return new ValidationResult(count($errors) === 0, array_values($errors), $hidden);
        } finally {
            // The duplicates belong to this validation.
            $this->duplicatesByField = [];
            $this->idsByPath = [];
        }
    }

    /** Register the rule instances; `pattern` and `match` share one implementation. */
    private function registerRules(): void
    {
        $this->rules = [
            'required' => new Required(),
            'email' => new Email(),
            'minlength' => new MinLength(),
            'maxlength' => new MaxLength(),
            'min' => new Min(),
            'max' => new Max(),
            'match' => new Pattern('match'),
            'pattern' => new Pattern('pattern'),
            'in' => new In(),
            'range' => new Range(),
            'rangelength' => new RangeLength(),
            'number' => new Number(),
            'digits' => new Digits(),
            'equalTo' => new EqualTo(),
            'containedIn' => new ContainedIn(),
            'typeFrom' => new TypeFrom(),
            'minFrom' => new MinFrom(),
            'maxFrom' => new MaxFrom(),
            'notEqual' => new NotEqual(),
            'date' => new Date(),
            'dateISO' => new DateISO(),
            'enddate' => new EndDate(),
            'url' => new Url(),
            'accept' => new Accept(),
            'mincount' => new MinCount(),
            'maxcount' => new MaxCount(),
            'step' => new Step(),
            'conditionTree' => new ConditionTree(),
        ];
    }

    // =========================================================================
    // Field traversal (SPEC §3).
    // =========================================================================

    /**
     * @param array<string, mixed> $properties
     * @param array<string, mixed> $data
     * @param list<string>         $currentPath
     * @param list<string>         $declarationPath $currentPath without row keys
     * @param array<string, mixed> $allData
     * @param array<int, array<string, mixed>> $errors
     * @param bool                 $hidden          whether an enclosing field is hidden: its
     *                                              descendants' data shape is still checked, their rules are not
     */
    private function validateProperties(
        array $properties,
        array $data,
        array $currentPath,
        array $rowKeys,
        array $declarationPath,
        array $allData,
        array &$errors,
        bool $hidden = false,
    ): void {
        $names = array_keys($data);
        sort($names, SORT_STRING);
        foreach ($names as $name) {
            if (!array_key_exists($name, $properties)) {
                throw new FormInputError('Unknown form data field: ' . implode('.', [...$currentPath, (string) $name]));
            }
        }
        foreach ($this->fieldsOf($properties) as $fieldName => $field) {
            $isMultiple = self::isMultiple($field);
            $fieldPath = [...$currentPath, $fieldName];
            $fieldDeclaration = [...$declarationPath, $fieldName];
            $present = array_key_exists($fieldName, $data);
            $fieldValue = $present ? $data[$fieldName] : null;

            // A field hidden by design.show has no rules evaluated, nor has anything it
            // contains; its data shape is still checked. Its value stays in the data, where
            // conditions elsewhere still read it.
            $fieldHidden = $hidden || !Visibility::shown(Visibility::declared($field), $allData, $fieldPath, $rowKeys);

            $childProps = $this->childProperties($field);

            if ($isMultiple && $present && !FieldShape::isObject($fieldValue)) {
                throw new FormInputError('Repeated data must be a keyed object: ' . implode('.', $fieldPath));
            }
            if ($isMultiple && $present) {
                KeyedMaps::assertKeys($field, $fieldValue, $fieldPath, $rowKeys, $allData);
            }
            if ($present && self::isSingleChoice($field)) {
                self::assertSingleChoiceData($fieldValue, $fieldPath, $isMultiple);
            }

            if (($field['type'] ?? null) === 'group' && $childProps !== null) {
                if ($isMultiple) {
                    if ($present) {
                        // Keyed rows use sorted-key traversal so the first reported
                        // error is identical in every validation implementation.
                        $rows = (array) $fieldValue;
                        $keys = array_map('strval', array_keys($rows));
                        sort($keys, SORT_STRING);
                        foreach ($keys as $key) {
                            $row = $rows[$key];
                            $rowPath = [...$fieldPath, $key];
                            if (!FieldShape::isObject($row)) {
                                throw new FormInputError('Group data must be an object: ' . implode('.', $rowPath));
                            }
                            $this->validateProperties(
                                $childProps,
                                (array) $row,
                                $rowPath,
                                [...$rowKeys, \count($fieldPath)],
                                $fieldDeclaration,
                                $allData,
                                $errors,
                                $fieldHidden
                            );
                        }
                    }
                    // Missing data is an empty collection: it has no rows, and the
                    // collection rules still evaluate it.
                    if (!$fieldHidden) {
                        $this->validateFieldRules(
                            $field,
                            $fieldValue,
                            $fieldPath,
                            $rowKeys,
                            $fieldDeclaration,
                            $allData,
                            $errors
                        );
                    }
                } else {
                    if ($present && !FieldShape::isObject($fieldValue)) {
                        throw new FormInputError('Group data must be an object: ' . implode('.', $fieldPath));
                    }
                    $this->validateProperties(
                        $childProps,
                        $present ? (array) $fieldValue : [],
                        $fieldPath,
                        $rowKeys,
                        $fieldDeclaration,
                        $allData,
                        $errors,
                        $fieldHidden
                    );
                    if (!$fieldHidden) {
                        $this->validateFieldRules(
                            $field,
                            $fieldValue,
                            $fieldPath,
                            $rowKeys,
                            $fieldDeclaration,
                            $allData,
                            $errors
                        );
                    }
                }
            } elseif ($fieldHidden) {
                continue;
            } elseif ($isMultiple && $present) {
                // Repeated scalar field: collection rules on the keyed object, the
                // rest on each row value.
                $this->validateMultipleFieldRules(
                    $field,
                    $fieldValue,
                    $fieldPath,
                    $rowKeys,
                    $fieldDeclaration,
                    $allData,
                    $errors
                );
            } else {
                $this->validateFieldRules(
                    $field,
                    $fieldValue,
                    $fieldPath,
                    $rowKeys,
                    $fieldDeclaration,
                    $allData,
                    $errors
                );
            }
        }
    }

    /**
     * Append the data paths of the fields whose design.show resolves to false, in declaration
     * order, each field of a group row under the row's key and the fields inside a hidden field
     * included (validation-rules.md, "Evaluation"). Data of another shape is read as missing.
     *
     * @param array<string, mixed> $properties
     * @param array<array-key, mixed> $data
     * @param list<string> $currentPath
     * @param list<int> $rowKeys positions of the row keys in $currentPath
     * @param array<string, mixed> $allData
     * @param list<string> $hidden
     */
    private function collectHidden(
        array $properties,
        array $data,
        array $currentPath,
        array $rowKeys,
        array $allData,
        array &$hidden
    ): void {
        foreach ($this->fieldsOf($properties) as $fieldName => $field) {
            $fieldPath = [...$currentPath, $fieldName];
            if (!Visibility::shown(Visibility::declared($field), $allData, $fieldPath, $rowKeys)) {
                $hidden[] = implode('.', $fieldPath);
            }
            $children = $this->childProperties($field);
            if (($field['type'] ?? null) !== 'group' || $children === null) {
                continue;
            }
            $value = $data[$fieldName] ?? null;
            if (!self::isMultiple($field)) {
                $this->collectHidden(
                    $children,
                    FieldShape::isObject($value) ? (array) $value : [],
                    $fieldPath,
                    $rowKeys,
                    $allData,
                    $hidden
                );
                continue;
            }
            $rows = FieldShape::isObject($value) ? (array) $value : [];
            $keys = array_map('strval', array_keys($rows));
            sort($keys, SORT_STRING);
            foreach ($keys as $key) {
                $row = $rows[$key];
                $this->collectHidden(
                    $children,
                    FieldShape::isObject($row) ? (array) $row : [],
                    [...$fieldPath, $key],
                    [...$rowKeys, \count($fieldPath)],
                    $allData,
                    $hidden
                );
            }
        }
    }

    /** Field types whose control holds one value (validation-rules.md, "Evaluation"). */
    private const SINGLE_CHOICE_TYPES = ['select', 'dropdown', 'selectbox', 'choice', 'radio'];

    /** Whether a field is a single-choice field: a single-choice type without `lang`. */
    private static function isSingleChoice(array $field): bool
    {
        $lang = $field['lang'] ?? null;
        return \in_array(
            $field['type'] ?? null,
            self::SINGLE_CHOICE_TYPES,
            true
        ) && ($lang === null || $lang === false);
    }

    /**
     * Reject an array or object as the value of a single-choice field, or of a row of a
     * repeated one (rows in sorted key order).
     *
     * @param list<string> $path
     * @throws FormInputError for the first value that is not a single value
     */
    private static function assertSingleChoiceData(mixed $value, array $path, bool $repeated): void
    {
        $entries = [[$path, $value]];
        if ($repeated) {
            $rows = (array) $value;
            $keys = array_map('strval', array_keys($rows));
            sort($keys, SORT_STRING);
            $entries = array_map(static fn (string $key): array => [[...$path, $key], $rows[$key]], $keys);
        }
        foreach ($entries as [$entryPath, $entry]) {
            if (\is_array($entry) || \is_object($entry)) {
                throw new FormInputError('Choice data must be a single value: ' . implode('.', $entryPath));
            }
        }
    }

    /**
     * Whether a CRUDUI field repeats (multiple: true, only or { … }).
     *
     * @internal
     * @param array<string, mixed> $field
     */
    public static function isMultiple(array $field): bool
    {
        return FieldShape::isRepeated($field);
    }

    /**
     * The child field map of a group (composed, plain object), or null.
     *
     * @return array<string, mixed>|null
     */
    private function childProperties(array $field): ?array
    {
        $props = $field['properties'] ?? null;
        if (FieldShape::isObject($props)) {
            return (array) $props;
        }
        return null;
    }

    // =========================================================================
    // validate-slot evaluation (SPEC §3 slots.validate).
    // =========================================================================

    /**
     * Collection rules and per-row rules for a repeated scalar field.
     *
     * @param array<string, mixed>|\stdClass $values keyed rows
     * @param list<string> $fieldPath
     * @param list<string> $declarationPath
     * @param array<string, mixed> $allData
     * @param array<int, array<string, mixed>> $errors
     */
    private function validateMultipleFieldRules(
        array $field,
        array|\stdClass $values,
        array $fieldPath,
        array $rowKeys,
        array $declarationPath,
        array $allData,
        array &$errors,
    ): void {
        $rules = $this->normalizeValidateSlot($field['validate'] ?? null);
        $messages = $this->fieldMessages($field);

        // 1. Array-level rules in declaration order; first error wins for field.
        if (
            $rules !== null
            && $this->applyRules(
                self::rulesAt($rules, true),
                $values,
                $fieldPath,
                $rowKeys,
                $declarationPath,
                $messages,
                $allData,
                $errors
            )
        ) {
            return;
        }

        // 2. Row rules in sorted row-key order (the cross-runtime error-order contract).
        $values = (array) $values;
        ksort($values, SORT_STRING);
        foreach ($values as $i => $value) {
            $this->validateFieldRules(
                $field,
                $value,
                [...$fieldPath, (string) $i],
                [...$rowKeys, \count($fieldPath)],
                $declarationPath,
                $allData,
                $errors,
                true
            );
        }
    }

    /**
     * All rules for a single (scalar or group-as-whole) field, or, with `$elementLevel`, the
     * element-level rules of one element of a `multiple` field (no array-level rule).
     *
     * @param list<string> $fieldPath
     * @param list<string> $declarationPath
     * @param array<string, mixed> $allData
     * @param array<int, array<string, mixed>> $errors
     */
    private function validateFieldRules(
        array $field,
        mixed $value,
        array $fieldPath,
        array $rowKeys,
        array $declarationPath,
        array $allData,
        array &$errors,
        bool $elementLevel = false,
    ): void {
        $messages = $this->fieldMessages($field);
        $rules = $this->normalizeValidateSlot($field['validate'] ?? null);

        if (
            $this->runImplicitNumber(
                $field,
                $rules,
                $value,
                $fieldPath,
                $rowKeys,
                $declarationPath,
                $messages,
                $allData,
                $errors
            )
            || $this->runGroupSource(
                $field,
                $value,
                $fieldPath,
                $rowKeys,
                $declarationPath,
                $messages,
                $allData,
                $errors
            )
        ) {
            return;
        }
        if ($rules === null) {
            return;
        }
        if ($elementLevel) {
            $rules = self::rulesAt($rules, false);
        }
        $this->applyRules($rules, $value, $fieldPath, $rowKeys, $declarationPath, $messages, $allData, $errors);
    }

    /**
     * A field whose `items` is a group source runs an implicit `in` check against the choices that
     * the source gives for the whole form data, after the implicit `number` check and before the
     * declared rules (validation-rules.md, "Values"). Returns true when it pushed an error (caller
     * stops the field).
     *
     * @param array<string, mixed> $field the field declaration
     * @param list<string> $path the path of the value that is checked
     * @param list<string> $declarationPath the path of the declaration of the field in the specification
     * @param array<string, string>|null $messages the custom messages of the field
     * @param array<string, mixed> $allData the whole form data, which the choices are read from
     * @param array<int, array<string, mixed>> $errors the errors found so far, keyed by path; receives the new one
     */
    private function runGroupSource(
        array $field,
        mixed $value,
        array $path,
        array $rowKeys,
        array $declarationPath,
        ?array $messages,
        array $allData,
        array &$errors,
    ): bool {
        if (!GroupSource::isSource($field['items'] ?? null)) {
            return false;
        }
        // A repeated value among the source rows is data that the choices cannot express (CUVR-087).
        $repeat = GroupSource::repeat((array) $field['items'], $allData);
        if ($repeat !== null) {
            throw new FormInputError($repeat);
        }
        $members = array_map(
            static fn (array $choice): string => $choice[0],
            GroupSource::choices((array) $field['items'], $allData)
        );
        return $this->applyRules(
            ['in' => $members],
            $value,
            $path,
            $rowKeys,
            $declarationPath,
            $messages,
            $allData,
            $errors
        );
    }

    /**
     * `type:number` runs an implicit `number` rule before everything else when no
     * explicit `number` rule is declared (VALIDATION-RULES §2 — reported as rule
     * `number`). Returns true when it pushed an error (caller stops the field).
     *
     * @param array<string, mixed>|null $rules the validate slot of the field, which says whether `number` is declared
     * @param list<string> $path the path of the value that is checked
     * @param list<string> $declarationPath the path of the declaration of the field in the specification
     * @param array<string, string>|null $messages the custom messages of the field
     * @param array<string, mixed> $allData the whole form data, which the conditions of the rule read
     * @param array<int, array<string, mixed>> $errors the errors found so far, keyed by path; receives the new one
     */
    private function runImplicitNumber(
        array $field,
        ?array $rules,
        mixed $value,
        array $path,
        array $rowKeys,
        array $declarationPath,
        ?array $messages,
        array $allData,
        array &$errors,
    ): bool {
        if (($field['type'] ?? null) !== 'number') {
            return false;
        }
        if ($rules !== null && array_key_exists('number', $rules)) {
            return false;
        }
        return $this->applyRules(
            ['number' => true],
            $value,
            $path,
            $rowKeys,
            $declarationPath,
            $messages,
            $allData,
            $errors
        );
    }

    // =========================================================================
    // Conditional rule value (G1) — expression / condition map → effective param.
    // =========================================================================

    /**
     * The rules that judge the collection of a `multiple` field as a whole (`$arrayLevel`), or the
     * rules that judge each element, in declaration order.
     *
     * @param array<string, mixed> $rules
     * @return array<string, mixed>
     */
    private static function rulesAt(array $rules, bool $arrayLevel): array
    {
        return array_filter(
            $rules,
            static fn (string|int $name): bool => in_array($name, self::ARRAY_LEVEL_RULES, true) === $arrayLevel,
            ARRAY_FILTER_USE_KEY
        );
    }

    /**
     * The field declarations of a properties map in declaration order, each as an array under its
     * name; a member that is not an object is not a field.
     *
     * @param array<array-key, mixed> $properties
     * @return \Generator<string, array<string, mixed>>
     */
    private function fieldsOf(array $properties): \Generator
    {
        foreach ($properties as $name => $field) {
            if (is_array($field) || $field instanceof \stdClass) {
                yield (string) $name => (array) $field;
            }
        }
    }

    /**
     * Run the rules in order until one fails, record that error under the path of the value and
     * return whether one failed.
     *
     * @param array<string, mixed> $rules the rules to run, in declaration order, each with its declared value
     * @param list<string> $path the path of the value that the rules check and that keys the error
     * @param list<string> $declarationPath the path of the declaration in the specification, for the load errors
     * @param array<string, string>|null $messages the custom messages of the field
     * @param array<string, mixed> $allData the whole form data, which the conditions of a rule read
     * @param array<int, array<string, mixed>> $errors the errors found so far, keyed by path; receives the first error
     */
    private function applyRules(
        array $rules,
        mixed $value,
        array $path,
        array $rowKeys,
        array $declarationPath,
        ?array $messages,
        array $allData,
        array &$errors,
    ): bool {
        foreach ($rules as $ruleName => $ruleValue) {
            $error = $this->runRule(
                $ruleName,
                $ruleValue,
                $value,
                $path,
                $rowKeys,
                $declarationPath,
                $messages,
                $allData
            );
            if ($error !== null) {
                $errors[$this->pathKey($path)] = $this->makeError($path, $ruleName, $error, $value);
                return true;
            }
        }
        return false;
    }

    /**
     * Run one rule: evaluate its (possibly conditional) value to an effective
     * param, check a selected param, apply the central empty-skip, then call the
     * rule instance and build the message. Returns the error message or null.
     *
     * @param list<string> $path
     * @param list<string> $declarationPath
     * @param array<string, string>|null $messages
     * @param array<string, mixed> $allData
     * @throws \Polyspec\Crudui\Validator\Compose\ComposeLoadError when a selected param is invalid
     */
    private function runRule(
        string $ruleName,
        mixed $ruleValue,
        mixed $value,
        array $path,
        array $rowKeys,
        array $declarationPath,
        ?array $messages,
        array $allData,
    ): ?string {
        $effectiveParam = $this->resolveRuleValue($ruleName, $ruleValue, $path, $rowKeys, $allData);

        // A false/null effective param disables the rule (VALIDATION-RULES §3).
        if ($effectiveParam === false || $effectiveParam === null) {
            return null;
        }

        // A param a condition selected is checked when selected, before the
        // empty-value skip: literals were already checked at construction, so only a
        // value taken from the data can fail here.
        if (RuleParameters::isConditional($ruleName, $ruleValue)) {
            RuleParameters::check($ruleName, $effectiveParam, $declarationPath);
        }

        // Central empty-skip. The rule instances do not skip empty values
        // themselves. required fails on an empty value, and the collection counts
        // evaluate it (an empty value counts 0).
        if (!in_array($ruleName, ['required', 'mincount', 'maxcount'], true) && EmptyValue::is($value)) {
            return null;
        }

        // unique with a filter/field-reference param needs the CRUDUI expression
        // engine and the array path form. Run the CRUDUI native unique here (JS rules/unique parity).
        if ($ruleName === 'unique') {
            $ok = $this->validateUnique($value, $effectiveParam, $path, $rowKeys, $allData);
            return $ok ? null : $this->buildMessage('unique', $effectiveParam, $messages);
        }

        if ($ruleName === 'reference') {
            $path = (string) $effectiveParam;
            $ids = $this->idsByPath[$path]
                ??= Membership::fromParameter(References::ids($this->properties, $allData, $path));
            return $ids->contains($value) ? null : $this->buildMessage('reference', $effectiveParam, $messages);
        }

        $rule = $this->rules[$ruleName] ?? null;
        if ($rule === null) {
            // Rule names are checked when the specification loads.
            throw new \LogicException('Rule ' . $ruleName . ' is not registered');
        }

        $ok = $rule->validate($value, $effectiveParam, $allData, new FieldPath($path, $rowKeys));
        if ($ok) {
            return null;
        }

        return $this->buildMessage($ruleName, $effectiveParam, $messages);
    }

    /**
     * Resolve a rule value to the effective param (G1).
     *
     * Path-reference, literal-param, regex and membership rules keep their parameter
     * verbatim; any other rule value resolves as a conditional parameter
     * ({@see ConditionalValue}).
     *
     * @param list<string> $path
     * @param array<string, mixed> $allData
     */
    private function resolveRuleValue(
        string $ruleName,
        mixed $ruleValue,
        array $path,
        array $rowKeys,
        array $allData,
    ): mixed {
        // Verbatim-param rules: never evaluate (field reference / literal / regex /
        // membership set). A membership param object is a value→label map (G3),
        // not a condition map, so it is preserved verbatim for the rule's flatten.
        if (in_array($ruleName, RuleParameters::UNCHANGED, true)) {
            return $ruleValue;
        }

        return ConditionalValue::resolve($ruleValue, $allData, $path, $rowKeys);
    }

    // =========================================================================
    // unique (CRUDUI native; JS rules/unique parity — filter condition + paths).
    // =========================================================================

    /**
     * Unique rule (two modes). A string param that is a condition expression acts
     * as a per-item filter (only items passing the condition participate); a
     * non-condition string param is a field name within array items.
     *
     * @param list<string> $pathSegments
     * @param array<string, mixed> $allData
     */
    private function validateUnique(
        mixed $value,
        mixed $ruleParam,
        array $pathSegments,
        array $rowKeys,
        array $allData,
    ): bool {
        if ($ruleParam === false || $ruleParam === null) {
            return true;
        }

        $isFilterCondition = is_string($ruleParam) && $this->isConditionExpression($ruleParam);

        if (is_array($value) || $value instanceof \stdClass) {
            // Array-level: the field value is the array itself.
            $valuesToCheck = [];
            if ($isFilterCondition) {
                foreach ($value as $i => $element) {
                    $itemPath = [...$pathSegments, (string) $i];
                    if (
                        !$this->itemPassesCondition(
                            $ruleParam,
                            $itemPath,
                            [...$rowKeys, \count($pathSegments)],
                            $allData
                        )
                    ) {
                        continue;
                    }
                    if (!EmptyValue::is($element)) {
                        $valuesToCheck[] = $element;
                    }
                }
            } elseif (is_string($ruleParam)) {
                foreach ($value as $item) {
                    if (is_array($item) || $item instanceof \stdClass) {
                        $fv = ((array) $item)[$ruleParam] ?? null;
                        if (!EmptyValue::is($fv)) {
                            $valuesToCheck[] = $fv;
                        }
                    }
                }
            } else {
                foreach ($value as $v) {
                    if (!EmptyValue::is($v)) {
                        $valuesToCheck[] = $v;
                    }
                }
            }

            if (count($valuesToCheck) === 0) {
                return true;
            }
            return $this->areAllUnique($valuesToCheck);
        }

        // Item-level: scalar field inside a repeated group.
        // Parent layout: <containerPath>.<itemKey>.<fieldName>.
        if (count($pathSegments) < 2) {
            return true;
        }
        $fieldName = $pathSegments[count($pathSegments) - 1];
        $itemKey = $pathSegments[count($pathSegments) - 2];
        $containerPath = array_slice($pathSegments, 0, -2);
        $container = $this->getValueByPath($allData, $containerPath);

        // Rows are list items or members of an object keyed by unique keys (__xxxx__ format).
        $list = is_array($container) && array_is_list($container);
        if ($list ? preg_match('/^\d+$/', $itemKey) !== 1 : !is_array($container) && !$container instanceof \stdClass) {
            return true;
        }

        // Empty values never count as duplicates.
        if (EmptyValue::is($value)) {
            return true;
        }

        // A filter condition that excludes the current item drops it entirely.
        if ($isFilterCondition && !$this->itemPassesCondition($ruleParam, $pathSegments, $rowKeys, $allData)) {
            return true;
        }

        // The rows of this collection field are walked once per validation: the filter is
        // evaluated once per row and each row whose value an earlier row holds is recorded.
        $cacheKey = implode("\0", [...$containerPath, $fieldName, $isFilterCondition ? $ruleParam : '']);
        if (!isset($this->duplicatesByField[$cacheKey])) {
            $duplicates = [];
            $seen = [];
            foreach ($container as $key => $item) {
                if (!is_array($item) && !$item instanceof \stdClass) {
                    continue;
                }
                $itemValue = ((array) $item)[$fieldName] ?? null;
                if (EmptyValue::is($itemValue)) {
                    continue;
                }
                $key = (string) $key;
                if (
                    $isFilterCondition
                    && !$this->itemPassesCondition(
                        $ruleParam,
                        [...$containerPath, $key, $fieldName],
                        $rowKeys,
                        $allData
                    )
                ) {
                    continue;
                }
                $itemValueKey = $this->canonicalKey($itemValue);
                if (isset($seen[$itemValueKey])) {
                    $duplicates[$key] = true;
                } else {
                    $seen[$itemValueKey] = true;
                }
            }
            $this->duplicatesByField[$cacheKey] = $duplicates;
        }

        // Check precomputed result: is this item a duplicate?
        return !isset($this->duplicatesByField[$cacheKey][$itemKey]);
    }

    /**
     * Evaluate a filter condition for an item, as if validating the same field on
     * that item (JS itemPassesCondition).
     *
     * @param list<string> $itemFieldPath
     * @param array<string, mixed> $allData
     */
    private function itemPassesCondition(string $condition, array $itemFieldPath, array $rowKeys, array $allData): bool
    {
        try {
            return Expression::evaluate($condition, $allData, $itemFieldPath, $rowKeys);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Whether no two canonical keys are identical.
     *
     * @param list<mixed> $values
     */
    private function areAllUnique(array $values): bool
    {
        $seen = [];
        foreach ($values as $value) {
            $key = $this->canonicalKey($value);
            if (isset($seen[$key])) {
                return false;
            }
            $seen[$key] = true;
        }
        return true;
    }

    /**
     * The canonical key of a value for `unique` (docs/spec/validation-rules.md): equal keys mean
     * the same JSON value. Every value carries its type, strings are JSON-escaped, a number of
     * either PHP type is written by its exact value as ECMAScript writes it, lists keep their
     * order, and object members, of a stdClass or an associative array, are sorted by name at
     * every depth.
     */
    private function canonicalKey(mixed $value): string
    {
        if ($value === null) {
            return 'z';
        }
        if (is_bool($value)) {
            return $value ? 'b1' : 'b0';
        }
        if (is_int($value) || is_float($value)) {
            return 'n' . NumberText::of((float) $value);
        }
        if (is_string($value)) {
            return 's' . json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        }
        if (is_array($value) && array_is_list($value)) {
            return 'a[' . implode(',', array_map(fn (mixed $item): string => $this->canonicalKey($item), $value)) . ']';
        }
        if (is_array($value) || $value instanceof \stdClass) {
            $members = [];
            foreach ((array) $value as $name => $member) {
                $members[(string) $name] = $this->canonicalKey($member);
            }
            ksort($members, SORT_STRING);
            $encoded = [];
            foreach ($members as $name => $key) {
                $encoded[] = json_encode((string) $name, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE) . ':' . $key;
            }
            return 'o{' . implode(',', $encoded) . '}';
        }
        return 'u' . get_debug_type($value);
    }

    /**
     * Whether a string looks like a condition expression (JS isConditionExpression):
     * starts with `.`, `identifier.`, contains a comparison/logical/in operator,
     * or contains a ternary `?...:`.
     */
    private function isConditionExpression(string $value): bool
    {
        return Expression::isConditionExpression($value);
    }

    // =========================================================================
    // Slot / message / value helpers.
    // =========================================================================

    /**
     * Normalize a polymorphic `validate` slot to a rule map. false/true/null → no
     * rules; a list/empty array → no rules; an assoc array → the rule map itself.
     *
     * @return array<string, mixed>|null
     */
    private function normalizeValidateSlot(mixed $slot): ?array
    {
        if ($slot === false || $slot === true || $slot === null) {
            return null;
        }
        if ($slot instanceof \stdClass || (is_array($slot) && !array_is_list($slot) && $slot !== [])) {
            return (array) $slot;
        }
        return null;
    }

    /**
     * Read the per-field custom messages (the `messages` map).
     *
     * @return array<string, string>|null
     */
    private function fieldMessages(array $field): ?array
    {
        $m = $field['messages'] ?? null;
        if ($m instanceof \stdClass || (is_array($m) && !array_is_list($m))) {
            /** @var array<string, string> $m */
            return (array) $m;
        }
        return null;
    }

    /**
     * Build the display message: per-field override → DEFAULT_MESSAGES → fallback,
     * with every {0}/{1} of a rule that has those parameters replaced by their
     * canonical texts.
     *
     * @param array<string, mixed>|null $messages
     */
    private function buildMessage(string $ruleName, mixed $param, ?array $messages): string
    {
        $message = $messages[$ruleName]
            ?? self::DEFAULT_MESSAGES[$ruleName]
            ?? 'Validation failed.';

        if ($message instanceof \stdClass) {
            $message = (array) $message;
        }
        if (is_array($message)) {
            $message = $message['en'] ?? $message['ko'] ?? (reset($message) ?: 'Validation failed.');
        }

        // Only the rules with parameters replace placeholders; any other placeholder stays as written.
        $parameters = match ($ruleName) {
            'minlength', 'maxlength', 'min', 'max', 'mincount', 'maxcount', 'step' => [$param],
            'range', 'rangelength' => is_array($param) && array_is_list($param) ? $param : [],
            default => [],
        };
        foreach (array_slice($parameters, 0, 2) as $index => $parameter) {
            $message = str_replace('{' . $index . '}', $this->stringify($parameter), $message);
        }

        return $message;
    }

    /** Placeholder text: the canonical text of a scalar; false, null, arrays and objects are empty. */
    private function stringify(mixed $value): string
    {
        if ($value === false || (is_float($value) && !is_finite($value))) {
            return '';
        }
        return CanonicalText::of($value) ?? '';
    }

    /**
     * Assemble an error record matching the shared fixture shape.
     *
     * @param list<string> $path
     * @return array<string, mixed>
     */
    private function makeError(array $path, string $rule, string $message, mixed $value): array
    {
        return [
            'path' => $this->pathToString($path),
            'field' => $this->getFieldName($path),
            'rule' => $rule,
            'message' => $message,
            'value' => $value,
        ];
    }

    /** @param list<string> $path */
    private function pathToString(array $path): string
    {
        return implode('.', $path);
    }

    /** @param list<string> $path */
    private function getFieldName(array $path): string
    {
        return count($path) > 0 ? $path[count($path) - 1] : '';
    }

    /**
     * A per-field key so the first error per field wins (later errors on the same
     * path are ignored). The dot-path is unique per field instance.
     *
     * @param list<string> $path
     */
    private function pathKey(array $path): string
    {
        return $this->pathToString($path);
    }

    /**
     * Read the value at a concrete path (JS getValueByPath). Missing → null.
     *
     * @param array<string, mixed> $data
     * @param list<string> $path
     */
    private function getValueByPath(array $data, array $path): mixed
    {
        $current = $data;
        foreach ($path as $segment) {
            if (
                (!is_array($current) && !$current instanceof \stdClass)
                || !array_key_exists($segment, (array) $current)
            ) {
                return null;
            }
            $current = ((array) $current)[$segment];
        }
        return $current;
    }
}
