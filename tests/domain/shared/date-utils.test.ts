import { describe, it, expect } from 'vitest';
import { addDays, isSameCalendarDay, daysBetween } from '@/domain/shared/date-utils';

describe('addDays', () => {
  it('adds whole days in 24h increments', () => {
    const base = new Date('2026-07-27T10:00:00.000Z');
    expect(addDays(base, 7).toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });
  it('subtracts with negative days', () => {
    const base = new Date('2026-07-27T10:00:00.000Z');
    expect(addDays(base, -3).toISOString()).toBe('2026-07-24T10:00:00.000Z');
  });
});

describe('isSameCalendarDay', () => {
  it('is true for the same UTC date at different times', () => {
    expect(
      isSameCalendarDay(new Date('2026-07-27T01:00:00Z'), new Date('2026-07-27T23:00:00Z')),
    ).toBe(true);
  });
  it('is false across the UTC day boundary', () => {
    expect(
      isSameCalendarDay(new Date('2026-07-27T23:00:00Z'), new Date('2026-07-28T00:30:00Z')),
    ).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days forward', () => {
    expect(daysBetween(new Date('2026-07-27T10:00:00Z'), new Date('2026-08-03T05:00:00Z'))).toBe(7);
  });
  it('is negative for a past target', () => {
    expect(daysBetween(new Date('2026-07-27T10:00:00Z'), new Date('2026-07-24T20:00:00Z'))).toBe(-3);
  });
  it('is zero within the same day', () => {
    expect(daysBetween(new Date('2026-07-27T01:00:00Z'), new Date('2026-07-27T23:00:00Z'))).toBe(0);
  });
});
