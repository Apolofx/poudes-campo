import type { DataReset } from '@/domain/ports/outbound/data-reset';

export class InMemoryDataReset implements DataReset {
  constructor(private readonly clears: Array<() => void>) {}
  async clearAll(): Promise<void> {
    for (const clear of this.clears) clear();
  }
}
