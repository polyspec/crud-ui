/** The data limits of a form root (validation-rules.md, "Data limits"). */

import { ComposeLoadError } from '../compose/errors';
import { isRecord } from '../record';
import { NESTING_LIMIT, NODE_LIMIT, valueSize } from '../text/index';
import { isLengthLimit } from '../values/index';
import { FormInputError } from './errors';

/** The bounds of the submitted data: its levels and its nodes. */
export interface DataLimits {
  depth: number;
  values: number;
}

/** The limits of a form root that declares none (CUVR-083). */
const DEFAULT_LIMITS: DataLimits = { depth: 64, values: 100_000 };

const BAD_LIMITS = `Invalid dataLimits parameter: expected depth from 1 to ${NESTING_LIMIT} and values from 1 to ${NODE_LIMIT}`;

/** The `dataLimits` of a form root, a missing member taking its default; a bad one fails the load (CUVR-084). */
export function dataLimits(root: Record<string, unknown>): DataLimits {
  if (!('dataLimits' in root)) return DEFAULT_LIMITS;
  const declared = root.dataLimits;
  if (!isRecord(declared)) throw new ComposeLoadError('INVALID_RULE_PARAMETER', BAD_LIMITS);
  let { depth, values } = DEFAULT_LIMITS;
  for (const [key, value] of Object.entries(declared)) {
    const maximum = key === 'depth' ? NESTING_LIMIT : key === 'values' ? NODE_LIMIT : 0;
    if (!isLengthLimit(value) || value < 1 || value > maximum) {
      throw new ComposeLoadError('INVALID_RULE_PARAMETER', BAD_LIMITS);
    }
    if (key === 'depth') depth = value;
    else values = value;
  }
  return { depth, values };
}

/** Data beyond its limits is an input failure, its levels checked before its nodes (CUVR-082). */
export function checkDataLimits(data: unknown, limits: DataLimits): void {
  const size = valueSize(data);
  if (size.levels > limits.depth) throw new FormInputError(`Submitted data exceeds the depth limit of ${limits.depth}`);
  if (size.nodes > limits.values) throw new FormInputError(`Submitted data exceeds the values limit of ${limits.values}`);
}
