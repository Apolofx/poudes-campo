import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';

describe('InMemoryZoneRepository', () => {
  it('saves, finds by id, and lists all (including archived)', async () => {
    const map = new Map<string, Zone>();
    const repo = new InMemoryZoneRepository(map);
    await repo.save(new Zone('z1', 'Norte'));
    await repo.save(new Zone('z2', 'Sur', true));
    expect((await repo.findById('z1'))?.name).toBe('Norte');
    expect(await repo.findById('nope')).toBeNull();
    expect((await repo.listAll()).map((z) => z.id).sort()).toEqual(['z1', 'z2']);
  });
});

describe('InMemoryClientRepository', () => {
  it('saves and finds clients', async () => {
    const repo = new InMemoryClientRepository(new Map());
    await repo.save(new Client('c1', 'Pérez'));
    expect((await repo.findById('c1'))?.name).toBe('Pérez');
    expect((await repo.listAll()).length).toBe(1);
  });
});
