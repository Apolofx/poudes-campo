import type { CreateZone } from '@/application/use-cases/zone-catalog';
import type { CreateClient } from '@/application/use-cases/client-catalog';
import type { CreateField } from '@/application/use-cases/field-catalog';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';

export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;

export interface CreateFieldEnsuringInput {
  name: string;
  zone?: OptionalRef;
  client?: OptionalRef;
}

export interface CreateFieldEnsuringResult {
  fieldId: FieldId;
}

export class CreateFieldEnsuring {
  constructor(
    private readonly createZone: CreateZone,
    private readonly createClient: CreateClient,
    private readonly createField: CreateField,
  ) {}

  async execute(input: CreateFieldEnsuringInput): Promise<CreateFieldEnsuringResult> {
    let zoneId: ZoneId | undefined;
    let clientId: ClientId | undefined;
    if (input.zone) {
      zoneId = 'id' in input.zone ? input.zone.id : (await this.createZone.execute(input.zone.name)).id;
    }
    if (input.client) {
      clientId = 'id' in input.client ? input.client.id : (await this.createClient.execute(input.client.name)).id;
    }
    const field = await this.createField.execute({ name: input.name, zoneId, clientId });
    return { fieldId: field.id };
  }
}
