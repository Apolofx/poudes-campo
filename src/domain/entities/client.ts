import type { ClientId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Client {
  constructor(
    readonly id: ClientId,
    readonly name: string,
  ) {
    if (name.trim() === '') throw new EmptyName('Client name must not be empty');
  }
}
