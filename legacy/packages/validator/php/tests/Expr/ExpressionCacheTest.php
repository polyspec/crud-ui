<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Expr;

use Polyspec\Crudui\Validator\Expr\Expression;
use PHPUnit\Framework\TestCase;

/**
 * The parsed-expression cache holds at most 1,000 entries, as in the TypeScript and Go
 * validators: a long-running worker that parses many distinct expressions keeps bounded memory,
 * and the least recently used expression is evicted first.
 */
final class ExpressionCacheTest extends TestCase
{
    public function testTheCacheIsBoundedAndEvictsTheLeastRecentlyUsedExpression(): void
    {
        Expression::clearCache();
        $cache = new \ReflectionProperty(Expression::class, 'cache');
        Expression::parse('.kept == 1');
        for ($i = 0; $i < 5000; $i++) {
            Expression::parse(".field{$i} == {$i}");
            if ($i % 500 === 0) {
                Expression::parse('.kept == 1');
            }
            self::assertLessThanOrEqual(1000, \count($cache->getValue()));
        }
        self::assertCount(1000, $cache->getValue());
        self::assertArrayHasKey('.kept == 1', $cache->getValue(), 'a recently used expression stays');
        self::assertArrayNotHasKey('.field0 == 0', $cache->getValue(), 'the least recently used expression is evicted');
        Expression::clearCache();
    }
}
