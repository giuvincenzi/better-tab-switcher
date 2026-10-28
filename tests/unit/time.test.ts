import { describe, expect, it } from 'vitest';
import { timeAgo } from '../../lib/i18n/time';

const now = Date.UTC(2026, 9, 28, 12, 0, 0);
const minutes = (n: number) => now - n * 60_000;

describe('timeAgo', () => {
  it('says now for less than a minute', () => {
    expect(timeAgo(now - 20_000, now, 'en')).toBe('now');
  });

  it('counts minutes, hours, days and weeks', () => {
    expect(timeAgo(minutes(15), now, 'en')).toBe('15 min. ago');
    expect(timeAgo(minutes(3 * 60), now, 'en')).toBe('3 hr. ago');
    expect(timeAgo(minutes(24 * 60), now, 'en')).toBe('yesterday');
    expect(timeAgo(minutes(14 * 24 * 60), now, 'en')).toBe('2 wk. ago');
  });

  it('changes unit exactly at a minute, an hour, a day and a week', () => {
    expect(timeAgo(now - 59_999, now, 'en')).toBe('now');
    expect(timeAgo(minutes(1), now, 'en')).toBe('1 min. ago');
    expect(timeAgo(minutes(59), now, 'en')).toBe('59 min. ago');
    expect(timeAgo(minutes(60), now, 'en')).toBe('1 hr. ago');
    expect(timeAgo(minutes(24 * 60 - 1), now, 'en')).toBe('23 hr. ago');
    expect(timeAgo(minutes(7 * 24 * 60 - 1), now, 'en')).toBe('6 days ago');
    expect(timeAgo(minutes(7 * 24 * 60), now, 'en')).toBe('last wk.');
  });

  it('counts only whole units, never rounding up', () => {
    expect(timeAgo(minutes(1.9), now, 'en')).toBe('1 min. ago');
    expect(timeAgo(minutes(2.9 * 60), now, 'en')).toBe('2 hr. ago');
    expect(timeAgo(minutes(13.9 * 24 * 60), now, 'en')).toBe('last wk.');
  });

  it('says it in the language asked', () => {
    expect(timeAgo(minutes(24 * 60), now, 'it')).toBe('ieri');
  });

  it('never says a time in the future', () => {
    expect(timeAgo(now + 60_000, now, 'en')).toBe('now');
  });
});
