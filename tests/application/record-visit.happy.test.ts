import { describe, it, expect } from 'vitest';
import { makeRecordVisitHarness } from '../support/record-visit-harness';

describe('RecordVisit — happy paths', () => {
  it('records a visit with no follow-up and creates no reminder', async () => {
    const { uc, visits, reminders } = makeRecordVisitHarness();
    const res = await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      notes: 'ok',
      followUp: { kind: 'none' },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.status).toBe('ACTIVE');
    expect(saved?.notes).toBe('ok');
    expect(saved?.followUp).toBeUndefined();
    expect(res.reminderId).toBeUndefined();
    expect(await reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('records a 7-day interval and schedules a reminder on the due date', async () => {
    const { uc, visits, reminders } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 7 },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.followUp?.interval.days).toBe(7);
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
    const pending = await reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('anchors the next visit to now, not to a retroactive visit date', async () => {
    const { uc, visits } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-20T09:00:00Z'),
      followUp: { kind: 'interval', days: 7 },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('applies a reminder lead so it fires before the due date', async () => {
    const { uc, reminders } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 7, reminderLeadDays: 3 },
    });
    const pending = await reminders.findPendingByField('f1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-07-31T10:00:00.000Z');
  });
});
