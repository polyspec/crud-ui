<?php

declare(strict_types=1);

namespace Polyspec\Crudui;

/** Report a generation failure with its stable code and field path. */
final class FormError extends \RuntimeException
{
    /** Create a generation error. */
    public function __construct(
        private readonly string $errorCode,
        string $message,
        private readonly string $path = '',
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /** Return the stable error code. */
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /** Return the affected field path. */
    public function getPath(): string
    {
        return $this->path;
    }
}
