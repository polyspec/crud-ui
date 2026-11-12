<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;

final class RenderingTest extends TestCase
{
    public function testImagesIncludeOrderedDeduplicatedPreloadsAndKeepRawHtml(): void
    {
        $spec = json_decode(
            '{"columns":{"image":{"field":"image","format":"image"},"raw":{"field":"raw","format":"html"}}}'
        );
        $rows = json_decode(
            '[{"image":"/b.png","raw":"<img src=\"/raw.png\">"},{"image":"/a.png"},{"image":"/b.png"},{"image":'
                . '"data:image/png;base64,AA=="}]'
        );
        $expected = '<link rel="preload" as="image" href="/b.png"/><link rel="preload" as="image" href="/a.png"/>'
            . '<div class="crudui-list"><table class="crudui-list__table"><thead><tr><th class="crudui-list__heading"'
            . ' data-field="image"><span class="crudui-list__heading-label">image</span></th><th class="crudui-list__'
            . 'heading" data-field="raw"><span class="crudui-list__heading-label">raw</span></th></tr></thead><tbody>'
            . '<tr><td class="crudui-list__cell crudui-value crudui-value--image"><img src="/b.png" alt=""/></td><td '
            . 'class="crudui-list__cell crudui-value crudui-value--html"><img src="/raw.png"></td></tr>'
            . '<tr><td class="crudui-list__cell crudui-value crudui-value--image"><img src="/a.png" alt=""/></td><td '
            . 'class="crudui-list__cell crudui-value crudui-value--html"></td></tr>'
            . '<tr><td class="crudui-list__cell crudui-value crudui-value--image"><img src="/b.png" alt=""/></td><td '
            . 'class="crudui-list__cell crudui-value crudui-value--html"></td></tr>'
            . '<tr><td class="crudui-list__cell crudui-value crudui-value--image"><img src="data:image/png;base64,AA='
            . '=" alt=""/></td><td class="crudui-list__cell crudui-value crudui-value--html"></td></tr>'
            . '</tbody></table></div>';
        self::assertSame($expected, Generator::renderList($spec, $rows));
    }


    public function testExplicitNullDisplayValuesDoNotUseDefaults(): void
    {
        $spec = json_decode('{"type":"group","properties":{"display":{"type":"dummy","default":"Default"}}}');
        $form = new Form(Generator::compileForm($spec), ['display' => null]);
        self::assertSame(
            '<div class="crudui-form"><div class="crudui-form__body"><div class="crudui-node crudui-node--field'
                . '" data-field-path="display"><div class="crudui-node__body"><div></div></div></div></div><div class'
                . '="crudui-form__footer"><div class="crudui-controls" role="group" aria-label="폼 작업"><button t'
                . 'ype="submit" class="crudui-action crudui-action--text">저장</button></div></div></div>',
            Generator::renderForm($form)
        );
    }
}
