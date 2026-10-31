const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * How long ago something happened, the way the language says it ("now", "15 min ago", "yesterday"), from the time it
 * happened and the time it is now, both in milliseconds since 1970.
 */
export function timeAgo(then: number, now: number, language: string): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
  const past = Math.max(0, now - then);
  if (past < MINUTE) return format.format(0, 'second');
  if (past < HOUR) return format.format(-Math.floor(past / MINUTE), 'minute');
  if (past < DAY) return format.format(-Math.floor(past / HOUR), 'hour');
  if (past < WEEK) return format.format(-Math.floor(past / DAY), 'day');
  return format.format(-Math.floor(past / WEEK), 'week');
}
