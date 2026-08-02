import { describe, it, expect } from 'vitest';
import { makeEditCancelHarness } from '../support/edit-cancel-harness';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitNotFound } from '@/domain/shared/errors';

const D = (iso: string) => new Date(iso);

function doneVisit(id: string, visitedAtIso: string): Visit {
  return new Visit({
    id, fieldId: 'f1', status: 'DONE',
    visitedAt: D(visitedAtIso), createdAt: D(visitedAtIso),
  });
}

function pendingVisit(id: string, plannedForIso: string): Visit {
  return new Visit({
    id, fieldId: 'f1', status: 'PENDING',
    plannedFor: D(plannedForIso), reminderLeadDays: 3, createdAt: D(plannedForIso),
  });
}

describe('CancelVisit', () => {
  it('marks a done visit CANCELLED and sets cancelledAt to now', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-28T09:00:00Z'));
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await h.cancel.execute({ visitId: 'v1' });
    const saved = await h.visits.findById('v1');
    expect(saved?.status).toBe('CANCELLED');
    expect(saved?.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });

  it('cancels a pending visit and its own reminder', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(pendingVisit('p1', '2026-08-10T00:00:00Z'));
    await h.reminders.save(new Reminder({ id: 'r1', visitId: 'p1', fieldId: 'f1', remindAt: D('2026-08-07T00:00:00Z') }));
    await h.cancel.execute({ visitId: 'p1' });
    expect((await h.visits.findById('p1'))?.status).toBe('CANCELLED');
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it("does not cancel another visit's pending reminder on the same field", async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await h.visits.save(pendingVisit('p2', '2026-08-10T00:00:00Z'));
    await h.reminders.save(new Reminder({ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: D('2026-07-27T10:00:00Z') }));
    await h.reminders.save(new Reminder({ id: 'r2', visitId: 'p2', fieldId: 'f1', remindAt: D('2026-08-07T00:00:00Z') }));

    await h.cancel.execute({ visitId: 'v1' });

    const pending = await h.reminders.findPendingByField('f1');
    expect(pending.map((r) => r.id)).toEqual(['r2']);
  });

  it('is idempotent — cancelling twice does not throw', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(doneVisit('v1', '2026-07-27T10:00:00Z'));
    await h.cancel.execute({ visitId: 'v1' });
    await expect(h.cancel.execute({ visitId: 'v1' })).resolves.toBeUndefined();
    expect((await h.visits.findById('v1'))?.status).toBe('CANCELLED');
  });

  it('throws VisitNotFound for an unknown id', async () => {
    const h = makeEditCancelHarness();
    await expect(h.cancel.execute({ visitId: 'nope' })).rejects.toBeInstanceOf(VisitNotFound);
  });
});
