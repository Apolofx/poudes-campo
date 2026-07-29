import type { Client } from '@/domain/entities/client';
import type { ClientId } from '@/domain/shared/ids';
import type { ClientRepository } from '@/domain/ports/outbound/client-repository';

export class InMemoryClientRepository implements ClientRepository {
  constructor(private readonly clients: Map<ClientId, Client>) {}

  async save(client: Client): Promise<void> {
    this.clients.set(client.id, client);
  }

  async findById(id: ClientId): Promise<Client | null> {
    return this.clients.get(id) ?? null;
  }

  async listAll(): Promise<Client[]> {
    return [...this.clients.values()];
  }

  clear(): void {
    this.clients.clear();
  }
}
