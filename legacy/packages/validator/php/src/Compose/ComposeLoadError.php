<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

/** Specification composition failure before form generation or validation. */
final class ComposeLoadError extends \RuntimeException
{
    /** Composition error code, separate from Exception's integer code. */
    private readonly string $errorCode;

    /** @var list<string> Specification paths, separate from the exception stack. */
    private readonly array $compositionTrace;

    /**
     * @param list<string> $trace
     */
    public function __construct(string $code, string $message, array $trace = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->errorCode = $code;
        $this->compositionTrace = $trace;
    }

    /** Return the composition error code. */
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /** Return the specification paths recorded by the composition operation.
     * @return list<string>
     */
    public function getCompositionTrace(): array
    {
        return $this->compositionTrace;
    }

    /** Return the composition code when its virtual property is accessed. */
    public function __get(string $name): mixed
    {
        if ($name === 'code') {
            return $this->errorCode;
        }
        throw new \OutOfRangeException('Undefined property: ' . self::class . '::$' . $name);
    }

    /** Companion to __get so isset($e->code) reports the virtual `code` property. */
    public function __isset(string $name): bool
    {
        return $name === 'code';
    }
}
