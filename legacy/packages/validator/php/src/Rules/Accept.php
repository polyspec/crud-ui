<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Rules;

use Polyspec\Crudui\Validator\Expr\FieldPath;
use Polyspec\Crudui\Validator\Values\Whitespace;

/**
 * Accept validation rule.
 * Validates that a file has an acceptable MIME type or extension.
 */
class Accept implements RuleInterface
{
    /**
     * Common MIME type mappings.
     */
    private const EXTENSION_TO_MIME = [
        // Images
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
        'svg' => ['image/svg+xml'],
        'bmp' => ['image/bmp'],
        'ico' => ['image/x-icon', 'image/vnd.microsoft.icon'],

        // Documents
        'pdf' => ['application/pdf'],
        'doc' => ['application/msword'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xls' => ['application/vnd.ms-excel'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'ppt' => ['application/vnd.ms-powerpoint'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'application/csv'],

        // Audio
        'mp3' => ['audio/mpeg', 'audio/mp3'],
        'wav' => ['audio/wav', 'audio/x-wav'],
        'ogg' => ['audio/ogg'],
        'flac' => ['audio/flac'],

        // Video
        'mp4' => ['video/mp4'],
        'webm' => ['video/webm'],
        'avi' => ['video/x-msvideo'],
        'mov' => ['video/quicktime'],
        'mkv' => ['video/x-matroska'],

        // Archives
        'zip' => ['application/zip', 'application/x-zip-compressed'],
        'rar' => ['application/x-rar-compressed', 'application/vnd.rar'],
        'tar' => ['application/x-tar'],
        'gz' => ['application/gzip'],
        '7z' => ['application/x-7z-compressed'],

        // Code
        'json' => ['application/json'],
        'xml' => ['application/xml', 'text/xml'],
        'html' => ['text/html'],
        'css' => ['text/css'],
        'js' => ['application/javascript', 'text/javascript'],
    ];

    /**
     * Validate that a file has an acceptable MIME type or extension.
     */
    public function validate(mixed $value, mixed $param, array $allData, FieldPath $path): bool
    {
        if ($param === null || $param === false) {
            return true;
        }

        $acceptList = $this->parseAcceptParam($param);
        if (empty($acceptList)) {
            return true;
        }

        // Handle PHP file upload array
        if (is_array($value) && isset($value['tmp_name'])) {
            $mimeType = $value['type'] ?? '';
            $filename = $value['name'] ?? '';

            return $this->matchesMimeType($mimeType, $acceptList) ||
                   $this->matchesExtension($filename, $acceptList);
        }

        // Handle array of files
        if (is_array($value)) {
            foreach ($value as $file) {
                if (is_array($file) && isset($file['tmp_name'])) {
                    $mimeType = $file['type'] ?? '';
                    $filename = $file['name'] ?? '';

                    $isValid = $this->matchesMimeType($mimeType, $acceptList) ||
                               $this->matchesExtension($filename, $acceptList);

                    if (!$isValid) {
                        return false;
                    }
                }
            }
            return true;
        }

        // Handle string (filename or MIME type)
        if (is_string($value)) {
            if (str_contains($value, '/')) {
                // MIME type string
                return $this->matchesMimeType($value, $acceptList);
            } else {
                // Filename string
                return $this->matchesExtension($value, $acceptList);
            }
        }

        return true;
    }

    /**
     * Parse accept parameter into a list of allowed MIME types.
     */
    private function parseAcceptParam(mixed $param): array
    {
        $acceptList = [];

        if (is_string($param)) {
            $parts = array_map(Whitespace::trim(...), explode(',', strtolower($param)));

            foreach ($parts as $part) {
                if (str_starts_with($part, '.')) {
                    // Extension (e.g., .jpg)
                    $ext = substr($part, 1);
                    if (isset(self::EXTENSION_TO_MIME[$ext])) {
                        $acceptList = array_merge($acceptList, self::EXTENSION_TO_MIME[$ext]);
                    } else {
                        $acceptList[] = $part;
                    }
                } elseif (str_contains($part, '/')) {
                    // MIME type
                    $acceptList[] = $part;
                }
            }
        } elseif (is_array($param)) {
            foreach ($param as $item) {
                $acceptList = array_merge($acceptList, $this->parseAcceptParam($item));
            }
        }

        return $acceptList;
    }

    /**
     * Check if a MIME type matches the accept list.
     */
    private function matchesMimeType(string $mimeType, array $acceptList): bool
    {
        $normalizedMime = strtolower($mimeType);

        foreach ($acceptList as $accept) {
            if ($accept === '*/*') {
                return true;
            }

            if (str_ends_with($accept, '/*')) {
                // Wildcard type (e.g., image/*)
                $typePrefix = substr($accept, 0, -1);
                if (str_starts_with($normalizedMime, $typePrefix)) {
                    return true;
                }
            } elseif (!str_starts_with($accept, '.') && $normalizedMime === $accept) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a file extension matches the accept list.
     *
     * A filename carries no MIME header, so the extension is mapped to its
     * MIME type(s) via EXTENSION_TO_MIME and those are matched against MIME
     * entries, including wildcards (image slash star, star slash star).
     * Direct extension entries (.jpg) are also matched. Without this mapping a
     * filename such as "image1.jpg" would never satisfy accept image slash star.
     */
    private function matchesExtension(string $filename, array $acceptList): bool
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if ($ext === '') {
            return false;
        }

        foreach ($acceptList as $accept) {
            if (str_starts_with($accept, '.')) {
                if (substr($accept, 1) === $ext) {
                    return true;
                }
            }
        }

        // Infer MIME from the extension, then match MIME wildcards/exact.
        $inferredMimes = self::EXTENSION_TO_MIME[$ext] ?? [];
        foreach ($inferredMimes as $mime) {
            if ($this->matchesMimeType($mime, $acceptList)) {
                return true;
            }
        }

        return false;
    }
}
