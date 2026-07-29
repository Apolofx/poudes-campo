import { describe, it, expect } from 'vitest';
import { resolveFollowUp, clampLeadDays, remindAtFor } from '@/application/use-cases/follow-up';

const now = new Date('2026-07-27T10:00:00Z');

describe('resolveFollowUp', () => {
  it('anchors an interval follow-up to now', () => {
    const fu = resolveFollowUp({ kind: 'interval', days: 7 }, now);
    expect(fu?.interval.days).toBe(7);
    expect(fu?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });
  it('uses an explicit date and derives the interval from now', () => {
    const fu = resolveFollowUp({ kind: 'date', date: new Date('2026-08-10T10:00:00Z') }, now);
    expect(fu?.nextVisitDate.toISOString()).toBe('2026-08-10T10:00:00.000Z');
    expect(fu?.interval.days).toBe(14);
  });
  it('returns undefined for kind none', () => {
    expect(resolveFollowUp({ kind: 'none' }, now)).toBeUndefined();
  });
});

describe('clampLeadDays', () => {
  it('clamps negative to 0 and excess to the interval', () => {
    expect(clampLeadDays(-3, 10)).toBe(0);
    expect(clampLeadDays(30, 10)).toBe(10);
    expect(clampLeadDays(3, 10)).toBe(3);
  });
});

describe('remindAtFor', () => {
  it('subtracts the clamped lead from nextVisitDate', () => {
    const fu = resolveFollowUp({ kind: 'interval', days: 7 }, now)!;
    expect(remindAtFor(fu, 3).toISOString()).toBe('2026-07-31T10:00:00.000Z');
    expect(remindAtFor(fu, 30).toISOString()).toBe('2026-07-27T10:00:00.000Z'); // clamp a 7
  });
});
