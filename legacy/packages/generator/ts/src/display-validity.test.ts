/**
 * The list-validity cases through the TypeScript buildList (docs/spec/display-formats.md, CUDF-036 to CUDF-062). Each case is a
 * top-level test named by the case: the list-render-validity unit.
 */

import { test } from 'vitest';
import { buildList } from './index';
import { checkValidityCase, readValidityCases } from './validity-outcome';

for (const c of readValidityCases('list-validity')) {
  test(c.name, () => checkValidityCase(c, c => buildList(c.spec, [], { files: c.files ?? {} })));
}
