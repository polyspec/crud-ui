<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use Dom\Element;
use Dom\Node;
use Dom\Text;

/**
 * The layout comparison of the fixtures, as the Python and JavaScript normalizers make it: both sides are parsed with
 * the HTML5 parser into a tree with sorted attributes,
 * boolean attributes empty, a canonical style attribute and no whitespace-only text outside preformatted elements.
 */
trait LayoutTree
{
    /**
     * The HTML of a string renderer without its image preload links: the list and detail expectations cover the body
     * only,
     * so the links are removed on both sides of their comparison.
     */
    private static function withoutPreloads(string $html): string
    {
        return (string) preg_replace('/<link [^>]*rel="preload"[^>]*>/', '', $html);
    }

    /** The normalized tree of rendered layout HTML. */
    private static function layout(string $html): array
    {
        $document = \Dom\HTMLDocument::createFromString(
            '<!doctype html><html><body>' . $html . '</body></html>',
            LIBXML_NOERROR,
            'UTF-8'
        );
        return self::children($document->body, false);
    }

    /**
     * The declarations of a style attribute as `property: value` joined by `; `, the layout the fixtures compare. Only
     * the
     * public API is used by the tests, so this is the test's own reading of the text: it trims each part and drops
     * empty
     * declarations, and it does not normalize values.
     */
    private static function canonicalStyle(string $style): string
    {
        $declarations = [];
        foreach (explode(';', $style) as $declaration) {
            $parts = explode(':', $declaration, 2);
            if (count($parts) !== 2 || trim($parts[0]) === '' || trim($parts[1]) === '') {
                continue;
            }
            $declarations[] = trim($parts[0]) . ': ' . trim($parts[1]);
        }
        return implode('; ', $declarations);
    }

    private static function children(Node $parent, bool $preserve): array
    {
        $out = [];
        foreach ($parent->childNodes as $node) {
            if ($node instanceof Text) {
                if ($preserve || trim($node->wholeText) !== '') {
                    $out[] = ['text' => $node->wholeText];
                }
                continue;
            }
            if (!$node instanceof Element) {
                continue;
            }
            $attrs = [];
            foreach ($node->attributes as $attribute) {
                $value = $attribute->value;
                if (
                    in_array(
                        $attribute->name,
                        ['checked', 'selected', 'disabled', 'readonly', 'multiple', 'required', 'autofocus'],
                        true
                    )
                ) {
                    $value = '';
                }
                if ($attribute->name === 'style') {
                    $value = self::canonicalStyle($value);
                }
                if (in_array($attribute->name, ['class', 'style'], true) && $value === '') {
                    continue;
                }
                $attrs[$attribute->name] = $value;
            }
            ksort($attrs, SORT_STRING);
            $out[] = [
                'tag' => $node->localName,
                'attributes' => $attrs,
                'children' => self::children(
                    $node,
                    $preserve || in_array($node->localName, ['textarea', 'pre', 'script', 'style'], true)
                ),
            ];
        }
        return $out;
    }
}
