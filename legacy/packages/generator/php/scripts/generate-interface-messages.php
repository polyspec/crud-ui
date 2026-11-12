<?php

/**
 * Generate src/Internal/InterfaceMessages.php from contracts/interface-messages.json.
 * make php-tables runs it before every target that reads legacy/packages/generator/php; the output is untracked (P34).
 *
 * Run: php legacy/packages/generator/php/scripts/generate-interface-messages.php
 */

declare(strict_types=1);

require dirname(__DIR__, 5) . '/scripts/generator-contract.php';

crudui_generate(
    dirname(__DIR__, 5),
    'interface-messages',
    dirname(__DIR__) . '/src/Internal/InterfaceMessages.php',
    $argv,
    static function (array $contract): string {
        /**
         * Write a language table as a PHP array, one message on each line, so no line exceeds the PSR-12 limit:
         * a message that would pass 120 characters after its key starts on the next line.
         */
        $crudui_language_table = static function (array $messages): string {
            $lines = [];
            foreach ($messages as $key => $message) {
                $name = '            ' . var_export($key, true) . ' =>';
                $text = var_export($message, true) . ',';
                $lines[] = mb_strlen("{$name} {$text}") <= 120 ? "{$name} {$text}" : "{$name}\n                {$text}";
            }

            return "\n" . implode("\n", $lines) . "\n        ";
        };

        $form = $contract['form'];
        $list = $contract['list'];

        $source = <<<'PHP'
<?php

// Generated from contracts/interface-messages.json by
// `php legacy/packages/generator/php/scripts/generate-interface-messages.php`. Do not edit.

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

/**
 * Interface message tables for all supported languages (ko, en, ja, zh).
 * Each table maps message keys to localized text strings.
 *
 * @internal
 */
final class InterfaceMessages
{
    /**
     * All interface messages for all supported languages.
     * Structure: language => [key => message]
     * @var array<string, array<string, string>>
     */
    public const MESSAGES = [
PHP;
        $source .= "\n";

        foreach ($form as $lang => $messages) {
            $source .= "        '{$lang}' => [" . $crudui_language_table($messages) . "],\n";
        }

        $source .= <<<'PHP'
    ];

    /**
     * List pagination and empty state messages for all supported languages.
     * Structure: language => [key => message]
     * @var array<string, array<string, string>>
     */
    public const LIST = [
PHP;
        $source .= "\n";

        foreach ($list as $lang => $messages) {
            $source .= "        '{$lang}' => [" . $crudui_language_table($messages) . "],\n";
        }

        $source .= <<<'PHP'
    ];
}

PHP;
        return $source;
    }
);
