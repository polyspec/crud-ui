<?php

/**
 * Check documentation and source provenance for both public PHP packages with
 * Polyspec\Crudui\Docs\DocCoverage, which the development root vendor/ loads.
 */

declare(strict_types=1);

use Polyspec\Crudui\Docs\DocCoverage;

require __DIR__ . '/../vendor/autoload.php';

$failed = false;
foreach (['legacy/packages/validator/php', 'legacy/packages/generator/php'] as $package) {
    try {
        $directory = realpath(__DIR__ . '/../' . $package . '/src');
        if ($directory === false) {
            throw new RuntimeException('Source directory is missing: ' . $package);
        }
        $gaps = DocCoverage::gaps($directory);
        if ($gaps !== []) {
            throw new RuntimeException(implode("\n  ", $gaps));
        }
        fwrite(STDOUT, '[php-doc-coverage] ' . $package . ": PASS\n");
    } catch (Throwable $error) {
        $failed = true;
        fwrite(STDERR, '[php-doc-coverage] ' . $package . ': FAIL: ' . $error->getMessage() . "\n");
    }
}
exit($failed ? 1 : 0);
