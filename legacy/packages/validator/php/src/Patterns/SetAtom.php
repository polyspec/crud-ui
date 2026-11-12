<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

use Polyspec\Crudui\Validator\Values\CodePointSet;

/**
 * An atom matching one code point of a set: a literal, an escape, a shorthand, `.`,
 * a bracket class or a property. Its size is 1.
 *
 * @internal
 */
final class SetAtom implements Node
{
    /** @param CodePointSet $set the code points the atom matches */
    public function __construct(public readonly CodePointSet $set)
    {
    }

    /** The pattern size of the atom. */
    public function size(): int
    {
        return 1;
    }
}
