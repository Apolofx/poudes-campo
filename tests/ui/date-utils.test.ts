import { describe, it, expect } from 'vitest';
import { dateLabel, isoDay, localFutureIso, localTodayIso, utcDate } from '@/ui/date-utils';

describe('date-utils', () => {
  it('renders the stored UTC day regardless of the machine timezone', () => {
    const stored = utcDate('2026-08-01');
    expect(stored.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(dateLabel(stored)).toBe('01 de ago de 2026');
  });

  it('isoDay round-trips the stored day', () => {
    expect(isoDay(utcDate('2026-08-01'))).toBe('2026-08-01');
  });

  it('localTodayIso/localFutureIso produce valid ISO days', () => {
    expect(localTodayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localFutureIso(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
