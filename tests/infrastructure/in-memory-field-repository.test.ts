import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';

describe('InMemoryFieldRepository', () => {
  it('resolves hierarchy names for every field', async () => {
    const zones = new Map([['z1', new Zone('z1', 'Quiroga')]]);
    const clients = new Map([['c1', new Client('c1', 'Martinez')]]);
    const repo = new InMemoryFieldRepository(zones, clients, [
      new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
    ]);
    const all = await repo.listAllWithHierarchy();
    expect(all).toHaveLength(1);
    expect(all[0].clientName).toBe('Martinez');
    expect(all[0].zoneName).toBe('Quiroga');
  });
  it('finds by id and returns null when absent', async () => {
    const repo = new InMemoryFieldRepository(new Map(), new Map(), []);
    expect(await repo.findById('nope')).toBeNull();
  });
  it('accepts fields saved after construction', async () => {
    const zones = new Map([['z1', new Zone('z1', 'Bellocq')]]);
    const clients = new Map([['c1', new Client('c1', 'Perez')]]);
    const repo = new InMemoryFieldRepository(zones, clients, []);
    await repo.save(new Field({ id: 'f9', name: 'La Nueva', clientId: 'c1', zoneId: 'z1' }));
    expect((await repo.findById('f9'))?.name).toBe('La Nueva');
  });
});
