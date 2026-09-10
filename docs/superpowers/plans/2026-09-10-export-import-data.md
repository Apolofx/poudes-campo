# Exportar e importar todos los datos — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-09-10-export-import-data-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `export-import-data`. **Regla de esta etapa: NO mergear a `main` hasta que el usuario pruebe en local.**
> Regla dura: ningún dato de dosis/agroquímicos/prescripciones. No tocar `src/domain/**` ni `src/application/**`.

## Decisiones de plan (refinan el spec)

- `Container` gana `exportData()` e `importData(data)` como dos **clausuras del composition root**
  (`exportAllData(db)` / `importData(db, data)`), porque la UI no tiene acceso al `db` (solo al
  Container vía `useCampo`).
- `makeInMemoryContainer` implementa `exportData` → export válido **vacío** e `importData` →
  `{ skipped: 0 }`. Los tests de pantalla hacen `vi.spyOn(container, 'exportData'/'importData')`.
- Blob↔base64 portable Node/browser (`Buffer` en Node, `btoa` por chunks en browser) → los tests
  de infra corren en el entorno `node` de Vitest, sin jsdom.

## Tareas

### Tarea 1 — Tipos del formato + errores de infraestructura

- [ ] Test rojo `tests/infrastructure/idb/export-errors.test.ts`
- [ ] `src/infrastructure/persistence/idb/export-types.ts` (tipos serializados + `CampoExport` + `ImportSummary` + `ImportResult`)
- [ ] `src/infrastructure/persistence/idb/export-errors.ts` (`InvalidExportFormat`, `UnsupportedExportVersion`)
- [ ] Verde + typecheck → commit `feat(infra): tipos del formato de respaldo y errores locales`

### Tarea 2 — Exportación (`exportAllData`)

- [ ] Test rojo `tests/infrastructure/idb/data-export.test.ts`
- [ ] `src/infrastructure/persistence/idb/data-export.ts`
- [ ] Verde + typecheck → commit `feat(infra): exportAllData serializa todos los stores a CampoExport`

### Tarea 3 — Importación (`parseExportFile`, `summarizeImport`, `importData`)

- [ ] Test rojo `tests/infrastructure/idb/data-import.test.ts`
- [ ] `src/infrastructure/persistence/idb/data-import.ts`
- [ ] Verde + typecheck → commit `feat(infra): importData merge por ID con integridad referencial`

### Tarea 4 — Wiring del Container (prod + in-memory) + test end-to-end

- [ ] Ampliar `tests/composition/container.test.ts` (export seeded → import a db fresca)
- [ ] `src/composition/container.ts`: `exportData`/`importData` sobre el db
- [ ] `tests/support/in-memory-container.ts`: `exportData` vacío / `importData` noop
- [ ] typecheck + suite → commit `feat(composition): exportData/importData en el Container`

### Tarea 5 — `triggerDownload` + hooks + componente `DataPortabilitySection`

- [ ] Test rojo `tests/ui/data-portability-section.test.tsx`
- [ ] `src/ui/export-download.ts`
- [ ] `src/ui/hooks/use-export-data.ts`
- [ ] `src/ui/hooks/use-import-data.ts`
- [ ] `src/ui/components/DataPortabilitySection.tsx`
- [ ] CSS en `src/ui/styles.css` (`.data-portability`, `.data-portability-actions`, `.data-file-input`, `.success`)
- [ ] Verde + typecheck → commit `feat(ui): sección de exportar/importar datos`

### Tarea 6 — `ConfigScreen`: sección de datos

- [ ] Ampliar `tests/ui/config-screen.test.tsx` (botones presentes)
- [ ] `src/ui/screens/ConfigScreen.tsx`: `<DataPortabilitySection />`
- [ ] Verde + typecheck → commit `feat(ui): exportar/importar desde Configuración`

### Tarea 7 — `CatalogHubScreen`: sección de datos

- [ ] Ampliar `tests/ui/catalog-hub-screen.test.tsx` (botones presentes)
- [ ] `src/ui/screens/CatalogHubScreen.tsx`: `<DataPortabilitySection />`
- [ ] Verde + typecheck → commit `feat(ui): exportar/importar desde el hub de Catálogo`

### Tarea 8 — Cierre (sin merge)

- [ ] Actualizar `docs/ROADMAP.md` (fila de etapa + bullet en "Se puede hacer hoy" + diferido)
- [ ] Suite completa verde + typecheck + `npm run build`
- [ ] **NO mergear**: dejar la rama lista para que el usuario pruebe en local

---

## Código de referencia (por tarea)

### Tarea 1

```ts
// src/infrastructure/persistence/idb/export-types.ts
import type { VisitStatus } from '@/domain/entities/visit';
import type { ReminderStatus } from '@/domain/entities/reminder';
import type { MediaKind } from '@/domain/entities/visit-media';
import type { ZoneRecord, ClientRecord, FieldRecord } from './records';

export const CURRENT_EXPORT_VERSION = 1 as const;

export interface SerializedVisitRecord {
  id: string;
  fieldId: string;
  status: VisitStatus;
  plannedFor?: string;   // ISO 8601
  visitedAt?: string;    // ISO 8601
  reminderLeadDays?: number;
  notes?: string;
  createdAt: string;     // ISO 8601
  cancelledAt?: string;  // ISO 8601
}

export interface SerializedReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: string;      // ISO 8601
  status: ReminderStatus;
}

export interface SerializedMediaRecord {
  id: string;
  visitId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;     // ISO 8601
  blobDataUrl: string;   // data:<mime>;base64,...
}

export interface CampoExport {
  version: typeof CURRENT_EXPORT_VERSION;
  exportedAt: string;     // ISO 8601
  zones: ZoneRecord[];
  clients: ClientRecord[];
  fields: FieldRecord[];
  visits: SerializedVisitRecord[];
  reminders: SerializedReminderRecord[];
  media: SerializedMediaRecord[];
}

export interface ImportSummary {
  zones: number;
  clients: number;
  fields: number;
  visits: number;
  reminders: number;
  media: number;
}

export interface ImportResult {
  skipped: number;
}
```

```ts
// src/infrastructure/persistence/idb/export-errors.ts
export class InvalidExportFormat extends Error {
  constructor() {
    super('invalid export file format');
    this.name = 'InvalidExportFormat';
  }
}

export class UnsupportedExportVersion extends Error {
  constructor(readonly version: number | undefined) {
    super(`unsupported export version: ${version === undefined ? 'missing' : version}`);
    this.name = 'UnsupportedExportVersion';
  }
}
```

```ts
// tests/infrastructure/idb/export-errors.test.ts
import { describe, it, expect } from 'vitest';
import { InvalidExportFormat, UnsupportedExportVersion } from '@/infrastructure/persistence/idb/export-errors';

describe('export-errors', () => {
  it('InvalidExportFormat es un Error con nombre y mensaje', () => {
    const err = new InvalidExportFormat();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidExportFormat');
    expect(err.message).toContain('invalid');
  });

  it('UnsupportedExportVersion conserva la versión encontrada', () => {
    const err = new UnsupportedExportVersion(2);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnsupportedExportVersion');
    expect(err.version).toBe(2);
  });
});
```

### Tarea 2

```ts
// src/infrastructure/persistence/idb/data-export.ts
import type { CampoDb } from './open-campo-db';
import {
  CURRENT_EXPORT_VERSION,
  type CampoExport,
  type SerializedMediaRecord,
  type SerializedReminderRecord,
  type SerializedVisitRecord,
} from './export-types';

export async function exportAllData(db: CampoDb): Promise<CampoExport> {
  const tx = db.transaction(['zones', 'clients', 'fields', 'visits', 'reminders', 'media']);
  const [zones, clients, fields, visitsRaw, remindersRaw, mediaRaw] = await Promise.all([
    tx.objectStore('zones').getAll(),
    tx.objectStore('clients').getAll(),
    tx.objectStore('fields').getAll(),
    tx.objectStore('visits').getAll(),
    tx.objectStore('reminders').getAll(),
    tx.objectStore('media').getAll(),
  ]);
  await tx.done;

  const visits: SerializedVisitRecord[] = visitsRaw.map((v) => ({
    ...v,
    plannedFor: v.plannedFor?.toISOString(),
    visitedAt: v.visitedAt?.toISOString(),
    createdAt: v.createdAt.toISOString(),
    cancelledAt: v.cancelledAt?.toISOString(),
  }));

  const reminders: SerializedReminderRecord[] = remindersRaw.map((r) => ({
    ...r,
    remindAt: r.remindAt.toISOString(),
  }));

  const media: SerializedMediaRecord[] = await Promise.all(
    mediaRaw.map(async (m) => ({
      id: m.id,
      visitId: m.visitId,
      kind: m.kind,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      createdAt: m.createdAt.toISOString(),
      blobDataUrl: await blobToDataUrl(m.blob),
    })),
  );

  return {
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    zones, clients, fields, visits, reminders, media,
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return `data:${blob.type};base64,${arrayBufferToBase64(buffer)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
```

```ts
// tests/infrastructure/idb/data-export.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { exportAllData } from '@/infrastructure/persistence/idb/data-export';

async function open() {
  return openCampoDb(`export-${Math.random()}`);
}

describe('exportAllData', () => {
  it('exporta stores vacíos con la estructura mínima', async () => {
    const db = await open();
    const data = await exportAllData(db);
    expect(data.version).toBe(1);
    expect(data.zones).toEqual([]);
    expect(data.clients).toEqual([]);
    expect(data.fields).toEqual([]);
    expect(data.visits).toEqual([]);
    expect(data.reminders).toEqual([]);
    expect(data.media).toEqual([]);
    expect(new Date(data.exportedAt).toString()).not.toBe('Invalid Date');
    db.close();
  });

  it('exporta todos los tipos con fechas en ISO string', async () => {
    const db = await open();
    const now = new Date('2026-09-01T12:00:00Z');
    await db.put('zones', { id: 'z1', name: 'Norte', archived: true });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await db.put('fields', {
      id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1',
      coordinates: { latitude: -33, longitude: -60 }, hectares: 120, crop: 'soja',
    });
    await db.put('visits', {
      id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: now,
      notes: 'ok', createdAt: now,
    });
    await db.put('reminders', { id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: now, status: 'PENDING' });

    const data = await exportAllData(db);

    expect(data.zones).toEqual([{ id: 'z1', name: 'Norte', archived: true }]);
    expect(data.clients).toEqual([{ id: 'c1', name: 'Pérez' }]);
    expect(data.fields).toHaveLength(1);
    expect(data.fields[0].coordinates).toEqual({ latitude: -33, longitude: -60 });
    expect(data.visits[0].visitedAt).toBe(now.toISOString());
    expect(data.visits[0].createdAt).toBe(now.toISOString());
    expect(data.reminders[0].remindAt).toBe(now.toISOString());
    expect(typeof data.visits[0].visitedAt).toBe('string');
    db.close();
  });

  it('exporta media como blobDataUrl base64 preservando los bytes', async () => {
    const db = await open();
    const blob = new Blob([new Uint8Array([1, 2, 3, 255])], { type: 'image/jpeg' });
    await db.put('media', {
      id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg',
      sizeBytes: blob.size, createdAt: new Date('2026-09-01T00:00:00Z'), blob,
    });

    const data = await exportAllData(db);

    expect(data.media).toHaveLength(1);
    expect(data.media[0].blobDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    const base64 = data.media[0].blobDataUrl.split(',')[1];
    expect([...Buffer.from(base64, 'base64')]).toEqual([1, 2, 3, 255]);
    db.close();
  });
});
```

### Tarea 3

```ts
// src/infrastructure/persistence/idb/data-import.ts
import type { StoreNames } from 'idb';
import type { CampoDb, CampoSchema } from './open-campo-db';
import {
  CURRENT_EXPORT_VERSION,
  type CampoExport,
  type ImportResult,
  type ImportSummary,
  type SerializedMediaRecord,
  type SerializedReminderRecord,
  type SerializedVisitRecord,
} from './export-types';
import type { MediaRecord, ReminderRecord, VisitRecord } from './records';
import { InvalidExportFormat, UnsupportedExportVersion } from './export-errors';

export function parseExportFile(json: string): CampoExport {
  const data: unknown = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new InvalidExportFormat();
  const candidate = data as Record<string, unknown>;
  if (candidate.version !== CURRENT_EXPORT_VERSION) {
    throw new UnsupportedExportVersion(candidate.version as number | undefined);
  }
  for (const key of ['zones', 'clients', 'fields', 'visits', 'reminders', 'media']) {
    if (!Array.isArray(candidate[key])) throw new InvalidExportFormat();
  }
  return data as CampoExport;
}

export function summarizeImport(data: CampoExport): ImportSummary {
  return {
    zones: data.zones.length,
    clients: data.clients.length,
    fields: data.fields.length,
    visits: data.visits.length,
    reminders: data.reminders.length,
    media: data.media.length,
  };
}

export async function importData(db: CampoDb, data: CampoExport): Promise<ImportResult> {
  let skipped = 0;

  await putAll(db, 'zones', data.zones);
  await putAll(db, 'clients', data.clients);

  const zoneIds = new Set([...(await db.getAllKeys('zones')), ...data.zones.map((z) => z.id)]);
  const clientIds = new Set([...(await db.getAllKeys('clients')), ...data.clients.map((c) => c.id)]);
  const fields = data.fields.filter((f) => {
    if (f.clientId && !clientIds.has(f.clientId)) { skipped++; return false; }
    if (f.zoneId && !zoneIds.has(f.zoneId)) { skipped++; return false; }
    return true;
  });
  await putAll(db, 'fields', fields);

  const fieldIds = new Set([...(await db.getAllKeys('fields')), ...fields.map((f) => f.id)]);
  const visits = data.visits.filter((v) => {
    if (!fieldIds.has(v.fieldId)) { skipped++; return false; }
    return true;
  }).map(rehydrateVisit);
  await putAll(db, 'visits', visits);

  const visitIds = new Set([...(await db.getAllKeys('visits')), ...visits.map((v) => v.id)]);
  const reminders = data.reminders.filter((r) => {
    if (!visitIds.has(r.visitId) || !fieldIds.has(r.fieldId)) { skipped++; return false; }
    return true;
  }).map(rehydrateReminder);
  await putAll(db, 'reminders', reminders);

  const media = data.media.filter((m) => {
    if (!visitIds.has(m.visitId)) { skipped++; return false; }
    return true;
  }).map(rehydrateMedia);
  await putAll(db, 'media', media);

  return { skipped };
}

function rehydrateVisit(v: SerializedVisitRecord): VisitRecord {
  return {
    ...v,
    plannedFor: v.plannedFor !== undefined ? new Date(v.plannedFor) : undefined,
    visitedAt: v.visitedAt !== undefined ? new Date(v.visitedAt) : undefined,
    createdAt: new Date(v.createdAt),
    cancelledAt: v.cancelledAt !== undefined ? new Date(v.cancelledAt) : undefined,
  };
}

function rehydrateReminder(r: SerializedReminderRecord): ReminderRecord {
  return { ...r, remindAt: new Date(r.remindAt) };
}

function rehydrateMedia(m: SerializedMediaRecord): MediaRecord {
  const { blobDataUrl, ...rest } = m;
  return { ...rest, createdAt: new Date(rest.createdAt), blob: dataUrlToBlob(blobDataUrl) };
}

async function putAll(db: CampoDb, store: StoreNames<CampoSchema>, records: unknown[]): Promise<void> {
  if (records.length === 0) return;
  const tx = db.transaction(store, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r as never)));
  await tx.done;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = header.match(/data:([^;]+);/)?.[1] ?? 'application/octet-stream';
  return new Blob([base64ToBytes(base64)], { type: mime });
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
```

```ts
// tests/infrastructure/idb/data-import.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import {
  parseExportFile, summarizeImport, importData,
} from '@/infrastructure/persistence/idb/data-import';
import { InvalidExportFormat, UnsupportedExportVersion } from '@/infrastructure/persistence/idb/export-errors';
import type { CampoExport } from '@/infrastructure/persistence/idb/export-types';

function sampleExport(): CampoExport {
  return {
    version: 1,
    exportedAt: '2026-09-10T12:00:00.000Z',
    zones: [{ id: 'z1', name: 'Norte' }],
    clients: [{ id: 'c1', name: 'Pérez' }],
    fields: [{ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }],
    visits: [{
      id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: '2026-09-01T12:00:00.000Z',
      notes: 'ok', createdAt: '2026-09-01T11:00:00.000Z',
    }],
    reminders: [{ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: '2026-09-01T12:00:00.000Z', status: 'PENDING' }],
    media: [],
  };
}

async function open() {
  return openCampoDb(`import-${Math.random()}`);
}

describe('parseExportFile', () => {
  it('acepta un export válido', () => {
    const data = parseExportFile(JSON.stringify(sampleExport()));
    expect(data.version).toBe(1);
    expect(data.visits).toHaveLength(1);
  });

  it('rechaza JSON inválido', () => {
    expect(() => parseExportFile('{nope')).toThrow(InvalidExportFormat);
  });

  it('rechaza una versión no soportada', () => {
    const json = JSON.stringify({ ...sampleExport(), version: 2 });
    const err = (() => { try { parseExportFile(json); } catch (e) { return e; } })() as UnsupportedExportVersion;
    expect(err).toBeInstanceOf(UnsupportedExportVersion);
    expect(err.version).toBe(2);
  });

  it('rechaza un objeto sin los arrays', () => {
    expect(() => parseExportFile(JSON.stringify({ version: 1, exportedAt: 'x', zones: [] }))).toThrow(InvalidExportFormat);
  });
});

describe('summarizeImport', () => {
  it('cuenta cada tipo', () => {
    expect(summarizeImport(sampleExport())).toEqual({
      zones: 1, clients: 1, fields: 1, visits: 1, reminders: 1, media: 0,
    });
  });
});

describe('importData', () => {
  it('importa a una db vacía rehidratando fechas', async () => {
    const db = await open();
    const { skipped } = await importData(db, sampleExport());

    expect(skipped).toBe(0);
    expect((await db.get('zones', 'z1'))?.name).toBe('Norte');
    const visit = await db.get('visits', 'v1');
    expect(visit?.visitedAt).toBeInstanceOf(Date);
    expect((visit?.visitedAt as Date).getTime()).toBe(new Date('2026-09-01T12:00:00.000Z').getTime());
    const reminder = await db.get('reminders', 'r1');
    expect(reminder?.remindAt).toBeInstanceOf(Date);
    db.close();
  });

  it('merge por ID: actualiza, inserta y respeta lo no mencionado', async () => {
    const db = await open();
    await db.put('zones', { id: 'z1', name: 'Viejo' });
    await db.put('zones', { id: 'z2', name: 'No mencionado' });

    await importData(db, sampleExport());

    expect((await db.get('zones', 'z1'))?.name).toBe('Norte');
    expect((await db.get('zones', 'z2'))?.name).toBe('No mencionado');
    expect(await db.count('zones')).toBe(2);
    db.close();
  });

  it('omite registros con referencias rotas y los cuenta en skipped', async () => {
    const db = await open();
    const data = sampleExport();
    data.fields.push({ id: 'f-orphan', name: 'Huérfano', clientId: 'no-such-client' });
    data.visits.push({ id: 'v-orphan', fieldId: 'no-such-field', status: 'PENDING', plannedFor: '2026-10-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' });
    data.reminders.push({ id: 'r-orphan', visitId: 'v-orphan', fieldId: 'no-such-field', remindAt: '2026-10-01T00:00:00.000Z', status: 'PENDING' });

    const { skipped } = await importData(db, data);

    expect(skipped).toBe(3);
    expect(await db.get('fields', 'f-orphan')).toBeUndefined();
    expect(await db.get('visits', 'v-orphan')).toBeUndefined();
    expect(await db.get('reminders', 'r-orphan')).toBeUndefined();
    expect((await db.get('visits', 'v1'))).toBeDefined();
    db.close();
  });

  it('round-trip de media image y voice', async () => {
    const db = await open();
    const data = sampleExport();
    data.media = [
      {
        id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg',
        sizeBytes: 4, createdAt: '2026-09-01T13:00:00.000Z',
        blobDataUrl: `data:image/jpeg;base64,${Buffer.from([1, 2, 3, 255]).toString('base64')}`,
      },
      {
        id: 'm2', visitId: 'v1', kind: 'voice', mimeType: 'audio/webm',
        sizeBytes: 3, createdAt: '2026-09-01T13:00:00.000Z',
        blobDataUrl: `data:audio/webm;base64,${Buffer.from([9, 8, 7]).toString('base64')}`,
      },
    ];

    const { skipped } = await importData(db, data);

    expect(skipped).toBe(0);
    const img = await db.get('media', 'm1');
    const voice = await db.get('media', 'm2');
    expect(img?.mimeType).toBe('image/jpeg');
    expect([...new Uint8Array(await (img?.blob as Blob).arrayBuffer())]).toEqual([1, 2, 3, 255]);
    expect([...new Uint8Array(await (voice?.blob as Blob).arrayBuffer())]).toEqual([9, 8, 7]);
    db.close();
  });
});
```

### Tarea 4

```ts
// src/composition/container.ts — cambios
// imports:
import { exportAllData } from '@/infrastructure/persistence/idb/data-export';
import { importData } from '@/infrastructure/persistence/idb/data-import';
import type { CampoExport, ImportResult } from '@/infrastructure/persistence/idb/export-types';

// interface Container — agregar después de syncPendingVisitsFeed:
  /** Serializa todos los datos del dispositivo al formato de respaldo. */
  exportData: () => Promise<CampoExport>;
  /** Fusiona los datos de un respaldo por ID (upsert) con integridad referencial. */
  importData: (data: CampoExport) => Promise<ImportResult>;

// return de buildContainer — agregar:
    exportData: () => exportAllData(db),
    importData: (data: CampoExport) => importData(db, data),
```

```ts
// tests/support/in-memory-container.ts — cambios
// imports:
import type { CampoExport, ImportResult } from '@/infrastructure/persistence/idb/export-types';

// return de makeInMemoryContainer — agregar (junto a syncPendingVisitsFeed):
    exportData: async (): Promise<CampoExport> => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      zones: [], clients: [], fields: [], visits: [], reminders: [], media: [],
    }),
    importData: async (): Promise<ImportResult> => ({ skipped: 0 }),
```

```ts
// tests/composition/container.test.ts — agregar al final del describe
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
```

### Tarea 5

```ts
// src/ui/export-download.ts
import type { CampoExport } from '@/infrastructure/persistence/idb/export-types';

export function triggerDownload(data: CampoExport, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

```ts
// src/ui/hooks/use-export-data.ts
import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';
import { triggerDownload } from '@/ui/export-download';

export function useExportData() {
  const { exportData } = useCampo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const exportNow = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      const data = await exportData();
      const today = new Date().toISOString().slice(0, 10);
      triggerDownload(data, `campo-backup-${today}.json`);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }, [exportData]);

  return { exportNow, busy, error };
}
```

```ts
// src/ui/hooks/use-import-data.ts
import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';
import { parseExportFile, summarizeImport } from '@/infrastructure/persistence/idb/data-import';
import type { CampoExport, ImportResult, ImportSummary } from '@/infrastructure/persistence/idb/export-types';

export function useImportData() {
  const { importData } = useCampo();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, setPending] = useState<CampoExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(undefined);
    setResult(null);
    try {
      const data = parseExportFile(await file.text());
      setPending(data);
      setSummary(summarizeImport(data));
    } catch (e) {
      setPending(null);
      setSummary(null);
      setError(e as Error);
    }
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setError(undefined);
    try {
      setResult(await importData(pending));
      setPending(null);
      setSummary(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }, [pending, importData]);

  const reset = useCallback(() => {
    setSummary(null);
    setPending(null);
    setError(undefined);
    setResult(null);
  }, []);

  return { handleFile, summary, pending, confirmImport, busy, error, result, reset };
}
```

```tsx
// src/ui/components/DataPortabilitySection.tsx
import { useRef } from 'react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useExportData } from '@/ui/hooks/use-export-data';
import { useImportData } from '@/ui/hooks/use-import-data';
import { InvalidExportFormat, UnsupportedExportVersion } from '@/infrastructure/persistence/idb/export-errors';
import type { ImportSummary } from '@/infrastructure/persistence/idb/export-types';

function plural(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function summaryText(s: ImportSummary): string {
  return [
    plural('zona', s.zones),
    plural('cliente', s.clients),
    plural('lote', s.fields),
    plural('visita', s.visits),
    plural('aviso', s.reminders),
    plural('adjunto', s.media),
  ].join(', ');
}

export function DataPortabilitySection() {
  const exportData = useExportData();
  const importData = useImportData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = exportData.busy || importData.busy;

  const importError = importData.error
    ? importData.error instanceof InvalidExportFormat
      ? 'El archivo no es un respaldo válido.'
      : importData.error instanceof UnsupportedExportVersion
        ? 'Este archivo viene de una versión más nueva de Campo. Actualizá la app y volvé a intentar.'
        : 'No se pudo importar el archivo.'
    : undefined;

  const importMessage =
    importData.result === null || importData.result === undefined
      ? undefined
      : importData.result.skipped > 0
        ? `Se importaron los datos. ${importData.result.skipped} registros se omitieron por referencias incompletas.`
        : 'Se importaron los datos correctamente.';

  const confirmMessage = importData.summary
    ? `Se importarán ${summaryText(importData.summary)}. Se fusionarán con los datos actuales: los registros con el mismo ID se actualizarán. ¿Continuar?`
    : '';

  return (
    <section className="data-portability" aria-label="Respaldo de datos">
      <span className="field-label">Respaldo de datos</span>
      <div className="data-portability-actions">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void exportData.exportNow()}>
          Exportar datos
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          Importar datos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="data-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importData.handleFile(file);
          }}
        />
      </div>
      {exportData.error && <p className="alert" role="alert">No se pudo exportar los datos.</p>}
      {importError && <p className="alert" role="alert">{importError}</p>}
      {importMessage && <p className="success" role="status">{importMessage}</p>}
      <ConfirmDialog
        open={importData.summary !== null}
        title="Importar datos"
        message={confirmMessage}
        confirmLabel="Importar"
        onConfirm={() => void importData.confirmImport()}
        onCancel={importData.reset}
      />
    </section>
  );
}
```

```css
/* src/ui/styles.css — agregar */
.data-file-input { display: none; }
.data-portability { margin: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--divider); }
.data-portability-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
.data-portability-actions > .btn-secondary { flex: 1; }
.success { margin: var(--space-2) 0 0; padding: var(--space-3); border-radius: var(--radius); background: color-mix(in srgb, var(--accent) 12%, var(--bg)); color: var(--accent); font-size: 13.5px; }
```

```tsx
// tests/ui/data-portability-section.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { DataPortabilitySection } from '@/ui/components/DataPortabilitySection';
import { triggerDownload } from '@/ui/export-download';
import { makeInMemoryContainer } from '../support/in-memory-container';
import type { CampoExport } from '@/infrastructure/persistence/idb/export-types';

vi.mock('@/ui/export-download', () => ({
  triggerDownload: vi.fn(),
}));

const FIXTURE: CampoExport = {
  version: 1,
  exportedAt: '2026-09-10T12:00:00.000Z',
  zones: [{ id: 'z1', name: 'Norte' }],
  clients: [],
  fields: [{ id: 'f1', name: 'Lote 1' }],
  visits: [{ id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: '2026-09-01T12:00:00.000Z', createdAt: '2026-09-01T11:00:00.000Z' }],
  reminders: [],
  media: [],
};

function renderSection(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <DataPortabilitySection />
    </CampoProvider>,
  );
  return container;
}

describe('DataPortabilitySection', () => {
  it('muestra los botones de exportar e importar', () => {
    renderSection();
    expect(screen.getByRole('button', { name: 'Exportar datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar datos' })).toBeInTheDocument();
  });

  it('exportar descarga el backup con el filename del día', async () => {
    const container = renderSection();
    vi.spyOn(container, 'exportData').mockResolvedValue(FIXTURE);

    await userEvent.click(screen.getByRole('button', { name: 'Exportar datos' }));

    const today = new Date().toISOString().slice(0, 10);
    expect(container.exportData).toHaveBeenCalledTimes(1);
    expect(triggerDownload).toHaveBeenCalledWith(FIXTURE, `campo-backup-${today}.json`);
  });

  it('importar muestra el resumen, confirma y avisa el éxito', async () => {
    const container = renderSection();
    const importSpy = vi.spyOn(container, 'importData').mockResolvedValue({ skipped: 0 });

    const file = new File([JSON.stringify(FIXTURE)], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByText(/Se importarán 1 zona, 1 lote, 1 visita/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    await screen.findByRole('status');
    expect(importSpy).toHaveBeenCalledWith(FIXTURE);
    expect(screen.getByRole('status')).toHaveTextContent('Se importaron los datos correctamente');
  });

  it('importar un archivo inválido muestra error de formato', async () => {
    renderSection();

    const file = new File(['{no es json'], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo no es un respaldo válido.');
  });

  it('importar una versión más nueva muestra el mensaje de actualizar la app', async () => {
    renderSection();

    const file = new File([JSON.stringify({ ...FIXTURE, version: 99 })], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/versión más nueva/);
  });

  it('avisa si hubo registros omitidos por referencias incompletas', async () => {
    const container = renderSection();
    vi.spyOn(container, 'importData').mockResolvedValue({ skipped: 4 });

    const file = new File([JSON.stringify(FIXTURE)], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });
    await screen.findByText(/Se importarán/);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('4 registros se omitieron');
  });
});
```

Nota: `importData.result` se inicializa en `null`; el estado del mensaje de éxito usa `result !== null && result !== undefined` para no mostrar nada antes del primer import (cuando no hubo `result`). El test espía `importData` con inferencia correcta si el espía es `vi.spyOn(container, 'importData')` (función tipada). Si TS infiere `Promise<unknown>` del spy genérico, tipar la variable: `const importSpy = container.importData` es un `vi.Spy`; en vitest 2 funciona porque el método está tipado en `Container`.

### Tarea 6

```tsx
// src/ui/screens/ConfigScreen.tsx — cambios
// imports:
import { DataPortabilitySection } from '@/ui/components/DataPortabilitySection';

// dentro del <main>, después del div.config-theme y antes del <form>:
      <DataPortabilitySection />
```

```tsx
// tests/ui/config-screen.test.tsx — agregar
  it('ofrece exportar e importar datos', async () => {
    renderConfig();
    expect(await screen.findByRole('heading', { name: 'Configuración' }));
    expect(screen.getByRole('button', { name: 'Exportar datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar datos' })).toBeInTheDocument();
  });
```

### Tarea 7

```tsx
// src/ui/screens/CatalogHubScreen.tsx — cambios
// imports:
import { DataPortabilitySection } from '@/ui/components/DataPortabilitySection';

// entre el </ul> y el <section className="danger-zone">:
      <DataPortabilitySection />
```

```tsx
// tests/ui/catalog-hub-screen.test.tsx — agregar
  it('ofrece exportar e importar datos', () => {
    renderHub();
    expect(screen.getByRole('button', { name: 'Exportar datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar datos' })).toBeInTheDocument();
  });
```

### Tarea 8 — ROADMAP

```markdown
# en la tabla de etapas agregar (estado según cierre):
| **export-import-data** | Respaldo/migración: exportar todos los datos a `campo-backup-YYYY-MM-DD.json` (JSON versionado con media base64) e importar con **merge por ID** e integridad referencial; desde Configuración y Catálogo hub | ✅ Completa (N tests) |

# bullet en "Se puede hacer hoy":
- **Exportar e importar todos los datos:** desde Configuración (o Catálogo → "Respaldo de datos") se exporta un archivo `campo-backup-YYYY-MM-DD.json` con zonas, clientes, lotes, visitas, avisos y adjuntos (fotos/voz como base64) para respaldo o migración entre dispositivos; importar fusiona por ID (nuevos se insertan, existentes se actualizan) con confirmación previa y resumen; los registros con referencias rotas se omiten con aviso.

# en "Decisiones diferidas" agregar:
- **Exportación programada / parcial / sin media**: diferidas — el usuario exporta manualmente; todo el backup incluye media (YAGNI por ahora).
```

Nota: **no se exporta el tenant config** (la API key no sale del dispositivo).