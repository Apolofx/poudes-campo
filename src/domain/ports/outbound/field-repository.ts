import type { Field } from '@/domain/entities/field';
import type { FieldId } from '@/domain/shared/ids';
import type { FieldSearchResult } from '@/domain/services/field-search';

export interface FieldRepository {
  save(field: Field): Promise<void>;
  findById(id: FieldId): Promise<Field | null>;
  listAllWithHierarchy(): Promise<FieldSearchResult[]>;
}
