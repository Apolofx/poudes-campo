import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ZoneRecord, ClientRecord, FieldRecord, VisitRecord, ReminderRecord,
} from './records';

export interface CampoSchema extends DBSchema {
  zones: { key: string; value: ZoneRecord };
  clients: { key: string; value: ClientRecord };
  fields: { key: string; value: FieldRecord };
  visits: { key: string; value: VisitRecord; indexes: { 'by-field': string } };
  reminders: { key: string; value: ReminderRecord; indexes: { 'by-field': string } };
}

export type CampoDb = IDBPDatabase<CampoSchema>;

export function openCampoDb(name = 'campo'): Promise<CampoDb> {
  return openDB<CampoSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('zones', { keyPath: 'id' });
      db.createObjectStore('clients', { keyPath: 'id' });
      db.createObjectStore('fields', { keyPath: 'id' });
      const visits = db.createObjectStore('visits', { keyPath: 'id' });
      visits.createIndex('by-field', 'fieldId');
      const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
      reminders.createIndex('by-field', 'fieldId');
    },
  });
}
