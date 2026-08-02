import type { CreateZone } from '@/application/use-cases/zone-catalog';
import type { CreateClient } from '@/application/use-cases/client-catalog';
import type { CreateField } from '@/application/use-cases/field-catalog';
import type { ScheduleVisit, ScheduleVisitResult } from '@/application/use-cases/schedule-visit';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';

export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;

export interface ScheduleVisitEnsuringFieldInput {
  plannedFor: Date;
  reminderLeadDays: number;
  notes?: string;
  field: { id: string } | { name: string; zone?: OptionalRef; client?: OptionalRef };
}

export interface ScheduleVisitEnsuringFieldResult extends ScheduleVisitResult {
  fieldId: FieldId;
}

export class ScheduleVisitEnsuringField {
  constructor(
    private readonly createZone: CreateZone,
    private readonly createClient: CreateClient,
    private readonly createField: CreateField,
    private readonly scheduleVisit: ScheduleVisit,
  ) {}

  async execute(input: ScheduleVisitEnsuringFieldInput): Promise<ScheduleVisitEnsuringFieldResult> {
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

    const result = await this.scheduleVisit.execute({
      fieldId,
      plannedFor: input.plannedFor,
      reminderLeadDays: input.reminderLeadDays,
      notes: input.notes,
    });
    return { ...result, fieldId };
  }
}
