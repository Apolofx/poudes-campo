import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';

describe('buildContainer', () => {
  it('wires searchFields over the db', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);
    const results = await container.searchFields.execute('');
    expect(results.length).toBeGreaterThan(0);
    db.close();
  });

  it('records a visit end to end', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);
    const [first] = await container.searchFields.execute('');
    const result = await container.recordVisit.execute({
      fieldId: first.field.id,
      visitDate: new Date(),
      followUp: { kind: 'none' },
    });
    expect(result.visitId).toBeTruthy();
    db.close();
  });
});
