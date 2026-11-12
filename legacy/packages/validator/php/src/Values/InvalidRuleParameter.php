<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Values;

/**
 * A rule parameter outside the validation rules. The validator reports it as a load
 * failure at the declaring field.
 *
 * @internal
 */
final class InvalidRuleParameter extends \InvalidArgumentException
{
    /** Code for a parameter of the wrong type or value. */
    public const PARAMETER = 'INVALID_RULE_PARAMETER';

    /** Code for a pattern outside the CRUDUI pattern language. */
    public const PATTERN = 'INVALID_RULE_PATTERN';

    /** @param string $errorCode INVALID_RULE_PARAMETER or INVALID_RULE_PATTERN */
    public function __construct(private readonly string $errorCode, string $message, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    /** Return the load failure code. */
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
