import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type {
  ZoneRecord, ClientRecord, FieldRecord, VisitRecord, ReminderRecord, MediaRecord,
} from './records';

export interface CampoSchema extends DBSchema {
  zones: { key: string; value: ZoneRecord };
  clients: { key: string; value: ClientRecord };
  fields: { key: string; value: FieldRecord };
  visits: { key: string; value: VisitRecord; indexes: { 'by-field': string } };
  reminders: { key: string; value: ReminderRecord; indexes: { 'by-field': string } };
  media: { key: string; value: MediaRecord; indexes: { 'by-visit': string } };
}

export type CampoDb = IDBPDatabase<CampoSchema>;

interface LegacyReadStore<T> {
  getAll(): Promise<T[]>;
}

interface LegacyWriteStore<T> {
  put(value: T): Promise<unknown>;
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

const DAY_MS = 86_400_000;

export function openCampoDb(name = 'campo'): Promise<CampoDb> {
  return openDB<CampoSchema>(name, 4, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('zones', { keyPath: 'id' });
        db.createObjectStore('clients', { keyPath: 'id' });
        db.createObjectStore('fields', { keyPath: 'id' });
        const visits = db.createObjectStore('visits', { keyPath: 'id' });
        visits.createIndex('by-field', 'fieldId');
        const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
        reminders.createIndex('by-field', 'fieldId');
      } else if (oldVersion < 3) {
        await migrateToV3(tx, oldVersion);
      }
      if (oldVersion < 4) {
        const media = db.createObjectStore('media', { keyPath: 'id' });
        media.createIndex('by-visit', 'visitId');
      }
    },
  });
}

async function migrateToV3(
  tx: IDBPTransaction<CampoSchema, StoreNames<CampoSchema>[], 'versionchange'>,
  oldVersion: number,
): Promise<void> {
  const now = new Date();
  const visitsStore = tx.objectStore('visits') as unknown as LegacyReadStore<LegacyVisitRecord> &
    LegacyWriteStore<VisitRecord>;
  const remindersStore = tx.objectStore('reminders') as unknown as LegacyReadStore<LegacyReminderRecord> &
    LegacyWriteStore<ReminderRecord>;

  const legacyVisits = await visitsStore.getAll();
  const legacyReminders = await remindersStore.getAll();
  const hasScheduled = oldVersion >= 2;
  const legacyScheduled = hasScheduled
    ? await (tx.objectStore('scheduled-visits' as StoreNames<CampoSchema>) as unknown as LegacyReadStore<LegacyScheduledVisitRecord>).getAll()
    : [];

  // 1) Visitas viejas: ACTIVE → DONE (visitedAt = visitDate); CANCELLED → CANCELLED.
  const doneRecords: VisitRecord[] = legacyVisits.map((v) => ({
    id: v.id,
    fieldId: v.fieldId,
    status: v.status === 'CANCELLED' ? 'CANCELLED' : 'DONE',
    visitedAt: v.visitDate,
    notes: v.notes,
    createdAt: v.createdAt,
    cancelledAt: v.cancelledAt,
  }));

  // 2) Por field, la visita ACTIVE más reciente con followUp → PENDIENTE nueva (id `${visitId}:next`).
  //    El lead se recupera del reminder que apuntaba a esa visita.
  const latestActiveByField = new Map<string, LegacyVisitRecord>();
  for (const v of legacyVisits) {
    if (v.status !== 'ACTIVE' || !v.followUp) continue;
    const current = latestActiveByField.get(v.fieldId);
    if (!current || v.createdAt.getTime() > current.createdAt.getTime()) {
      latestActiveByField.set(v.fieldId, v);
    }
  }
  const pendingFromFollowUp = new Map<string, VisitRecord>();
  const reanchorReminder = new Map<string, string>();
  for (const winner of latestActiveByField.values()) {
    const followUp = winner.followUp as { nextVisitDate: Date };
    const reminder = legacyReminders.find((r) => r.visitId === winner.id);
    const lead = reminder
      ? Math.max(0, Math.round((followUp.nextVisitDate.getTime() - reminder.remindAt.getTime()) / DAY_MS))
      : 0;
    const pendingId = `${winner.id}:next`;
    pendingFromFollowUp.set(winner.fieldId, {
      id: pendingId,
      fieldId: winner.fieldId,
      status: 'PENDING',
      plannedFor: followUp.nextVisitDate,
      reminderLeadDays: lead,
      createdAt: winner.createdAt,
    });
    reanchorReminder.set(winner.id, pendingId);
  }

  // 3) Scheduled viejas: ACTIVE → PENDIENTE (mismo id, lead guardado); CANCELLED → CANCELLED.
  const scheduledRecords: VisitRecord[] = legacyScheduled.map((s) => ({
    id: s.id,
    fieldId: s.fieldId,
    status: s.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
    plannedFor: s.scheduledDate,
    reminderLeadDays: s.status === 'ACTIVE' ? s.reminderLeadDays : undefined,
    notes: s.notes,
    createdAt: s.createdAt,
    cancelledAt: s.cancelledAt,
  }));

  // 4) Reconciliar: una sola PENDIENTE por field, gana la de createdAt más reciente.
  const cancelledPendingIds = new Set<string>();
  const pendingsByField = new Map<string, VisitRecord[]>();
  for (const p of [...pendingFromFollowUp.values(), ...scheduledRecords]) {
    if (p.status !== 'PENDING') continue;
    const list = pendingsByField.get(p.fieldId) ?? [];
    list.push(p);
    pendingsByField.set(p.fieldId, list);
  }
  for (const list of pendingsByField.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const loser of list.slice(1)) {
      loser.status = 'CANCELLED';
      loser.cancelledAt = now;
      cancelledPendingIds.add(loser.id);
    }
  }

  // 5) Reminders: sin scheduledVisitId; re-anejar a la PENDIENTE creada; cancelar los de pendings
  //    perdedoras en la reconciliación.
  for (const r of legacyReminders) {
    let visitId = r.visitId;
    if (reanchorReminder.has(r.visitId)) visitId = reanchorReminder.get(r.visitId) as string;
    const status = cancelledPendingIds.has(visitId) ? 'CANCELLED' : r.status;
    await remindersStore.put({ id: r.id, visitId, fieldId: r.fieldId, remindAt: r.remindAt, status });
  }

  for (const record of doneRecords) await visitsStore.put(record);
  for (const p of [...pendingFromFollowUp.values(), ...scheduledRecords]) await visitsStore.put(p);
  if (hasScheduled) tx.db.deleteObjectStore('scheduled-visits' as StoreNames<CampoSchema>);
}
