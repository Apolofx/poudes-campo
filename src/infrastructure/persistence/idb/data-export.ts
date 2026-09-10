import type { CampoDb } from './open-campo-db';
import {
  CURRENT_EXPORT_VERSION,
  type CampoExport,
  type SerializedMediaRecord,
  type SerializedReminderRecord,
  type SerializedVisitRecord,
} from './export-types';

export async function exportAllData(db: CampoDb): Promise<CampoExport> {
  const tx = db.transaction(['zones', 'clients', 'fields', 'visits', 'reminders', 'media']);
  const [zones, clients, fields, visitsRaw, remindersRaw, mediaRaw] = await Promise.all([
    tx.objectStore('zones').getAll(),
    tx.objectStore('clients').getAll(),
    tx.objectStore('fields').getAll(),
    tx.objectStore('visits').getAll(),
    tx.objectStore('reminders').getAll(),
    tx.objectStore('media').getAll(),
  ]);
  await tx.done;

  const visits: SerializedVisitRecord[] = visitsRaw.map((v) => ({
    ...v,
    plannedFor: v.plannedFor?.toISOString(),
    visitedAt: v.visitedAt?.toISOString(),
    createdAt: v.createdAt.toISOString(),
    cancelledAt: v.cancelledAt?.toISOString(),
  }));

  const reminders: SerializedReminderRecord[] = remindersRaw.map((r) => ({
    ...r,
    remindAt: r.remindAt.toISOString(),
  }));

  const media: SerializedMediaRecord[] = await Promise.all(
    mediaRaw.map(async (m) => ({
      id: m.id,
      visitId: m.visitId,
      kind: m.kind,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      createdAt: m.createdAt.toISOString(),
      blobDataUrl: await blobToDataUrl(m.blob),
    })),
  );

  return {
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    zones, clients, fields, visits, reminders, media,
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return `data:${blob.type};base64,${arrayBufferToBase64(buffer)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}