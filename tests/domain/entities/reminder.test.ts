import { describe, it, expect } from 'vitest';
import { Reminder } from '@/domain/entities/reminder';

const base = { id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-08-03T10:00:00Z') };

describe('Reminder', () => {
  it('defaults to PENDING', () => {
    expect(new Reminder({ ...base }).status).toBe('PENDING');
  });
  it('cancel moves PENDING to CANCELLED', () => {
    const r = new Reminder({ ...base });
    r.cancel();
    expect(r.status).toBe('CANCELLED');
  });
  it('cancel is idempotent', () => {
    const r = new Reminder({ ...base });
    r.cancel();
    r.cancel();
    expect(r.status).toBe('CANCELLED');
  });
  it('cancel works from SENT too', () => {
    const r = new Reminder({ ...base, status: 'SENT' });
    r.cancel();
    expect(r.status).toBe('CANCELLED');
  });
  it('markSent moves PENDING to SENT', () => {
    const r = new Reminder({ ...base });
    r.markSent();
    expect(r.status).toBe('SENT');
  });
  it('markSent is idempotent', () => {
    const r = new Reminder({ ...base });
    r.markSent();
    r.markSent();
    expect(r.status).toBe('SENT');
  });
  it('markSent does not resurrect a CANCELLED reminder', () => {
    const r = new Reminder({ ...base, status: 'CANCELLED' });
    r.markSent();
    expect(r.status).toBe('CANCELLED');
  });
  it('stores an optional scheduledVisitId', () => {
    const r = new Reminder({ id: 'r1', visitId: 'v1', scheduledVisitId: 's1', fieldId: 'f1', remindAt: new Date('2026-08-01T00:00:00Z') });
    expect(r.scheduledVisitId).toBe('s1');
    expect(r.visitId).toBe('v1');
  });
});
