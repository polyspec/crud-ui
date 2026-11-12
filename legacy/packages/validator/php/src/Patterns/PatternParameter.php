<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;

/**
 * The parameter of `pattern` or `match`: a string in the CRUDUI pattern language.
 *
 * @internal
 */
final class PatternParameter
{
    /**
     * Compile a declared pattern parameter.
     *
     * @param string $rule `pattern` or `match`, used in the failure message
     * @throws InvalidRuleParameter
     */
    public static function compile(string $rule, mixed $parameter): WholeMatchPattern
    {
        if (!\is_string($parameter)) {
            throw new InvalidRuleParameter(
                InvalidRuleParameter::PARAMETER,
                "Invalid $rule parameter: expected a pattern string",
            );
        }
        try {
            return WholeMatchPattern::compile($parameter);
        } catch (PatternSyntaxError $error) {
            throw new InvalidRuleParameter(
                InvalidRuleParameter::PATTERN,
                "Invalid $rule pattern: {$error->reason} at {$error->offset}",
                previous: $error,
            );
        }
    }
}
