import { describe, it, expect } from 'vitest';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { InvalidScheduledVisit } from '@/domain/shared/errors';

const base = {
  id: 's1',
  fieldId: 'f1',
  scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
  reminderLeadDays: 3,
  createdAt: new Date('2026-07-31T12:00:00.000Z'),
};

describe('ScheduledVisit', () => {
  it('defaults status to ACTIVE', () => {
    expect(new ScheduledVisit({ ...base }).status).toBe('ACTIVE');
  });

  it('stores optional notes and cancelledAt', () => {
    const s = new ScheduledVisit({ ...base, notes: 'revisar', status: 'CANCELLED', cancelledAt: base.createdAt });
    expect(s.notes).toBe('revisar');
    expect(s.status).toBe('CANCELLED');
    expect(s.cancelledAt?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
  });

  it('rejects a negative reminderLeadDays', () => {
    expect(() => new ScheduledVisit({ ...base, reminderLeadDays: -1 })).toThrow(InvalidScheduledVisit);
  });
});
