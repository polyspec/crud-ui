<?php

declare(strict_types=1);

namespace Polyspec\CruduiTestSupport;

use RuntimeException;

/**
 * One child PHP process of a test: `php -n` with the JSON extension module that POLYSPEC_JSON_MODULE names, the
 * extension modules a test names and one script, by default after the mbstring and dom extensions that the binary
 * builds as shared modules and the Composer autoloader of the checkout.
 * The PHP tests of the form comparison and of the PHP extension start their processes with it.
 * Its namespace lies outside Polyspec\Crudui\: a php-ext run of the form comparison requires every class under that
 * namespace but its own to be internal to the crudui extension, and the PHPUnit process of that run loads this class.
 */
final class PhpProcess
{
    private function __construct(
        public readonly int $status,
        public readonly string $stdout,
        public readonly string $stderr,
    ) {
    }

    /**
     * Run `$script` in a child process with the JSON extension, the extension modules `$modules` and the environment
     * variables `$environment` added to those of this process; with `$libraries`, after mbstring, dom and the
     * autoloader.
     *
     * @param list<string> $modules Absolute paths of extension modules.
     * @param array<string, string> $environment
     */
    public static function run(
        array $modules,
        string $script,
        array $environment = [],
        bool $libraries = true,
    ): self {
        $arguments = [PHP_BINARY, '-n'];
        foreach ($libraries ? ['mbstring', 'dom'] : [] as $name) {
            if (!self::builtIn($name)) {
                array_push($arguments, '-d', 'extension=' . $name);
            }
        }
        $json = $environment['POLYSPEC_JSON_MODULE'] ?? getenv('POLYSPEC_JSON_MODULE');
        if (!is_string($json) || !str_starts_with($json, '/') || !is_file($json)) {
            throw new RuntimeException('POLYSPEC_JSON_MODULE must name the absolute polyspec_json extension module');
        }
        foreach ([$json, ...$modules] as $module) {
            array_push($arguments, '-d', 'extension=' . $module);
        }
        $cruduiModule = $environment['FORM_CRUDUI_MODULE'] ?? getenv('FORM_CRUDUI_MODULE');
        $cruduiPath = is_string($cruduiModule) ? realpath($cruduiModule) : false;
        $nativeCrudui = $cruduiPath !== false && in_array($cruduiPath, array_map(realpath(...), $modules), true);
        if ($libraries && $nativeCrudui) {
            $autoload = $environment['FORM_PHP_NATIVE_AUTOLOAD'] ?? getenv('FORM_PHP_NATIVE_AUTOLOAD');
            if (!is_string($autoload) || $autoload === '') {
                throw new RuntimeException(
                    'FORM_PHP_NATIVE_AUTOLOAD must name the native application Composer autoloader'
                );
            }
        } else {
            $autoload = $environment['FORM_PHP_AUTOLOAD'] ?? dirname(__DIR__, 2) . '/vendor/autoload.php';
        }
        if ($libraries && ($autoload === '' || !is_file($autoload))) {
            throw new RuntimeException('FORM_PHP_AUTOLOAD must name an existing Composer autoloader: ' . $autoload);
        }
        if ($libraries) {
            $environment['FORM_PHP_AUTOLOAD'] = $autoload;
        }
        $prefix = $libraries ? 'require ' . var_export($autoload, true) . ';' : '';
        array_push($arguments, '-r', $prefix . $script);
        $pipes = [];
        $process = proc_open($arguments, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, [
            ...getenv(),
            ...$environment,
        ]);
        if ($process === false) {
            throw new RuntimeException('Cannot start ' . PHP_BINARY);
        }
        $stdout = (string) stream_get_contents($pipes[1]);
        $stderr = (string) stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        return new self(proc_close($process), $stdout, $stderr);
    }

    /** The JSON value that the process wrote, which requires that it ended with status 0. */
    public function json(): mixed
    {
        if ($this->status !== 0) {
            throw new RuntimeException("The child PHP process ended with $this->status: $this->stderr$this->stdout");
        }
        return json_decode($this->stdout, false, 512, JSON_THROW_ON_ERROR);
    }

    /** Whether `php -n` has the extension `$name` without loading a module. */
    private static function builtIn(string $name): bool
    {
        $script = 'exit(extension_loaded(' . var_export($name, true) . ') ? 0 : 1);';
        return self::exitCode([PHP_BINARY, '-n', '-r', $script]) === 0;
    }

    /** @param list<string> $arguments */
    private static function exitCode(array $arguments): int
    {
        $process = proc_open($arguments, [], $pipes);
        if ($process === false) {
            throw new RuntimeException('Cannot start ' . PHP_BINARY);
        }
        return proc_close($process);
    }
}
