import type { Field } from '@/domain/entities/field';

export interface FieldSearchResult {
  field: Field;
  clientName?: string;
  zoneName?: string;
}

export function fieldMatchesQuery(result: FieldSearchResult, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return [result.field.name, result.clientName, result.zoneName].some(
    (value) => value !== undefined && value.toLowerCase().includes(q),
  );
}
