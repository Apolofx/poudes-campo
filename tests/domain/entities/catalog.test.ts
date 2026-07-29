import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { EmptyName, MissingFieldReference } from '@/domain/shared/errors';

describe('Zone', () => {
  it('constructs with id and name', () => {
    expect(new Zone('z1', 'Quiroga').name).toBe('Quiroga');
  });
  it('rejects an empty name', () => {
    expect(() => new Zone('z1', '   ')).toThrow(EmptyName);
  });
  it('defaults archived to false', () => {
    expect(new Zone('z1', 'Quiroga').archived).toBe(false);
  });
  it('archive() returns an archived copy without mutating the original', () => {
    const z = new Zone('z1', 'Quiroga');
    const archived = z.archive();
    expect(archived.archived).toBe(true);
    expect(archived.id).toBe('z1');
    expect(archived.name).toBe('Quiroga');
    expect(z.archived).toBe(false);
  });
  it('restore() returns an active copy', () => {
    expect(new Zone('z1', 'Q', true).restore().archived).toBe(false);
  });
});

describe('Client', () => {
  it('rejects an empty name', () => {
    expect(() => new Client('c1', '')).toThrow(EmptyName);
  });
  it('archive() and restore() flip the archived flag', () => {
    const c = new Client('c1', 'Pérez');
    expect(c.archive().archived).toBe(true);
    expect(c.archive().restore().archived).toBe(false);
    expect(c.archived).toBe(false);
  });
});

describe('Field', () => {
  it('constructs with required client and zone references', () => {
    const f = new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' });
    expect(f.clientId).toBe('c1');
    expect(f.zoneId).toBe('z1');
  });
  it('rejects an empty name', () => {
    expect(() => new Field({ id: 'f1', name: '', clientId: 'c1', zoneId: 'z1' })).toThrow(EmptyName);
  });
  it('allows an absent client or zone reference (orphan)', () => {
    const f = new Field({ id: 'f1', name: 'X' });
    expect(f.clientId).toBeUndefined();
    expect(f.zoneId).toBeUndefined();
  });
  it('rejects a present-but-empty reference', () => {
    expect(() => new Field({ id: 'f1', name: 'X', clientId: '' })).toThrow(MissingFieldReference);
    expect(() => new Field({ id: 'f1', name: 'X', zoneId: '' })).toThrow(MissingFieldReference);
  });
  it('defaults archived to false and archive()/restore() flip it', () => {
    const f = new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
    expect(f.archived).toBe(false);
    expect(f.archive().archived).toBe(true);
    expect(f.archive().restore().archived).toBe(false);
    expect(f.archive().id).toBe('f1');
  });
  it('rename() returns a copy with the new name, preserving refs', () => {
    const f = new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' }).rename('Y');
    expect(f.name).toBe('Y');
    expect(f.clientId).toBe('c1');
  });
  it('reassignClient/reassignZone can set and clear references', () => {
    const f = new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
    expect(f.reassignClient('c2').clientId).toBe('c2');
    expect(f.reassignClient(undefined).clientId).toBeUndefined();
    expect(f.reassignZone(undefined).zoneId).toBeUndefined();
  });
  it('accepts optional coordinates and hectares', () => {
    const f = new Field({
      id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1',
      coordinates: Coordinates.of(-36, -61), hectares: Hectares.of(50),
    });
    expect(f.hectares?.value).toBe(50);
    expect(f.coordinates?.latitude).toBe(-36);
  });
});
