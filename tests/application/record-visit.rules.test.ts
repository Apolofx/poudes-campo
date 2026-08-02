import { describe, it, expect } from 'vitest';
import { makeRecordVisitHarness } from '../support/record-visit-harness';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import {
  FutureVisitDate,
  DuplicateVisitForDay,
  FieldNotFound,
  InvalidVisit,
} from '@/domain/shared/errors';

describe('RecordVisit — rules and edges', () => {
  it('rejects a future visit date', async () => {
    const { uc } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await expect(
      uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-28T10:00:00Z'), next: { kind: 'none' } }),
    ).rejects.toThrow(FutureVisitDate);
  });

  it('rejects a second done visit on the same day', async () => {
    const { uc } = makeRecordVisitHarness(new Date('2026-07-27T20:00:00Z'));
    await uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-27T09:00:00Z'), next: { kind: 'none' } });
    await expect(
      uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-27T15:00:00Z'), next: { kind: 'none' } }),
    ).rejects.toThrow(DuplicateVisitForDay);
  });

  it('allows recording on a day with a pending (not done) visit', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T20:00:00Z'));
    await h.visits.save(new Visit({
      id: 'p1', fieldId: 'f1', status: 'PENDING',
      plannedFor: new Date('2026-07-27T09:00:00Z'), reminderLeadDays: 3, createdAt: new Date('2026-07-10T10:00:00Z'),
    }));
    await expect(
      h.uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-27T15:00:00Z'), next: { kind: 'none' } }),
    ).resolves.toMatchObject({ visitId: 'p1' });
  });

  it('rejects recording against an unknown field', async () => {
    const { uc } = makeRecordVisitHarness();
    await expect(
      uc.execute({ fieldId: 'ghost', visitedAt: new Date('2026-07-27T10:00:00Z'), next: { kind: 'none' } }),
    ).rejects.toThrow(FieldNotFound);
  });

  it('cancels the previous pending reminder when a new visit is recorded', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-27T10:00:00Z'), next: { kind: 'interval', days: 7 } });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(1);

    h.clock.set(new Date('2026-07-28T10:00:00Z'));
    await h.uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-28T10:00:00Z'), next: { kind: 'interval', days: 10 } });

    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-07T10:00:00.000Z');
  });

  it('creates a pending on a manual date deriving the lead from now', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await h.uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      next: { kind: 'date', date: new Date('2026-08-05T10:00:00Z'), reminderLeadDays: 2 },
    });
    const pending = await h.visits.findPendingByField('f1');
    expect(pending?.id).toBe(res.pendingId);
    expect(pending?.plannedFor?.toISOString()).toBe('2026-08-05T10:00:00.000Z');
    expect(pending?.reminderLeadDays).toBe(2);
  });

  it('rejects a manual next-visit date that is in the past', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await expect(
      h.uc.execute({
        fieldId: 'f1',
        visitedAt: new Date('2026-07-27T10:00:00Z'),
        next: { kind: 'date', date: new Date('2026-07-20T00:00:00Z') },
      }),
    ).rejects.toThrow(InvalidVisit);
  });

  it('cancels the fulfilled pending reminder when recording', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(new Visit({
      id: 'p1', fieldId: 'f1', status: 'PENDING',
      plannedFor: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: new Date('2026-07-20T10:00:00Z'),
    }));
    await h.reminders.save(new Reminder({
      id: 'r1', visitId: 'p1', fieldId: 'f1', remindAt: new Date('2026-08-07T00:00:00Z'),
    }));

    await h.uc.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-27T10:00:00Z'), next: { kind: 'none' } });

    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(0);
  });
});

describe('RecordVisit reminderLeadDays clamp', () => {
  it('clamps a lead greater than the interval down to the interval (remindAt = now)', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      next: { kind: 'interval', days: 14, reminderLeadDays: 20 },
    });
    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.getTime()).toBe(h.clock.now().getTime());
  });

  it('clamps a negative lead up to 0 (remindAt = plannedFor)', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({
      fieldId: 'f1',
      visitedAt: new Date('2026-07-27T10:00:00Z'),
      next: { kind: 'interval', days: 14, reminderLeadDays: -3 },
    });
    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    const expected = new Date(h.clock.now().getTime() + 14 * 86_400_000);
    expect(pending[0].remindAt.getTime()).toBe(expected.getTime());
  });
});
