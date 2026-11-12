/**
 * The detail-validity cases through the TypeScript buildDetail (docs/spec/display-formats.md, CUDF-036 to CUDF-062). Each case
 * is a top-level test named by the case: the detail-render-validity unit.
 */

import { test } from 'vitest';
import { buildDetail } from './index';
import { checkValidityCase, readValidityCases } from './validity-outcome';

for (const c of readValidityCases('detail-validity')) {
  test(c.name, () => checkValidityCase(c, c => buildDetail(c.spec, {}, { files: c.files ?? {} })));
}
