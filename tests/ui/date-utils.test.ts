import { describe, it, expect, vi, afterEach } from 'vitest';
import { dateLabel, isoDay, localFutureIso, localTodayIso, nextBusinessDayIso, utcDate } from '@/ui/date-utils';

afterEach(() => {
  vi.useRealTimers();
});

function setLocalDate(year: number, month: number, day: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, 12, 0, 0));
}

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

describe('nextBusinessDayIso', () => {
  it('viernes salta al lunes', () => {
    setLocalDate(2026, 8, 7);
    expect(nextBusinessDayIso()).toBe('2026-08-10');
  });

  it('sábado salta al lunes', () => {
    setLocalDate(2026, 8, 8);
    expect(nextBusinessDayIso()).toBe('2026-08-10');
  });

  it('domingo salta al lunes', () => {
    setLocalDate(2026, 8, 9);
    expect(nextBusinessDayIso()).toBe('2026-08-10');
  });

  it('lunes devuelve el martes', () => {
    setLocalDate(2026, 8, 10);
    expect(nextBusinessDayIso()).toBe('2026-08-11');
  });
});
