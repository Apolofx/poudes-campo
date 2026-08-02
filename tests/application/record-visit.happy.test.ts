import { describe, it, expect } from 'vitest';
import { makeRecordVisitHarness } from '../support/record-visit-harness';
import { Visit } from '@/domain/entities/visit';

describe('RecordVisit — happy paths', () => {
  it('records a done visit with no next visit and creates no pending', async () => {
    const { uc, visits, reminders } = makeRecordVisitHarness();
    const res = await uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      notes: 'ok',
      next: { kind: 'none' },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.status).toBe('DONE');
    expect(saved?.visitedAt?.toISOString()).toBe('2026-07-27T10:00:00.000Z');
    expect(saved?.notes).toBe('ok');
    expect(res.pendingId).toBeUndefined();
    expect(res.reminderId).toBeUndefined();
    expect(await reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('creates a pending visit anchored to now when returning in N days', async () => {
    const { uc, visits, reminders } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      next: { kind: 'interval', days: 7 },
    });
    expect((await visits.findById(res.visitId))?.status).toBe('DONE');
    const pending = await visits.findPendingByField('f1');
    expect(pending?.status).toBe('PENDING');
    expect(pending?.plannedFor?.toISOString()).toBe('2026-08-03T10:00:00.000Z');
    expect(pending?.id).toBe(res.pendingId);
    const due = await reminders.findPendingByField('f1');
    expect(due).toHaveLength(1);
    expect(due[0].visitId).toBe(pending?.id);
    expect(due[0].remindAt.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('anchors the next visit to now, not to a retroactive visit date', async () => {
    const { uc, visits } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-20T09:00:00Z'),
      next: { kind: 'interval', days: 7 },
    });
    expect((await visits.findPendingByField('f1'))?.plannedFor?.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('applies a reminder lead so the aviso fires before the planned date', async () => {
    const { uc, reminders } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      next: { kind: 'interval', days: 7, reminderLeadDays: 3 },
    });
    const pending = await reminders.findPendingByField('f1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-07-31T10:00:00.000Z');
  });

  it('fulfills the active pending visit when one exists', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const pending = new Visit({
      id: 'p1', fieldId: 'f1', status: 'PENDING',
      plannedFor: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3,
      createdAt: new Date('2026-07-20T10:00:00Z'),
    });
    await h.visits.save(pending);
    const res = await h.uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      notes: 'cumplida',
      next: { kind: 'none' },
    });

    const saved = await h.visits.findById(res.visitId);
    expect(res.visitId).toBe('p1');
    expect(saved?.status).toBe('DONE');
    expect(saved?.visitedAt?.toISOString()).toBe('2026-07-27T10:00:00.000Z');
    expect(saved?.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(saved?.createdAt.toISOString()).toBe('2026-07-20T10:00:00.000Z');
    expect(await h.visits.findPendingByField('f1')).toBeNull();
  });

  it('fulfills early: visitedAt differs from plannedFor and the planned date is kept', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-30T12:00:00Z'));
    await h.visits.save(new Visit({
      id: 'p1', fieldId: 'f1', status: 'PENDING',
      plannedFor: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3,
      createdAt: new Date('2026-07-20T10:00:00Z'),
    }));
    await h.uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-30T09:00:00Z'), next: { kind: 'none' } });
    const saved = await h.visits.findById('p1');
    expect(saved?.status).toBe('DONE');
    expect(saved?.visitedAt?.toISOString()).toBe('2026-07-30T09:00:00.000Z');
    expect(saved?.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });
});
