#!/usr/bin/env node
/**
 * Execute the test commands declared by the CRUDUI contract manifest. Each command runs its own
 * tests, each with its own timeout, and runs to its end without a limit over them
 * (@polyspec/kit/run-command). Every command runs, also after an earlier one failed, and a failed
 * command fails the run after the last command.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { failureOf, runCommand } from '@polyspec/kit/run-command';
import { createProgress } from '@polyspec/kit/test-progress';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** A feature of contracts/features.json in the members that the runner reads. */
interface Feature { id: string, verification: { id: string, command: string }[] }

/** `value` as an object; throws an Error that names `what` otherwise. */
function object(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is no object`);
  return Object.fromEntries(Object.entries(value));
}

/** `value` as a string; throws an Error that names `what` otherwise. */
function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`${what} is no string`);
  return value;
}

/** `value` as an array; throws an Error that names `what` otherwise. */
function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is no array`);
  return value;
}

/** The features of contracts/features.json with their verification commands, checked. */
function manifestFeatures(value: unknown): Feature[] {
  const file = 'contracts/features.json';
  return list(object(value, file).features, `features of ${file}`).map((entry, index) => {
    const feature = object(entry, `features[${index}] of ${file}`);
    const verification = feature.verification === undefined ? [] : list(feature.verification, `features[${index}].verification of ${file}`);
    return {
      id: text(feature.id, `features[${index}].id of ${file}`),
      verification: verification.map((item, at) => {
        const command = object(item, `features[${index}].verification[${at}] of ${file}`);
        return { id: text(command.id, `the id of a verification of ${file}`), command: text(command.command, `the command of a verification of ${file}`) };
      }),
    };
  });
}
// `--features <file>` reads the features of another file (a test of this runner names its own); contracts/features.json is the default.
const featuresOption = process.argv.indexOf('--features');
const featuresFile = featuresOption === -1 ? 'contracts/features.json' : (process.argv[featuresOption + 1] ?? '');
const manifest = { features: manifestFeatures(JSON.parse(readFileSync(resolve(root, featuresFile), 'utf8'))) };
const requested = process.argv.slice(2).filter((argument, index, all) => argument !== '--features' && all[index - 1] !== '--features');
const featureId = requested[0] === '--feature' ? requested[1] : undefined;
const features = featureId ? manifest.features.filter((feature) => feature.id === featureId) : manifest.features;

if (featureId && features.length === 0) {
  process.stderr.write(`manifest tests: unknown feature: ${featureId}\n`);
  process.exit(2);
}

const commands = new Map<string, string[]>();
for (const feature of features) {
  for (const verification of feature.verification) {
    const owners = commands.get(verification.command) ?? [];
    owners.push(`${feature.id}/${verification.id}`);
    commands.set(verification.command, owners);
  }
}

// Each declared command is one counted result, so the summary counts the commands (C19.114).
// Each declared command prints its own tests; this runner prints the command around them.
const lines = createProgress({ write: text => process.stdout.write(text) });
// A selection without a command checks nothing, so it fails.
if (commands.size === 0) {
  lines.line(`✖ manifest:test: ran no command: the selected features declare no verification command (${features.map(feature => feature.id).join(', ') || 'no feature'})`);
  lines.close('manifest:test');
  process.exit(1);
}
// Every declared command runs, also after an earlier one failed, so one run reports every failure.
const failed: string[] = [];
for (const [command, owners] of commands) {
  const id = `${owners.join(', ')}: ${command}`;
  lines.start(id);
  const result = await runCommand({ command: '/bin/sh', args: ['-c', command], cwd: root });
  const failure = failureOf(result);
  if (failure) {
    lines.fail(id, result.elapsedMs, failure);
    failed.push(id);
  } else lines.pass(id, result.elapsedMs);
}
lines.close(`manifest:test: ${commands.size} declared commands${failed.length ? `, failed: ${failed.join('; ')}` : ''}`);
process.exitCode = failed.length ? 1 : 0;
