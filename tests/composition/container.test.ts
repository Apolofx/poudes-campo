import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { makeInMemoryContainer } from '../support/in-memory-container';
import { localTodayIso, utcDate } from '@/ui/date-utils';

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
      visitedAt: utcDate(localTodayIso()),
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
      visitedAt: utcDate(localTodayIso()),
      next: { kind: 'interval', days: 1, reminderLeadDays: 1 }, // remindAt = ahora
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

  it('exports and imports all data end to end', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);

    const data = await container.exportData();
    expect(data.version).toBe(1);
    expect(data.fields.length).toBeGreaterThan(0);
    expect(data.zones.length).toBeGreaterThan(0);

    const db2 = await openCampoDb(`t-${Math.random()}`);
    const container2 = buildContainer(db2);
    const result = await container2.importData(data);
    expect(result.skipped).toBe(0);
    expect((await container2.listCatalogFields.execute()).length).toBe(data.fields.length);
    expect((await container2.listZones.execute()).length).toBe(data.zones.length);
    db.close();
    db2.close();
  });
});
