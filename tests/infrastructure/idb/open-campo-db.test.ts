import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

describe('openCampoDb', () => {
  it('creates all object stores', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    expect([...db.objectStoreNames].sort()).toEqual([
      'clients', 'fields', 'reminders', 'visits', 'zones',
    ]);
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
});
