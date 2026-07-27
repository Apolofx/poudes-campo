import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { Field } from '@/domain/entities/field';
import type { FieldId } from '@/domain/shared/ids';
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
    const [fieldRecords, zoneRecords, clientRecords] = await Promise.all([
      this.db.getAll('fields'),
      this.db.getAll('zones'),
      this.db.getAll('clients'),
    ]);
    const zones = new Map(zoneRecords.map((z) => [z.id, z.name]));
    const clients = new Map(clientRecords.map((c) => [c.id, c.name]));
    return fieldRecords.map((record) => {
      const field = fromFieldRecord(record);
      return {
        field,
        clientName: clients.get(field.clientId) ?? '',
        zoneName: zones.get(field.zoneId) ?? '',
      };
    });
  }
}
