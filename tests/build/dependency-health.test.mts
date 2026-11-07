import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { builtinModules, findPackageJSON } from 'node:module';
import { init, parse } from 'es-module-lexer';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { makeTargets, nodeTestArguments } from '../../scripts/test-commands.mts';
import { checked, readJson, type JTDSchemaType } from '../json.mts';
import { makeDryRun, makeEnvironment } from './make-dry-run.mts';

const root = path.resolve(import.meta.dirname, '../..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const git = process.platform === 'win32' ? 'git.exe' : 'git';

/** The fields of a package.json that the checks read. */
interface PackageManifest {
  name?: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  allowScripts?: Record<string, unknown>;
}
/** The fields of a package-lock.json that the checks read. */
interface PackageLock { packages?: Record<string, { link?: boolean; resolved?: string; integrity?: string }> }
/** The JSON report of `npm ls --json`. */
interface NpmReport { problems?: string[]; error?: { summary?: string } }
/** The fields of a composer.json that the checks read; a repository that disables packagist.org has no type. */
interface ComposerManifest {
  name?: string;
  type?: string;
  version?: string;
  repositories?: { type?: string; url?: string; options?: { symlink?: boolean } }[];
  require?: Record<string, string>;
}
/** The fields of a composer.lock that the checks read. */
interface ComposerLockPackage { name: string; dist?: { type: string }; 'transport-options'?: { symlink?: boolean } }
interface ComposerLock { packages?: ComposerLockPackage[]; 'packages-dev'?: ComposerLockPackage[] }

const dependencies: JTDSchemaType<Record<string, string>> = { values: { type: 'string' } };
const packageSchema: JTDSchemaType<PackageManifest> = {
  optionalProperties: {
    name: { type: 'string' }, workspaces: { elements: { type: 'string' } }, dependencies, devDependencies: dependencies,
    optionalDependencies: dependencies, peerDependencies: dependencies, allowScripts: { values: {} },
  },
  additionalProperties: true,
};
const lockSchema: JTDSchemaType<PackageLock> = {
  optionalProperties: {
    packages: {
      values: { optionalProperties: { link: { type: 'boolean' }, resolved: { type: 'string' }, integrity: { type: 'string' } }, additionalProperties: true },
    },
  },
  additionalProperties: true,
};
const reportSchema: JTDSchemaType<NpmReport> = {
  optionalProperties: { problems: { elements: { type: 'string' } }, error: { optionalProperties: { summary: { type: 'string' } }, additionalProperties: true } },
  additionalProperties: true,
};
const composerSchema: JTDSchemaType<ComposerManifest> = {
  optionalProperties: {
    name: { type: 'string' },
    type: { type: 'string' },
    version: { type: 'string' },
    repositories: {
      elements: {
        optionalProperties: {
          type: { type: 'string' }, url: { type: 'string' },
          options: { optionalProperties: { symlink: { type: 'boolean' } }, additionalProperties: true },
        },
        additionalProperties: true,
      },
    },
    require: dependencies,
  },
  additionalProperties: true,
};
const composerPackage: JTDSchemaType<ComposerLockPackage> = {
  properties: { name: { type: 'string' } },
  optionalProperties: {
    dist: { properties: { type: { type: 'string' } }, additionalProperties: true },
    'transport-options': { optionalProperties: { symlink: { type: 'boolean' } }, additionalProperties: true },
  },
  additionalProperties: true,
};
const composerLockSchema: JTDSchemaType<ComposerLock> = {
  optionalProperties: { packages: { elements: composerPackage }, 'packages-dev': { elements: composerPackage } },
  additionalProperties: true,
};
/** The package.json in `directory` of the checkout. */
const packageManifest = (directory: string): PackageManifest => readJson(path.join(root, directory, 'package.json'), packageSchema);
/** A Makefile target as makeTargets of scripts/test-commands.mts returns it. */
interface MakeRule { prerequisites: string[]; commands: string[] }

/** The capture group `index` of a regular expression match, which the pattern always captures. */
function captured(match: RegExpMatchArray, index: number): string {
  const value = match[index];
  assert.ok(value !== undefined, `${match[0]} has no group ${index}`);
  return value;
}

function execute(command: string, args: string[], cwd: string = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error !== undefined) assert.fail(result.error.message);
  return result;
}

function executeNpm(args: string[], cwd: string = root) {
  const result = execute(npm, args, cwd);
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) { if (!(error instanceof SyntaxError)) throw error;
    assert.fail([
      `npm ${args.join(' ')} did not return JSON:`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return { ...result, report: checked(parsed, reportSchema, `npm ${args.join(' ')}`) };
}

function trackedLockFiles(): string[] {
  const result = execute(git, ['ls-files', '--', 'package-lock.json', '**/package-lock.json']);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').filter(Boolean).sort();
}

function trackedComposerFiles(basename: string): string[] {
  const result = execute(git, ['ls-files', '--', basename, `**/${basename}`]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').filter(Boolean).sort();
}

function workspacePackageDirectories(): string[] {
  const manifest = packageManifest('.');
  // The workspaces of package.json are the folders of the packages, one by one (C14.7).
  return (manifest.workspaces ?? []).map((workspace) => {
    assert.doesNotMatch(workspace, /\*/, `unsupported workspace pattern: ${workspace}`);
    const result = execute(git, ['ls-files', '--', `${workspace}/package.json`]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), `${workspace}/package.json`, `${workspace} has no tracked package.json`);
    return workspace;
  });
}

/**
 * The Node.js programs and test files that `make <target>` runs: the recipe lines of the target,
 * of its prerequisites and of the targets its recipe runs with `$(MAKE)` or `make`.
 */
export function makeNodeEntrypoints(targets: Record<string, MakeRule>, target: string, seen: Set<string> = new Set()): string[] {
  if (seen.has(target)) return [];
  seen.add(target);
  const rule = targets[target];
  assert.ok(rule, `Makefile must define ${target}`);
  const reached = [
    ...rule.prerequisites,
    ...rule.commands.flatMap((command) => [...command.matchAll(/(?:\$\(MAKE\)|\bmake)\s+((?:-[^\s]+\s+)*)([\w.-]+)/g)]
      .map((match) => captured(match, 2))),
  ];
  return [...new Set([
    ...rule.commands.flatMap((command) => [
      ...[...command.matchAll(/\bnode(?:\s+--test)?\s+([^\s"']+\.m[jt]s)\b/g)].map((match) => captured(match, 1)),
      ...nodeTestArguments(command),
    ]),
    ...reached.flatMap((name) => makeNodeEntrypoints(targets, name, seen)),
  ])];
}

function nativeTestNodeEntrypoints(): string[] {
  // The tools of @polyspec/kit, $(KIT)/<tool>.$(KIT_EXT), import the dependencies of the kit package, not those of the root.
  const database = makeDryRun(root, 'help', { database: true });
  assert.equal(database.status, 0, database.stderr);
  const entrypoints = makeNodeEntrypoints(
    makeTargets(database.stdout), 'crudui-test-native',
  ).filter((file) => !file.startsWith('$(KIT)/')).flatMap(file => {
    const matches = globSync(file, { cwd: root });
    assert.notDeepEqual(matches, [], `make crudui-test-native selects no file for ${file}`);
    return matches;
  });
  assert.notDeepEqual(entrypoints, [], 'make crudui-test-native runs no Node.js program');
  return entrypoints;
}

test('the Node.js programs of a target include those of its prerequisites and sub-makes', () => {
  const targets = makeTargets([
    'all: build', '\t@status=0; $(MAKE) --no-print-directory suite || status=1; exit $$status',
    'build:', '\tnode scripts/build.mjs', 'suite:', '\tnode $(KIT)/run-tests.$(KIT_EXT) node -- a.test.mjs b.test.mjs', '',
  ].join('\n'));
  assert.deepEqual(makeNodeEntrypoints(targets, 'all').sort(),
    ['a.test.mjs', 'b.test.mjs', 'scripts/build.mjs']);
  assert.deepEqual(makeNodeEntrypoints(makeTargets('empty:\n\techo\n'), 'empty'), []);
});

function rootExampleEntrypoints(): string[] {
  const result = execute(git, [
    'ls-files', '--',
    'examples/form-comparison/*.mjs',
    'examples/form-comparison/**/*.mjs',
    'examples/cross-check-console/server/*.mjs',
  ]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').filter((filename) => (
    filename && existsSync(path.join(root, filename))
  ));
}

function importedPackageNames(filename: string, source = readFileSync(path.join(root, filename), 'utf8')): string[] {
  const [imports] = parse(source, filename);
  const specifiers = imports.flatMap(item => typeof item.specifier === 'string' ? [item.specifier] : []);
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  return specifiers
    .filter((specifier) => (
      !specifier.startsWith('.')
      && !specifier.startsWith('/')
      && !specifier.startsWith('#')
      && !builtins.has(specifier)
      && !/^[A-Za-z][A-Za-z+.-]*:/.test(specifier)
    ))
    .map((specifier) => {
      assert.doesNotThrow(() => {
        const resolved = import.meta.resolve(specifier);
        assert.ok(existsSync(fileURLToPath(resolved)), `${resolved} is missing`);
      }, `${filename}: installed dependency ${specifier} must resolve from the root package`);
      if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
      const [name] = specifier.split('/');
      assert.ok(name !== undefined);
      return name;
    });
}

test('import checks ignore quoted syntax and resolve each installed package subpath', async () => {
  await init();
  const file = 'tests/build/dependency-health.test.mts';
  assert.deepEqual(importedPackageNames(file, String.raw`
    import { createElement } from 'react';
    export { strict } from 'node:assert';
    const text = "import 'missing-in-quoted-text'";
    const pattern = /import \{ fake \} from 'missing-in-regex'/;
    const module = import('react-dom/server');
  `), ['react', 'react-dom']);
  assert.throws(() => importedPackageNames(file, "import 'react/missing-C17.36-subpath';"),
    /installed dependency react\/missing-C17\.36-subpath must resolve/);
});

function packageApprovalFailures(lockFile: string) {
  const directory = path.dirname(path.join(root, lockFile));
  const manifestFile = path.join(directory, 'package.json');
  const manifest = readJson(manifestFile, packageSchema);
  const approvals = manifest.allowScripts ?? {};
  assert.equal(
    approvals !== null && typeof approvals === 'object' && !Array.isArray(approvals),
    true,
    `${lockFile}: allowScripts must be an object`,
  );

  const failures = [];
  for (const [key, approved] of Object.entries(approvals)) {
    const separator = key.lastIndexOf('@');
    const version = separator > 0 ? key.slice(separator + 1) : '';
    const exactVersions = version.split('||').map((part) => part.trim());
    if (approved !== true || exactVersions.some((part) => !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(part))) {
      failures.push({ key, approved });
    }
  }
  return failures;
}

test('the locked dependency graph is valid and installed local packages satisfy the link rules', () => {
  const result = executeNpm(['ls', '--all', '--json', '--package-lock-only']);
  const links = execute('make', ['link-check']);
  assert.equal(links.status, 0, links.stdout + links.stderr);
  assert.equal(result.status, 0, [
    ...(result.report.problems ?? []),
    result.report.error?.summary,
    result.stderr,
  ].filter(Boolean).join('\n'));
});

test('workspace packages use the root dependency lock file', () => {
  const trackedLocks = new Set(trackedLockFiles());
  const failures = workspacePackageDirectories()
    .map((directory) => `${directory}/package-lock.json`)
    .filter((lockFile) => trackedLocks.has(lockFile));
  assert.deepEqual(failures, []);
});

test('native test root imports are declared by the root package', async () => {
  await init();
  const manifest = packageManifest('.');
  const workspaceNames = workspacePackageDirectories().map((directory) => {
    const workspace = packageManifest(directory);
    assert.equal(typeof workspace.name, 'string', `${directory}/package.json: missing name`);
    return workspace.name;
  });
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...workspaceNames,
  ]);
  const failures = nativeTestNodeEntrypoints().flatMap((filename) => (
    importedPackageNames(filename)
      .filter((packageName) => !declared.has(packageName))
      .map((packageName) => `${filename}: ${packageName}`)
  )).sort();
  assert.deepEqual(failures, []);
});

test('root example imports are declared by the root package', async () => {
  await init();
  const manifest = packageManifest('.');
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  const failures = rootExampleEntrypoints().flatMap((filename) => (
    importedPackageNames(filename)
      .filter((packageName) => !declared.has(packageName))
      .map((packageName) => `${filename}: ${packageName}`)
  )).sort();
  assert.deepEqual(failures, []);
});

// The shared tools are the release asset of a tag of polyspec/kit, and the OrderedJSON package is the release asset of a
// tag of polyspec/ordered-json; the root package.json names each by its URL and package-lock.json pins it with its integrity.
// make install-packages allows the URLs of the root package.json alone.
const KIT_ASSET = /^https:\/\/github\.com\/polyspec\/kit\/releases\/download\/v(\d+\.\d+\.\d+)\/polyspec-kit-\1\.tgz$/;
const ORDERED_JSON_ASSET = /^https:\/\/github\.com\/polyspec\/ordered-json\/releases\/download\/v(\d+\.\d+\.\d+)\/polyspec-ordered-json-\1\.tgz$/;

// Every runtime of crudui requires the OrderedJSON release that the root package.json pins (C17.110): a Go module requires
// its module tag, and a Rust crate takes its Git tag, so no server builds against an older OrderedJSON than the others.
test('every Go module and Rust crate requires the OrderedJSON version of the root package.json (C17.110)', () => {
  const pinned = captured(ORDERED_JSON_ASSET.exec(packageManifest('.').devDependencies?.['@polyspec/ordered-json'] ?? '') ?? assert.fail('the root package.json pins no OrderedJSON release asset'), 1);
  const stale = trackedComposerFiles('go.mod').flatMap((file) => [...readFileSync(path.join(root, file), 'utf8').matchAll(/github\.com\/polyspec\/ordered-json\/packages\/go v(\d+\.\d+\.\d+)/g)]
    .filter((match) => captured(match, 1) !== pinned).map((match) => `${file}: ${match[0]}`))
    .concat(trackedComposerFiles('Cargo.toml').flatMap((file) => [...readFileSync(path.join(root, file), 'utf8').matchAll(/git = "https:\/\/github\.com\/polyspec\/ordered-json", tag = "v(\d+\.\d+\.\d+)", version = "(\d+\.\d+\.\d+)"/g)]
      .filter((match) => captured(match, 1) !== pinned || captured(match, 2) !== pinned).map((match) => `${file}: ${match[0]}`)));
  assert.deepEqual(stale, [], `the root package.json pins OrderedJSON ${pinned}`);
});

test('npm installs only registry packages, linked directories and the kit and OrderedJSON release assets, and fetches no other URL or Git source', () => {
  // A package comes from the npm registry, from a workspace or from a checkout that a make target installed; npm fetches
  // no URL or Git source other than the release assets of @polyspec/kit and @polyspec/ordered-json that the root
  // package.json names.
  const lock = readJson(path.join(root, 'package-lock.json'), lockSchema);
  const remote = /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|git(?:\+[a-z]+)?:|github:|gitlab:|bitbucket:|gist:|[^@./][^/:]*\/[^/])/;
  const manifests = ['.', ...workspacePackageDirectories()].map((directory): [string, PackageManifest] => [directory, packageManifest(directory)]);
  const remoteDependencies = manifests.flatMap(([directory, manifest]) => [
    ...Object.entries(manifest.dependencies ?? {}),
    ...Object.entries(manifest.devDependencies ?? {}),
    ...Object.entries(manifest.optionalDependencies ?? {}),
  ].filter(([packageName, specifier]) => remote.test(specifier) && !specifier.startsWith('npm:')
    && !(directory === '.' && packageName === '@polyspec/kit' && KIT_ASSET.test(specifier))
    && !(directory === '.' && packageName === '@polyspec/ordered-json' && ORDERED_JSON_ASSET.test(specifier)))
    .map(([packageName, specifier]) => `${directory}: ${packageName} ${specifier}`));
  assert.deepEqual(remoteDependencies, []);

  const registry = 'https://registry.npmjs.org/';
  const unexpected = Object.entries(lock.packages ?? {}).flatMap(([location, entry]) => {
    if (location === '' || !location.includes('node_modules/')) return [];
    if (entry.link) {
      const target = path.resolve(root, entry.resolved ?? '');
      return target.startsWith(root + path.sep) ? [] : [`${location}: links ${entry.resolved}`];
    }
    const asset = (location === 'node_modules/@polyspec/kit' && KIT_ASSET.test(entry.resolved ?? ''))
      || (location === 'node_modules/@polyspec/ordered-json' && ORDERED_JSON_ASSET.test(entry.resolved ?? ''));
    if (!entry.resolved?.startsWith(registry) && !asset) return [`${location}: resolves ${entry.resolved ?? 'nothing'}`];
    return /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity ?? '') ? [] : [`${location}: no SHA-512 integrity`];
  });
  assert.deepEqual(unexpected, []);

  const configFile = path.join(root, '.npmrc');
  const config = existsSync(configFile) ? readFileSync(configFile, 'utf8') : '';
  const settings = Object.fromEntries(config.split('\n').flatMap((line): [string, string][] => {
    const match = line.match(/^\s*(allow-remote|allow-git)\s*=\s*([^#;\s]+)\s*(?:[#;].*)?$/);
    return match ? [[captured(match, 1), captured(match, 2)]] : [];
  }));
  assert.deepEqual(settings, { 'allow-remote': 'root', 'allow-git': 'none' });
});

test('form comparison commands use the root npm dependency graph', () => {
  const failures = [
    'examples/form-comparison/package.json',
    'examples/form-comparison/package-lock.json',
  ].filter((filename) => existsSync(path.join(root, filename)));
  assert.deepEqual(failures, []);
});

test('npm installs enforce script approvals', () => {
  // make install-packages runs npm ci; the .npmrc of the checkout sets strict-allow-scripts, so an install script that
  // allowScripts of package.json does not approve fails the install.
  const result = execute(npm, ['config', 'get', 'strict-allow-scripts']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'true');
});

// The development root requires the Composer packages of packages/ through path repositories with Composer's default
// link, so vendor/ loads each package from its source directory by the autoload of its own composer.json and no copy
// can fall behind its source.
test('Composer path repositories link the local packages', () => {
  const failures = [];
  for (const filename of trackedComposerFiles('composer.json')) {
    const manifest = readJson(path.join(root, filename), composerSchema);
    for (const [index, repository] of (manifest.repositories ?? []).entries()) {
      if (repository.type === 'path' && repository.options?.symlink === false) {
        failures.push(`${filename}:repositories[${index}]`);
      }
    }
  }
  for (const filename of trackedComposerFiles('composer.lock')) {
    const lock = readJson(path.join(root, filename), composerLockSchema);
    for (const dependency of [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])]) {
      if (dependency.dist?.type === 'path' && dependency['transport-options']?.symlink === false) {
        failures.push(`${filename}:${dependency.name}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('the canonical Composer project resolves polyspec/ordered-json from its release packages.json', () => {
  const manifest = readJson(path.join(root, 'composer.json'), composerSchema);
  const release = manifest.repositories?.find(repository => repository.type === 'composer' && repository.url?.endsWith('/packages.json'));
  assert.ok(release, 'the composer repository of the release packages.json is declared');
  assert.equal(manifest.repositories?.some(repository => repository.url?.startsWith('../')), false);
  assert.equal(manifest.require?.['polyspec/ordered-json'], '0.0.*');
  assert.equal(manifest.repositories?.some(repository => repository.type === 'artifact'), false);
  assert.equal(existsSync(path.join(root, 'composer.local.json')), false);
  assert.equal(existsSync(path.join(root, 'composer.local.lock')), false);
});

test('default PHP installation updates local sources without fetching release archives', () => {
  const result = makeDryRun(root, 'crudui-install-composer', { database: true, env: { ...process.env, GITHUB_ACTIONS: 'false' } });
  assert.equal(result.status, 0, result.stderr);
  const install = makeTargets(result.stdout)['crudui-install-composer'];
  assert.ok(install);
  assert.match(install.commands.join('\n'), /\bupdate ['"]?polyspec\/\*/);
});

test('Composer installed records match the actual polyspec package versions', () => {
  const vendor = path.resolve(root, process.env.COMPOSER_VENDOR_DIR ?? 'vendor');
  const installed = readJson<{ packages: { name: string; version: string }[] }>(path.join(vendor, 'composer/installed.json'), {
    properties: { packages: { elements: {
      properties: { name: { type: 'string' }, version: { type: 'string' } }, additionalProperties: true,
    } } }, additionalProperties: true,
  });
  let checked = 0;
  for (const entry of installed.packages) {
    if (!entry.name.startsWith('polyspec/')) continue;
    const manifest = readJson(path.join(vendor, entry.name, 'composer.json'), composerSchema);
    assert.equal(entry.version.replace(/^v/, ''), manifest.version,
      `${entry.name}: installed Composer version must match its actual package manifest`);
    checked += 1;
  }
  assert.ok(checked > 0, 'ran no polyspec package metadata check');
});

test('a published Composer package declares its version, and the development root requires that version', () => {
  const failures = [];
  for (const filename of trackedComposerFiles('composer.json')) {
    const manifest = readJson(path.join(root, filename), composerSchema);
    if (filename.startsWith('packages/') && !filename.includes('/vendor/') && manifest.type === 'library') {
      if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) failures.push(`${filename}: the published package declares no version X.Y.Z`);
      if (Object.hasOwn(manifest, 'repositories')) failures.push(`${filename}: the published package declares repositories`);
    }
    for (const [index, repository] of (manifest.repositories ?? []).entries()) {
      if (repository.type !== 'path') continue;
      assert.ok(repository.url !== undefined, `${filename}:repositories[${index}] is a path repository without url`);
      if (repository.url.includes('*')) continue;
      const targetFile = path.resolve(path.dirname(path.join(root, filename)),
        repository.url, 'composer.json');
      const target = readJson(targetFile, composerSchema);
      assert.ok(target.name !== undefined, `${targetFile} declares no name`);
      // External source constraints are resolved by Composer; packages published by this repository share its version.
      if (!path.relative(root, targetFile).startsWith(`packages${path.sep}`)) continue;
      if (manifest.require?.[target.name] !== target.version) {
        failures.push(`${filename}:repositories[${index}] requires ${target.name} ${manifest.require?.[target.name]}, which declares ${target.version}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('tracked npm dependency graphs approve every install script by exact version', () => {
  const failures = [];
  for (const lockFile of trackedLockFiles()) {
    const directory = path.dirname(path.join(root, lockFile));
    const invalidApprovals = packageApprovalFailures(lockFile);
    const args = [
      'ci',
      '--dry-run',
      '--strict-allow-scripts',
      '--no-ignore-scripts',
      '--no-dangerously-allow-all-scripts',
      '--audit=false',
      '--fund=false',
      '--install-links=false',
    ];
    if (directory !== root) {
      args.push('--workspaces=false');
    }
    const result = execute(npm, args, directory);
    if (invalidApprovals.length > 0 || result.status !== 0) {
      failures.push({
        lockFile,
        invalidApprovals,
        installError: [result.stderr, result.stdout].filter(Boolean).join('\n').trim(),
      });
    }
  }
  assert.deepEqual(failures, []);
});

// Production entry points use their package's dependencies or peerDependencies.
test('production dependency checks reject a devDependency-only import', t => {
  const parent = path.join(root, 'var/tmp');
  mkdirSync(parent, { recursive: true });
  const fixture = mkdtempSync(path.join(parent, 'production-dependencies-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  writeFileSync(path.join(fixture, 'index.js'), "import { createElement } from 'react'; export { createElement };\n");
  writeFileSync(path.join(fixture, 'knip.json'), JSON.stringify({ entry: ['index.js!'], project: ['index.js!'] }));
  const run = (kind: string) => {
    writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ name: 'production-fixture', type: 'module', [kind]: { react: '19.2.8' } }));
    const knipFile = findPackageJSON('knip', import.meta.resolve('@polyspec/kit/package.json'));
    assert.ok(knipFile, 'the installed kit must provide its Knip dependency');
    const knipManifest = readJson<{ bin: { knip: string } }>(knipFile, { properties: { bin: { properties: { knip: { type: 'string' } }, additionalProperties: true } }, additionalProperties: true });
    const knip = path.resolve(path.dirname(knipFile), knipManifest.bin.knip);
    const result = spawnSync(process.execPath, [knip,
      '--directory', fixture, '--production', '--strict', '--include', 'unlisted', '--no-gitignore',
      '--no-progress', '--no-config-hints', '--reporter', 'json'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.error, undefined, result.error?.message ?? '');
    const report = checked<{ issues: { file: string; unlisted?: { name: string }[] }[] }>(JSON.parse(result.stdout), {
      properties: { issues: { elements: { properties: { file: { type: 'string' } },
        optionalProperties: { unlisted: { elements: { properties: { name: { type: 'string' } }, additionalProperties: true } } },
        additionalProperties: true } } }, additionalProperties: true,
    }, 'knip production report');
    return { status: result.status, names: report.issues.flatMap(issue => issue.unlisted?.map(item => item.name) ?? []) };
  };
  assert.deepEqual(run('devDependencies'), { status: 1, names: ['react'] });
  for (const kind of ['dependencies', 'peerDependencies']) {
    assert.deepEqual(run(kind), { status: 0, names: [] }, kind);
  }
});


for (const [target, workspace, tool] of [
  ['crudui-install-go-modules', path.join(root, 'go.work'), 'GO'],
] as const) {
  test(`Go workspace: ${target} exports its declared module scope`, { timeout: 10_000 }, () => {
    const fixture = mkdtempSync(path.join(root, 'var', 'go-workspace-'));
    try {
      const probe = path.join(fixture, 'environment.mjs');
      writeFileSync(probe, 'console.log(JSON.stringify({ workspace: process.env.GOWORK }));\n');
      const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;
      const result = spawnSync('make', ['--silent', '--no-print-directory', target,
        `${tool}=${quote(process.execPath)} ${quote(probe)}`, 'TAG=v0.0.8'],
      { cwd: root, env: makeEnvironment({ ...process.env, GOWORK: 'off' }), encoding: 'utf8', timeout: 5_000 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      const report = checked<{ workspace: string }>(JSON.parse(result.stdout),
        { properties: { workspace: { type: 'string' } } }, `${target} process environment`);
      assert.equal(report.workspace, workspace);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}


test('CI PHP installation consumes the Composer lock without resolving updates', () => {
  // The CI branch of the recipe is read from the Makefile text, so that no run impersonates the CI identity (C17.68).
  const makefile = readFileSync(path.join(root, 'Makefile'), 'utf8');
  const branch = /^ifeq \(\$\(GITHUB_ACTIONS\),true\)\n([\s\S]*?)^else\n/m.exec(makefile);
  const body = branch?.[1];
  assert.ok(body !== undefined, 'the crudui-install-composer recipe has a CI branch');
  assert.match(body, /\binstall --no-interaction --prefer-dist/);
  assert.doesNotMatch(body, /\bupdate\b/);
});
