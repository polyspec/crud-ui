/**
 * Date validation rule
 *
 * Validates that a value is a valid date
 */

import { formatRule } from './factories';
import { trim } from '../values/index';

/** `YYYY-MM-DD`, the ISO layout of CUVR-059. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** `YYYY/MM/DD`. */
const SLASH_YEAR_FIRST = /^(\d{4})\/(\d{2})\/(\d{2})$/;
/** `MM/DD/YYYY` or `DD/MM/YYYY`: either reading names the day. */
const SLASH_YEAR_LAST = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** An RFC 3339 date-time without a fraction and with `Z` or a `+HH:MM` / `-HH:MM` offset (CUVR-058). */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/;

/** Whether year, month and day name a calendar day that exists. */
function isCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= days;
}

/** Whether a trimmed text is one of the date layouts of CUVR-058 that name a calendar day. */
function isDayText(text: string): boolean {
  const iso = ISO_DATE.exec(text) ?? SLASH_YEAR_FIRST.exec(text);
  if (iso) {
    return isCalendarDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const slash = SLASH_YEAR_LAST.exec(text);
  if (slash) {
    const year = Number(slash[3]);
    return isCalendarDay(year, Number(slash[1]), Number(slash[2])) || isCalendarDay(year, Number(slash[2]), Number(slash[1]));
  }
  return false;
}

/**
 * The date rule (CUVR-058): a string, trimmed, in one of the listed layouts with a calendar day, or an RFC 3339
 * date-time with a valid time and offset. A number is not a date.
 */
function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const text = trim(value);
  const dateTime = DATE_TIME.exec(text);
  if (dateTime) {
    const [, day, hour, minute, second, offset] = dateTime;
    if (!isDayText(day ?? '') || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
      return false;
    }
    return offset === 'Z' || (Number(offset?.slice(1, 3)) <= 23 && Number(offset?.slice(4, 6)) <= 59);
  }
  return isDayText(text);
}

/**
 * Parse a date value to Date object
 */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = trim(value);
    if (trimmed === '') {
      return null;
    }
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Date rule definition. */
export const dateRule = formatRule('date', isValidDate, 'Please enter a valid date.');
