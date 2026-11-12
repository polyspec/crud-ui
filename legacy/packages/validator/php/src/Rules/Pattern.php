<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;
use Polyspec\Crudui\Validator\Patterns\PatternParameter;
use Polyspec\Crudui\Validator\Values\CanonicalText;
use Polyspec\Crudui\Validator\Values\InvalidRuleParameter;

/**
 * Whole-value pattern rule, registered as both `pattern` and `match`.
 * Named "Pattern" because "match" is a reserved keyword in PHP.
 */
class Pattern implements RuleInterface
{
    /** @param string $rule the registered name, `pattern` or `match`, used in parameter failures */
    public function __construct(private readonly string $rule = 'pattern')
    {
    }

    /**
     * Validate that the whole canonical text of a value matches a CRUDUI pattern.
     * An array or object value fails.
     *
     * @throws InvalidRuleParameter when the parameter is not a pattern in the language
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        $pattern = PatternParameter::compile($this->rule, $param);
        $text = CanonicalText::of($value);
        return $text !== null && $pattern->matches($text);
    }
}
