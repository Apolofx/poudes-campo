# Etapa — Exportar e importar todos los datos

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-09-10.

## Contexto y alcance

Campo es una PWA offline-first cuyos datos viven solo en IndexedDB del dispositivo. Si el usuario
cambia de celular, limpia los datos del navegador o usa otro dispositivo, pierde todo. Esta etapa
agrega **exportar** (descargar un archivo `.json` con todos los datos) e **importar** (cargar un
archivo `.json` y fusionar los datos por ID) para que el usuario pueda respaldar, migrar y
compartir datos entre dispositivos.

Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones. Esta etapa no toca dominio
ni aplicación — la exportación e importación son operaciones de infraestructura que leen/escriben
vía los puertos existentes (`FieldRepository`, `VisitRepository`, etc.).

## Decisiones tomadas (brainstorming)

1. **Solo infraestructura, sin nuevos puertos ni casos de uso.** Exportar e importar son
   operaciones de infraestructura que orquestan los repositorios existentes. No hay lógica de
   negocio nueva — la validación de integridad es defensiva (no rompe si los datos son válidos).
   Esto mantiene `src/domain` y `src/application` intocados.
2. **Formato JSON versionado.** Un solo archivo `.json` con `{ version: 1, exportedAt, zones,
   clients, fields, visits, reminders, media }`. Las fechas se serializan como ISO 8601 strings.
   Los blobs de media se codifican como **base64 data URLs** (`data:image/jpeg;base64,...` /
   `data:audio/webm;base64,...`). El `version` permite migraciones futuras del formato.
3. **Merge por ID en importación.** Para cada tipo de entidad, si un registro con el mismo `id`
   ya existe se actualiza (merge), si no se inserta. Esto permite importar un backup parcial o de
   otro dispositivo sin perder datos existentes. El merge es **shallow** (reemplaza todos los
   campos del registro, no mergea arrays anidados).
4. **Orden de importación respeta referencias.** Primero zones y clients (sin dependencias), luego
   fields (referencia zoneId/clientId), luego visits y reminders (referencian fieldId), y
   finalmente media (referencia visitId). Si una referencia apunta a un ID inexistente, se omite
   el registro con un warning (no falla toda la importación).
5. **Media incluida.** Fotos y voz se exportan como base64. Para ~40 lotes con ~3 visitas
   promedio y ~1 foto/voz cada una, el archivo sería ~5-10MB. Aceptable para un backup
   periódico. El usuario puede elegir no incluir media (flag opcional).
6. **UI en Configuración y Catálogo hub.** Botones "Exportar datos" e "Importar datos" en ambas
   pantallas (Configuración es el lugar natural para backup; Catálogo hub tiene la zona de datos
   peligrosos). Importar pide confirmación antes de proceder con el merge.
7. **Exportación en background sin UI pesada.** La exportación lee todos los stores en una
   transacción de solo lectura, serializa a JSON, y descarga el archivo. No necesita progress bar
   para ~40 lotes (completo en <1s). Si crece, se puede agregar.
8. **Importación con dry-run visual.** Antes de merge, se parsea el archivo y se muestra un
   resumen: "Se importarán X zonas, Y clientes, Z lotes, W visitas, V recordatorios, U adjuntos.
   ¿Continuar?" Esto evita merge accidental.

## 1. Formato de archivo (`CampoExport`)

Los tipos de `records.ts` con **fechas `Date`** no sobreviven al JSON: `JSON.stringify` las
convierte a strings ISO. El formato de exportación declara sus propios tipos serializados
(dates como `string` ISO 8601) y la importación los rehidrata a `Date`. `SerializedZoneRecord` /
`SerializedClientRecord` / `SerializedFieldRecord` coinciden con sus `Record` (no tienen fechas).

```ts
// src/infrastructure/persistence/idb/export-types.ts

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
  blobDataUrl: string;   // data:image/jpeg;base64,... o data:audio/webm;base64,...
}

export interface CampoExport {
  version: typeof CURRENT_EXPORT_VERSION;
  exportedAt: string;            // ISO 8601
  zones: ZoneRecord[];           // sin fechas → reusadas tal cual
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
  skipped: number; // registros omitidos por referencias rotas
}
```

**Conversión blob↔base64 portable (Node + browser):** `blob.arrayBuffer()` a ArrayBuffer, y de ahí
a base64 con `Buffer.from(buf).toString('base64')` si `Buffer` existe (Node) o `btoa` por chunks
(browser). Lo mismo a la inversa. Así los tests de infra corren en el entorno `node` de Vitest
sin jsdom.

## 2. Exportación (`src/infrastructure/persistence/idb/data-export.ts`)

```ts
import type { CampoDb } from './open-campo-db';
import {
  type CampoExport, CURRENT_EXPORT_VERSION,
  type SerializedVisitRecord, type SerializedReminderRecord, type SerializedMediaRecord,
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

**Filename** y descarga: `triggerDownload` se mueve a `src/ui/export-download.ts` (depende de
`document`/`URL`; el módulo de infraestructura se mantiene puro y testeable en Node).
`campo-backup-YYYY-MM-DD.json`.

## 3. Importación (`src/infrastructure/persistence/idb/data-import.ts`)

```ts
import type { CampoDb } from './open-campo-db';
import {
  type CampoExport, CURRENT_EXPORT_VERSION,
  type ImportResult, type ImportSummary,
  type SerializedVisitRecord, type SerializedReminderRecord, type SerializedMediaRecord,
} from './export-types';
import type { VisitRecord, ReminderRecord, MediaRecord } from './records';
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

  await writeAll(db, 'zones', data.zones);
  await writeAll(db, 'clients', data.clients);

  // Fields: solo los que resuelven sus refs (merge contra el archivo + el idb actual).
  const zoneIds = new Set([...(await db.getAllKeys('zones')), ...data.zones.map((z) => z.id)]);
  const clientIds = new Set([...(await db.getAllKeys('clients')), ...data.clients.map((c) => c.id)]);
  const fields = [];
  for (const f of data.fields) {
    if (f.clientId && !clientIds.has(f.clientId)) { skipped++; continue; }
    if (f.zoneId && !zoneIds.has(f.zoneId)) { skipped++; continue; }
    fields.push(f);
  }
  await writeAll(db, 'fields', fields);

  const fieldIds = new Set([...(await db.getAllKeys('fields')), ...fields.map((f) => f.id)]);
  const visits = [];
  for (const v of data.visits) {
    if (!fieldIds.has(v.fieldId)) { skipped++; continue; }
    visits.push(rehydrateVisit(v));
  }
  await writeAll(db, 'visits', visits);

  const visitIds = new Set([...(await db.getAllKeys('visits')), ...visits.map((v) => v.id)]);
  const reminders = [];
  for (const r of data.reminders) {
    if (!visitIds.has(r.visitId) || !fieldIds.has(r.fieldId)) { skipped++; continue; }
    reminders.push(rehydrateReminder(r));
  }
  await writeAll(db, 'reminders', reminders);

  const media = [];
  for (const m of data.media) {
    if (!visitIds.has(m.visitId)) { skipped++; continue; }
    media.push(rehydrateMedia(m));
  }
  await writeAll(db, 'media', media);

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

async function writeAll<S extends StoreNames<CampoSchema>>(
  db: CampoDb, store: S, records: CampoSchema[S]['value'][],
): Promise<void> {
  if (records.length === 0) return;
  const tx = db.transaction(store, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
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

**Errores nuevos** — clases locales a infraestructura (`export-errors.ts`): `InvalidExportFormat`,
`UnsupportedExportVersion`. **No se toca `src/domain`** (regla 2 de AGENTS): estos errores no son
`DomainError`; la UI los muestra vía `instanceof`.

## 4. Hooks de UI (`src/ui/hooks/`)

- **`useExportData`**: `{ exportNow, busy, error }`. Llama `container.exportData()` y luego
  `triggerDownload(data, 'campo-backup-YYYY-MM-DD.json')`.
- **`useImportData`**: `{ handleFile(file), summary, pending, confirmImport, busy, error, done,
  reset }`. `handleFile` parsea (`parseExportFile`) y llena `summary`/`pending`; `confirmImport`
  ejecuta el merge (upsert por ID) y setea `done`. `reset` limpia el estado.

Patrón idéntico a los hooks existentes (submit/loading/error/done).

## 5. UI

### Componente compartido `DataPortabilitySection` (`src/ui/components/DataPortabilitySection.tsx`)

Un solo componente con ambos flujos, reutilizado en Configuración y en el hub de Catálogo:

- Botón "Exportar datos" → descarga `campo-backup-YYYY-MM-DD.json` (con media).
- Botón "Importar datos" → `<input type="file" accept="application/json,.json">` oculto →
  `useImportData.handleFile` → muestra el **resumen** (`ImportSummary`) con confirmación:
  "Se fusionarán los datos importados con los existentes. Los registros con el mismo ID se
  actualizarán. ¿Continuar?" → `confirmImport` → mensaje de éxito ("Se importaron N registros.
  M asignados con advertencias no se pudieron cargar." si `skipped > 0`).
- Error de formato/versión → mensaje en español (`instanceof InvalidExportFormat` /
  `UnsupportedExportVersion`).
- Confirmación vía `ConfirmDialog` existente.

### `ConfigScreen` (`src/ui/screens/ConfigScreen.tsx`)

Nueva sección debajo de "Tema" y antes del form de la clave: `<DataPortabilitySection />`.

### `CatalogHubScreen` (`src/ui/screens/CatalogHubScreen.tsx`)

`<DataPortabilitySection />` debajo de la lista de ABM (Zonas/Clientes/Lotes) y antes de la zona
de peligro "Borrar todos los datos".

## 6. Wiring

El `Container` gana dos funciones (composition root, no casos de uso):

```ts
exportData: () => Promise<CampoExport>;
importData: (data: CampoExport) => Promise<ImportResult>;
```

- `buildContainer(db)` → `exportData: () => exportAllData(db)`, `importData: (d) => importData(db, d)`.
- `makeInMemoryContainer` (tests) → `exportData` devuelve un export válido vacío e `importData`
  devuelve `{ skipped: 0 }`; los tests de pantalla hacen `vi.spyOn(container, ...)` cuando quieren
  un flujo real.

## 7. Nota sobre migración futura del formato

El campo `version: 1` en el archivo permite agregar campos o cambiar la estructura en el futuro.
Si se cambia el formato, se agrega una función `migrateExportV1ToV2` y se incrementa la versión.
Por ahora solo hay una versión — la migración es YAGNI.

## Fuera de alcance (diferido)

- Exportación programada / automática (YAGNI — el usuario exporta manualmente cuando quiere).
- Exportación parcial (solo ciertos lotes, solo cierto rango de fechas).
- Importación de CSV / otros formatos.
- Exportación sin media (flag opcional diferido; por ahora siempre incluye media).
- Compresión ZIP del JSON (el JSON ya es compacto; ZIP solo si el archivo crece mucho).
- Sincronización a la nube (Etapa 5).

## Plan de tests (TDD)

### Exportación
- `tests/infrastructure/idb/data-export.test.ts`:
  - Exporta stores vacíos → `{ version: 1, zones: [], clients: [], ... }`.
  - Exporta con datos: round-trip de cada tipo de entidad (zone, client, field, visit, reminder).
  - Las fechas se serializan a ISO string (no `Date`).
  - Exporta con media: blob se convierte a `blobDataUrl` base64; el round-trip de bytes se
    preserva.
  - El `exportedAt` es un ISO válido.

### Importación
- `tests/infrastructure/idb/data-import.test.ts`:
  - `parseExportFile`: JSON inválido → `InvalidExportFormat`; versión no soportada →
    `UnsupportedExportVersion`; falta un array → `InvalidExportFormat`.
  - Importa a db vacía: todos los registros aparecen (fechas rehidratadas a `Date`).
  - Merge por ID: actualiza un zone existente, inserta uno nuevo, mantiene uno no mencionado.
  - Referencias: fields con zoneId/clientId inexistentes se omiten (y cuentan en `skipped`);
    visits con fieldId roto, reminders y media con referencias rotas también.
  - Media: `blobDataUrl` se reconvierte a `Blob`; round-trip de image y audio.
  - `summarizeImport` devuelve los conteos correctos.

### End-to-end (composition)
- `tests/composition/container.test.ts` (ampliar): `buildContainer` exporta datos seeded y los
  importa a una db fresca; el resultado es idéntico en cantidad.

### UI
- `tests/ui/data-portability-section.test.tsx` (nuevo):
  - Exportar: `vi.spyOn(container, 'exportData')` → al tocar "Exportar datos" se llama y
    `triggerDownload` se ejecuta con el filename correcto.
  - Importar: un `File` válido deja el resumen visible y el diálogo de confirmación;
    confirmar llama `container.importData` y muestra el mensaje de éxito; archivo inválido
    muestra error de formato.
- `tests/ui/config-screen.test.tsx` (ampliar): los botones de export/import existen.
- `tests/ui/catalog-hub-screen.test.tsx` (ampliar): los botones de export/import existen.

### Errores
- `tests/infrastructure/idb/export-errors.test.ts`: `InvalidExportFormat` y
  `UnsupportedExportVersion` son `Error` con mensaje claro.

## Boundaries

- **Always:** Exportar/importar vía las funciones de infraestructura, no directamente en UI;
  seguir el patrón de hooks existentes; TDD.
- **Ask first:** Cambiar el formato de archivo (version number); agregar campos al export;
  modificar el comportamiento de merge.
- **Never:** Agregar datos de dosis/agroquímicos/prescripciones al formato de exportación;
  tocar `src/domain/entities/` o `src/application/use-cases/`; exportar datos de tenant config
  (API keys — son sensibles, no se exportan).

## Success Criteria

- [ ] Exportar genera un archivo `.json` válido con todos los datos (zones, clients, fields,
      visits, reminders, media).
- [ ] Importar fusiona registros por ID (inserta nuevos, actualiza existentes).
- [ ] Importar a db vacía funciona igual que restore completo.
- [ ] Media (fotos/voz) se preserva en el round-trip export → import.
- [ ] Referencias rotas en importación se omiten con warning (no falla).
- [ ] Botones de export/import visibles en Configuración y Catálogo hub.
- [ ] Confirmación antes de importar.
- [ ] Formato versionado (`version: 1`).
- [ ] Todos los tests pasan (`npm test`).
- [ ] Typecheck limpio (`npm run typecheck`).

## Open Questions

- Ninguna por el momento.
