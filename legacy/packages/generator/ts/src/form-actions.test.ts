import { registerSessionCases } from '../../../../tests/fixtures/form-state/units.mts';
import * as core from './index';

// The form-actions cases, each a top-level test named by its case.
registerSessionCases('form-actions', true, core);
