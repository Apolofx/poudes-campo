import { describe, it, expect } from 'vitest';
import { Visit } from '@/domain/entities/visit';
import { InvalidVisit } from '@/domain/shared/errors';

const pending = {
  id: 'v1',
  fieldId: 'f1',
  status: 'PENDING' as const,
  plannedFor: new Date('2026-08-10T00:00:00.000Z'),
  reminderLeadDays: 3,
  createdAt: new Date('2026-07-31T12:00:00.000Z'),
};

describe('Visit', () => {
  it('accepts a PENDING with plannedFor and reminderLeadDays', () => {
    const v = new Visit({ ...pending });
    expect(v.status).toBe('PENDING');
    expect(v.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(v.reminderLeadDays).toBe(3);
    expect(v.visitedAt).toBeUndefined();
  });

  it('rejects a PENDING without plannedFor', () => {
    expect(() => new Visit({ ...pending, plannedFor: undefined })).toThrow(InvalidVisit);
  });

  it('rejects a PENDING with negative reminderLeadDays', () => {
    expect(() => new Visit({ ...pending, reminderLeadDays: -1 })).toThrow(InvalidVisit);
  });

  it('rejects a PENDING with visitedAt', () => {
    expect(() => new Visit({ ...pending, visitedAt: new Date('2026-08-03T00:00:00Z') })).toThrow(InvalidVisit);
  });

  it('accepts a DONE with visitedAt', () => {
    const v = new Visit({
      id: 'v2',
      fieldId: 'f1',
      status: 'DONE',
      visitedAt: new Date('2026-08-03T10:00:00Z'),
      createdAt: pending.createdAt,
    });
    expect(v.status).toBe('DONE');
    expect(v.visitedAt?.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('rejects a DONE without visitedAt', () => {
    expect(() => new Visit({ id: 'v2', fieldId: 'f1', status: 'DONE', createdAt: pending.createdAt })).toThrow(
      InvalidVisit,
    );
  });

  it('preserves plannedFor when fulfilling (PENDING → DONE)', () => {
    const done = new Visit({
      id: 'v1',
      fieldId: 'f1',
      status: 'DONE',
      plannedFor: new Date('2026-08-10T00:00:00.000Z'),
      visitedAt: new Date('2026-08-03T10:00:00Z'),
      createdAt: pending.createdAt,
    });
    expect(done.status).toBe('DONE');
    expect(done.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(done.visitedAt?.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('rejects a CANCELLED without cancelledAt', () => {
    expect(() => new Visit({ ...pending, status: 'CANCELLED' })).toThrow(InvalidVisit);
  });

  it('stores optional notes and cancelledAt', () => {
    const at = new Date('2026-07-28T09:00:00Z');
    const v = new Visit({ ...pending, status: 'CANCELLED', cancelledAt: at, notes: 'revisar' });
    expect(v.status).toBe('CANCELLED');
    expect(v.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
    expect(v.notes).toBe('revisar');
  });
});
