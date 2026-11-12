/**
 * File loader for `$ref` resolution.
 *
 * `$ref` loads external YAML files. The
 * compose engine never touches the filesystem directly — it goes through a
 * `FileLoader`, so the shared fixtures can supply a virtual in-memory file set
 * (the spec graph is the input; no disk needed) while production wires a real
 * disk + YAML loader. One engine, two backends — identical semantics.
 *
 * Path normalization:
 *   - absolute (`/…`) paths pass through unchanged
 *   - relative paths get the basepath prefix (`basepath + '/' + path`)
 * The loader receives the ALREADY-normalized absolute key, so cycle detection
 * and the fixture map key on one canonical identifier.
 */

import { ComposeLoadError } from './errors';

/** A loaded YAML document (a parsed object tree). */
export type LoadedDoc = Record<string, unknown>;

/**
 * Loads a normalized file key to its parsed document. Throws
 * `ComposeLoadError('REF_FILE_NOT_FOUND')` when the key is absent — the engine
 * relies on that exact code (an unresolved `$ref` is a load error, never
 * `valid:true`).
 */
export interface FileLoader {
  /** Resolve `path` against `basepath` to the canonical key the map uses. */
  normalize(path: string, basepath: string): string;
  /** Load the parsed document at the canonical key, or throw NOT_FOUND. */
  load(key: string): LoadedDoc;
}

/**
 * In-memory loader over a fixed `{ key: doc }` map. Shared fixtures pass a file
 * set here; the engine resolves `$ref` against it with no disk access. Keys are
 * the normalized identifiers (`normalize` output).
 */
export class MemoryLoader implements FileLoader {
  private readonly files: Map<string, LoadedDoc>;

  constructor(files: Record<string, LoadedDoc>) {
    this.files = new Map(Object.entries(files));
  }

  normalize(path: string, basepath: string): string {
    // Absolute path: pass through. Relative: prefix basepath.
    if (path.startsWith('/')) return path;
    if (basepath) return basepath + '/' + path;
    return path;
  }

  load(key: string): LoadedDoc {
    const doc = this.files.get(key);
    if (doc === undefined) {
      throw new ComposeLoadError(
        'REF_FILE_NOT_FOUND',
        `$ref file not found: ${key}`,
        [key]
      );
    }
    // Defensive clone so resolution never mutates the source file set.
    return structuredClone(doc);
  }
}
