<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use PHPUnit\Framework\TestCase;

/** Public button binding and markup match the JavaScript output byte for byte. */
final class ButtonsTest extends TestCase
{
    private const SPEC = <<<'JSON'
{"type":"group","properties":{"name":{"type":"string"}},"buttons":[
 {"type":"link","text":{"ko":"목록","en":"List"},"href":"/items?a=1&b=\"2\""},
 {"type":"submit","name":"intent","value":"save"},
 {"type":"button","text":"Hi <b>&","design":{"class":{".name == 'A'":"wide","true":"narrow"},"style":"color: red"},
 "behavior":{"onclick":"go(\"x\")"}},
 {"type":"reset","behavior":{"onclick":{"label":"L","script":"reset()"}}}
]}
JSON;

    /** JavaScript bindButtons and formButtonsHtml results for each case. */
    private const EXPECTED = [
        'declaredEn' => [
            '[{"type":"link","tag":"a","text":"List","attrs":{"class":"crudui-action crudui-action--text","href'
                . '":"/items?a=1&b=\\"2\\""}},{"type":"submit","tag":"button","text":"Save","attrs":{"type":"submit",'
                . '"class":"crudui-action crudui-action--text","name":"intent","value":"save"}},{"type":"button","tag'
                . '":"button","text":"Hi <b>&","attrs":{"type":"button","class":"crudui-action crudui-action--text wi'
                . 'de","style":"color: red","onclick":"go(\\"x\\")"}},{"type":"reset","tag":"button","text":"Reset","'
                . 'attrs":{"type":"reset","class":"crudui-action crudui-action--text","onclick":"reset()"}}]',
            '<a class="crudui-action crudui-action--text" href="/items?a=1&amp;b=&quot;2&quot;">List</a><button'
                . ' type="submit" class="crudui-action crudui-action--text" name="intent" value="save">Save</button><'
                . 'button type="button" class="crudui-action crudui-action--text wide" style="color: red" onclick="go'
                . '(&quot;x&quot;)">Hi &lt;b&gt;&amp;</button><button type="reset" class="crudui-action crudui-action'
                . '--text" onclick="reset()">Reset</button>',
        ],
        'declaredKo' => [
            '[{"type":"link","tag":"a","text":"목록","attrs":{"class":"crudui-action crudui-action--text","hr'
                . 'ef":"/items?a=1&b=\\"2\\""}},{"type":"submit","tag":"button","text":"저장","attrs":{"type":"subm'
                . 'it","class":"crudui-action crudui-action--text","name":"intent","value":"save"}},{"type":"button",'
                . '"tag":"button","text":"Hi <b>&","attrs":{"type":"button","class":"crudui-action crudui-action--tex'
                . 't narrow","style":"color: red","onclick":"go(\\"x\\")"}},{"type":"reset","tag":"button","text":"'
                . '초기화","attrs":{"type":"reset","class":"crudui-action crudui-action--text","onclick":"reset()"'
                . '}}]',
            '<a class="crudui-action crudui-action--text" href="/items?a=1&amp;b=&quot;2&quot;">목록</a><butt'
                . 'on type="submit" class="crudui-action crudui-action--text" name="intent" value="save">저장</butt'
                . 'on><button type="button" class="crudui-action crudui-action--text narrow" style="color: red" oncli'
                . 'ck="go(&quot;x&quot;)">Hi &lt;b&gt;&amp;</button><button type="reset" class="crudui-action crudui-'
                . 'action--text" onclick="reset()">초기화</button>',
        ],
        'defaultKo' => [
            '[{"type":"submit","tag":"button","text":"저장","attrs":{"type":"submit","class":"crudui-action c'
                . 'rudui-action--text"}}]',
            '<button type="submit" class="crudui-action crudui-action--text">저장</button>',
        ],
        'defaultEn' => [
            '[{"type":"submit","tag":"button","text":"Save","attrs":{"type":"submit","class":"crudui-action cru'
                . 'dui-action--text"}}]',
            '<button type="submit" class="crudui-action crudui-action--text">Save</button>',
        ],
    ];

    public static function cases(): iterable
    {
        yield 'declared buttons in English' => ['declaredEn', self::SPEC, ['name' => 'A'], ['language' => 'en']];
        yield 'declared buttons in Korean' => ['declaredKo', self::SPEC, [], []];
        yield 'default submit button' => ['defaultKo', '{"type":"group","properties":{}}', [], []];
        yield 'default submit button in English' => [
            'defaultEn',
            '{"type":"group","properties":{}}',
            [],
            ['language' => 'en'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('cases')]
    public function testButtonsMatchJavaScript(string $name, string $spec, array $data, array $options): void
    {
        [$json, $html] = self::EXPECTED[$name];
        $buttons = Generator::bindButtons(Generator::compileForm(json_decode($spec)), $data, $options);
        self::assertSame(
            $json,
            json_encode($buttons, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
        );
        self::assertSame($html, Generator::formButtonsHtml($buttons));
        self::assertSame($html, Generator::formButtonsHtml(json_decode($json)));
    }

    public function testInputChecksMatchFormBinding(): void
    {
        $template = Generator::compileForm(json_decode('{"type":"group","properties":{}}'));
        foreach (
            [
            [fn () => Generator::bindButtons((object) ['kind' => 'other']), 'Unsupported form template'],
            [fn () => Generator::bindButtons($template, [], ['language' => 1]), 'Language must be a string'],
            ] as [$call, $message]
        ) {
            try {
                $call();
                self::fail('Expected a form error');
            } catch (FormError $error) {
                self::assertSame('INVALID_FORM_INPUT', $error->getErrorCode());
                self::assertSame($message, $error->getMessage());
            }
        }
    }

    public static function invalidButtons(): iterable
    {
        yield 'not an object' => ['[1]'];
        yield 'null element' => ['[null]'];
        yield 'list element' => ['[[]]'];
        yield 'missing tag' => ['[{"text":"A","attrs":{}}]'];
        yield 'unknown tag' => ['[{"tag":"div","text":"A","attrs":{}}]'];
        yield 'text not a string' => ['[{"tag":"a","text":1,"attrs":{}}]'];
        yield 'missing attrs' => ['[{"tag":"a","text":"A"}]'];
        yield 'attrs a list' => ['[{"tag":"a","text":"A","attrs":[]}]'];
        yield 'unknown attribute' => ['[{"tag":"a","text":"A","attrs":{"id":"x"}}]'];
        yield 'attribute not a string' => ['[{"tag":"button","text":"A","attrs":{"type":1}}]'];
        yield 'valid then invalid' => ['[{"tag":"a","text":"A","attrs":{}},{"tag":"a"}]'];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('invalidButtons')]
    public function testFormButtonsHtmlRejectsUnevaluatedButtons(string $buttons): void
    {
        $this->expectFormError(
            fn () => Generator::formButtonsHtml(json_decode($buttons)),
            'Form buttons must be evaluated button objects'
        );
    }

    public function testFormButtonsHtmlRequiresAList(): void
    {
        $this->expectFormError(
            fn () => Generator::formButtonsHtml(['a' => json_decode('{"tag":"a","text":"A","attrs":{}}')]),
            'Form buttons must be a list'
        );
    }

    public function testFormButtonsHtmlIgnoresOtherMembers(): void
    {
        self::assertSame(
            '<a>A</a>',
            Generator::formButtonsHtml(json_decode('[{"type":1,"extra":[],"tag":"a","text":"A","attrs":{}}]'))
        );
    }

    private function expectFormError(callable $call, string $message): void
    {
        try {
            $call();
            self::fail('Expected a form error');
        } catch (FormError $error) {
            self::assertSame(
                ['INVALID_FORM_INPUT', $message, ''],
                [$error->getErrorCode(), $error->getMessage(), $error->getPath()]
            );
        }
    }
}
