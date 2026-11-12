<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

use Polyspec\Crudui\Validator\Support\JsonValue;

/**
 * The member rules that $ref, $patch and the composition orchestrator share: the layering of
 * the members of one node, the shallow merge and the plain-object test (SPEC §5).
 */
final class Members
{
    /** Sentinel for "no $patch seen" or "key absent" (distinct from a present null value). */
    public const UNDEFINED = "\0__compose_undefined__\0";

    /**
     * Layer the members of a node in declaration order: a $ref lays its resolved base over the
     * members declared before it, the members declared after it override that base, and a $patch
     * overlays the result.
     *
     * @param array<string, mixed>   $node
     * @param \Closure(mixed): array<string, mixed> $resolveRef resolves the value of a $ref
     * @return array<string, mixed>
     */
    public static function layer(array $node, \Closure $resolveRef): array
    {
        $base = [];
        $patch = self::UNDEFINED;
        $own = [];

        foreach ($node as $k => $v) {
            if ($k === '$ref') {
                // The ref lays down onto whatever was declared before it; later members override.
                $base = self::shallowMerge($own, $resolveRef($v));
                $own = [];
            } elseif ($k === '$patch') {
                $patch = $v;
            } else {
                $own[$k] = $v;
            }
        }

        $result = self::shallowMerge($base, $own);
        if ($patch !== self::UNDEFINED) {
            $result = Patch::apply($result, $patch);
        }
        return $result;
    }

    /**
     * Shallow merge { ...a, ...b }: b's keys override a's, b's new keys append. PHP array union
     * (+) keeps the left value on a clash, so this assigns b over a. Insertion order follows a's
     * order for shared keys, then b's new keys (the JS spread order).
     *
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     * @return array<string, mixed>
     */
    public static function shallowMerge(array $a, array $b): array
    {
        $out = $a;
        foreach ($b as $k => $v) {
            $out[$k] = $v;
        }
        return JsonValue::orderedMembers($out);
    }

    /** Objects are stdClass values or non-list PHP associative arrays. */
    public static function isPlainObject(mixed $v): bool
    {
        return $v instanceof \stdClass || (\is_array($v) && !\array_is_list($v));
    }

    /**
     * Apply `$change` to the members of a plain object and return the result in the shape of the
     * input: a stdClass stays a stdClass and an associative array stays an array.
     *
     * @param array<string, mixed>|\stdClass $object
     * @param \Closure(array<string, mixed>): array<string, mixed> $change
     * @return array<string, mixed>|\stdClass
     */
    public static function rebuild(array|\stdClass $object, \Closure $change): array|\stdClass
    {
        $changed = $change((array) $object);
        return $object instanceof \stdClass ? (object) $changed : $changed;
    }
}
