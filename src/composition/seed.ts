import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedZones, seedClients, seedFields } from './seed-data';

export async function seedIfEmpty(db: CampoDb): Promise<void> {
  if ((await db.count('fields')) > 0) return;

  const tx = db.transaction(['zones', 'clients', 'fields'], 'readwrite');
  await Promise.all([
    ...seedZones.map((z) => tx.objectStore('zones').put(z)),
    ...seedClients.map((c) => tx.objectStore('clients').put(c)),
    ...seedFields.map((f) => tx.objectStore('fields').put(f)),
    tx.done,
  ]);
}
