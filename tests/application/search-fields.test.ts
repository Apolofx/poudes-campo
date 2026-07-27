import { describe, it, expect } from 'vitest';
import { SearchFields } from '@/application/use-cases/search-fields';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';

function repoWithSeed(): InMemoryFieldRepository {
  const zones = new Map([
    ['z1', new Zone('z1', 'Quiroga')],
    ['z2', new Zone('z2', 'Bellocq')],
  ]);
  const clients = new Map([
    ['c1', new Client('c1', 'Martinez')],
    ['c2', new Client('c2', 'Perez')],
  ]);
  const fields = [
    new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Esperanza', clientId: 'c2', zoneId: 'z2' }),
  ];
  return new InMemoryFieldRepository(zones, clients, fields);
}

describe('SearchFields', () => {
  it('finds by a partial field name', async () => {
    const results = await new SearchFields(repoWithSeed()).execute('esper');
    expect(results.map((r) => r.field.id)).toEqual(['f2']);
  });
  it('finds by zone name', async () => {
    const results = await new SearchFields(repoWithSeed()).execute('quiroga');
    expect(results.map((r) => r.field.id)).toEqual(['f1']);
  });
  it('returns all results on an empty query', async () => {
    expect(await new SearchFields(repoWithSeed()).execute('')).toHaveLength(2);
  });
});
