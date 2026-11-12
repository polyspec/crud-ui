<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

/**
 * A pattern outside the CRUDUI pattern language, with its reason and code point offset.
 *
 * @internal
 */
final class PatternSyntaxError extends \InvalidArgumentException
{
    /**
     * @param string $reason one of the reasons of the validation rules
     * @param int $offset the code point index where the invalid construct starts
     */
    public function __construct(public readonly string $reason, public readonly int $offset)
    {
        parent::__construct($reason . ' at ' . $offset);
    }
}
