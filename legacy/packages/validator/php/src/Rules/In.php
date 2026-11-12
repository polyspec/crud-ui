<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;
use Polyspec\Crudui\Validator\Values\Membership;

/**
 * Membership validation rule: the value is one of the declared members.
 */
class In implements RuleInterface
{
    /**
     * Validate that a value, or every element of a list value, is a member.
     *
     * @throws InvalidRuleParameter when the parameter is not a valid member set
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        if ($param === false) {
            return true;
        }
        return Membership::fromParameter($param)->contains($value);
    }
}
