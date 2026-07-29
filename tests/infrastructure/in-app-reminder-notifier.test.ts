import { describe, it, expect } from 'vitest';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import type { DueReminder } from '@/domain/ports/outbound/reminder-notifier';

const item: DueReminder = {
  reminderId: 'r1', fieldId: 'f1', fieldName: 'El Alto',
  clientName: 'Pérez', zoneName: 'Norte',
  nextVisitDate: new Date('2026-08-12T00:00:00Z'), remindAt: new Date('2026-08-09T00:00:00Z'),
};

describe('InAppReminderNotifier', () => {
  it('starts with an empty snapshot', () => {
    expect(new InAppReminderNotifier().snapshot()).toEqual([]);
  });
  it('notify stores the batch and snapshot returns it', async () => {
    const n = new InAppReminderNotifier();
    await n.notify([item]);
    expect(n.snapshot()).toEqual([item]);
  });
  it('notify replaces the previous batch', async () => {
    const n = new InAppReminderNotifier();
    await n.notify([item]);
    await n.notify([]);
    expect(n.snapshot()).toEqual([]);
  });
  it('snapshot returns a defensive copy; mutations do not affect the store', async () => {
    const n = new InAppReminderNotifier();
    await n.notify([item]);
    const snapshotCopy = n.snapshot();
    snapshotCopy.pop();
    expect(n.snapshot()).toEqual([item]);
  });
});
