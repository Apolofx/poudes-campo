import { describe, it, expect, beforeEach } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Field } from '@/domain/entities/field';
import { ZoneNotFound } from '@/domain/shared/errors';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { CreateZone, EditZone, ArchiveZone, RestoreZone, ListZones } from '@/application/use-cases/zone-catalog';

let zoneMap: Map<string, Zone>;
let zones: InMemoryZoneRepository;
let fields: InMemoryFieldRepository;

beforeEach(() => {
  zoneMap = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clientMap = new Map();
  zones = new InMemoryZoneRepository(zoneMap);
  fields = new InMemoryFieldRepository(zoneMap, clientMap, [
    new Field({ id: 'f1', name: 'Activo', zoneId: 'z1' }),
  ]);
});

describe('CreateZone', () => {
  it('creates a zone with a generated id', async () => {
    const z = await new CreateZone(zones, new IncrementingIdGenerator('z')).execute('Sur');
    expect(z.name).toBe('Sur');
    expect((await zones.findById(z.id))?.name).toBe('Sur');
  });
});

describe('EditZone', () => {
  it('renames an existing zone', async () => {
    await new EditZone(zones).execute('z1', 'Noreste');
    expect((await zones.findById('z1'))?.name).toBe('Noreste');
  });
  it('throws ZoneNotFound for an unknown id', async () => {
    await expect(new EditZone(zones).execute('nope', 'X')).rejects.toThrow(ZoneNotFound);
  });
});

describe('ArchiveZone', () => {
  it('cascade=true archives the zone and its active fields', async () => {
    await new ArchiveZone(zones, fields).execute('z1', true);
    expect((await zones.findById('z1'))?.archived).toBe(true);
    expect((await fields.findById('f1'))?.archived).toBe(true);
  });
  it('cascade=false archives the zone and nulls the zoneId of its active fields', async () => {
    await new ArchiveZone(zones, fields).execute('z1', false);
    expect((await zones.findById('z1'))?.archived).toBe(true);
    const f1 = await fields.findById('f1');
    expect(f1?.archived).toBe(false);
    expect(f1?.zoneId).toBeUndefined();
  });
  it('throws ZoneNotFound for an unknown id', async () => {
    await expect(new ArchiveZone(zones, fields).execute('nope', false)).rejects.toThrow(ZoneNotFound);
  });
});

describe('RestoreZone', () => {
  it('un-archives a zone', async () => {
    await new ArchiveZone(zones, fields).execute('z1', false);
    await new RestoreZone(zones).execute('z1');
    expect((await zones.findById('z1'))?.archived).toBe(false);
  });
});

describe('ListZones', () => {
  it('returns all zones including archived', async () => {
    await zones.save(new Zone('z2', 'Sur', true));
    expect((await new ListZones(zones).execute()).map((z) => z.id).sort()).toEqual(['z1', 'z2']);
  });
});
