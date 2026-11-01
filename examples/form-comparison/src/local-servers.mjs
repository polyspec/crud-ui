// Local server processes for the source-level record checks and the local run of the pipeline
// check: the five record servers and the public server, started from this checkout with their own
// ports, data directory and public directory (docs/operations/form-comparison.md, "Record servers").
import assert from 'node:assert/strict';
import { execFile, fork, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { recordFixtureFile, recordServers, recordSpecsFile } from './record-contract.mjs';
import { sourceIdentity } from './source-tree.mjs';
import { formatDuration, killProcessTree, runStages, stepHeartbeatMs } from './step-runner.mjs';

const execFileAsync = promisify(execFile);
export const exampleDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = path.resolve(exampleDirectory, '../..');
/**
 * The file that make ordered-json-ext writes with the folder of the OrderedJSON php-ext package that PIE built from the
 * packages.json repository of the release (C17.84, C17.90, C17.96).
 */
const orderedJsonPackageFile = 'var/ordered-json-package';

/**
 * The folder of the OrderedJSON php-ext package that make ordered-json-ext recorded, or undefined.
 */
async function pieOrderedJsonDirectory(root) {
  const folder = (await readFile(path.join(root, orderedJsonPackageFile), 'utf8').catch(() => '')).trim();
  if (folder === '') return undefined;
  return (await stat(path.join(folder, 'composer.json')).then(file => file.isFile(), () => false)) ? folder : undefined;
}

/** Print one progress line of the local server harness. */
function progress(write, text) {
  write(`[local-servers] ${text}\n`);
}

/**
 * The readiness line of a server: every server binds its address, port 0 included, and names the
 * address it took, so no port is chosen before the server that listens on it.
 */
const readyLine = server => new RegExp(`^CRUDUI_READY ${server} (127\\.0\\.0\\.1:\\d+)$`, 'm');
/** The loopback address on which a local server takes a port of the system. */
export const anyLoopbackPort = '127.0.0.1:0';

/**
 * The arguments of cp that copy the contents of the src directory of an unpacked OrderedJSON PHP extension
 * into `destination`. The source ends with a dot so that cp copies its contents; `path.join` drops that segment,
 * so the string is made here.
 */
export function orderedJsonCopyArguments(extension, destination, buildPath) {
  return ['-R', `${path.join(extension, buildPath)}${path.sep}.`, destination];
}

/**
 * The folder of the Composer package `name` that a checkout of the link declaration (.links) provides: kit's link providers
 * prints each Composer provider as the name, a tab and the folder (K1008), so no path of another repository is written here.
 */
async function linkedComposerFolder(name, { root, providers }) {
  const { stdout } = await providers(process.execPath, [fileURLToPath(import.meta.resolve('@polyspec/kit/link')), 'providers', '--ecosystem', 'composer'], { cwd: root });
  const line = stdout.split('\n').find(item => item.startsWith(`${name}\t`));
  assert.ok(line, `no checkout of .links provides ${name}, which LOCAL=1 builds; declare its checkout in .links`);
  return line.slice(name.length + 1);
}

/** Select the explicitly requested native provider and read its own extension identity. */
export async function orderedJsonProvider({ root = repositoryRoot, mode, providers = execFileAsync }) {
  assert.ok(mode === 'local' || mode === 'release', `Unknown native dependency mode: ${mode}`);
  let directory;
  if (mode === 'local') {
    directory = await linkedComposerFolder('polyspec/ordered-json-php-ext', { root, providers });
  } else {
    directory = await pieOrderedJsonDirectory(root);
    assert.ok(directory, `${orderedJsonPackageFile} names no OrderedJSON php-ext package; run make ordered-json-ext, which PIE builds (C17.84, C17.90)`);
  }
  const manifest = JSON.parse(await readFile(path.join(directory, 'composer.json'), 'utf8'));
  const extensionName = manifest['php-ext']?.['extension-name'];
  const buildPath = manifest['php-ext']?.['build-path'];
  assert.ok(typeof extensionName === 'string' && /^[a-z][a-z0-9_]*$/.test(extensionName), `${directory}/composer.json declares a native extension name`);
  assert.ok(typeof buildPath === 'string' && buildPath !== '' && !path.isAbsolute(buildPath)
    && !path.relative(directory, path.resolve(directory, buildPath)).split(path.sep).includes('..'), `${directory}/composer.json declares a package-relative build path`);
  assert.equal(typeof manifest.version, 'string', `${directory}/composer.json declares its version`);
  assert.ok((await stat(path.join(directory, buildPath, 'config.m4'))).isFile(), `${directory}/${buildPath}/config.m4 is a file`);
  return { directory, extensionName, buildPath, version: manifest.version, mode };
}

/** Prepare the explicit native Composer profile with its own native dependency and autoload records. */
async function prepareNativePhpAutoload({ directory, root = repositoryRoot, write = text => process.stdout.write(text) }) {
  const vendorDirectory = path.join(directory, 'vendor');
  const manifest = path.join(root, 'examples/form-comparison/servers/php/native/composer.json');
  await mkdir(directory, { recursive: true });
  const results = await runStages([[{
    id: 'native-php-composer', command: process.env.COMPOSER_BIN ?? 'composer',
    args: ['install', '--no-interaction', '--prefer-dist', '--no-scripts'], cwd: path.dirname(manifest),
    environment: { COMPOSER: manifest, COMPOSER_VENDOR_DIR: vendorDirectory,
      MISE_TRUSTED_CONFIG_PATHS: [process.env.MISE_TRUSTED_CONFIG_PATHS, root].filter(Boolean).join(path.delimiter) },
  }]], { label: 'local-servers', write });
  assert.equal(results[0]?.status, 'passed', `Native Composer installation ${results[0]?.status}`);
  const autoload = path.join(vendorDirectory, 'autoload.php');
  assert.ok((await stat(autoload)).isFile(), `Native Composer autoload is a file: ${autoload}`);
  return { autoload, manifest, vendorDirectory };
}

/**
 * The stages that build the OrderedJSON PHP extension of the package folder `provider.directory` in `copied`: its build
 * path is copied and built with phpize, configure and make, whether the folder is the release that PIE unpacked or a
 * checkout of .links. Only the package folder is read, never the repository around it (C18.18).
 */
export function orderedJsonBuildStages(provider, copied) {
  const build = path.join(copied, provider.buildPath);
  return [
    [{ id: 'ordered-json-php-directory', command: 'mkdir', args: ['-p', build], cwd: repositoryRoot }],
    [{ id: 'ordered-json-php-copy', command: 'cp', args: orderedJsonCopyArguments(provider.directory, build, provider.buildPath), cwd: repositoryRoot },
      { id: 'ordered-json-manifest-copy', command: 'cp', args: [path.join(provider.directory, 'composer.json'), path.join(copied, 'composer.json')], cwd: repositoryRoot }],
    [{ id: 'ordered-json-phpize', command: 'phpize', args: [], cwd: build }],
    [{ id: 'ordered-json-configure', command: './configure', args: [`--enable-${provider.extensionName.replaceAll('_', '-')}`], cwd: build }],
    [{ id: 'ordered-json-make', command: 'make', args: [], cwd: build }],
  ];
}

/**
 * Build what the five record servers run: the OrderedJSON PHP extension source, both PHP extensions and the
 * Go and Rust server binaries. Every build is one step that
 * runs to its end without a time limit and prints its output and progress.
 */
export async function prepareRecordServers({ buildDirectory, write = text => process.stdout.write(text) }) {
  const mode = process.env.LOCAL === '1' ? 'local' : 'release';
  const provider = await orderedJsonProvider({ mode });
  const nativeComposer = await prepareNativePhpAutoload({ directory: path.join(buildDirectory, 'php-native'), write });
  progress(write, `OrderedJSON ${provider.version}: ${provider.mode} ${provider.directory}`);
  const goBinary = path.join(buildDirectory, 'go-server');
  const step = (id, command, args, cwd = repositoryRoot, environment = {}) =>
    ({ id, command, args, cwd, environment });
  const copied = path.join(buildDirectory, 'ordered-json-php-ext');
  const build = path.join(copied, provider.buildPath);
  const nativeSteps = orderedJsonBuildStages(provider, copied).map(stage => stage.map(item => step(item.id, item.command, item.args, item.cwd)));
  const results = await runStages([[
    step('crudui-php-extension', 'make', ['build-php-ext']),
    step('go-server', 'go', ['build', '-trimpath', '-o', goBinary, '.'],
      path.join(exampleDirectory, 'servers/go'), { CGO_ENABLED: '0' }),
    step('rust-server', process.execPath, [path.join(repositoryRoot, 'scripts/run-rust-command.mts'),
      'build', '--locked'], path.join(exampleDirectory, 'servers/rust')),
  ], ...nativeSteps], { label: 'local-servers', write });
  const failed = results.find(result => result.status !== 'passed');
  assert.equal(failed, undefined, `Building ${failed?.id} ${failed?.status}`);
  return {
    cruduiModule: path.join(repositoryRoot, 'var/php-ext/polyspec_crudui.so'),
    orderedJsonModule: path.join(build, 'modules', `${provider.extensionName}.so`),
    orderedJsonExtensionName: provider.extensionName,
    nativePhpAutoload: nativeComposer.autoload,
    nativeComposerManifest: nativeComposer.manifest,
    nativeComposerVendor: nativeComposer.vendorDirectory,
    binaries: {
      go: goBinary,
      rust: path.join(exampleDirectory, 'servers/rust/target/debug/polyspec-crudui-form-comparison'),
    },
  };
}

/**
 * Write the files a record server reads from its public directory: the shared fixture, the record
 * specifications, the browser matrix and the source identity of this checkout.
 */
export async function recordPublicDirectory(directory) {
  await mkdir(directory, { recursive: true });
  await copyFile(path.join(exampleDirectory, 'fixtures', recordFixtureFile), path.join(directory, recordFixtureFile));
  await copyFile(path.join(exampleDirectory, 'fixtures', recordSpecsFile), path.join(directory, recordSpecsFile));
  await copyFile(path.join(exampleDirectory, 'src/runtime-paths.json'), path.join(directory, 'runtime-paths.json'));
  await writeFile(path.join(directory, 'source.json'), JSON.stringify(await sourceIdentity(repositoryRoot)) + '\n');
  return directory;
}

async function phpExtensionArguments(name) {
  try {
    await execFileAsync('php', ['-n', '-r', `exit(extension_loaded(${JSON.stringify(name)}) ? 0 : 1);`]);
    return [];
  } catch (error) { if (error.code !== 1) throw error;
    return ['-d', `extension=${name}`];
  }
}

/**
 * The process of one record server. Every server takes its listening address, its data directory,
 * its public directory and the source identity file; PHP takes them from its environment, which
 * PHP-FPM passes on to api.php.
 */
export async function recordServerProcess(server, { dataDirectory, publicDirectory, prepared }) {
  assert.ok(recordServers.includes(server), `Unknown record server: ${server}`);
  const address = anyLoopbackPort;
  const sourceFile = path.join(publicDirectory, 'source.json');
  if (server === 'php' || server === 'php-ext') {
    const common = [...await phpExtensionArguments('mbstring'), ...await phpExtensionArguments('dom')];
    const extensions = server === 'php-ext'
      ? ['-d', `extension=${prepared.orderedJsonModule}`, '-d', `extension=${prepared.cruduiModule}`] : [];
    return {
      server, address,
      command: process.execPath,
      args: [path.join(exampleDirectory, 'servers/php/main.mjs'), address, `${dataDirectory}-${server}-run`, '--',
        '-n', ...common, ...extensions, '-d', 'enable_post_data_reading=0', '-d', 'display_errors=0', '-d', 'log_errors=1'],
      environment: {
        FORM_PHP_SERVER: server,
        FORM_JSON_EXTENSION: prepared.orderedJsonExtensionName,
        ...(server === 'php-ext' ? { FORM_PHP_AUTOLOAD: prepared.nativePhpAutoload } : {}),
        FORM_DATA_DIRECTORY: dataDirectory,
        FORM_PUBLIC_DIRECTORY: publicDirectory,
        ...(server === 'php-ext' ? {
          FORM_CRUDUI_MODULE_SHA256: createHash('sha256').update(await readFile(prepared.cruduiModule)).digest('hex'),
        } : {}),
      },
      ready: readyLine(server),
    };
  }
  const programArguments = [address, dataDirectory, publicDirectory, sourceFile];
  if (server === 'js') {
    return {
      server, address, command: process.execPath,
      args: [path.join(exampleDirectory, 'servers/javascript/main.mjs'), ...programArguments],
      environment: {}, ready: readyLine('js'),
    };
  }
  return {
    server, address, command: prepared.binaries[server], args: programArguments, environment: {},
    ready: readyLine(server),
  };
}

// Every process group a local stack started and has not stopped. A test process that ends without
// stopping them, for example after a failed hook and a forced exit, stops them at its exit, so no
// server outlives the run that started it.
const startedGroups = new Set();
process.on('exit', () => {
  for (const pid of startedGroups) {
    try { process.kill(-pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH' && error.code !== 'EPERM') throw error; }
  }
});

/**
 * Start one process and wait for its readiness line, then require that it answers on the address
 * that the line names. A process start is a long operation without a time limit: it prints a line with its
 * elapsed time every heartbeat while it waits, and a process that exits before its readiness fails
 * with its output.
 */
export async function startProcess(definition, { write = text => process.stdout.write(text), ipc = false, message } = {}) {
  const started = performance.now();
  progress(write, `${definition.server}: starting on ${definition.address}`);
  const environment = { ...process.env, ...definition.environment };
  delete environment.NODE_TEST_CONTEXT;
  const options = {
    env: environment, detached: true,
    stdio: ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
  };
  const child = ipc
    ? fork(definition.args[0], definition.args.slice(1), { ...options, execPath: definition.command, execArgv: [] })
    : spawn(definition.command, definition.args, options);
  if (message) child.send(message);
  startedGroups.add(child.pid);
  child.once('exit', () => startedGroups.delete(child.pid));
  let output = '';
  let address;
  const ready = new Promise((resolve, reject) => {
    const timer = setInterval(() => progress(write,
      `${definition.server}: waiting for readiness (${formatDuration(performance.now() - started)})`), stepHeartbeatMs);
    const onData = chunk => {
      const text = chunk.toString();
      output += text;
      for (const line of text.split('\n').filter(Boolean)) write(`[${definition.server}] ${line}\n`);
      const announced = definition.ready.exec(output);
      if (announced) { clearInterval(timer); address = announced[1]; resolve(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('error', error => { clearInterval(timer); reject(error); });
    child.once('exit', (code, signal) => {
      clearInterval(timer);
      reject(new Error(`${definition.server} exited (${signal ?? code}) before readiness:\n${output}`));
    });
  });
  try {
    await ready;
    const origin = `http://${address}`;
    try {
      await fetch(`${origin}/`, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      throw new Error(`${definition.server} announced readiness on ${address} but does not listen there`, { cause: error });
    }
    progress(write, `${definition.server}: ready on ${address} in ${formatDuration(performance.now() - started)}`);
    return { child, origin, address, port: Number(address.slice(address.lastIndexOf(':') + 1)), stop: () => killProcessTree(child, 2_000) };
  } catch (error) {
    await killProcessTree(child, 1_000);
    throw error;
  }
}

/**
 * The public server of a local stack. It takes its address, data directory, public directory and the
 * port of every native record server, and receives the build state from its parent over IPC.
 */
export function publicServerDefinition({ dataDirectory, publicDirectory, ports }) {
  const address = anyLoopbackPort;
  return {
    server: 'public', address, command: process.execPath,
    args: [path.join(exampleDirectory, 'server.mjs'), address, dataDirectory, publicDirectory, JSON.stringify(ports)],
    environment: {}, ready: readyLine('public'),
  };
}

/**
 * Build and start one local stack under `root`: the record server programs, the public directory
 * (`build.mjs`), the four native record servers and the public server, which is also the
 * JavaScript record server. Every server takes a port of the system on 127.0.0.1 and names it on
 * its readiness line; the public server starts with those ports. `processes` receives every
 * started process, also when a later start fails, so the caller stops them. Returns the origin of
 * the public server and the directories and builds of the stack.
 */
export async function startLocalStack({ root, processes, write = text => process.stdout.write(text) }) {
  const publicDirectory = path.join(root, 'public');
  const dataDirectory = path.join(root, 'data');
  await mkdir(dataDirectory, { recursive: true });
  const prepared = await prepareRecordServers({ buildDirectory: path.join(root, 'bin'), write });
  const [build] = await runStages([[{
    id: 'public-build', command: process.execPath,
    args: [path.join(exampleDirectory, 'build.mjs'), publicDirectory], cwd: repositoryRoot, environment: {},
  }]], { label: 'local-servers', write });
  assert.equal(build.status, 'passed', `public build ${build.status}`);
  const source = await sourceIdentity(repositoryRoot);
  await writeFile(path.join(publicDirectory, 'source.json'), JSON.stringify(source) + '\n');
  const servers = recordServers.filter(name => name !== 'js');
  const definitions = await Promise.all(servers.map(server => recordServerProcess(server, { dataDirectory, publicDirectory, prepared })));
  const started = await Promise.allSettled(definitions.map(definition => startProcess(definition, { write })));
  processes.push(...started.filter(result => result.status === 'fulfilled').map(result => result.value));
  const failed = started.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  const ports = Object.fromEntries(servers.map((server, index) => [server, started[index].value.port]));
  const publicServer = publicServerDefinition({ dataDirectory, publicDirectory, ports });
  processes.push(await startProcess(publicServer, { write, ipc: true, message: { status: 'ready', cycle: 1, source, error: null } }));
  return { origin: processes.at(-1).origin, publicDirectory, dataDirectory, prepared, source };
}
