import { describe, it, expect, beforeEach } from 'vitest';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { ClientNotFound } from '@/domain/shared/errors';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { CreateClient, EditClient, ArchiveClient, RestoreClient, ListClients } from '@/application/use-cases/client-catalog';

let clientMap: Map<string, Client>;
let clients: InMemoryClientRepository;
let fields: InMemoryFieldRepository;

beforeEach(() => {
  clientMap = new Map([['c1', new Client('c1', 'Pérez')]]);
  clients = new InMemoryClientRepository(clientMap);
  fields = new InMemoryFieldRepository(new Map(), clientMap, [
    new Field({ id: 'f1', name: 'Activo', clientId: 'c1' }),
  ]);
});

describe('CreateClient / EditClient', () => {
  it('creates and renames', async () => {
    const c = await new CreateClient(clients, new IncrementingIdGenerator('c')).execute('Gómez');
    expect(c.name).toBe('Gómez');
    await new EditClient(clients).execute('c1', 'Pérez SA');
    expect((await clients.findById('c1'))?.name).toBe('Pérez SA');
  });
  it('EditClient throws ClientNotFound', async () => {
    await expect(new EditClient(clients).execute('nope', 'X')).rejects.toThrow(ClientNotFound);
  });
});

describe('ArchiveClient', () => {
  it('cascade=true archives client and active fields', async () => {
    await new ArchiveClient(clients, fields).execute('c1', true);
    expect((await clients.findById('c1'))?.archived).toBe(true);
    expect((await fields.findById('f1'))?.archived).toBe(true);
  });
  it('cascade=false nulls the clientId of active fields', async () => {
    await new ArchiveClient(clients, fields).execute('c1', false);
    const f1 = await fields.findById('f1');
    expect(f1?.archived).toBe(false);
    expect(f1?.clientId).toBeUndefined();
  });
});

describe('RestoreClient / ListClients', () => {
  it('restores and lists', async () => {
    await new ArchiveClient(clients, fields).execute('c1', false);
    await new RestoreClient(clients).execute('c1');
    expect((await clients.findById('c1'))?.archived).toBe(false);
    expect((await new ListClients(clients).execute()).length).toBe(1);
  });
  it('throws ClientNotFound for an unknown id', async () => {
    await expect(new RestoreClient(clients).execute('nope')).rejects.toThrow(ClientNotFound);
  });
});
