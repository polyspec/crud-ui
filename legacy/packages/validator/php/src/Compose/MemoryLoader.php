<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

/**
 * In-memory loader over a fixed { key: doc } map. Port of the JS MemoryLoader.
 *
 * Shared fixtures pass a file set here; the engine resolves $ref against it with
 * no disk access. Keys are the normalized identifiers (normalize() output).
 *
 * PHP arrays are value types (copy-on-write), so a returned document can never
 * mutate the source file set — no defensive clone needed (the JS port uses
 * structuredClone for that exact guarantee).
 */
final class MemoryLoader implements FileLoader
{
    /** @var array<string, array<string, mixed>> */
    private array $files;

    /**
     * @param array<string, array<string, mixed>> $files
     */
    public function __construct(array $files)
    {
        $this->files = $files;
    }

    /** Absolute (/-leading) path passes through; relative gets the basepath prefix. */
    public function normalize(string $path, string $basepath): string
    {
        // Absolute path: pass through. Relative: prefix basepath.
        if (\str_starts_with($path, '/')) {
            return $path;
        }
        if ($basepath !== '') {
            return $basepath . '/' . $path;
        }
        return $path;
    }

    /**
     * Return the parsed document at the normalized key, or throw
     * REF_FILE_NOT_FOUND when absent (an unresolved $ref is a load error).
     *
     * @return array<string, mixed>
     */
    public function load(string $key): array
    {
        if (!\array_key_exists($key, $this->files)) {
            throw new ComposeLoadError(
                'REF_FILE_NOT_FOUND',
                '$ref file not found: ' . $key,
                [$key],
            );
        }
        return $this->files[$key];
    }
}
