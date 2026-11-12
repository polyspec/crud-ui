<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison;

use Closure;
use InvalidArgumentException;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;
use Polyspec\Crudui\Validator;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;
use stdClass;

/** Generate current forms and verify the loaded PHP implementation. */
final class FormGeneration
{
    public const FRAME_ERROR = 'The frame document must contain one html start tag, one empty form view'
        . ' and one body end tag';

    private readonly array $generator;

    /**
     * Load the selected classes for one source identity: the commit and the digest of the
     * uncommitted changes, or null. The module digest is verified by the process that starts PHP.
     */
    public function __construct(
        string $runtime,
        string $sourceRoot,
        stdClass $source,
        ?string $verifiedModuleSha256,
    ) {
        if (!in_array($runtime, ['php', 'php-ext'], true)) {
            throw new RuntimeException('Unknown PHP generator runtime');
        }
        $native = $runtime === 'php-ext';
        if (extension_loaded('polyspec_crudui') !== $native) {
            throw new RuntimeException('CRUDUI extension state does not match the selected server');
        }
        $sourceRoot = self::regularDirectory($sourceRoot, 'library directory');
        if (
            array_keys(get_object_vars($source)) !== ['commit', 'changes']
            || !is_string($source->commit) || !preg_match('/^[a-f0-9]{40}$/D', $source->commit)
            || !(
                $source->changes === null
                || (is_string($source->changes) && preg_match('/^[a-f0-9]{64}$/D', $source->changes))
            )
        ) {
            throw new RuntimeException('Invalid source identity');
        }
        if ($native) {
            self::assertNativeClasses();
        }
        $classes = [];
        $signatures = [];
        $sourceFiles = [
            Generator::class => ['source' => 'legacy/packages/generator/php/src/Generator.php'],
            Form::class => ['source' => 'legacy/packages/generator/php/src/Form.php'],
            Validator::class => ['source' => 'legacy/packages/validator/php/src/Public/Validator.php'],
        ];
        foreach ($sourceFiles as $name => $files) {
            $class = new ReflectionClass($name);
            $extension = $native ? 'polyspec_crudui' : false;
            if ($class->isInternal() !== $native || $class->getExtensionName() !== $extension) {
                throw new RuntimeException('Incorrect CRUDUI implementation: ' . $name);
            }
            if (!$native) {
                self::verifyPhpClassSource($name, $class, $sourceRoot, $files);
            }
            $classes[$name] = [
                'internal' => $class->isInternal(),
                'extension' => $class->getExtensionName() ?: null,
                'file' => $class->getFileName() ?: null,
            ];
            $signatures[$name] = self::signature($class);
        }
        $moduleHash = null;
        if ($native) {
            if ($verifiedModuleSha256 === null || !preg_match('/^[a-f0-9]{64}$/D', $verifiedModuleSha256)) {
                throw new RuntimeException('A verified CRUDUI module hash is required');
            }
            $moduleHash = $verifiedModuleSha256;
        } elseif ($verifiedModuleSha256 !== null) {
            throw new RuntimeException('Pure PHP must not declare a CRUDUI module hash');
        }
        $this->generator = [
            'runtime' => $runtime,
            'source' => (object) ['commit' => $source->commit, 'changes' => $source->changes],
            'nativeCRUDUI' => $native,
            'moduleSha256' => $moduleHash,
            'classes' => (object) $classes,
            'signatures' => (object) $signatures,
        ];
    }

    /** Return verified implementation and source metadata. */
    public function provenance(): array
    {
        return $this->generator;
    }

    /** Compile a structure without reading record data. */
    public function compile(stdClass $request): array
    {
        $spec = self::object($request->spec ?? null, 'spec');
        return [
            'template' => Generator::compileForm($spec, self::options($request)),
            'generator' => $this->generator,
            'referenceReads' => null,
        ];
    }

    /** Bind a supplied cached template and return its complete state and HTML. */
    public function render(stdClass $request): array
    {
        $form = new Form(
            self::object($request->template ?? null, 'template'),
            self::object($request->data ?? null, 'data'),
            self::options($request)
        );
        return [
            'data' => $form->getData(),
            'fields' => $form->getFields(),
            'html' => Generator::renderForm($form),
            'revision' => $form->getRevision(),
            'generator' => $this->generator,
        ];
    }

    /**
     * Render a stored record into the built SSR frame document.
     * The ordered JSON encoder is supplied by the server so this class stays free of file access.
     */
    public function ssrFrame(
        string $frame,
        stdClass $spec,
        array|stdClass $data,
        string $language,
        Closure $encodeJson
    ): string {
        if (!in_array($language, ['ko', 'en'], true)) {
            throw new InvalidArgumentException('Expected language ko or en');
        }
        foreach (['<html>', '<div id="form-view"></div>', '</body>'] as $marker) {
            if (substr_count($frame, $marker) !== 1) {
                throw new RuntimeException(self::FRAME_ERROR);
            }
        }
        $form = new Form(Generator::compileForm($spec, ['keyPrefix' => 'form']), $data, ['language' => $language]);
        $unsafe = ['<', '>', '&'];
        $escapes = array_map(
            static fn(string $character): string => sprintf('%su%04x', chr(92), ord($character)),
            $unsafe
        );
        $payload = str_replace(
            $unsafe,
            $escapes,
            $encodeJson(['data' => $form->getData(), 'generator' => $this->generator])
        );
        $replacements = [
            '<html>' => '<html lang="' . $language . '">',
            '<div id="form-view"></div>' => '<div id="form-view">' . Generator::renderForm($form) . '</div>',
            '</body>' => '<script type="application/json" id="crudui-ssr">' . $payload . '</script></body>',
        ];
        // Splice from the end so generated text is never searched for markers.
        $positions = array_map(static fn(string $marker): int => strpos($frame, $marker), array_keys($replacements));
        arsort($positions);
        foreach ($positions as $index => $position) {
            $marker = array_keys($replacements)[$index];
            $frame = substr($frame, 0, $position) . $replacements[$marker]
                . substr($frame, $position + strlen($marker));
        }
        return $frame;
    }

    private static function object(mixed $value, string $name): stdClass
    {
        if (!$value instanceof stdClass) {
            throw new InvalidArgumentException('Expected ' . $name . ' object');
        }
        return $value;
    }

    private static function options(stdClass $request): array
    {
        return property_exists($request, 'options') ? (array) self::object($request->options, 'options') : [];
    }

    /** Return the public methods declared by one common API class. */
    private static function signature(ReflectionClass $class): array
    {
        $methods = [];
        foreach ($class->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->getDeclaringClass()->getName() !== $class->getName()) {
                continue;
            }
            $parameters = [];
            foreach ($method->getParameters() as $parameter) {
                $parameters[] = [
                    'name' => $parameter->getName(),
                    'type' => (string) $parameter->getType(),
                    'reference' => $parameter->isPassedByReference(),
                    'variadic' => $parameter->isVariadic(),
                    'optional' => $parameter->isOptional(),
                    'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
                ];
            }
            $methods[$method->getName()] = [
                'static' => $method->isStatic(),
                'parameters' => $parameters,
                'return' => (string) $method->getReturnType(),
            ];
        }
        ksort($methods);
        return $methods;
    }

    /**
     * Require that every declared class under Polyspec\Crudui\, other than those of the form comparison, is internal
     * to the crudui extension, so the PHP extension process never runs a class of the PHP library
     * (docs/operations/form-comparison.md, "Implementations and requests").
     */
    public static function assertNativeClasses(): void
    {
        foreach (get_declared_classes() as $name) {
            if (
                str_starts_with($name, 'Polyspec\\Crudui\\')
                && !str_starts_with($name, 'Polyspec\\Crudui\\FormComparison\\')
                && !(new ReflectionClass($name))->isInternal()
            ) {
                throw new RuntimeException(
                    'A CRUDUI class loaded from PHP source in the PHP extension process: ' . $name
                );
            }
        }
    }

    /** Verify that one PHP class loaded from its declared source file in the candidate. */
    private static function verifyPhpClassSource(
        string $name,
        ReflectionClass $class,
        string $sourceRoot,
        array $files,
    ): void {
        $sourceFile = self::regularFile($sourceRoot . '/' . $files['source'], 'candidate source file');
        $classFile = $class->getFileName();
        if (!is_string($classFile) || self::regularFile($classFile, 'loaded class file') !== $sourceFile) {
            throw new RuntimeException('Incorrect CRUDUI source file: ' . $name);
        }
    }

    /** Return an absolute regular file without symbolic path components. */
    private static function regularFile(string $path, string $name): string
    {
        $resolved = self::regularPath($path, $name);
        $status = lstat($resolved);
        if ($status === false || ($status['mode'] & 0170000) !== 0100000) {
            throw new RuntimeException('Expected regular ' . $name);
        }
        return $resolved;
    }

    /** Return an absolute regular directory without symbolic path components. */
    private static function regularDirectory(string $path, string $name): string
    {
        $resolved = self::regularPath($path, $name);
        $status = lstat($resolved);
        if ($status === false || ($status['mode'] & 0170000) !== 0040000) {
            throw new RuntimeException('Expected regular ' . $name);
        }
        return $resolved;
    }

    /** Resolve one absolute path after rejecting missing and symbolic components. */
    private static function regularPath(string $path, string $name): string
    {
        if (!str_starts_with($path, '/')) {
            throw new RuntimeException('Expected absolute ' . $name);
        }
        $current = '/';
        foreach (explode('/', substr($path, 1)) as $component) {
            if ($component === '' || $component === '.') {
                continue;
            }
            if ($component === '..') {
                $current = dirname($current);
                continue;
            }
            $current = $current === '/' ? '/' . $component : $current . '/' . $component;
            $status = lstat($current);
            if ($status === false) {
                throw new RuntimeException('Missing ' . $name);
            }
            if (($status['mode'] & 0170000) === 0120000) {
                throw new RuntimeException('Symbolic links are not allowed in ' . $name);
            }
        }
        $resolved = realpath($path);
        if ($resolved === false) {
            throw new RuntimeException('Cannot resolve ' . $name);
        }
        return $resolved;
    }
}
