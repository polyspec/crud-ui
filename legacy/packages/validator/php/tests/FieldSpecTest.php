<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests;

use Polyspec\Crudui\Validator\FieldSpec;
use Polyspec\Crudui\Validator\Validate\Validator;
use PHPUnit\Framework\TestCase;

/**
 * Verifies FieldSpec round-trip byte stability, polymorphic slot forms, ordered-map
 * preservation, dependency isolation and global forbidden-key rejection.
 */
final class FieldSpecTest extends TestCase
{
    /**
     * A canonical document round-trips byte-for-byte through parse->serialize.
     * Covers polymorphic slot forms (false|{}|true) and a declaration-ordered
     * condition map plus an ordered properties map.
     */
    public function testRoundTripIsByteStable(): void
    {
        $canonical = '{"type":"text","name":"email","label":{"ko":"이메일","en":"Email"},'
            . '"properties":{"b":{"type":"text"},"a":{"type":"text"}},'
            . '"multiple":false,"lang":{},"validate":{"required":".subscribe","email":true},'
            . '"design":{"show":{"true":true,".admin":false},"class":"col-6","label":{"class":"strong"}},'
            . '"behavior":true,"options":{"max_tags":5,"event":"x"}}';

        self::assertTrue(FieldSpec::roundTrips($canonical), 'canonical JSON must be byte-stable');
    }

    /**
     * Condition-map key order is preserved declaration-first after round-trip.
     */
    public function testConditionMapOrderPreserved(): void
    {
        $json    = '{"design":{"show":{".z":false,".a":true,"true":false}}}';
        $decoded = FieldSpec::parse($json);

        self::assertSame(['.z', '.a', 'true'], array_keys($decoded['design']['show']));
        self::assertSame($json, FieldSpec::serialize($decoded));
        self::assertTrue(FieldSpec::roundTrips($json), 'ordered map must round-trip byte-stable');
    }

    /**
     * Each polymorphic slot form is accepted and named correctly.
     */
    public function testPolymorphicSlotForms(): void
    {
        self::assertSame('false', FieldSpec::slotValueForm(false));
        self::assertSame('true', FieldSpec::slotValueForm(true));
        self::assertSame('map', FieldSpec::slotValueForm(['required' => true]));
        self::assertNull(FieldSpec::slotValueForm('nope'));
        self::assertFalse(FieldSpec::isValidSlotValue('nope'));
        self::assertFalse(FieldSpec::isValidSlotValue(null));
    }

    /**
     * Forbidden meta keys are rejected at root.
     */
    public function testForbiddenMetaKeysRejectedAtRoot(): void
    {
        foreach (FieldSpec::FORBIDDEN_META_KEYS as $bad) {
            $v = FieldSpec::validate([$bad => 1]);
            self::assertNotEmpty($v, "root forbidden key not caught: {$bad}");
        }
    }

    /**
     * Forbidden meta keys are rejected one level below a slot and a bucket.
     */
    public function testForbiddenMetaKeysRejectedInsideSlotsAndBuckets(): void
    {
        self::assertNotEmpty(FieldSpec::validate(['options' => ['if' => 1]]));
        self::assertNotEmpty(FieldSpec::validate(['multiple' => ['when' => 1]]));
        self::assertNotEmpty(FieldSpec::validate(['design' => ['$merge' => 1]]));
    }

    /**
     * The multiple bucket accepts every canonical repeated-row key.
     */
    public function testMultipleBucketAcceptsCanonicalKeys(): void
    {
        self::assertSame(
            [],
            FieldSpec::validate(['multiple' => [
                'min' => 1,
                'max' => 5,
                'copy' => true,
                'sortable' => true,
                'title' => 'name',
                'controls' => 'footer',
                'header' => 'sticky',
                'onclick' => 'add()'
            ]])
        );
    }

    /**
     * An open bucket accepts a type-introduced extension key but still blocks a
     * forbidden key beside it.
     */
    public function testOpenBucketAllowsExtensionButBlocksForbidden(): void
    {
        self::assertSame([], FieldSpec::validate(['options' => ['marker_draggable' => true, 'custom' => 1]]));
        self::assertNotEmpty(FieldSpec::validate(['options' => ['marker_draggable' => true, 'display_switch' => 1]]));
    }

    /**
     * design, design nodes, behavior, multiple, lang and validate are closed: an
     * unknown key is a violation. options and the items dynamic source stay open.
     */
    public function testClosedBucketsRejectUnknownKeys(): void
    {
        self::assertSame(
            ['unknown key under design: text'],
            FieldSpec::validate(['design' => ['class' => 'a', 'text' => 1]])
        );
        self::assertSame(
            ['unknown key under design.label: text'],
            FieldSpec::validate(['design' => ['label' => ['class' => 'a', 'text' => 1]]])
        );
        self::assertSame(
            ['unknown key under behavior: onsubmit'],
            FieldSpec::validate(['behavior' => ['onclick' => 'go()', 'onsubmit' => 'x']])
        );
        self::assertSame(
            ['unknown key under multiple: foo'],
            FieldSpec::validate(['multiple' => ['min' => 1, 'foo' => 1]])
        );
        self::assertSame(
            ['unknown key under lang: append'],
            FieldSpec::validate(['lang' => ['mode' => 'x', 'append' => true]])
        );
        self::assertSame(
            ['unknown key under validate: custom_rule'],
            FieldSpec::validate(['validate' => ['required' => true, 'custom_rule' => 1]])
        );
        self::assertSame([], FieldSpec::validate([
            'design'   => [
                'show' => true,
                'class' => 'a',
                'style' => 'b',
                'label' => ['class' => 'c', 'style' => 'd'],
                'wrapper' => [],
                'group' => ['class' => 'e'],
                'prepend' => ['style' => 'f']
            ],
            'behavior' => ['onchange' => 'a', 'onclick' => 'b', 'onload' => 'c'],
            'lang'     => [
                'mode' => 'append',
                'only' => ['ko'],
                'name' => 'n',
                'key' => 'k',
                'frame' => false,
                'title' => false,
                'group_class' => 'g'
            ],
            'validate' => ['required' => true, 'minlength' => 1, 'dateISO' => true, 'step' => 1],
            'options'  => ['custom' => 1],
            'items'    => ['model' => 'm', 'custom_source' => 1],
        ]));
    }

    /**
     * Declared attributes (docs/spec/schema.md, Declared attributes): design.attributes and
     * design.wrapper.attributes are accepted; another design node rejects attributes.
     */
    public function testDesignDeclaredAttributes(): void
    {
        self::assertSame([], FieldSpec::validate(['design' => [
            'attributes' => ['data-setting' => 'theme', 'aria-describedby' => 'help'],
            'wrapper' => ['class' => 'row', 'attributes' => ['data-section' => 'look']],
        ]]));
        self::assertSame(
            ['unknown key under design.label: attributes'],
            FieldSpec::validate(['design' => ['label' => ['attributes' => ['data-x' => '1']]]])
        );
        self::assertContains('attributes', FieldSpec::DESIGN_NODE_MAP);
        self::assertContains('wrapper.attributes', FieldSpec::DESIGN_NODE_MAP);
    }

    /** Layout (docs/spec/schema.md, Layout): a group's design accepts layout. */
    public function testDesignLayout(): void
    {
        self::assertSame([], FieldSpec::validate(['type' => 'group', 'design' => ['layout' => 'inline']]));
        self::assertContains('layout', FieldSpec::DESIGN_SUB_KEYS);
    }

    /**
     * `x`-prefixed comment keys are rejected (x-strip is upstream).
     */
    public function testCommentKeysRejected(): void
    {
        self::assertTrue(FieldSpec::isCommentKey('xnote'));
        self::assertFalse(FieldSpec::isCommentKey('type'));
        self::assertNotEmpty(FieldSpec::validate(['xnote' => 'comment']));
        self::assertNotEmpty(FieldSpec::validate(['options' => ['xfoo' => 1]]));
    }

    /**
     * A bad slot value form is a violation; a valid canonical field has none.
     */
    public function testSlotValueFormEnforced(): void
    {
        self::assertNotEmpty(FieldSpec::validate(['validate' => 'required']));
        self::assertSame([], FieldSpec::validate([
            'type'     => 'text',
            'name'     => 'a',
            'validate' => ['required' => true],
            'design'   => false,
            'behavior' => true,
        ]));
    }

    /**
     * Alternative spellings of dependency keys are NOT recognition keys.
     */
    public function testAlternativeSpellingsAreNotRecognized(): void
    {
        $recognized = [];
        foreach (FieldSpec::DEPENDENCY_BUCKETS as $b) {
            $recognized = array_merge($recognized, $b['keys']);
        }
        foreach (['multiple_max', 'sortable*', 'lang:append', 'langs', 'add_buttons'] as $name) {
            self::assertNotContains($name, $recognized, "unrecognized spelling leaked into recognition: {$name}");
        }
    }

    /**
     * No magic-token spelling (`*`, `:`) appears in any recognition set.
     */
    public function testNoMagicTokensInRecognitionKeys(): void
    {
        $all = array_keys(FieldSpec::TOP_LEVEL);
        foreach (FieldSpec::SLOT_SUB_KEYS as $subs) {
            $all = array_merge($all, $subs);
        }
        foreach (FieldSpec::DEPENDENCY_BUCKETS as $b) {
            $all = array_merge($all, $b['keys']);
        }
        foreach ($all as $k) {
            self::assertStringNotContainsString('*', $k);
            self::assertStringNotContainsString(':', $k);
        }
    }

    /** The validate slot accepts exactly the registered rule names. */
    public function testValidateKeysAreTheRegisteredRules(): void
    {
        self::assertSame(array_keys(Validator::DEFAULT_MESSAGES), FieldSpec::VALIDATE_SUB_KEYS);
        self::assertSame(FieldSpec::VALIDATE_SUB_KEYS, FieldSpec::CLOSED_BUCKET_KEYS['validate']);
    }

    /** The top-level keys are the schema's field keys other than the composition directives. */
    public function testTopLevelKeysAreTheSchemaFieldKeys(): void
    {
        $schema = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../../contracts/schema/crudui.schema.json'),
            true
        );
        $keys = array_values(array_diff(
            array_keys($schema['definitions']['Field']['properties']),
            FieldSpec::COMPOSITION_DIRECTIVES
        ));
        self::assertSame($keys, array_keys(FieldSpec::TOP_LEVEL));
    }

    /** A messages key is a registered rule name. */
    public function testMessagesKeysAreRegisteredRules(): void
    {
        self::assertSame([], FieldSpec::validate(['messages' => ['required' => 'a', 'number' => 'b']]));
        self::assertSame(
            ['unknown key under messages: requird'],
            FieldSpec::validate(['messages' => ['requird' => 'a']])
        );
    }

    /** The PHP model preserves optional data limit members during serialization. */
    public function testFormDataLimitsRoundTrip(): void
    {
        foreach (['{}', '{"depth":512}', '{"values":1000000}', '{"depth":512,"values":1000000}'] as $limits) {
            $input = '{"type":"group","dataLimits":' . $limits . '}';
            self::assertTrue(FieldSpec::roundTrips($input));
            self::assertSame([], FieldSpec::validate(FieldSpec::parse($input)));
        }
    }
}
