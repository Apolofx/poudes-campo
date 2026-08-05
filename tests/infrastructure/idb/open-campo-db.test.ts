import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';
import { describe, it, expect } from 'vitest';
import { openCampoDb, type CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { fromVisitRecord, fromReminderRecord, type VisitRecord, type ReminderRecord } from '@/infrastructure/persistence/idb/records';

async function getVisitRecord(db: CampoDb, id: string): Promise<VisitRecord> {
  const record = await db.get('visits', id);
  expect(record).toBeDefined();
  return record as VisitRecord;
}

async function getReminderRecord(db: CampoDb, id: string): Promise<ReminderRecord> {
  const record = await db.get('reminders', id);
  expect(record).toBeDefined();
  return record as ReminderRecord;
}

interface LegacyVisitRecord {
  id: string;
  fieldId: string;
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: { nextVisitDate: Date; intervalDays: number };
  status: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: Date;
}

interface LegacyScheduledVisitRecord {
  id: string;
  fieldId: string;
  scheduledDate: Date;
  reminderLeadDays: number;
  createdAt: Date;
  notes?: string;
  status: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: Date;
}

interface LegacyReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: Date;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  scheduledVisitId?: string;
}

type LegacySchema = {
  zones: { key: string; value: unknown };
  clients: { key: string; value: unknown };
  fields: { key: string; value: unknown };
  visits: { key: string; value: LegacyVisitRecord; indexes: { 'by-field': string } };
  reminders: { key: string; value: LegacyReminderRecord; indexes: { 'by-field': string } };
  'scheduled-visits': { key: string; value: LegacyScheduledVisitRecord; indexes: { 'by-field': string } };
};

type LegacyDb = IDBPDatabase<LegacySchema>;

async function openLegacyDb(name: string, version: 1 | 2): Promise<LegacyDb> {
  return openDB<LegacySchema>(name, version, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('zones', { keyPath: 'id' });
        db.createObjectStore('clients', { keyPath: 'id' });
        db.createObjectStore('fields', { keyPath: 'id' });
        const visits = db.createObjectStore('visits', { keyPath: 'id' });
        visits.createIndex('by-field', 'fieldId');
        const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
        reminders.createIndex('by-field', 'fieldId');
      }
      if (oldVersion < 2 && version === 2) {
        const scheduled = db.createObjectStore('scheduled-visits', { keyPath: 'id' });
        scheduled.createIndex('by-field', 'fieldId');
      }
    },
  });
}

describe('openCampoDb', () => {
  it('creates all object stores of schema v4', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    expect([...db.objectStoreNames].sort()).toEqual(['clients', 'fields', 'media', 'reminders', 'visits', 'zones']);
    db.close();
  });

  it('creates the by-field indexes on visits and reminders', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const tx = db.transaction(['visits', 'reminders']);
    expect([...tx.objectStore('visits').indexNames]).toContain('by-field');
    expect([...tx.objectStore('reminders').indexNames]).toContain('by-field');
    await tx.done;
    db.close();
  });

  it('keeps catalog data across the migration', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openLegacyDb(name, 2);
    await db1.put('zones', { id: 'z1', name: 'Norte' });
    db1.close();
    const db2 = await openCampoDb(name);
    expect((await db2.get('zones', 'z1'))?.name).toBe('Norte');
    expect([...db2.objectStoreNames]).not.toContain('scheduled-visits');
    db2.close();
  });

  it('turns legacy ACTIVE visits into DONE and keeps cancelled ones', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openLegacyDb(name, 2);
    await db1.put('visits', {
      id: 'v1', fieldId: 'f1', visitDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'), status: 'ACTIVE',
    });
    await db1.put('visits', {
      id: 'v2', fieldId: 'f1', visitDate: new Date('2026-07-18T10:00:00Z'),
      createdAt: new Date('2026-07-18T10:05:00Z'), status: 'CANCELLED',
      cancelledAt: new Date('2026-07-19T00:00:00Z'),
    });
    db1.close();
    const db2 = await openCampoDb(name);
    const v1 = fromVisitRecord(await getVisitRecord(db2, 'v1'));
    expect(v1.status).toBe('DONE');
    expect(v1.visitedAt?.getTime()).toBe(new Date('2026-07-20T10:00:00Z').getTime());
    expect(v1.plannedFor).toBeUndefined();
    expect(fromVisitRecord(await getVisitRecord(db2, 'v2')).status).toBe('CANCELLED');
    db2.close();
  });

  it('turns a scheduled ACTIVE into a PENDING visit keeping the same id and its reminder', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openLegacyDb(name, 2);
    await db1.put('scheduled-visits', {
      id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'),
      reminderLeadDays: 3, createdAt: new Date('2026-07-31T12:00:00Z'), notes: 'revisar siembra', status: 'ACTIVE',
    });
    await db1.put('reminders', {
      id: 'r1', visitId: 's1', scheduledVisitId: 's1', fieldId: 'f1',
      remindAt: new Date('2026-08-07T00:00:00Z'), status: 'PENDING',
    });
    db1.close();
    const db2 = await openCampoDb(name);
    const visit = fromVisitRecord(await getVisitRecord(db2, 's1'));
    expect(visit.status).toBe('PENDING');
    expect(visit.plannedFor?.getTime()).toBe(new Date('2026-08-10T00:00:00Z').getTime());
    expect(visit.reminderLeadDays).toBe(3);
    expect(visit.notes).toBe('revisar siembra');
    const reminder = fromReminderRecord(await getReminderRecord(db2, 'r1'));
    expect(reminder.visitId).toBe('s1');
    expect((reminder as { scheduledVisitId?: string }).scheduledVisitId).toBeUndefined();
    db2.close();
  });

  it('turns the latest ACTIVE visit follow-up into a PENDING visit re-anchoring its reminder', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openLegacyDb(name, 2);
    await db1.put('visits', {
      id: 'v1', fieldId: 'f1', visitDate: new Date('2026-07-01T10:00:00Z'),
      createdAt: new Date('2026-07-01T10:05:00Z'), status: 'ACTIVE',
      followUp: { nextVisitDate: new Date('2026-07-15T10:05:00Z'), intervalDays: 14 },
    });
    await db1.put('visits', {
      id: 'v2', fieldId: 'f1', visitDate: new Date('2026-07-10T10:00:00Z'),
      createdAt: new Date('2026-07-10T10:05:00Z'), status: 'ACTIVE',
      followUp: { nextVisitDate: new Date('2026-07-24T10:05:00Z'), intervalDays: 14 },
    });
    await db1.put('reminders', {
      id: 'r2', visitId: 'v2', fieldId: 'f1', remindAt: new Date('2026-07-10T10:05:00Z'), status: 'PENDING',
    });
    db1.close();
    const db2 = await openCampoDb(name);
    const pending = fromVisitRecord(await getVisitRecord(db2, 'v2:next'));
    expect(pending.status).toBe('PENDING');
    expect(pending.plannedFor?.getTime()).toBe(new Date('2026-07-24T10:05:00Z').getTime());
    expect(pending.reminderLeadDays).toBe(14);
    expect(await db2.get('visits', 'v1:next')).toBeUndefined();
    const reminder = fromReminderRecord(await getReminderRecord(db2, 'r2'));
    expect(reminder.visitId).toBe('v2:next');
    db2.close();
  });

  it('reconciles two pendings for a field keeping the newest and cancelling the loser with its reminder', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openLegacyDb(name, 2);
    await db1.put('visits', {
      id: 'v1', fieldId: 'f1', visitDate: new Date('2026-07-01T10:00:00Z'),
      createdAt: new Date('2026-07-01T10:05:00Z'), status: 'ACTIVE',
      followUp: { nextVisitDate: new Date('2026-07-15T10:05:00Z'), intervalDays: 14 },
    });
    await db1.put('scheduled-visits', {
      id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'),
      reminderLeadDays: 3, createdAt: new Date('2026-07-31T12:00:00Z'), status: 'ACTIVE',
    });
    await db1.put('reminders', {
      id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-07-01T10:05:00Z'), status: 'PENDING',
    });
    db1.close();
    const db2 = await openCampoDb(name);
    expect(fromVisitRecord(await getVisitRecord(db2, 's1')).status).toBe('PENDING');
    const loser = fromVisitRecord(await getVisitRecord(db2, 'v1:next'));
    expect(loser.status).toBe('CANCELLED');
    expect(loser.cancelledAt).toBeInstanceOf(Date);
    expect(fromReminderRecord(await getReminderRecord(db2, 'r1')).status).toBe('CANCELLED');
    db2.close();
  });

  it('migrates a v1 database (without scheduled-visits) too', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openLegacyDb(name, 1);
    await db1.put('visits', {
      id: 'v1', fieldId: 'f1', visitDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'), status: 'ACTIVE',
    });
    db1.close();
    const db2 = await openCampoDb(name);
    expect(fromVisitRecord(await getVisitRecord(db2, 'v1')).status).toBe('DONE');
    expect([...db2.objectStoreNames]).not.toContain('scheduled-visits');
    db2.close();
  });
});
