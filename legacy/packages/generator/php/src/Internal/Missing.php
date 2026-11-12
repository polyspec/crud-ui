<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

/** Represent an absent value separately from explicit null. */
enum Missing
{
    case Value;
}
