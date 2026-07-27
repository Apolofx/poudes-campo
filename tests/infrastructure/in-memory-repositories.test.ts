import { describe, it, expect } from 'vitest';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { Visit, type VisitStatus } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';

describe('FixedClock', () => {
  it('returns the configured instant and can be advanced', () => {
    const clock = new FixedClock(new Date('2026-07-27T10:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-07-27T10:00:00.000Z');
    clock.set(new Date('2026-07-28T10:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-07-28T10:00:00.000Z');
  });
});

describe('IncrementingIdGenerator', () => {
  it('produces unique sequential ids', () => {
    const gen = new IncrementingIdGenerator('v');
    expect([gen.next(), gen.next()]).toEqual(['v-1', 'v-2']);
  });
});

describe('InMemoryVisitRepository', () => {
  const day = new Date('2026-07-27T10:00:00Z');
  const visit = (id: string, status: VisitStatus = 'ACTIVE') =>
    new Visit({ id, fieldId: 'f1', visitDate: day, createdAt: day, status });

  it('finds an active visit on the same calendar day regardless of time', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit('v1'));
    const found = await repo.findActiveByFieldOnDay('f1', new Date('2026-07-27T23:00:00Z'));
    expect(found?.id).toBe('v1');
  });
  it('ignores cancelled visits for the day check', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit('v1', 'CANCELLED'));
    expect(await repo.findActiveByFieldOnDay('f1', day)).toBeNull();
  });
  it('lists visits by field', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit('v1'));
    expect(await repo.listByField('f1')).toHaveLength(1);
  });
});

describe('InMemoryReminderRepository', () => {
  it('returns only pending reminders for the field', async () => {
    const repo = new InMemoryReminderRepository();
    await repo.save(new Reminder({ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-08-03T10:00:00Z') }));
    const cancelled = new Reminder({ id: 'r2', visitId: 'v2', fieldId: 'f1', remindAt: new Date('2026-08-04T10:00:00Z') });
    cancelled.cancel();
    await repo.save(cancelled);
    const pending = await repo.findPendingByField('f1');
    expect(pending.map((r) => r.id)).toEqual(['r1']);
  });
});
