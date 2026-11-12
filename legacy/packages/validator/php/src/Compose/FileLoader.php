<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Compose;

/**
 * File loader for $ref resolution. Port of validator-ts/src/compose/loader.ts.
 *
 * $ref loads external YAML files. The
 * compose engine never touches the filesystem directly — it goes through a
 * FileLoader, so the shared fixtures can supply a virtual in-memory file set
 * (the spec graph is the input; no disk needed) while production wires a real
 * disk + YAML loader. One engine, two backends — identical semantics.
 *
 * Path normalization:
 *   - absolute (/…) paths pass through unchanged
 *   - relative paths get the basepath prefix (basepath . '/' . path)
 * The loader receives the ALREADY-normalized absolute key, so cycle detection
 * and the fixture map key on one canonical identifier.
 */
interface FileLoader
{
    /** Resolve $path against $basepath to the canonical key the map uses. */
    public function normalize(string $path, string $basepath): string;

    /**
     * Load the parsed document at the canonical key, or throw NOT_FOUND.
     *
     * @return array<string, mixed>
     * @throws ComposeLoadError REF_FILE_NOT_FOUND when the key is absent.
     */
    public function load(string $key): array;
}
