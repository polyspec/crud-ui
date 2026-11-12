const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const rfcDate = /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),[ \t]+)?(\d{1,2})[ \t]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ \t]+(\d{4})[ \t]+(\d{2}):(\d{2})(?::(\d{2}))?[ \t]+([+-]\d{4}|UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/i;
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const zones: Readonly<Record<string, number>> = {
  UT: 0, GMT: 0, EST: -300, EDT: -240, CST: -360, CDT: -300,
  MST: -420, MDT: -360, PST: -480, PDT: -420,
};

function offsetMinutes(zone: string): number | undefined {
  if (!zone || zone === 'Z') return 0;
  const name = zone.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(zones, name)) return zones[name];
  const digits = zone.slice(1).replace(':', '');
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (hours > 23 || minutes > 59) return undefined;
  return (zone[0] === '-' ? -1 : 1) * (hours * 60 + minutes);
}

/** Parse the supported ISO and RFC date forms without using the host timezone. */
export function parseDateValue(value: string): Date | undefined {
  let year: number, month: number, day: number, hour: number, minute: number, second: number;
  let fraction = '', zone: string, weekday: string | undefined;
  const iso = isoDate.exec(value);
  if (iso && iso[0] === value) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
    hour = Number(iso[4] ?? 0); minute = Number(iso[5] ?? 0); second = Number(iso[6] ?? 0);
    fraction = iso[7] ?? ''; zone = iso[8] ?? '';
  } else {
    const rfc = rfcDate.exec(value);
    if (!rfc || rfc[0] !== value) return undefined;
    weekday = rfc[1]?.toLowerCase();
    year = Number(rfc[4]); month = months.indexOf(rfc[3].toLowerCase()) + 1; day = Number(rfc[2]);
    hour = Number(rfc[5]); minute = Number(rfc[6]); second = Number(rfc[7] ?? 0); zone = rfc[8];
  }
  const offset = offsetMinutes(zone);
  if (offset === undefined || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return undefined;
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, Number(fraction.slice(0, 3).padEnd(3, '0')));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) return undefined;
  if (weekday !== undefined && weekdays[local.getUTCDay()] !== weekday) return undefined;
  return new Date(local.getTime() - offset * 60_000);
}

/** Format UTC date parts and retain unsupported or invalid input unchanged. */
export function formatDateValue(value: string, pattern: string): string {
  const date = parseDateValue(value);
  if (!date) return value;
  const pad = (number: number) => String(number).padStart(2, '0');
  const year = date.getUTCFullYear();
  const parts: Readonly<Record<string, string>> = {
    YYYY: `${year < 0 ? '-' : ''}${String(Math.abs(year)).padStart(4, '0')}`,
    MM: pad(date.getUTCMonth() + 1), DD: pad(date.getUTCDate()),
    HH: pad(date.getUTCHours()), mm: pad(date.getUTCMinutes()), ss: pad(date.getUTCSeconds()),
  };
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, token => parts[token]);
}
