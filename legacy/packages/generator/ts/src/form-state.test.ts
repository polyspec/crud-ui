import { registerSessionCases } from '../../../../tests/fixtures/form-state/units.mts';
import * as core from './index';

// The form-view cases, each a top-level test named by its case.
registerSessionCases('form-view', false, core);
