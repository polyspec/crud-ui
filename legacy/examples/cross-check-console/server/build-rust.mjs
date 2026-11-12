#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runRustCommand } from '../../../../scripts/run-rust-command.mts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

await runRustCommand(['build', '--locked', '--release'], {
  cwd: path.join(repositoryRoot, 'legacy/examples/cross-check-console/validators/rust'),
});
