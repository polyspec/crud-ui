<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Expr;

use Polyspec\Crudui\Validator\Expr\Visibility;
use PHPUnit\Framework\TestCase;

/**
 * `design.show` resolution shared by the validator and the form
 * (docs/spec/validation-rules.md, "Evaluation").
 */
final class VisibilityTest extends TestCase
{
    public function testResolution(): void
    {
        $data = (object) ['on' => 1, 'rows' => (object) ['r1' => (object) ['kind' => 'a']]];
        self::assertTrue(Visibility::shown(null, $data, ['x']));
        self::assertFalse(Visibility::shown(false, $data, ['x']));
        self::assertTrue(Visibility::shown('.on', $data, ['x']));
        self::assertFalse(Visibility::shown('.on == 2', $data, ['x']));
        self::assertTrue(Visibility::shown(".kind == 'a'", $data, ['rows', 'r1', 'note']));
        self::assertTrue(
            Visibility::shown('.on ==', $data, ['x']),
            'a string that is not a valid expression is a literal'
        );
        self::assertTrue(
            Visibility::shown('.mode == (', $data, ['x']),
            'a string that is not a valid expression is a literal'
        );
        self::assertTrue(
            Visibility::shown((object) ['.on == 2' => false], $data, ['x']),
            'a map that selects nothing leaves the field visible'
        );
        self::assertTrue(Visibility::shown((object) ['.on == 2' => false, 'true' => true], $data, ['x']));
        self::assertFalse(Visibility::shown((object) ['.on == 2' => true, 'true' => false], $data, ['x']));
        self::assertFalse(Visibility::shown(['.on' => false, 'true' => true], ['on' => 1], ['x']));
        self::assertTrue(Visibility::shown(['.on' => 0], ['on' => 1], ['x']), 'only false hides');
        self::assertTrue(Visibility::shown((object) ['.on ==' => false], $data, ['x']));
        self::assertFalse(Visibility::shown('.on == 1 ? false : true', $data, ['x']));
        self::assertTrue(Visibility::shown('.on == 1 ? 0 : false', $data, ['x']));
        self::assertTrue(Visibility::shown('.on ? ', $data, ['x']), 'an incomplete ternary is a literal');
        self::assertTrue(Visibility::shown('visible', $data, ['x']), 'another string is a literal');
        self::assertTrue(Visibility::shown(0, $data, ['x']));
    }

    public function testDeclaredValue(): void
    {
        self::assertNull(Visibility::declared(['type' => 'text']));
        self::assertNull(Visibility::declared(['design' => 'x']));
        self::assertFalse(Visibility::declared(['design' => (object) ['show' => false]]));
        self::assertSame('.a', Visibility::declared((object) ['design' => ['show' => '.a']]));
    }
}
