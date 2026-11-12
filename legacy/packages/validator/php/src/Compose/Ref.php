<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

use Polyspec\Crudui\Validator\Support\JsonValue;

/**
 * $ref resolution expands base inheritance before other composition (SPEC §5).
 *
 * Resolution supports these input forms:
 *   (1) value = a single string OR a list of strings — a list resolves each path
 *       in order, then array_merge (later overrides earlier on key clash).
 *   (2) plain path 'options.yml' → load YAML, descend by the default
 *       detectKey ['properties'] (= take the file's properties only).
 *   (3) path-specified '(file.yml).a.b' → regex split, detectKeys = ['a','b',
 *       'properties'] — descend a.b, then descend to properties underneath.
 *   (4) relative paths get the basepath '/' prefix; absolute (/-leading) pass
 *       through (handled by the FileLoader).
 *   (5) the result is recursively processed — nested $ref is expanded.
 *
 * CRUDUI normalization: $ref is the properties-layer composition entry point. The
 * resolved result is flattened to a single properties map and laid down as the
 * base; $patch overlays it (base first, patch overrides). Unresolved $ref
 * (missing file / bad format / absent detectKey / cycle) is a LOAD ERROR — never
 * valid:true.
 */
final class Ref
{
    /** The regex that splits '(path).keys' — the path-specified reference form. */
    private const PATH_SPEC_RE = '/^\((?<path>.*?)\)\.(?<keys>.*)$/s';

    /**
     * Resolve a $ref value (string or list of strings) to a single flattened
     * properties map. Each entry is resolved in declaration order and merged
     * (later overrides earlier). Nested $ref inside a resolved doc is expanded
     * recursively. The $visiting set (canonical file keys on the current chain)
     * detects cycles.
     *
     * @param array<string, bool> $visiting
     * @return array<string, mixed>
     */
    public static function resolve(
        mixed $value,
        string $basepath,
        FileLoader $loader,
        array $visiting = [],
    ): array {
        $paths = self::normalizeValue($value);

        $merged = [];
        foreach ($paths as $path) {
            $resolved = self::resolveSingle($path, $basepath, $loader, $visiting);
            // array_merge: later keys override earlier.
            $merged = Members::shallowMerge($merged, $resolved);
        }
        return $merged;
    }

    /**
     * Normalize the $ref value into a list of path strings (scalar → [scalar]).
     *
     * @return list<string>
     */
    private static function normalizeValue(mixed $value): array
    {
        if (\is_string($value)) {
            return [$value];
        }
        if (\is_array($value) && \array_is_list($value)) {
            foreach ($value as $p) {
                if (!\is_string($p)) {
                    throw new ComposeLoadError(
                        'REF_VALUE_TYPE',
                        '$ref array entries must be strings, got ' . self::typeName($p),
                    );
                }
            }
            /** @var list<string> $value */
            return $value;
        }
        throw new ComposeLoadError(
            'REF_VALUE_TYPE',
            '$ref must be a string or an array of strings, got ' . self::typeName($value),
        );
    }

    /**
     * Resolve one $ref path entry, descending detectKeys and expanding nested refs.
     *
     * @param array<string, bool> $visiting
     * @return array<string, mixed>
     */
    private static function resolveSingle(
        string $rawPath,
        string $basepath,
        FileLoader $loader,
        array $visiting,
    ): array {
        $orgPath = $rawPath;
        $path = $rawPath;
        $detectKeys = ['properties'];

        // Path-specified form '(file.yml).a.b' (leading '(').
        if (\str_starts_with($path, '(')) {
            if (\preg_match(self::PATH_SPEC_RE, $path, $m) !== 1) {
                throw new ComposeLoadError('REF_FORMAT_ERROR', $orgPath . ' ref error');
            }
            $path = $m['path'];
            $keys = $m['keys'];
            // detectKeys = explode('.', keys) ++ ['properties'].
            $detectKeys = [...\explode('.', $keys), 'properties'];
        }

        // Empty path is a format error.
        if ($path === '') {
            throw new ComposeLoadError('REF_FORMAT_ERROR', $orgPath . ' ref error');
        }

        $key = $loader->normalize($path, $basepath);

        // Cycle detection: this file key already on the current resolution chain
        // (a cycle must be detected — SPEC §7).
        if (isset($visiting[$key])) {
            $chain = [...\array_keys($visiting), $key];
            throw new ComposeLoadError(
                'REF_CYCLE',
                '$ref cycle detected: ' . \implode(' -> ', $chain),
                $chain,
            );
        }

        // throws REF_FILE_NOT_FOUND if absent; a loaded document uses specification member order.
        $doc = JsonValue::orderedMembers($loader->load($key));

        // Descend detectKeys.
        $node = $doc;
        foreach ($detectKeys as $detectKey) {
            if (Members::isPlainObject($node) && \array_key_exists($detectKey, (array) $node)) {
                /** @var array<string, mixed> $node */
                $node = ((array) $node)[$detectKey];
            } else {
                $chain = [...\array_keys($visiting), $key];
                throw new ComposeLoadError(
                    'REF_DETECT_KEY_NOT_FOUND',
                    $detectKey . ' not found in ' . $orgPath,
                    $chain,
                );
            }
        }

        if (!Members::isPlainObject($node)) {
            // A properties layer must be a map. A scalar/array here is malformed.
            $chain = [...\array_keys($visiting), $key];
            throw new ComposeLoadError(
                'REF_DETECT_KEY_NOT_FOUND',
                $orgPath . ' resolved to a non-object properties layer',
                $chain,
            );
        }

        // Recursively expand nested $ref inside the resolved properties map. Add
        // this file key to the visiting chain so a deeper $ref back to it is a cycle.
        $nextVisiting = $visiting;
        $nextVisiting[$key] = true;
        /** @var array<string, mixed> $node */
        return self::expandNested((array) $node, $basepath, $loader, $nextVisiting);
    }

    /**
     * Expand any $ref (and merge any $patch) sitting INSIDE a resolved properties
     * map, recursively. The resolved base is laid down first, then sibling named
     * keys override it (declaration order: a later plain key overrides an earlier
     * $ref).
     *
     * @param array<string, mixed> $node
     * @param array<string, bool>  $visiting
     * @return array<string, mixed>
     */
    private static function expandNested(
        array $node,
        string $basepath,
        FileLoader $loader,
        array $visiting,
    ): array {
        if (!\array_key_exists('$ref', $node) && !\array_key_exists('$patch', $node)) {
            return $node;
        }

        return Members::layer(
            $node,
            fn (mixed $ref): array => self::resolve($ref, $basepath, $loader, $visiting),
        );
    }

    /** JS-style type name for $ref value-type error messages. */
    private static function typeName(mixed $v): string
    {
        return match (true) {
            $v === null => 'null',
            \is_array($v) => 'array',
            default => \gettype($v),
        };
    }
}
