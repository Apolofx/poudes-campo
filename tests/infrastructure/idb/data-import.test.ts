import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import {
  parseExportFile, summarizeImport, importData,
} from '@/infrastructure/persistence/idb/data-import';
import { InvalidExportFormat, UnsupportedExportVersion } from '@/infrastructure/persistence/idb/export-errors';
import type { CampoExport } from '@/infrastructure/persistence/idb/export-types';

function sampleExport(): CampoExport {
  return {
    version: 1,
    exportedAt: '2026-09-10T12:00:00.000Z',
    zones: [{ id: 'z1', name: 'Norte' }],
    clients: [{ id: 'c1', name: 'Pérez' }],
    fields: [{ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }],
    visits: [{
      id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: '2026-09-01T12:00:00.000Z',
      notes: 'ok', createdAt: '2026-09-01T11:00:00.000Z',
    }],
    reminders: [{ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: '2026-09-01T12:00:00.000Z', status: 'PENDING' }],
    media: [],
  };
}

async function open() {
  return openCampoDb(`import-${Math.random()}`);
}

describe('parseExportFile', () => {
  it('acepta un export válido', () => {
    const data = parseExportFile(JSON.stringify(sampleExport()));
    expect(data.version).toBe(1);
    expect(data.visits).toHaveLength(1);
  });

  it('rechaza JSON inválido', () => {
    expect(() => parseExportFile('{nope')).toThrow(InvalidExportFormat);
  });

  it('rechaza una versión no soportada', () => {
    const json = JSON.stringify({ ...sampleExport(), version: 2 });
    const err = (() => { try { parseExportFile(json); } catch (e) { return e; } })() as UnsupportedExportVersion;
    expect(err).toBeInstanceOf(UnsupportedExportVersion);
    expect(err.version).toBe(2);
  });

  it('rechaza un objeto sin los arrays', () => {
    expect(() => parseExportFile(JSON.stringify({ version: 1, exportedAt: 'x', zones: [] }))).toThrow(InvalidExportFormat);
  });
});

describe('summarizeImport', () => {
  it('cuenta cada tipo', () => {
    expect(summarizeImport(sampleExport())).toEqual({
      zones: 1, clients: 1, fields: 1, visits: 1, reminders: 1, media: 0,
    });
  });
});

describe('importData', () => {
  it('importa a una db vacía rehidratando fechas', async () => {
    const db = await open();
    const { skipped } = await importData(db, sampleExport());

    expect(skipped).toBe(0);
    expect((await db.get('zones', 'z1'))?.name).toBe('Norte');
    const visit = await db.get('visits', 'v1');
    expect(visit?.visitedAt).toBeInstanceOf(Date);
    expect((visit?.visitedAt as Date).getTime()).toBe(new Date('2026-09-01T12:00:00.000Z').getTime());
    const reminder = await db.get('reminders', 'r1');
    expect(reminder?.remindAt).toBeInstanceOf(Date);
    db.close();
  });

  it('merge por ID: actualiza, inserta y respeta lo no mencionado', async () => {
    const db = await open();
    await db.put('zones', { id: 'z1', name: 'Viejo' });
    await db.put('zones', { id: 'z2', name: 'No mencionado' });

    await importData(db, sampleExport());

    expect((await db.get('zones', 'z1'))?.name).toBe('Norte');
    expect((await db.get('zones', 'z2'))?.name).toBe('No mencionado');
    expect(await db.count('zones')).toBe(2);
    db.close();
  });

  it('omite registros con referencias rotas y los cuenta en skipped', async () => {
    const db = await open();
    const data = sampleExport();
    data.fields.push({ id: 'f-orphan', name: 'Huérfano', clientId: 'no-such-client' });
    data.visits.push({ id: 'v-orphan', fieldId: 'no-such-field', status: 'PENDING', plannedFor: '2026-10-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' });
    data.reminders.push({ id: 'r-orphan', visitId: 'v-orphan', fieldId: 'no-such-field', remindAt: '2026-10-01T00:00:00.000Z', status: 'PENDING' });

    const { skipped } = await importData(db, data);

    expect(skipped).toBe(3);
    expect(await db.get('fields', 'f-orphan')).toBeUndefined();
    expect(await db.get('visits', 'v-orphan')).toBeUndefined();
    expect(await db.get('reminders', 'r-orphan')).toBeUndefined();
    expect(await db.get('visits', 'v1')).toBeDefined();
    db.close();
  });

  it('round-trip de media image y voice', async () => {
    const db = await open();
    const data = sampleExport();
    data.media = [
      {
        id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg',
        sizeBytes: 4, createdAt: '2026-09-01T13:00:00.000Z',
        blobDataUrl: `data:image/jpeg;base64,${Buffer.from([1, 2, 3, 255]).toString('base64')}`,
      },
      {
        id: 'm2', visitId: 'v1', kind: 'voice', mimeType: 'audio/webm',
        sizeBytes: 3, createdAt: '2026-09-01T13:00:00.000Z',
        blobDataUrl: `data:audio/webm;base64,${Buffer.from([9, 8, 7]).toString('base64')}`,
      },
    ];

    const { skipped } = await importData(db, data);

    expect(skipped).toBe(0);
    const img = await db.get('media', 'm1');
    const voice = await db.get('media', 'm2');
    expect(img?.mimeType).toBe('image/jpeg');
    expect([...new Uint8Array(await (img?.blob as Blob).arrayBuffer())]).toEqual([1, 2, 3, 255]);
    expect([...new Uint8Array(await (voice?.blob as Blob).arrayBuffer())]).toEqual([9, 8, 7]);
    db.close();
  });
});