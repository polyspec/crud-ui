import { registerSessionCases } from '../../../../tests/fixtures/form-state/units.mts';
import * as core from './index';

// The form-history cases, each a top-level test named by its case.
registerSessionCases('form-history', true, core);
