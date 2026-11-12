<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;

/**
 * Recursive forbidden meta-key scan (SPEC §6) — the runtime half of the
 * global rejection that the meta-schema's `propertyNames` enforces statically.
 * Byte-for-byte port of validator-ts/src/forbidden-scan.ts.
 *
 * R1: the types/parser PRESERVE every key (round-trip), so blocking forbidden
 * meta keys is the VALIDATION layer's job, not the model's. The direct audit
 * found that the Go/Rust typed models only rejected forbidden keys at the top
 * level and one level under open buckets — a deeply nested meta key
 * (validate.required.if, options.x.display_switch, …) leaked through. This scan
 * closes that leak: it walks the COMPOSED single spec (after $ref/$patch
 * expansion and x-strip) to ARBITRARY depth and rejects a forbidden key found at
 * ANY depth — including one level under a slot/bucket body.
 *
 * Placement (SPEC §2 pipeline): this runs in the spec LOAD path, immediately
 * after compose expansion and before validation entry. A hit is therefore a LOAD
 * failure (ComposeLoadError, code FORBIDDEN_META_KEY) — the spec never comes into
 * existence — never a valid:false validation result.
 *
 * Forbidden set (SPEC §6): the enumerated FORBIDDEN_META_KEYS (condition-only
 * / retired / magic-symbol meta keys) PLUS the x{key} comment family (any
 * x-prefixed key). $ref/$patch are NOT forbidden — compose already consumed
 * them, so they do not survive to here; x{key} IS strip-eligible, so any x{key}
 * that survives to this scan is rejected (the strip belongs to the meta-schema;
 * survival means it was not stripped).
 */
final class ForbiddenScan
{
    /**
     * The enumerated forbidden meta keys (SPEC §6), identical to the JS
     * reference FORBIDDEN_META_KEYS: condition-only meta keys, the retired
     * seqtokey/__13hex__, the magic '_' default symbol, the $-composition-overlay
     * keys, and the xclass/xstyle comment literals (the broader x{key} family is
     * matched by pattern, not enumerated). Stored as a value->true map for O(1)
     * membership.
     *
     * @var array<string, true>
     */
    private const FORBIDDEN_SET = [
        'display_switch' => true,
        'display_target' => true,
        'if' => true,
        'when' => true,
        'show_if' => true,
        '_' => true,
        'seqtokey' => true,
        '__13hex__' => true,
        '$after' => true,
        '$before' => true,
        '$merge' => true,
        '$remove' => true,
        'xclass' => true,
        'xstyle' => true,
    ];

    /**
     * Recursively scan a composed single spec for any forbidden meta key at any
     * depth. Throws ComposeLoadError('FORBIDDEN_META_KEY') on the first hit, with
     * the dotted path to the offending key in the message and trace.
     *
     * The scan descends into every object value AND every array element (a
     * forbidden key nested inside an array of sub-specs is caught too). Map keys
     * are checked before descending into their values, so the reported path points
     * at the shallowest offending key.
     *
     * @param mixed $spec the composed (composition-free, x-stripped) single spec to scan
     * @param list<string> $rootPath path prefix for the error trace (default [])
     *
     * @throws ComposeLoadError code FORBIDDEN_META_KEY when a forbidden key is present at any depth
     */
    public static function scan(mixed $spec, array $rootPath = []): void
    {
        self::walk($spec, $rootPath);
    }

    /**
     * @param mixed $node
     * @param list<string> $path
     */
    private static function walk(mixed $node, array $path): void
    {
        if (!\is_array($node) && !$node instanceof \stdClass) {
            return;
        }

        // A JSON array (list) is a sequence of sub-specs: descend into each
        // element, indexing the path by position (matches JS array handling and
        // the err-inside-array-element fixture's `…items.1.display_target`).
        if (\is_array($node) && \array_is_list($node)) {
            foreach ($node as $i => $element) {
                self::walk($element, [...$path, (string) $i]);
            }
            return;
        }

        // A JSON object (map): check EVERY key at this level first (shallowest hit
        // reported), then descend into the values.
        foreach ($node as $key => $_value) {
            $key = (string) $key;
            if (self::isForbiddenKey($key)) {
                $at = [...$path, $key];
                throw new ComposeLoadError(
                    'FORBIDDEN_META_KEY',
                    'forbidden meta key "' . $key . '" at ' . \implode('.', $at),
                    $at,
                );
            }
        }
        foreach ($node as $key => $value) {
            self::walk($value, [...$path, (string) $key]);
        }
    }

    /** Whether $key is globally forbidden (enumerated literal OR x{key}). */
    private static function isForbiddenKey(string $key): bool
    {
        return isset(self::FORBIDDEN_SET[$key]) || self::isXCommentKey($key);
    }

    /**
     * Whether $key is an x{key} comment key: a lowercase 'x' followed by at least
     * one more character (xclass, xstyle, xnote, …). The bare key 'x' is not
     * treated as a comment. The authoritative strip belongs to the meta-schema;
     * this is the runtime backstop that rejects an x{key} that survived.
     */
    private static function isXCommentKey(string $key): bool
    {
        return \strlen($key) > 1 && $key[0] === 'x';
    }
}
