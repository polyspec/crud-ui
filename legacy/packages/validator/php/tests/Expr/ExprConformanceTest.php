<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Expr;

use Polyspec\Crudui\Validator\Expr\ConditionMap;
use Polyspec\Crudui\Validator\Expr\Evaluator;
use Polyspec\Crudui\Validator\Expr\Expression;
use Polyspec\Crudui\Validator\Expr\Node;
use Polyspec\Crudui\Validator\Expr\ParseError;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Polyspec\Crudui\Conformance\Evidence;

/**
 * CRUDUI expression-engine conformance (expressions.md §9 three-stage check):
 *   (1) lexer(expr)  == fixture tokens
 *   (2) parser(toks) == fixture ast
 *   (3) evaluate / evaluateValue == fixture truthy / value
 *
 * The shared fixture legacy/tests/fixtures/expr/cases.json defines the expected tokens,
 * syntax tree and evaluation result for every runtime.
 */
final class ExprConformanceTest extends TestCase
{
    private const SHARED_FIXTURE = __DIR__ . '/../../../../../tests/fixtures/expr/cases.json';

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function fixtureProvider(): array
    {
        $path = realpath(self::SHARED_FIXTURE);
        self::assertNotFalse($path, 'shared expr fixture not found: ' . self::SHARED_FIXTURE);
        $raw = file_get_contents($path);
        self::assertNotFalse($raw);
        /** @var list<array<string, mixed>> $specs */
        $specs = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        $out = [];
        foreach ($specs as $spec) {
            $out[$spec['name']] = [$spec];
        }
        return $out;
    }

    /**
     * Run the three stages of one fixture entry and record one result for it.
     *
     * @param array<string, mixed> $spec
     */
    #[DataProvider('fixtureProvider')]
    public function testExpressionMatchesFixture(array $spec): void
    {
        $passed = false;
        try {
            if (isset($spec['error'])) {
                $this->assertRejection($spec);
                $passed = true;
                return;
            }
            $this->assertLexer($spec);
            $this->assertParser($spec);
            $this->assertEvaluation($spec);
            $passed = true;
        } finally {
            Evidence::record('validate', 'legacy/tests/fixtures/expr/cases.json', 'php', $spec['name'], $passed);
        }
    }

    /** @param array<string, mixed> $spec */
    private function assertRejection(array $spec): void
    {
        try {
            Expression::parse($spec['expr']);
        } catch (ParseError $error) {
            $this->assertSame($spec['error'], $error->getMessage(), "error mismatch for {$spec['name']}");
            return;
        }
        $this->fail("{$spec['name']} parsed; want error {$spec['error']}");
    }

    /** @param array<string, mixed> $spec */
    private function assertLexer(array $spec): void
    {
        $tokens = array_map(
            static fn ($t): array => $t->toArray(),
            Expression::tokenize($spec['expr']),
        );

        $this->assertSame(
            self::normalize($spec['tokens']),
            self::normalize($tokens),
            "tokens mismatch for: {$spec['expr']}",
        );
    }

    /** @param array<string, mixed> $spec */
    private function assertParser(array $spec): void
    {
        $ast = Expression::parse($spec['expr'])->toArray();

        $this->assertSame(
            self::normalize($spec['ast']),
            self::normalize($ast),
            "AST mismatch for: {$spec['expr']}",
        );
    }

    /** @param array<string, mixed> $spec */
    private function assertEvaluation(array $spec): void
    {
        foreach ($spec['cases'] as $i => $case) {
            $data = $case['data'];
            $currentPath = $case['currentPath'] ?? [];
            $rowKeys = $case['rowKeys'] ?? [];

            $value = Expression::evaluateValue($spec['expr'], $data, $currentPath, $rowKeys);
            $this->assertTrue(
                self::valueEquals($case['value'], $value),
                "value mismatch [{$spec['expr']}] case {$i}: expected "
                    . json_encode($case['value']) . ' got ' . json_encode($value),
            );

            $truthy = Expression::evaluate($spec['expr'], $data, $currentPath, $rowKeys);
            $this->assertSame(
                $case['truthy'],
                $truthy,
                "truthy mismatch [{$spec['expr']}] case {$i}",
            );
        }
    }

    // --- targeted unit checks beyond the shared fixture --------------------

    /**
     * Condition map (§8): first truthy key in declaration order wins; on a miss
     * the literal `true` key's value is used, else null. The default key never
     * short-circuits an earlier real condition even when it appears first.
     */
    public function testConditionMap(): void
    {
        $map = [
            ".tier == 'gold'"   => 'premium',
            ".tier == 'silver'" => 'standard',
            'true'              => 'basic',
        ];

        $this->assertSame('premium', ConditionMap::resolve($map, ['tier' => 'gold', 'x' => 1], ['x']));
        $this->assertSame('standard', ConditionMap::resolve($map, ['tier' => 'silver', 'x' => 1], ['x']));
        $this->assertSame('basic', ConditionMap::resolve($map, ['tier' => 'bronze', 'x' => 1], ['x']));

        // No default key, no match -> null.
        $noDefault = [".a == 1" => 'one'];
        $this->assertNull(ConditionMap::resolve($noDefault, ['a' => 9, 'x' => 1], ['x']));
    }

    /**
     * Default key declared first must not pre-empt a later matching condition.
     */
    public function testConditionMapDefaultDoesNotShortCircuit(): void
    {
        $map = [
            'true'            => 'fallback',
            ".tier == 'gold'" => 'premium',
        ];
        $this->assertSame('premium', ConditionMap::resolve($map, ['tier' => 'gold', 'x' => 1], ['x']));
        $this->assertSame('fallback', ConditionMap::resolve($map, ['tier' => 'none', 'x' => 1], ['x']));
    }

    /**
     * JS-parity value semantics (the shared fixture is generated from JS): == /
     * != use loose equality (numeric strings coerce), > >= < <= coerce both
     * sides to number, and evaluateValue() returns the boolean condition result
     * for non-ternary nodes (not a raw resolved path value).
     */
    public function testValueSemanticsMatchJsReference(): void
    {
        // Numeric-string coercion in loose equality and comparison.
        $this->assertTrue(Expression::evaluate('.n == 5', ['n' => '5', 'x' => 1], ['x']));
        $this->assertTrue(Expression::evaluate('.score < 50', ['score' => '30', 'x' => 1], ['x']));

        // Non-ternary evaluateValue returns the boolean, mirroring truthy.
        $this->assertTrue(Expression::evaluateValue('.v', ['v' => 'hi', 'x' => 1], ['x']));
        $this->assertFalse(Expression::evaluateValue('.v', ['v' => 0, 'x' => 1], ['x']));

        // Standalone boolean literal evaluates to its boolean.
        $this->assertTrue(Expression::evaluateValue('true', [], []));
        $this->assertFalse(Expression::evaluateValue('false', [], []));
    }

    /**
     * Ternary returns the branch's RAW value (string/number/null), recursively
     * for nested right-associative ternaries. Non-ternary branches return their
     * boolean (JS resolveTernaryBranchValue parity).
     */
    public function testTernaryValueReturn(): void
    {
        $this->assertSame(
            'huge',
            Expression::evaluateValue(".big ? 'huge' : 'tiny'", ['big' => true, 'x' => 1], ['x'])
        );
        $this->assertSame(
            'tiny',
            Expression::evaluateValue(".big ? 'huge' : 'tiny'", ['big' => false, 'x' => 1], ['x'])
        );
        $this->assertSame(
            'B',
            Expression::evaluateValue(".a ? 'A' : .b ? 'B' : 'C'", ['a' => false, 'b' => true, 'x' => 1], ['x'])
        );
        $this->assertSame(0, Expression::evaluateValue('.active ? 1 : 0', ['active' => false, 'x' => 1], ['x']));
        $this->assertNull(Expression::evaluateValue('.show == 1 ? 1 : null', ['show' => 0, 'x' => 1], ['x']));
    }

    // --- helpers ----------------------------------------------------------

    /**
     * Recursively normalize for comparison: ksort associative arrays (key order
     * is not part of the contract — JS uses insertion order, Go alphabetical),
     * preserve list order, and canonicalize numbers so 0 and 0.0 match.
     */
    private static function normalize(mixed $v): mixed
    {
        if (is_array($v)) {
            if (array_is_list($v)) {
                return array_map([self::class, 'normalize'], $v);
            }
            $copy = $v;
            ksort($copy);
            return array_map([self::class, 'normalize'], $copy);
        }
        if (is_int($v) || is_float($v)) {
            // 1 and 1.0 are the same literal across languages; compare as float.
            return (float) $v;
        }
        return $v;
    }

    /**
     * Value equality tolerant of int/float spelling (JSON loses the int/float
     * distinction; the engine may return either for a numeric literal).
     */
    private static function valueEquals(mixed $expected, mixed $actual): bool
    {
        if ((is_int($expected) || is_float($expected)) && (is_int($actual) || is_float($actual))) {
            return (float) $expected === (float) $actual;
        }
        return $expected === $actual;
    }
}
