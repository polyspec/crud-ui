<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use Polyspec\Crudui\FormError;

/** Runtime interface text shared by every renderer and implementation. */
final class Messages
{
    /** Return the interface text for a supported language (ko, en, ja or zh). */
    public static function forLanguage(mixed $language): array
    {
        // Decoded JSON can supply any value; a non-string is rejected before any text conversion.
        if (!is_string($language)) {
            throw new FormError('INVALID_FORM_INPUT', 'Language must be a string');
        }
        if (!isset(InterfaceMessages::MESSAGES[$language])) {
            throw new FormError('INVALID_FORM_INPUT', 'Unsupported language: ' . $language);
        }
        return InterfaceMessages::MESSAGES[$language];
    }

    /** Replace the first `{count}` in a counted message. */
    public static function count(string $template, int $count): string
    {
        $at = strpos($template, '{count}');
        return $at === false ? $template : substr_replace($template, (string) $count, $at, strlen('{count}'));
    }
}
