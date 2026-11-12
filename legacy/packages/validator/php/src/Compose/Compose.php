<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

/**
 * Composition orchestrator (SPEC §5, G5) — the parser's FIRST pass.
 * Byte-for-byte port of validator-ts/src/compose/compose.ts.
 *
 * Resolution order (SPEC §5, verbatim):
 *   (1) $ref   — expand file/path base, recursively (nested $ref included) into a
 *                single properties base.
 *   (2) $patch — overlay add/remove/replace and deep-path set on that base.
 *   (3) the result is the equivalent SINGLE SPEC (composition keys eliminated).
 *   (4) the field layer (validate/design/behavior/options) then applies to it.
 *
 * G5 (SPEC §2): the parser expands composition first, producing a single spec,
 * BEFORE applying the field layer — without composition a $ref-using spec cannot
 * even be loaded. So composition is a pre-processing pass that runs BEFORE
 * validation/render, not a validation step.
 *
 * Composition priority: $ref = base (first),
 * $patch = overlay (later) — base is laid down, patch overrides.
 *
 * composeProperties is the entry point: it operates on a properties map (the
 * composition entry point, SPEC §2) where $ref/$patch may sit alongside named
 * child fields. composeSpec recurses the whole field tree so a $ref nested inside
 * any child properties is expanded too. Both throw a ComposeLoadError for any
 * unresolved composition (never valid:true).
 */
final class Compose
{
    /**
     * Compose a properties map: expand $ref to a base, overlay $patch, return the
     * single (composition-free) properties map. Named sibling keys follow
     * declaration order — a key declared after $ref overrides the base; a key
     * declared before it is overridden by the base.
     *
     * @param array<string, mixed> $properties
     * @return array<string, mixed>
     */
    public static function properties(
        array $properties,
        FileLoader $loader,
        string $basepath = '',
    ): array {
        $result = Members::layer($properties, static fn (mixed $ref): array => Ref::resolve($ref, $basepath, $loader));

        // Recurse into every child field's properties (the tree may compose deeper).
        foreach ($result as $fieldName => $field) {
            if (Members::isPlainObject($field)) {
                /** @var array<string, mixed> $field */
                $composed = self::spec((array) $field, $loader, $basepath);
                $result[$fieldName] = $field instanceof \stdClass ? (object) $composed : $composed;
            }
        }

        return $result;
    }

    /**
     * Compose a full field spec: expand a field-level $ref/$patch, then recurse
     * into its properties (which may itself compose). Returns the single spec.
     *
     * @param array<string, mixed> $spec
     * @return array<string, mixed>
     */
    public static function spec(
        array $spec,
        FileLoader $loader,
        string $basepath = '',
    ): array {
        // Field-level $ref / $patch (a field may inherit a whole base spec).
        if (\array_key_exists('$ref', $spec) || \array_key_exists('$patch', $spec)) {
            $resolved = Members::layer($spec, static fn (mixed $ref): array => Ref::resolve($ref, $basepath, $loader));
        } else {
            $resolved = $spec;
        }

        // Recurse into properties (composition entry point, SPEC §2).
        if (\array_key_exists('properties', $resolved) && Members::isPlainObject($resolved['properties'])) {
            /** @var array<string, mixed> $props */
            $props = $resolved['properties'];
            $composed = self::properties((array) $props, $loader, $basepath);
            $resolved['properties'] = $props instanceof \stdClass ? (object) $composed : $composed;
        }

        return $resolved;
    }
}
