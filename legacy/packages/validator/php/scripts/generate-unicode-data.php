<?php

/**
 * Generate src/Values/UnicodeData.php from contracts/unicode-properties.json.
 * make php-tables runs it before every target that reads legacy/packages/validator/php; the output is untracked (P34).
 *
 * Run: php legacy/packages/validator/php/scripts/generate-unicode-data.php
 */

declare(strict_types=1);

require dirname(__DIR__, 5) . '/scripts/generator-contract.php';

crudui_generate(
    dirname(__DIR__, 5),
    'unicode-properties',
    dirname(__DIR__) . '/src/Values/UnicodeData.php',
    $argv,
    static function (array $contract): string {
        /** Write ranges as a flat list of inclusive bounds, six ranges per line. */
        $crudui_ranges = static function (array $ranges, string $indent): string {
            $lines = [];
            foreach (array_chunk($ranges, 6) as $chunk) {
                $bounds = array_map(static fn (array $range) => sprintf('0x%X, 0x%X', $range[0], $range[1]), $chunk);
                $lines[] = $indent . '    ' . implode(', ', $bounds) . ',';
            }

            return "[\n" . implode("\n", $lines) . "\n" . $indent . ']';
        };

        /** Write a name => ranges map. */
        $crudui_table = static function (array $table) use ($crudui_ranges): string {
            $lines = [];
            foreach ($table as $name => $ranges) {
                $lines[] = '        ' . var_export((string) $name, true) . ' => '
                    . $crudui_ranges($ranges, '        ') . ',';
            }
            return "[\n" . implode("\n", $lines) . "\n    ]";
        };

        $version = $contract['unicodeVersion'];
        $source = <<<PHP
<?php

// Generated from contracts/unicode-properties.json (Unicode {$version}) by
// `php legacy/packages/validator/php/scripts/generate-unicode-data.php`. Do not edit.

declare(strict_types=1);

namespace Polyspec\\Crudui\\Validator\\Values;

/**
 * The Unicode data of the validation rules: inclusive code point ranges written as
 * flat lists of bounds (start, end, start, end, …).
 *
 * @internal
 */
final class UnicodeData
{
    /** Unicode version of the data. */
    public const VERSION = '{$version}';

    /** White_Space. */
    public const WHITE_SPACE = %s;

    /** General categories accepted by the pattern language, including one-letter unions. */
    public const GENERAL_CATEGORIES = %s;

    /** Scripts (the Script property) accepted by the pattern language. */
    public const SCRIPTS = %s;
}

PHP;
        $output = sprintf(
            $source,
            $crudui_ranges($contract['whiteSpace'], '    '),
            $crudui_table($contract['generalCategories']),
            $crudui_table($contract['scripts'])
        );
        return $output;
    }
);
