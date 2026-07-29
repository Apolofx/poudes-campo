import type { DataReset } from '@/domain/ports/outbound/data-reset';

export class ClearAllData {
  constructor(private readonly reset: DataReset) {}
  async execute(): Promise<void> {
    await this.reset.clearAll();
  }
}
