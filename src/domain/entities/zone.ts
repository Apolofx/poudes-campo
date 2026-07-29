import type { ZoneId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Zone {
  constructor(
    readonly id: ZoneId,
    readonly name: string,
    readonly archived: boolean = false,
  ) {
    if (name.trim() === '') throw new EmptyName('Zone name must not be empty');
  }

  archive(): Zone {
    return new Zone(this.id, this.name, true);
  }

  restore(): Zone {
    return new Zone(this.id, this.name, false);
  }
}
