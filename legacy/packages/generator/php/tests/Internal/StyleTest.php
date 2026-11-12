<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests\Internal;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Generator\Style;

final class StyleTest extends TestCase
{
    public function testCssPreservesQuotedSeparatorsCommentsNestedBlocksAndRepeatedProperties(): void
    {
        $source = ' color /* property */ : red; content: "a;b:c"; background: url("data:image/svg+xml;a:b");'
            . ' --tokens: {a:[b;c]}; color: blue !important; tail: calc(1px + var(--x, 2px));';
        self::assertSame(
            [
                ['color', 'red'],
                ['content', '"a;b:c"'],
                ['background', 'url("data:image/svg+xml;a:b")'],
                ['--tokens', '{a:[b;c]}'],
                ['color', 'blue !important'],
                ['tail', 'calc(1px + var(--x, 2px))'],
            ],
            Style::declarations($source)
        );
        self::assertSame(
            'color:blue !important;content:"a;b:c";background:url("data:image/svg+xml;a:b");--tokens:{a:[b;c]};'
                . 'tail:calc(1px + var(--x, 2px))',
            Style::rendered($source)
        );
        self::assertSame([['content', '"unterminated; text']], Style::declarations('content: "unterminated; text'));
        self::assertSame([['--x', '(a]; b:c)'], ['color', 'red']], Style::declarations('--x: (a]; b:c); color:red'));
    }
}
