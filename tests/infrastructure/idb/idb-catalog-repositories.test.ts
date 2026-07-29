import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { IdbZoneRepository } from '@/infrastructure/persistence/idb/idb-zone-repository';
import { IdbClientRepository } from '@/infrastructure/persistence/idb/idb-client-repository';

let dbn = 0;
const freshDb = () => openCampoDb(`catalog-test-${dbn++}`);

describe('IdbZoneRepository', () => {
  it('saves, finds and lists zones (including archived)', async () => {
    const repo = new IdbZoneRepository(await freshDb());
    await repo.save(new Zone('z1', 'Norte'));
    await repo.save(new Zone('z2', 'Sur', true));
    expect((await repo.findById('z1'))?.name).toBe('Norte');
    expect((await repo.findById('nope'))).toBeNull();
    const all = await repo.listAll();
    expect(all.map((z) => z.id).sort()).toEqual(['z1', 'z2']);
    expect(all.find((z) => z.id === 'z2')?.archived).toBe(true);
  });
});

describe('IdbClientRepository', () => {
  it('saves and finds clients', async () => {
    const repo = new IdbClientRepository(await freshDb());
    await repo.save(new Client('c1', 'Pérez'));
    expect((await repo.findById('c1'))?.name).toBe('Pérez');
    expect((await repo.listAll()).length).toBe(1);
  });
});
