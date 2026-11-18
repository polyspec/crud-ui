// C19.152: the job tag of release.yml passes the run id to release-tag as a command-line variable. An environment variable
// RUN="$$run" is overridden by the RUN= that a workflow_run start passes on the command line (`make ci-release-tag RUN=`), and
// the sub-make then sees an empty RUN and fails with "release-tag: RUN is required" (release run 44208954478).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('ci-release-tag passes the run id to release-tag on the command line (C19.152)', () => {
  const makefile = readFileSync(`${ROOT}/Makefile`, 'utf8');
  const recipe = makefile.split('\n').find(line => line.includes('$(CI_MAKE) release-tag'));
  assert.ok(recipe !== undefined, 'the Makefile has no line that runs release-tag through CI_MAKE');
  assert.match(recipe, /\$\(CI_MAKE\) release-tag RUN="\$\$run"/);
  assert.doesNotMatch(recipe, /RUN="\$\$run" \$\(CI_MAKE\)/);
});
