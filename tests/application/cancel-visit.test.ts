import { describe, it, expect } from 'vitest';
import { makeEditCancelHarness } from '../support/edit-cancel-harness';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { VisitNotFound } from '@/domain/shared/errors';

function seedVisitWithReminder(h: ReturnType<typeof makeEditCancelHarness>) {
  const visit = new Visit({
    id: 'v1', fieldId: 'f1',
    visitDate: new Date('2026-07-27T10:00:00Z'),
    createdAt: new Date('2026-07-27T10:00:00Z'),
    followUp: { nextVisitDate: new Date('2026-08-03T10:00:00Z'), interval: VisitInterval.ofDays(7) },
  });
  const reminder = new Reminder({ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-08-03T10:00:00Z') });
  return { visit, reminder };
}

describe('CancelVisit', () => {
  it('marks the visit CANCELLED and sets cancelledAt to now', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-28T09:00:00Z'));
    const { visit } = seedVisitWithReminder(h);
    await h.visits.save(visit);
    await h.cancel.execute({ visitId: 'v1' });
    const saved = await h.visits.findById('v1');
    expect(saved?.status).toBe('CANCELLED');
    expect(saved?.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });

  it("cancels the visit's own pending reminder", async () => {
    const h = makeEditCancelHarness();
    const { visit, reminder } = seedVisitWithReminder(h);
    await h.visits.save(visit);
    await h.reminders.save(reminder);
    await h.cancel.execute({ visitId: 'v1' });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('is idempotent — cancelling twice does not throw', async () => {
    const h = makeEditCancelHarness();
    const { visit } = seedVisitWithReminder(h);
    await h.visits.save(visit);
    await h.cancel.execute({ visitId: 'v1' });
    await expect(h.cancel.execute({ visitId: 'v1' })).resolves.toBeUndefined();
    expect((await h.visits.findById('v1'))?.status).toBe('CANCELLED');
  });

  it('throws VisitNotFound for an unknown id', async () => {
    const h = makeEditCancelHarness();
    await expect(h.cancel.execute({ visitId: 'nope' })).rejects.toBeInstanceOf(VisitNotFound);
  });
});
