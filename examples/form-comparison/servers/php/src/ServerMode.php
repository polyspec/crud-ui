<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison;

use RuntimeException;

/**
 * The PHP server mode of the form comparison: FORM_PHP_SERVER names php or php-ext. Both modes read JSON through the
 * extension polyspec_json; in php-ext the CRUDUI extension is loaded as well.
 */
final class ServerMode
{
    /** The selected server, php or php-ext, after requiring the extensions it names. */
    public static function current(): string
    {
        $mode = getenv('FORM_PHP_SERVER') ?: 'php';
        if (!in_array($mode, ['php', 'php-ext'], true)) {
            throw new RuntimeException('Unknown PHP server mode');
        }
        if (!extension_loaded('polyspec_json')) {
            throw new RuntimeException('The JSON extension polyspec_json is not loaded');
        }
        if (extension_loaded('polyspec_crudui') !== ($mode === 'php-ext')) {
            throw new RuntimeException('CRUDUI extension state does not match the selected server');
        }
        return $mode;
    }
}
