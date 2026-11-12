#!/usr/bin/env node
/**
 * bench-js.js — in-process throughput benchmark for validator-ts.
 *
 * Loads the Validator class from legacy/packages/validator/ts/dist/internal.js (the
 * entry CRUDUI's own packages use), builds the Validator once per spec, then
 * loops validate(input) N times. Process startup, module load, spec parse, and
 * fixture I/O all happen BEFORE timing — the measured window is validate-only.
 *
 * stdout: one JSON line per spec, e.g.
 *   {"lang":"js","spec":"contact","iters":50000,"ms":12.3,"opsSec":4065040,"avgUs":0.246,"valid":true,"error":null,"field":null}
 *
 * Args: --iters N (default 50000), --warmup N (default 5000), --spec NAME.
 * The counts follow the rule of arguments.js, checked before the validator loads.
 */

const fs = require('fs');
const path = require('path');
const { count } = require('./arguments');

const FIXTURES = path.join(__dirname, 'fixtures');

function parseArgs(argv) {
  const out = { iters: 50000, warmup: 5000, spec: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--iters') out.iters = count('--iters', argv[++i]);
    else if (argv[i] === '--warmup') out.warmup = count('--warmup', argv[++i]);
    else if (argv[i] === '--spec') out.spec = argv[++i];
  }
  return out;
}

function loadFixture(name) {
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.spec.json`), 'utf8'));
  const input = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.input.json`), 'utf8'));
  return { spec, input };
}

function firstError(result) {
  if (result.valid || !result.errors || result.errors.length === 0) {
    return { error: null, field: null };
  }
  const e = result.errors[0];
  return { error: e.rule, field: e.path };
}

function benchSpec(Validator, name, iters, warmup) {
  const { spec, input } = loadFixture(name);
  // Build the validator once; reuse across all iterations.
  const validator = new Validator(spec);

  // Warmup: let the JIT settle before measuring.
  let sink = 0;
  for (let i = 0; i < warmup; i++) {
    const r = validator.validate(input);
    sink += r.valid ? 1 : 0;
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) {
    const r = validator.validate(input);
    sink += r.valid ? 1 : 0;
  }
  const end = process.hrtime.bigint();
  if (sink < 0) console.error('unreachable'); // defeat dead-code elimination

  const ns = Number(end - start);
  const ms = ns / 1e6;
  const opsSec = Math.round((iters / ns) * 1e9);
  const avgUs = ns / 1000 / iters;

  // Report the validation outcome so the harness can confirm cross-language
  // agreement (same spec+input must yield same valid/error/field everywhere).
  const result = validator.validate(input);
  const fe = firstError(result);

  return {
    lang: 'js',
    spec: name,
    iters,
    ms: Number(ms.toFixed(3)),
    opsSec,
    avgUs: Number(avgUs.toFixed(4)),
    valid: Boolean(result.valid),
    error: fe.error,
    field: fe.field,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { Validator } = require(path.join(__dirname, '..', '..', 'legacy', 'packages', 'validator/ts', 'dist', 'internal.js'));
  const specs = args.spec ? [args.spec] : ['contact', 'large'];
  for (const name of specs) {
    const r = benchSpec(Validator, name, args.iters, args.warmup);
    process.stdout.write(JSON.stringify(r) + '\n');
  }
}

main();
