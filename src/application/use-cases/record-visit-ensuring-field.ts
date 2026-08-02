import type { CreateZone } from '@/application/use-cases/zone-catalog';
import type { CreateClient } from '@/application/use-cases/client-catalog';
import type { CreateField } from '@/application/use-cases/field-catalog';
import type { RecordVisit, RecordVisitInput, RecordVisitResult } from '@/application/use-cases/record-visit';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';

export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;

export interface RecordVisitEnsuringFieldInput extends Omit<RecordVisitInput, 'fieldId'> {
  field: { id: string } | { name: string; zone?: OptionalRef; client?: OptionalRef };
}

export interface RecordVisitEnsuringFieldResult extends RecordVisitResult {
  fieldId: FieldId;
}

export class RecordVisitEnsuringField {
  constructor(
    private readonly createZone: CreateZone,
    private readonly createClient: CreateClient,
    private readonly createField: CreateField,
    private readonly recordVisit: RecordVisit,
  ) {}

  async execute(input: RecordVisitEnsuringFieldInput): Promise<RecordVisitEnsuringFieldResult> {
    let fieldId: FieldId;

    if ('id' in input.field) {
      fieldId = input.field.id;
    } else {
      let zoneId: ZoneId | undefined;
      let clientId: ClientId | undefined;
      if (input.field.zone) {
        zoneId = 'id' in input.field.zone
          ? input.field.zone.id
          : (await this.createZone.execute(input.field.zone.name)).id;
      }
      if (input.field.client) {
        clientId = 'id' in input.field.client
          ? input.field.client.id
          : (await this.createClient.execute(input.field.client.name)).id;
      }
      fieldId = (await this.createField.execute({ name: input.field.name, zoneId, clientId })).id;
    }

    const { field: _ignored, ...rest } = input;
    const result = await this.recordVisit.execute({ ...rest, fieldId });
    return { ...result, fieldId };
  }
}
