import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';

function setup() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur', true)]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Activo', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'Archivado', clientId: 'c1', zoneId: 'z1', archived: true }),
    new Field({ id: 'f3', name: 'Huérfano', zoneId: 'z1' }),
    new Field({ id: 'f4', name: 'ZonaArchivada', clientId: 'c1', zoneId: 'z2' }),
  ]);
  return { fields };
}

describe('InMemoryFieldRepository.listAllWithHierarchy', () => {
  it('excludes archived fields', async () => {
    const rows = await setup().fields.listAllWithHierarchy();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f3', 'f4']);
  });
  it('resolves names only against active parents (undefined otherwise)', async () => {
    const rows = await setup().fields.listAllWithHierarchy();
    const byId = new Map(rows.map((r) => [r.field.id, r]));
    expect(byId.get('f1')!.clientName).toBe('Pérez');
    expect(byId.get('f1')!.zoneName).toBe('Norte');
    expect(byId.get('f3')!.clientName).toBeUndefined(); // sin cliente
    expect(byId.get('f4')!.zoneName).toBeUndefined();   // zona archivada
  });
});

describe('InMemoryFieldRepository.listAllForCatalog', () => {
  it('includes archived fields, names resolved against active parents', async () => {
    const rows = await setup().fields.listAllForCatalog();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f2', 'f3', 'f4']);
  });
});

describe('InMemoryFieldRepository.findActiveBy*', () => {
  it('finds active fields by client, excluding archived', async () => {
    const found = await setup().fields.findActiveByClientId('c1');
    expect(found.map((f) => f.id).sort()).toEqual(['f1', 'f4']);
  });
  it('finds active fields by zone', async () => {
    const found = await setup().fields.findActiveByZoneId('z1');
    expect(found.map((f) => f.id).sort()).toEqual(['f1', 'f3']);
  });
});
