<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * The data path of the value a rule validates, with the positions of its row keys, so a relative
 * field reference treats a row as one level (expressions.md, "Evaluation").
 */
final class FieldPath
{
    /**
     * @param list<string> $segments the data path, row keys included
     * @param list<int> $rowKeys positions of the row keys in $segments
     */
    public function __construct(
        public readonly array $segments,
        public readonly array $rowKeys,
    ) {
    }

    /** The value of a field reference of a rule parameter in the data. */
    public function reference(string $expression, array|\stdClass $data): mixed
    {
        return (new Evaluator($data, $this->segments, $this->rowKeys))->reference($expression);
    }
}
