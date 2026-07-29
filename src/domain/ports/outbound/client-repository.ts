import type { Client } from '@/domain/entities/client';
import type { ClientId } from '@/domain/shared/ids';

export interface ClientRepository {
  save(client: Client): Promise<void>;
  findById(id: ClientId): Promise<Client | null>;
  listAll(): Promise<Client[]>;
}
