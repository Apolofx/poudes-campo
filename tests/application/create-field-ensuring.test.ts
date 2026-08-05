import { describe, it, expect } from 'vitest';
import { CreateFieldEnsuring } from '@/application/use-cases/create-field-ensuring';
import { CreateZone, ListZones } from '@/application/use-cases/zone-catalog';
import { CreateClient, ListClients } from '@/application/use-cases/client-catalog';
import { CreateField } from '@/application/use-cases/field-catalog';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

function build() {
  const zoneMap = new Map<string, Zone>();
  const clientMap = new Map<string, Client>();
  const fields = new InMemoryFieldRepository(zoneMap, clientMap, []);
  const zones = new InMemoryZoneRepository(zoneMap);
  const clients = new InMemoryClientRepository(clientMap);
  const ids = new IncrementingIdGenerator();
  const createZone = new CreateZone(zones, ids);
  const createClient = new CreateClient(clients, ids);
  const createField = new CreateField(fields, ids);
  const uc = new CreateFieldEnsuring(createZone, createClient, createField);
  return { uc, zones, clients, fields, createZone, createClient };
}

describe('CreateFieldEnsuring', () => {
  it('crea zona, cliente y lote desde nombres', async () => {
    const { uc, zones, clients, fields } = build();

    const result = await uc.execute({ name: 'Paso 9', zone: { name: 'La Costa' }, client: { name: 'Herrera' } });

    expect(await zones.listAll()).toHaveLength(1);
    expect((await zones.listAll())[0].name).toBe('La Costa');
    expect(await clients.listAll()).toHaveLength(1);
    expect((await clients.listAll())[0].name).toBe('Herrera');
    const field = await fields.findById(result.fieldId);
    expect(field?.name).toBe('Paso 9');
    expect(field?.zoneId).toBe((await zones.listAll())[0].id);
    expect(field?.clientId).toBe((await clients.listAll())[0].id);
  });

  it('crea el lote sin zona ni cliente cuando se omiten', async () => {
    const { uc, zones, clients, fields } = build();

    const result = await uc.execute({ name: 'Potrero 9' });

    expect(await zones.listAll()).toHaveLength(0);
    expect(await clients.listAll()).toHaveLength(0);
    const field = await fields.findById(result.fieldId);
    expect(field?.name).toBe('Potrero 9');
    expect(field?.zoneId).toBeUndefined();
    expect(field?.clientId).toBeUndefined();
  });

  it('reusa zona y cliente existentes por id sin duplicar', async () => {
    const { uc, zones, clients, createZone, createClient, fields } = build();
    const zone = await createZone.execute('La Costa');
    const client = await createClient.execute('Herrera');

    const result = await uc.execute({ name: 'Paso 9', zone: { id: zone.id }, client: { id: client.id } });

    expect(await zones.listAll()).toHaveLength(1);
    expect(await clients.listAll()).toHaveLength(1);
    const field = await fields.findById(result.fieldId);
    expect(field?.zoneId).toBe(zone.id);
    expect(field?.clientId).toBe(client.id);
  });
});
