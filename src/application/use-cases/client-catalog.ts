import type { ClientRepository } from '@/domain/ports/outbound/client-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { ClientId } from '@/domain/shared/ids';
import { Client } from '@/domain/entities/client';
import { ClientNotFound } from '@/domain/shared/errors';

export class CreateClient {
  constructor(private readonly clients: ClientRepository, private readonly ids: IdGenerator) {}
  async execute(name: string): Promise<Client> {
    const client = new Client(this.ids.next(), name);
    await this.clients.save(client);
    return client;
  }
}

export class EditClient {
  constructor(private readonly clients: ClientRepository) {}
  async execute(id: ClientId, name: string): Promise<Client> {
    const existing = await this.clients.findById(id);
    if (!existing) throw new ClientNotFound(`unknown client ${id}`);
    const renamed = new Client(existing.id, name, existing.archived);
    await this.clients.save(renamed);
    return renamed;
  }
}

export class ArchiveClient {
  constructor(private readonly clients: ClientRepository, private readonly fields: FieldRepository) {}
  async execute(id: ClientId, cascadeFields: boolean): Promise<void> {
    const client = await this.clients.findById(id);
    if (!client) throw new ClientNotFound(`unknown client ${id}`);
    await this.clients.save(client.archive());
    const affected = await this.fields.findActiveByClientId(id);
    for (const field of affected) {
      await this.fields.save(cascadeFields ? field.archive() : field.reassignClient(undefined));
    }
  }
}

export class RestoreClient {
  constructor(private readonly clients: ClientRepository) {}
  async execute(id: ClientId): Promise<void> {
    const client = await this.clients.findById(id);
    if (!client) throw new ClientNotFound(`unknown client ${id}`);
    await this.clients.save(client.restore());
  }
}

export class ListClients {
  constructor(private readonly clients: ClientRepository) {}
  async execute(): Promise<Client[]> {
    return this.clients.listAll();
  }
}
