import { describe, it, expect } from 'vitest';
import { makeEditCancelHarness } from '../support/edit-cancel-harness';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import {
  VisitNotFound,
  VisitAlreadyCancelled,
  InvalidVisit,
  PlannedDateNotFuture,
  FutureVisitDate,
  DuplicateVisitForDay,
} from '@/domain/shared/errors';

const D = (iso: string) => new Date(iso);

function pendingVisit(id: string, plannedForIso: string): Visit {
  return new Visit({
    id, fieldId: 'f1', status: 'PENDING',
    plannedFor: D(plannedForIso), reminderLeadDays: 3, createdAt: D('2026-07-20T10:00:00Z'), notes: 'orig',
  });
}

function doneVisit(id: string, visitedAtIso: string, plannedForIso?: string): Visit {
  return new Visit({
    id, fieldId: 'f1', status: 'DONE',
    visitedAt: D(visitedAtIso),
    plannedFor: plannedForIso ? D(plannedForIso) : undefined,
    createdAt: D(visitedAtIso), notes: 'orig',
  });
}

describe('EditVisit — pending', () => {
  it('edits notes and plannedFor in place', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(pendingVisit('p1', '2026-08-10T00:00:00Z'));
    await h.edit.execute({
      kind: 'pending', visitId: 'p1',
      plannedFor: D('2026-08-15T00:00:00Z'), reminderLeadDays: 5, notes: 'corregido',
    });
    const saved = await h.visits.findById('p1');
    expect(saved?.notes).toBe('corregido');
    expect(saved?.plannedFor?.toISOString()).toBe('2026-08-15T00:00:00.000Z');
    expect(saved?.reminderLeadDays).toBe(5);
  });

  it('rejects a planned date in the past', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(pendingVisit('p1', '2026-08-10T00:00:00Z'));
    await expect(
      h.edit.execute({ kind: 'pending', visitId: 'p1', plannedFor: D('2026-07-20T00:00:00Z'), reminderLeadDays: 3 }),
    ).rejects.toBeInstanceOf(PlannedDateNotFuture);
  });

  it('clamps the lead and recreates the own reminder', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(pendingVisit('p1', '2026-08-10T00:00:00Z'));
    await h.reminders.save(new Reminder({ id: 'rOld', visitId: 'p1', fieldId: 'f1', remindAt: D('2026-08-07T00:00:00Z') }));

    await h.edit.execute({ kind: 'pending', visitId: 'p1', plannedFor: D('2026-08-10T00:00:00Z'), reminderLeadDays: 99 });

    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).not.toBe('rOld');
    expect(pending[0].visitId).toBe('p1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-07-27T00:00:00.000Z');
    expect((await h.visits.findById('p1'))?.reminderLeadDays).toBe(14);
  });

  it('rejects editing a done visit with the pending form', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ kind: 'pending', visitId: 'v1', plannedFor: D('2026-08-10T00:00:00Z'), reminderLeadDays: 3 }),
    ).rejects.toBeInstanceOf(InvalidVisit);
  });
});

describe('EditVisit — done', () => {
  it('edits visitedAt and notes in place', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await h.edit.execute({ kind: 'done', visitId: 'v1', visitedAt: D('2026-07-27T08:00:00Z'), notes: 'corregido' });
    const saved = await h.visits.findById('v1');
    expect(saved?.notes).toBe('corregido');
    expect(saved?.visitedAt?.toISOString()).toBe('2026-07-27T08:00:00.000Z');
  });

  it('rejects a future visitedAt', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ kind: 'done', visitId: 'v1', visitedAt: D('2026-07-30T10:00:00Z') }),
    ).rejects.toBeInstanceOf(FutureVisitDate);
  });

  it('allows keeping the same day (excludes self from the duplicate guard)', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ kind: 'done', visitId: 'v1', visitedAt: D('2026-07-27T08:00:00Z'), notes: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('rejects a day already taken by another done visit', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-25T10:00:00Z'));
    await h.visits.save(doneVisit('v2', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ kind: 'done', visitId: 'v1', visitedAt: D('2026-07-27T09:00:00Z') }),
    ).rejects.toBeInstanceOf(DuplicateVisitForDay);
  });

  it('keeps plannedFor when a fulfilled visit is edited', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z', '2026-08-10T00:00:00Z'));
    await h.edit.execute({ kind: 'done', visitId: 'v1', visitedAt: D('2026-07-27T09:00:00Z') });
    expect((await h.visits.findById('v1'))?.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('rejects editing a pending visit with the done form', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(pendingVisit('p1', '2026-08-10T00:00:00Z'));
    await expect(
      h.edit.execute({ kind: 'done', visitId: 'p1', visitedAt: D('2026-07-27T10:00:00Z') }),
    ).rejects.toBeInstanceOf(InvalidVisit);
  });
});

describe('EditVisit — common rules', () => {
  it('rejects editing a cancelled visit', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(new Visit({
      id: 'v1', fieldId: 'f1', status: 'CANCELLED',
      visitedAt: D('2026-07-27T10:00:00Z'), createdAt: D('2026-07-27T10:00:00Z'),
      cancelledAt: D('2026-07-28T09:00:00Z'),
    }));
    await expect(
      h.edit.execute({ kind: 'done', visitId: 'v1', visitedAt: D('2026-07-27T10:00:00Z') }),
    ).rejects.toBeInstanceOf(VisitAlreadyCancelled);
  });

  it('throws VisitNotFound for an unknown id', async () => {
    const h = makeEditCancelHarness();
    await expect(
      h.edit.execute({ kind: 'done', visitId: 'nope', visitedAt: D('2026-07-27T10:00:00Z') }),
    ).rejects.toBeInstanceOf(VisitNotFound);
  });
});
