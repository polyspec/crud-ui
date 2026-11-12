<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * URL validation rule.
 * Validates that a value is a valid URL.
 */
class Url extends StringRule
{
    protected function accepts(string $text): bool
    {
        $url = Whitespace::trim($text);
        if ($url === '') {
            return false;
        }

        // Use PHP's built-in URL validation
        $result = filter_var($url, FILTER_VALIDATE_URL);

        if ($result === false) {
            return false;
        }

        // Additional check for allowed protocols
        $parsed = parse_url($url);
        if (!isset($parsed['scheme'])) {
            return false;
        }

        return in_array(strtolower($parsed['scheme']), ['http', 'https', 'ftp'], true);
    }
}
