/**
 * JavaScript validator process of the cross-check console. It reads one JSON request on standard
 * input, calls the public API of `@polyspec/crudui-validator` and writes one JSON response on standard
 * output with the exit status. The request and response contract is in ../README.md and is the
 * same for the PHP, Go and Rust programs in this directory.
 */

import { validate, validateList, validateDetail, ComposeLoadError, FormInputError } from '@polyspec/crudui-validator';

/** Write one JSON line and exit with the given status. */
function emit(value, status) {
  process.stdout.write(`${JSON.stringify(value)}\n`, () => process.exit(status));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    // Standard input that is not UTF-8 is not JSON text; it is never decoded with replacements.
    process.stdin.on('end', () => {
      try {
        resolve(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks)));
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Return the response and exit status for one raw request. */
function respond(raw) {
  const reject = error => [{ error }, 1];
  let request;
  try {
    request = JSON.parse(raw);
  } catch (error) { if (!(error instanceof SyntaxError)) throw error;
    return reject('Request must be valid JSON');
  }
  if (!isObject(request)) return reject('Request must be an object');
  const { spec } = request;
  if (!isObject(spec)) return reject('Request spec must be an object');
  const mode = Object.hasOwn(request, 'mode') ? request.mode : 'form';
  if (mode !== 'form' && mode !== 'list' && mode !== 'detail') return reject('Unsupported validation mode');
  const files = request.files ?? null;
  if (files !== null && !isObject(files)) return reject('Request files must be an object');
  if (files !== null && !Object.values(files).every(isObject)) return reject('Request files must contain objects');
  const basepath = request.basepath ?? null;
  if (basepath !== null && typeof basepath !== 'string') return reject('Request basepath must be a string');

  const options = {};
  if (files !== null) options.files = files;
  if (basepath) options.basepath = basepath;
  let result;
  try {
    if (mode === 'list') result = validateList(spec, options);
    else if (mode === 'detail') result = validateDetail(spec, options);
    else result = validate(spec, Object.hasOwn(request, 'data') ? request.data : {}, options);
  } catch (error) {
    if (error instanceof ComposeLoadError) return [{ error: error.message, code: error.code, at: error.trace.join('.') }, 2];
    if (error instanceof FormInputError) return [{ error: error.message, code: error.code, at: '' }, 2];
    return reject(`validate failed: ${error instanceof Error && error.stack ? error.stack : String(error)}`);
  }
  const errors = result.errors.map(item => ({
    path: item.path,
    field: item.field,
    rule: item.rule,
    message: item.message,
    value: item.value ?? null,
  }));
  // A form result lists its hidden paths; a list or detail result has none.
  return [mode === 'form' ? { valid: result.valid, errors, hidden: result.hidden } : { valid: result.valid, errors }, 0];
}

readStdin().then(
  raw => emit(...respond(raw)),
  () => emit({ error: 'Request must be valid JSON' }, 1),
);
