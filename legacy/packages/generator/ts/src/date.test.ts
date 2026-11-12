import { describe, expect, it } from 'vitest';
import { formatDateValue, parseDateValue } from './date';
import { bindForm, compileForm, createForm, buildList } from './index';

const valid = [
  ['2026-09-09', '2026-09-09T00:00:00'],
  ['2026-09-09 03:04', '2026-09-09T03:04:00'],
  ['2026-09-09T03:04:05.999999999999', '2026-09-09T03:04:05'],
  ['2026-09-09T03:04:05+09:00', '2026-09-08T18:04:05'],
  ['2026-09-09T23:04-07:00', '2026-09-10T06:04:00'],
  ['Wed, 09 Sep 2026 03:04:05 +0900', '2026-09-08T18:04:05'],
  ['9 sep 2026 23:04 pdt', '2026-09-10T06:04:00'],
  ['0000-01-01T00:00:00+01:00', '-0001-12-31T23:00:00'],
  ['9999-12-31T23:30:00-01:00', '10000-01-01T00:30:00'],
];
const invalid = [
  '2026-02-29', '2026-04-31T03:04', '2026-09-09T24:00', '2026-09-09T03:60',
  '2026-09-09T03:04:60Z', '2026-09-09T03:04+24:00', '2026-09-09T03:04+01:60',
  '2026-09-09Z', '2026-09-09T03:04garbage', '2026-09-09T03:04.5', '2026/09/09',
  '2026-09-09T03:04z', 'Thu, 09 Sep 2026 03:04 GMT', '9 Sep 2026 03:04',
  '9 Sep 26 03:04 GMT', '9 Sep 2026 03:04 J', ' 2026-09-09', '2026-09-09\n',
  '9 Sep 2026 03:04 GMT\n',
];

describe('UTC date formatting', () => {
  it.each(valid)('formats %s as UTC %s', (input, expected) => {
    expect(formatDateValue(input, 'YYYY-MM-DDTHH:mm:ss')).toBe(expected);
  });

  it.each(invalid)('retains invalid or unsupported input %j', input => {
    expect(parseDateValue(input)).toBeUndefined();
    expect(formatDateValue(input, 'YYYY/MM/DD')).toBe(input);
  });

  it('uses the same UTC result in date controls, datetime controls and list cells', () => {
    const template = compileForm({ type: 'group', properties: {
      date: { type: 'date' }, time: { type: 'datetime' },
    } });
    for (const [input, expected] of valid) {
      const data = { date: input, time: input };
      const fields = bindForm(template, data);
      expect(fields[0].widget).toMatchObject({ attrs: { value: expected.split('T')[0] } });
      expect(fields[1].widget).toMatchObject({ attrs: { value: expected } });
      const initial = createForm(template, data);
      const injected = createForm(template);
      injected.setData(data);
      expect(initial.getSnapshot().fields).toEqual(fields);
      expect(injected.getSnapshot().fields).toEqual(initial.getSnapshot().fields);
      expect(injected.getData()).toEqual(data);
      const list = buildList({ columns: { time: { field: 'time', format: { type: 'date', pattern: 'YYYY-MM-DDTHH:mm:ss' } } } }, [data]);
      expect(list.rows[0].cells[0].display).toBe(expected);
      expect(list.rows[0].cells[0].value).toBe(input);
    }
  });
});
