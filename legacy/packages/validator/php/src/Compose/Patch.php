<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

use Polyspec\Crudui\Validator\Support\JsonValue;

/**
 * $patch application — add / remove / replace over the $ref base (SPEC §5).
 * Byte-for-byte port of validator-ts/src/compose/patch.ts.
 *
 * $patch is an OBJECT of operations.
 * Two order-preserving input shapes are supported:
 *
 *   1. Deep-path set — "field.validate.required": ".other". The dotted key is
 *      split into path segments and the value is SET at that node (creating
 *      intermediate objects). SPEC §5 canonical form. The value replaces any
 *      scalar leaf; for object values it deep-merges (both objects → deep merge, else
 *      the latter wins).
 *
 *   2. Structured ops — explicit add / remove / replace keys:
 *        add:     { "path.to.new": value, … }   — deep-merge value at path
 *        replace: { "path.to.key": value, … }   — same merge rule (scalar override)
 *        remove:  [ "path.to.key", … ] | { … }  — deep delete
 *
 * Resolution order: base ($ref) first, then $patch overlays. add/replace
 * deep-merge; remove deep-deletes; deep-path set splits then applies. An
 * unresolved patch (op shape error, path conflict, strict-remove miss) is a LOAD
 * ERROR — never valid:true.
 */
final class Patch
{
    /**
     * Apply a $patch object to the (already $ref-expanded) base spec.
     *
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    public static function apply(array $base, mixed $patch): array
    {
        if (!Members::isPlainObject($patch)) {
            throw new ComposeLoadError(
                'PATCH_SHAPE',
                '$patch must be an object of operations, got ' . self::typeName($patch),
            );
        }
        /** @var array<string, mixed> $p */
        $p = $patch;
        $result = $base;

        // Apply entries in declaration order (CRUDUI properties preserve order).
        foreach ($p as $key => $val) {
            $key = (string) $key;
            if ($key === 'add' || $key === 'replace') {
                $result = self::applyAddReplace($result, $val, $key);
            } elseif ($key === 'remove') {
                $result = self::applyRemove($result, $val);
            } else {
                // Deep-path set (SPEC §5 canonical form): "a.b.c": value.
                $result = self::setDeepPath($result, self::splitPath($key), $val);
            }
        }
        return JsonValue::orderedMembers($result);
    }

    /**
     * Structured add/replace: a map of deep-path → value, deep-merged at each path.
     *
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    private static function applyAddReplace(array $base, mixed $val, string $op): array
    {
        if (!Members::isPlainObject($val)) {
            throw new ComposeLoadError(
                'PATCH_SHAPE',
                '$patch.' . $op . ' must be an object of deep-path → value',
            );
        }
        $result = $base;
        /** @var array<string, mixed> $val */
        foreach ($val as $path => $value) {
            $result = self::setDeepPath($result, self::splitPath((string) $path), $value);
        }
        return $result;
    }

    /**
     * Structured remove: an array of deep-paths, or a nested {k:{sub:…}} map.
     *
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    private static function applyRemove(array $base, mixed $val): array
    {
        if (\is_array($val) && \array_is_list($val)) {
            $result = $base;
            foreach ($val as $path) {
                if (!\is_string($path)) {
                    throw new ComposeLoadError(
                        'PATCH_SHAPE',
                        '$patch.remove array entries must be strings',
                    );
                }
                $result = self::removeDeepPath($result, self::splitPath($path));
            }
            return $result;
        }
        if (Members::isPlainObject($val)) {
            // Nested map form: recurse where both sides are objects.
            /** @var array<string, mixed> $val */
            return self::removeNested($base, (array) $val);
        }
        throw new ComposeLoadError(
            'PATCH_SHAPE',
            '$patch.remove must be an array of paths or a nested object',
        );
    }

    /**
     * Split a dotted deep-path into segments. Empty path is a shape error.
     *
     * @return list<string>
     */
    private static function splitPath(string $path): array
    {
        if ($path === '') {
            throw new ComposeLoadError('PATCH_SHAPE', '$patch path must be non-empty');
        }
        return \explode('.', $path);
    }

    /**
     * Set a value at a deep path, creating intermediate objects. When both the
     * existing leaf and the new value are plain objects, DEEP-MERGE;
     * otherwise the new value REPLACES. Returns a new tree
     * (PHP arrays are value types, so the input is never mutated).
     *
     * @param array<string, mixed> $node the tree that receives the value
     * @param list<string>         $segments the path from the root of the tree to the leaf, one key per segment
     * @param mixed                $value the value written at the leaf
     * @return array<string, mixed> the tree with the value set
     */
    private static function setDeepPath(array $node, array $segments, mixed $value): array
    {
        $head = $segments[0];
        $rest = \array_slice($segments, 1);
        $out = $node;

        if (\count($rest) === 0) {
            $existing = \array_key_exists($head, $out) ? $out[$head] : null;
            $out[$head] = self::mergeValue(
                \array_key_exists($head, $out) ? $existing : Members::UNDEFINED,
                $value,
            );
            return $out;
        }

        if (!\array_key_exists($head, $out)) {
            $out[$head] = (object) self::setDeepPath([], $rest, $value);
        } elseif (Members::isPlainObject($out[$head])) {
            /** @var array<string, mixed> $child */
            $child = $out[$head];
            $out[$head] = Members::rebuild(
                $child,
                fn (array $members): array => self::setDeepPath($members, $rest, $value),
            );
        } else {
            // Intermediate node is a scalar/array — cannot descend into it.
            throw new ComposeLoadError(
                'PATCH_PATH_CONFLICT',
                "\$patch cannot descend into non-object at '" . $head . "'",
            );
        }
        return $out;
    }

    /**
     * Deep-merge leaf rule: both plain objects
     * → recursive deep merge; otherwise the latter value wins (scalar/array
     * override). Mirrors JS mergeValue; an UNDEFINED existing means "no prior
     * leaf" (JS existing === undefined), so the incoming value is taken as-is.
     */
    private static function mergeValue(mixed $existing, mixed $incoming): mixed
    {
        if (
            $existing !== Members::UNDEFINED
            && Members::isPlainObject($existing)
            && Members::isPlainObject($incoming)
        ) {
            /** @var array<string, mixed> $existing */
            /** @var array<string, mixed> $incoming */
            $out = (array) $existing;
            foreach ($incoming as $k => $v) {
                $prior = \array_key_exists($k, $out) ? $out[$k] : Members::UNDEFINED;
                $out[$k] = self::mergeValue($prior, $v);
            }
            return $existing instanceof \stdClass || $incoming instanceof \stdClass ? (object) $out : $out;
        }
        return $incoming;
    }

    /**
     * Delete a value at a deep path. Strict: a missing target is a load error.
     *
     * @param array<string, mixed> $node the tree that holds the value
     * @param list<string>         $segments the path from the root of the tree to the deleted member
     * @return array<string, mixed> the tree without the member
     * @throws ComposeLoadError when a segment is missing or descends into a value that is not an object
     */
    private static function removeDeepPath(array $node, array $segments): array
    {
        $head = $segments[0];
        $rest = \array_slice($segments, 1);

        if (!\array_key_exists($head, $node)) {
            throw new ComposeLoadError(
                'PATCH_REMOVE_TARGET_MISSING',
                "\$patch remove target not found: '" . \implode('.', $segments) . "'",
            );
        }
        $out = $node;
        if (\count($rest) === 0) {
            unset($out[$head]);
            return $out;
        }
        if (!Members::isPlainObject($out[$head])) {
            throw new ComposeLoadError(
                'PATCH_REMOVE_TARGET_MISSING',
                "\$patch remove cannot descend into non-object at '" . $head . "'",
            );
        }
        /** @var array<string, mixed> $child */
        $child = $out[$head];
        $out[$head] = Members::rebuild(
            $child,
            fn (array $members): array => self::removeDeepPath($members, $rest),
        );
        return $out;
    }

    /**
     * Nested-map remove: for each key, recurse when both the
     * target and the removal spec are objects, else unset the key. A missing key
     * is tolerated here (silently skipped), unlike the array form.
     *
     * @param array<string, mixed> $base
     * @param array<string, mixed> $spec
     * @return array<string, mixed>
     */
    private static function removeNested(array $base, array $spec): array
    {
        $out = $base;
        foreach ($spec as $key => $sub) {
            $hasKey = \array_key_exists($key, $out);
            $target = $hasKey ? $out[$key] : null;
            if (
                $hasKey
                && Members::isPlainObject($target)
                && Members::isPlainObject($sub)
            ) {
                /** @var array<string, mixed> $target */
                /** @var array<string, mixed> $sub */
                $out[$key] = Members::rebuild(
                    $target,
                    fn (array $members): array => self::removeNested($members, (array) $sub),
                );
            } else {
                unset($out[$key]);
            }
        }
        return $out;
    }

    /** JS-style type name for $patch shape error messages. */
    private static function typeName(mixed $v): string
    {
        return match (true) {
            $v === null => 'null',
            \is_array($v) => \array_is_list($v) && $v !== [] ? 'array' : 'object',
            default => \gettype($v),
        };
    }
}
