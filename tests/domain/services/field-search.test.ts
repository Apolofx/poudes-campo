import { describe, it, expect } from 'vitest';
import { Field } from '@/domain/entities/field';
import { fieldMatchesQuery, type FieldSearchResult } from '@/domain/services/field-search';

const result = (name: string, clientName: string, zoneName: string): FieldSearchResult => ({
  field: new Field({ id: 'f', name, clientId: 'c', zoneId: 'z' }),
  clientName,
  zoneName,
});

describe('fieldMatchesQuery', () => {
  it('matches a partial field name, case-insensitive', () => {
    expect(fieldMatchesQuery(result('Centenario', 'Perez', 'Quiroga'), 'cent')).toBe(true);
  });
  it('matches by client name', () => {
    expect(fieldMatchesQuery(result('X', 'Martinez', 'Quiroga'), 'marti')).toBe(true);
  });
  it('matches by zone name', () => {
    expect(fieldMatchesQuery(result('X', 'Perez', 'Bellocq'), 'bello')).toBe(true);
  });
  it('returns false when nothing matches', () => {
    expect(fieldMatchesQuery(result('X', 'Perez', 'Quiroga'), 'zzz')).toBe(false);
  });
  it('treats an empty query as matching everything', () => {
    expect(fieldMatchesQuery(result('X', 'Perez', 'Quiroga'), '   ')).toBe(true);
  });
});
