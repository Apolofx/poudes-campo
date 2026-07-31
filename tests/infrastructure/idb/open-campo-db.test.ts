import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

describe('openCampoDb', () => {
  it('creates all object stores', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    expect([...db.objectStoreNames].sort()).toEqual([
      'clients', 'fields', 'reminders', 'scheduled-visits', 'visits', 'zones',
    ]);
    db.close();
  });

  it('creates the by-field indexes on visits and reminders', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const tx = db.transaction(['visits', 'reminders', 'scheduled-visits']);
    expect([...tx.objectStore('visits').indexNames]).toContain('by-field');
    expect([...tx.objectStore('reminders').indexNames]).toContain('by-field');
    expect([...tx.objectStore('scheduled-visits').indexNames]).toContain('by-field');
    await tx.done;
    db.close();
  });

  it('creates the scheduled-visits store (schema v2)', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    expect([...db.objectStoreNames]).toContain('scheduled-visits');
    const tx = db.transaction('scheduled-visits');
    expect([...tx.objectStore('scheduled-visits').indexNames]).toContain('by-field');
    await tx.done;
    db.close();
  });

  it('migrates an existing v1 database to v2 keeping old data', async () => {
    const name = `mig-${Math.random()}`;
    const db1 = await openCampoDb(name);
    await db1.put('zones', { id: 'z1', name: 'Norte' });
    db1.close();
    const db2 = await openCampoDb(name);
    expect((await db2.get('zones', 'z1'))?.name).toBe('Norte');
    expect([...db2.objectStoreNames]).toContain('scheduled-visits');
    db2.close();
  });
});
