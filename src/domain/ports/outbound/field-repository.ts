import type { Field } from '@/domain/entities/field';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import type { FieldSearchResult } from '@/domain/services/field-search';

export interface CatalogFieldRow {
  field: Field;
  clientName?: string;
  zoneName?: string;
}

export interface FieldRepository {
  save(field: Field): Promise<void>;
  findById(id: FieldId): Promise<Field | null>;
  /** Solo lotes activos; nombres resueltos contra padres activos (undefined si falta/archivado). */
  listAllWithHierarchy(): Promise<FieldSearchResult[]>;
  /** Todos los lotes (incl. archivados) para el catálogo. */
  listAllForCatalog(): Promise<CatalogFieldRow[]>;
  findActiveByClientId(id: ClientId): Promise<Field[]>;
  findActiveByZoneId(id: ZoneId): Promise<Field[]>;
}
