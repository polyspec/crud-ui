<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;

/**
 * The interface messages that the PHP generator embeds equal contracts/interface-messages.json (CUMK-065): the
 * form table of every language that the contract defines is the table that `Form::getMessages()` returns for that
 * language. The test uses only the public API of the library (Generator and Form), so the same file runs against the
 * native PHP extension.
 */
final class InterfaceMessagesConformanceTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function languages(): array
    {
        $contract = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../../contracts/interface-messages.json'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
        $out = [];
        foreach (array_keys($contract['form']) as $language) {
            $out[$language] = [$language];
        }
        return $out;
    }

    /** The contract defines the same four languages as the generator; a language missing from either side fails here. */
    public function testContractLanguagesAreTheFourSupported(): void
    {
        self::assertSame(['ko', 'en', 'ja', 'zh'], array_keys(self::languages()));
    }

    #[DataProvider('languages')]
    public function testEmbeddedMessagesEqualsTheContract(string $language): void
    {
        $contract = json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../../contracts/interface-messages.json'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
        $form = new Form(
            Generator::compileForm(json_decode('{"type":"group","properties":{"a":{"type":"text"}}}')),
            [],
            ['language' => $language]
        );
        self::assertEquals($contract['form'][$language], $form->getMessages(), $language);
    }
}
