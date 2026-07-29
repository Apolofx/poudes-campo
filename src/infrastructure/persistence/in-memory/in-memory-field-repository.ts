import type { Field } from '@/domain/entities/field';
import type { Zone } from '@/domain/entities/zone';
import type { Client } from '@/domain/entities/client';
import type { FieldId, ZoneId, ClientId } from '@/domain/shared/ids';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { FieldSearchResult } from '@/domain/services/field-search';

export class InMemoryFieldRepository implements FieldRepository {
  private readonly fields = new Map<FieldId, Field>();

  constructor(
    private readonly zones: Map<ZoneId, Zone>,
    private readonly clients: Map<ClientId, Client>,
    fields: Field[] = [],
  ) {
    for (const field of fields) this.fields.set(field.id, field);
  }

  async save(field: Field): Promise<void> {
    this.fields.set(field.id, field);
  }

  async findById(id: FieldId): Promise<Field | null> {
    return this.fields.get(id) ?? null;
  }

  async listAllWithHierarchy(): Promise<FieldSearchResult[]> {
    return [...this.fields.values()].map((field) => ({
      field,
      clientName: field.clientId ? this.clients.get(field.clientId)?.name ?? '' : '',
      zoneName: field.zoneId ? this.zones.get(field.zoneId)?.name ?? '' : '',
    }));
  }
}
