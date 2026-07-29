# Etapa 4b — ABM de catálogo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alta/edición/archivado (baja lógica reversible) de Zone, Client y Field, con un tercer tab "Catálogo", reemplazando el fixture de ejemplo por datos reales.

**Architecture:** Hexagonal. Se agrega `archived` a las tres entidades (inmutables → archivar/restaurar/editar devuelven copia) y se hacen opcionales `Field.clientId`/`zoneId` (huérfanos permitidos). Puertos + adaptadores idb/in-memory nuevos para Zone/Client, crecimiento del `FieldRepository`, casos de uso CRUD por entidad, y UI de gestión. El choke point `listAllWithHierarchy` filtra archivados y devuelve nombres opcionales, así Buscar/Agenda/avisos heredan el comportamiento sin tocarse una por una.

**Tech Stack:** TypeScript, Vitest, React 18 + react-router-dom 6, idb (IndexedDB), fake-indexeddb + @testing-library para tests.

Spec: [`docs/superpowers/specs/2026-07-29-etapa-4b-abm-catalogo-design.md`](../specs/2026-07-29-etapa-4b-abm-catalogo-design.md).

## Global Constraints

- **Regla dura**: ningún dato de dosis/agroquímicos/prescripciones. El form de Lote NO expone `crop`/`hectares`/`coordinates` (diferidos).
- **Arquitectura**: todo apunta al dominio; el dominio no conoce infra. Puertos en `domain/ports/outbound`; adaptadores idb + in-memory con el mismo contrato.
- **Idioma**: código e identificadores en inglés; texto visible al usuario (UI) en español.
- **Entidades inmutables**: archivar/restaurar/editar producen una instancia nueva (no mutación in-place).
- **Archivado = baja lógica reversible**: nunca borrado físico (salvo "Borrar todos los datos"). Listo para tombstones de Etapa 5.
- **TDD estricto**: test que falla → verlo fallar → implementación mínima → verde → commit. `npm test` y `npm run typecheck` verdes antes de cada commit.
- **IDs** vía puerto `IdGenerator.next()`. **Tiempo** vía puerto `Clock`. En tests: `IncrementingIdGenerator`, `FixedClock`.
- Errores de dominio se capturan en la UI y se muestran como texto en español; nunca se lanzan al usuario.

---

## Task 1: Dominio — `archived` en Zone y Client + errores

**Files:**
- Modify: `src/domain/entities/zone.ts`
- Modify: `src/domain/entities/client.ts`
- Modify: `src/domain/shared/errors.ts`
- Test: `tests/domain/entities/catalog.test.ts`

**Interfaces:**
- Produces: `Zone(id, name, archived=false)` con `archived: boolean`, `zone.archive(): Zone`, `zone.restore(): Zone`. `Client` idéntico. Errores `ZoneNotFound`, `ClientNotFound` extienden `DomainError`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/domain/entities/catalog.test.ts` dentro de los `describe` existentes:

```ts
// dentro de describe('Zone', ...)
  it('defaults archived to false', () => {
    expect(new Zone('z1', 'Quiroga').archived).toBe(false);
  });
  it('archive() returns an archived copy without mutating the original', () => {
    const z = new Zone('z1', 'Quiroga');
    const archived = z.archive();
    expect(archived.archived).toBe(true);
    expect(archived.id).toBe('z1');
    expect(archived.name).toBe('Quiroga');
    expect(z.archived).toBe(false);
  });
  it('restore() returns an active copy', () => {
    expect(new Zone('z1', 'Q', true).restore().archived).toBe(false);
  });
```

```ts
// dentro de describe('Client', ...)
  it('archive() and restore() flip the archived flag', () => {
    const c = new Client('c1', 'Pérez');
    expect(c.archive().archived).toBe(true);
    expect(c.archive().restore().archived).toBe(false);
    expect(c.archived).toBe(false);
  });
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/domain/entities/catalog.test.ts`
Expected: FAIL (`archived` no existe / `archive is not a function`).

- [ ] **Step 3: Implementar**

`src/domain/entities/zone.ts`:

```ts
import type { ZoneId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Zone {
  constructor(
    readonly id: ZoneId,
    readonly name: string,
    readonly archived: boolean = false,
  ) {
    if (name.trim() === '') throw new EmptyName('Zone name must not be empty');
  }

  archive(): Zone {
    return new Zone(this.id, this.name, true);
  }

  restore(): Zone {
    return new Zone(this.id, this.name, false);
  }
}
```

`src/domain/entities/client.ts`:

```ts
import type { ClientId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Client {
  constructor(
    readonly id: ClientId,
    readonly name: string,
    readonly archived: boolean = false,
  ) {
    if (name.trim() === '') throw new EmptyName('Client name must not be empty');
  }

  archive(): Client {
    return new Client(this.id, this.name, true);
  }

  restore(): Client {
    return new Client(this.id, this.name, false);
  }
}
```

En `src/domain/shared/errors.ts` agregar:

```ts
export class ZoneNotFound extends DomainError {}
export class ClientNotFound extends DomainError {}
```

- [ ] **Step 4: Correr y verlos pasar**

Run: `npx vitest run tests/domain/entities/catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/zone.ts src/domain/entities/client.ts src/domain/shared/errors.ts tests/domain/entities/catalog.test.ts
git commit -m "feat(domain): archived + archive/restore en Zone y Client; errores ZoneNotFound/ClientNotFound"
```

---

## Task 2: Dominio — Field con refs opcionales, `archived` y métodos de copia

**Files:**
- Modify: `src/domain/entities/field.ts`
- Test: `tests/domain/entities/catalog.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `FieldProps` con `clientId?`, `zoneId?`, `archived?`. `Field` con `archived: boolean`, y métodos `archive(): Field`, `restore(): Field`, `rename(name): Field`, `reassignClient(clientId?): Field`, `reassignZone(zoneId?): Field` (todos devuelven copia inmutable y revalidan vía constructor).

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar en `tests/domain/entities/catalog.test.ts` el test `'rejects a missing client or zone reference'` por los siguientes (dentro de `describe('Field', ...)`):

```ts
  it('allows an absent client or zone reference (orphan)', () => {
    const f = new Field({ id: 'f1', name: 'X' });
    expect(f.clientId).toBeUndefined();
    expect(f.zoneId).toBeUndefined();
  });
  it('rejects a present-but-empty reference', () => {
    expect(() => new Field({ id: 'f1', name: 'X', clientId: '' })).toThrow(MissingFieldReference);
    expect(() => new Field({ id: 'f1', name: 'X', zoneId: '' })).toThrow(MissingFieldReference);
  });
  it('defaults archived to false and archive()/restore() flip it', () => {
    const f = new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
    expect(f.archived).toBe(false);
    expect(f.archive().archived).toBe(true);
    expect(f.archive().restore().archived).toBe(false);
    expect(f.archive().id).toBe('f1');
  });
  it('rename() returns a copy with the new name, preserving refs', () => {
    const f = new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' }).rename('Y');
    expect(f.name).toBe('Y');
    expect(f.clientId).toBe('c1');
  });
  it('reassignClient/reassignZone can set and clear references', () => {
    const f = new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
    expect(f.reassignClient('c2').clientId).toBe('c2');
    expect(f.reassignClient(undefined).clientId).toBeUndefined();
    expect(f.reassignZone(undefined).zoneId).toBeUndefined();
  });
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/domain/entities/catalog.test.ts`
Expected: FAIL (constructor sigue exigiendo refs; métodos no existen).

- [ ] **Step 3: Implementar** `src/domain/entities/field.ts`

```ts
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import { EmptyName, MissingFieldReference } from '@/domain/shared/errors';
import type { Coordinates } from '@/domain/value-objects/coordinates';
import type { Hectares } from '@/domain/value-objects/hectares';

export interface FieldProps {
  id: FieldId;
  name: string;
  clientId?: ClientId;
  zoneId?: ZoneId;
  coordinates?: Coordinates;
  hectares?: Hectares;
  crop?: string;
  archived?: boolean;
}

export class Field {
  readonly id: FieldId;
  readonly name: string;
  readonly clientId?: ClientId;
  readonly zoneId?: ZoneId;
  readonly coordinates?: Coordinates;
  readonly hectares?: Hectares;
  readonly crop?: string;
  readonly archived: boolean;

  constructor(props: FieldProps) {
    if (props.name.trim() === '') throw new EmptyName('Field name must not be empty');
    if (props.clientId !== undefined && props.clientId.trim() === '') {
      throw new MissingFieldReference('Field client reference must not be empty when present');
    }
    if (props.zoneId !== undefined && props.zoneId.trim() === '') {
      throw new MissingFieldReference('Field zone reference must not be empty when present');
    }

    this.id = props.id;
    this.name = props.name;
    this.clientId = props.clientId;
    this.zoneId = props.zoneId;
    this.coordinates = props.coordinates;
    this.hectares = props.hectares;
    this.crop = props.crop;
    this.archived = props.archived ?? false;
  }

  private copy(overrides: Partial<FieldProps>): Field {
    return new Field({
      id: this.id,
      name: this.name,
      clientId: this.clientId,
      zoneId: this.zoneId,
      coordinates: this.coordinates,
      hectares: this.hectares,
      crop: this.crop,
      archived: this.archived,
      ...overrides,
    });
  }

  archive(): Field {
    return this.copy({ archived: true });
  }

  restore(): Field {
    return this.copy({ archived: false });
  }

  rename(name: string): Field {
    return this.copy({ name });
  }

  reassignClient(clientId?: ClientId): Field {
    return this.copy({ clientId });
  }

  reassignZone(zoneId?: ZoneId): Field {
    return this.copy({ zoneId });
  }
}
```

- [ ] **Step 4: Correr toda la suite** (cambio de invariante — verificar que nada más se rompió)

Run: `npx vitest run` y `npm run typecheck`
Expected: PASS. (Si algún test viejo asumía refs obligatorias en Field, ajustarlo; no debería haber casos fuera de `catalog.test.ts`.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/field.ts tests/domain/entities/catalog.test.ts
git commit -m "feat(domain): Field con refs opcionales, archived y métodos de copia (archive/restore/rename/reassign)"
```

---

## Task 3: Puertos + adaptadores in-memory de Zone y Client

**Files:**
- Create: `src/domain/ports/outbound/zone-repository.ts`
- Create: `src/domain/ports/outbound/client-repository.ts`
- Create: `src/infrastructure/persistence/in-memory/in-memory-zone-repository.ts`
- Create: `src/infrastructure/persistence/in-memory/in-memory-client-repository.ts`
- Test: `tests/infrastructure/in-memory-catalog-repositories.test.ts`

**Interfaces:**
- Consumes: `Zone`, `Client` (Task 1).
- Produces: `ZoneRepository { save(z): Promise<void>; findById(id): Promise<Zone|null>; listAll(): Promise<Zone[]> }` (listAll incluye archivados). `ClientRepository` idéntico con `Client`. `InMemoryZoneRepository(zones: Map<ZoneId, Zone>)`, `InMemoryClientRepository(clients: Map<ClientId, Client>)` — envuelven el mismo Map que consume `InMemoryFieldRepository`.

- [ ] **Step 1: Escribir el test que falla** `tests/infrastructure/in-memory-catalog-repositories.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';

describe('InMemoryZoneRepository', () => {
  it('saves, finds by id, and lists all (including archived)', async () => {
    const map = new Map<string, Zone>();
    const repo = new InMemoryZoneRepository(map);
    await repo.save(new Zone('z1', 'Norte'));
    await repo.save(new Zone('z2', 'Sur', true));
    expect((await repo.findById('z1'))?.name).toBe('Norte');
    expect(await repo.findById('nope')).toBeNull();
    expect((await repo.listAll()).map((z) => z.id).sort()).toEqual(['z1', 'z2']);
  });
});

describe('InMemoryClientRepository', () => {
  it('saves and finds clients', async () => {
    const repo = new InMemoryClientRepository(new Map());
    await repo.save(new Client('c1', 'Pérez'));
    expect((await repo.findById('c1'))?.name).toBe('Pérez');
    expect((await repo.listAll()).length).toBe(1);
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npx vitest run tests/infrastructure/in-memory-catalog-repositories.test.ts`
Expected: FAIL (módulos no existen).

- [ ] **Step 3: Implementar**

`src/domain/ports/outbound/zone-repository.ts`:

```ts
import type { Zone } from '@/domain/entities/zone';
import type { ZoneId } from '@/domain/shared/ids';

export interface ZoneRepository {
  save(zone: Zone): Promise<void>;
  findById(id: ZoneId): Promise<Zone | null>;
  listAll(): Promise<Zone[]>; // incluye archivados; la UI filtra
}
```

`src/domain/ports/outbound/client-repository.ts`:

```ts
import type { Client } from '@/domain/entities/client';
import type { ClientId } from '@/domain/shared/ids';

export interface ClientRepository {
  save(client: Client): Promise<void>;
  findById(id: ClientId): Promise<Client | null>;
  listAll(): Promise<Client[]>;
}
```

`src/infrastructure/persistence/in-memory/in-memory-zone-repository.ts`:

```ts
import type { Zone } from '@/domain/entities/zone';
import type { ZoneId } from '@/domain/shared/ids';
import type { ZoneRepository } from '@/domain/ports/outbound/zone-repository';

export class InMemoryZoneRepository implements ZoneRepository {
  constructor(private readonly zones: Map<ZoneId, Zone>) {}

  async save(zone: Zone): Promise<void> {
    this.zones.set(zone.id, zone);
  }

  async findById(id: ZoneId): Promise<Zone | null> {
    return this.zones.get(id) ?? null;
  }

  async listAll(): Promise<Zone[]> {
    return [...this.zones.values()];
  }

  clear(): void {
    this.zones.clear();
  }
}
```

`src/infrastructure/persistence/in-memory/in-memory-client-repository.ts`:

```ts
import type { Client } from '@/domain/entities/client';
import type { ClientId } from '@/domain/shared/ids';
import type { ClientRepository } from '@/domain/ports/outbound/client-repository';

export class InMemoryClientRepository implements ClientRepository {
  constructor(private readonly clients: Map<ClientId, Client>) {}

  async save(client: Client): Promise<void> {
    this.clients.set(client.id, client);
  }

  async findById(id: ClientId): Promise<Client | null> {
    return this.clients.get(id) ?? null;
  }

  async listAll(): Promise<Client[]> {
    return [...this.clients.values()];
  }

  clear(): void {
    this.clients.clear();
  }
}
```

- [ ] **Step 4: Correr y verlo pasar**

Run: `npx vitest run tests/infrastructure/in-memory-catalog-repositories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ports/outbound/zone-repository.ts src/domain/ports/outbound/client-repository.ts src/infrastructure/persistence/in-memory/in-memory-zone-repository.ts src/infrastructure/persistence/in-memory/in-memory-client-repository.ts tests/infrastructure/in-memory-catalog-repositories.test.ts
git commit -m "feat(infra): puertos ZoneRepository/ClientRepository + adaptadores in-memory"
```

---

## Task 4: `FieldRepository` — filtro de archivados, refs opcionales y métodos de catálogo (con ripple a Buscar/Agenda)

**Files:**
- Modify: `src/domain/services/field-search.ts` (nombres opcionales en `FieldSearchResult` + `fieldMatchesQuery`)
- Modify: `src/domain/ports/outbound/field-repository.ts` (nuevos métodos + `CatalogFieldRow`)
- Modify: `src/infrastructure/persistence/in-memory/in-memory-field-repository.ts`
- Modify: `src/application/use-cases/list-upcoming-visits.ts` (`UpcomingVisit` nombres opcionales)
- Modify: `src/domain/ports/outbound/reminder-notifier.ts` (`DueReminder.clientName`/`zoneName` opcionales)
- Modify: `src/ui/agenda-presentation.ts` (bucket "Sin zona"/"Sin cliente" al final)
- Create: `src/ui/labels.ts` (helpers `clientLabel`/`zoneLabel`)
- Modify: `src/ui/screens/SearchScreen.tsx`, `src/ui/screens/AgendaScreen.tsx` (mostrar "Sin cliente"/"Sin zona")
- Modify: `src/ui/components/ReminderAvisoBanner.tsx` (agrupar `zoneName` undefined bajo "Sin zona")
- Test: `tests/infrastructure/in-memory-field-repository.test.ts`, `tests/domain/services/field-search.test.ts`, `tests/ui/agenda-presentation.test.ts`, `tests/ui/reminder-aviso-banner.test.tsx`

**Interfaces:**
- Consumes: `Field.archived` (Task 2), Zone/Client maps.
- Produces: `FieldSearchResult { field; clientName?; zoneName? }`. `CatalogFieldRow { field: Field; clientName?: string; zoneName?: string }`. `FieldRepository` gana `listAllForCatalog(): Promise<CatalogFieldRow[]>`, `findActiveByClientId(id): Promise<Field[]>`, `findActiveByZoneId(id): Promise<Field[]>`; `listAllWithHierarchy` pasa a devolver solo activos con nombres resueltos contra padres activos. `DueReminder.clientName`/`zoneName` opcionales. `clientLabel(name?)`, `zoneLabel(name?)` en `@/ui/labels`.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar `tests/infrastructure/in-memory-field-repository.test.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';

function setup() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur', true)]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Activo', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'Archivado', clientId: 'c1', zoneId: 'z1', archived: true }),
    new Field({ id: 'f3', name: 'Huérfano', zoneId: 'z1' }),
    new Field({ id: 'f4', name: 'ZonaArchivada', clientId: 'c1', zoneId: 'z2' }),
  ]);
  return { fields };
}

describe('InMemoryFieldRepository.listAllWithHierarchy', () => {
  it('excludes archived fields', async () => {
    const rows = await setup().fields.listAllWithHierarchy();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f3', 'f4']);
  });
  it('resolves names only against active parents (undefined otherwise)', async () => {
    const rows = await setup().fields.listAllWithHierarchy();
    const byId = new Map(rows.map((r) => [r.field.id, r]));
    expect(byId.get('f1')!.clientName).toBe('Pérez');
    expect(byId.get('f1')!.zoneName).toBe('Norte');
    expect(byId.get('f3')!.clientName).toBeUndefined(); // sin cliente
    expect(byId.get('f4')!.zoneName).toBeUndefined();   // zona archivada
  });
});

describe('InMemoryFieldRepository.listAllForCatalog', () => {
  it('includes archived fields, names resolved against active parents', async () => {
    const rows = await setup().fields.listAllForCatalog();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f2', 'f3', 'f4']);
  });
});

describe('InMemoryFieldRepository.findActiveBy*', () => {
  it('finds active fields by client, excluding archived', async () => {
    const found = await setup().fields.findActiveByClientId('c1');
    expect(found.map((f) => f.id).sort()).toEqual(['f1', 'f4']);
  });
  it('finds active fields by zone', async () => {
    const found = await setup().fields.findActiveByZoneId('z1');
    expect(found.map((f) => f.id).sort()).toEqual(['f1', 'f3']);
  });
});
```

En `tests/domain/services/field-search.test.ts` agregar:

```ts
  it('matches when client/zone name is undefined (orphan field)', () => {
    const result = { field: { name: 'El Alto' } as any, clientName: undefined, zoneName: undefined };
    expect(fieldMatchesQuery(result, 'alto')).toBe(true);
    expect(fieldMatchesQuery(result, 'perez')).toBe(false);
  });
```

En `tests/ui/agenda-presentation.test.ts` agregar (grupo por zona con huérfano):

```ts
  it('groups orphan fields under "Sin zona" and sorts that group last', () => {
    const items = [
      { field: { id: 'a' }, zoneName: 'Norte', clientName: 'X', urgency: { bucket: 'THIS_WEEK', daysUntil: 1 } },
      { field: { id: 'b' }, zoneName: undefined, clientName: 'X', urgency: { bucket: 'THIS_WEEK', daysUntil: 2 } },
    ] as any;
    const sections = groupUpcoming(items, 'zone');
    expect(sections.map((s) => s.label)).toEqual(['Norte', 'Sin zona']);
  });
```

En `tests/ui/reminder-aviso-banner.test.tsx` agregar (el archivo ya tiene helpers para montar la banner con un batch; seguir su patrón para inyectar un `DueReminder` con `zoneName: undefined`):

```ts
  it('groups an orphan reminder (undefined zoneName) under "Sin zona"', () => {
    renderBannerWith([
      { reminderId: 'r1', fieldId: 'f1', fieldName: 'El Alto', clientName: undefined, zoneName: undefined, nextVisitDate: new Date(), remindAt: new Date() },
    ]);
    expect(screen.getByText('Sin zona')).toBeInTheDocument();
    expect(screen.getByText(/El Alto/)).toBeInTheDocument();
  });
```

(Si el archivo no expone un helper `renderBannerWith`, inyectar el batch a través de un notifier/`reminderAviso.snapshot()` stub como ya hace ese test; lo importante es un `DueReminder` con `zoneName: undefined`.)

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/infrastructure/in-memory-field-repository.test.ts tests/domain/services/field-search.test.ts tests/ui/agenda-presentation.test.ts tests/ui/reminder-aviso-banner.test.tsx`
Expected: FAIL (métodos/comportamiento no existen).

- [ ] **Step 3: Implementar**

`src/domain/services/field-search.ts`:

```ts
import type { Field } from '@/domain/entities/field';

export interface FieldSearchResult {
  field: Field;
  clientName?: string;
  zoneName?: string;
}

export function fieldMatchesQuery(result: FieldSearchResult, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return [result.field.name, result.clientName, result.zoneName].some(
    (value) => value !== undefined && value.toLowerCase().includes(q),
  );
}
```

`src/domain/ports/outbound/field-repository.ts`:

```ts
import type { Field } from '@/domain/entities/field';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import type { FieldSearchResult } from '@/domain/services/field-search';

export interface CatalogFieldRow {
  field: Field;
  clientName?: string;
  zoneName?: string;
}

export interface FieldRepository {
  save(field: Field): Promise<void>;
  findById(id: FieldId): Promise<Field | null>;
  /** Solo lotes activos; nombres resueltos contra padres activos (undefined si falta/archivado). */
  listAllWithHierarchy(): Promise<FieldSearchResult[]>;
  /** Todos los lotes (incl. archivados) para el catálogo. */
  listAllForCatalog(): Promise<CatalogFieldRow[]>;
  findActiveByClientId(id: ClientId): Promise<Field[]>;
  findActiveByZoneId(id: ZoneId): Promise<Field[]>;
}
```

`src/infrastructure/persistence/in-memory/in-memory-field-repository.ts`:

```ts
import type { Field } from '@/domain/entities/field';
import type { Zone } from '@/domain/entities/zone';
import type { Client } from '@/domain/entities/client';
import type { FieldId, ZoneId, ClientId } from '@/domain/shared/ids';
import type { FieldRepository, CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { FieldSearchResult } from '@/domain/services/field-search';

export class InMemoryFieldRepository implements FieldRepository {
  private readonly fields = new Map<FieldId, Field>();

  constructor(
    private readonly zones: Map<ZoneId, Zone>,
    private readonly clients: Map<ClientId, Client>,
    fields: Field[] = [],
  ) {
    for (const field of fields) this.fields.set(field.id, field);
  }

  async save(field: Field): Promise<void> {
    this.fields.set(field.id, field);
  }

  async findById(id: FieldId): Promise<Field | null> {
    return this.fields.get(id) ?? null;
  }

  async listAllWithHierarchy(): Promise<FieldSearchResult[]> {
    return [...this.fields.values()]
      .filter((f) => !f.archived)
      .map((field) => this.rowFor(field));
  }

  async listAllForCatalog(): Promise<CatalogFieldRow[]> {
    return [...this.fields.values()].map((field) => this.rowFor(field));
  }

  async findActiveByClientId(id: ClientId): Promise<Field[]> {
    return [...this.fields.values()].filter((f) => !f.archived && f.clientId === id);
  }

  async findActiveByZoneId(id: ZoneId): Promise<Field[]> {
    return [...this.fields.values()].filter((f) => !f.archived && f.zoneId === id);
  }

  clear(): void {
    this.fields.clear();
  }

  private rowFor(field: Field): CatalogFieldRow {
    return {
      field,
      clientName: this.activeName(this.clients, field.clientId),
      zoneName: this.activeName(this.zones, field.zoneId),
    };
  }

  private activeName<T extends { name: string; archived: boolean }>(
    map: Map<string, T>,
    id?: string,
  ): string | undefined {
    if (id === undefined) return undefined;
    const entity = map.get(id);
    return entity && !entity.archived ? entity.name : undefined;
  }
}
```

`src/application/use-cases/list-upcoming-visits.ts` — hacer opcionales los nombres:

```ts
export interface UpcomingVisit {
  field: Field;
  clientName?: string;
  zoneName?: string;
  nextVisitDate: Date;
  urgency: VisitUrgency;
}
```

(El resto del archivo queda igual: `clientName: h.clientName` ya asigna `string | undefined`.)

`src/domain/ports/outbound/reminder-notifier.ts` — hacer opcionales los nombres del DTO (así `DispatchDueReminders`, que asigna `h.clientName`/`h.zoneName` ahora opcionales, compila sin tocar el caso de uso):

```ts
export interface DueReminder {
  reminderId: ReminderId;
  fieldId: FieldId;
  fieldName: string;
  clientName?: string;
  zoneName?: string;
  nextVisitDate: Date;
  remindAt: Date;
}
```

`src/ui/components/ReminderAvisoBanner.tsx` — agrupar por `zoneLabel(item.zoneName)` para que un lote huérfano (zona undefined) caiga en "Sin zona":

```tsx
import { zoneLabel } from '@/ui/labels';
// ...
function groupByZone(batch: DueReminder[]): ZoneGroup[] {
  const byZone = new Map<string, string[]>();
  for (const item of batch) {
    const key = zoneLabel(item.zoneName);
    const names = byZone.get(key) ?? [];
    names.push(item.fieldName);
    byZone.set(key, names);
  }
  return [...byZone.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([zoneName, fieldNames]) => ({ zoneName, fieldNames }));
}
```

`src/ui/agenda-presentation.ts` — reemplazar el bloque de agrupación no-temporal:

```ts
const ORPHAN_LABEL: Record<Exclude<GroupBy, 'time'>, string> = {
  zone: 'Sin zona',
  client: 'Sin cliente',
};

// ...dentro de groupUpcoming, rama no-'time':
  const orphan = ORPHAN_LABEL[mode];
  const nameOf = (i: UpcomingVisit) => (mode === 'zone' ? i.zoneName : i.clientName) ?? orphan;
  const order: string[] = [];
  const groups = new Map<string, UpcomingVisit[]>();
  for (const item of items) {
    const name = nameOf(item);
    if (!groups.has(name)) {
      groups.set(name, []);
      order.push(name);
    }
    groups.get(name)!.push(item);
  }
  order.sort((a, b) => {
    if (a === orphan) return 1;
    if (b === orphan) return -1;
    return a.localeCompare(b, 'es');
  });
  return order.map((name) => ({ key: `${mode}:${name}`, label: name, items: groups.get(name)! }));
```

`src/ui/labels.ts` (nuevo):

```ts
export const clientLabel = (name?: string): string => name ?? 'Sin cliente';
export const zoneLabel = (name?: string): string => name ?? 'Sin zona';
```

En `src/ui/screens/SearchScreen.tsx`, importar los helpers y cambiar la línea del subtítulo:

```tsx
import { clientLabel, zoneLabel } from '@/ui/labels';
// ...
<span className="field-sub">{clientLabel(r.clientName)} · {zoneLabel(r.zoneName)}</span>
```

En `src/ui/screens/AgendaScreen.tsx`, ídem:

```tsx
import { clientLabel, zoneLabel } from '@/ui/labels';
// ...
<span className="agenda-row-sub">{clientLabel(item.clientName)} · {zoneLabel(item.zoneName)}</span>
```

- [ ] **Step 4: Correr toda la suite + typecheck**

Run: `npx vitest run` y `npm run typecheck`
Expected: PASS. (El idb `listAllWithHierarchy` todavía no filtra archivados ni implementa los métodos nuevos → su test se ajusta en Task 11; si `IdbFieldRepository` no compila por no implementar la interfaz, dejar los métodos nuevos con `throw new Error('not implemented')` temporal SOLO si hace falta para typecheck, y completarlos en Task 11. Preferible: implementar Task 11 antes de correr typecheck global — ver nota de orden abajo.)

> **Nota de orden**: Task 4 rompe la implementación de `IdbFieldRepository` (ya no satisface la interfaz). Si se ejecuta con subagentes, Task 4 y Task 11 forman un par: el typecheck global recién queda verde al terminar Task 11. Alternativa recomendada: en Task 4, agregar los métodos nuevos al `IdbFieldRepository` con una implementación mínima provisional idéntica a la definitiva de Task 11 (el código de Task 11 ya está listo abajo), y así cada task deja verde. Copiar de Task 11 los tres métodos y el filtro.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/field-search.ts src/domain/ports/outbound/field-repository.ts src/domain/ports/outbound/reminder-notifier.ts src/infrastructure/persistence/in-memory/in-memory-field-repository.ts src/application/use-cases/list-upcoming-visits.ts src/ui/agenda-presentation.ts src/ui/labels.ts src/ui/screens/SearchScreen.tsx src/ui/screens/AgendaScreen.tsx src/ui/components/ReminderAvisoBanner.tsx tests/infrastructure/in-memory-field-repository.test.ts tests/domain/services/field-search.test.ts tests/ui/agenda-presentation.test.ts tests/ui/reminder-aviso-banner.test.tsx
git commit -m "feat(infra): FieldRepository filtra archivados + refs opcionales + métodos de catálogo; ripple 'Sin cliente/Sin zona' en Buscar, Agenda y aviso"
```

---

## Task 5: Casos de uso de Zone

**Files:**
- Create: `src/application/use-cases/zone-catalog.ts` (todas las operaciones de Zone)
- Test: `tests/application/zone-catalog.test.ts`

**Interfaces:**
- Consumes: `ZoneRepository`, `FieldRepository`, `IdGenerator`, `Zone`, `ZoneNotFound`.
- Produces: clases `CreateZone`, `EditZone`, `ArchiveZone`, `RestoreZone`, `ListZones`.
  - `CreateZone.execute(name: string): Promise<Zone>`
  - `EditZone.execute(id: ZoneId, name: string): Promise<Zone>` (throw `ZoneNotFound`)
  - `ArchiveZone.execute(id: ZoneId, cascadeFields: boolean): Promise<void>`
  - `RestoreZone.execute(id: ZoneId): Promise<void>`
  - `ListZones.execute(): Promise<Zone[]>`

- [ ] **Step 1: Escribir los tests que fallan** `tests/application/zone-catalog.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Field } from '@/domain/entities/field';
import { ZoneNotFound } from '@/domain/shared/errors';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { CreateZone, EditZone, ArchiveZone, RestoreZone, ListZones } from '@/application/use-cases/zone-catalog';

let zoneMap: Map<string, Zone>;
let zones: InMemoryZoneRepository;
let fields: InMemoryFieldRepository;

beforeEach(() => {
  zoneMap = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clientMap = new Map();
  zones = new InMemoryZoneRepository(zoneMap);
  fields = new InMemoryFieldRepository(zoneMap, clientMap, [
    new Field({ id: 'f1', name: 'Activo', zoneId: 'z1' }),
  ]);
});

describe('CreateZone', () => {
  it('creates a zone with a generated id', async () => {
    const z = await new CreateZone(zones, new IncrementingIdGenerator('z')).execute('Sur');
    expect(z.name).toBe('Sur');
    expect((await zones.findById(z.id))?.name).toBe('Sur');
  });
});

describe('EditZone', () => {
  it('renames an existing zone', async () => {
    await new EditZone(zones).execute('z1', 'Noreste');
    expect((await zones.findById('z1'))?.name).toBe('Noreste');
  });
  it('throws ZoneNotFound for an unknown id', async () => {
    await expect(new EditZone(zones).execute('nope', 'X')).rejects.toThrow(ZoneNotFound);
  });
});

describe('ArchiveZone', () => {
  it('cascade=true archives the zone and its active fields', async () => {
    await new ArchiveZone(zones, fields).execute('z1', true);
    expect((await zones.findById('z1'))?.archived).toBe(true);
    expect((await fields.findById('f1'))?.archived).toBe(true);
  });
  it('cascade=false archives the zone and nulls the zoneId of its active fields', async () => {
    await new ArchiveZone(zones, fields).execute('z1', false);
    expect((await zones.findById('z1'))?.archived).toBe(true);
    const f1 = await fields.findById('f1');
    expect(f1?.archived).toBe(false);
    expect(f1?.zoneId).toBeUndefined();
  });
  it('throws ZoneNotFound for an unknown id', async () => {
    await expect(new ArchiveZone(zones, fields).execute('nope', false)).rejects.toThrow(ZoneNotFound);
  });
});

describe('RestoreZone', () => {
  it('un-archives a zone', async () => {
    await new ArchiveZone(zones, fields).execute('z1', false);
    await new RestoreZone(zones).execute('z1');
    expect((await zones.findById('z1'))?.archived).toBe(false);
  });
});

describe('ListZones', () => {
  it('returns all zones including archived', async () => {
    await zones.save(new Zone('z2', 'Sur', true));
    expect((await new ListZones(zones).execute()).map((z) => z.id).sort()).toEqual(['z1', 'z2']);
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/application/zone-catalog.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar** `src/application/use-cases/zone-catalog.ts`

```ts
import type { ZoneRepository } from '@/domain/ports/outbound/zone-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { ZoneId } from '@/domain/shared/ids';
import { Zone } from '@/domain/entities/zone';
import { ZoneNotFound } from '@/domain/shared/errors';

export class CreateZone {
  constructor(private readonly zones: ZoneRepository, private readonly ids: IdGenerator) {}
  async execute(name: string): Promise<Zone> {
    const zone = new Zone(this.ids.next(), name);
    await this.zones.save(zone);
    return zone;
  }
}

export class EditZone {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(id: ZoneId, name: string): Promise<Zone> {
    const existing = await this.zones.findById(id);
    if (!existing) throw new ZoneNotFound(`unknown zone ${id}`);
    const renamed = new Zone(existing.id, name, existing.archived);
    await this.zones.save(renamed);
    return renamed;
  }
}

export class ArchiveZone {
  constructor(private readonly zones: ZoneRepository, private readonly fields: FieldRepository) {}
  async execute(id: ZoneId, cascadeFields: boolean): Promise<void> {
    const zone = await this.zones.findById(id);
    if (!zone) throw new ZoneNotFound(`unknown zone ${id}`);
    await this.zones.save(zone.archive());
    const affected = await this.fields.findActiveByZoneId(id);
    for (const field of affected) {
      await this.fields.save(cascadeFields ? field.archive() : field.reassignZone(undefined));
    }
  }
}

export class RestoreZone {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(id: ZoneId): Promise<void> {
    const zone = await this.zones.findById(id);
    if (!zone) throw new ZoneNotFound(`unknown zone ${id}`);
    await this.zones.save(zone.restore());
  }
}

export class ListZones {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(): Promise<Zone[]> {
    return this.zones.listAll();
  }
}
```

- [ ] **Step 4: Correr y verlos pasar**

Run: `npx vitest run tests/application/zone-catalog.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/zone-catalog.ts tests/application/zone-catalog.test.ts
git commit -m "feat(app): casos de uso de Zone (create/edit/archive con cascada/restore/list)"
```

---

## Task 6: Casos de uso de Client

**Files:**
- Create: `src/application/use-cases/client-catalog.ts`
- Test: `tests/application/client-catalog.test.ts`

**Interfaces:**
- Produces: `CreateClient`, `EditClient`, `ArchiveClient`, `RestoreClient`, `ListClients` (misma forma que Zone, con `ClientRepository`, `Client`, `ClientNotFound`, y `fields.findActiveByClientId` / `field.reassignClient(undefined)`).

- [ ] **Step 1: Escribir los tests que fallan** `tests/application/client-catalog.test.ts`

```ts
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
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/application/client-catalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `src/application/use-cases/client-catalog.ts`

```ts
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
```

- [ ] **Step 4: Correr y verlos pasar**

Run: `npx vitest run tests/application/client-catalog.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/client-catalog.ts tests/application/client-catalog.test.ts
git commit -m "feat(app): casos de uso de Client (create/edit/archive con cascada/restore/list)"
```

---

## Task 7: Casos de uso de Field

**Files:**
- Create: `src/application/use-cases/field-catalog.ts`
- Test: `tests/application/field-catalog.test.ts`

**Interfaces:**
- Consumes: `FieldRepository`, `IdGenerator`, `Field`, `FieldNotFound`, `CatalogFieldRow`.
- Produces:
  - `CreateField.execute(input: { name: string; clientId?: ClientId; zoneId?: ZoneId }): Promise<Field>`
  - `EditField.execute(input: { id: FieldId; name: string; clientId?: ClientId; zoneId?: ZoneId }): Promise<Field>` (throw `FieldNotFound`; preserva coordinates/hectares/crop/archived)
  - `ArchiveField.execute(id: FieldId): Promise<void>` (throw `FieldNotFound`)
  - `RestoreField.execute(id: FieldId): Promise<void>`
  - `ListCatalogFields.execute(): Promise<CatalogFieldRow[]>`

- [ ] **Step 1: Escribir los tests que fallan** `tests/application/field-catalog.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { FieldNotFound } from '@/domain/shared/errors';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { CreateField, EditField, ArchiveField, RestoreField, ListCatalogFields } from '@/application/use-cases/field-catalog';

let fields: InMemoryFieldRepository;

beforeEach(() => {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  fields = new InMemoryFieldRepository(zones, clients, []);
});

describe('CreateField', () => {
  it('creates a field with generated id and optional refs', async () => {
    const f = await new CreateField(fields, new IncrementingIdGenerator('f')).execute({ name: 'El Alto', zoneId: 'z1' });
    expect(f.name).toBe('El Alto');
    expect(f.zoneId).toBe('z1');
    expect(f.clientId).toBeUndefined();
    expect((await fields.findById(f.id))?.name).toBe('El Alto');
  });
});

describe('EditField', () => {
  beforeEach(async () => {
    await fields.save(new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1', crop: 'soja', archived: false }));
  });
  it('renames and reassigns client/zone, preserving other attributes', async () => {
    const updated = await new EditField(fields).execute({ id: 'f1', name: 'Y', clientId: undefined, zoneId: 'z2' });
    expect(updated.name).toBe('Y');
    expect(updated.clientId).toBeUndefined();
    expect(updated.zoneId).toBe('z2');
    expect(updated.crop).toBe('soja');
  });
  it('throws FieldNotFound for unknown id', async () => {
    await expect(new EditField(fields).execute({ id: 'nope', name: 'Y' })).rejects.toThrow(FieldNotFound);
  });
});

describe('ArchiveField / RestoreField', () => {
  it('archives and restores', async () => {
    await fields.save(new Field({ id: 'f1', name: 'X', zoneId: 'z1' }));
    await new ArchiveField(fields).execute('f1');
    expect((await fields.findById('f1'))?.archived).toBe(true);
    await new RestoreField(fields).execute('f1');
    expect((await fields.findById('f1'))?.archived).toBe(false);
  });
  it('ArchiveField throws FieldNotFound for unknown id', async () => {
    await expect(new ArchiveField(fields).execute('nope')).rejects.toThrow(FieldNotFound);
  });
});

describe('ListCatalogFields', () => {
  it('returns catalog rows including archived', async () => {
    await fields.save(new Field({ id: 'f1', name: 'X', zoneId: 'z1' }));
    await fields.save(new Field({ id: 'f2', name: 'Y', archived: true }));
    const rows = await new ListCatalogFields(fields).execute();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f2']);
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/application/field-catalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `src/application/use-cases/field-catalog.ts`

```ts
import type { FieldRepository, CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import { Field } from '@/domain/entities/field';
import { FieldNotFound } from '@/domain/shared/errors';

export interface CreateFieldInput {
  name: string;
  clientId?: ClientId;
  zoneId?: ZoneId;
}

export interface EditFieldInput extends CreateFieldInput {
  id: FieldId;
}

export class CreateField {
  constructor(private readonly fields: FieldRepository, private readonly ids: IdGenerator) {}
  async execute(input: CreateFieldInput): Promise<Field> {
    const field = new Field({
      id: this.ids.next(),
      name: input.name,
      clientId: input.clientId,
      zoneId: input.zoneId,
    });
    await this.fields.save(field);
    return field;
  }
}

export class EditField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(input: EditFieldInput): Promise<Field> {
    const existing = await this.fields.findById(input.id);
    if (!existing) throw new FieldNotFound(`unknown field ${input.id}`);
    const updated = existing
      .rename(input.name)
      .reassignClient(input.clientId)
      .reassignZone(input.zoneId);
    await this.fields.save(updated);
    return updated;
  }
}

export class ArchiveField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(id: FieldId): Promise<void> {
    const field = await this.fields.findById(id);
    if (!field) throw new FieldNotFound(`unknown field ${id}`);
    await this.fields.save(field.archive());
  }
}

export class RestoreField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(id: FieldId): Promise<void> {
    const field = await this.fields.findById(id);
    if (!field) throw new FieldNotFound(`unknown field ${id}`);
    await this.fields.save(field.restore());
  }
}

export class ListCatalogFields {
  constructor(private readonly fields: FieldRepository) {}
  async execute(): Promise<CatalogFieldRow[]> {
    return this.fields.listAllForCatalog();
  }
}
```

- [ ] **Step 4: Correr y verlos pasar**

Run: `npx vitest run tests/application/field-catalog.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/field-catalog.ts tests/application/field-catalog.test.ts
git commit -m "feat(app): casos de uso de Field (create/edit con reasignación/archive/restore/list catálogo)"
```

---

## Task 8: `DataReset` port + `ClearAllData` + in-memory reset

**Files:**
- Create: `src/domain/ports/outbound/data-reset.ts`
- Create: `src/application/use-cases/clear-all-data.ts`
- Create: `src/infrastructure/persistence/in-memory/in-memory-data-reset.ts`
- Modify: `src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts` (add `clear()`)
- Modify: `src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts` (add `clear()`)
- Test: `tests/application/clear-all-data.test.ts`

**Interfaces:**
- Produces: `DataReset { clearAll(): Promise<void> }`. `ClearAllData.execute(): Promise<void>`. `InMemoryDataReset(clears: Array<() => void>)`. `clear(): void` en los repos in-memory de visit y reminder.

- [ ] **Step 1: Escribir el test que falla** `tests/application/clear-all-data.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { ClearAllData } from '@/application/use-cases/clear-all-data';
import { InMemoryDataReset } from '@/infrastructure/persistence/in-memory/in-memory-data-reset';

describe('ClearAllData', () => {
  it('invokes every registered clear callback', async () => {
    const calls: string[] = [];
    const reset = new InMemoryDataReset([
      () => calls.push('zones'),
      () => calls.push('fields'),
    ]);
    await new ClearAllData(reset).execute();
    expect(calls).toEqual(['zones', 'fields']);
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npx vitest run tests/application/clear-all-data.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/domain/ports/outbound/data-reset.ts`:

```ts
export interface DataReset {
  clearAll(): Promise<void>;
}
```

`src/application/use-cases/clear-all-data.ts`:

```ts
import type { DataReset } from '@/domain/ports/outbound/data-reset';

export class ClearAllData {
  constructor(private readonly reset: DataReset) {}
  async execute(): Promise<void> {
    await this.reset.clearAll();
  }
}
```

`src/infrastructure/persistence/in-memory/in-memory-data-reset.ts`:

```ts
import type { DataReset } from '@/domain/ports/outbound/data-reset';

export class InMemoryDataReset implements DataReset {
  constructor(private readonly clears: Array<() => void>) {}
  async clearAll(): Promise<void> {
    for (const clear of this.clears) clear();
  }
}
```

Agregar `clear(): void { this.<mapInterno>.clear(); }` a `InMemoryVisitRepository` y `InMemoryReminderRepository` (inspeccionar el nombre del Map privado de cada uno y limpiarlo).

- [ ] **Step 4: Correr y verlo pasar**

Run: `npx vitest run tests/application/clear-all-data.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ports/outbound/data-reset.ts src/application/use-cases/clear-all-data.ts src/infrastructure/persistence/in-memory/in-memory-data-reset.ts src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts tests/application/clear-all-data.test.ts
git commit -m "feat(app): puerto DataReset + caso de uso ClearAllData + reset in-memory"
```

---

## Task 9: idb records — `archived` + refs opcionales + mappers de Zone/Client

**Files:**
- Modify: `src/infrastructure/persistence/idb/records.ts`
- Test: `tests/infrastructure/idb/records.test.ts`

**Interfaces:**
- Produces: `ZoneRecord`/`ClientRecord` con `archived?: boolean`; `FieldRecord` con `clientId?`, `zoneId?`, `archived?`. Mappers `toZoneRecord`/`fromZoneRecord`, `toClientRecord`/`fromClientRecord`; `toFieldRecord`/`fromFieldRecord` mapean `archived` (default `false` al leer).

- [ ] **Step 1: Escribir los tests que fallan** — agregar a `tests/infrastructure/idb/records.test.ts`

```ts
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { toZoneRecord, fromZoneRecord, toClientRecord, fromClientRecord } from '@/infrastructure/persistence/idb/records';
// (Field, toFieldRecord, fromFieldRecord ya importados en el archivo)

describe('zone/client record mappers', () => {
  it('round-trips a zone with archived', () => {
    const z = fromZoneRecord(toZoneRecord(new Zone('z1', 'Norte', true)));
    expect(z.name).toBe('Norte');
    expect(z.archived).toBe(true);
  });
  it('defaults archived to false for legacy records without the flag', () => {
    expect(fromZoneRecord({ id: 'z1', name: 'Norte' }).archived).toBe(false);
    expect(fromClientRecord({ id: 'c1', name: 'Pérez' }).archived).toBe(false);
  });
});

describe('field record mappers with optional refs + archived', () => {
  it('round-trips an orphan archived field', () => {
    const f = fromFieldRecord(toFieldRecord(new Field({ id: 'f1', name: 'X', archived: true })));
    expect(f.clientId).toBeUndefined();
    expect(f.zoneId).toBeUndefined();
    expect(f.archived).toBe(true);
  });
  it('defaults archived to false for legacy field records', () => {
    expect(fromFieldRecord({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' }).archived).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/infrastructure/idb/records.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** — en `src/infrastructure/persistence/idb/records.ts`:

Cambiar interfaces:

```ts
export interface ZoneRecord {
  id: string;
  name: string;
  archived?: boolean;
}

export interface ClientRecord {
  id: string;
  name: string;
  archived?: boolean;
}

export interface FieldRecord {
  id: string;
  name: string;
  clientId?: string;
  zoneId?: string;
  coordinates?: { latitude: number; longitude: number };
  hectares?: number;
  crop?: string;
  archived?: boolean;
}
```

Agregar mappers de zone/client e importar las entidades:

```ts
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';

export function toZoneRecord(z: Zone): ZoneRecord {
  return { id: z.id, name: z.name, archived: z.archived };
}
export function fromZoneRecord(r: ZoneRecord): Zone {
  return new Zone(r.id, r.name, r.archived ?? false);
}
export function toClientRecord(c: Client): ClientRecord {
  return { id: c.id, name: c.name, archived: c.archived };
}
export function fromClientRecord(r: ClientRecord): Client {
  return new Client(r.id, r.name, r.archived ?? false);
}
```

Actualizar los mappers de Field para incluir `archived` y refs opcionales:

```ts
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
    archived: f.archived,
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
    archived: r.archived ?? false,
  });
}
```

- [ ] **Step 4: Correr y verlos pasar**

Run: `npx vitest run tests/infrastructure/idb/records.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/records.ts tests/infrastructure/idb/records.test.ts
git commit -m "feat(infra): records idb con archived + refs opcionales + mappers de Zone/Client"
```

---

## Task 10: Adaptadores idb de Zone y Client

**Files:**
- Create: `src/infrastructure/persistence/idb/idb-zone-repository.ts`
- Create: `src/infrastructure/persistence/idb/idb-client-repository.ts`
- Test: `tests/infrastructure/idb/idb-catalog-repositories.test.ts`

**Interfaces:**
- Consumes: `openCampoDb`, mappers (Task 9).
- Produces: `IdbZoneRepository(db)` implementa `ZoneRepository`; `IdbClientRepository(db)` implementa `ClientRepository`.

- [ ] **Step 1: Escribir el test que falla** `tests/infrastructure/idb/idb-catalog-repositories.test.ts`

Seguir el patrón de `tests/infrastructure/idb/idb-field-repository.test.ts` (usa `openCampoDb` + fake-indexeddb del `tests/setup.ts`). Base de datos con nombre único por test para aislar:

```ts
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { IdbZoneRepository } from '@/infrastructure/persistence/idb/idb-zone-repository';
import { IdbClientRepository } from '@/infrastructure/persistence/idb/idb-client-repository';

let dbn = 0;
const freshDb = () => openCampoDb(`catalog-test-${dbn++}`);

describe('IdbZoneRepository', () => {
  it('saves, finds and lists zones (including archived)', async () => {
    const repo = new IdbZoneRepository(await freshDb());
    await repo.save(new Zone('z1', 'Norte'));
    await repo.save(new Zone('z2', 'Sur', true));
    expect((await repo.findById('z1'))?.name).toBe('Norte');
    expect((await repo.findById('nope'))).toBeNull();
    const all = await repo.listAll();
    expect(all.map((z) => z.id).sort()).toEqual(['z1', 'z2']);
    expect(all.find((z) => z.id === 'z2')?.archived).toBe(true);
  });
});

describe('IdbClientRepository', () => {
  it('saves and finds clients', async () => {
    const repo = new IdbClientRepository(await freshDb());
    await repo.save(new Client('c1', 'Pérez'));
    expect((await repo.findById('c1'))?.name).toBe('Pérez');
    expect((await repo.listAll()).length).toBe(1);
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npx vitest run tests/infrastructure/idb/idb-catalog-repositories.test.ts`
Expected: FAIL (módulos no existen).

- [ ] **Step 3: Implementar**

`src/infrastructure/persistence/idb/idb-zone-repository.ts`:

```ts
import type { ZoneRepository } from '@/domain/ports/outbound/zone-repository';
import type { Zone } from '@/domain/entities/zone';
import type { ZoneId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toZoneRecord, fromZoneRecord } from './records';

export class IdbZoneRepository implements ZoneRepository {
  constructor(private readonly db: CampoDb) {}

  async save(zone: Zone): Promise<void> {
    await this.db.put('zones', toZoneRecord(zone));
  }

  async findById(id: ZoneId): Promise<Zone | null> {
    const record = await this.db.get('zones', id);
    return record ? fromZoneRecord(record) : null;
  }

  async listAll(): Promise<Zone[]> {
    return (await this.db.getAll('zones')).map(fromZoneRecord);
  }
}
```

`src/infrastructure/persistence/idb/idb-client-repository.ts`:

```ts
import type { ClientRepository } from '@/domain/ports/outbound/client-repository';
import type { Client } from '@/domain/entities/client';
import type { ClientId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toClientRecord, fromClientRecord } from './records';

export class IdbClientRepository implements ClientRepository {
  constructor(private readonly db: CampoDb) {}

  async save(client: Client): Promise<void> {
    await this.db.put('clients', toClientRecord(client));
  }

  async findById(id: ClientId): Promise<Client | null> {
    const record = await this.db.get('clients', id);
    return record ? fromClientRecord(record) : null;
  }

  async listAll(): Promise<Client[]> {
    return (await this.db.getAll('clients')).map(fromClientRecord);
  }
}
```

- [ ] **Step 4: Correr y verlo pasar**

Run: `npx vitest run tests/infrastructure/idb/idb-catalog-repositories.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/idb-zone-repository.ts src/infrastructure/persistence/idb/idb-client-repository.ts tests/infrastructure/idb/idb-catalog-repositories.test.ts
git commit -m "feat(infra): adaptadores idb de Zone y Client"
```

---

## Task 11: `IdbFieldRepository` — filtro de archivados + métodos de catálogo + `IdbDataReset`

**Files:**
- Modify: `src/infrastructure/persistence/idb/idb-field-repository.ts`
- Create: `src/infrastructure/persistence/idb/idb-data-reset.ts`
- Test: `tests/infrastructure/idb/idb-field-repository.test.ts`, `tests/infrastructure/idb/idb-data-reset.test.ts`

**Interfaces:**
- Produces: `IdbFieldRepository` implementa el contrato completo (Task 4). `IdbDataReset(db)` implementa `DataReset` limpiando los 5 stores.

> Si en Task 4 se agregaron implementaciones provisionales de estos métodos al `IdbFieldRepository`, acá se consolidan definitivamente y se agregan sus tests.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/infrastructure/idb/idb-field-repository.test.ts` (siguiendo el patrón de setup con `openCampoDb` de nombre único ya usado en ese archivo; sembrar zones/clients/fields vía `db.put`):

```ts
  it('listAllWithHierarchy excludes archived fields and resolves names against active parents only', async () => {
    const db = await freshDb();
    await db.put('zones', { id: 'z1', name: 'Norte' });
    await db.put('zones', { id: 'z2', name: 'Sur', archived: true });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await db.put('fields', { id: 'f1', name: 'Activo', clientId: 'c1', zoneId: 'z1' });
    await db.put('fields', { id: 'f2', name: 'Arch', clientId: 'c1', zoneId: 'z1', archived: true });
    await db.put('fields', { id: 'f3', name: 'ZonaArch', clientId: 'c1', zoneId: 'z2' });
    const repo = new IdbFieldRepository(db);
    const rows = await repo.listAllWithHierarchy();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f3']);
    expect(rows.find((r) => r.field.id === 'f3')?.zoneName).toBeUndefined();
    expect(rows.find((r) => r.field.id === 'f1')?.zoneName).toBe('Norte');
  });

  it('listAllForCatalog includes archived, findActiveBy* excludes archived', async () => {
    const db = await freshDb();
    await db.put('fields', { id: 'f1', name: 'A', clientId: 'c1', zoneId: 'z1' });
    await db.put('fields', { id: 'f2', name: 'B', clientId: 'c1', zoneId: 'z1', archived: true });
    const repo = new IdbFieldRepository(db);
    expect((await repo.listAllForCatalog()).length).toBe(2);
    expect((await repo.findActiveByClientId('c1')).map((f) => f.id)).toEqual(['f1']);
    expect((await repo.findActiveByZoneId('z1')).map((f) => f.id)).toEqual(['f1']);
  });
```

`tests/infrastructure/idb/idb-data-reset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbDataReset } from '@/infrastructure/persistence/idb/idb-data-reset';

describe('IdbDataReset', () => {
  it('clears every object store', async () => {
    const db = await openCampoDb('reset-test');
    await db.put('zones', { id: 'z1', name: 'Norte' });
    await db.put('fields', { id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
    await new IdbDataReset(db).clearAll();
    expect(await db.count('zones')).toBe(0);
    expect(await db.count('fields')).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/infrastructure/idb/idb-field-repository.test.ts tests/infrastructure/idb/idb-data-reset.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `src/infrastructure/persistence/idb/idb-field-repository.ts`

```ts
import type { FieldRepository, CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { Field } from '@/domain/entities/field';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
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
    const rows = await this.catalogRows();
    return rows.filter((r) => !r.field.archived);
  }

  async listAllForCatalog(): Promise<CatalogFieldRow[]> {
    return this.catalogRows();
  }

  async findActiveByClientId(id: ClientId): Promise<Field[]> {
    const fieldRecords = await this.db.getAll('fields');
    return fieldRecords
      .filter((r) => !(r.archived ?? false) && r.clientId === id)
      .map(fromFieldRecord);
  }

  async findActiveByZoneId(id: ZoneId): Promise<Field[]> {
    const fieldRecords = await this.db.getAll('fields');
    return fieldRecords
      .filter((r) => !(r.archived ?? false) && r.zoneId === id)
      .map(fromFieldRecord);
  }

  private async catalogRows(): Promise<CatalogFieldRow[]> {
    const [fieldRecords, zoneRecords, clientRecords] = await Promise.all([
      this.db.getAll('fields'),
      this.db.getAll('zones'),
      this.db.getAll('clients'),
    ]);
    const zoneNames = new Map(
      zoneRecords.filter((z) => !(z.archived ?? false)).map((z) => [z.id, z.name]),
    );
    const clientNames = new Map(
      clientRecords.filter((c) => !(c.archived ?? false)).map((c) => [c.id, c.name]),
    );
    return fieldRecords.map((record) => {
      const field = fromFieldRecord(record);
      return {
        field,
        clientName: field.clientId !== undefined ? clientNames.get(field.clientId) : undefined,
        zoneName: field.zoneId !== undefined ? zoneNames.get(field.zoneId) : undefined,
      };
    });
  }
}
```

`src/infrastructure/persistence/idb/idb-data-reset.ts`:

```ts
import type { DataReset } from '@/domain/ports/outbound/data-reset';
import type { CampoDb } from './open-campo-db';

const STORES = ['zones', 'clients', 'fields', 'visits', 'reminders'] as const;

export class IdbDataReset implements DataReset {
  constructor(private readonly db: CampoDb) {}

  async clearAll(): Promise<void> {
    const tx = this.db.transaction(STORES, 'readwrite');
    await Promise.all([...STORES.map((store) => tx.objectStore(store).clear()), tx.done]);
  }
}
```

- [ ] **Step 4: Correr toda la suite + typecheck**

Run: `npx vitest run` y `npm run typecheck`
Expected: PASS (ahora `IdbFieldRepository` satisface el contrato completo).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/idb/idb-field-repository.ts src/infrastructure/persistence/idb/idb-data-reset.ts tests/infrastructure/idb/idb-field-repository.test.ts tests/infrastructure/idb/idb-data-reset.test.ts
git commit -m "feat(infra): IdbFieldRepository filtra archivados + métodos de catálogo; IdbDataReset"
```

---

## Task 12: Composición — Container, buildContainer, makeInMemoryContainer y seed gateado

**Files:**
- Modify: `src/composition/container.ts`
- Modify: `src/main.tsx` (gate del seed a `import.meta.env.DEV`)
- Modify: `tests/support/in-memory-container.ts`
- Modify: `tests/composition/container.test.ts`
- Test: `tests/composition/container.test.ts`

**Interfaces:**
- Produces: `Container` con los casos de uso nuevos: `createZone, editZone, archiveZone, restoreZone, listZones, createClient, editClient, archiveClient, restoreClient, listClients, createField, editField, archiveField, restoreField, listCatalogFields, clearAllData`.

- [ ] **Step 1: Escribir el test que falla** — en `tests/composition/container.test.ts`, agregar aserciones de que `makeInMemoryContainer()` expone los casos de uso nuevos (elegir el estilo del test existente en ese archivo):

```ts
  it('wires the catalog use cases', () => {
    const c = makeInMemoryContainer();
    expect(c.createZone).toBeDefined();
    expect(c.archiveClient).toBeDefined();
    expect(c.listCatalogFields).toBeDefined();
    expect(c.clearAllData).toBeDefined();
  });
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npx vitest run tests/composition/container.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Extender `Container` en `src/composition/container.ts` con los tipos importados y el wiring. Añadir imports de los casos de uso (`zone-catalog`, `client-catalog`, `field-catalog`, `clear-all-data`), de los repos idb (`IdbZoneRepository`, `IdbClientRepository`, `IdbDataReset`), y armar:

```ts
export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
  listUpcomingVisits: ListUpcomingVisits;
  dispatchDueReminders: DispatchDueReminders;
  reminderAviso: ReminderAvisoStore;
  createZone: CreateZone;
  editZone: EditZone;
  archiveZone: ArchiveZone;
  restoreZone: RestoreZone;
  listZones: ListZones;
  createClient: CreateClient;
  editClient: EditClient;
  archiveClient: ArchiveClient;
  restoreClient: RestoreClient;
  listClients: ListClients;
  createField: CreateField;
  editField: EditField;
  archiveField: ArchiveField;
  restoreField: RestoreField;
  listCatalogFields: ListCatalogFields;
  clearAllData: ClearAllData;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  const zones = new IdbZoneRepository(db);
  const clients = new IdbClientRepository(db);
  const dataReset = new IdbDataReset(db);
  const clock = new SystemClock();
  const ids = new Uuidv7IdGenerator();
  const notifier = new InAppReminderNotifier();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, ids),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
    createZone: new CreateZone(zones, ids),
    editZone: new EditZone(zones),
    archiveZone: new ArchiveZone(zones, fields),
    restoreZone: new RestoreZone(zones),
    listZones: new ListZones(zones),
    createClient: new CreateClient(clients, ids),
    editClient: new EditClient(clients),
    archiveClient: new ArchiveClient(clients, fields),
    restoreClient: new RestoreClient(clients),
    listClients: new ListClients(clients),
    createField: new CreateField(fields, ids),
    editField: new EditField(fields),
    archiveField: new ArchiveField(fields),
    restoreField: new RestoreField(fields),
    listCatalogFields: new ListCatalogFields(fields),
    clearAllData: new ClearAllData(dataReset),
  };
}
```

Actualizar `tests/support/in-memory-container.ts` para construir zone/client repos sobre los mismos maps + los casos de uso nuevos + `InMemoryDataReset`:

```ts
// añadir imports de: InMemoryZoneRepository, InMemoryClientRepository, InMemoryDataReset,
//   CreateZone..ListZones, CreateClient..ListClients, CreateField..ListCatalogFields, ClearAllData
export function makeInMemoryContainer(now = new Date('2026-07-27T12:00:00Z')): Container {
  const zoneMap = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clientMap = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zoneMap, clientMap, [
    new Field({ id: 'f1', name: 'Lote El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'Lote La Baja', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const zones = new InMemoryZoneRepository(zoneMap);
  const clients = new InMemoryClientRepository(clientMap);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const clock = new FixedClock(now);
  const ids = new IncrementingIdGenerator();
  const notifier = new InAppReminderNotifier();
  const dataReset = new InMemoryDataReset([
    () => zoneMap.clear(),
    () => clientMap.clear(),
    () => fields.clear(),
    () => visits.clear(),
    () => reminders.clear(),
  ]);
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, ids),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
    createZone: new CreateZone(zones, ids),
    editZone: new EditZone(zones),
    archiveZone: new ArchiveZone(zones, fields),
    restoreZone: new RestoreZone(zones),
    listZones: new ListZones(zones),
    createClient: new CreateClient(clients, ids),
    editClient: new EditClient(clients),
    archiveClient: new ArchiveClient(clients, fields),
    restoreClient: new RestoreClient(clients),
    listClients: new ListClients(clients),
    createField: new CreateField(fields, ids),
    editField: new EditField(fields),
    archiveField: new ArchiveField(fields),
    restoreField: new RestoreField(fields),
    listCatalogFields: new ListCatalogFields(fields),
    clearAllData: new ClearAllData(dataReset),
  };
}
```

En `src/main.tsx`, cambiar la línea del seed:

```ts
  if (import.meta.env.DEV) {
    await seedIfEmpty(db);
  }
```

- [ ] **Step 4: Correr toda la suite + typecheck + build**

Run: `npx vitest run` && `npm run typecheck` && `npm run build`
Expected: PASS (build genera PWA sin errores).

- [ ] **Step 5: Commit**

```bash
git add src/composition/container.ts src/main.tsx tests/support/in-memory-container.ts tests/composition/container.test.ts
git commit -m "feat(composition): wiring del catálogo (repos + casos de uso + reset) y seed gateado a DEV"
```

---

## Task 13: UI — tercer tab, rutas, hub de Catálogo, `ConfirmDialog` y "Borrar todos los datos"

**Files:**
- Modify: `src/ui/components/TabBar.tsx`
- Modify: `src/ui/App.tsx`
- Create: `src/ui/components/ConfirmDialog.tsx`
- Create: `src/ui/screens/CatalogHubScreen.tsx`
- Create: `src/ui/hooks/use-clear-all-data.ts`
- Modify: `src/ui/styles.css` (estilos reusando tokens existentes)
- Test: `tests/ui/tab-bar.test.tsx`, `tests/ui/catalog-hub-screen.test.tsx`

**Interfaces:**
- Produces: tab "Catálogo" → `/catalogo`. `ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel })` (modal in-app accesible, sin `window.confirm`). `CatalogHubScreen` con enlaces a `/catalogo/zonas|clientes|lotes` y acción "Borrar todos los datos" (doble confirmación → `clearAllData`).

- [ ] **Step 1: Escribir los tests que fallan**

`tests/ui/tab-bar.test.tsx` — agregar:

```ts
  it('shows a Catálogo tab linking to /catalogo', () => {
    renderTabBar(); // helper existente en el archivo
    const link = screen.getByRole('link', { name: /Catálogo/ });
    expect(link).toHaveAttribute('href', '/catalogo');
  });
```

`tests/ui/catalog-hub-screen.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { CatalogHubScreen } from '@/ui/screens/CatalogHubScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderHub(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter><CatalogHubScreen /></MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('CatalogHubScreen', () => {
  it('links to zonas, clientes and lotes', () => {
    renderHub();
    expect(screen.getByRole('link', { name: /Zonas/ })).toHaveAttribute('href', '/catalogo/zonas');
    expect(screen.getByRole('link', { name: /Clientes/ })).toHaveAttribute('href', '/catalogo/clientes');
    expect(screen.getByRole('link', { name: /Lotes/ })).toHaveAttribute('href', '/catalogo/lotes');
  });

  it('clears all data after a two-step confirmation', async () => {
    const container = renderHub();
    await userEvent.click(screen.getByRole('button', { name: /Borrar todos los datos/ }));
    // paso 2: confirmar en el diálogo
    await userEvent.click(screen.getByRole('button', { name: /^Borrar$/ }));
    // los lotes del fixture in-memory quedaron vacíos
    expect((await container.listCatalogFields.execute()).length).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/ui/tab-bar.test.tsx tests/ui/catalog-hub-screen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/ui/components/TabBar.tsx` — agregar el tercer `NavLink` (usar un ícono de `lucide-react`, p. ej. `FolderOpen`):

```tsx
import { NavLink } from 'react-router-dom';
import { Home, Search, FolderOpen } from 'lucide-react';

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Navegación principal">
      <NavLink to="/" end className="tab">
        <Home className="tab-icon" size={20} aria-hidden="true" />
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/buscar" className="tab">
        <Search className="tab-icon" size={20} aria-hidden="true" />
        <span>Buscar</span>
      </NavLink>
      <NavLink to="/catalogo" className="tab">
        <FolderOpen className="tab-icon" size={20} aria-hidden="true" />
        <span>Catálogo</span>
      </NavLink>
    </nav>
  );
}
```

`src/ui/components/ConfirmDialog.tsx`:

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
```

`src/ui/hooks/use-clear-all-data.ts`:

```ts
import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useClearAllData() {
  const { clearAllData } = useCampo();
  const [busy, setBusy] = useState(false);
  const clear = useCallback(async () => {
    setBusy(true);
    try {
      await clearAllData.execute();
    } finally {
      setBusy(false);
    }
  }, [clearAllData]);
  return { clear, busy };
}
```

`src/ui/screens/CatalogHubScreen.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useClearAllData } from '@/ui/hooks/use-clear-all-data';

export function CatalogHubScreen() {
  const { clear } = useClearAllData();
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="screen">
      <h1 className="screen-title">Catálogo</h1>
      <ul className="catalog-menu">
        <li><Link className="field-row" to="/catalogo/zonas"><span className="field-name">Zonas</span><span className="chevron" aria-hidden="true">›</span></Link></li>
        <li><Link className="field-row" to="/catalogo/clientes"><span className="field-name">Clientes</span><span className="chevron" aria-hidden="true">›</span></Link></li>
        <li><Link className="field-row" to="/catalogo/lotes"><span className="field-name">Lotes</span><span className="chevron" aria-hidden="true">›</span></Link></li>
      </ul>

      <section className="danger-zone">
        <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
          Borrar todos los datos
        </button>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Borrar todos los datos"
        message="Se eliminarán zonas, clientes, lotes, visitas y avisos de este dispositivo. No se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={async () => { setConfirming(false); await clear(); }}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
```

`src/ui/App.tsx` — agregar la ruta del hub dentro de `TabsLayout` (las rutas de listas/forms se agregan en Tasks 14–16):

```tsx
        <Route path="/catalogo" element={<CatalogHubScreen />} />
```

(con su import). En `src/ui/styles.css` agregar estilos para `.dialog-backdrop`, `.dialog`, `.dialog-actions`, `.btn-danger`, `.btn-secondary`, `.catalog-menu`, `.danger-zone` reutilizando las custom properties existentes (paleta Campo). Rojo de peligro: un tono coherente con la paleta (p. ej. `#b3261e`).

- [ ] **Step 4: Correr y verlos pasar + typecheck**

Run: `npx vitest run tests/ui/tab-bar.test.tsx tests/ui/catalog-hub-screen.test.tsx` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/TabBar.tsx src/ui/App.tsx src/ui/components/ConfirmDialog.tsx src/ui/screens/CatalogHubScreen.tsx src/ui/hooks/use-clear-all-data.ts src/ui/styles.css tests/ui/tab-bar.test.tsx tests/ui/catalog-hub-screen.test.tsx
git commit -m "feat(ui): tab Catálogo + hub + ConfirmDialog + Borrar todos los datos"
```

---

## Task 14: UI — ABM genérico de catálogo + Zonas

**Files:**
- Create: `src/ui/catalog/catalog-section.ts` (tipos + config de sección)
- Create: `src/ui/catalog/use-catalog-entity.ts` (hook genérico de estado/acciones)
- Create: `src/ui/catalog/CatalogListScreen.tsx` (pantalla lista genérica)
- Create: `src/ui/catalog/CatalogFormScreen.tsx` (pantalla form genérica)
- Create: `src/ui/catalog/use-zone-section.ts` (config de la sección Zonas)
- Create: `src/ui/screens/ZonesListScreen.tsx` (wrapper fino)
- Create: `src/ui/screens/ZoneFormScreen.tsx` (wrapper fino)
- Modify: `src/ui/App.tsx` (rutas)
- Modify: `src/ui/error-messages.ts` (`catalogErrorMessage`)
- Modify: `src/ui/styles.css` (estilos reusando tokens existentes)
- Test: `tests/ui/catalog-abm-zones.test.tsx`

**Interfaces:**
- Consumes: casos de uso de Zone + `listCatalogFields` (contar lotes activos al archivar). `ConfirmDialog` (Task 13), `catalogErrorMessage`.
- Produces:
  - `CatalogEntity { id: string; name: string; archived: boolean }` (Zone y Client lo satisfacen).
  - `CatalogSection<E>` = `{ basePath; newPath; labels; actions }` (ver código).
  - `useCatalogEntity(section): { entities; loading; reload; create; rename; archive; restore; countActiveFields }`.
  - `CatalogListScreen({ useSection })`, `CatalogFormScreen({ useSection })` genéricos.
  - `useZoneSection(): CatalogSection<Zone>`.
  - Rutas `/catalogo/zonas`, `/catalogo/zonas/nueva`, `/catalogo/zonas/:id`.
- Nota DRY: esta tarea construye el ABM genérico; Task 15 (Clientes) es solo `useClientSection` + wrappers. La duplicación Zona/Cliente queda eliminada por diseño (decisión del usuario en el pre-flight).

- [ ] **Step 1: Escribir los tests que fallan** `tests/ui/catalog-abm-zones.test.tsx`

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ZonesListScreen } from '@/ui/screens/ZonesListScreen';
import { ZoneFormScreen } from '@/ui/screens/ZoneFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderAt(path: string, container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/catalogo/zonas" element={<ZonesListScreen />} />
          <Route path="/catalogo/zonas/nueva" element={<ZoneFormScreen />} />
          <Route path="/catalogo/zonas/:id" element={<ZoneFormScreen />} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('ZonesListScreen (ABM genérico)', () => {
  it('lists active zones and hides archived by default', async () => {
    const c = makeInMemoryContainer();
    await c.createZone.execute('Sur');
    await c.archiveZone.execute('z1', false); // Norte del fixture → archivada
    renderAt('/catalogo/zonas', c);
    expect(await screen.findByText('Sur')).toBeInTheDocument();
    expect(screen.queryByText('Norte')).not.toBeInTheDocument();
  });

  it('reveals archived zones and restores one', async () => {
    const c = makeInMemoryContainer();
    await c.archiveZone.execute('z1', false);
    renderAt('/catalogo/zonas', c);
    await userEvent.click(await screen.findByRole('button', { name: /ver archivados/i }));
    expect(await screen.findByText('Norte')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /restaurar/i }));
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.archived).toBe(false));
  });

  it('prompts to cascade when archiving a zone with active fields; "keep fields" orphans them', async () => {
    const c = makeInMemoryContainer(); // fixture: z1 Norte con f1/f2 activos en z1
    renderAt('/catalogo/zonas', c);
    await screen.findByText('Norte');
    await userEvent.click(screen.getByRole('button', { name: /archivar Norte/i }));
    expect(await screen.findByText(/lotes activos/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /mantener los lotes/i })); // cascade=false
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.archived).toBe(true));
    const rows = await c.listCatalogFields.execute();
    expect(rows.filter((r) => !r.field.archived && r.field.zoneId === undefined).length).toBe(2);
  });
});

describe('ZoneFormScreen (ABM genérico)', () => {
  it('creates a zone', async () => {
    const c = renderAt('/catalogo/zonas/nueva');
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Oeste');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listZones.execute()).some((z) => z.name === 'Oeste')).toBe(true));
  });

  it('edits an existing zone (preloads the name)', async () => {
    const c = renderAt('/catalogo/zonas/z1'); // Norte
    expect(await screen.findByDisplayValue('Norte')).toBeInTheDocument();
    const input = screen.getByLabelText(/nombre/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Noreste');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.name).toBe('Noreste'));
  });

  it('shows an error for an empty name', async () => {
    renderAt('/catalogo/zonas/nueva');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(await screen.findByText(/el nombre no puede estar vacío/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/ui/catalog-abm-zones.test.tsx`
Expected: FAIL (módulos no existen).

- [ ] **Step 3: Implementar**

En `src/ui/error-messages.ts` agregar:

```ts
export function catalogErrorMessage(error: Error): string {
  switch (error.name) {
    case 'EmptyName':
      return 'El nombre no puede estar vacío.';
    case 'ZoneNotFound':
      return 'No se encontró la zona.';
    case 'ClientNotFound':
      return 'No se encontró el cliente.';
    case 'FieldNotFound':
      return 'No se encontró el lote.';
    default:
      return 'Ocurrió un error al guardar.';
  }
}
```

`src/ui/catalog/catalog-section.ts`:

```ts
export interface CatalogEntity {
  id: string;
  name: string;
  archived: boolean;
}

export interface CatalogSectionLabels {
  listTitle: string;                          // "Zonas"
  newAction: string;                          // "Nueva zona"
  formTitleNew: string;                       // "Nueva zona"
  formTitleEdit: string;                      // "Editar zona"
  backToList: string;                         // "‹ Zonas"
  emptyMessage: string;                       // "No hay zonas."
  cascadeTitle: (name: string) => string;     // `Archivar ${name}`
  cascadeMessage: (count: number) => string;  // `Esta zona tiene ${count} lotes activos. ¿Archivar también los lotes?`
}

export interface CatalogSectionActions<E extends CatalogEntity> {
  list: () => Promise<E[]>;
  create: (name: string) => Promise<unknown>;
  rename: (id: string, name: string) => Promise<unknown>;
  archive: (id: string, cascadeFields: boolean) => Promise<void>;
  restore: (id: string) => Promise<void>;
  countActiveFields: (id: string) => Promise<number>;
}

export interface CatalogSection<E extends CatalogEntity> {
  basePath: string;  // '/catalogo/zonas'
  newPath: string;   // '/catalogo/zonas/nueva'
  labels: CatalogSectionLabels;
  actions: CatalogSectionActions<E>;
}
```

`src/ui/catalog/use-catalog-entity.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { CatalogEntity, CatalogSection } from './catalog-section';

export function useCatalogEntity<E extends CatalogEntity>(section: CatalogSection<E>) {
  const { actions } = section;
  const [entities, setEntities] = useState<E[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEntities(await actions.list());
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => { void reload(); }, [reload]);

  const archive = useCallback(
    async (id: string, cascadeFields: boolean) => { await actions.archive(id, cascadeFields); await reload(); },
    [actions, reload],
  );
  const restore = useCallback(
    async (id: string) => { await actions.restore(id); await reload(); },
    [actions, reload],
  );

  return {
    entities,
    loading,
    reload,
    create: actions.create,
    rename: actions.rename,
    archive,
    restore,
    countActiveFields: actions.countActiveFields,
  };
}
```

`src/ui/catalog/CatalogListScreen.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogEntity, CatalogSection } from './catalog-section';
import { useCatalogEntity } from './use-catalog-entity';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

export function CatalogListScreen<E extends CatalogEntity>({ useSection }: { useSection: () => CatalogSection<E> }) {
  const section = useSection();
  const { labels, basePath, newPath } = section;
  const { entities, loading, archive, restore, countActiveFields } = useCatalogEntity(section);
  const [showArchived, setShowArchived] = useState(false);
  const [cascade, setCascade] = useState<{ id: string; name: string; count: number } | null>(null);

  const visible = entities.filter((e) => e.archived === showArchived);

  const onArchive = async (id: string, name: string) => {
    const count = await countActiveFields(id);
    if (count > 0) setCascade({ id, name, count });
    else await archive(id, false);
  };

  return (
    <main className="screen">
      <header className="list-header">
        <Link className="back-link" to="/catalogo">‹ Catálogo</Link>
        <h1 className="screen-title">{labels.listTitle}</h1>
        <Link className="btn-primary" to={newPath}>{labels.newAction}</Link>
      </header>

      <button type="button" className="toggle-archived" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Ver activos' : 'Ver archivados'}
      </button>

      {loading && <p className="hint">Cargando…</p>}
      {!loading && visible.length === 0 && <p className="empty">{labels.emptyMessage}</p>}

      <ul className="field-list">
        {visible.map((e) => (
          <li key={e.id} className="catalog-row">
            {showArchived ? (
              <>
                <span className="field-name">{e.name}</span>
                <button type="button" className="btn-secondary" onClick={() => restore(e.id)}>Restaurar</button>
              </>
            ) : (
              <>
                <Link className="field-name" to={`${basePath}/${e.id}`}>{e.name}</Link>
                <button type="button" className="btn-secondary" aria-label={`Archivar ${e.name}`} onClick={() => onArchive(e.id, e.name)}>Archivar</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={cascade !== null}
        title={cascade ? labels.cascadeTitle(cascade.name) : ''}
        message={cascade ? labels.cascadeMessage(cascade.count) : ''}
        confirmLabel="Archivar también los lotes"
        cancelLabel="Mantener los lotes"
        onConfirm={async () => { if (cascade) await archive(cascade.id, true); setCascade(null); }}
        onCancel={async () => { if (cascade) await archive(cascade.id, false); setCascade(null); }}
      />
    </main>
  );
}
```

> Nota de UX: en el diálogo de cascada **ambos** botones ejecutan una acción (cascada vs mantener); el backdrop-click cae en `onCancel` = mantener los lotes. Un tercer camino "no archivar nada" queda diferido.

`src/ui/catalog/CatalogFormScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CatalogEntity, CatalogSection } from './catalog-section';
import { useCatalogEntity } from './use-catalog-entity';
import { catalogErrorMessage } from '@/ui/error-messages';

export function CatalogFormScreen<E extends CatalogEntity>({ useSection }: { useSection: () => CatalogSection<E> }) {
  const section = useSection();
  const { labels, basePath } = section;
  const { id } = useParams();
  const navigate = useNavigate();
  const { entities, create, rename } = useCatalogEntity(section);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Precarga el nombre en edición cuando la lista termina de cargar (sin sobrescribir lo que el usuario tipeó).
  useEffect(() => {
    if (!id || touched) return;
    const found = entities.find((e) => e.id === id);
    if (found) setName(found.name);
  }, [id, entities, touched]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      if (id) await rename(id, name);
      else await create(name);
      navigate(basePath);
    } catch (err) {
      setError(catalogErrorMessage(err as Error));
    }
  };

  return (
    <main className="screen">
      <button type="button" className="back-link" onClick={() => navigate(basePath)}>{labels.backToList}</button>
      <h1 className="screen-title">{id ? labels.formTitleEdit : labels.formTitleNew}</h1>
      <form onSubmit={onSubmit} className="catalog-form">
        <label className="form-label">
          Nombre
          <input
            className="form-input"
            value={name}
            onChange={(e) => { setTouched(true); setName(e.target.value); }}
            autoFocus
          />
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn-primary">Guardar</button>
      </form>
    </main>
  );
}
```

`src/ui/catalog/use-zone-section.ts`:

```ts
import { useMemo } from 'react';
import type { Zone } from '@/domain/entities/zone';
import type { CatalogSection } from './catalog-section';
import { useCampo } from '@/ui/CampoProvider';

export function useZoneSection(): CatalogSection<Zone> {
  const { listZones, createZone, editZone, archiveZone, restoreZone, listCatalogFields } = useCampo();
  return useMemo<CatalogSection<Zone>>(() => ({
    basePath: '/catalogo/zonas',
    newPath: '/catalogo/zonas/nueva',
    labels: {
      listTitle: 'Zonas',
      newAction: 'Nueva zona',
      formTitleNew: 'Nueva zona',
      formTitleEdit: 'Editar zona',
      backToList: '‹ Zonas',
      emptyMessage: 'No hay zonas.',
      cascadeTitle: (name) => `Archivar ${name}`,
      cascadeMessage: (count) => `Esta zona tiene ${count} lotes activos. ¿Archivar también los lotes?`,
    },
    actions: {
      list: () => listZones.execute(),
      create: (name) => createZone.execute(name),
      rename: (id, name) => editZone.execute(id, name),
      archive: (id, cascade) => archiveZone.execute(id, cascade),
      restore: (id) => restoreZone.execute(id),
      countActiveFields: async (id) =>
        (await listCatalogFields.execute()).filter((r) => !r.field.archived && r.field.zoneId === id).length,
    },
  }), [listZones, createZone, editZone, archiveZone, restoreZone, listCatalogFields]);
}
```

`src/ui/screens/ZonesListScreen.tsx`:

```tsx
import { CatalogListScreen } from '@/ui/catalog/CatalogListScreen';
import { useZoneSection } from '@/ui/catalog/use-zone-section';

export function ZonesListScreen() {
  return <CatalogListScreen useSection={useZoneSection} />;
}
```

`src/ui/screens/ZoneFormScreen.tsx`:

```tsx
import { CatalogFormScreen } from '@/ui/catalog/CatalogFormScreen';
import { useZoneSection } from '@/ui/catalog/use-zone-section';

export function ZoneFormScreen() {
  return <CatalogFormScreen useSection={useZoneSection} />;
}
```

En `src/ui/App.tsx` agregar la lista dentro de `TabsLayout` y los forms fuera (pantalla completa):

```tsx
        <Route path="/catalogo/zonas" element={<ZonesListScreen />} />
// ...fuera del layout de tabs:
      <Route path="/catalogo/zonas/nueva" element={<ZoneFormScreen />} />
      <Route path="/catalogo/zonas/:id" element={<ZoneFormScreen />} />
```

En `styles.css` agregar lo que falte (`.list-header`, `.catalog-row`, `.toggle-archived`, `.btn-primary`, `.catalog-form`, `.form-label`, `.form-input`) reusando tokens.

- [ ] **Step 4: Correr y verlos pasar + typecheck**

Run: `npx vitest run tests/ui/catalog-abm-zones.test.tsx` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/catalog/ src/ui/screens/ZonesListScreen.tsx src/ui/screens/ZoneFormScreen.tsx src/ui/App.tsx src/ui/error-messages.ts src/ui/styles.css tests/ui/catalog-abm-zones.test.tsx
git commit -m "feat(ui): ABM genérico de catálogo (lista/form/cascada/restaurar) + sección Zonas"
```

---

## Task 15: UI — Clientes sobre el ABM genérico

**Files:**
- Create: `src/ui/catalog/use-client-section.ts`
- Create: `src/ui/screens/ClientsListScreen.tsx` (wrapper fino)
- Create: `src/ui/screens/ClientFormScreen.tsx` (wrapper fino)
- Modify: `src/ui/App.tsx` (rutas `/catalogo/clientes*`)
- Test: `tests/ui/catalog-abm-clients.test.tsx`

**Interfaces:**
- Consumes: el ABM genérico de Task 14 (`CatalogListScreen`, `CatalogFormScreen`, `CatalogSection`, `useCatalogEntity`), casos de uso de Client + `listCatalogFields`.
- Produces: `useClientSection(): CatalogSection<Client>`; wrappers `ClientsListScreen`/`ClientFormScreen`; rutas `/catalogo/clientes`, `/catalogo/clientes/nuevo`, `/catalogo/clientes/:id`.

- [ ] **Step 1: Escribir los tests que fallan** `tests/ui/catalog-abm-clients.test.tsx`

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ClientsListScreen } from '@/ui/screens/ClientsListScreen';
import { ClientFormScreen } from '@/ui/screens/ClientFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderAt(path: string, container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/catalogo/clientes" element={<ClientsListScreen />} />
          <Route path="/catalogo/clientes/nuevo" element={<ClientFormScreen />} />
          <Route path="/catalogo/clientes/:id" element={<ClientFormScreen />} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('ClientsListScreen (ABM genérico)', () => {
  it('lists active clients and hides archived by default', async () => {
    const c = makeInMemoryContainer();
    await c.createClient.execute('Gómez');
    await c.archiveClient.execute('c1', true); // Pérez del fixture (con f1/f2) → cascada
    renderAt('/catalogo/clientes', c);
    expect(await screen.findByText('Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Pérez')).not.toBeInTheDocument();
  });

  it('prompts to cascade when archiving a client with active fields; "keep fields" orphans them', async () => {
    const c = makeInMemoryContainer(); // fixture: c1 Pérez con f1/f2 activos
    renderAt('/catalogo/clientes', c);
    await screen.findByText('Pérez');
    await userEvent.click(screen.getByRole('button', { name: /archivar Pérez/i }));
    expect(await screen.findByText(/este cliente tiene 2 lotes activos/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /mantener los lotes/i }));
    await waitFor(async () => expect((await c.listClients.execute()).find((x) => x.id === 'c1')?.archived).toBe(true));
    const rows = await c.listCatalogFields.execute();
    expect(rows.filter((r) => !r.field.archived && r.field.clientId === undefined).length).toBe(2);
  });

  it('creates a client and shows an error for an empty name', async () => {
    const c = renderAt('/catalogo/clientes/nuevo');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(await screen.findByText(/el nombre no puede estar vacío/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Gómez');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listClients.execute()).some((x) => x.name === 'Gómez')).toBe(true));
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/ui/catalog-abm-clients.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/ui/catalog/use-client-section.ts`:

```ts
import { useMemo } from 'react';
import type { Client } from '@/domain/entities/client';
import type { CatalogSection } from './catalog-section';
import { useCampo } from '@/ui/CampoProvider';

export function useClientSection(): CatalogSection<Client> {
  const { listClients, createClient, editClient, archiveClient, restoreClient, listCatalogFields } = useCampo();
  return useMemo<CatalogSection<Client>>(() => ({
    basePath: '/catalogo/clientes',
    newPath: '/catalogo/clientes/nuevo',
    labels: {
      listTitle: 'Clientes',
      newAction: 'Nuevo cliente',
      formTitleNew: 'Nuevo cliente',
      formTitleEdit: 'Editar cliente',
      backToList: '‹ Clientes',
      emptyMessage: 'No hay clientes.',
      cascadeTitle: (name) => `Archivar ${name}`,
      cascadeMessage: (count) => `Este cliente tiene ${count} lotes activos. ¿Archivar también los lotes?`,
    },
    actions: {
      list: () => listClients.execute(),
      create: (name) => createClient.execute(name),
      rename: (id, name) => editClient.execute(id, name),
      archive: (id, cascade) => archiveClient.execute(id, cascade),
      restore: (id) => restoreClient.execute(id),
      countActiveFields: async (id) =>
        (await listCatalogFields.execute()).filter((r) => !r.field.archived && r.field.clientId === id).length,
    },
  }), [listClients, createClient, editClient, archiveClient, restoreClient, listCatalogFields]);
}
```

`src/ui/screens/ClientsListScreen.tsx`:

```tsx
import { CatalogListScreen } from '@/ui/catalog/CatalogListScreen';
import { useClientSection } from '@/ui/catalog/use-client-section';

export function ClientsListScreen() {
  return <CatalogListScreen useSection={useClientSection} />;
}
```

`src/ui/screens/ClientFormScreen.tsx`:

```tsx
import { CatalogFormScreen } from '@/ui/catalog/CatalogFormScreen';
import { useClientSection } from '@/ui/catalog/use-client-section';

export function ClientFormScreen() {
  return <CatalogFormScreen useSection={useClientSection} />;
}
```

En `src/ui/App.tsx` agregar la lista dentro de `TabsLayout` y los forms fuera:

```tsx
        <Route path="/catalogo/clientes" element={<ClientsListScreen />} />
// ...fuera del layout de tabs:
      <Route path="/catalogo/clientes/nuevo" element={<ClientFormScreen />} />
      <Route path="/catalogo/clientes/:id" element={<ClientFormScreen />} />
```

- [ ] **Step 4: Correr y verlos pasar + typecheck**

Run: `npx vitest run tests/ui/catalog-abm-clients.test.tsx` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/catalog/use-client-section.ts src/ui/screens/ClientsListScreen.tsx src/ui/screens/ClientFormScreen.tsx src/ui/App.tsx tests/ui/catalog-abm-clients.test.tsx
git commit -m "feat(ui): sección Clientes sobre el ABM genérico de catálogo"
```

---

## Task 16: UI — ABM de Lotes (lista + form con pickers de cliente/zona)

**Files:**
- Create: `src/ui/hooks/use-catalog-fields.ts`
- Create: `src/ui/screens/FieldsListScreen.tsx`
- Create: `src/ui/screens/FieldFormScreen.tsx`
- Modify: `src/ui/App.tsx` (rutas `/catalogo/lotes*`)
- Test: `tests/ui/fields-abm.test.tsx`

**Interfaces:**
- Consumes: `listCatalogFields` (también para precargar el form en edición), `createField`, `editField`, `archiveField`, `restoreField`, `listZones`, `listClients`.
- Produces: `useCatalogFields()` → `{ rows, loading, reload, archive, restore }` + selectores de zonas/clientes activos para el form. Rutas `/catalogo/lotes`, `/catalogo/lotes/nuevo`, `/catalogo/lotes/:id`.

- [ ] **Step 1: Escribir los tests que fallan** `tests/ui/fields-abm.test.tsx`

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { FieldsListScreen } from '@/ui/screens/FieldsListScreen';
import { FieldFormScreen } from '@/ui/screens/FieldFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderAt(path: string, container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/catalogo/lotes" element={<FieldsListScreen />} />
          <Route path="/catalogo/lotes/nuevo" element={<FieldFormScreen />} />
          <Route path="/catalogo/lotes/:id" element={<FieldFormScreen />} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('FieldsListScreen', () => {
  it('lists active fields with their client/zone (or "Sin ...")', async () => {
    renderAt('/catalogo/lotes'); // fixture: f1/f2 con c1/z1
    expect(await screen.findByText('Lote El Alto')).toBeInTheDocument();
    expect(screen.getAllByText(/Pérez · Norte/).length).toBeGreaterThan(0);
  });

  it('archives a field', async () => {
    const c = renderAt('/catalogo/lotes');
    await screen.findByText('Lote El Alto');
    await userEvent.click(screen.getByRole('button', { name: /archivar Lote El Alto/i }));
    await waitFor(async () => expect((await c.listCatalogFields.execute()).find((r) => r.field.id === 'f1')?.field.archived).toBe(true));
  });
});

describe('FieldFormScreen', () => {
  it('creates a field with a name and optional zone', async () => {
    const c = renderAt('/catalogo/lotes/nuevo');
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Lote Nuevo');
    await userEvent.selectOptions(screen.getByLabelText(/zona/i), 'z1');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => {
      const rows = await c.listCatalogFields.execute();
      const created = rows.find((r) => r.field.name === 'Lote Nuevo');
      expect(created?.field.zoneId).toBe('z1');
    });
  });

  it('reassigns client to "Sin cliente" when editing', async () => {
    const c = renderAt('/catalogo/lotes/f1'); // f1 tiene c1
    await screen.findByDisplayValue('Lote El Alto');
    await userEvent.selectOptions(screen.getByLabelText(/cliente/i), ''); // opción "Sin cliente"
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listCatalogFields.execute()).find((r) => r.field.id === 'f1')?.field.clientId).toBeUndefined());
  });
});
```

- [ ] **Step 2: Correr y verlos fallar**

Run: `npx vitest run tests/ui/fields-abm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/ui/hooks/use-catalog-fields.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { Zone } from '@/domain/entities/zone';
import type { Client } from '@/domain/entities/client';
import type { FieldId } from '@/domain/shared/ids';
import { useCampo } from '@/ui/CampoProvider';

export function useCatalogFields() {
  const { listCatalogFields, archiveField, restoreField, listZones, listClients } = useCampo();
  const [rows, setRows] = useState<CatalogFieldRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, z, c] = await Promise.all([listCatalogFields.execute(), listZones.execute(), listClients.execute()]);
      setRows(r);
      setZones(z.filter((x) => !x.archived));
      setClients(c.filter((x) => !x.archived));
    } finally {
      setLoading(false);
    }
  }, [listCatalogFields, listZones, listClients]);

  useEffect(() => { void reload(); }, [reload]);

  const archive = useCallback(async (id: FieldId) => { await archiveField.execute(id); await reload(); }, [archiveField, reload]);
  const restore = useCallback(async (id: FieldId) => { await restoreField.execute(id); await reload(); }, [restoreField, reload]);

  return { rows, zones, clients, loading, reload, archive, restore };
}
```

`src/ui/screens/FieldsListScreen.tsx` — lista con toggle ver-archivados (usando `row.field.archived`), subtítulo con `clientLabel`/`zoneLabel`, botón Archivar/Restaurar, y link a editar:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogFields } from '@/ui/hooks/use-catalog-fields';
import { clientLabel, zoneLabel } from '@/ui/labels';

export function FieldsListScreen() {
  const { rows, loading, archive, restore } = useCatalogFields();
  const [showArchived, setShowArchived] = useState(false);
  const visible = rows.filter((r) => r.field.archived === showArchived);

  return (
    <main className="screen">
      <header className="list-header">
        <Link className="back-link" to="/catalogo">‹ Catálogo</Link>
        <h1 className="screen-title">Lotes</h1>
        <Link className="btn-primary" to="/catalogo/lotes/nuevo">Nuevo lote</Link>
      </header>

      <button type="button" className="toggle-archived" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Ver activos' : 'Ver archivados'}
      </button>

      {loading && <p className="hint">Cargando…</p>}
      {!loading && visible.length === 0 && <p className="empty">No hay lotes.</p>}

      <ul className="field-list">
        {visible.map((r) => (
          <li key={r.field.id} className="catalog-row">
            <span className="field-text">
              {showArchived
                ? <span className="field-name">{r.field.name}</span>
                : <Link className="field-name" to={`/catalogo/lotes/${r.field.id}`}>{r.field.name}</Link>}
              <span className="field-sub">{clientLabel(r.clientName)} · {zoneLabel(r.zoneName)}</span>
            </span>
            {showArchived
              ? <button type="button" className="btn-secondary" onClick={() => restore(r.field.id)}>Restaurar</button>
              : <button type="button" className="btn-secondary" aria-label={`Archivar ${r.field.name}`} onClick={() => archive(r.field.id)}>Archivar</button>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

`src/ui/screens/FieldFormScreen.tsx` — nombre + `<select>` de cliente y de zona (con opción vacía "Sin cliente"/"Sin zona"), precarga en edición desde `listCatalogFields`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCatalogFields } from '@/ui/hooks/use-catalog-fields';
import { useCampo } from '@/ui/CampoProvider';
import { catalogErrorMessage } from '@/ui/error-messages';

export function FieldFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { zones, clients } = useCatalogFields();
  const { createField, editField, listCatalogFields } = useCampo();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!id) return;
    void listCatalogFields.execute().then((rows) => {
      const row = rows.find((r) => r.field.id === id);
      if (row) {
        setName(row.field.name);
        setClientId(row.field.clientId ?? '');
        setZoneId(row.field.zoneId ?? '');
      }
    });
  }, [id, listCatalogFields]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const input = { name, clientId: clientId || undefined, zoneId: zoneId || undefined };
    try {
      if (id) await editField.execute({ id, ...input });
      else await createField.execute(input);
      navigate('/catalogo/lotes');
    } catch (err) {
      setError(catalogErrorMessage(err as Error));
    }
  };

  return (
    <main className="screen">
      <button type="button" className="back-link" onClick={() => navigate('/catalogo/lotes')}>‹ Lotes</button>
      <h1 className="screen-title">{id ? 'Editar lote' : 'Nuevo lote'}</h1>
      <form onSubmit={onSubmit} className="catalog-form">
        <label className="form-label">
          Nombre
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="form-label">
          Cliente
          <select className="form-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sin cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="form-label">
          Zona
          <select className="form-input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Sin zona</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn-primary">Guardar</button>
      </form>
    </main>
  );
}
```

En `src/ui/App.tsx` agregar la lista dentro de `TabsLayout` y los forms fuera.

- [ ] **Step 4: Correr toda la suite + typecheck + build**

Run: `npx vitest run` && `npm run typecheck` && `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-catalog-fields.ts src/ui/screens/FieldsListScreen.tsx src/ui/screens/FieldFormScreen.tsx src/ui/App.tsx tests/ui/fields-abm.test.tsx
git commit -m "feat(ui): ABM de Lotes (lista + form con pickers de cliente/zona y reasignación)"
```

---

## Cierre de la etapa (fuera del plan task-by-task)

Al terminar las 16 tareas, con `npm test` + `npm run typecheck` + `npm run build` verdes:

1. Verificación manual en navegador (`npm run dev`): crear zona/cliente/lote, archivar con cascada, restaurar, "Borrar todos los datos", ver "Sin cliente/Sin zona" en Buscar/Agenda.
2. Actualizar `docs/ROADMAP.md`: cerrar 4b (mover al estado ✅, notar 4a pendiente), mover diferidos nuevos a "Decisiones diferidas".
3. Merge de `etapa-4b-abm-catalogo` a `main` (usar `superpowers:finishing-a-development-branch`).
