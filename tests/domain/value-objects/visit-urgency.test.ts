import { describe, it, expect } from 'vitest';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';

const now = new Date('2026-07-28T09:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('VisitUrgency', () => {
  it('marks a past date as OVERDUE with negative daysUntil', () => {
    const u = VisitUrgency.of(at('2026-07-23'), now);
    expect(u.daysUntil).toBe(-5);
    expect(u.bucket).toBe('OVERDUE');
  });

  it('marks today as THIS_WEEK with daysUntil 0', () => {
    const u = VisitUrgency.of(at('2026-07-28'), now);
    expect(u.daysUntil).toBe(0);
    expect(u.bucket).toBe('THIS_WEEK');
  });

  it('keeps day 7 in THIS_WEEK (boundary)', () => {
    const u = VisitUrgency.of(at('2026-08-04'), now);
    expect(u.daysUntil).toBe(7);
    expect(u.bucket).toBe('THIS_WEEK');
  });

  it('moves day 8 to LATER (boundary)', () => {
    const u = VisitUrgency.of(at('2026-08-05'), now);
    expect(u.daysUntil).toBe(8);
    expect(u.bucket).toBe('LATER');
  });
});
