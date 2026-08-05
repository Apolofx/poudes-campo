import type { DataReset } from '@/domain/ports/outbound/data-reset';
import type { CampoDb } from './open-campo-db';

const STORES = ['zones', 'clients', 'fields', 'visits', 'reminders', 'media'] as const;

export class IdbDataReset implements DataReset {
  constructor(private readonly db: CampoDb) {}

  async clearAll(): Promise<void> {
    const tx = this.db.transaction(STORES, 'readwrite');
    await Promise.all([...STORES.map((store) => tx.objectStore(store).clear()), tx.done]);
  }
}
