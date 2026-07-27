import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import { EmptyName, MissingFieldReference } from '@/domain/shared/errors';
import type { Coordinates } from '@/domain/value-objects/coordinates';
import type { Hectares } from '@/domain/value-objects/hectares';

export interface FieldProps {
  id: FieldId;
  name: string;
  clientId: ClientId;
  zoneId: ZoneId;
  coordinates?: Coordinates;
  hectares?: Hectares;
  crop?: string;
}

export class Field {
  readonly id: FieldId;
  readonly name: string;
  readonly clientId: ClientId;
  readonly zoneId: ZoneId;
  readonly coordinates?: Coordinates;
  readonly hectares?: Hectares;
  readonly crop?: string;

  constructor(props: FieldProps) {
    if (props.name.trim() === '') throw new EmptyName('Field name must not be empty');
    if (!props.clientId) throw new MissingFieldReference('Field must reference a client');
    if (!props.zoneId) throw new MissingFieldReference('Field must reference a zone');

    this.id = props.id;
    this.name = props.name;
    this.clientId = props.clientId;
    this.zoneId = props.zoneId;
    this.coordinates = props.coordinates;
    this.hectares = props.hectares;
    this.crop = props.crop;
  }
}
