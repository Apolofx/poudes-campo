import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { makeInMemoryContainer } from '../support/in-memory-container';

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

  it('dispatches due reminders and exposes them via reminderAviso', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);
    const [first] = await container.searchFields.execute('');
    // Registrar una visita con próxima ya vencida hoy (lead grande sobre intervalo corto).
    await container.recordVisit.execute({
      fieldId: first.field.id,
      visitDate: new Date(),
      followUp: { kind: 'interval', days: 1, reminderLeadDays: 1 }, // remindAt = ahora
    });
    const batch = await container.dispatchDueReminders.execute();
    expect(batch.length).toBeGreaterThan(0);
    expect(container.reminderAviso.snapshot()).toEqual(batch);
    db.close();
  });

  it('wires the catalog use cases', () => {
    const c = makeInMemoryContainer();
    expect(c.createZone).toBeDefined();
    expect(c.archiveClient).toBeDefined();
    expect(c.listCatalogFields).toBeDefined();
    expect(c.clearAllData).toBeDefined();
  });
});
