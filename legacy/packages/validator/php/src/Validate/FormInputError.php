<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

/** Submitted form data whose shape does not match the specification. */
final class FormInputError extends \RuntimeException
{
    /** Stable error code shared with the form runtime, separate from Exception's integer code. */
    private readonly string $errorCode;

    /** Create an input failure whose message names the rule and the data path. */
    public function __construct(string $message)
    {
        parent::__construct($message);
        $this->errorCode = 'INVALID_FORM_INPUT';
    }

    /** Return the input error code. */
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
