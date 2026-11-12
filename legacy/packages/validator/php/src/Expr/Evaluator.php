<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

use Polyspec\Crudui\Validator\Values\CanonicalText;

/**
 * CRUDUI expression evaluator (expressions.md §5/§6/§7, JS PathResolver parity).
 *
 * The shared 4-language fixture (legacy/tests/fixtures/expr/cases.json) is generated
 * from the JS reference engine and is the §9 contract all four engines pass, so
 * this evaluator mirrors validator-ts PathResolver function-for-function:
 *
 *   - evaluate(node)               → boolean (JS evaluateCondition): Boolean of
 *                                    the resolved value for Path/Literal; logical
 *                                    short-circuit; comparison; in; unary; a
 *                                    ternary is Boolean(its branch value).
 *   - evaluateValue(node)          → value  (JS evaluateExpressionValue): ternary
 *                                    returns its branch value; EVERYTHING else
 *                                    returns the boolean condition result.
 *
 * truthy (JS Boolean): null/false/0/"" falsy; "0", "false", [], {}, and every
 * non-empty value truthy. == / != use JS loose equality (same-type ===, else
 * numeric when both Number()-parse, else string). > >= < <= coerce BOTH sides
 * to number (parseFloat, NaN→0) and compare numerically — there is no
 * lexicographic branch (JS compare parity).
 *
 * No eval / no regex evaluation (GRAMMAR §10) — pure AST walk.
 */
final class Evaluator
{
    /**
     * @param array<string, mixed> $formData full form data tree (assoc arrays)
     * @param list<string>         $currentPath path of the field carrying the
     *                              condition, including the field name itself
     * @param list<int>            $rowKeys     positions of the row keys in $currentPath
     */
    public function __construct(
        private readonly array|\stdClass $formData,
        private readonly array $currentPath = [],
        private readonly array $rowKeys = [],
    ) {
    }

    /**
     * The value of a field reference of a rule parameter (`equalTo`, `notEqual`, `enddate`):
     * a relative path resolves as a relative expression path, a dotted name from the data root,
     * and a bare name beside the current field.
     */
    public function reference(string $expression): mixed
    {
        $trimmed = trim($expression);
        if ($trimmed === '') {
            return null;
        }
        $dots = strspn($trimmed, '.');
        $relative = $dots > 0 || !str_contains($trimmed, '.');
        $segments = array_map(
            static fn (string $part): PathSegment => $part === '*'
                ? PathSegment::wildcard()
                : PathSegment::identifier($part),
            array_values(array_filter(
                explode('.', substr($trimmed, $dots)),
                static fn (string $part): bool => $part !== ''
            )),
        );
        return $this->resolvePath(new PathNode($relative, max(0, $dots - 1), $segments));
    }

    /**
     * Evaluate to a boolean condition result (JS evaluateCondition).
     */
    public function evaluate(Node $node): bool
    {
        return match (true) {
            $node instanceof BinaryNode  => $this->evaluateBinary($node),
            $node instanceof UnaryNode   => $this->evaluateUnary($node),
            $node instanceof InNode      => $this->evaluateIn($node),
            $node instanceof GroupNode   => $this->evaluate($node->expression),
            $node instanceof TernaryNode => self::isTruthy($this->evaluateTernary($node)),
            $node instanceof PathNode,
            $node instanceof LiteralNode => self::isTruthy($this->resolveValue($node)),
            default                      => false,
        };
    }

    /**
     * Evaluate to a value (JS evaluateExpressionValue). A ternary returns its
     * chosen branch's RAW value; every other node returns its boolean condition
     * result (the shared fixture's `value` for non-ternary mirrors `truthy`).
     */
    public function evaluateValue(Node $node): mixed
    {
        return match (true) {
            $node instanceof TernaryNode => $this->evaluateTernary($node),
            $node instanceof GroupNode   => $this->evaluateValue($node->expression),
            default                      => $this->evaluate($node),
        };
    }

    /**
     * Resolve a ternary branch to its RAW value (JS resolveTernaryBranchValue):
     * nested ternary recurses; literal/path return their value; logical/in/
     * comparison/unary return their boolean.
     */
    private function resolveTernaryBranchValue(Node $node): mixed
    {
        return match (true) {
            $node instanceof TernaryNode => $this->evaluateTernary($node),
            $node instanceof GroupNode   => $this->resolveTernaryBranchValue($node->expression),
            $node instanceof LiteralNode => $node->value,
            $node instanceof PathNode    => $this->resolveValue($node),
            $node instanceof BinaryNode  => $this->evaluateBinary($node),
            $node instanceof UnaryNode   => $this->evaluateUnary($node),
            $node instanceof InNode      => $this->evaluateIn($node),
            default                      => null,
        };
    }

    private function evaluateTernary(TernaryNode $node): mixed
    {
        if ($this->evaluate($node->condition)) {
            return $this->resolveTernaryBranchValue($node->trueValue);
        }
        return $this->resolveTernaryBranchValue($node->falseValue);
    }

    private function evaluateBinary(BinaryNode $node): bool
    {
        // Short-circuit logical operators.
        if ($node->operator === '&&') {
            return $this->evaluate($node->left) && $this->evaluate($node->right);
        }
        if ($node->operator === '||') {
            return $this->evaluate($node->left) || $this->evaluate($node->right);
        }

        [$left, $candidates] = $this->resolveOperand($node->left);
        $right = $this->resolveValue($node->right);

        // A wildcard path resolves to a list of candidate values: ANY match
        // (CURRENT strategy already collapses to a scalar before this point).
        // An array that a plain path names is one value.
        if ($candidates) {
            foreach ($left as $lv) {
                if (self::compareOp($lv, $right, $node->operator)) {
                    return true;
                }
            }
            return false;
        }

        return self::compareOp($left, $right, $node->operator);
    }

    private static function compareOp(mixed $left, mixed $right, string $operator): bool
    {
        return match ($operator) {
            '=='    => self::looseEquals($left, $right),
            '!='    => !self::looseEquals($left, $right),
            '>'     => self::coerceNumber($left) > self::coerceNumber($right),
            '>='    => self::coerceNumber($left) >= self::coerceNumber($right),
            '<'     => self::coerceNumber($left) < self::coerceNumber($right),
            '<='    => self::coerceNumber($left) <= self::coerceNumber($right),
            default => false,
        };
    }

    private function evaluateUnary(UnaryNode $node): bool
    {
        if ($node->operator === '!') {
            return !$this->evaluate($node->operand);
        }
        return false;
    }

    private function evaluateIn(InNode $node): bool
    {
        [$value, $candidates] = $this->resolveOperand($node->value);
        $list = array_map(fn (Node $n): mixed => $this->resolveValue($n), $node->list);

        // Wildcard value resolved to a list: ANY element passing membership.
        if ($candidates) {
            foreach ($value as $v) {
                $included = self::inList($v, $list);
                if ($node->negated ? !$included : $included) {
                    return true;
                }
            }
            return false;
        }

        $included = self::inList($value, $list);
        return $node->negated ? !$included : $included;
    }

    /** @param list<mixed> $list */
    private static function inList(mixed $value, array $list): bool
    {
        foreach ($list as $item) {
            if (self::looseEquals($value, $item)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Resolve a node to its raw value (JS resolveValue): Literal → its value;
     * Path → the data at the resolved path (wildcards handled); Group → the
     * inner condition's boolean.
     */
    private function resolveValue(Node $node): mixed
    {
        return match (true) {
            $node instanceof LiteralNode => $node->value,
            $node instanceof PathNode    => $this->resolvePath($node),
            $node instanceof GroupNode   => $this->evaluate($node->expression),
            default                      => null,
        };
    }

    /**
     * Resolve the left operand of a comparison: the list of candidate values of a
     * wildcard path with true, or the one value of any other node with false.
     *
     * @return array{0: mixed, 1: bool}
     */
    private function resolveOperand(Node $node): array
    {
        return $node instanceof PathNode ? $this->resolvePathOperand($node) : [$this->resolveValue($node), false];
    }

    // --- path resolution (JS resolvePathSegments + resolveValue parity) -------

    private function resolvePath(PathNode $node): mixed
    {
        return $this->resolvePathOperand($node)[0];
    }

    /**
     * The value of a path with false, or the list of candidate values of a wildcard
     * that the current path does not resolve with true.
     *
     * @return array{0: mixed, 1: bool}
     */
    private function resolvePathOperand(PathNode $node): array
    {
        $resolvedPath = $this->resolvePathSegments($node);

        if (self::hasWildcard($resolvedPath)) {
            // CURRENT strategy: replace wildcards with the current array indices.
            $resolvedPath = self::replaceWildcardWithIndex($resolvedPath, $this->currentPath);

            if (self::hasWildcard($resolvedPath)) {
                // Still wildcarded: resolve to the list of all matching values.
                $resolved = $this->resolveWildcardPath($resolvedPath);
                return [array_map(static fn (array $r): mixed => $r['value'], $resolved), true];
            }
        }

        return [$this->getValueByPath($resolvedPath), false];
    }

    /**
     * Compute the absolute path segments for a Path node (JS resolvePathSegments).
     *
     * @return list<string>
     */
    private function resolvePathSegments(PathNode $node): array
    {
        if ($node->relative) {
            // The current field is one level and each further dot moves one more level up; a row
            // key and the name of its collection leave together (expressions.md, "Evaluation").
            $basePath = $this->currentPath;
            for ($level = 0; $level <= $node->levelsUp && $basePath !== []; $level++) {
                $leaving = \in_array(\count($basePath) - 1, $this->rowKeys, true) ? 2 : 1;
                $basePath = \array_slice($basePath, 0, max(0, \count($basePath) - $leaving));
            }
        } else {
            $basePath = [];
        }

        foreach ($node->segments as $seg) {
            $basePath[] = match ($seg->type) {
                'identifier' => (string) $seg->value,
                'index'      => (string) $seg->index,
                'wildcard'   => '*',
                default      => '',
            };
        }

        return $basePath;
    }

    /**
     * Read the value at a concrete path (JS getValueByPath). A missing key
     * yields null. Numeric segments index into list arrays.
     *
     * @param list<string> $path
     */
    private function getValueByPath(array $path): mixed
    {
        $current = $this->formData;

        foreach ($path as $segment) {
            if ($current === null) {
                return null;
            }
            if ($current instanceof \stdClass) {
                if (!property_exists($current, $segment)) {
                    return null;
                }
                $current = $current->{$segment};
            } elseif (is_array($current)) {
                if (!array_key_exists($segment, $current)) {
                    return null;
                }
                $current = $current[$segment];
            } else {
                return null;
            }
        }

        return $current;
    }

    /**
     * Resolve a wildcard path to all concrete {path,value} pairs (JS
     * resolveWildcardPath, ANY strategy across the array; object source skips
     * the wildcard index per multiple:'only').
     *
     * @param list<string> $path
     * @return list<array{path: list<string>, value: mixed}>
     */
    private function resolveWildcardPath(array $path): array
    {
        $wildcardIndex = self::indexOfWildcard($path);
        if ($wildcardIndex === -1) {
            return [['path' => $path, 'value' => $this->getValueByPath($path)]];
        }

        $arrayPath = array_slice($path, 0, $wildcardIndex);
        $remainingPath = array_slice($path, $wildcardIndex + 1);
        $arrayData = $this->getValueByPath($arrayPath);

        // Object source: skip the wildcard index, access remaining directly.
        if ($arrayData instanceof \stdClass || (is_array($arrayData) && !array_is_list($arrayData))) {
            return $this->resolveWildcardPath([...$arrayPath, ...$remainingPath]);
        }

        if (!is_array($arrayData)) {
            return [];
        }

        $results = [];
        foreach (array_keys($arrayData) as $i) {
            $concrete = [...$arrayPath, (string) $i, ...$remainingPath];
            foreach ($this->resolveWildcardPath($concrete) as $r) {
                $results[] = $r;
            }
        }

        return $results;
    }

    /**
     * Replace each wildcard with the corresponding array index from currentPath,
     * in order (JS replaceWildcardWithIndex). Wildcards with no matching index
     * stay as '*' for later list resolution.
     *
     * @param list<string> $path
     * @param list<string> $currentPath
     * @return list<string>
     */
    private static function replaceWildcardWithIndex(array $path, array $currentPath): array
    {
        $arrayIndices = [];
        foreach ($currentPath as $segment) {
            if (self::isNumericSegment($segment)) {
                $arrayIndices[] = $segment;
            }
        }

        $result = [];
        $cursor = 0;
        foreach ($path as $segment) {
            if ($segment === '*') {
                if (array_key_exists($cursor, $arrayIndices)) {
                    $result[] = $arrayIndices[$cursor];
                    $cursor++;
                } else {
                    $result[] = '*';
                }
            } else {
                $result[] = $segment;
            }
        }

        return $result;
    }

    /** @param list<string> $path */
    private static function hasWildcard(array $path): bool
    {
        return in_array('*', $path, true);
    }

    /** @param list<string> $path */
    private static function indexOfWildcard(array $path): int
    {
        $i = array_search('*', $path, true);
        return $i === false ? -1 : $i;
    }

    private static function isNumericSegment(string $segment): bool
    {
        return $segment !== '' && preg_match('/^\d+$/', $segment) === 1;
    }

    // --- value semantics (JS truthy / looseEquals / coerceNumber parity) -----

    /**
     * Truthy test (JS Boolean). null/false/0/0.0/"" are falsy; "0", "false",
     * empty array, empty object, and every non-empty value are truthy.
     */
    public static function isTruthy(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return $value != 0;
        }
        if (is_string($value)) {
            return $value !== '';
        }
        if (is_array($value)) {
            // [] and {} are both truthy in JS (Boolean of any object/array).
            return true;
        }
        return true;
    }

    /**
     * Loose equality (JS looseEquals). Values of one JS type compare as JSON
     * values (jsonEquals); null equals only null; otherwise numeric equality when
     * both Number()-parse, else string equality.
     */
    public static function looseEquals(mixed $a, mixed $b): bool
    {
        if (self::sameJsType($a, $b)) {
            return self::jsonEquals($a, $b);
        }

        if ($a === null) {
            return $b === null;
        }
        if ($b === null) {
            return false;
        }

        [$aNum, $aOk] = self::jsNumber($a);
        [$bNum, $bOk] = self::jsNumber($b);
        if ($aOk && $bOk) {
            return $aNum === $bNum;
        }

        return self::toString($a) === self::toString($b);
    }

    /**
     * JSON-value structural equality (docs/spec/expressions.md, Evaluation): two
     * lists hold equal elements in the same order, two objects the same keys with
     * equal values in any key order; other values compare without conversion,
     * numbers by value (int 1 equals float 1.0). A list never equals an object.
     */
    private static function jsonEquals(mixed $a, mixed $b): bool
    {
        if (\is_array($a) && \is_array($b)) {
            if (\count($a) !== \count($b) || array_is_list($a) !== array_is_list($b)) {
                return false;
            }
            if (array_is_list($a)) {
                foreach ($a as $index => $item) {
                    if (!self::jsonEquals($item, $b[$index])) {
                        return false;
                    }
                }
                return true;
            }
            foreach ($a as $key => $item) {
                if (!\array_key_exists($key, $b) || !self::jsonEquals($item, $b[$key])) {
                    return false;
                }
            }
            return true;
        }
        if ((\is_int($a) || \is_float($a)) && (\is_int($b) || \is_float($b))) {
            return (float) $a === (float) $b;
        }
        return $a === $b;
    }

    /**
     * Coerce a value to a number for comparison (JS coerceNumber): numbers pass
     * through; a string is parseFloat-ed (NaN→0); booleans → 1/0; else 0.
     */
    public static function coerceNumber(mixed $value): float
    {
        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }
        if (is_string($value)) {
            [$num, $ok] = self::parseFloatPrefix($value);
            return $ok ? $num : 0.0;
        }
        if (is_bool($value)) {
            return $value ? 1.0 : 0.0;
        }
        return 0.0;
    }

    /**
     * Whether two values share the same JS typeof bucket (number covers int and
     * float; arrays/objects are 'object').
     */
    private static function sameJsType(mixed $a, mixed $b): bool
    {
        return self::jsTypeOf($a) === self::jsTypeOf($b);
    }

    private static function jsTypeOf(mixed $v): string
    {
        return match (true) {
            $v === null            => 'null',
            is_bool($v)            => 'boolean',
            is_int($v), is_float($v) => 'number',
            is_string($v)          => 'string',
            default                => 'object',
        };
    }

    /**
     * JS Number(value) for equality: numbers pass; a string is numeric only when
     * the WHOLE string parses (JS Number('12abc') is NaN); booleans → 1/0.
     *
     * @return array{0: float, 1: bool}
     */
    private static function jsNumber(mixed $value): array
    {
        if (is_int($value) || is_float($value)) {
            return [(float) $value, true];
        }
        if (is_bool($value)) {
            return [$value ? 1.0 : 0.0, true];
        }
        if (is_string($value)) {
            $number = \Polyspec\Crudui\Validator\Support\NumberValue::parseString($value);
            return $number === null ? [0.0, false] : [$number, true];
        }
        return [0.0, false];
    }

    /**
     * parseFloat-style leading-number parse (JS parseFloat): reads an optional
     * sign, digits, fraction, exponent prefix; returns failure when no number
     * leads the string.
     *
     * @return array{0: float, 1: bool}
     */
    private static function parseFloatPrefix(string $value): array
    {
        if (preg_match('/^[ \t\n\r]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/', $value, $m) === 1) {
            return [(float) $m[1], true];
        }
        return [0.0, false];
    }

    private static function toString(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        if (is_string($value)) {
            return $value;
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_float($value) && !is_finite($value)) {
            return is_nan($value) ? 'NaN' : ($value > 0 ? 'Infinity' : '-Infinity');
        }
        if (is_int($value) || is_float($value)) {
            // A number reads as the text ECMAScript writes for its double.
            return (string) CanonicalText::of($value);
        }
        return '';
    }
}
