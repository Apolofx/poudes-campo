import { describe, it, expect } from 'vitest';
import { toVisitRecord, fromVisitRecord } from '@/infrastructure/persistence/idb/records';
import { Visit } from '@/domain/entities/visit';

describe('VisitRecord mapping', () => {
  it('round-trips a pending visit preserving plannedFor and lead', () => {
    const visit = new Visit({
      id: 'v1',
      fieldId: 'f1',
      status: 'PENDING',
      plannedFor: new Date('2026-08-10T00:00:00Z'),
      reminderLeadDays: 3,
      createdAt: new Date('2026-07-31T12:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('PENDING');
    expect(back.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(back.reminderLeadDays).toBe(3);
    expect(back.cancelledAt).toBeUndefined();
    expect(back.visitedAt).toBeUndefined();
  });

  it('round-trips a cancelled visit preserving status and cancelledAt', () => {
    const visit = new Visit({
      id: 'v2',
      fieldId: 'f1',
      status: 'CANCELLED',
      cancelledAt: new Date('2026-08-01T09:00:00Z'),
      createdAt: new Date('2026-07-28T10:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('CANCELLED');
    expect(back.cancelledAt?.toISOString()).toBe('2026-08-01T09:00:00.000Z');
  });

  it('round-trips a done visit with visitedAt', () => {
    const visit = new Visit({
      id: 'v3',
      fieldId: 'f1',
      status: 'DONE',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      createdAt: new Date('2026-07-27T10:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('DONE');
    expect(back.visitedAt?.toISOString()).toBe('2026-07-27T10:00:00.000Z');
    expect(back.cancelledAt).toBeUndefined();
  });
});
