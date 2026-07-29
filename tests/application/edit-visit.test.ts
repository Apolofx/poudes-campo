import { describe, it, expect } from 'vitest';
import { makeEditCancelHarness } from '../support/edit-cancel-harness';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { VisitNotFound, VisitAlreadyCancelled, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';

const D = (iso: string) => new Date(iso);

function activeVisit(id: string, createdAtIso: string, opts: { followUp?: boolean } = {}) {
  return new Visit({
    id, fieldId: 'f1',
    visitDate: D(createdAtIso),
    createdAt: D(createdAtIso),
    notes: 'orig',
    followUp: opts.followUp
      ? { nextVisitDate: D('2026-08-03T10:00:00Z'), interval: VisitInterval.ofDays(7) }
      : undefined,
  });
}

describe('EditVisit', () => {
  it('edits notes in place', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z'));
    await h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T10:00:00Z'), notes: 'corregido', followUp: { kind: 'none' } });
    expect((await h.visits.findById('v1'))?.notes).toBe('corregido');
  });

  it('rejects a future visit date', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-30T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(FutureVisitDate);
  });

  it('allows keeping the same day (excludes self from the duplicate guard)', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T08:00:00Z'), notes: 'x', followUp: { kind: 'none' } }),
    ).resolves.toBeUndefined();
  });

  it('rejects a day already taken by another active visit', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(activeVisit('v1', '2026-07-25T10:00:00Z'));
    await h.visits.save(activeVisit('v2', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T09:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(DuplicateVisitForDay);
  });

  it('recomputes the reminder from now when it is the latest visit', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z', { followUp: true }));
    await h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T10:00:00Z'), followUp: { kind: 'interval', days: 10, reminderLeadDays: 2 } });
    const saved = await h.visits.findById('v1');
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-06T10:00:00.000Z'); // now + 10
    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].visitId).toBe('v1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-04T10:00:00.000Z'); // due - 2
  });

  it('cancels its own PENDING reminder and recreates exactly one new one when editing the latest visit', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z', { followUp: true }));
    await h.reminders.save(
      new Reminder({ id: 'rOld', visitId: 'v1', fieldId: 'f1', remindAt: D('2026-07-30T10:00:00Z') }),
    );

    await h.edit.execute({
      visitId: 'v1',
      visitDate: D('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 10, reminderLeadDays: 3 },
    });

    const pending = await h.reminders.findPendingByField('f1');
    // rOld must no longer be PENDING (it was cancelled) — only the freshly
    // created reminder shows up here, with a distinct id from the generator.
    expect(pending).toHaveLength(1);
    expect(pending.some((r) => r.id === 'rOld')).toBe(false);
    expect(pending[0].id).not.toBe('rOld');
    expect(pending[0].visitId).toBe('v1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-03T10:00:00.000Z'); // now + 10 - 3
  });

  it('does not create a reminder when editing a non-latest visit', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('vOld', '2026-07-20T10:00:00Z'));
    await h.visits.save(activeVisit('vNew', '2026-07-25T10:00:00Z'));
    await h.edit.execute({ visitId: 'vOld', visitDate: D('2026-07-20T10:00:00Z'), followUp: { kind: 'interval', days: 5 } });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('rejects editing a cancelled visit', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(new Visit({
      id: 'v1', fieldId: 'f1', visitDate: D('2026-07-27T10:00:00Z'), createdAt: D('2026-07-27T10:00:00Z'),
      status: 'CANCELLED', cancelledAt: D('2026-07-28T09:00:00Z'),
    }));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(VisitAlreadyCancelled);
  });

  it('throws VisitNotFound for an unknown id', async () => {
    const h = makeEditCancelHarness();
    await expect(
      h.edit.execute({ visitId: 'nope', visitDate: D('2026-07-27T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(VisitNotFound);
  });
});
