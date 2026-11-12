<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator;

/**
 * CRUDUI canonical FieldSpec model. SINGLE SOURCE OF TRUTH (SPEC §3).
 *
 * This class mechanizes the canonical CRUDUI model.
 *
 * What is mechanized here:
 * - TOP_LEVEL: the closed, ordered set of field keys, each tagged with its role.
 * - SLOTS: role slots validate/design/behavior/options. Every slot value is
 *   polymorphic: false (suppress synthesized inheritance) | {} (a sub-key map)
 *   | true (bare enable).
 * - DEPENDENCY_BUCKETS: dependency isolation. type-dependent keys live under the
 *   `options` slot; multiple/lang/items-dependent keys live UNDER that structural
 *   key. A dependent key is never hoisted to the field root.
 * - CLOSED_BUCKET_KEYS: design, behavior, multiple, lang and validate (and each
 *   design node's class/style) reject unknown keys; options and the items
 *   dynamic source stay open.
 * - DESIGN_NODE_MAP: which DOM node a design appearance entry targets (R8).
 * - CONDITION_MAP: a declaration-ordered map; its default key is the literal
 *   `true` expression (always truthy). R4 forbids convention sigils such as `_`.
 * - COMPOSITION: $ref (base inheritance) then $patch (mutation).
 * - FORBIDDEN_META_KEYS: condition-only and retired meta keys that MUST NOT appear
 *   anywhere in a CRUDUI field — not at root, not one level below any slot/bucket.
 *
 * Recognition. Only canonical CRUDUI names are recognition keys (R2 forbids dual
 * spellings; R4 forbids magic tokens like `*` or `:`). Other spellings such as
 * multiple_max, sortable*, lang:append or langs are not recognized.
 *
 * Comment keys (x{key}). The meta-schema is expected to x-strip every `x`-prefixed
 * key BEFORE validating the canonical spec; this model therefore REJECTS an
 * `x`-prefixed key in a canonical document (it is a comment, not a canonical
 * key) while recording why via isCommentKey(). x-strip happens upstream.
 *
 * Round-trip. parse() reads a CRUDUI JSON document into an ordered associative array
 * (PHP associative arrays preserve insertion order natively, so condition-map
 * and properties declaration order survive) and serialize() emits byte-identical
 * canonical JSON. Both directions exist — no Marshal-only half.
 */
final class FieldSpec
{
    // --- top-level key roles -------------------------------------------------

    /** Identity: field type. Defines and owns the `options` slot. */
    public const ROLE_IDENTITY = 'identity';

    /** Structure/identity: serialization name (explicit, semantic; R4). */
    public const ROLE_STRUCTURE_IDENTITY = 'structure_identity';

    /** Structure: $ref/$patch composition, child maps, dependency buckets. */
    public const ROLE_STRUCTURE = 'structure';

    /**
     * Content: human-facing text. A plain string, a per-language LangMap
     * {ko,en} (G3 content translation), or null/omitted for empty content —
     * null is identical to absent and has no render/validate effect (SPEC §2 G3).
     * A LangMap slot may itself be null (empty label for that language).
     */
    public const ROLE_CONTENT = 'content';

    /** Role slot: validate/design/behavior/options (§3 role distribution). */
    public const ROLE_SLOT = 'role_slot';

    /** Messages: error message overrides keyed by registered rule name. */
    public const ROLE_MESSAGES = 'messages';

    /** Form declaration: buttons, action and dataLimits, honored on the form root only. */
    public const ROLE_FORM = 'form';

    /**
     * The closed set of top-level field keys, in declaration order, each with
     * its role. A CRUDUI field accepts these keys and nothing else; the schema
     * enforces this with additionalProperties:false plus the global
     * propertyNames forbidden-key check.
     *
     * @var array<string, string> key => role constant
     */
    public const TOP_LEVEL = [
        'type'        => self::ROLE_IDENTITY,
        'name'        => self::ROLE_STRUCTURE_IDENTITY,
        'default'     => self::ROLE_STRUCTURE,
        'properties'  => self::ROLE_STRUCTURE,
        'items'       => self::ROLE_STRUCTURE,
        'multiple'    => self::ROLE_STRUCTURE,
        'lang'        => self::ROLE_STRUCTURE,
        'label'       => self::ROLE_CONTENT,
        'description' => self::ROLE_CONTENT,
        'placeholder' => self::ROLE_CONTENT,
        'prepend'     => self::ROLE_CONTENT,
        'append'      => self::ROLE_CONTENT,
        'help'        => self::ROLE_CONTENT,
        'content'     => self::ROLE_CONTENT,
        'validate'    => self::ROLE_SLOT,
        'messages'    => self::ROLE_MESSAGES,
        'design'      => self::ROLE_SLOT,
        'behavior'    => self::ROLE_SLOT,
        'options'     => self::ROLE_SLOT,
        'buttons'     => self::ROLE_FORM,
        'action'      => self::ROLE_FORM,
        'dataLimits'  => self::ROLE_FORM,
    ];

    // --- role slots ----------------------------------------------------------

    /**
     * Role slot names (§3). Every slot is polymorphic: false | {} | true.
     * false suppresses synthesized inheritance; {} carries sub-keys; true is the
     * bare-enable form.
     *
     * @var list<string>
     */
    public const SLOTS = ['validate', 'design', 'behavior', 'options'];

    /**
     * The polymorphic slot value forms. A slot value MUST be one of these.
     *
     * @var list<string>
     */
    public const SLOT_VALUE_FORMS = ['false', 'map', 'true'];

    /**
     * Sub-keys recognized inside the `validate` slot: the registered rule names, in
     * the order of the validator's default messages. Each value may itself be an
     * expression / condition map, so conditional validation needs no separate key
     * (e.g. required: '.subscribe', email: true). Polymorphic slot (R: G1).
     *
     * @var list<string>
     */
    public const VALIDATE_SUB_KEYS = [
        'required', 'email', 'minlength', 'maxlength', 'min', 'max', 'match', 'pattern',
        'unique', 'in', 'range', 'rangelength', 'number', 'digits', 'equalTo', 'containedIn', 'typeFrom',
        'minFrom', 'maxFrom', 'notEqual',
        'date', 'dateISO', 'enddate', 'url', 'accept', 'mincount', 'maxcount', 'step', 'conditionTree',
        'reference',
    ];

    /**
     * Sub-keys inside the `design` slot. show = display condition (NOT a node);
     * class/style = the primary (input) node; attributes = the declared
     * attributes of the control; layout = the layout a group gives its fields
     * (not a node); label|wrapper|group|prepend carry .class/.style
     * for that named node, and the wrapper also .attributes. Which node a
     * class/style targets is revealed by the key (R8).
     *
     * @var list<string>
     */
    public const DESIGN_SUB_KEYS = [
        'show',
        'class',
        'style',
        'attributes',
        'layout',
        'label',
        'wrapper',
        'group',
        'prepend'
    ];

    /**
     * Sub-keys inside the `behavior` slot. Opaque client JS, passed through
     * WITHOUT the expression engine (§4). `behavior: false` voids synthesized
     * inheritance. An action label sits adjacent at behavior.{action}.label.
     *
     * @var list<string>
     */
    public const BEHAVIOR_SUB_KEYS = ['onchange', 'onclick', 'onload'];

    /**
     * Sub-keys inside the `options` slot — the type-dependent slot (the type
     * defines and validates them; the core stays uninvolved). Container chrome
     * and type-dependent scripts/callbacks live here too. Removing the type also
     * removes these options. A new widget does not change the core.
     *
     * Mirrors SPEC §3 slots.options.sub_keys exactly (the wider type-dependent
     * surface — marker_draggable/zoom/geometry_type — rides through the open
     * options bucket checked only by global forbidden-key validation).
     *
     * @var list<string>
     */
    public const OPTIONS_SUB_KEYS = [
        'keyword_min_length',
        'max_tags',
        'checkbox_label',
        'on_label',
        'collapse',
        'expend',
        'view_total',
        'stepper',
        'blank_message',
        'callback',
        'event',
    ];

    /**
     * Slot name => its recognized sub-keys.
     *
     * @var array<string, list<string>>
     */
    public const SLOT_SUB_KEYS = [
        'validate' => self::VALIDATE_SUB_KEYS,
        'design'   => self::DESIGN_SUB_KEYS,
        'behavior' => self::BEHAVIOR_SUB_KEYS,
        'options'  => self::OPTIONS_SUB_KEYS,
    ];

    /**
     * Closed buckets and the only keys each map form accepts; any other key is
     * an unknown-key violation. Mirrors the JSON schema: design, behavior,
     * multiple, lang and validate close their map form, and every design node
     * (DESIGN_NODE_KEYS) closes to class/style. `options` and the `items`
     * dynamic source stay open (see OPTIONS_IS_OPEN) and are checked only for
     * forbidden and comment keys.
     *
     * @var array<string, list<string>>
     */
    public const CLOSED_BUCKET_KEYS = [
        'design'   => self::DESIGN_SUB_KEYS,
        'behavior' => self::BEHAVIOR_SUB_KEYS,
        'multiple' => ['only', 'min', 'max', 'copy', 'sortable', 'title', 'controls', 'header', 'onclick'],
        'lang'     => ['mode', 'only', 'name', 'key', 'frame', 'title', 'group_class'],
        'validate' => self::VALIDATE_SUB_KEYS,
    ];

    /**
     * The design nodes (label/wrapper/group/prepend) and the closed key set of
     * each node's map form.
     *
     * @var list<string>
     */
    public const DESIGN_NODES = ['label', 'wrapper', 'group', 'prepend'];

    /** @var list<string> */
    public const DESIGN_NODE_KEYS = ['class', 'style'];

    /**
     * The closed key set of the wrapper node: its appearance and the declared
     * attributes of the node root.
     *
     * @var list<string>
     */
    public const WRAPPER_NODE_KEYS = ['class', 'style', 'attributes'];

    /**
     * The `options` slot is open (a type may introduce its own settings). The
     * schema keeps it open with propertyNames:{not:{enum:FORBIDDEN}} rather than
     * additionalProperties:true, so a type extends freely yet a forbidden meta
     * key is still blocked one level below `options`.
     */
    public const OPTIONS_IS_OPEN = true;

    // --- dependency isolation buckets ----------------------------------------

    /**
     * Dependency-bucket targets and where each one's dependent keys live. Keys
     * here are CANONICAL CRUDUI names only — no alternative spellings, no magic tokens.
     *
     * - type     -> the `options` slot (scalar target's dedicated slot).
     * - multiple -> directly under the `multiple` structural key.
     * - lang     -> directly under the `lang` structural key.
     * - items    -> directly under `items` (polymorphic option source).
     *
     * The `items` dynamic-source keys are STRUCTURE ONLY (the type fixes the
     * declared shape; the runtime loads options). The supported shape
     * (`type: search`) is `model` (a name string OR a nested
     * {table, relations, keys} relational query) + a sibling `api_server` (a
     * runtime HTTP-endpoint fn reference) + a placeholder static `items` — all
     * three coexist under `items` and are preserved verbatim; none is resolved
     * here. Runtime resolution is out of scope (SPEC §6 R1).
     *
     * @var array<string, array{location: string, keys: list<string>}>
     */
    public const DEPENDENCY_BUCKETS = [
        'type' => [
            'location' => 'options',
            'keys'     => self::OPTIONS_SUB_KEYS,
        ],
        'multiple' => [
            'location' => 'multiple',
            'keys'     => ['only', 'min', 'max', 'copy', 'sortable', 'title', 'controls', 'header', 'onclick'],
        ],
        'lang' => [
            'location' => 'lang',
            'keys'     => ['mode', 'only', 'name', 'key', 'frame', 'title', 'group_class'],
        ],
        'items' => [
            'location' => 'items',
            'keys'     => ['model', 'method', 'table', 'relations', 'api_server', 'items'],
        ],
    ];

    // --- design node map -----------------------------------------------------

    /**
     * Design appearance entries and the DOM node each targets (R8): show is the
     * display condition (not a node); class/style hit the primary node; the named
     * nodes carry .class/.style. Same surface as SPEC §design_node_map.
     *
     * @var list<string>
     */
    public const DESIGN_NODE_MAP = [
        'show',
        'class',
        'style',
        'attributes',
        'label.class',
        'label.style',
        'wrapper.class',
        'wrapper.style',
        'wrapper.attributes',
        'group.class',
        'group.style',
        'prepend.class',
        'prepend.style',
    ];

    // --- condition map -------------------------------------------------------

    /**
     * The condition-map default key: the literal `true` expression (always
     * truthy). R4 forbids convention sigils such as `_`. A condition map is an
     * ordered map {expr: value, …}; keys are evaluated in declaration order and
     * the first truthy expression's value wins; otherwise the `true` key's value
     * (if present), else null. A single `?:` expression is the one-entry
     * shorthand with identical semantics. Each key is an expressions.md §2
     * expression; the condition map is a thin wrapper over the same engine, not a
     * separate parser. Evaluated value type — boolean | string | number | null —
     * is decided by the call site.
     */
    public const CONDITION_MAP_DEFAULT_KEY = 'true';

    // --- composition ---------------------------------------------------------

    /**
     * Composition directives, in resolution order: $ref (base inheritance) is
     * expanded first; an unresolved $ref cannot be loaded. $patch then mutates.
     * $after/$before/$merge/$remove are not directives and are forbidden as
     * literal keys.
     *
     * @var list<string>
     */
    public const COMPOSITION_DIRECTIVES = ['$ref', '$patch'];

    // --- forbidden meta keys -------------------------------------------------

    /**
     * Condition-only and retired meta keys that MUST NOT appear ANYWHERE in a CRUDUI
     * field — at root, and also one level below any slot or bucket body. Open
     * buckets stay open via propertyNames:{not:{enum:FORBIDDEN}}, so extension is
     * allowed but every one of these is globally blocked. `x{key}` comment keys
     * are not listed here; they are handled separately by the x-strip premise
     * (see isCommentKey()).
     *
     * @var list<string>
     */
    public const FORBIDDEN_META_KEYS = [
        'display_switch',
        'display_target',
        'if',
        'when',
        'show_if',
        '_',
        'seqtokey',
        '__13hex__',
        '$after',
        '$before',
        '$merge',
        '$remove',
        'xclass',
        'xstyle',
        'x{key}',
    ];

    // --- predicates ----------------------------------------------------------

    /**
     * Whether a key is a recognized top-level field key.
     */
    public static function isTopLevelKey(string $key): bool
    {
        return array_key_exists($key, self::TOP_LEVEL);
    }

    /**
     * Role of a top-level key, or null when the key is not top-level.
     */
    public static function roleOf(string $key): ?string
    {
        return self::TOP_LEVEL[$key] ?? null;
    }

    /**
     * Whether a key is a role slot (validate/design/behavior/options).
     */
    public static function isSlot(string $key): bool
    {
        return in_array($key, self::SLOTS, true);
    }

    /**
     * Whether a key is a structural dependency-bucket target
     * (type/multiple/lang/items).
     */
    public static function isDependencyTarget(string $key): bool
    {
        return array_key_exists($key, self::DEPENDENCY_BUCKETS);
    }

    /**
     * Whether a key is forbidden in a CRUDUI field at ANY depth.
     */
    public static function isForbiddenMetaKey(string $key): bool
    {
        return in_array($key, self::FORBIDDEN_META_KEYS, true);
    }

    /**
     * Whether a key is an `x`-prefixed comment key. The meta-schema x-strips
     * these before validating the canonical spec, so a canonical document must
     * not carry one. Rejected by validation; recorded here for the reason.
     */
    public static function isCommentKey(string $key): bool
    {
        return strlen($key) >= 2
            && $key[0] === 'x'
            && !self::isTopLevelKey($key)
            && !in_array($key, ['xclass', 'xstyle'], true);
    }

    /**
     * Whether a content value is a valid CRUDUI content shape (SPEC §2 G3): a plain
     * string, a per-language LangMap (string-keyed array of string|null), or null
     * (empty content — identical to absent, no render/validate effect). A LangMap
     * slot may itself be null (empty label for that language).
     */
    public static function isValidContent(mixed $value): bool
    {
        if ($value === null || is_string($value)) {
            return true;
        }
        if (!is_array($value) || $value === [] || array_is_list($value)) {
            return false;
        }
        foreach ($value as $slot) {
            if ($slot !== null && !is_string($slot)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Whether an `items` value is a static value→label content map (SPEC §2 G3):
     * a non-empty string-keyed array whose entry values are labels — a string, a
     * LangMap array {ko,en}, or null (empty label). The option VALUE is the KEY
     * (the membership target); the label is display-only and never a membership
     * value, so a LangMap label and a null label have no membership effect.
     *
     * Lists (static arrays) and dynamic sources (a `model`/`method`/`table`/
     * `relations`/`api_server`/`items` source descriptor — where `model` may be a
     * name string OR a nested {table, relations, keys} query, `api_server` is a
     * runtime HTTP-endpoint fn reference, and `items` is the placeholder static
     * choices that coexist) are NOT value→label maps.
     *
     * @param mixed $items
     */
    public static function isValueLabelItemsMap(mixed $items): bool
    {
        if (!is_array($items) || $items === [] || array_is_list($items)) {
            return false;
        }
        // A dynamic source descriptor (any dynamic-source key present) is NOT a
        // value→label map — its values are a source query / endpoint fn /
        // placeholder, not display labels. Mirrors the 4-language discriminator.
        if (self::isDynamicItemsSource($items)) {
            return false;
        }
        foreach ($items as $label) {
            if ($label !== null && !is_string($label) && !is_array($label)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Whether a decoded `items` value is a dynamic source descriptor: a non-empty
     * string-keyed map whose keys are ALL dynamic-source keys
     * (model/method/table/relations/api_server/items, the placeholder included).
     * A value→label map's keys are option values, never the source key set, so
     * the two never collide in practice. STRUCTURE ONLY — the runtime runs the
     * `model` query and calls `api_server`; this predicate only classifies the
     * shape (it never resolves the source). Mirrors the JS / Go / Rust
     * "all keys ∈ source set" discriminator exactly.
     *
     * @param mixed $items
     */
    public static function isDynamicItemsSource(mixed $items): bool
    {
        if (!is_array($items) || $items === [] || array_is_list($items)) {
            return false;
        }
        $sourceKeys = self::DEPENDENCY_BUCKETS['items']['keys'];
        foreach (array_keys($items) as $key) {
            if (!in_array($key, $sourceKeys, true)) {
                return false;
            }
        }
        return true;
    }

    /**
     * The membership values of an `items` source: for a static value→label map
     * the KEYS (the option values — labels are display-only, SPEC §2 G3); for a
     * static list the list itself; otherwise an empty list (a dynamic source has
     * no static membership set). Mirrors the `in`-rule flatten across the four
     * engines.
     *
     * @param mixed $items
     * @return list<mixed>
     */
    public static function itemsMembershipValues(mixed $items): array
    {
        if (self::isValueLabelItemsMap($items)) {
            /** @var array<string, mixed> $items */
            return array_keys($items);
        }
        if (is_array($items) && array_is_list($items)) {
            return $items;
        }
        return [];
    }

    /**
     * Whether a slot value is a valid polymorphic form (false | array map | true).
     * Any other type (string, int, null) is rejected.
     */
    public static function isValidSlotValue(mixed $value): bool
    {
        return $value === false || $value === true || is_array($value);
    }

    /**
     * The polymorphic form name of a slot value, or null when invalid.
     */
    public static function slotValueForm(mixed $value): ?string
    {
        return match (true) {
            $value === false => 'false',
            $value === true  => 'true',
            is_array($value) => 'map',
            default          => null,
        };
    }

    /**
     * Recognized sub-keys for a slot, or null when the name is not a slot.
     *
     * @return list<string>|null
     */
    public static function subKeysOf(string $slot): ?array
    {
        return self::SLOT_SUB_KEYS[$slot] ?? null;
    }

    // --- validation ----------------------------------------------------------

    /**
     * Deep-validate a decoded CRUDUI field. Returns the list of violations (empty =
     * valid). Enforces: closed top-level key set, polymorphic slot value forms,
     * dependency isolation (a bucket key only under its location), closed bucket
     * key sets (CLOSED_BUCKET_KEYS: design, behavior, multiple, lang, validate and
     * each design node's class/style), `messages` keys limited to the registered
     * rule names, and the global forbidden-key check (root +
     * one level below every slot and bucket; open options/items too). An
     * `x`-prefixed comment key is a violation (x-strip is an upstream step).
     *
     * @param array<string, mixed> $field
     * @return list<string>
     */
    public static function validate(array $field): array
    {
        $violations = [];

        foreach ($field as $key => $value) {
            if (!is_string($key)) {
                $violations[] = "non-string top-level key";
                continue;
            }
            if (self::isForbiddenMetaKey($key)) {
                $violations[] = "forbidden meta key at root: {$key}";
                continue;
            }
            if (self::isCommentKey($key)) {
                $violations[] = "comment key must be x-stripped before validation: {$key}";
                continue;
            }
            if (!self::isTopLevelKey($key)) {
                $violations[] = "unknown top-level key: {$key}";
                continue;
            }

            if ($key === 'messages' && is_array($value)) {
                self::guardInside($key, $value, self::VALIDATE_SUB_KEYS, $violations);
            } elseif (self::isSlot($key) && !self::isValidSlotValue($value)) {
                $violations[] = "slot {$key} must be false | map | true";
            } elseif ((self::isSlot($key) || self::isDependencyTarget($key)) && is_array($value)) {
                self::guardInside($key, $value, self::CLOSED_BUCKET_KEYS[$key] ?? null, $violations);
                if ($key === 'design') {
                    foreach (self::DESIGN_NODES as $node) {
                        if (is_array($value[$node] ?? null)) {
                            self::guardInside(
                                "design.{$node}",
                                $value[$node],
                                $node === 'wrapper' ? self::WRAPPER_NODE_KEYS : self::DESIGN_NODE_KEYS,
                                $violations
                            );
                        }
                    }
                }
            }
        }

        return $violations;
    }

    /**
     * Append a violation for every forbidden, comment or (in a closed bucket)
     * unknown key found one level below the given container. Open buckets
     * ($allowed null) accept extension but never a forbidden or comment key.
     *
     * @param array<mixed, mixed> $container
     * @param list<string>|null   $allowed
     * @param list<string>        $violations
     */
    private static function guardInside(string $owner, array $container, ?array $allowed, array &$violations): void
    {
        foreach (array_keys($container) as $sub) {
            $sub = (string) $sub;
            if (self::isForbiddenMetaKey($sub)) {
                $violations[] = "forbidden meta key under {$owner}: {$sub}";
            } elseif (self::isCommentKey($sub)) {
                $violations[] = "comment key under {$owner} must be x-stripped: {$sub}";
            } elseif ($allowed !== null && !in_array($sub, $allowed, true)) {
                $violations[] = "unknown key under {$owner}: {$sub}";
            }
        }
    }

    // --- round-trip ----------------------------------------------------------

    /**
     * Parse a CRUDUI JSON document into an ordered associative array for the analysis
     * API (validate/predicates). PHP associative arrays preserve insertion order,
     * so condition-map and properties declaration order survives. Throws on
     * malformed JSON.
     *
     * Caveat: assoc decoding cannot tell an empty object `{}` from an empty array
     * `[]`; for byte-stable round-trip use parseTree()/serializeTree() (or
     * roundTrips()), which decode to stdClass and keep the `{}` polymorphic form.
     *
     * @return array<string, mixed>
     */
    public static function parse(string $json): array
    {
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

        return $decoded;
    }

    /**
     * Serialize a decoded CRUDUI field (associative-array form) back to canonical
     * JSON, preserving key order. Empty associative arrays emit as `[]`; when the
     * `{}` polymorphic form matters, use the *Tree round-trip path instead.
     *
     * @param array<string, mixed> $field
     */
    public static function serialize(array $field): string
    {
        return json_encode($field, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Parse a CRUDUI JSON document into an object tree (stdClass for objects, list
     * for arrays). This keeps insertion order AND distinguishes the empty-map
     * `{}` polymorphic form from an empty array `[]`. Throws on malformed JSON.
     */
    public static function parseTree(string $json): mixed
    {
        return json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * Serialize a CRUDUI object tree back to canonical JSON, preserving key order and
     * the `{}` form. Round-trip invariant: serializeTree(parseTree(canonical))
     * === canonical for any already-canonical document.
     */
    public static function serializeTree(mixed $tree): string
    {
        return json_encode($tree, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Round-trip a canonical JSON document and report whether it is byte-stable.
     * Decodes to an object tree so the polymorphic slot forms (false | {} | true)
     * and declaration-ordered maps survive intact.
     */
    public static function roundTrips(string $canonicalJson): bool
    {
        return self::serializeTree(self::parseTree($canonicalJson)) === $canonicalJson;
    }
}
