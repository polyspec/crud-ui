<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Expr\Expression;
use Polyspec\Crudui\Validator\Expr\GroupNode;
use Polyspec\Crudui\Validator\Expr\LiteralNode;
use Polyspec\Crudui\Validator\Expr\Node;
use Polyspec\Crudui\Validator\Expr\TernaryNode;
use Polyspec\Crudui\Validator\Patterns\PatternParameter;
use Polyspec\Crudui\Validator\Rules\ConditionTree;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\LengthLimit;
use Polyspec\Crudui\Validator\Values\Membership;
use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * Rule parameter checks. Declared parameters are checked when the specification
 * loads, including every literal a condition map or a ternary can select; a value a
 * ternary takes from the data is checked when it is selected. A failure is a load
 * failure located at the field's declaration path.
 *
 * @internal
 */
final class RuleParameters
{
    /** Rules that receive their parameters unchanged, never as conditions. */
    /** The message of a `reference` parameter outside its definition. */
    public const REFERENCE_MESSAGE = 'Invalid reference parameter: expected the declaration path of a field';

    public const UNCHANGED = [
        'equalTo', 'containedIn', 'typeFrom', 'minFrom', 'maxFrom', 'notEqual', 'unique', 'enddate', 'reference',
        'accept', 'match', 'pattern', 'in',
        'conditionTree',
    ];

    /**
     * Check a parameter that is used as declared or was selected by a condition.
     * `false` and `null` disable a rule and are not checked.
     *
     * @param list<string> $declarationPath property names from the root, without row keys
     * @throws ComposeLoadError
     */
    public static function check(string $rule, mixed $parameter, array $declarationPath): void
    {
        if ($parameter === false || $parameter === null) {
            return;
        }
        try {
            match ($rule) {
                'minlength', 'maxlength', 'mincount', 'maxcount' => LengthLimit::single($rule, $parameter),
                'rangelength' => LengthLimit::range($parameter),
                'number', 'digits' => Numeric::flag($rule, $parameter),
                'min', 'max' => Numeric::bound($rule, $parameter),
                'range' => Numeric::range($parameter),
                'step' => Numeric::step($parameter),
                'in' => Membership::fromParameter($parameter),
                'match', 'pattern' => PatternParameter::compile($rule, $parameter),
                'equalTo', 'containedIn', 'typeFrom', 'minFrom', 'maxFrom', 'enddate', 'notEqual', 'unique', 'reference'
                    => self::reference($rule, $parameter),
                'conditionTree' => ConditionTree::judges($parameter),
                default => null,
            };
        } catch (InvalidRuleParameter $error) {
            throw new ComposeLoadError(
                $error->getErrorCode(),
                $error->getMessage(),
                $declarationPath,
                previous: $error,
            );
        }
    }

    /**
     * Check the parameter of a rule that references a field: `equalTo`, `containedIn`, `typeFrom`, `minFrom`,
     * `maxFrom` and `enddate` take a field reference string, `notEqual` a string, number or boolean,
     * `unique` true or a string, and `reference` a string.
     *
     * @throws InvalidRuleParameter
     */
    private static function reference(string $rule, mixed $parameter): void
    {
        $message = match ($rule) {
            'equalTo', 'containedIn', 'typeFrom', 'minFrom', 'maxFrom', 'enddate' => \is_string($parameter)
                ? null : "Invalid $rule parameter: expected a field reference string",
            'reference' => \is_string($parameter)
                ? null : self::REFERENCE_MESSAGE,
            'notEqual' => \is_string($parameter) || \is_bool($parameter) || \is_int($parameter)
                || (\is_float($parameter) && is_finite($parameter))
                ? null : 'Invalid notEqual parameter: expected a string, number or boolean',
            default => \is_string($parameter) || $parameter === true
                ? null : 'Invalid unique parameter: expected true, false or a string',
        };
        if ($message !== null) {
            throw new InvalidRuleParameter(InvalidRuleParameter::PARAMETER, $message);
        }
    }

    /**
     * The literal values a declared parameter can resolve to: the parameter itself, the
     * values of a condition map, or the literal branches of a ternary (through nested
     * ternaries and groups).
     *
     * @return list<mixed>
     */
    public static function declaredValues(string $rule, mixed $parameter): array
    {
        if (!self::isConditional($rule, $parameter)) {
            return [$parameter];
        }
        if (!\is_string($parameter)) {
            return array_values((array) $parameter);
        }
        try {
            $node = Expression::parse($parameter);
        } catch (\Throwable) {
            return [];
        }
        return self::branchLiterals($node);
    }

    /**
     * @return list<mixed>
     */
    private static function branchLiterals(Node $node): array
    {
        return match (true) {
            $node instanceof TernaryNode => [
                ...self::branchLiterals($node->trueValue),
                ...self::branchLiterals($node->falseValue),
            ],
            $node instanceof GroupNode => self::branchLiterals($node->expression),
            $node instanceof LiteralNode => [$node->value],
            default => [],
        };
    }

    /**
     * Whether a declared parameter is resolved by a condition when the field is
     * validated: a condition map or a condition or ternary expression of a rule that
     * does not receive its parameter unchanged.
     */
    public static function isConditional(string $rule, mixed $parameter): bool
    {
        if (\in_array($rule, self::UNCHANGED, true)) {
            return false;
        }
        if (
            $parameter instanceof \stdClass
            || (\is_array($parameter) && $parameter !== [] && !array_is_list($parameter))
        ) {
            return true;
        }
        if (!\is_string($parameter)) {
            return false;
        }
        if (Expression::isConditionExpression($parameter)) {
            return true;
        }
        try {
            return Expression::parse($parameter) instanceof TernaryNode;
        } catch (\Throwable) {
            return false;
        }
    }
}
