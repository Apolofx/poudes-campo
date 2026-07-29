import type { FieldRepository, CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import { Field } from '@/domain/entities/field';
import { FieldNotFound } from '@/domain/shared/errors';

export interface CreateFieldInput {
  name: string;
  clientId?: ClientId;
  zoneId?: ZoneId;
}

export interface EditFieldInput extends CreateFieldInput {
  id: FieldId;
}

export class CreateField {
  constructor(private readonly fields: FieldRepository, private readonly ids: IdGenerator) {}
  async execute(input: CreateFieldInput): Promise<Field> {
    const field = new Field({
      id: this.ids.next(),
      name: input.name,
      clientId: input.clientId,
      zoneId: input.zoneId,
    });
    await this.fields.save(field);
    return field;
  }
}

export class EditField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(input: EditFieldInput): Promise<Field> {
    const existing = await this.fields.findById(input.id);
    if (!existing) throw new FieldNotFound(`unknown field ${input.id}`);
    const updated = existing
      .rename(input.name)
      .reassignClient(input.clientId)
      .reassignZone(input.zoneId);
    await this.fields.save(updated);
    return updated;
  }
}

export class ArchiveField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(id: FieldId): Promise<void> {
    const field = await this.fields.findById(id);
    if (!field) throw new FieldNotFound(`unknown field ${id}`);
    await this.fields.save(field.archive());
  }
}

export class RestoreField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(id: FieldId): Promise<void> {
    const field = await this.fields.findById(id);
    if (!field) throw new FieldNotFound(`unknown field ${id}`);
    await this.fields.save(field.restore());
  }
}

export class ListCatalogFields {
  constructor(private readonly fields: FieldRepository) {}
  async execute(): Promise<CatalogFieldRow[]> {
    return this.fields.listAllForCatalog();
  }
}
