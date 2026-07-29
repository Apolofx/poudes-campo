import type { ClientRepository } from '@/domain/ports/outbound/client-repository';
import type { Client } from '@/domain/entities/client';
import type { ClientId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toClientRecord, fromClientRecord } from './records';

export class IdbClientRepository implements ClientRepository {
  constructor(private readonly db: CampoDb) {}

  async save(client: Client): Promise<void> {
    await this.db.put('clients', toClientRecord(client));
  }

  async findById(id: ClientId): Promise<Client | null> {
    const record = await this.db.get('clients', id);
    return record ? fromClientRecord(record) : null;
  }

  async listAll(): Promise<Client[]> {
    return (await this.db.getAll('clients')).map(fromClientRecord);
  }
}
