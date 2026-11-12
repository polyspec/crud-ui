<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison\Tests;

use DOMDocument;
use DOMXPath;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Polyspec\CruduiTestSupport\PhpProcess;
use Polyspec\Crudui\FormComparison\FormGeneration;
use Polyspec\Crudui\FormComparison\FormJson;
use Polyspec\Crudui\FormComparison\ServerMode;
use RuntimeException;
use stdClass;

/** FormGeneration compiles, renders, validates and serves the SSR frame with the provenance of the selected implementation. */
final class FormGenerationTest extends TestCase
{
    public function testCompilesRendersValidatesAndServesFrames(): void
    {
        $sourceRoot = self::sourceRoot();
        $runtime = ServerMode::current();
        $moduleFile = $runtime === 'php-ext' ? self::cruduiModule() : null;
        $moduleSha256 = $moduleFile === null ? null : hash_file('sha256', $moduleFile);
        $source = (object) ['commit' => str_repeat('a', 40), 'changes' => str_repeat('b', 64)];
        $generation = new FormGeneration($runtime, $sourceRoot, $source, $moduleSha256);
        $provenance = $generation->provenance();
        self::assertTrue(
            $provenance['runtime'] === $runtime && $provenance['nativeCRUDUI'] === ($runtime === 'php-ext'),
            'Runtime provenance must match the loaded classes'
        );
        self::assertSameJson($source, $provenance['source'], 'The source identity must be retained');
        self::assertTrue(
            count(get_object_vars($provenance['classes'])) === 3,
            'Generation, form state and validation need independent provenance'
        );
        foreach ($provenance['classes'] as $class) {
            self::assertTrue(
                $class['internal'] === ($runtime === 'php-ext')
                    && $class['extension'] === ($runtime === 'php-ext' ? 'polyspec_crudui' : null),
                'Incorrect class implementation'
            );
        }
        self::assertTrue(
            $runtime === 'php-ext'
                ? $provenance['moduleSha256'] === hash_file('sha256', $moduleFile)
                : $provenance['moduleSha256'] === null,
            'Module hash must describe the selected implementation'
        );
        self::assertSameJson(
            self::pureSignatures($sourceRoot, $source),
            $provenance['signatures'],
            'Public PHP and extension signatures must match'
        );

        $spec = json_decode('{"type":"group","properties":{"$ref":"companies.json"}}');
        $files = json_decode(
            '{"companies.json":{"properties":{"companies":{"type":"group","multiple":true,"properties":{'
            . '"name":{"type":"text","label":"Company","validate":{"required":true}},'
            . '"stores":{"type":"group","multiple":true,"properties":{"name":{"type":"text","label":"Store"}}}}}}}}'
        );
        $compiled = $generation->compile((object) [
            'spec' => $spec,
            'options' => (object) ['keyPrefix' => 'form', 'files' => $files],
        ]);
        $cached = json_encode($compiled['template'], JSON_THROW_ON_ERROR);
        self::assertSameJson($provenance, $compiled['generator'], 'Compilation must include provenance');
        self::assertTrue(
            array_key_exists('referenceReads', $compiled) && $compiled['referenceReads'] === null,
            'PHP compilation must report unavailable loader instrumentation as null'
        );
        $data = json_decode(
            '{"companies":{"__0000000000005__":{"name":"Five","stores":{}},'
            . '"__0000000000007__":{"name":"Seven","stores":{"__0000000000042__":{"name":"Store"}}},'
            . '"__0000000000001__":{"name":"One","stores":{}}}}'
        );
        $rendered = $generation->render((object) [
            'template' => json_decode($cached),
            'data' => $data,
            'options' => (object) ['language' => 'en'],
        ]);
        self::assertSameJson(
            $data,
            $rendered['data'],
            'Rendering must retain row order and explicit empty collections'
        );
        self::assertTrue($rendered['revision'] === 0, 'Initial rendering must start at revision zero');
        self::assertTrue(
            str_contains(
                $rendered['html'],
                'name="form[companies][__0000000000007__][stores][__0000000000042__][name]"'
            ),
            'Rendering must produce native nested control names'
        );
        self::assertSameJson($provenance, $rendered['generator'], 'Rendering must include provenance');
        $injected = new \Polyspec\Crudui\Form(
            json_decode($cached),
            ['companies' => new stdClass()],
            ['language' => 'en']
        );
        foreach ([1, 2] as $pass) {
            $injected->setData($data);
            self::assertSameJson($rendered['data'], $injected->getData(), 'Injection must retain original data');
            self::assertSameJson(
                $rendered['fields'],
                $injected->getFields(),
                'Injection must produce identical complete models'
            );
            self::assertSameJson(
                $rendered['html'],
                \Polyspec\Crudui\Generator::renderForm($injected),
                'Injection must produce identical HTML'
            );
        }
        self::assertSameJson(
            (object) ['valid' => true, 'errors' => [], 'hidden' => []],
            \Polyspec\Crudui\Validator::validate($spec, $data, ['files' => $files]),
            'Public validation must accept valid data'
        );
        $invalid = json_decode(json_encode($data, JSON_THROW_ON_ERROR));
        $invalid->companies->__0000000000005__->name = '';
        self::assertTrue(
            \Polyspec\Crudui\Validator::validate($spec, $invalid, ['files' => $files])->valid === false,
            'Public validation must reject missing required values'
        );

        foreach ([(object) ['spec' => []], (object) ['spec' => $spec, 'options' => null]] as $request) {
            $rejected = false;
            try {
                $generation->compile($request);
            } catch (InvalidArgumentException) {
                $rejected = true;
            }
            self::assertTrue($rejected, 'Compile must reject incorrect JSON object types');
        }
        $malformedRequests = [
            (object) ['template' => [] , 'data' => $data],
            (object) ['template' => json_decode($cached), 'data' => []],
            (object) ['template' => json_decode($cached), 'data' => $data, 'options' => []],
        ];
        foreach ($malformedRequests as $request) {
            $rejected = false;
            try {
                $generation->render($request);
            } catch (InvalidArgumentException) {
                $rejected = true;
            }
            self::assertTrue($rejected, 'Render must reject incorrect JSON object types');
        }

        // The comparison spec declares the native completion marker as its one submit button.
        $resolved = (object) ['type' => 'group', 'properties' => $files->{'companies.json'}->properties,
            'buttons' => json_decode(
                '[{"type":"submit","name":"_form_complete","value":"1","text":{"en":"Save","ko":"저장"}}]'
            )];
        // Text that could end the payload script early must not appear raw inside it.
        $ssrData = json_decode(json_encode($data, JSON_THROW_ON_ERROR));
        $ssrData->companies->__0000000000007__->stores->__0000000000042__->name = '</script><b>Store & Co</b>';
        $frameHead = '<!doctype html>';
        $frameMiddle = '<head><title>Frame</title><script type="module" src="/frame.js"></script></head><body><main>';
        $frame = $frameHead . '<html>' . $frameMiddle . '<div id="form-view"></div></main></body></html>';
        $payloadPattern = '#<script type="application/json" id="crudui-ssr">(.*?)</script></body></html>$#sD';
        foreach (['ko', 'en'] as $language) {
            $html = $generation->ssrFrame($frame, $resolved, $ssrData, $language, FormJson::encode(...));
            $expected = $generation->render((object) [
                'template' => json_decode(json_encode(
                    \Polyspec\Crudui\Generator::compileForm($resolved, ['keyPrefix' => 'form']),
                    JSON_THROW_ON_ERROR
                )),
                'data' => $ssrData,
                'options' => (object) ['language' => $language],
            ]);
            self::assertTrue(substr_count($html, '<div id="form-view">') === 1, 'SSR must keep one form view');
            $viewStart = strpos($html, '<div id="form-view">') + strlen('<div id="form-view">');
            $viewEnd = strpos($html, '</div></main>', $viewStart);
            self::assertTrue(
                $viewEnd !== false && substr($html, $viewStart, $viewEnd - $viewStart) === $expected['html'],
                'The SSR form view must contain exactly the public renderer HTML'
            );
            self::assertTrue(
                preg_match($payloadPattern, $html, $payloadMatch) === 1,
                'SSR must insert the payload script immediately before the closing body tag'
            );
            $payload = $payloadMatch[1];
            self::assertTrue(
                substr_count($html, '<html') === 1 && str_contains($html, '<html lang="' . $language . '">'),
                'SSR must write the html lang attribute once'
            );
            self::assertTrue(
                $html === $frameHead . '<html lang="' . $language . '">' . $frameMiddle
                    . '<div id="form-view">' . $expected['html'] . '</div></main>'
                    . '<script type="application/json" id="crudui-ssr">' . $payload . '</script></body></html>',
                'SSR must otherwise preserve the frame template'
            );
            self::assertTrue(
                !str_contains($payload, '<') && !str_contains($payload, '>') && !str_contains($payload, '&'),
                'The SSR payload must escape <, > and &'
            );
            $decoded = json_decode($payload, false, 512, JSON_THROW_ON_ERROR);
            self::assertSameJson(
                ['data', 'generator'],
                array_keys(get_object_vars($decoded)),
                'The SSR payload must contain data and generator in order'
            );
            self::assertSameJson(
                $expected['data'],
                $decoded->data,
                'The SSR payload data must match the render result'
            );
            // The payload is decoded as objects: associative decoding turns an empty object default such as {} into [].
            self::assertSameJson(
                $expected['generator'],
                $decoded->generator,
                'The SSR payload provenance must match the render result'
            );
            $document = new DOMDocument();
            $errors = libxml_use_internal_errors(true);
            try {
                $document->loadHTML($html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            } finally {
                libxml_clear_errors();
                libxml_use_internal_errors($errors);
            }
            $xpath = new DOMXPath($document);
            self::assertTrue(
                $xpath->query(
                    '//div[@id="form-view"]//input'
                    . '[@name="form[companies][__0000000000007__][stores][__0000000000042__][name]"]'
                )->length === 1,
                'SSR controls must exist before JavaScript'
            );
            self::assertTrue(
                $xpath->query('//div[@id="form-view"]//input[@type="hidden"]')->length === 0,
                'SSR must not add hidden identity controls'
            );
            self::assertTrue(
                $xpath->query('//div[@id="form-view"]//button[@type="submit"]')->length === 1
                    && $xpath->query(
                        '//div[@id="form-view"]//button[@type="submit" and @name="_form_complete" and @value="1"]'
                    )->length === 1,
                'The one submit button, declared by the spec, must provide the native request completion marker'
            );
            self::assertTrue(
                $xpath->query('//script[@id="crudui-ssr"]')->length === 1,
                'SSR must write one payload script'
            );
        }
        $view = '<div id="form-view"></div>';
        foreach (
            [
            '<body>' . $view . '</body>',
            '<html><html><body>' . $view . '</body>',
            '<html><body></body>',
            '<html><body>' . $view . $view . '</body>',
            '<html><body><div id="form-view"> </div></body>',
            '<html><body>' . $view,
            '<html><body>' . $view . '</body></body>',
            ] as $invalidFrame
        ) {
            $rejected = false;
            try {
                $generation->ssrFrame($invalidFrame, $resolved, $data, 'en', FormJson::encode(...));
            } catch (RuntimeException $error) {
                $rejected = $error->getMessage()
                    === 'The frame document must contain one html start tag, one empty form view'
                    . ' and one body end tag';
            }
            self::assertTrue(
                $rejected,
                'SSR must reject a frame without exactly one html start tag, empty form view and body end tag'
            );
        }
    }


    public function testConstructsWithTheSourceIdentityWithoutDeploymentFiles(): void
    {
        $source = self::source();
        $generation = new FormGeneration(ServerMode::current(), self::sourceRoot(), $source, self::moduleSha256());
        self::assertSameJson($source, $generation->provenance()['source'], 'The source identity must be retained');
        $code = (string) file_get_contents(dirname(__DIR__) . '/src/FormGeneration.php');
        self::assertDoesNotMatchRegularExpression('/hash_file\\s*\\(/', $code);
        self::assertDoesNotMatchRegularExpression('/file_get_contents\\s*\\(\\s*\\$[^)]*(archive|module)/i', $code);
    }

    public function testLoadsTheValidatorFromItsSourceDirectory(): void
    {
        // The PHP library is constructed in a child process without the extensions, so the case is the same in
        // both modes.
        $file = PhpProcess::run([], sprintf(
            'echo json_encode((new %s("php", %s, json_decode(%s), null))->provenance()["classes"]'
                . '->{"Polyspec\\\\Crudui\\\\Validator"}["file"], JSON_THROW_ON_ERROR);',
            '\\' . FormGeneration::class,
            var_export(self::sourceRoot(), true),
            var_export(json_encode(self::source(), JSON_THROW_ON_ERROR), true),
        ), ['FORM_PHP_SERVER' => 'php'])->json();
        self::assertSame(self::sourceRoot() . '/legacy/packages/validator/php/src/Public/Validator.php', $file);
    }

    /** @return iterable<string, array{string, stdClass, ?string, string}> */
    public static function rejectedConstructions(): iterable
    {
        $commit = str_repeat('a', 40);
        yield 'commit only' => ['php', (object) ['commit' => $commit], null, 'Invalid source identity'];
        yield 'changes not a digest' => [
            'php', (object) ['commit' => $commit, 'changes' => 'changed'], null, 'Invalid source identity',
        ];
        yield 'commit not a hash' => [
            'php', (object) ['commit' => 'HEAD', 'changes' => null], null, 'Invalid source identity',
        ];
        yield 'members out of order' => [
            'php', (object) ['changes' => null, 'commit' => $commit], null, 'Invalid source identity',
        ];
        yield 'pure module hash' => [
            'php', (object) ['commit' => $commit, 'changes' => null], str_repeat('c', 64),
            'must not declare a CRUDUI module hash',
        ];
    }

    #[DataProvider('rejectedConstructions')]
    public function testRejectsAnIncorrectConstruction(
        string $runtime,
        stdClass $source,
        ?string $moduleSha256,
        string $message
    ): void {
        // The cases construct the php runtime in a child process without the extensions, as in both modes.
        $reported = PhpProcess::run([], sprintf(
            'try { new %s(%s, %s, json_decode(%s), %s); echo json_encode(null); }'
                . ' catch (\\RuntimeException $error) { echo json_encode($error->getMessage()); }',
            '\\' . FormGeneration::class,
            var_export($runtime, true),
            var_export(self::sourceRoot(), true),
            var_export(json_encode($source, JSON_THROW_ON_ERROR), true),
            var_export($moduleSha256, true),
        ), ['FORM_PHP_SERVER' => 'php'])->json();
        self::assertIsString($reported, 'The construction must be rejected');
        self::assertStringContainsString($message, $reported);
    }

    // 500 constructors end within a second; constructors that did deployment-size work, such as reading the library
    // tree, would not. The test reads no clock: the time limit of the run fails such a constructor.
    public function testConstructsRequestGeneratorsWithoutDeploymentSizeWork(): void
    {
        for ($index = 0; $index < 500; $index++) {
            new FormGeneration(ServerMode::current(), self::sourceRoot(), self::source(), self::moduleSha256());
        }
        $this->addToAssertionCount(1);
    }

    /** The checkout that holds the comparison and the CRUDUI sources. */
    private static function sourceRoot(): string
    {
        return dirname(__DIR__, 5);
    }

    private static function source(): stdClass
    {
        return (object) ['commit' => str_repeat('a', 40), 'changes' => str_repeat('b', 64)];
    }

    /** The crudui module of the php-ext run, named by FORM_CRUDUI_MODULE. */
    private static function cruduiModule(): string
    {
        $module = getenv('FORM_CRUDUI_MODULE');
        if (!is_string($module) || !str_starts_with($module, '/') || !is_file($module)) {
            throw new RuntimeException('FORM_CRUDUI_MODULE must name the absolute crudui module of the php-ext run');
        }
        return $module;
    }

    private static function moduleSha256(): ?string
    {
        return ServerMode::current() === 'php-ext' ? hash_file('sha256', self::cruduiModule()) : null;
    }

    /**
     * The public signatures of the PHP library, which a child PHP process without the extensions reports, so the
     * extension of a php-ext run is compared with them.
     */
    private static function pureSignatures(string $sourceRoot, stdClass $source): mixed
    {
        return PhpProcess::run([], sprintf(
            'echo json_encode((new %s("php", %s, json_decode(%s), null))->provenance()["signatures"],'
                . ' JSON_THROW_ON_ERROR);',
            '\\' . FormGeneration::class,
            var_export($sourceRoot, true),
            var_export(json_encode($source, JSON_THROW_ON_ERROR), true),
        ), ['FORM_PHP_SERVER' => 'php'])->json();
    }

    /** Assert that two values have the same JSON text, which keeps object member order. */
    private static function assertSameJson(mixed $expected, mixed $actual, string $message): void
    {
        self::assertSame(
            json_encode($expected, JSON_THROW_ON_ERROR),
            json_encode($actual, JSON_THROW_ON_ERROR),
            $message
        );
    }
}
