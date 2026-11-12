<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Public facade for the CRUDUI expression engine: string → tokens → AST → value.
 *
 * The pipeline is strictly staged (GRAMMAR §0): never split a string to evaluate,
 * never eval. parse() caches one AST per expression string, at most CACHE_CAPACITY of them with the
 * least recently used evicted first, as in the TypeScript and Go validators. evaluate() returns a
 * boolean condition result; evaluateValue() returns a ternary's branch value and
 * the boolean condition result for everything else (JS evaluateExpressionValue
 * parity — the shared 4-language fixture is generated from the JS engine).
 */
final class Expression
{
    /** The most parsed expressions kept at once. */
    public const CACHE_CAPACITY = 1000;

    /** @var array<string, Node> parsed-AST cache keyed by expression text, least recently used first */
    private static array $cache = [];

    /**
     * Tokenize an expression. WHITESPACE excluded; ends with EOF.
     *
     * @return list<Token>
     */
    public static function tokenize(string $expression): array
    {
        return (new Lexer($expression))->tokenize();
    }

    /**
     * Parse an expression into its AST (cached).
     */
    public static function parse(string $expression): Node
    {
        if (isset(self::$cache[$expression])) {
            // Move the expression to the most recently used end.
            $ast = self::$cache[$expression];
            unset(self::$cache[$expression]);
            return self::$cache[$expression] = $ast;
        }

        $tokens = self::tokenize($expression);
        $ast = (new Parser($tokens))->parse();
        if (\count(self::$cache) >= self::CACHE_CAPACITY) {
            unset(self::$cache[\array_key_first(self::$cache)]);
        }

        return self::$cache[$expression] = $ast;
    }

    /**
     * Evaluate to a truthy boolean (show/display call site): the result of the expression read as a condition,
     * which `evaluateValue` returns as it is.
     *
     * @param array<string, mixed>|\stdClass $formData the form data that the paths of the expression read
     * @param list<string>                   $currentPath the path of the field that carries the expression
     * @param list<int>                      $rowKeys positions of the row keys in $currentPath
     */
    public static function evaluate(
        string $expression,
        array|\stdClass $formData,
        array $currentPath = [],
        array $rowKeys = []
    ): bool {
        return (new Evaluator($formData, $currentPath, $rowKeys))->evaluate(self::parse($expression));
    }

    /**
     * Evaluate to the raw value (class/style/number/null call site): the value the expression selects, such as the
     * class of a ternary or the number of a path, where `evaluate` returns only its truth.
     *
     * @param array<string, mixed>|\stdClass $formData the form data that the paths of the expression read
     * @param list<string>                   $currentPath the path of the field that carries the expression
     * @param list<int>                      $rowKeys positions of the row keys in $currentPath
     */
    public static function evaluateValue(
        string $expression,
        array|\stdClass $formData,
        array $currentPath = [],
        array $rowKeys = []
    ): mixed {
        return (new Evaluator($formData, $currentPath, $rowKeys))->evaluateValue(self::parse($expression));
    }

    /** Recognize expression strings used by validation and form appearance. */
    public static function isConditionExpression(string $value): bool
    {
        $value = trim($value);
        return $value !== '' && (
            str_starts_with($value, '.')
            || preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*\\./', $value) === 1
            || preg_match('/\\s+(==|!=|>|>=|<|<=|&&|\\|\\||in|not\\s+in)\\s+/', $value) === 1
            || preg_match('/\\?.*:/', $value) === 1
        );
    }

    /**
     * Clear the parsed-AST cache.
     */
    public static function clearCache(): void
    {
        self::$cache = [];
    }
}
