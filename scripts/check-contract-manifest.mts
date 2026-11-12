#!/usr/bin/env node
/**
 * Validate the executable CRUDUI contract manifest against the repository.
 *
 * Besides the manifest shape and its file links, the check compares every package's declared
 * entries with the real package: each JavaScript entry of package.json `exports` is declared
 * with its exact, sorted value exports and a visibility. The value exports of an entry are the
 * exports of its built ES module files, where types are already erased, read with es-module-lexer;
 * an `export * from` is followed to the module that Node's resolution gives for its specifier,
 * and a re-export, such as `export { default as Widget } from './Widget.svelte'`, gives its name
 * without loading its module. The packages are built first (`npm run manifest:check` runs
 * scripts/require-current-build.mts). Functions named in an implemented feature's signature are
 * public exports of the owner's "." entry, the error classes it names are JavaScript built-in
 * errors or public "." exports of a CRUDUI package, only code of CRUDUI packages under packages/
 * imports an `internal` entry, and no package imports another package's files by a relative
 * path: it imports that package's entries by name.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init, parse } from 'es-module-lexer';

import { checkedFiles } from '@polyspec/kit/tracked-files';
import { featureManifestErrors, isFeatureManifest, type ManifestEntry, type ManifestPackage } from './features-manifest.mts';
import { checkedShape, shapeOf } from './json-schema.mts';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** A value of a package.json exports map: a target path, a list of targets, or conditions and subpaths. */
type ExportsValue = string | null | ExportsValue[] | { [key: string]: ExportsValue };

/** The part of a package.json that the check reads. */
interface PackageManifest {
  name?: string;
  exports?: string | ExportsValue[] | { [key: string]: ExportsValue };
}

export interface ManifestCheck {
  errors: string[];
  counts: { features: number, packages: number, entries: number, fixtures: number };
}

/** A value of a package.json exports map: null, a string, or an array or object of such values. */
const isExportsValue = shapeOf<ExportsValue>({
  $ref: '#/definitions/value',
  definitions: {
    value: {
      anyOf: [
        { type: 'null' },
        { type: 'string' },
        { type: 'array', items: { $ref: '#/definitions/value' } },
        { type: 'object', additionalProperties: { $ref: '#/definitions/value' } },
      ],
    },
  },
});

/** A package.json, which is an object. */
const PACKAGE_MANIFEST = shapeOf<Record<string, unknown>>({ type: 'object' });

/** The name and exports of the package.json `file`; throws when they are of another type. */
function readPackageManifest(file: string): PackageManifest {
  const { name, exports } = checkedShape(PACKAGE_MANIFEST, JSON.parse(readFileSync(file, 'utf8')), file);
  if (name !== undefined && typeof name !== 'string') throw new Error(`name of ${file} is no string`);
  if (exports !== undefined && (exports === null || !isExportsValue(exports))) throw new Error(`exports of ${file} is no exports map`);
  return { ...(name === undefined ? {} : { name }), ...(exports === undefined ? {} : { exports }) };
}

const codeTarget = /\.[cm]?js$/;
const scannedExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.svelte', '.vue', '.md', '.html']);
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
// A feature error that names a class is one of these or a public "." export of a CRUDUI package.
const builtInErrors = new Set(['AggregateError', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError']);
const errorClassName = /^[A-Z][A-Za-z0-9]*Error$/;

/** The package.json exports map with its subpaths as keys. */
function exportsMap(packageManifest: PackageManifest): Record<string, ExportsValue> {
  const map = packageManifest.exports;
  if (map === undefined) return {};
  if (typeof map === 'string' || Array.isArray(map) || !Object.keys(map).every((key) => key.startsWith('.'))) return { '.': map };
  return map;
}

/** JavaScript files an exports target resolves to under any condition. */
function codeTargets(target: ExportsValue): string[] {
  if (typeof target === 'string') return codeTarget.test(target) ? [target] : [];
  if (Array.isArray(target)) return target.flatMap(codeTargets);
  if (target && typeof target === 'object') return Object.values(target).flatMap(codeTargets);
  return [];
}

await init();

/**
 * The exports of the built file `file`, or undefined when it has no module syntax, such as the CommonJS build of a
 * `require` condition: its names and those of each module that an `export * from` of it names, which Node's resolution
 * finds from `file`. A star re-export gives no `default`; `seen` stops a cycle.
 */
function moduleExports(file: string, seen = new Set<string>()): string[] | undefined {
  const [, exports, , hasModuleSyntax] = parse(readFileSync(file, 'utf8'), file);
  if (!hasModuleSyntax) return undefined;
  seen.add(file);
  const names = new Set<string>();
  for (const declared of exports) {
    if (declared.type !== 'reexport-all') {
      names.add(declared.name);
      continue;
    }
    const target = createRequire(file).resolve(declared.from);
    if (seen.has(target)) continue;
    for (const name of moduleExports(target, seen) ?? []) if (name !== 'default') names.add(name);
  }
  return [...names].sort(byCodeUnit);
}

/** Functions a signature names: each call outside a member access, with the `a | b(` names before it. */
function signatureFunctions(signature: string): string[] {
  const names = new Set<string>();
  for (const clause of signature.split(';')) {
    const [call] = clause.split('->');
    assert.ok(call !== undefined);
    for (const match of call.matchAll(/(?<![\w$.])((?:[A-Za-z_$][\w$]*\s*\|\s*)*)([A-Za-z_$][\w$]*)\s*\(/g)) {
      const [, alternatives, last] = match;
      assert.ok(alternatives !== undefined && last !== undefined);
      for (const name of [...alternatives.split('|'), last].map((part) => part.trim()).filter(Boolean)) names.add(name);
    }
  }
  return [...names].filter((name) => name !== 'new').sort(byCodeUnit);
}

/**
 * Repository files that can hold module specifiers, relative to the root with `/` separators: the files of the
 * checkout that Git tracks or does not ignore, so installed and generated output never takes part.
 */
function scannedFiles(root: string): string[] {
  return checkedFiles(root).filter(file => scannedExtensions.has(extname(file)));
}

// A relative specifier in an import, export, require, dynamic import or Vitest module mock.
const relativeSpecifier = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+|\bvi\.(?:mock|doMock|unmock|doUnmock)\s*\(\s*)(['"`])(\.\.?\/[^'"`\s]*)\1/g;
const moduleSpecifier = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])(@polyspec\/crudui-[^'"`\s]+)\1/g;

/** Check the manifest of the repository at `root`; returns the failures and the checked counts. */
export function checkContractManifest(root: string): ManifestCheck {
  const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'contracts/features.json'), 'utf8'));
  const errors: string[] = [];
  const check = (condition: unknown, message: string): void => { if (!condition) errors.push(message); };

  // The other checks read the manifest in the shape of the schema, so a manifest of another shape fails with the schema alone.
  if (!isFeatureManifest(manifest)) {
    errors.push(`manifest schema: ${featureManifestErrors()}`);
    return { errors, counts: { features: 0, packages: 0, entries: 0, fixtures: 0 } };
  }
  check(manifest.format === 'crudui/features-manifest', 'format must identify the CRUDUI feature manifest');
  const packageFile = resolve(root, 'package.json');
  const packageVersion = checkedShape(PACKAGE_MANIFEST, JSON.parse(readFileSync(packageFile, 'utf8')), packageFile).version;
  check(typeof packageVersion === 'string' && packageVersion.length > 0, 'package.json version must be a non-empty string');
  check(manifest.version === packageVersion,
    `manifest version must match the package version: expected ${String(packageVersion)}, actual ${manifest.version}`);
  const supportValues = new Set(manifest.supportValues);

  // Entries: package.json code entries and manifest entries match one to one.
  const packageNames = new Set<string>();
  const declaredEntries: { pkg: ManifestPackage, subpath: string, entry: ManifestEntry, modules: { output: string, values: string[] }[] }[] = [];
  for (const pkg of manifest.packages ?? []) {
    check(!packageNames.has(pkg.name), `duplicate package: ${pkg.name}`);
    packageNames.add(pkg.name);
    const packagePath = resolve(root, pkg.path);
    const packageFile = resolve(packagePath, 'package.json');
    check(existsSync(packageFile), `${pkg.name}: missing ${pkg.path}/package.json`);
    if (!existsSync(packageFile)) continue;
    const packageManifest = readPackageManifest(packageFile);
    check(packageManifest.name === pkg.name, `${pkg.path}: package name mismatch`);
    const entries = pkg.entries ?? {};
    const codeEntries = Object.entries(exportsMap(packageManifest)).filter(([, target]) => codeTargets(target).length > 0);
    for (const [subpath, target] of codeEntries) {
      if (!(subpath in entries)) {
        errors.push(`${pkg.name}: package.json code entry "${subpath}" is not declared in the manifest`);
        continue;
      }
      // The ES module files of the entry; a CommonJS build, such as that of a `require` condition, has no module syntax.
      const modules: { output: string, values: string[] }[] = [];
      let built = true;
      for (const output of new Set(codeTargets(target))) {
        const file = resolve(packagePath, output);
        if (!existsSync(file)) {
          built = false;
          errors.push(`${pkg.name}: package.json entry "${subpath}" has no built file ${output}; run npm run build`);
          continue;
        }
        const values = moduleExports(file);
        if (values) modules.push({ output, values });
      }
      check(!built || modules.length > 0, `${pkg.name}: package.json entry "${subpath}" has no ES module file`);
      const entry = entries[subpath];
      assert.ok(entry);
      declaredEntries.push({ pkg, subpath, entry, modules });
    }
    for (const subpath of Object.keys(entries)) {
      check(codeEntries.some(([name]) => name === subpath), `${pkg.name}: manifest entry "${subpath}" is not a package.json code entry`);
    }
  }

  // Exports: the declared list is the sorted list of the value exports of each ES module file of the entry.
  for (const { pkg, subpath, entry, modules } of declaredEntries) {
    const declared = entry.exports ?? [];
    for (const { output, values } of modules) {
      const label = `${pkg.name} "${subpath}"${modules.length > 1 ? ` (${output})` : ''}`;
      const undeclared = values.filter((name) => !declared.includes(name));
      const missing = declared.filter((name) => !values.includes(name)).sort(byCodeUnit);
      if (undeclared.length) errors.push(`${label}: exported but not declared: ${undeclared.join(', ')}`);
      if (missing.length) errors.push(`${label}: declared but not exported: ${missing.join(', ')}`);
    }
    const sorted = [...declared].sort(byCodeUnit);
    check(declared.every((name, index) => name === sorted[index]), `${pkg.name} "${subpath}": exports must be sorted: ${sorted.join(', ')}`);
  }

  // Features.
  const publicErrors = new Set(builtInErrors);
  for (const pkg of manifest.packages ?? []) {
    const main = pkg.entries?.['.'];
    if (main?.visibility === 'public') for (const name of main.exports ?? []) publicErrors.add(name);
  }
  const featureIds = new Set<string>();
  for (const feature of manifest.features ?? []) {
    check(!featureIds.has(feature.id), `duplicate feature: ${feature.id}`);
    featureIds.add(feature.id);
    check(packageNames.has(feature.owner), `${feature.id}: owner is not listed: ${feature.owner}`);
    check(['planned', 'partial', 'implemented'].includes(feature.status), `${feature.id}: invalid status: ${feature.status}`);
    check(typeof feature.signature === 'string' && feature.signature.length > 0, `${feature.id}: signature is required`);
    check(Array.isArray(feature.errors) && feature.errors.length > 0, `${feature.id}: errors are required`);
    if (feature.status === 'implemented' && typeof feature.signature === 'string') {
      const main = manifest.packages.find((pkg) => pkg.name === feature.owner)?.entries?.['.'];
      const publicExports = main?.visibility === 'public' ? main.exports : [];
      for (const name of signatureFunctions(feature.signature)) {
        check(publicExports.includes(name), `${feature.id}: signature function ${name} is not a public "." export of ${feature.owner}`);
      }
      for (const name of (feature.errors ?? []).filter((error) => errorClassName.test(error))) {
        check(publicErrors.has(name), `${feature.id}: error ${name} is neither a JavaScript built-in error nor a public "." export of a CRUDUI package`);
      }
    }
    for (const support of Object.values(feature.support ?? {})) check(supportValues.has(support), `${feature.id}: invalid support value: ${support}`);
    for (const fixture of feature.fixtures ?? []) check(existsSync(resolve(root, fixture)), `${feature.id}: missing fixture: ${fixture}`);
    for (const test of feature.tests ?? []) check(existsSync(resolve(root, test)), `${feature.id}: missing test: ${test}`);
    const verificationIds = new Set<string>();
    check(feature.status === 'planned' || feature.verification.length > 0, `${feature.id}: verification commands are required for non-planned features`);
    for (const verification of feature.verification ?? []) {
      check(!verificationIds.has(verification.id), `${feature.id}: duplicate verification: ${verification.id}`);
      verificationIds.add(verification.id);
      check(typeof verification.command === 'string' && verification.command.length > 0, `${feature.id}: verification command is required: ${verification.id}`);
    }
    for (const doc of feature.docs ?? []) check(existsSync(resolve(root, doc)), `${feature.id}: missing document: ${doc}`);
  }

  for (const fixture of manifest.fixtures ?? []) check(existsSync(resolve(root, fixture.path)), `missing fixture: ${fixture.path}`);
  for (const example of manifest.examples ?? []) {
    check(existsSync(resolve(root, example.input)), `${example.id}: missing input: ${example.input}`);
    check(existsSync(resolve(root, example.expected)), `${example.id}: missing expected output: ${example.expected}`);
  }

  // Internal entries: only code of CRUDUI packages imports them; examples, tests and documents use public entries.
  const internal = new Set<string>();
  for (const pkg of manifest.packages ?? []) {
    for (const [subpath, entry] of Object.entries(pkg.entries ?? {})) {
      if (entry.visibility === 'internal') internal.add(subpath === '.' ? pkg.name : pkg.name + subpath.slice(1));
    }
  }
  // The legacy packages under legacy/packages are packages of CRUDUI too (plan V-6).
  const packageCode = (file: string): boolean => /^(legacy\/)?packages\//.test(file) && !file.endsWith('.md');
  for (const file of scannedFiles(root).sort(byCodeUnit)) {
    if (packageCode(file)) continue;
    const text = readFileSync(resolve(root, file), 'utf8');
    if (!text.includes('@polyspec/crudui-')) continue;
    const imported = new Set([...text.matchAll(moduleSpecifier)].map((match) => match[2])
      .filter((specifier): specifier is string => specifier !== undefined && internal.has(specifier)));
    for (const specifier of [...imported].sort(byCodeUnit)) errors.push(`${file} imports the internal entry ${specifier}`);
  }

  // Packages import each other by entry name: a relative path from one package directory into
  // another one bypasses the entry and its declared exports.
  const packageDirectory = (file: string): string | undefined => {
    const name = /^packages\/([^/]+)\//.exec(file)?.[1];
    return name !== undefined && existsSync(resolve(root, 'packages', name, 'package.json')) ? name : undefined;
  };
  for (const file of scannedFiles(root).sort(byCodeUnit)) {
    const own = packageDirectory(file);
    if (!own || ['.md', '.html'].includes(extname(file))) continue;
    const text = readFileSync(resolve(root, file), 'utf8');
    const specifiers = new Set<string>();
    for (const [, , specifier] of text.matchAll(relativeSpecifier)) {
      assert.ok(specifier !== undefined);
      const target = relative(root, resolve(root, dirname(file), specifier)).split(sep).join('/');
      const other = /^packages\/([^/]+)(?:\/|$)/.exec(target)?.[1];
      if (other !== undefined && other !== own) specifiers.add(specifier);
    }
    for (const specifier of [...specifiers].sort(byCodeUnit)) errors.push(`${file} imports another package's source: ${specifier}`);
  }

  return {
    errors,
    counts: { features: manifest.features?.length ?? 0, packages: manifest.packages?.length ?? 0, entries: declaredEntries.length, fixtures: manifest.fixtures?.length ?? 0 },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { errors, counts } = checkContractManifest(scriptRoot);
  if (errors.length) {
    process.stderr.write(`[manifest] ${errors.length} failure(s)\n${errors.map((error) => `  ${error}`).join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`[manifest] ${counts.features} features, ${counts.packages} packages with ${counts.entries} entries and ${counts.fixtures} fixture links passed\n`);
  }
}
