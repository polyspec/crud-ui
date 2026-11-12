<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Compose;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Compose\Patch;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for the $patch deep-merge / deep-remove semantics. Port of
 * validator-ts/src/compose/patch.test.ts.
 *
 * cases.json (the shared 4-language fixture) covers the SPEC §5 surface; these
 * tests pin the merge/remove RULES the fixture does not separately isolate:
 *   - both-object leaf → recursive deep-merge
 *   - scalar leaf → replace (latter wins)
 *   - array leaf → replace (NOT concat; the latter array wins)
 *   - nested-map remove form (missing key tolerated)
 *   - structured-remove array form (strict: missing target throws)
 */
final class PatchTest extends TestCase
{
    // --- $patch deep-path set — deep-merge rule ---------------------------------

    public function testBothObjectLeafDeepMerges(): void
    {
        $base = ['a' => ['x' => ['p' => 1, 'q' => 2]]];
        $out = Patch::apply($base, ['a.x' => ['q' => 20, 'r' => 30]]);
        $this->assertSame(['a' => ['x' => ['p' => 1, 'q' => 20, 'r' => 30]]], $out);
    }

    public function testScalarLeafReplaces(): void
    {
        $base = ['a' => ['class' => 'old']];
        $out = Patch::apply($base, ['a.class' => 'new']);
        $this->assertSame(['a' => ['class' => 'new']], $out);
    }

    public function testObjectValueOverScalarLeafReplacesWholesale(): void
    {
        $base = ['a' => ['v' => 'scalar']];
        $out = Patch::apply($base, ['a.v' => ['nested' => true]]);
        $this->assertSame(['a' => ['v' => ['nested' => true]]], $out);
    }

    public function testArrayLeafReplacesNotConcatenated(): void
    {
        $base = ['a' => ['list' => [1, 2, 3]]];
        $out = Patch::apply($base, ['a.list' => [9]]);
        $this->assertSame(['a' => ['list' => [9]]], $out);
    }

    public function testCreatesIntermediateObjectsForMissingDeepPath(): void
    {
        $base = ['a' => new \stdClass()];
        $out = Patch::apply($base, ['a.b.c' => 1]);
        $this->assertInstanceOf(\stdClass::class, $out['a']);
        $this->assertInstanceOf(\stdClass::class, $out['a']->b);
        $this->assertSame(1, $out['a']->b->c);
    }

    public function testCreatedIntermediateObjectRemainsAnObjectAfterItsLastMemberIsRemoved(): void
    {
        $out = Patch::apply([], json_decode('{"default.x":1,"remove":["default.x"]}'));
        $this->assertInstanceOf(\stdClass::class, $out['default']);
        $this->assertSame('{"default":{}}', json_encode($out));
    }

    public function testDoesNotMutateInputBase(): void
    {
        $base = ['a' => ['x' => 1]];
        $snapshot = \json_encode($base);
        Patch::apply($base, ['a.y' => 2]);
        $this->assertSame($snapshot, \json_encode($base));
    }

    // --- $patch add / replace — deep-merge at path ------------------------

    public function testAddDeepMergesNewSubkey(): void
    {
        $base = ['a' => ['type' => 'text']];
        $out = Patch::apply($base, ['add' => ['a.label' => 'A']]);
        $this->assertSame(['a' => ['type' => 'text', 'label' => 'A']], $out);
    }

    public function testReplaceOverridesScalarViaDeepMerge(): void
    {
        $base = ['a' => ['design' => ['class' => 'x', 'show' => '.s']]];
        $out = Patch::apply($base, ['replace' => ['a.design.class' => 'y']]);
        $this->assertSame(['a' => ['design' => ['class' => 'y', 'show' => '.s']]], $out);
    }

    // --- $patch remove — array (strict) vs nested-map (tolerant) ----------

    public function testArrayPathRemoveDeletesDeepSubkeyKeepsSiblings(): void
    {
        $base = ['f' => ['options' => ['max_tags' => 5, 'min' => 2]]];
        $out = Patch::apply($base, ['remove' => ['f.options.max_tags']]);
        $this->assertSame(['f' => ['options' => ['min' => 2]]], $out);
    }

    public function testArrayPathRemoveOfMissingTargetIsLoadError(): void
    {
        $base = ['a' => ['type' => 'text']];
        try {
            Patch::apply($base, ['remove' => ['a.ghost']]);
            $this->fail('expected ComposeLoadError');
        } catch (ComposeLoadError $e) {
            $this->assertSame('PATCH_REMOVE_TARGET_MISSING', $e->code);
        }
    }

    public function testNestedMapRemoveRecursesWhereBothObjects(): void
    {
        $base = ['f' => ['options' => ['max_tags' => 5, 'min' => 2]]];
        $out = Patch::apply($base, ['remove' => ['f' => ['options' => ['max_tags' => true]]]]);
        $this->assertSame(['f' => ['options' => ['min' => 2]]], $out);
    }

    public function testNestedMapRemoveToleratesMissingKey(): void
    {
        $base = ['a' => ['type' => 'text']];
        $out = Patch::apply($base, ['remove' => ['ghost' => ['sub' => true]]]);
        $this->assertSame(['a' => ['type' => 'text']], $out);
    }

    public function testNestedMapRemoveWithScalarSpecDeletesWholeKey(): void
    {
        $base = ['a' => ['type' => 'text'], 'b' => ['type' => 'num']];
        $out = Patch::apply($base, ['remove' => ['b' => true]]);
        $this->assertSame(['a' => ['type' => 'text']], $out);
    }

    // --- $patch shape errors are load errors ------------------------------

    public function testNonObjectPatchThrowsPatchShape(): void
    {
        try {
            Patch::apply([], 'nope');
            $this->fail('expected ComposeLoadError');
        } catch (ComposeLoadError $e) {
            $this->assertSame('PATCH_SHAPE', $e->code);
        }
    }

    public function testAddWithNonObjectValueThrowsPatchShape(): void
    {
        try {
            Patch::apply([], ['add' => 'x']);
            $this->fail('expected ComposeLoadError');
        } catch (ComposeLoadError $e) {
            $this->assertSame('PATCH_SHAPE', $e->code);
        }
    }

    public function testDescendIntoScalarIntermediateThrowsPathConflict(): void
    {
        try {
            Patch::apply(['a' => 'scalar'], ['a.b' => 1]);
            $this->fail('expected ComposeLoadError');
        } catch (ComposeLoadError $e) {
            $this->assertSame('PATCH_PATH_CONFLICT', $e->code);
        }
    }
}
