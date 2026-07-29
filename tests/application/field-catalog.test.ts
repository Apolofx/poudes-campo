import { describe, it, expect, beforeEach } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { FieldNotFound } from '@/domain/shared/errors';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { CreateField, EditField, ArchiveField, RestoreField, ListCatalogFields } from '@/application/use-cases/field-catalog';

let fields: InMemoryFieldRepository;

beforeEach(() => {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  fields = new InMemoryFieldRepository(zones, clients, []);
});

describe('CreateField', () => {
  it('creates a field with generated id and optional refs', async () => {
    const f = await new CreateField(fields, new IncrementingIdGenerator('f')).execute({ name: 'El Alto', zoneId: 'z1' });
    expect(f.name).toBe('El Alto');
    expect(f.zoneId).toBe('z1');
    expect(f.clientId).toBeUndefined();
    expect((await fields.findById(f.id))?.name).toBe('El Alto');
  });
});

describe('EditField', () => {
  beforeEach(async () => {
    await fields.save(new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1', crop: 'soja', archived: false }));
  });
  it('renames and reassigns client/zone, preserving other attributes', async () => {
    const updated = await new EditField(fields).execute({ id: 'f1', name: 'Y', clientId: undefined, zoneId: 'z2' });
    expect(updated.name).toBe('Y');
    expect(updated.clientId).toBeUndefined();
    expect(updated.zoneId).toBe('z2');
    expect(updated.crop).toBe('soja');
  });
  it('throws FieldNotFound for unknown id', async () => {
    await expect(new EditField(fields).execute({ id: 'nope', name: 'Y' })).rejects.toThrow(FieldNotFound);
  });
});

describe('ArchiveField / RestoreField', () => {
  it('archives and restores', async () => {
    await fields.save(new Field({ id: 'f1', name: 'X', zoneId: 'z1' }));
    await new ArchiveField(fields).execute('f1');
    expect((await fields.findById('f1'))?.archived).toBe(true);
    await new RestoreField(fields).execute('f1');
    expect((await fields.findById('f1'))?.archived).toBe(false);
  });
  it('ArchiveField throws FieldNotFound for unknown id', async () => {
    await expect(new ArchiveField(fields).execute('nope')).rejects.toThrow(FieldNotFound);
  });
  it('RestoreField throws FieldNotFound for unknown id', async () => {
    await expect(new RestoreField(fields).execute('nope')).rejects.toThrow(FieldNotFound);
  });
});

describe('ListCatalogFields', () => {
  it('returns catalog rows including archived', async () => {
    await fields.save(new Field({ id: 'f1', name: 'X', zoneId: 'z1' }));
    await fields.save(new Field({ id: 'f2', name: 'Y', archived: true }));
    const rows = await new ListCatalogFields(fields).execute();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f2']);
  });
});
