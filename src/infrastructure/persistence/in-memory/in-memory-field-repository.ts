import type { Field } from '@/domain/entities/field';
import type { Zone } from '@/domain/entities/zone';
import type { Client } from '@/domain/entities/client';
import type { FieldId, ZoneId, ClientId } from '@/domain/shared/ids';
import type { FieldRepository, CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
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
    return [...this.fields.values()]
      .filter((f) => !f.archived)
      .map((field) => this.rowFor(field));
  }

  async listAllForCatalog(): Promise<CatalogFieldRow[]> {
    return [...this.fields.values()].map((field) => this.rowFor(field));
  }

  async findActiveByClientId(id: ClientId): Promise<Field[]> {
    return [...this.fields.values()].filter((f) => !f.archived && f.clientId === id);
  }

  async findActiveByZoneId(id: ZoneId): Promise<Field[]> {
    return [...this.fields.values()].filter((f) => !f.archived && f.zoneId === id);
  }

  clear(): void {
    this.fields.clear();
  }

  private rowFor(field: Field): CatalogFieldRow {
    return {
      field,
      clientName: this.activeName(this.clients, field.clientId),
      zoneName: this.activeName(this.zones, field.zoneId),
    };
  }

  private activeName<T extends { name: string; archived: boolean }>(
    map: Map<string, T>,
    id?: string,
  ): string | undefined {
    if (id === undefined) return undefined;
    const entity = map.get(id);
    return entity && !entity.archived ? entity.name : undefined;
  }
}
