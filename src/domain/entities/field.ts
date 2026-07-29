import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import { EmptyName, MissingFieldReference } from '@/domain/shared/errors';
import type { Coordinates } from '@/domain/value-objects/coordinates';
import type { Hectares } from '@/domain/value-objects/hectares';

export interface FieldProps {
  id: FieldId;
  name: string;
  clientId?: ClientId;
  zoneId?: ZoneId;
  coordinates?: Coordinates;
  hectares?: Hectares;
  crop?: string;
  archived?: boolean;
}

export class Field {
  readonly id: FieldId;
  readonly name: string;
  readonly clientId?: ClientId;
  readonly zoneId?: ZoneId;
  readonly coordinates?: Coordinates;
  readonly hectares?: Hectares;
  readonly crop?: string;
  readonly archived: boolean;

  constructor(props: FieldProps) {
    if (props.name.trim() === '') throw new EmptyName('Field name must not be empty');
    if (props.clientId !== undefined && props.clientId.trim() === '') {
      throw new MissingFieldReference('Field client reference must not be empty when present');
    }
    if (props.zoneId !== undefined && props.zoneId.trim() === '') {
      throw new MissingFieldReference('Field zone reference must not be empty when present');
    }

    this.id = props.id;
    this.name = props.name;
    this.clientId = props.clientId;
    this.zoneId = props.zoneId;
    this.coordinates = props.coordinates;
    this.hectares = props.hectares;
    this.crop = props.crop;
    this.archived = props.archived ?? false;
  }

  private copy(overrides: Partial<FieldProps>): Field {
    return new Field({
      id: this.id,
      name: this.name,
      clientId: this.clientId,
      zoneId: this.zoneId,
      coordinates: this.coordinates,
      hectares: this.hectares,
      crop: this.crop,
      archived: this.archived,
      ...overrides,
    });
  }

  archive(): Field {
    return this.copy({ archived: true });
  }

  restore(): Field {
    return this.copy({ archived: false });
  }

  rename(name: string): Field {
    return this.copy({ name });
  }

  reassignClient(clientId?: ClientId): Field {
    return this.copy({ clientId });
  }

  reassignZone(zoneId?: ZoneId): Field {
    return this.copy({ zoneId });
  }
}
