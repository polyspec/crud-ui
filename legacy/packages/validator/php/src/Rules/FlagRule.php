<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\Numeric;

/**
 * A rule whose parameter is a boolean flag: the flag false switches the rule off, and with the flag on the rule
 * accepts or rejects the value.
 *
 * @extends ParameterRule<bool>
 */
abstract class FlagRule extends ParameterRule
{
    /**
     * @throws InvalidRuleParameter when the parameter is not a boolean flag
     */
    final protected function parameter(mixed $param): bool
    {
        return Numeric::flag($this->name(), $param);
    }

    /**
     * @param bool $parameter
     */
    final protected function holds(mixed $value, mixed $parameter): bool
    {
        return !$parameter || $this->accepts($value);
    }

    /** The name of the rule in the validation rules, which names the parameter in its error. */
    abstract protected function name(): string;

    /** Whether the rule accepts the value while it is on. */
    abstract protected function accepts(mixed $value): bool;
}
