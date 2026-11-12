<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;

/**
 * A rule with a parameter: the rule reads and checks the parameter first, so a parameter outside the
 * validation rules fails before the value is looked at, and then decides whether the value holds.
 *
 * @template P
 */
abstract class ParameterRule implements RuleInterface
{
    /**
     * Validate a value against the checked parameter of the rule.
     *
     * @throws InvalidRuleParameter when the parameter is outside the validation rules
     */
    final public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        return $this->holds($value, $this->parameter($param));
    }

    /**
     * The checked parameter of the rule.
     *
     * @return P
     * @throws InvalidRuleParameter when the parameter is outside the validation rules
     */
    abstract protected function parameter(mixed $param): mixed;

    /**
     * Whether the value holds under the checked parameter.
     *
     * @param P $parameter
     */
    abstract protected function holds(mixed $value, mixed $parameter): bool;
}
