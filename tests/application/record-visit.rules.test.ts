import { describe, it, expect } from 'vitest';
import { makeRecordVisitHarness } from '../support/record-visit-harness';
import {
  FutureVisitDate,
  DuplicateVisitForDay,
  FieldNotFound,
  InvalidVisitInterval,
} from '@/domain/shared/errors';

describe('RecordVisit — rules and edges', () => {
  it('rejects a future visit date', async () => {
    const { uc } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await expect(
      uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-28T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toThrow(FutureVisitDate);
  });

  it('rejects a second active visit on the same day', async () => {
    const { uc } = makeRecordVisitHarness(new Date('2026-07-27T20:00:00Z'));
    await uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-27T09:00:00Z'), followUp: { kind: 'none' } });
    await expect(
      uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-27T15:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toThrow(DuplicateVisitForDay);
  });

  it('rejects recording against an unknown field', async () => {
    const { uc } = makeRecordVisitHarness();
    await expect(
      uc.execute({ fieldId: 'ghost', visitDate: new Date('2026-07-27T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toThrow(FieldNotFound);
  });

  it('cancels the previous pending reminder when a new visit is recorded', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-27T10:00:00Z'), followUp: { kind: 'interval', days: 7 } });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(1);

    h.clock.set(new Date('2026-07-28T10:00:00Z'));
    await h.uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-28T10:00:00Z'), followUp: { kind: 'interval', days: 10 } });

    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-07T10:00:00.000Z');
  });

  it('records a manual next-visit date and derives the interval from today', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await h.uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'date', date: new Date('2026-08-05T10:00:00Z') },
    });
    const saved = await h.visits.findById(res.visitId);
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-05T10:00:00.000Z');
    expect(saved?.followUp?.interval.days).toBe(9);
  });

  it('rejects a manual next-visit date that is today or in the past', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await expect(
      h.uc.execute({
        fieldId: 'f1',
        visitDate: new Date('2026-07-27T10:00:00Z'),
        followUp: { kind: 'date', date: new Date('2026-07-27T20:00:00Z') },
      }),
    ).rejects.toThrow(InvalidVisitInterval);
  });
});

describe('RecordVisit reminderLeadDays clamp', () => {
  it('clamps a lead greater than the interval down to the interval (remindAt = now)', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 14, reminderLeadDays: 20 },
    });
    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    // nextVisitDate = now + 14; lead clamped to 14 => remindAt = now
    expect(pending[0].remindAt.getTime()).toBe(h.clock.now().getTime());
  });

  it('clamps a negative lead up to 0 (remindAt = nextVisitDate)', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 14, reminderLeadDays: -3 },
    });
    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    // nextVisitDate = now + 14; lead clamped to 0 => remindAt = nextVisitDate = now + 14
    const expected = new Date(h.clock.now().getTime() + 14 * 86_400_000);
    expect(pending[0].remindAt.getTime()).toBe(expected.getTime());
  });
});
