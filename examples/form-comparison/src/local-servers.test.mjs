// A local stack never outlives the test process that started it: a process that ends without
// stopping its servers, for example after a failed hook and a forced exit, stops every server it
// started. The case starts a stand-in server through `startProcess` in a child process that then
// exits; the server keeps a connection to a Unix socket of the case open, so the end of that
// connection shows that it is gone, and the case's own timeout fails a server that survives or
// never connects.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { anyLoopbackPort, orderedJsonBuildStages, orderedJsonCopyArguments, publicServerDefinition, startProcess } from './local-servers.mjs';

const { orderedJsonProvider } = await import('./local-servers.mjs');

const localServers = pathToFileURL(path.join(import.meta.dirname, 'local-servers.mjs')).href;

test('a process that exits without stopping its local servers stops them', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crudui-local-servers-'));
  const socket = path.join(directory, 'held.sock');
  // The stand-in server records its process id, connects to the socket of the case, listens,
  // announces readiness and runs until it is stopped. A stand-in that survives a failed case is
  // stopped after it.
  const pidFile = path.join(directory, 'stand-in.pid');
  const holder = net.createServer();
  await new Promise(resolve => holder.listen(socket, resolve));
  const connected = new Promise(resolve => holder.once('connection', resolve));
  t.after(async () => {
    let pid;
    try { pid = Number(await readFile(pidFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (pid) try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    holder.close();
    await rm(directory, { recursive: true, force: true });
  });
  const server = [
    `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`,
    `require('node:net').connect(${JSON.stringify(socket)});`,
    "const [host, port] = process.argv[1].split(':');",
    "const server = require('node:http').createServer((request, response) => response.end('ok'));",
    "server.listen(Number(port), host, () => console.log('CRUDUI_READY stand-in 127.0.0.1:' + server.address().port));",
  ].join('\n');
  const script = path.join(directory, 'stack.mjs');
  await writeFile(script, [
    `import { anyLoopbackPort, startProcess } from ${JSON.stringify(localServers)};`,
    `await startProcess({ server: 'stand-in', address: anyLoopbackPort, command: process.execPath, args: ['-e', ${JSON.stringify(server)}, anyLoopbackPort], environment: {}, ready: /^CRUDUI_READY stand-in (127\\.0\\.0\\.1:\\d+)$/m }, { write: () => {} });`,
    // The process ends without stopping the server, as a forced exit after a failed hook does.
    'process.exit(0);',
  ].join('\n'));
  const stack = spawn(process.execPath, [script], { stdio: ['ignore', 'inherit', 'inherit'] });
  const exited = new Promise(resolve => stack.once('exit', resolve));
  const connection = await connected;
  const gone = new Promise(resolve => connection.once('close', resolve).resume());
  assert.equal(await exited, 0);
  await gone;
});

// A server takes a port of the system and names it on its readiness line, so no port is chosen
// before the server that listens on it; startProcess reaches the server on the named address.
test('a server on port 0 is reached on the address that its readiness line names', async () => {
  const server = [
    "const server = require('node:http').createServer((request, response) => response.end('ok'));",
    "server.listen(0, '127.0.0.1', () => console.log('CRUDUI_READY stand-in 127.0.0.1:' + server.address().port));",
  ].join('\n');
  const running = await startProcess({ server: 'stand-in', address: anyLoopbackPort, command: process.execPath, args: ['-e', server], environment: {}, ready: /^CRUDUI_READY stand-in (127\.0\.0\.1:\d+)$/m }, { write: () => {} });
  try {
    assert.match(running.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.notEqual(running.port, 0);
    assert.equal(await (await fetch(`${running.origin}/`)).text(), 'ok');
  } finally {
    await running.stop();
  }
});

test('an IPC service does not inherit the test process preload or test context', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crudui-service-runtime-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const preload = path.join(directory, 'preload.mjs');
  const service = path.join(directory, 'service.mjs');
  const parent = path.join(directory, 'parent.mjs');
  await writeFile(preload, 'globalThis.testPreload = true;');
  await writeFile(service, [
    "import http from 'node:http';",
    'process.once("message", message => {',
    '  const server = http.createServer((request, response) => response.end(JSON.stringify({',
    '    execArgv: process.execArgv, context: process.env.NODE_TEST_CONTEXT ?? null,',
    '    preload: globalThis.testPreload ?? false, argument: process.argv[2],',
    '    environment: process.env.CRUDUI_SERVICE_FIXTURE, message,',
    '  })));',
    '  server.listen(0, "127.0.0.1", () => console.log("CRUDUI_READY stand-in 127.0.0.1:" + server.address().port));',
    '});',
  ].join('\n'));
  await writeFile(parent, [
    "import assert from 'node:assert/strict';",
    `import { startProcess, anyLoopbackPort } from ${JSON.stringify(localServers)};`,
    'assert.equal(globalThis.testPreload, true);',
    'assert.equal(process.env.NODE_TEST_CONTEXT, "service-parent");',
    `const running = await startProcess({ server: 'stand-in', address: anyLoopbackPort, command: process.execPath, args: [${JSON.stringify(service)}, 'service-argument'], environment: { CRUDUI_SERVICE_FIXTURE: 'preserved' }, ready: /^CRUDUI_READY stand-in (127\\.0\\.0\\.1:\\d+)$/m }, { write: () => {}, ipc: true, message: { status: 'ready' } });`,
    'try {',
    '  for (let request = 0; request < 2; request++) {',
    '    const actual = await (await fetch(running.origin)).json();',
    '    assert.deepEqual(actual, { execArgv: [], context: null, preload: false, argument: "service-argument", environment: "preserved", message: { status: "ready" } });',
    '  }',
    '} finally { await running.stop(); }',
  ].join('\n'));
  const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, parent], {
    env: { ...process.env, NODE_TEST_CONTEXT: 'service-parent' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  child.stdout.resume();
  child.stderr.setEncoding('utf8').on('data', text => { errors += text; });
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  assert.deepEqual(status, { code: 0, signal: null }, errors);
});

// Two verification runs at the same time each start the public server of a local stack: each takes
// a port of the system, so both start and answer on ports of their own.
test('the public servers of two local stacks start at the same time on ports of their own', async t => {
  const { formServers } = await import('./runtime-paths.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'crudui-public-servers-'));
  const running = [];
  t.after(async () => {
    await Promise.all(running.map(server => server.stop()));
    await rm(root, { recursive: true, force: true });
  });
  const ports = Object.fromEntries(formServers.map((server, index) => [server, 1 + index]));
  const definitions = ['first', 'second'].map(run => publicServerDefinition({
    dataDirectory: path.join(root, run, 'data'), publicDirectory: path.join(root, run, 'public'), ports,
  }));
  const started = await Promise.allSettled(definitions.map(definition => startProcess(definition,
    { write: () => {}, ipc: true, message: { status: 'ready', cycle: 1, source: null, error: null } })));
  running.push(...started.filter(result => result.status === 'fulfilled').map(result => result.value));
  assert.deepEqual(started.map(result => result.status), ['fulfilled', 'fulfilled'],
    started.map(result => result.reason?.message).filter(Boolean).join('\n'));
  assert.notEqual(running[0].port, running[1].port);
  for (const server of running) assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
});

test('no program reserves a port by listening and closing before another process binds it', async () => {
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files', '*.mjs', '*.js'], { cwd: path.join(import.meta.dirname, '../../..'), encoding: 'utf8' }).split('\n').filter(Boolean);
  const violations = [];
  for (const file of files) {
    let source;
    try { source = await readFile(path.join(import.meta.dirname, '../../..', file), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; continue; }
    if (/\bfreePort\b|listen\(0,[^\n]*\n[^\n]*\.address\(\)[^\n]*\n[^\n]*\.close\(/.test(source)) violations.push(file);
  }
  assert.deepEqual(violations, []);
});

test('the local pipeline stack has no summed hook limit and starts and stops in setups and teardowns', async () => {
  for (const file of ['../pipeline.browser.mjs', '../record-stores.test.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /prepareLimitMs|stackStartLimitMs|pipelineBrowserLimitMs|\d_000 \+ \d/, `${file} sums no limits`);
    // The browser launch, the stack start and their stops are long operations without a hook limit.
    assert.match(source, /from '@polyspec\/kit\/test-hooks'/, `${file} uses setup and teardown`);
    assert.doesNotMatch(source, /^\s*(?:before|after)\(/m, `${file} has no hook of its own`);
  }
  const stack = await readFile(new URL('../pipeline.browser.mjs', import.meta.url), 'utf8');
  assert.match(stack, /setup\('browser launch'/);
  assert.match(stack, /teardown\('browser close'/);
});

test('the copy of the unpacked OrderedJSON extension source puts config.m4 at the top of the destination', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crudui-ordered-json-copy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const extension = path.join(directory, 'extension');
  const destination = path.join(directory, 'copied');
  await mkdir(path.join(extension, 'src'), { recursive: true });
  await mkdir(destination);
  await writeFile(path.join(extension, 'src/config.m4'), 'PHP_ARG_ENABLE([ordered-json])\n');
  await new Promise((resolve, reject) => {
    spawn('cp', orderedJsonCopyArguments(extension, destination, 'src'), { stdio: 'inherit' })
      .once('error', reject)
      .once('close', status => (status === 0 ? resolve() : reject(new Error(`cp ended with status ${status}`))));
  });
  await access(path.join(destination, 'config.m4'));
});


test('local OrderedJSON native sources come from the Composer provider of the link declaration (C18.18)', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'crudui-ordered-json-provider-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const provider = path.join(root, 'checkout/legacy/packages/php-ext');
  await mkdir(path.join(provider, 'src'), { recursive: true });
  await writeFile(path.join(provider, 'composer.json'), JSON.stringify({
    name: 'polyspec/ordered-json-php-ext', version: '0.0.10',
    'php-ext': { 'extension-name': 'polyspec_ordered_json', 'build-path': 'src' },
  }));
  await writeFile(path.join(provider, 'src/config.m4'), 'PHP_ARG_ENABLE([polyspec-ordered-json])\n');
  // kit's link providers prints each Composer provider of .links as the name, a tab and the folder (K1008).
  const calls = [];
  const providers = async (executable, args, options) => {
    calls.push({ executable, args, cwd: options?.cwd });
    return { stdout: `polyspec/other-php\t/elsewhere\npolyspec/ordered-json-php-ext\t${provider}\n` };
  };
  const selected = await orderedJsonProvider({ root, mode: 'local', providers });
  assert.deepEqual(selected, {
    directory: provider, extensionName: 'polyspec_ordered_json', buildPath: 'src', version: '0.0.10', mode: 'local',
  });
  assert.deepEqual(calls, [{ executable: process.execPath,
    args: [fileURLToPath(import.meta.resolve('@polyspec/kit/link')), 'providers', '--ecosystem', 'composer'], cwd: root }]);
  // Without a provider of the package in .links, LOCAL=1 has no source and fails by name.
  await assert.rejects(orderedJsonProvider({ root, mode: 'local', providers: async () => ({ stdout: '' }) }),
    /polyspec\/ordered-json-php-ext/);
});

test('a local and a release OrderedJSON extension build only from their package folder (C18.18)', () => {
  const provider = { directory: '/links/ordered-json/legacy/packages/php-ext', extensionName: 'polyspec_ordered_json', buildPath: 'src', version: '0.0.19' };
  const local = orderedJsonBuildStages({ ...provider, mode: 'local' }, '/build/ordered-json-php-ext');
  assert.deepEqual(local, orderedJsonBuildStages({ ...provider, mode: 'release' }, '/build/ordered-json-php-ext'));
  for (const item of local.flat()) {
    assert.ok(!item.cwd.startsWith('/links/ordered-json/') || item.cwd.startsWith(provider.directory), `${item.id} runs in the package folder or the build`);
    for (const argument of item.args) assert.ok(!argument.startsWith('/links/') || argument.startsWith(provider.directory), `${item.id} reads only the package folder`);
  }
  assert.deepEqual(local.at(-1), [{ id: 'ordered-json-make', command: 'make', args: [], cwd: '/build/ordered-json-php-ext/src' }]);
});

test('the release native source is the OrderedJSON php-ext package that make ordered-json-ext recorded (C17.84, C17.90)', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'crudui-ordered-json-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'pie/vendor/polyspec/ordered-json-php-ext');
  await mkdir(path.join(root, 'var'), { recursive: true });
  await writeFile(path.join(root, 'var/ordered-json-package'), `${directory}\n`);
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await writeFile(path.join(directory, 'composer.json'), JSON.stringify({ version: '0.0.9',
    'php-ext': { 'extension-name': 'ordered_json', 'build-path': 'src' } }));
  await writeFile(path.join(directory, 'src/config.m4'), 'PHP_ARG_ENABLE([ordered-json])\n');
  assert.deepEqual(await orderedJsonProvider({ root, mode: 'release' }), {
    directory, extensionName: 'ordered_json', buildPath: 'src', version: '0.0.9', mode: 'release',
  });
});
