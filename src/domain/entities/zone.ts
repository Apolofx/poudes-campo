import type { ZoneId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Zone {
  constructor(
    readonly id: ZoneId,
    readonly name: string,
  ) {
    if (name.trim() === '') throw new EmptyName('Zone name must not be empty');
  }
}
