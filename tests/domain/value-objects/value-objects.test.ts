import { describe, it, expect } from 'vitest';
import { Hectares } from '@/domain/value-objects/hectares';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { InvalidHectares, InvalidCoordinates, InvalidVisitInterval } from '@/domain/shared/errors';

describe('Hectares', () => {
  it('accepts a positive value', () => {
    expect(Hectares.of(12.5).value).toBe(12.5);
  });
  it('rejects zero and negatives', () => {
    expect(() => Hectares.of(0)).toThrow(InvalidHectares);
    expect(() => Hectares.of(-1)).toThrow(InvalidHectares);
  });
});

describe('Coordinates', () => {
  it('accepts in-range lat/lng', () => {
    const c = Coordinates.of(-36.5, -61.2);
    expect(c.latitude).toBe(-36.5);
    expect(c.longitude).toBe(-61.2);
  });
  it('rejects out-of-range values', () => {
    expect(() => Coordinates.of(-91, 0)).toThrow(InvalidCoordinates);
    expect(() => Coordinates.of(0, 181)).toThrow(InvalidCoordinates);
  });
});

describe('VisitInterval', () => {
  it('accepts a positive integer of days', () => {
    expect(VisitInterval.ofDays(7).days).toBe(7);
  });
  it('rejects zero, negatives and non-integers', () => {
    expect(() => VisitInterval.ofDays(0)).toThrow(InvalidVisitInterval);
    expect(() => VisitInterval.ofDays(-5)).toThrow(InvalidVisitInterval);
    expect(() => VisitInterval.ofDays(7.5)).toThrow(InvalidVisitInterval);
  });
});
