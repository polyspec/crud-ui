import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Runtimes share one comparison: values and object member order at every depth.
import { equalModels, equalOrdered } from '../../legacy/tests/native-generators/protocol.mts';
import { encodeJson, decodeJson } from './src/json.mjs';
import { readFrameDocument } from './src/frame-document.mjs';
import { frameUrl } from './src/frame-readiness.mjs';
import { phpClassProvenanceFailure } from './src/php-provenance.mjs';
import { formFrameworks, formRenderingPaths, formServers } from './src/runtime-paths.mjs';
import { specFor } from './src/scenario.mjs';
import { assertSourceIdentity, sameSourceIdentity } from './src/source-identity.mjs';

export const generationServers = formServers;
export const generationRenderingPaths = formRenderingPaths;
export const generationFrameworks = formFrameworks;
export const requiredCombinationIds = Object.freeze([
  'load-current-record',
  'compile-reference',
  'reject-missing-reference',
  'render-and-inject/nested-order',
  'render-and-inject/explicit-empty',
  'render-and-inject/default-rows',
  'render-and-inject/stored-en',
  'render-and-inject/stored-ko',
  'frame-document',
  'ssr/en',
  'ssr/ko',
  'reject-ssr-request',
  'reject-invalid-render-data',
  'stored-record-unchanged',
]);
/**
 * Queries every server must reject with one message: the SSR frame document is addressed by
 * exactly `lang`, `server` and `initialization`, each once, with the server's own runtime.
 */
const ssrRejectedQueries = Object.freeze([
  '', '?lang=ko', '?lang=ko&server={server}', '?lang=ko&initialization=ssr',
  '?server={server}&initialization=ssr', '?lang=de&server={server}&initialization=ssr',
  '?lang=ko&server={other}&initialization=ssr', '?lang=ko&server={server}&initialization=csr',
  '?lang=ko&lang=en&server={server}&initialization=ssr',
  '?lang=ko&server={server}&initialization=ssr&language=ko',
]);
const ssrRequestError = 'Expected lang, server and initialization for this SSR frame';
const servers = generationServers;
const renderingPaths = generationRenderingPaths;
const frameworks = generationFrameworks;
const requiredSharedIds = ['library-and-source', 'unchanged-library-inputs'];
export const expectedGenerationCombinations =
  servers.length * renderingPaths.length * frameworks.length;
const requestsPerId = id => id.startsWith('render-and-inject/') ? 2
  : id === 'reject-ssr-request' ? ssrRejectedQueries.length : 1;
const requestsPerCombination = requiredCombinationIds.reduce((total, id) =>
  total + requestsPerId(id), 0);
export const expectedGenerationResults =
  expectedGenerationCombinations * requiredCombinationIds.length + requiredSharedIds.length;
export const expectedGenerationRequests = expectedGenerationCombinations
  * requestsPerCombination + 3;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const rowKey = sequence => `__${String(sequence).padStart(13, '0')}__`;
const deserialize = value => decodeJson(new TextEncoder().encode(value));
const errorRecord = error => ({ name: error.name, message: error.message, stack: error.stack });

export function assertGenerationReportInvariants(report) {
  assert.deepStrictEqual(report.servers, servers, 'Generation report server targets differ');
  assert.deepStrictEqual(report.renderingPaths, renderingPaths,
    'Generation report rendering paths differ');
  assert.deepStrictEqual(report.frameworks, frameworks, 'Generation report framework targets differ');
  assert.ok(Array.isArray(report.results), 'Generation report results are missing');
  assert.ok(Array.isArray(report.requests), 'Generation report requests are missing');

  const combinations = new Map(servers.flatMap(server => renderingPaths.flatMap(renderingPath =>
    frameworks.map(framework => [`${server}/${renderingPath}/${framework}`, []]))));
  const observed = new Set();
  const shared = [];
  for (const result of report.results) {
    if (result.server === 'shared' && result.path === 'all' && result.framework === 'all') {
      shared.push(result.id);
      continue;
    }
    const key = `${result.server}/${result.path}/${result.framework}`;
    assert.ok(combinations.has(key), `Unexpected generation result combination: ${key}`);
    observed.add(key);
    combinations.get(key).push(result.id);
  }
  assert.equal(observed.size, expectedGenerationCombinations,
    `Generation report must cover ${expectedGenerationCombinations} server/rendering-path/framework combinations`);
  for (const [key, ids] of combinations) {
    assert.deepStrictEqual(ids, requiredCombinationIds, `${key}: required generation check IDs or order differ`);
    const results = report.results.filter(result =>
      `${result.server}/${result.path}/${result.framework}` === key);
    const compile = results.find(result => result.id === 'compile-reference');
    const rejected = results.find(result => result.id === 'reject-missing-reference');
    const renders = results.filter(result => result.id.startsWith('render-and-inject/'));
    if (compile.passed && rejected.passed && renders.every(result => result.passed)) {
      const hash = compile.evidence?.serializedTemplateSha256;
      assert.match(hash ?? '', /^[a-f0-9]{64}$/, `${key}: missing serialized template evidence`);
      assert.equal(rejected.evidence?.retainedTemplateSha256, hash, `${key}: rejected compile did not retain the serialized template`);
      const expectedReads = compile.server === 'go' || compile.server === 'rust' ? 1 : null;
      assert.equal(compile.evidence?.referenceReads, expectedReads, `${key}: reference read evidence differs`);
      for (const render of renders) {
        assert.equal(render.evidence?.afterRejectedCompile, true, `${key}/${render.id}: missing rejected-compile reuse evidence`);
        assert.equal(render.evidence?.serializedTemplateSha256, hash, `${key}/${render.id}: serialized template differs`);
      }
    }
  }
  const codeUnitOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  assert.deepStrictEqual([...shared].sort(codeUnitOrder), [...requiredSharedIds].sort(codeUnitOrder), 'Shared generation check IDs differ');
  assert.equal(report.results.length, expectedGenerationResults, `Generation report must contain exactly ${expectedGenerationResults} results`);
  assert.equal(report.requests.length, expectedGenerationRequests, `Generation report must contain exactly ${expectedGenerationRequests} HTTP requests`);
}

export function finalizeGenerationReport(report, finishedAt = new Date().toISOString()) {
  report.finishedAt = finishedAt;
  report.requestCount = report.requests.length;
  try {
    assertGenerationReportInvariants(report);
    report.invariants = {
      passed: true, results: expectedGenerationResults,
      requests: expectedGenerationRequests, combinations: expectedGenerationCombinations,
    };
  } catch (error) {
    report.invariants = { passed: false, error: errorRecord(error) };
    report.results.push({ server: 'shared', path: 'all', framework: 'all',
      id: 'checker-invariants', passed: false, error: errorRecord(error) });
  }
  report.passed = report.results.filter(result => result.passed).length;
  report.failed = report.results.length - report.passed;
  return report;
}

function argumentsFor(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index], value = argv[index + 1];
    if (!['--url', '--library', '--report'].includes(name) || !value || args.has(name)) {
      throw new Error('Usage: node check-generation.mjs --url URL --library /absolute/library --report new-report.json');
    }
    args.set(name, value);
  }
  if (args.size !== 3 || !path.isAbsolute(args.get('--library'))) {
    throw new Error('An explicit URL, absolute library directory and new report path are required');
  }
  const url = new URL(args.get('--url'));
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
    throw new Error('Expected an HTTP URL without credentials, query or fragment');
  }
  return { url: url.href.replace(/\/$/, ''), library: args.get('--library'), report: path.resolve(args.get('--report')) };
}

/** Compare one rendered form: record data, complete field models and raw HTML, each with member order. */
export function equalRendered(actual, expected) {
  equalOrdered(actual.data, expected.data, '$.data');
  equalModels(actual.fields, expected.fields, '$.fields');
  assert.equal(actual.html, expected.html, 'Raw form HTML differs');
}

export function assertGenerationProvenance(actual, server, source, sourceDirectory) {
  assert.ok(object(actual), 'Missing generator provenance');
  assert.equal(actual.runtime, server, 'Incorrect generator runtime');
  assert.ok(sameSourceIdentity(actual.source, source), 'Incorrect generator source identity');
  if (server === 'php' || server === 'php-ext') {
    const native = server === 'php-ext';
    assert.equal(actual.nativeCRUDUI, native, 'Incorrect PHP generator implementation');
    if (native) assert.match(actual.moduleSha256, /^[a-f0-9]{64}$/, 'Missing native CRUDUI module hash');
    else assert.equal(actual.moduleSha256, null, 'Composer mode reports a native CRUDUI module');
    const classFailure = phpClassProvenanceFailure(
      actual.classes, native, sourceDirectory);
    assert.equal(classFailure, null,
      classFailure === null ? undefined : `Incorrect PHP class provenance: ${classFailure}`);
  }
}

async function artifacts(library) {
  const result = {};
  for (const packageName of ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', 'react']) {
    const base = path.join(library, 'packages', packageName);
    result[`packages/${packageName}/package.json`] = digest(await readFile(path.join(base, 'package.json')));
    async function collect(directory) {
      const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(file);
        else if (entry.isFile()) result[path.relative(library, file)] = digest(await readFile(file));
        else throw new Error(`Unsupported build artifact: ${file}`);
      }
    }
    await collect(path.join(base, 'dist'));
  }
  for (const file of ['check-generation.mjs', 'check-generation.test.mjs', 'src/json.mjs', 'src/scenario.mjs', 'fixtures/customer-specs.json', 'package-lock.json']) {
    const input = file === 'package-lock.json'
      ? path.join(library, file)
      : new URL(file, import.meta.url);
    result[`comparison/${file}`] = digest(await readFile(input));
  }
  return result;
}

function fixtureData() {
  const store = (name, enabled, departments) => ({ name, enabled, detail: 'Notes <&>\n메모', title: { ko: `${name} 제목`, en: `${name} title` }, departments });
  return { companies: {
    [rowKey(5)]: { name: 'Five & 다섯', stores: { [rowKey(42)]: store('First', '1', { [rowKey(7)]: { name: 'Seven' }, [rowKey(1)]: { name: 'One' } }) } },
    [rowKey(7)]: { name: 'Seven', stores: {} },
    [rowKey(1)]: { name: 'One', stores: { [rowKey(9)]: store('Hidden notes', '', {}) } },
  } };
}

function freshDefaults(data) {
  function oneRow(rows) {
    assert.ok(object(rows), 'Default collection must be an object');
    const keys = Object.keys(rows);
    assert.equal(keys.length, 1, 'An omitted collection must create one default row');
    assert.match(keys[0], /^__[0-9a-f]{13}__$/, 'Default row has an invalid generated key');
    return keys[0];
  }
  const company = oneRow(data.companies), store = oneRow(data.companies[company].stores);
  const department = oneRow(data.companies[company].stores[store].departments);
  equalOrdered(data, { companies: { [company]: { stores: { [store]: {
    enabled: '1', departments: { [department]: {} },
  } } } } }, 'Materialized defaults');
}

function allNodes(node) {
  return [node, ...(node.childNodes ?? []).flatMap(allNodes)];
}

/**
 * An SSR frame document is the built frame page with three insertions by the server: the
 * language, the rendered form and the record payload. Everything else is the built page.
 */
function checkDocument(parse, markup, frame, expected, server, language, source, sourceDirectory) {
  const document = readFrameDocument(parse, markup, 'ssr');
  assert.equal(document.frame, frame, 'SSR response changed the built frame document');
  assert.equal(document.language, language, 'SSR language differs');
  assert.equal(document.form, expected.html, 'SSR response contains different raw form HTML');
  const payload = decodeJson(new TextEncoder().encode(document.payload));
  assert.deepStrictEqual(Object.keys(payload), ['data', 'generator'], 'SSR payload members differ');
  equalOrdered(payload.data, expected.data, 'SSR payload record');
  assertGenerationProvenance(payload.generator, server, source, sourceDirectory);
  const inputs = allNodes(parse(document.form))
    .filter(node => ['input', 'textarea', 'select'].includes(node.tagName));
  return {
    controls: inputs.length, rawHtmlSha256: digest(document.form),
    payloadSha256: digest(document.payload), scriptExecution: false,
  };
}

async function main() {
  const options = argumentsFor(process.argv.slice(2));
  await mkdir(path.dirname(options.report), { recursive: true });
  const output = await open(options.report, 'wx');
  const report = {
    startedAt: new Date().toISOString(), url: options.url, library: options.library,
    servers, renderingPaths, frameworks, requests: [], results: [],
  };
  let compileForm, createForm, renderForm, parse, source, template, publicSpec, beforeArtifacts;
  const check = async (server, renderingPath, framework, id, action) => {
    const result = { server, path: renderingPath, framework, id, passed: false };
    try { result.evidence = await action(); result.passed = true; }
    catch (error) { result.error = errorRecord(error); }
    report.results.push(result);
    process.stdout.write(`${server}/${renderingPath}/${framework}/${id}: ${result.passed ? 'PASS' : `FAIL ${result.error.message.split('\n')[0]}`}\n`);
    return result.passed;
  };
  async function request(endpoint, body, server, expectedStatus = 200, html = false) {
    const record = { endpoint, method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { request: body }) };
    report.requests.push(record);
    try {
      const response = await fetch(`${options.url}${endpoint}`, {
        method: record.method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: encodeJson(body) }),
      });
      record.status = response.status;
      record.contentType = response.headers.get('content-type');
      const bytes = new Uint8Array(await response.arrayBuffer());
      record.raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (html) {
        assert.equal(response.status, expectedStatus, 'Unexpected SSR HTTP status');
        assert.match(record.contentType ?? '', /^text\/html(?:;|$)/i, 'Expected an HTML response');
        return record.raw;
      }
      assert.match(record.contentType ?? '', /^application\/json(?:;|$)/i, 'Expected a JSON response');
      record.response = decodeJson(bytes);
      assert.ok(object(record.response), 'Expected one complete JSON object');
      assert.equal(response.status, expectedStatus, `Unexpected HTTP status: ${record.raw}`);
      if (server) {
        assert.equal(record.response.server, server, 'Response came from a different server');
        if (server.startsWith('php')) assert.equal(record.response.nativeJson, server === 'php-ext', 'PHP JSON processor differs');
      }
      if (expectedStatus === 200) assert.equal(Object.hasOwn(record.response, 'error'), false, 'Successful HTTP response contains an error');
      else assert.ok(typeof record.response.error === 'string' && record.response.error.length > 0, 'Failed HTTP response must explain the error');
      return record.response;
    } catch (error) { record.error = error.message; throw error; }
  }
  // Compare HTTP models with the same JSON serialization used by a JS server.
  const state = form => decodeJson(new TextEncoder().encode(JSON.stringify({
    data: form.getData(), fields: form.getSnapshot().fields, html: renderForm(form), revision: form.getSnapshot().revision,
  })));
  try {
    await check('shared', 'all', 'all', 'library-and-source', async () => {
      beforeArtifacts = await artifacts(options.library);
      report.artifactsBefore = beforeArtifacts;
      const require = createRequire(path.join(options.library, 'package.json'));
      ({ compileForm, createForm } = await import(pathToFileURL(path.join(options.library, 'legacy/packages/generator/ts/dist/index.mjs'))));
      ({ renderForm } = await import(pathToFileURL(path.join(options.library, 'packages/react/dist/server.mjs'))));
      ({ parse } = await import(pathToFileURL(require.resolve('parse5'))));
      report.source = await request('/source.json');
      source = assertSourceIdentity(report.source, 'Missing current source identity');
      publicSpec = await request('/spec.json');
      equalOrdered(publicSpec, specFor(), 'Published specification');
      template = compileForm(publicSpec, { keyPrefix: 'form' });
      return { source, artifactCount: Object.keys(beforeArtifacts).length };
    });
    for (const server of servers) for (const renderingPath of renderingPaths)
      for (const framework of frameworks) {
      const endpoint = operation =>
        `/api/${server}/${operation}/${renderingPath}/${framework}`;
      let storedBaseline, serializedTemplate, compileRejected = false;
      await check(server, renderingPath, framework, 'load-current-record', async () => {
        const stored = await request(endpoint('load'), undefined, server);
        assert.ok(object(stored.data) && object(stored.storage), 'Load must return record data and actual storage');
        storedBaseline = encodeJson({ data: stored.data, storage: stored.storage });
        return deserialize(storedBaseline);
      });
      await check(server, renderingPath, framework, 'compile-reference', async () => {
        assert.ok(source && template, 'Shared library preparation failed');
        // Fields come by reference; root declarations such as buttons stay on the form root.
        const { properties, ...root } = publicSpec;
        const payload = { spec: { ...root, properties: { $ref: 'current-fields.json' } }, options: { keyPrefix: 'form', files: { 'current-fields.json': { type: 'group', properties } } } };
        const expected = compileForm(payload.spec, payload.options);
        const response = await request(endpoint('compile'), payload, server);
        assertGenerationProvenance(response.generator, server, source, options.library);
        const expectedReferenceReads = server === 'go' || server === 'rust' ? 1 : null;
        assert.equal(response.referenceReads, expectedReferenceReads, 'Compile reference read count differs');
        equalOrdered(response.template, expected, 'Compiled template');
        equalOrdered(response.template, template, 'Referenced and direct structure');
        serializedTemplate = encodeJson(response.template);
        equalOrdered(deserialize(serializedTemplate), response.template, 'Serialized compiled template');
        return { generator: response.generator, referenceReads: response.referenceReads, template: response.template, serializedTemplateSha256: digest(serializedTemplate) };
      });
      await check(server, renderingPath, framework, 'reject-missing-reference', async () => {
        assert.ok(serializedTemplate, 'Server compilation failed');
        const response = await request(endpoint('compile'), { spec: { type: 'group', properties: { $ref: 'missing-fields.json' } }, options: { files: {} } }, server, 400);
        compileRejected = true;
        return { error: response.error, retainedTemplateSha256: digest(serializedTemplate) };
      });
      for (const scenario of [
        { id: 'nested-order', data: fixtureData(), language: 'en' },
        { id: 'explicit-empty', data: { companies: {} }, language: 'ko' },
        { id: 'default-rows', data: {}, language: 'ko', defaults: true },
        { id: 'stored-en', stored: true, language: 'en' },
        { id: 'stored-ko', stored: true, language: 'ko' },
      ]) await check(server, renderingPath, framework,
        `render-and-inject/${scenario.id}`, async () => {
        assert.ok(compileRejected && serializedTemplate && source, 'Rejected compile did not precede cached template reuse');
        if (scenario.stored) assert.ok(storedBaseline, 'Current record load failed');
        const data = scenario.stored ? deserialize(storedBaseline).data : scenario.data;
        const binding = { language: scenario.language, idPrefix: 'http:form' };
        const cachedTemplate = deserialize(serializedTemplate);
        const response = await request(endpoint('render'), { template: cachedTemplate, data, options: binding }, server);
        assertGenerationProvenance(response.generator, server, source, options.library);
        assert.ok(object(response.data) && Array.isArray(response.fields) && typeof response.html === 'string', 'Incomplete render response');
        assert.equal(response.revision, 0, 'A new HTTP form instance must start at revision zero');
        if (scenario.defaults) freshDefaults(response.data);
        else equalOrdered(response.data, data, 'Supplied record');
        const initial = state(createForm(deserialize(serializedTemplate), response.data, binding));
        equalRendered(response, initial);
        assert.equal(initial.revision, 0);
        const injected = createForm(deserialize(serializedTemplate), { companies: {} }, binding);
        const revisions = [];
        for (const expectedRevision of [1, 2]) {
          injected.setData(response.data);
          const actual = state(injected);
          equalRendered(actual, response);
          assert.equal(actual.revision, expectedRevision, 'Injection revision differs');
          revisions.push(actual.revision);
        }
        injected.setData({ companies: {} });
        assert.equal(injected.getSnapshot().revision, 3);
        injected.setData(response.data);
        equalRendered(state(injected), response);
        assert.equal(injected.getSnapshot().revision, 4);
        const repeated = await request(endpoint('render'), { template: deserialize(serializedTemplate), data: response.data, options: binding }, server);
        assertGenerationProvenance(repeated.generator, server, source, options.library);
        equalRendered(repeated, response);
        assert.equal(repeated.revision, 0);
        assert.equal(encodeJson(cachedTemplate), serializedTemplate, 'Binding modified the reusable serialized template');
        return { generator: response.generator, data: response.data, fields: response.fields, html: response.html, initialRevision: initial.revision, injectedRevisions: [...revisions, 3, 4], repeatedRevision: repeated.revision, afterRejectedCompile: true, serializedTemplateSha256: digest(serializedTemplate) };
      });
      let frameDocument;
      await check(server, renderingPath, framework, 'frame-document', async () => {
        assert.ok(parse, 'Shared library preparation failed');
        frameDocument = await request(frameUrl({
          initialization: 'csr', path: renderingPath, framework, server, language: 'ko',
        }), undefined, server, 200, true);
        readFrameDocument(parse, frameDocument, 'csr');
        return { frameSha256: digest(frameDocument) };
      });
      for (const language of ['en', 'ko']) await check(server, renderingPath, framework,
        `ssr/${language}`, async () => {
        assert.ok(storedBaseline && template && source && parse, 'Source or stored record is unavailable');
        assert.ok(frameDocument, 'The built frame document is unavailable');
        const expected = state(createForm(template, deserialize(storedBaseline).data, { language }));
        const markup = await request(frameUrl({
          initialization: 'ssr', path: renderingPath, framework, server, language,
        }), undefined, server, 200, true);
        return checkDocument(parse, markup, frameDocument, expected, server, language,
          source, options.library);
      });
      await check(server, renderingPath, framework, 'reject-ssr-request', async () => {
        const other = servers.find(name => name !== server);
        const errors = [];
        for (const query of ssrRejectedQueries) {
          const response = await request(
            `${endpoint('ssr')}${query.replaceAll('{server}', server).replaceAll('{other}', other)}`,
            undefined, server, 400,
          );
          assert.equal(response.error, ssrRequestError, `SSR request rejection: ${query}`);
          errors.push(response.error);
        }
        return { rejected: ssrRejectedQueries.length, errors: [...new Set(errors)] };
      });
      await check(server, renderingPath, framework, 'reject-invalid-render-data', async () => {
        assert.ok(serializedTemplate, 'Server compilation failed');
        const response = await request(endpoint('render'), { template: deserialize(serializedTemplate), data: [] }, server, 400);
        return { error: response.error };
      });
      await check(server, renderingPath, framework, 'stored-record-unchanged', async () => {
        assert.ok(storedBaseline, 'Initial record load failed');
        const after = await request(endpoint('load'), undefined, server);
        const before = deserialize(storedBaseline);
        equalOrdered(after.data, before.data, 'Stored form data after generation');
        equalOrdered(after.storage, before.storage, 'Stored records after generation');
        return { data: after.data, storage: after.storage };
      });
    }
    await check('shared', 'all', 'all', 'unchanged-library-inputs', async () => {
      assert.ok(beforeArtifacts, 'Initial artifact collection failed');
      report.artifactsAfter = await artifacts(options.library);
      equalOrdered(report.artifactsAfter, beforeArtifacts, 'Library and checker artifacts');
      equalOrdered(await request('/source.json'), report.source, 'Source identity');
      return { artifactCount: Object.keys(beforeArtifacts).length, unchanged: true };
    });
  } catch (error) {
    report.results.push({ server: 'shared', path: 'all', framework: 'all',
      id: 'checker-execution', passed: false, error: errorRecord(error) });
  } finally {
    finalizeGenerationReport(report);
    await output.writeFile(`${JSON.stringify(report, null, 2)}\n`);
    await output.close();
    process.stdout.write(`${report.passed} passed, ${report.failed} failed; ${report.requestCount} HTTP requests; report ${options.report}\n`);
    if (report.failed) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
