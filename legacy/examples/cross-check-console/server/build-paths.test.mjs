// The Go validator program that `npm run build:go` writes is the program that the Go validator process runs: the output
// path of `go build -o` in the build:go script, resolved from the directory that the script enters, is the default
// command of validatorProcesses.go.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { ROOT } from './engine.mjs';
import { validatorProcesses } from './validate-runner.mjs';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const scripts = JSON.parse(readFileSync(path.join(serverDirectory, 'package.json'), 'utf8')).scripts;

describe('build:go writes the program of the Go validator process', () => {
  test('the output of go build -o is ROOT/var/build/cross-check-console/go-validate', () => {
    const match = /^cd (?<directory>\S+) && go build -o (?<output>\S+) \.$/.exec(scripts['build:go']);
    expect(match, `build:go is "${scripts['build:go']}", expected cd <directory> && go build -o <output> .`).not.toBeNull();
    const output = path.resolve(serverDirectory, match.groups.directory, match.groups.output);
    expect(output).toBe(path.join(ROOT, 'var/build/cross-check-console/go-validate'));
    // CRUDUI_CROSS_CHECK_GO_VALIDATOR names another program; without it the process runs the program of build:go.
    if (process.env.CRUDUI_CROSS_CHECK_GO_VALIDATOR === undefined) expect(validatorProcesses.go.command).toBe(output);
  });
});
