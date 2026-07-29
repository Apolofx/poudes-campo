import type { FieldRepository, CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { Field } from '@/domain/entities/field';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import type { FieldSearchResult } from '@/domain/services/field-search';
import type { CampoDb } from './open-campo-db';
import { toFieldRecord, fromFieldRecord } from './records';

export class IdbFieldRepository implements FieldRepository {
  constructor(private readonly db: CampoDb) {}

  async save(field: Field): Promise<void> {
    await this.db.put('fields', toFieldRecord(field));
  }

  async findById(id: FieldId): Promise<Field | null> {
    const record = await this.db.get('fields', id);
    return record ? fromFieldRecord(record) : null;
  }

  async listAllWithHierarchy(): Promise<FieldSearchResult[]> {
    const rows = await this.catalogRows();
    return rows.filter((r) => !r.field.archived);
  }

  async listAllForCatalog(): Promise<CatalogFieldRow[]> {
    return this.catalogRows();
  }

  async findActiveByClientId(id: ClientId): Promise<Field[]> {
    const fieldRecords = await this.db.getAll('fields');
    return fieldRecords.filter((r) => !(r.archived ?? false) && r.clientId === id).map(fromFieldRecord);
  }

  async findActiveByZoneId(id: ZoneId): Promise<Field[]> {
    const fieldRecords = await this.db.getAll('fields');
    return fieldRecords.filter((r) => !(r.archived ?? false) && r.zoneId === id).map(fromFieldRecord);
  }

  private async catalogRows(): Promise<CatalogFieldRow[]> {
    const [fieldRecords, zoneRecords, clientRecords] = await Promise.all([
      this.db.getAll('fields'),
      this.db.getAll('zones'),
      this.db.getAll('clients'),
    ]);
    const zoneNames = new Map(zoneRecords.filter((z) => !(z.archived ?? false)).map((z) => [z.id, z.name]));
    const clientNames = new Map(clientRecords.filter((c) => !(c.archived ?? false)).map((c) => [c.id, c.name]));
    return fieldRecords.map((record) => {
      const field = fromFieldRecord(record);
      return {
        field,
        clientName: field.clientId !== undefined ? clientNames.get(field.clientId) : undefined,
        zoneName: field.zoneId !== undefined ? zoneNames.get(field.zoneId) : undefined,
      };
    });
  }
}
