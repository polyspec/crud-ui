/** Value definitions shared by every rule (validation-rules.md, "Values"). */
export { trim } from './whitespace';
export { isEmptyValue } from './empty';
export { canonicalText } from './canonical';
export { codePointLength, isLengthLimit, isLengthRange } from './length';
export { readMembers, isMember } from './membership';
export { numericValue, isFiniteNumber, isNumberRange, isStep, isMultiple, isDigits, countOf, formatMessage } from './numeric';
