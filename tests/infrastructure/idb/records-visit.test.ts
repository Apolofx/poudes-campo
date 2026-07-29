import { describe, it, expect } from 'vitest';
import { toVisitRecord, fromVisitRecord } from '@/infrastructure/persistence/idb/records';
import { Visit } from '@/domain/entities/visit';

describe('VisitRecord mapping', () => {
  it('round-trips a cancelled visit preserving status and cancelledAt', () => {
    const visit = new Visit({
      id: 'v1',
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      createdAt: new Date('2026-07-27T10:00:00Z'),
      status: 'CANCELLED',
      cancelledAt: new Date('2026-07-28T09:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('CANCELLED');
    expect(back.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });

  it('round-trips an active visit with cancelledAt undefined', () => {
    const visit = new Visit({
      id: 'v2',
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      createdAt: new Date('2026-07-27T10:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('ACTIVE');
    expect(back.cancelledAt).toBeUndefined();
  });
});
