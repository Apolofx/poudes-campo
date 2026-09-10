import type { StoreNames } from 'idb';
import type { CampoDb, CampoSchema } from './open-campo-db';
import {
  CURRENT_EXPORT_VERSION,
  type CampoExport,
  type ImportResult,
  type ImportSummary,
  type SerializedMediaRecord,
  type SerializedReminderRecord,
  type SerializedVisitRecord,
} from './export-types';
import type { MediaRecord, ReminderRecord, VisitRecord } from './records';
import { InvalidExportFormat, UnsupportedExportVersion } from './export-errors';

export function parseExportFile(json: string): CampoExport {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidExportFormat();
  }
  if (!raw || typeof raw !== 'object') throw new InvalidExportFormat();
  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== CURRENT_EXPORT_VERSION) {
    throw new UnsupportedExportVersion(candidate.version as number | undefined);
  }
  for (const key of ['zones', 'clients', 'fields', 'visits', 'reminders', 'media']) {
    if (!Array.isArray(candidate[key])) throw new InvalidExportFormat();
  }
  return raw as CampoExport;
}

export function summarizeImport(data: CampoExport): ImportSummary {
  return {
    zones: data.zones.length,
    clients: data.clients.length,
    fields: data.fields.length,
    visits: data.visits.length,
    reminders: data.reminders.length,
    media: data.media.length,
  };
}

export async function importData(db: CampoDb, data: CampoExport): Promise<ImportResult> {
  let skipped = 0;

  await putAll(db, 'zones', data.zones);
  await putAll(db, 'clients', data.clients);

  const zoneIds = new Set([...(await db.getAllKeys('zones')), ...data.zones.map((z) => z.id)]);
  const clientIds = new Set([...(await db.getAllKeys('clients')), ...data.clients.map((c) => c.id)]);
  const fields = data.fields.filter((f) => {
    if (f.clientId && !clientIds.has(f.clientId)) { skipped++; return false; }
    if (f.zoneId && !zoneIds.has(f.zoneId)) { skipped++; return false; }
    return true;
  });
  await putAll(db, 'fields', fields);

  const fieldIds = new Set([...(await db.getAllKeys('fields')), ...fields.map((f) => f.id)]);
  const visits = data.visits.filter((v) => {
    if (!fieldIds.has(v.fieldId)) { skipped++; return false; }
    return true;
  }).map(rehydrateVisit);
  await putAll(db, 'visits', visits);

  const visitIds = new Set([...(await db.getAllKeys('visits')), ...visits.map((v) => v.id)]);
  const reminders = data.reminders.filter((r) => {
    if (!visitIds.has(r.visitId) || !fieldIds.has(r.fieldId)) { skipped++; return false; }
    return true;
  }).map(rehydrateReminder);
  await putAll(db, 'reminders', reminders);

  const media = data.media.filter((m) => {
    if (!visitIds.has(m.visitId)) { skipped++; return false; }
    return true;
  }).map(rehydrateMedia);
  await putAll(db, 'media', media);

  return { skipped };
}

function rehydrateVisit(v: SerializedVisitRecord): VisitRecord {
  return {
    ...v,
    plannedFor: v.plannedFor !== undefined ? new Date(v.plannedFor) : undefined,
    visitedAt: v.visitedAt !== undefined ? new Date(v.visitedAt) : undefined,
    createdAt: new Date(v.createdAt),
    cancelledAt: v.cancelledAt !== undefined ? new Date(v.cancelledAt) : undefined,
  };
}

function rehydrateReminder(r: SerializedReminderRecord): ReminderRecord {
  return { ...r, remindAt: new Date(r.remindAt) };
}

function rehydrateMedia(m: SerializedMediaRecord): MediaRecord {
  const { blobDataUrl, ...rest } = m;
  return { ...rest, createdAt: new Date(rest.createdAt), blob: dataUrlToBlob(blobDataUrl) };
}

async function putAll(db: CampoDb, store: StoreNames<CampoSchema>, records: unknown[]): Promise<void> {
  if (records.length === 0) return;
  const tx = db.transaction(store, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r as never)));
  await tx.done;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = header.match(/data:([^;]+);/)?.[1] ?? 'application/octet-stream';
  return new Blob([base64ToBytes(base64)], { type: mime });
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    const copy = new Uint8Array(new ArrayBuffer(buf.length));
    copy.set(buf);
    return copy;
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}