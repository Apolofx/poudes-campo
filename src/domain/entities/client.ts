import type { ClientId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Client {
  constructor(
    readonly id: ClientId,
    readonly name: string,
    readonly archived: boolean = false,
  ) {
    if (name.trim() === '') throw new EmptyName('Client name must not be empty');
  }

  archive(): Client {
    return new Client(this.id, this.name, true);
  }

  restore(): Client {
    return new Client(this.id, this.name, false);
  }
}
