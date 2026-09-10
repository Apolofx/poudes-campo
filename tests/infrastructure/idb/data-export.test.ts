import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { exportAllData } from '@/infrastructure/persistence/idb/data-export';

async function open() {
  return openCampoDb(`export-${Math.random()}`);
}

describe('exportAllData', () => {
  it('exporta stores vacíos con la estructura mínima', async () => {
    const db = await open();
    const data = await exportAllData(db);
    expect(data.version).toBe(1);
    expect(data.zones).toEqual([]);
    expect(data.clients).toEqual([]);
    expect(data.fields).toEqual([]);
    expect(data.visits).toEqual([]);
    expect(data.reminders).toEqual([]);
    expect(data.media).toEqual([]);
    expect(new Date(data.exportedAt).toString()).not.toBe('Invalid Date');
    db.close();
  });

  it('exporta todos los tipos con fechas en ISO string', async () => {
    const db = await open();
    const now = new Date('2026-09-01T12:00:00Z');
    await db.put('zones', { id: 'z1', name: 'Norte', archived: true });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await db.put('fields', {
      id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1',
      coordinates: { latitude: -33, longitude: -60 }, hectares: 120, crop: 'soja',
    });
    await db.put('visits', {
      id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: now,
      notes: 'ok', createdAt: now,
    });
    await db.put('reminders', { id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: now, status: 'PENDING' });

    const data = await exportAllData(db);

    expect(data.zones).toEqual([{ id: 'z1', name: 'Norte', archived: true }]);
    expect(data.clients).toEqual([{ id: 'c1', name: 'Pérez' }]);
    expect(data.fields).toHaveLength(1);
    expect(data.fields[0].coordinates).toEqual({ latitude: -33, longitude: -60 });
    expect(data.visits[0].visitedAt).toBe(now.toISOString());
    expect(data.visits[0].createdAt).toBe(now.toISOString());
    expect(data.reminders[0].remindAt).toBe(now.toISOString());
    expect(typeof data.visits[0].visitedAt).toBe('string');
    db.close();
  });

  it('exporta media como blobDataUrl base64 preservando los bytes', async () => {
    const db = await open();
    const blob = new Blob([new Uint8Array([1, 2, 3, 255])], { type: 'image/jpeg' });
    await db.put('media', {
      id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg',
      sizeBytes: blob.size, createdAt: new Date('2026-09-01T00:00:00Z'), blob,
    });

    const data = await exportAllData(db);

    expect(data.media).toHaveLength(1);
    expect(data.media[0].blobDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    const base64 = data.media[0].blobDataUrl.split(',')[1];
    expect([...Buffer.from(base64, 'base64')]).toEqual([1, 2, 3, 255]);
    db.close();
  });
});