import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkedShape, shapeOf } from './json-schema.mts';

// The shapes that the helpers of this script check (kit K157, K158): an object, an array, a string and an array of strings.
const STRINGS = shapeOf<string[]>({ type: 'array', items: { type: 'string' } });

// Polyspec\\Crudui\\Docs\\DocCoverage loads through the autoload-dev of the development root vendor/.
const rootAutoload = fileURLToPath(new URL('../vendor/autoload.php', import.meta.url));
const repository = fileURLToPath(new URL('..', import.meta.url));
const literal = (value: string): string => "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
/** The planted autoload.php of vendor (false: none) and an extra PHP file outside src. */
interface CheckOptions {
  autoload?: string | false;
  other?: string;
}
function check(source: string, options: CheckOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'crudui-php-doc-'));
  try {
    mkdirSync(join(root, 'src')); mkdirSync(join(root, 'vendor'));
    writeFileSync(join(root, 'src/Example.php'), source);
    if (options.autoload !== false) writeFileSync(join(root, 'vendor', 'autoload.php'), options.autoload ?? "<?php require __DIR__ . '/../src/Example.php';");
    if (options.other) writeFileSync(join(root, 'Other.php'), options.other);
    const command = `require ${literal(rootAutoload)}; echo json_encode(\\Polyspec\\Crudui\\Docs\\DocCoverage::gaps(${literal(join(root, 'src'))}, ${literal(join(root, 'vendor', 'autoload.php'))}));`;
    return spawnSync(process.env.PHP ?? 'php', ['-r', command], { encoding: 'utf8' });
  } finally { rmSync(root, { recursive: true }); }
}
test('PHP checker rejects missing Composer autoload', () => {
  const result = check('<?php class Example {}', { autoload: false });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Composer autoload is required/);
});
test('PHP checker reports an unresolved own class', () => {
  const result = check('<?php namespace Coverage; /** Example. */ class Example {}', { autoload: '<?php' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['Coverage\\Example (source declaration cannot be loaded)']);
});
test('PHP checker rejects a class loaded from another source file', () => {
  const result = check('<?php namespace Coverage; /** Example. */ class Example {}', { autoload: "<?php require __DIR__ . '/../Other.php';", other: '<?php namespace Coverage; /** Other. */ class Example {}' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['Coverage\\Example (loaded class does not match its source file)']);
});
test('PHP checker reports missing class and public method documentation', () => {
  const result = check('<?php namespace Coverage; class Example { public function run(): void {} private function helper(): void {} }');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['Coverage\\Example', 'Coverage\\Example::run()']);
});
test('PHP tokenizer handles readonly classes and excludes anonymous classes and class constants', () => {
  const result = check(`<?php namespace Coverage; /** Example. */ readonly class Example { /** Execute. */ public function run(): string { $object = new class {}; return self::class; } }`);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), []);
});
test('PHP enums require source docs without requiring docs on runtime-generated methods', () => {
  const result = check('<?php namespace Coverage; /** Choice. */ enum Choice: string { case One = "one"; }');
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), []);
});
test('PHP checker rejects a source tree without declarations', () => {
  const result = check('<?php');
  assert.equal(result.status, 0, result.stderr); assert.match(checkedShape(STRINGS, JSON.parse(result.stdout), 'the problems of the PHP checker')[0] ?? '', /no class declarations found/);
});

// Package source documentation belongs to the documentation tool; PHP's source process loads no extension argument.
for (const packageName of ['generator', 'validator']) {
  test(`${packageName} PHP package source and public documentation match their loaded declarations`, () => {
    const directory = join(repository, 'legacy/packages', packageName, 'php/src');
    const command = `require ${literal(rootAutoload)}; echo json_encode(\\Polyspec\\Crudui\\Docs\\DocCoverage::gaps(${literal(directory)}));`;
    const result = spawnSync(process.env.PHP ?? 'php', ['-r', command], { cwd: repository, encoding: 'utf8' });
    assert.equal(result.error, undefined, result.error?.message ?? '');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(checkedShape(STRINGS, JSON.parse(result.stdout), `${packageName} PHP source documentation`), []);
  });
}

test('PHP checker rejects a native class in place of its declared package source', () => {
  const result = check('<?php /** Source declaration. */ class DateTime {}', { autoload: '<?php' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(checkedShape(STRINGS, JSON.parse(result.stdout), 'native source mismatch'),
    ['DateTime (loaded class does not match its source file)']);
});
