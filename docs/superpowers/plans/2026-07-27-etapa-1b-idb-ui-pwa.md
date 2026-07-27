# Etapa 1b — IndexedDB + UI React + PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la Etapa 1 con una rebanada vertical offline: persistir en IndexedDB detrás de los puertos existentes y ofrecer una UI React (buscar lote → registrar visita) instalable como PWA.

**Architecture:** Adaptadores nuevos en `src/infrastructure` implementan los puertos ya definidos (`FieldRepository`, `VisitRepository`, `ReminderRepository`, `Clock`, `IdGenerator`) sobre IndexedDB (vía `idb`). Un composition root (`src/composition`) arma el grafo y carga un seed idempotente. La UI React (`src/ui`) consume los casos de uso vía React Context + hooks finos, con react-router en modo librería. El dominio y la aplicación no se tocan.

**Tech Stack:** TypeScript, Vite, React 18, react-router-dom v6 (modo librería), `idb`, `uuidv7`, `vite-plugin-pwa`; Vitest + Testing Library + `fake-indexeddb` + jsdom.

## Global Constraints

- **No tocar `src/domain/**` ni `src/application/**`.** Solo se agregan adaptadores, composición y UI. Si una necesidad parece requerir cambiar dominio/aplicación, frenar y consultar.
- **Ningún dato de dosis / agroquímicos / prescripciones** entra al sistema: no crear campos, tipos, ni UI para eso.
- **Conversación en español, código en inglés.** El copy visible al usuario va en español.
- **TDD estricto**: test que falla → verlo fallar → implementación mínima → test verde → commit. Un commit por tarea como mínimo.
- **Entidades reconstruidas vía constructores/factories del dominio** (`Coordinates.of`, `Hectares.of`, `VisitInterval.ofDays`, `new Visit(...)`, `new Reminder(...)`). IndexedDB guarda registros planos, nunca instancias de clase.
- **Fechas** se persisten como `Date` nativo (structured clone).
- **Los repos idb replican exactamente el contrato de los repos in-memory** existentes.
- Node 18+.

---

## File Structure

**Nuevos:**
- `src/infrastructure/persistence/idb/records.ts` — tipos de registro plano + mappers entidad↔record.
- `src/infrastructure/persistence/idb/open-campo-db.ts` — schema `idb` (stores + índices) y apertura tipada.
- `src/infrastructure/persistence/idb/idb-field-repository.ts`
- `src/infrastructure/persistence/idb/idb-visit-repository.ts`
- `src/infrastructure/persistence/idb/idb-reminder-repository.ts`
- `src/infrastructure/clock/system-clock.ts`
- `src/infrastructure/id/uuidv7-id-generator.ts`
- `src/composition/seed-data.ts` — fixture (se descarta en Etapa 4).
- `src/composition/seed.ts` — carga idempotente.
- `src/composition/container.ts` — composition root + tipo `Container`.
- `src/ui/CampoProvider.tsx` — Context + `useCampo`.
- `src/ui/hooks/use-search-fields.ts`
- `src/ui/hooks/use-record-visit.ts`
- `src/ui/error-messages.ts`
- `src/ui/screens/SearchScreen.tsx`
- `src/ui/screens/RecordVisitScreen.tsx`
- `src/ui/App.tsx`
- `src/main.tsx`, `index.html`, `src/vite-env.d.ts`
- `vite.config.ts`, `public/pwa-192.png`, `public/pwa-512.png`
- `tests/support/in-memory-container.ts` — helper de tests UI.
- Tests: `tests/infrastructure/idb/*.test.ts`, `tests/infrastructure/system-clock.test.ts`, `tests/infrastructure/uuidv7-id-generator.test.ts`, `tests/composition/*.test.ts`, `tests/ui/*.test.tsx`, `tests/setup.ts`.

**Modificados:**
- `package.json` — dependencias + scripts `dev`/`build`/`preview`.
- `tsconfig.json` — `jsx`, `lib` DOM, types React.
- `vitest.config.ts` — plugin react, jsdom para `tests/ui/**`, include `.tsx`, setupFiles.

---

## Task 1: Tooling & config setup

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Create: `tests/setup.ts`

**Interfaces:**
- Consumes: nada.
- Produces: entorno de build/test con React + JSX + jsdom para `tests/ui/**` y node para el resto; matchers de `@testing-library/jest-dom` disponibles.

- [ ] **Step 1: Instalar dependencias**

```bash
npm install react@^18.3 react-dom@^18.3 react-router-dom@^6.26 idb@^8 uuidv7@^1
npm install -D vite@^5 @vitejs/plugin-react@^4 vite-plugin-pwa@^0.20 \
  @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 \
  jsdom@^25 fake-indexeddb@^6 @types/react@^18 @types/react-dom@^18
```

- [ ] **Step 2: Agregar scripts a `package.json`**

Añadir a `"scripts"` (conservar `test`, `test:watch`, `typecheck`):

```json
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
```

- [ ] **Step 3: Actualizar `tsconfig.json`**

Reemplazar el contenido por:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Actualizar `vitest.config.ts`**

Reemplazar el contenido por:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    environmentMatchGlobs: [['tests/ui/**', 'jsdom']],
    setupFiles: ['tests/setup.ts'],
  },
});
```

- [ ] **Step 5: Crear `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Verificar que no rompimos nada**

Run: `npm test`
Expected: PASS — los 57 tests existentes siguen verdes.

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts tests/setup.ts
git commit -m "chore: add React/Vite/idb tooling and jsdom test env"
```

---

## Task 2: Record mappers (entity ↔ plain record)

**Files:**
- Create: `src/infrastructure/persistence/idb/records.ts`
- Test: `tests/infrastructure/idb/records.test.ts`

**Interfaces:**
- Consumes: entidades y VOs del dominio (`Field`, `Visit`, `Reminder`, `Coordinates`, `Hectares`, `VisitInterval`).
- Produces:
  - Tipos `ZoneRecord { id, name }`, `ClientRecord { id, name }`, `FieldRecord`, `VisitRecord`, `ReminderRecord`.
  - `toFieldRecord(f: Field): FieldRecord`, `fromFieldRecord(r: FieldRecord): Field`
  - `toVisitRecord(v: Visit): VisitRecord`, `fromVisitRecord(r: VisitRecord): Visit`
  - `toReminderRecord(rm: Reminder): ReminderRecord`, `fromReminderRecord(r: ReminderRecord): Reminder`

- [ ] **Step 1: Escribir el test que falla**

Create `tests/infrastructure/idb/records.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import {
  toFieldRecord, fromFieldRecord,
  toVisitRecord, fromVisitRecord,
  toReminderRecord, fromReminderRecord,
} from '@/infrastructure/persistence/idb/records';

describe('field record mapping', () => {
  it('round-trips a full field', () => {
    const field = new Field({
      id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1',
      coordinates: Coordinates.of(-34.6, -58.4), hectares: Hectares.of(12.5), crop: 'soja',
    });
    const back = fromFieldRecord(toFieldRecord(field));
    expect(back.name).toBe('Lote 1');
    expect(back.coordinates?.latitude).toBe(-34.6);
    expect(back.coordinates?.longitude).toBe(-58.4);
    expect(back.hectares?.value).toBe(12.5);
    expect(back.crop).toBe('soja');
  });

  it('round-trips a minimal field with no optionals', () => {
    const field = new Field({ id: 'f2', name: 'Lote 2', clientId: 'c1', zoneId: 'z1' });
    const back = fromFieldRecord(toFieldRecord(field));
    expect(back.coordinates).toBeUndefined();
    expect(back.hectares).toBeUndefined();
    expect(back.crop).toBeUndefined();
  });
});

describe('visit record mapping', () => {
  it('round-trips a visit with follow-up', () => {
    const visit = new Visit({
      id: 'v1', fieldId: 'f1',
      visitDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'),
      notes: 'todo bien',
      followUp: { nextVisitDate: new Date('2026-08-03T10:05:00Z'), interval: VisitInterval.ofDays(14) },
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.id).toBe('v1');
    expect(back.notes).toBe('todo bien');
    expect(back.status).toBe('ACTIVE');
    expect(back.followUp?.interval.days).toBe(14);
    expect(back.followUp?.nextVisitDate.getTime()).toBe(new Date('2026-08-03T10:05:00Z').getTime());
  });

  it('round-trips a visit without follow-up', () => {
    const visit = new Visit({
      id: 'v2', fieldId: 'f1',
      visitDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.followUp).toBeUndefined();
  });
});

describe('reminder record mapping', () => {
  it('round-trips a reminder preserving status', () => {
    const reminder = new Reminder({
      id: 'r1', visitId: 'v1', fieldId: 'f1',
      remindAt: new Date('2026-07-31T10:05:00Z'), status: 'PENDING',
    });
    const back = fromReminderRecord(toReminderRecord(reminder));
    expect(back.id).toBe('r1');
    expect(back.visitId).toBe('v1');
    expect(back.status).toBe('PENDING');
    expect(back.remindAt.getTime()).toBe(new Date('2026-07-31T10:05:00Z').getTime());
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/infrastructure/idb/records.test.ts`
Expected: FAIL — no se puede resolver `@/infrastructure/persistence/idb/records`.

- [ ] **Step 3: Implementar `records.ts`**

```ts
import { Field } from '@/domain/entities/field';
import { Visit, type VisitStatus } from '@/domain/entities/visit';
import { Reminder, type ReminderStatus } from '@/domain/entities/reminder';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { VisitInterval } from '@/domain/value-objects/visit-interval';

export interface ZoneRecord {
  id: string;
  name: string;
}

export interface ClientRecord {
  id: string;
  name: string;
}

export interface FieldRecord {
  id: string;
  name: string;
  clientId: string;
  zoneId: string;
  coordinates?: { latitude: number; longitude: number };
  hectares?: number;
  crop?: string;
}

export interface VisitRecord {
  id: string;
  fieldId: string;
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: { nextVisitDate: Date; intervalDays: number };
  status: VisitStatus;
}

export interface ReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: Date;
  status: ReminderStatus;
}

export function toFieldRecord(f: Field): FieldRecord {
  return {
    id: f.id,
    name: f.name,
    clientId: f.clientId,
    zoneId: f.zoneId,
    coordinates: f.coordinates
      ? { latitude: f.coordinates.latitude, longitude: f.coordinates.longitude }
      : undefined,
    hectares: f.hectares?.value,
    crop: f.crop,
  };
}

export function fromFieldRecord(r: FieldRecord): Field {
  return new Field({
    id: r.id,
    name: r.name,
    clientId: r.clientId,
    zoneId: r.zoneId,
    coordinates: r.coordinates
      ? Coordinates.of(r.coordinates.latitude, r.coordinates.longitude)
      : undefined,
    hectares: r.hectares !== undefined ? Hectares.of(r.hectares) : undefined,
    crop: r.crop,
  });
}

export function toVisitRecord(v: Visit): VisitRecord {
  return {
    id: v.id,
    fieldId: v.fieldId,
    visitDate: v.visitDate,
    createdAt: v.createdAt,
    notes: v.notes,
    followUp: v.followUp
      ? { nextVisitDate: v.followUp.nextVisitDate, intervalDays: v.followUp.interval.days }
      : undefined,
    status: v.status,
  };
}

export function fromVisitRecord(r: VisitRecord): Visit {
  return new Visit({
    id: r.id,
    fieldId: r.fieldId,
    visitDate: r.visitDate,
    createdAt: r.createdAt,
    notes: r.notes,
    followUp: r.followUp
      ? { nextVisitDate: r.followUp.nextVisitDate, interval: VisitInterval.ofDays(r.followUp.intervalDays) }
      : undefined,
    status: r.status,
  });
}

export function toReminderRecord(rm: Reminder): ReminderRecord {
  return {
    id: rm.id,
    visitId: rm.visitId,
    fieldId: rm.fieldId,
    remindAt: rm.remindAt,
    status: rm.status,
  };
}

export function fromReminderRecord(r: ReminderRecord): Reminder {
  return new Reminder({
    id: r.id,
    visitId: r.visitId,
    fieldId: r.fieldId,
    remindAt: r.remindAt,
    status: r.status,
  });
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/infrastructure/idb/records.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/records.ts tests/infrastructure/idb/records.test.ts
git commit -m "feat: idb record mappers for field/visit/reminder"
```

---

## Task 3: open-campo-db (schema + índices)

**Files:**
- Create: `src/infrastructure/persistence/idb/open-campo-db.ts`
- Test: `tests/infrastructure/idb/open-campo-db.test.ts`

**Interfaces:**
- Consumes: tipos de `records.ts`.
- Produces:
  - `interface CampoSchema extends DBSchema { ... }`
  - `type CampoDb = IDBPDatabase<CampoSchema>`
  - `openCampoDb(name?: string): Promise<CampoDb>` — crea stores `zones`, `clients`, `fields`, `visits`, `reminders` (keyPath `id`), con índice `by-field` en `visits` y `reminders`. `name` default `'campo'`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/infrastructure/idb/open-campo-db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

describe('openCampoDb', () => {
  it('creates all object stores', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    expect([...db.objectStoreNames].sort()).toEqual([
      'clients', 'fields', 'reminders', 'visits', 'zones',
    ]);
    db.close();
  });

  it('creates the by-field indexes on visits and reminders', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const tx = db.transaction(['visits', 'reminders']);
    expect([...tx.objectStore('visits').indexNames]).toContain('by-field');
    expect([...tx.objectStore('reminders').indexNames]).toContain('by-field');
    await tx.done;
    db.close();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/infrastructure/idb/open-campo-db.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `open-campo-db.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ZoneRecord, ClientRecord, FieldRecord, VisitRecord, ReminderRecord,
} from './records';

export interface CampoSchema extends DBSchema {
  zones: { key: string; value: ZoneRecord };
  clients: { key: string; value: ClientRecord };
  fields: { key: string; value: FieldRecord };
  visits: { key: string; value: VisitRecord; indexes: { 'by-field': string } };
  reminders: { key: string; value: ReminderRecord; indexes: { 'by-field': string } };
}

export type CampoDb = IDBPDatabase<CampoSchema>;

export function openCampoDb(name = 'campo'): Promise<CampoDb> {
  return openDB<CampoSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('zones', { keyPath: 'id' });
      db.createObjectStore('clients', { keyPath: 'id' });
      db.createObjectStore('fields', { keyPath: 'id' });
      const visits = db.createObjectStore('visits', { keyPath: 'id' });
      visits.createIndex('by-field', 'fieldId');
      const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
      reminders.createIndex('by-field', 'fieldId');
    },
  });
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/infrastructure/idb/open-campo-db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/open-campo-db.ts tests/infrastructure/idb/open-campo-db.test.ts
git commit -m "feat: campo IndexedDB schema (stores + by-field indexes)"
```

---

## Task 4: IdbFieldRepository

**Files:**
- Create: `src/infrastructure/persistence/idb/idb-field-repository.ts`
- Test: `tests/infrastructure/idb/idb-field-repository.test.ts`

**Interfaces:**
- Consumes: `CampoDb` (Task 3), mappers de field (Task 2), `FieldRepository` port, `FieldSearchResult`.
- Produces: `class IdbFieldRepository implements FieldRepository`, constructor `(db: CampoDb)`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/infrastructure/idb/idb-field-repository.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { Field } from '@/domain/entities/field';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbFieldRepository(db) };
}

describe('IdbFieldRepository', () => {
  it('saves and finds a field by id', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(new Field({ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }));
    const found = await repo.findById('f1');
    expect(found?.name).toBe('Lote 1');
    db.close();
  });

  it('returns null for a missing field', async () => {
    const { db, repo } = await freshRepo();
    expect(await repo.findById('nope')).toBeNull();
    db.close();
  });

  it('lists fields joined with client and zone names', async () => {
    const { db, repo } = await freshRepo();
    await db.put('zones', { id: 'z1', name: 'Norte' });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await repo.save(new Field({ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }));
    const [r] = await repo.listAllWithHierarchy();
    expect(r.field.name).toBe('Lote 1');
    expect(r.clientName).toBe('Pérez');
    expect(r.zoneName).toBe('Norte');
    db.close();
  });

  it('uses empty names when references are missing', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(new Field({ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }));
    const [r] = await repo.listAllWithHierarchy();
    expect(r.clientName).toBe('');
    expect(r.zoneName).toBe('');
    db.close();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/infrastructure/idb/idb-field-repository.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `idb-field-repository.ts`**

```ts
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { Field } from '@/domain/entities/field';
import type { FieldId } from '@/domain/shared/ids';
import type { FieldSearchResult } from '@/domain/services/field-search';
import type { CampoDb } from './open-campo-db';
import { toFieldRecord, fromFieldRecord } from './records';

export class IdbFieldRepository implements FieldRepository {
  constructor(private readonly db: CampoDb) {}

  async save(field: Field): Promise<void> {
    await this.db.put('fields', toFieldRecord(field));
  }

  async findById(id: FieldId): Promise<Field | null> {
    const record = await this.db.get('fields', id);
    return record ? fromFieldRecord(record) : null;
  }

  async listAllWithHierarchy(): Promise<FieldSearchResult[]> {
    const [fieldRecords, zoneRecords, clientRecords] = await Promise.all([
      this.db.getAll('fields'),
      this.db.getAll('zones'),
      this.db.getAll('clients'),
    ]);
    const zones = new Map(zoneRecords.map((z) => [z.id, z.name]));
    const clients = new Map(clientRecords.map((c) => [c.id, c.name]));
    return fieldRecords.map((record) => {
      const field = fromFieldRecord(record);
      return {
        field,
        clientName: clients.get(field.clientId) ?? '',
        zoneName: zones.get(field.zoneId) ?? '',
      };
    });
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/infrastructure/idb/idb-field-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/idb-field-repository.ts tests/infrastructure/idb/idb-field-repository.test.ts
git commit -m "feat: IdbFieldRepository over IndexedDB"
```

---

## Task 5: IdbVisitRepository

**Files:**
- Create: `src/infrastructure/persistence/idb/idb-visit-repository.ts`
- Test: `tests/infrastructure/idb/idb-visit-repository.test.ts`

**Interfaces:**
- Consumes: `CampoDb`, mappers de visit, `VisitRepository` port, `isSameCalendarDay`.
- Produces: `class IdbVisitRepository implements VisitRepository`, constructor `(db: CampoDb)`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/infrastructure/idb/idb-visit-repository.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { Visit } from '@/domain/entities/visit';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbVisitRepository(db) };
}

function visit(id: string, fieldId: string, isoDate: string, status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE') {
  return new Visit({
    id, fieldId,
    visitDate: new Date(isoDate),
    createdAt: new Date(isoDate),
    status,
  });
}

describe('IdbVisitRepository', () => {
  it('saves and finds a visit by id', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z'));
    expect((await repo.findById('v1'))?.id).toBe('v1');
    db.close();
  });

  it('finds an active visit on the same calendar day', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z'));
    const found = await repo.findActiveByFieldOnDay('f1', new Date('2026-07-20T23:00:00Z'));
    expect(found?.id).toBe('v1');
    db.close();
  });

  it('ignores cancelled visits and other days', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z', 'CANCELLED'));
    await repo.save(visit('v2', 'f1', '2026-07-21T10:00:00Z', 'ACTIVE'));
    expect(await repo.findActiveByFieldOnDay('f1', new Date('2026-07-20T12:00:00Z'))).toBeNull();
    db.close();
  });

  it('lists visits by field only', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z'));
    await repo.save(visit('v2', 'f2', '2026-07-20T10:00:00Z'));
    const list = await repo.listByField('f1');
    expect(list.map((v) => v.id)).toEqual(['v1']);
    db.close();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/infrastructure/idb/idb-visit-repository.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `idb-visit-repository.ts`**

```ts
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import { isSameCalendarDay } from '@/domain/shared/date-utils';
import type { CampoDb } from './open-campo-db';
import { toVisitRecord, fromVisitRecord } from './records';

export class IdbVisitRepository implements VisitRepository {
  constructor(private readonly db: CampoDb) {}

  async save(visit: Visit): Promise<void> {
    await this.db.put('visits', toVisitRecord(visit));
  }

  async findById(id: VisitId): Promise<Visit | null> {
    const record = await this.db.get('visits', id);
    return record ? fromVisitRecord(record) : null;
  }

  async findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    const match = records.find(
      (r) => r.status === 'ACTIVE' && isSameCalendarDay(r.visitDate, day),
    );
    return match ? fromVisitRecord(match) : null;
  }

  async listByField(fieldId: FieldId): Promise<Visit[]> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    return records.map(fromVisitRecord);
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/infrastructure/idb/idb-visit-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/idb-visit-repository.ts tests/infrastructure/idb/idb-visit-repository.test.ts
git commit -m "feat: IdbVisitRepository over IndexedDB"
```

---

## Task 6: IdbReminderRepository

**Files:**
- Create: `src/infrastructure/persistence/idb/idb-reminder-repository.ts`
- Test: `tests/infrastructure/idb/idb-reminder-repository.test.ts`

**Interfaces:**
- Consumes: `CampoDb`, mappers de reminder, `ReminderRepository` port.
- Produces: `class IdbReminderRepository implements ReminderRepository`, constructor `(db: CampoDb)`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/infrastructure/idb/idb-reminder-repository.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { Reminder } from '@/domain/entities/reminder';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbReminderRepository(db) };
}

function reminder(id: string, fieldId: string, status: 'PENDING' | 'SENT' | 'CANCELLED') {
  return new Reminder({
    id, visitId: `visit-${id}`, fieldId,
    remindAt: new Date('2026-07-31T10:00:00Z'), status,
  });
}

describe('IdbReminderRepository', () => {
  it('returns only PENDING reminders for the field', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(reminder('r1', 'f1', 'PENDING'));
    await repo.save(reminder('r2', 'f1', 'CANCELLED'));
    await repo.save(reminder('r3', 'f2', 'PENDING'));
    const pending = await repo.findPendingByField('f1');
    expect(pending.map((r) => r.id)).toEqual(['r1']);
    db.close();
  });

  it('reflects an updated (cancelled) reminder', async () => {
    const { db, repo } = await freshRepo();
    const r = reminder('r1', 'f1', 'PENDING');
    await repo.save(r);
    r.cancel();
    await repo.save(r);
    expect(await repo.findPendingByField('f1')).toEqual([]);
    db.close();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/infrastructure/idb/idb-reminder-repository.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `idb-reminder-repository.ts`**

```ts
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Reminder } from '@/domain/entities/reminder';
import type { FieldId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toReminderRecord, fromReminderRecord } from './records';

export class IdbReminderRepository implements ReminderRepository {
  constructor(private readonly db: CampoDb) {}

  async save(reminder: Reminder): Promise<void> {
    await this.db.put('reminders', toReminderRecord(reminder));
  }

  async findPendingByField(fieldId: FieldId): Promise<Reminder[]> {
    const records = await this.db.getAllFromIndex('reminders', 'by-field', fieldId);
    return records.filter((r) => r.status === 'PENDING').map(fromReminderRecord);
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/infrastructure/idb/idb-reminder-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/idb-reminder-repository.ts tests/infrastructure/idb/idb-reminder-repository.test.ts
git commit -m "feat: IdbReminderRepository over IndexedDB"
```

---

## Task 7: SystemClock + Uuidv7IdGenerator

**Files:**
- Create: `src/infrastructure/clock/system-clock.ts`
- Create: `src/infrastructure/id/uuidv7-id-generator.ts`
- Test: `tests/infrastructure/system-clock.test.ts`
- Test: `tests/infrastructure/uuidv7-id-generator.test.ts`

**Interfaces:**
- Consumes: `Clock` port, `IdGenerator` port, paquete `uuidv7`.
- Produces: `class SystemClock implements Clock`; `class Uuidv7IdGenerator implements IdGenerator`.

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/infrastructure/system-clock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SystemClock } from '@/infrastructure/clock/system-clock';

describe('SystemClock', () => {
  it('returns a Date at roughly now', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
```

Create `tests/infrastructure/uuidv7-id-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Uuidv7IdGenerator', () => {
  it('generates version-7 UUIDs', () => {
    expect(new Uuidv7IdGenerator().next()).toMatch(UUID_V7);
  });

  it('generates distinct ids', () => {
    const gen = new Uuidv7IdGenerator();
    expect(gen.next()).not.toBe(gen.next());
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/infrastructure/system-clock.test.ts tests/infrastructure/uuidv7-id-generator.test.ts`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 3: Implementar los adaptadores**

Create `src/infrastructure/clock/system-clock.ts`:

```ts
import type { Clock } from '@/domain/ports/outbound/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
```

Create `src/infrastructure/id/uuidv7-id-generator.ts`:

```ts
import { uuidv7 } from 'uuidv7';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';

export class Uuidv7IdGenerator implements IdGenerator {
  next(): string {
    return uuidv7();
  }
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/infrastructure/system-clock.test.ts tests/infrastructure/uuidv7-id-generator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/clock/system-clock.ts src/infrastructure/id/uuidv7-id-generator.ts tests/infrastructure/system-clock.test.ts tests/infrastructure/uuidv7-id-generator.test.ts
git commit -m "feat: SystemClock and Uuidv7IdGenerator adapters"
```

---

## Task 8: Seed data + idempotent seed

**Files:**
- Create: `src/composition/seed-data.ts`
- Create: `src/composition/seed.ts`
- Test: `tests/composition/seed.test.ts`

**Interfaces:**
- Consumes: `CampoDb`, tipos `ZoneRecord`/`ClientRecord`/`FieldRecord` de `records.ts`.
- Produces:
  - `seedZones: ZoneRecord[]`, `seedClients: ClientRecord[]`, `seedFields: FieldRecord[]` (en `seed-data.ts`).
  - `seedIfEmpty(db: CampoDb): Promise<void>` — si `fields` está vacío, escribe zonas/clientes/lotes en una transacción; si no, no hace nada.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/composition/seed.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';

describe('seedIfEmpty', () => {
  it('populates zones, clients and fields on an empty db', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    expect(await db.count('fields')).toBeGreaterThan(0);
    expect(await db.count('zones')).toBeGreaterThan(0);
    expect(await db.count('clients')).toBeGreaterThan(0);
    db.close();
  });

  it('is idempotent: running twice does not duplicate', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const count = await db.count('fields');
    await seedIfEmpty(db);
    expect(await db.count('fields')).toBe(count);
    db.close();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/composition/seed.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `seed-data.ts`**

Fixture ficticio, sin ningún dato de agroquímicos. Zonas y clientes explícitos; ~40 lotes generados en bucle.

```ts
import type { ZoneRecord, ClientRecord, FieldRecord } from '@/infrastructure/persistence/idb/records';

export const seedZones: ZoneRecord[] = [
  { id: 'zone-norte', name: 'Norte' },
  { id: 'zone-sur', name: 'Sur' },
  { id: 'zone-este', name: 'Este' },
  { id: 'zone-oeste', name: 'Oeste' },
];

export const seedClients: ClientRecord[] = [
  { id: 'client-perez', name: 'Establecimiento Pérez' },
  { id: 'client-gomez', name: 'Gómez Hnos.' },
  { id: 'client-lopez', name: 'La Lomada (López)' },
  { id: 'client-ruiz', name: 'Don Ruiz' },
  { id: 'client-molina', name: 'Campos Molina' },
  { id: 'client-sosa', name: 'Sosa y Cía.' },
];

const fieldNames = [
  'El Alto', 'La Baja', 'El Molino', 'Las Piedras', 'La Cañada', 'El Sauce',
  'Los Álamos', 'La Loma', 'El Bajo', 'La Isla', 'El Quebracho', 'Santa Rosa',
  'La Esperanza', 'El Ceibo', 'Los Toldos', 'La Invernada', 'El Retiro', 'La Costa',
  'El Espinillo', 'La Blanqueada',
];
const crops = ['soja', 'maíz', 'trigo', 'girasol', 'sorgo', 'pastura'];

export const seedFields: FieldRecord[] = Array.from({ length: 40 }, (_, i) => {
  const zone = seedZones[i % seedZones.length];
  const client = seedClients[i % seedClients.length];
  const baseName = fieldNames[i % fieldNames.length];
  const suffix = i < fieldNames.length ? '' : ` ${Math.floor(i / fieldNames.length) + 1}`;
  return {
    id: `field-${String(i + 1).padStart(4, '0')}`,
    name: `${baseName}${suffix}`,
    clientId: client.id,
    zoneId: zone.id,
    coordinates: { latitude: -33 - i * 0.01, longitude: -61 - i * 0.01 },
    hectares: 20 + (i % 8) * 15,
    crop: crops[i % crops.length],
  };
});
```

- [ ] **Step 4: Implementar `seed.ts`**

```ts
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
```

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run tests/composition/seed.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/composition/seed-data.ts src/composition/seed.ts tests/composition/seed.test.ts
git commit -m "feat: idempotent IndexedDB seed with throwaway catalog fixture"
```

---

## Task 9: Composition root (container)

**Files:**
- Create: `src/composition/container.ts`
- Test: `tests/composition/container.test.ts`

**Interfaces:**
- Consumes: repos idb (Tasks 4-6), `SystemClock`, `Uuidv7IdGenerator`, `SearchFields`, `RecordVisit`, `CampoDb`.
- Produces:
  - `interface Container { searchFields: SearchFields; recordVisit: RecordVisit }`
  - `buildContainer(db: CampoDb): Container`

- [ ] **Step 1: Escribir el test que falla**

Create `tests/composition/container.test.ts`:

```ts
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
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/composition/container.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `container.ts`**

```ts
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';
import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, new SystemClock(), new Uuidv7IdGenerator()),
  };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/composition/container.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composition/container.ts tests/composition/container.test.ts
git commit -m "feat: composition root wiring use cases over IndexedDB"
```

---

## Task 10: React Context + hooks

**Files:**
- Create: `src/ui/CampoProvider.tsx`
- Create: `src/ui/hooks/use-search-fields.ts`
- Create: `src/ui/hooks/use-record-visit.ts`
- Create: `tests/support/in-memory-container.ts`
- Test: `tests/ui/use-search-fields.test.tsx`
- Test: `tests/ui/use-record-visit.test.tsx`

**Interfaces:**
- Consumes: `Container` (Task 9), `FieldSearchResult`, `RecordVisitInput`, `RecordVisitResult`, repos in-memory + `FixedClock` + `IncrementingIdGenerator` (para el helper de test).
- Produces:
  - `CampoProvider({ container, children })` y `useCampo(): Container`.
  - `useSearchFields(): { results: FieldSearchResult[]; loading: boolean; error?: Error; search(query: string): void }`
  - `useRecordVisit(): { submit(input: RecordVisitInput): void; submitting: boolean; error?: Error; result?: RecordVisitResult }`
  - `makeInMemoryContainer(now?: Date): Container` (helper de test).

- [ ] **Step 1: Crear el helper de test `tests/support/in-memory-container.ts`**

```ts
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import type { Container } from '@/composition/container';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';

export function makeInMemoryContainer(now = new Date('2026-07-27T12:00:00Z')): Container {
  const zones = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Lote El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'Lote La Baja', clientId: 'c1', zoneId: 'z1' }),
  ]);
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(
      fields,
      new InMemoryVisitRepository(),
      new InMemoryReminderRepository(),
      new FixedClock(now),
      new IncrementingIdGenerator(),
    ),
  };
}
```

- [ ] **Step 2: Escribir los tests que fallan**

Create `tests/ui/use-search-fields.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { useSearchFields } from '@/ui/hooks/use-search-fields';
import { makeInMemoryContainer } from '../support/in-memory-container';

function wrapper({ children }: { children: ReactNode }) {
  return <CampoProvider container={makeInMemoryContainer()}>{children}</CampoProvider>;
}

describe('useSearchFields', () => {
  it('lists all fields for an empty query', async () => {
    const { result } = renderHook(() => useSearchFields(), { wrapper });
    await act(async () => { result.current.search(''); });
    await waitFor(() => expect(result.current.results).toHaveLength(2));
  });

  it('filters by query', async () => {
    const { result } = renderHook(() => useSearchFields(), { wrapper });
    await act(async () => { result.current.search('Alto'); });
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].field.name).toBe('Lote El Alto');
  });
});
```

Create `tests/ui/use-record-visit.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { useRecordVisit } from '@/ui/hooks/use-record-visit';
import { makeInMemoryContainer } from '../support/in-memory-container';

const NOW = new Date('2026-07-27T12:00:00Z');

function wrapper({ children }: { children: ReactNode }) {
  return <CampoProvider container={makeInMemoryContainer(NOW)}>{children}</CampoProvider>;
}

describe('useRecordVisit', () => {
  it('records a visit and exposes the result', async () => {
    const { result } = renderHook(() => useRecordVisit(), { wrapper });
    await act(async () => {
      result.current.submit({
        fieldId: 'f1',
        visitDate: new Date('2026-07-27T09:00:00Z'),
        followUp: { kind: 'none' },
      });
    });
    await waitFor(() => expect(result.current.result?.visitId).toBeTruthy());
    expect(result.current.error).toBeUndefined();
  });

  it('exposes a domain error for a future visit date', async () => {
    const { result } = renderHook(() => useRecordVisit(), { wrapper });
    await act(async () => {
      result.current.submit({
        fieldId: 'f1',
        visitDate: new Date('2026-08-01T09:00:00Z'),
        followUp: { kind: 'none' },
      });
    });
    await waitFor(() => expect(result.current.error?.name).toBe('FutureVisitDate'));
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run tests/ui/use-search-fields.test.tsx tests/ui/use-record-visit.test.tsx`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 4: Implementar `CampoProvider.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { Container } from '@/composition/container';

const CampoContext = createContext<Container | null>(null);

export function CampoProvider({ container, children }: { container: Container; children: ReactNode }) {
  return <CampoContext.Provider value={container}>{children}</CampoContext.Provider>;
}

export function useCampo(): Container {
  const container = useContext(CampoContext);
  if (!container) throw new Error('useCampo must be used within a CampoProvider');
  return container;
}
```

- [ ] **Step 5: Implementar `use-search-fields.ts`**

```ts
import { useCallback, useState } from 'react';
import type { FieldSearchResult } from '@/domain/services/field-search';
import { useCampo } from '@/ui/CampoProvider';

export function useSearchFields() {
  const { searchFields } = useCampo();
  const [results, setResults] = useState<FieldSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const search = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(undefined);
      try {
        setResults(await searchFields.execute(query));
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    },
    [searchFields],
  );

  return { results, loading, error, search };
}
```

- [ ] **Step 6: Implementar `use-record-visit.ts`**

```ts
import { useCallback, useState } from 'react';
import type { RecordVisitInput, RecordVisitResult } from '@/application/use-cases/record-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useRecordVisit() {
  const { recordVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<RecordVisitResult | undefined>();

  const submit = useCallback(
    async (input: RecordVisitInput) => {
      setSubmitting(true);
      setError(undefined);
      try {
        setResult(await recordVisit.execute(input));
      } catch (e) {
        setError(e as Error);
      } finally {
        setSubmitting(false);
      }
    },
    [recordVisit],
  );

  return { submit, submitting, error, result };
}
```

- [ ] **Step 7: Verificar que pasan**

Run: `npx vitest run tests/ui/use-search-fields.test.tsx tests/ui/use-record-visit.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/CampoProvider.tsx src/ui/hooks tests/support/in-memory-container.ts tests/ui/use-search-fields.test.tsx tests/ui/use-record-visit.test.tsx
git commit -m "feat: CampoProvider context and search/record hooks"
```

---

## Task 11: Screens + routes + error copy

**Files:**
- Create: `src/ui/error-messages.ts`
- Create: `src/ui/screens/SearchScreen.tsx`
- Create: `src/ui/screens/RecordVisitScreen.tsx`
- Create: `src/ui/App.tsx`
- Test: `tests/ui/search-screen.test.tsx`
- Test: `tests/ui/record-visit-screen.test.tsx`

**Interfaces:**
- Consumes: hooks (Task 10), `CampoProvider`, react-router-dom (`Routes`, `Route`, `Link`, `useParams`, `useNavigate`, `MemoryRouter` en tests).
- Produces:
  - `domainErrorMessage(error: Error): string`
  - `SearchScreen()`, `RecordVisitScreen()`, `App()` (define las rutas `/` y `/field/:fieldId/record`).

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/ui/search-screen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderScreen() {
  return render(
    <CampoProvider container={makeInMemoryContainer()}>
      <MemoryRouter>
        <SearchScreen />
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('SearchScreen', () => {
  it('lists all fields initially', async () => {
    renderScreen();
    expect(await screen.findByText(/Lote El Alto/)).toBeInTheDocument();
    expect(screen.getByText(/Lote La Baja/)).toBeInTheDocument();
  });

  it('filters as the user types', async () => {
    renderScreen();
    await screen.findByText(/Lote El Alto/);
    await userEvent.type(screen.getByLabelText('Buscar'), 'Alto');
    await waitFor(() => expect(screen.queryByText(/Lote La Baja/)).not.toBeInTheDocument());
    expect(screen.getByText(/Lote El Alto/)).toBeInTheDocument();
  });

  it('links each field to its record-visit route', async () => {
    renderScreen();
    const link = await screen.findByRole('link', { name: /Lote El Alto/ });
    expect(link).toHaveAttribute('href', '/field/f1/record');
  });
});
```

Create `tests/ui/record-visit-screen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderScreen(now = new Date('2026-07-27T12:00:00Z')) {
  return render(
    <CampoProvider container={makeInMemoryContainer(now)}>
      <MemoryRouter initialEntries={['/field/f1/record']}>
        <Routes>
          <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
          <Route path="/" element={<div>Listado</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('RecordVisitScreen', () => {
  it('records a visit and navigates back to the list', async () => {
    renderScreen();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByText('Listado')).toBeInTheDocument();
  });

  it('shows a Spanish message on a domain error (future date)', async () => {
    renderScreen();
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '2026-08-15');
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no puede ser futura/i),
    );
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/ui/search-screen.test.tsx tests/ui/record-visit-screen.test.tsx`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 3: Implementar `error-messages.ts`**

```ts
export function domainErrorMessage(error: Error): string {
  switch (error.name) {
    case 'FutureVisitDate':
      return 'La fecha de la visita no puede ser futura.';
    case 'DuplicateVisitForDay':
      return 'Ya registraste una visita para este lote ese día.';
    case 'FieldNotFound':
      return 'No se encontró el lote.';
    default:
      return 'Ocurrió un error al registrar la visita.';
  }
}
```

- [ ] **Step 4: Implementar `SearchScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchFields } from '@/ui/hooks/use-search-fields';

export function SearchScreen() {
  const { results, search, loading } = useSearchFields();
  const [query, setQuery] = useState('');

  useEffect(() => {
    search('');
  }, [search]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);
  };

  return (
    <main>
      <h1>Buscar lote</h1>
      <input
        aria-label="Buscar"
        value={query}
        onChange={onChange}
        placeholder="Lote, cliente o zona"
      />
      {loading && <p>Buscando…</p>}
      <ul>
        {results.map((r) => (
          <li key={r.field.id}>
            <Link to={`/field/${r.field.id}/record`}>
              {r.field.name} — {r.clientName} · {r.zoneName}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Implementar `RecordVisitScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FollowUpInput } from '@/application/use-cases/record-visit';
import { useRecordVisit } from '@/ui/hooks/use-record-visit';
import { domainErrorMessage } from '@/ui/error-messages';

type FollowUpKind = 'interval' | 'date' | 'none';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function RecordVisitScreen() {
  const { fieldId = '' } = useParams();
  const navigate = useNavigate();
  const { submit, submitting, error, result } = useRecordVisit();

  const [visitDate, setVisitDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('interval');
  const [intervalDays, setIntervalDays] = useState(14);
  const [nextDate, setNextDate] = useState(todayIso());
  const [leadDays, setLeadDays] = useState(3);

  useEffect(() => {
    if (result) navigate('/');
  }, [result, navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let followUp: FollowUpInput;
    if (kind === 'interval') {
      followUp = { kind: 'interval', days: intervalDays, reminderLeadDays: leadDays };
    } else if (kind === 'date') {
      followUp = { kind: 'date', date: utcDate(nextDate), reminderLeadDays: leadDays };
    } else {
      followUp = { kind: 'none' };
    }
    submit({
      fieldId,
      visitDate: utcDate(visitDate),
      notes: notes.trim() === '' ? undefined : notes,
      followUp,
    });
  };

  return (
    <main>
      <h1>Registrar visita</h1>
      <form onSubmit={onSubmit}>
        <label>
          Fecha
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
        <label>
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <fieldset>
          <legend>Próxima visita</legend>
          <label>
            <input type="radio" name="kind" checked={kind === 'interval'} onChange={() => setKind('interval')} />
            En N días
          </label>
          <label>
            <input type="radio" name="kind" checked={kind === 'date'} onChange={() => setKind('date')} />
            En una fecha
          </label>
          <label>
            <input type="radio" name="kind" checked={kind === 'none'} onChange={() => setKind('none')} />
            Sin próxima
          </label>
          {kind === 'interval' && (
            <label>
              Días
              <input
                type="number"
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
              />
            </label>
          )}
          {kind === 'date' && (
            <label>
              Fecha próxima
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </label>
          )}
          {kind !== 'none' && (
            <label>
              Avisar días antes
              <input
                type="number"
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
              />
            </label>
          )}
        </fieldset>
        {error && <p role="alert">{domainErrorMessage(error)}</p>}
        <button type="submit" disabled={submitting}>
          Registrar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Implementar `App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchScreen />} />
      <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Verificar que pasan**

Run: `npx vitest run tests/ui/search-screen.test.tsx tests/ui/record-visit-screen.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/error-messages.ts src/ui/screens src/ui/App.tsx tests/ui/search-screen.test.tsx tests/ui/record-visit-screen.test.tsx
git commit -m "feat: search and record-visit screens with routing"
```

---

## Task 12: End-to-end integration test (jsdom + fake-indexeddb)

**Files:**
- Test: `tests/ui/integration.test.tsx`

**Interfaces:**
- Consumes: `openCampoDb`, `seedIfEmpty`, `buildContainer`, `CampoProvider`, `App`, react-router `MemoryRouter`.
- Produces: nada (test).

- [ ] **Step 1: Escribir el test que falla**

Create `tests/ui/integration.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { CampoProvider } from '@/ui/CampoProvider';
import { App } from '@/ui/App';

describe('search → record visit (real IndexedDB adapter)', () => {
  it('records a visit for a seeded field and returns to the list', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);

    render(
      <CampoProvider container={container}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </CampoProvider>,
    );

    // Buscar y abrir el primer lote sembrado.
    const link = await screen.findByRole('link', { name: /El Alto/ });
    await userEvent.click(link);

    // Registrar sin próxima visita.
    await screen.findByRole('heading', { name: 'Registrar visita' });
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    // Vuelve a la búsqueda y hay una visita persistida.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Buscar lote' })).toBeInTheDocument());
    await waitFor(async () => expect(await db.count('visits')).toBe(1));
    db.close();
  });
});
```

- [ ] **Step 2: Verificar que falla, luego pasa**

Run: `npx vitest run tests/ui/integration.test.tsx`
Expected: si todas las tareas previas están completas, PASS. Si aún no, corregir hasta PASS (no hay implementación nueva; este test ejerce el cableado real).

- [ ] **Step 3: Commit**

```bash
git add tests/ui/integration.test.tsx
git commit -m "test: end-to-end search-to-record over real IndexedDB adapter"
```

---

## Task 13: App entry, Vite config y PWA

**Files:**
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/vite-env.d.ts`
- Create: `vite.config.ts`
- Create: `public/pwa-192.png`, `public/pwa-512.png`
- Modify: `.gitignore` (agregar `dev-dist/`)

**Interfaces:**
- Consumes: `openCampoDb`, `seedIfEmpty`, `buildContainer`, `CampoProvider`, `App`.
- Produces: build de producción con manifest + service worker (app-shell precache).

- [ ] **Step 1: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Campo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Crear `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 3: Crear `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { CampoProvider } from '@/ui/CampoProvider';
import { App } from '@/ui/App';

async function main() {
  const db = await openCampoDb();
  await seedIfEmpty(db);
  const container = buildContainer(db);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CampoProvider container={container}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CampoProvider>
    </StrictMode>,
  );
}

void main();
```

- [ ] **Step 4: Crear `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Campo',
        short_name: 'Campo',
        description: 'Registro de visitas a lotes',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 5: Crear los íconos placeholder**

Placeholder verde sólido (reemplazable por arte real 192/512 más adelante). Ejecutar:

```bash
mkdir -p public
node -e "const fs=require('fs');const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkuP6/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';const buf=Buffer.from(b64,'base64');fs.writeFileSync('public/pwa-192.png',buf);fs.writeFileSync('public/pwa-512.png',buf);"
```

- [ ] **Step 6: Ignorar `dev-dist/` en `.gitignore`**

Agregar la línea `dev-dist/` a `.gitignore` (la genera vite-plugin-pwa en dev).

- [ ] **Step 7: Verificar typecheck, tests y build**

Run: `npm run typecheck`
Expected: sin errores en todo el proyecto.

Run: `npm test`
Expected: PASS — toda la suite (dominio + adaptadores + UI + integración).

Run: `npm run build`
Expected: build exitoso; se generan `dist/manifest.webmanifest` y `dist/sw.js`.

- [ ] **Step 8: Commit**

```bash
git add index.html src/main.tsx src/vite-env.d.ts vite.config.ts public/pwa-192.png public/pwa-512.png .gitignore
git commit -m "feat: app entry, Vite build and installable PWA (autoUpdate)"
```

---

## Self-Review

**Spec coverage:**
- Seed embebido idempotente → Task 8. ✅
- Adaptador `idb` con stores/índices → Tasks 3-6. ✅
- Mapeo entidad↔registro → Task 2. ✅
- Clock/IdGenerator reales → Task 7. ✅
- Composition root → Task 9. ✅
- Context + hooks finos → Task 10. ✅
- 2 vistas + react-router (modo librería) + errores en español → Task 11. ✅
- PWA vite-plugin-pwa autoUpdate, app-shell only → Task 13. ✅
- Tests: contrato repos idb (Tasks 4-6), seed idempotencia (Task 8), hooks sobre in-memory (Task 10), 1 integración (Task 12). ✅
- Regla no-agroquímicos: ningún campo de dosis en records/UI/seed. ✅
- Dominio/aplicación intactos: solo se crean archivos en `infrastructure`, `composition`, `ui`, `tests`. ✅

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type consistency:** `Container`, `CampoDb`, `FieldRecord`/`VisitRecord`/`ReminderRecord`, `makeInMemoryContainer`, `domainErrorMessage`, `buildContainer`, `seedIfEmpty`, `openCampoDb` usados con firmas idénticas entre tareas. Los hooks devuelven exactamente las formas declaradas en sus bloques Interfaces. `FollowUpInput` importado del caso de uso real.

**Notas de riesgo para el ejecutor:**
- `environmentMatchGlobs` es propio de Vitest 2.x (fijado en `package.json`). Si se sube a Vitest 3, migrar a `test.projects` o directivas `// @vitest-environment jsdom` por archivo.
- Los íconos PWA son placeholders 1×1 (build válido, instalación de demo). Reemplazar por PNG 192/512 reales antes de un release.
