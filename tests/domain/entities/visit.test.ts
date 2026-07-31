import { describe, it, expect } from 'vitest';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { IncompleteFollowUp } from '@/domain/shared/errors';

const base = {
  id: 'v1',
  fieldId: 'f1',
  visitDate: new Date('2026-07-27T10:00:00Z'),
  createdAt: new Date('2026-07-27T10:00:00Z'),
};

describe('Visit', () => {
  it('defaults to ACTIVE status', () => {
    expect(new Visit({ ...base }).status).toBe('ACTIVE');
  });
  it('stores optional free-text notes', () => {
    expect(new Visit({ ...base, notes: 'soja en V4, todo ok' }).notes).toBe('soja en V4, todo ok');
  });
  it('accepts a complete follow-up', () => {
    const v = new Visit({
      ...base,
      followUp: { nextVisitDate: new Date('2026-08-03T10:00:00Z'), interval: VisitInterval.ofDays(7) },
    });
    expect(v.followUp?.interval.days).toBe(7);
    expect(v.followUp?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });
  it('has no follow-up when omitted', () => {
    expect(new Visit({ ...base }).followUp).toBeUndefined();
  });
  it('rejects a partial follow-up', () => {
    expect(
      () => new Visit({ ...base, followUp: { nextVisitDate: new Date('2026-08-03T10:00:00Z') } as never }),
    ).toThrow(IncompleteFollowUp);
  });
  it('defaults cancelledAt to undefined', () => {
    expect(new Visit({ ...base }).cancelledAt).toBeUndefined();
  });
  it('stores an optional cancelledAt', () => {
    const at = new Date('2026-07-28T09:00:00Z');
    const v = new Visit({ ...base, status: 'CANCELLED', cancelledAt: at });
    expect(v.status).toBe('CANCELLED');
    expect(v.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });
});
