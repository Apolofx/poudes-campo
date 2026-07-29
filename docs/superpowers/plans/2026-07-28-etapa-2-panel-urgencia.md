# Etapa 2 — Panel de urgencia (Inicio/agenda) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una pantalla Inicio que lista las próximas visitas ordenadas por urgencia (triage por horizonte temporal), con agrupamiento dinámico, y una barra de pestañas Inicio·Buscar.

**Architecture:** Hexagonal. Nuevo VO puro `VisitUrgency` (urgencia absoluta desde `nextVisitDate` + `now`, sin persistir). Nueva query de lectura `findCurrentFollowUps` en `VisitRepository` (ambos adaptadores). Nuevo caso de uso `ListUpcomingVisits` que hace el join y ordena. El seccionado/agrupado vive en la UI (función pura). UI React como adaptador reemplazable.

**Tech Stack:** TypeScript, Vitest, React 18, react-router-dom v6, idb (IndexedDB), lucide-react (íconos, nuevo).

## Global Constraints

- **Ningún dato de dosis/agroquímicos/prescripciones** entra al sistema (entidades, campos, UI o fixtures). Verbatim del AGENTS.
- **Conversación en español; código e identificadores en inglés; texto visible al usuario en español.**
- **Regla de dependencias hexagonal:** todo apunta al dominio; el dominio no conoce infraestructura. Los puertos definen contratos; idb e in-memory los implementan idénticos.
- **`npm test` y `npm run typecheck` deben quedar verdes** antes de cada commit. Los 103 tests existentes siguen verdes salvo los ajustes explícitos por la mudanza de Buscar de `/` a `/buscar` (Task 7).
- **NO tocar** entidades `Visit`/`Reminder`/`Field` ni los casos de uso `RecordVisit`/`SearchFields` ni `field-search`.
- **Umbral del dominio:** `THIS_WEEK_DAYS = 7`. Buckets: `daysUntil < 0` → OVERDUE, `0 ≤ daysUntil ≤ 7` → THIS_WEEK, `> 7` → LATER.
- **Color solo como acento de "vencida"** (usa `--danger`); nunca único portador de significado (la sección y la fecha relativa lo son).

---

### Task 1: VO `VisitUrgency` (dominio, puro)

**Files:**
- Create: `src/domain/value-objects/visit-urgency.ts`
- Test: `tests/domain/value-objects/visit-urgency.test.ts`

**Interfaces:**
- Consumes: `daysBetween` de `@/domain/shared/date-utils` (existente; `daysBetween(from, to)` = días-calendario UTC, negativo si `to < from`).
- Produces: `class VisitUrgency` con `static of(nextVisitDate: Date, now: Date): VisitUrgency`, campos `readonly daysUntil: number` y `readonly bucket: UrgencyBucket`; `type UrgencyBucket = 'OVERDUE' | 'THIS_WEEK' | 'LATER'`; `const THIS_WEEK_DAYS = 7`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/value-objects/visit-urgency.test.ts
import { describe, it, expect } from 'vitest';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';

const now = new Date('2026-07-28T09:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('VisitUrgency', () => {
  it('marks a past date as OVERDUE with negative daysUntil', () => {
    const u = VisitUrgency.of(at('2026-07-23'), now);
    expect(u.daysUntil).toBe(-5);
    expect(u.bucket).toBe('OVERDUE');
  });

  it('marks today as THIS_WEEK with daysUntil 0', () => {
    const u = VisitUrgency.of(at('2026-07-28'), now);
    expect(u.daysUntil).toBe(0);
    expect(u.bucket).toBe('THIS_WEEK');
  });

  it('keeps day 7 in THIS_WEEK (boundary)', () => {
    const u = VisitUrgency.of(at('2026-08-04'), now);
    expect(u.daysUntil).toBe(7);
    expect(u.bucket).toBe('THIS_WEEK');
  });

  it('moves day 8 to LATER (boundary)', () => {
    const u = VisitUrgency.of(at('2026-08-05'), now);
    expect(u.daysUntil).toBe(8);
    expect(u.bucket).toBe('LATER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/value-objects/visit-urgency.test.ts`
Expected: FAIL — cannot find module `visit-urgency`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/value-objects/visit-urgency.ts
import { daysBetween } from '@/domain/shared/date-utils';

export type UrgencyBucket = 'OVERDUE' | 'THIS_WEEK' | 'LATER';

export const THIS_WEEK_DAYS = 7;

export class VisitUrgency {
  private constructor(
    readonly daysUntil: number,
    readonly bucket: UrgencyBucket,
  ) {}

  static of(nextVisitDate: Date, now: Date): VisitUrgency {
    const daysUntil = daysBetween(now, nextVisitDate);
    const bucket: UrgencyBucket =
      daysUntil < 0 ? 'OVERDUE' : daysUntil <= THIS_WEEK_DAYS ? 'THIS_WEEK' : 'LATER';
    return new VisitUrgency(daysUntil, bucket);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/value-objects/visit-urgency.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/value-objects/visit-urgency.ts tests/domain/value-objects/visit-urgency.test.ts
git commit -m "feat(domain): VisitUrgency VO (urgencia absoluta por horizonte)"
```

---

### Task 2: Puerto `findCurrentFollowUps` + adaptador in-memory

**Files:**
- Modify: `src/domain/ports/outbound/visit-repository.ts`
- Modify: `src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts`
- Test: `tests/infrastructure/in-memory-visit-followups.test.ts`

**Interfaces:**
- Produces: `interface CurrentFollowUp { fieldId: FieldId; nextVisitDate: Date }` y método `findCurrentFollowUps(): Promise<CurrentFollowUp[]>` en `VisitRepository`. Semántica: por field, tomar la última visita **ACTIVE** por `createdAt`; si tiene `followUp`, emitir `{ fieldId, nextVisitDate: followUp.nextVisitDate }`; si no, omitir el field. Sin orden garantizado (el caso de uso ordena).

- [ ] **Step 1: Write the failing test**

```ts
// tests/infrastructure/in-memory-visit-followups.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function visit(props: {
  id: string; fieldId: string; createdAt: string;
  next?: string; status?: 'ACTIVE' | 'CANCELLED';
}): Visit {
  return new Visit({
    id: props.id,
    fieldId: props.fieldId,
    visitDate: at(props.createdAt),
    createdAt: at(props.createdAt),
    followUp: props.next
      ? { nextVisitDate: at(props.next), interval: VisitInterval.ofDays(14) }
      : undefined,
    status: props.status ?? 'ACTIVE',
  });
}

describe('InMemoryVisitRepository.findCurrentFollowUps', () => {
  it('returns the follow-up of the latest active visit per field', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-24' }));

    const result = await repo.findCurrentFollowUps();

    expect(result).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-24') }]);
  });

  it('omits a field whose latest active visit has no follow-up', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10' })); // sin próxima

    expect(await repo.findCurrentFollowUps()).toEqual([]);
  });

  it('ignores cancelled visits when choosing the latest', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-30', status: 'CANCELLED' }));

    expect(await repo.findCurrentFollowUps()).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-15') }]);
  });

  it('returns [] when there are no visits', async () => {
    expect(await new InMemoryVisitRepository().findCurrentFollowUps()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/in-memory-visit-followups.test.ts`
Expected: FAIL — `findCurrentFollowUps` is not a function.

- [ ] **Step 3: Add the port method**

En `src/domain/ports/outbound/visit-repository.ts`, agregar el tipo y el método:

```ts
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';

export interface CurrentFollowUp {
  fieldId: FieldId;
  nextVisitDate: Date;
}

export interface VisitRepository {
  save(visit: Visit): Promise<void>;
  findById(id: VisitId): Promise<Visit | null>;
  findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null>;
  listByField(fieldId: FieldId): Promise<Visit[]>;
  findCurrentFollowUps(): Promise<CurrentFollowUp[]>;
}
```

- [ ] **Step 4: Implement in the in-memory adapter**

En `src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts`, actualizar el import de tipos y agregar el método:

```ts
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import type { VisitRepository, CurrentFollowUp } from '@/domain/ports/outbound/visit-repository';
import { isSameCalendarDay } from '@/domain/shared/date-utils';
```

```ts
  async findCurrentFollowUps(): Promise<CurrentFollowUp[]> {
    const latestByField = new Map<FieldId, Visit>();
    for (const visit of this.visits.values()) {
      if (visit.status !== 'ACTIVE') continue;
      const current = latestByField.get(visit.fieldId);
      if (!current || visit.createdAt.getTime() > current.createdAt.getTime()) {
        latestByField.set(visit.fieldId, visit);
      }
    }
    const result: CurrentFollowUp[] = [];
    for (const visit of latestByField.values()) {
      if (visit.followUp) {
        result.push({ fieldId: visit.fieldId, nextVisitDate: visit.followUp.nextVisitDate });
      }
    }
    return result;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/in-memory-visit-followups.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/domain/ports/outbound/visit-repository.ts src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts tests/infrastructure/in-memory-visit-followups.test.ts
git commit -m "feat(persistence): findCurrentFollowUps en el puerto + adaptador in-memory"
```

---

### Task 3: Adaptador idb `findCurrentFollowUps`

**Files:**
- Modify: `src/infrastructure/persistence/idb/idb-visit-repository.ts`
- Test: `tests/infrastructure/idb/idb-visit-followups.test.ts`

**Interfaces:**
- Consumes: `CurrentFollowUp` de `@/domain/ports/outbound/visit-repository`; `VisitRecord` de `./records`; `this.db.getAll('visits')`.
- Produces: misma semántica que Task 2, sobre IndexedDB.

- [ ] **Step 1: Write the failing test**

```ts
// tests/infrastructure/idb/idb-visit-followups.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function visit(props: {
  id: string; fieldId: string; createdAt: string;
  next?: string; status?: 'ACTIVE' | 'CANCELLED';
}): Visit {
  return new Visit({
    id: props.id,
    fieldId: props.fieldId,
    visitDate: at(props.createdAt),
    createdAt: at(props.createdAt),
    followUp: props.next
      ? { nextVisitDate: at(props.next), interval: VisitInterval.ofDays(14) }
      : undefined,
    status: props.status ?? 'ACTIVE',
  });
}

describe('IdbVisitRepository.findCurrentFollowUps', () => {
  it('returns latest active follow-up per field and skips fields closed without a follow-up', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const repo = new IdbVisitRepository(db);
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-24' }));
    await repo.save(visit({ id: 'v3', fieldId: 'f2', createdAt: '2026-07-05', next: '2026-07-20' }));
    await repo.save(visit({ id: 'v4', fieldId: 'f2', createdAt: '2026-07-11' })); // f2 cerrado sin próxima

    const result = await repo.findCurrentFollowUps();

    expect(result).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-24') }]);
    db.close();
  });

  it('ignores cancelled visits', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const repo = new IdbVisitRepository(db);
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-30', status: 'CANCELLED' }));

    expect(await repo.findCurrentFollowUps()).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-15') }]);
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/idb/idb-visit-followups.test.ts`
Expected: FAIL — `findCurrentFollowUps` is not a function.

- [ ] **Step 3: Implement in the idb adapter**

En `src/infrastructure/persistence/idb/idb-visit-repository.ts`, actualizar imports y agregar el método:

```ts
import type { VisitRepository, CurrentFollowUp } from '@/domain/ports/outbound/visit-repository';
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import { isSameCalendarDay } from '@/domain/shared/date-utils';
import type { CampoDb } from './open-campo-db';
import { toVisitRecord, fromVisitRecord, type VisitRecord } from './records';
```

```ts
  async findCurrentFollowUps(): Promise<CurrentFollowUp[]> {
    const records = await this.db.getAll('visits');
    const latestByField = new Map<string, VisitRecord>();
    for (const r of records) {
      if (r.status !== 'ACTIVE') continue;
      const current = latestByField.get(r.fieldId);
      if (!current || r.createdAt.getTime() > current.createdAt.getTime()) {
        latestByField.set(r.fieldId, r);
      }
    }
    const result: CurrentFollowUp[] = [];
    for (const r of latestByField.values()) {
      if (r.followUp) {
        result.push({ fieldId: r.fieldId, nextVisitDate: r.followUp.nextVisitDate });
      }
    }
    return result;
  }
```

(`records.ts` ya exporta `VisitRecord`; solo se agrega a la lista de imports con `type`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/idb/idb-visit-followups.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/infrastructure/persistence/idb/idb-visit-repository.ts tests/infrastructure/idb/idb-visit-followups.test.ts
git commit -m "feat(persistence): findCurrentFollowUps en el adaptador idb"
```

---

### Task 4: Caso de uso `ListUpcomingVisits` + wiring del container

**Files:**
- Create: `src/application/use-cases/list-upcoming-visits.ts`
- Modify: `src/composition/container.ts`
- Modify: `tests/support/in-memory-container.ts`
- Test: `tests/application/list-upcoming-visits.test.ts`

**Interfaces:**
- Consumes: `VisitRepository.findCurrentFollowUps` (Task 2/3), `FieldRepository.listAllWithHierarchy` (existente: `{ field, clientName, zoneName }[]`), `Clock.now`, `VisitUrgency.of` (Task 1).
- Produces: `interface UpcomingVisit { field: Field; clientName: string; zoneName: string; nextVisitDate: Date; urgency: VisitUrgency }` y `class ListUpcomingVisits` con `execute(): Promise<UpcomingVisit[]>` — lista **plana ordenada por `urgency.daysUntil` ascendente** (vencidas primero). `Container` gana `listUpcomingVisits: ListUpcomingVisits`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/application/list-upcoming-visits.test.ts
import { describe, it, expect } from 'vitest';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { FixedClock } from '../support/fixed-clock';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function build() {
  const zones = new Map([['z1', new Zone('z1', 'El Séptimo')], ['z2', new Zone('z2', 'La Costa')]]);
  const clients = new Map([['c1', new Client('c1', 'La Querencia')], ['c2', new Client('c2', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Cañada', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f3', name: 'Potrero 4', clientId: 'c2', zoneId: 'z2' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const save = (id: string, fieldId: string, next?: string) =>
    visits.save(new Visit({
      id, fieldId, visitDate: at('2026-07-10'), createdAt: at('2026-07-10'),
      followUp: next ? { nextVisitDate: at(next), interval: VisitInterval.ofDays(14) } : undefined,
    }));
  return { fields, visits, save };
}

describe('ListUpcomingVisits', () => {
  it('joins hierarchy, computes urgency and sorts by daysUntil ascending', async () => {
    const { fields, visits, save } = build();
    await save('v1', 'f2', '2026-07-30'); // en 2 d
    await save('v2', 'f1', '2026-07-23'); // vencida 5 d
    await save('v3', 'f3', '2026-08-30'); // en 33 d
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1', 'f2', 'f3']);
    expect(result[0].urgency.bucket).toBe('OVERDUE');
    expect(result[0].urgency.daysUntil).toBe(-5);
    expect(result[0].clientName).toBe('La Querencia');
    expect(result[0].zoneName).toBe('El Séptimo');
    expect(result[1].urgency.bucket).toBe('THIS_WEEK');
    expect(result[2].urgency.bucket).toBe('LATER');
  });

  it('excludes fields without a current follow-up', async () => {
    const { fields, visits, save } = build();
    await save('v1', 'f1', '2026-07-30');
    await save('v2', 'f2'); // sin próxima
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1']);
  });

  it('returns [] when there are no upcoming visits', async () => {
    const { fields, visits } = build();
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));
    expect(await uc.execute()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/list-upcoming-visits.test.ts`
Expected: FAIL — cannot find module `list-upcoming-visits`.

- [ ] **Step 3: Implement the use case**

```ts
// src/application/use-cases/list-upcoming-visits.ts
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { Field } from '@/domain/entities/field';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';

export interface UpcomingVisit {
  field: Field;
  clientName: string;
  zoneName: string;
  nextVisitDate: Date;
  urgency: VisitUrgency;
}

export class ListUpcomingVisits {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<UpcomingVisit[]> {
    const [followUps, hierarchy] = await Promise.all([
      this.visits.findCurrentFollowUps(),
      this.fields.listAllWithHierarchy(),
    ]);
    const byId = new Map(hierarchy.map((h) => [h.field.id, h]));
    const now = this.clock.now();

    const items: UpcomingVisit[] = [];
    for (const fu of followUps) {
      const h = byId.get(fu.fieldId);
      if (!h) continue;
      items.push({
        field: h.field,
        clientName: h.clientName,
        zoneName: h.zoneName,
        nextVisitDate: fu.nextVisitDate,
        urgency: VisitUrgency.of(fu.nextVisitDate, now),
      });
    }
    items.sort((a, b) => a.urgency.daysUntil - b.urgency.daysUntil);
    return items;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/application/list-upcoming-visits.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into the container**

En `src/composition/container.ts`:

```ts
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';
import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
  listUpcomingVisits: ListUpcomingVisits;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  const clock = new SystemClock();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, new Uuidv7IdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
  };
}
```

- [ ] **Step 6: Update the in-memory test container**

Reescribir `tests/support/in-memory-container.ts` para compartir repos/clock y exponer `listUpcomingVisits`:

```ts
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
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
  const visits = new InMemoryVisitRepository();
  const clock = new FixedClock(now);
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(
      fields, visits, new InMemoryReminderRepository(), clock, new IncrementingIdGenerator(),
    ),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
  };
}
```

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Si `tests/composition/container.test.ts` afirma la forma exacta del container, agregar la aserción de `listUpcomingVisits` (instancia de `ListUpcomingVisits`). Ningún otro test debería romperse en esta task.

- [ ] **Step 8: Commit**

```bash
git add src/application/use-cases/list-upcoming-visits.ts src/composition/container.ts tests/support/in-memory-container.ts tests/application/list-upcoming-visits.test.ts tests/composition/container.test.ts
git commit -m "feat(application): ListUpcomingVisits + wiring del container"
```

---

### Task 5: Helpers de presentación de la agenda (puros)

**Files:**
- Create: `src/ui/agenda-presentation.ts`
- Test: `tests/ui/agenda-presentation.test.ts`

**Interfaces:**
- Consumes: `UpcomingVisit` de `@/application/use-cases/list-upcoming-visits`; `UrgencyBucket` de `@/domain/value-objects/visit-urgency`.
- Produces:
  - `type GroupBy = 'time' | 'zone' | 'client'`
  - `interface AgendaSection { key: string; label: string; bucket?: UrgencyBucket; items: UpcomingVisit[] }`
  - `groupUpcoming(items: UpcomingVisit[], mode: GroupBy): AgendaSection[]` — en `'time'`: secciones fijas Vencidas/Esta semana/Más adelante (con `bucket`), omitiendo vacías. En `'zone'`/`'client'`: secciones por nombre ordenadas alfabéticamente (locale es), preservando el orden de urgencia dentro de cada una (el input ya viene urgency-sorted), sin `bucket`.
  - `formatRelativeDays(daysUntil: number): string` — `0`→`'hoy'`, `<0`→`'hace N d'`, `>0`→`'en N d'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/agenda-presentation.test.ts
import { describe, it, expect } from 'vitest';
import { groupUpcoming, formatRelativeDays } from '@/ui/agenda-presentation';
import type { UpcomingVisit } from '@/application/use-cases/list-upcoming-visits';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';
import { Field } from '@/domain/entities/field';

const now = new Date('2026-07-28T00:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function item(id: string, next: string, zoneName: string, clientName: string): UpcomingVisit {
  return {
    field: new Field({ id, name: `L-${id}`, clientId: 'c', zoneId: 'z' }),
    clientName, zoneName,
    nextVisitDate: at(next),
    urgency: VisitUrgency.of(at(next), now),
  };
}

// Ya vienen ordenados por urgencia (como los devuelve el caso de uso).
const items = [
  item('a', '2026-07-23', 'La Costa', 'Pérez'),      // OVERDUE
  item('b', '2026-07-30', 'El Séptimo', 'Pérez'),    // THIS_WEEK
  item('c', '2026-08-30', 'La Costa', 'Díaz'),       // LATER
];

describe('groupUpcoming (time)', () => {
  it('bucketea en orden fijo y omite secciones vacías', () => {
    const sections = groupUpcoming([items[0], items[1]], 'time'); // sin LATER
    expect(sections.map((s) => s.bucket)).toEqual(['OVERDUE', 'THIS_WEEK']);
    expect(sections[0].label).toBe('Vencidas');
    expect(sections[0].items.map((i) => i.field.id)).toEqual(['a']);
  });
});

describe('groupUpcoming (zone)', () => {
  it('agrupa por zona alfabéticamente y preserva el orden de urgencia dentro', () => {
    const sections = groupUpcoming(items, 'zone');
    expect(sections.map((s) => s.label)).toEqual(['El Séptimo', 'La Costa']);
    expect(sections[1].bucket).toBeUndefined();
    expect(sections[1].items.map((i) => i.field.id)).toEqual(['a', 'c']); // a (overdue) antes que c
  });
});

describe('formatRelativeDays', () => {
  it('formatea hoy / pasado / futuro', () => {
    expect(formatRelativeDays(0)).toBe('hoy');
    expect(formatRelativeDays(-5)).toBe('hace 5 d');
    expect(formatRelativeDays(2)).toBe('en 2 d');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/agenda-presentation.test.ts`
Expected: FAIL — cannot find module `agenda-presentation`.

- [ ] **Step 3: Implement the helpers**

```ts
// src/ui/agenda-presentation.ts
import type { UpcomingVisit } from '@/application/use-cases/list-upcoming-visits';
import type { UrgencyBucket } from '@/domain/value-objects/visit-urgency';

export type GroupBy = 'time' | 'zone' | 'client';

export interface AgendaSection {
  key: string;
  label: string;
  bucket?: UrgencyBucket;
  items: UpcomingVisit[];
}

const TIME_SECTIONS: { bucket: UrgencyBucket; key: string; label: string }[] = [
  { bucket: 'OVERDUE', key: 'overdue', label: 'Vencidas' },
  { bucket: 'THIS_WEEK', key: 'this-week', label: 'Esta semana' },
  { bucket: 'LATER', key: 'later', label: 'Más adelante' },
];

export function groupUpcoming(items: UpcomingVisit[], mode: GroupBy): AgendaSection[] {
  if (mode === 'time') {
    return TIME_SECTIONS
      .map(({ bucket, key, label }) => ({
        key,
        label,
        bucket,
        items: items.filter((i) => i.urgency.bucket === bucket),
      }))
      .filter((s) => s.items.length > 0);
  }

  const nameOf = (i: UpcomingVisit) => (mode === 'zone' ? i.zoneName : i.clientName);
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
  order.sort((a, b) => a.localeCompare(b, 'es'));
  return order.map((name) => ({ key: `${mode}:${name}`, label: name, items: groups.get(name)! }));
}

export function formatRelativeDays(daysUntil: number): string {
  if (daysUntil === 0) return 'hoy';
  if (daysUntil < 0) return `hace ${Math.abs(daysUntil)} d`;
  return `en ${daysUntil} d`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/agenda-presentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/agenda-presentation.ts tests/ui/agenda-presentation.test.ts
git commit -m "feat(ui): helpers puros de agrupamiento y fecha relativa de la agenda"
```

---

### Task 6: Hook `use-agenda` + pantalla `AgendaScreen`

**Files:**
- Create: `src/ui/hooks/use-agenda.ts`
- Create: `src/ui/screens/AgendaScreen.tsx`
- Test: `tests/ui/agenda-screen.test.tsx`

**Interfaces:**
- Consumes: `useCampo().listUpcomingVisits` (Task 4); `groupUpcoming`, `formatRelativeDays`, `GroupBy` (Task 5).
- Produces: `useAgenda()` → `{ items, loading, error, reload }`; componente `AgendaScreen` que renderiza `<main className="screen agenda">` con `<h1>Próximas visitas</h1>`, un control segmentado `role="group" aria-label="Agrupar por"` (Tiempo/Zona/Cliente), secciones con `<h2>` (título `is-overdue` en Vencidas), filas `<Link to="/field/:id/record">`, colapso de "Más adelante" (solo en modo Tiempo) y estado vacío "No hay visitas agendadas.".

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/agenda-screen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { AgendaScreen } from '@/ui/screens/AgendaScreen';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import type { Container } from '@/composition/container';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function makeContainer(): Promise<Container> {
  const zones = new Map([['z1', new Zone('z1', 'El Séptimo')], ['z2', new Zone('z2', 'La Costa')]]);
  const clients = new Map([['c1', new Client('c1', 'La Querencia')], ['c2', new Client('c2', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Cañada', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f3', name: 'Potrero 4', clientId: 'c2', zoneId: 'z2' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const clock = new FixedClock(at('2026-07-28'));
  const seed = (id: string, fieldId: string, next: string) =>
    visits.save(new Visit({
      id, fieldId, visitDate: at('2026-07-10'), createdAt: at('2026-07-10'),
      followUp: { nextVisitDate: at(next), interval: VisitInterval.ofDays(14) },
    }));
  await seed('v1', 'f1', '2026-07-23'); // vencida 5 d
  await seed('v2', 'f2', '2026-07-30'); // en 2 d
  await seed('v3', 'f3', '2026-08-30'); // en 33 d (LATER)
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, new InMemoryReminderRepository(), clock, new IncrementingIdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
  };
}

async function renderAgenda() {
  const container = await makeContainer();
  render(
    <CampoProvider container={container}>
      <MemoryRouter>
        <AgendaScreen />
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('AgendaScreen', () => {
  it('muestra Vencidas primero con su fecha relativa y linkea a registrar', async () => {
    await renderAgenda();
    const overdue = await screen.findByRole('heading', { name: /Vencidas/ });
    expect(overdue).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /El Alto/ });
    expect(link).toHaveAttribute('href', '/field/f1/record');
    expect(screen.getByText('hace 5 d')).toBeInTheDocument();
    expect(screen.getByText('en 2 d')).toBeInTheDocument();
  });

  it('colapsa "Más adelante" y lo expande al tocarlo', async () => {
    await renderAgenda();
    await screen.findByRole('heading', { name: /Vencidas/ });
    expect(screen.queryByRole('link', { name: /Potrero 4/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ver 1 lote/ }));
    expect(screen.getByRole('link', { name: /Potrero 4/ })).toBeInTheDocument();
  });

  it('reagrupa por zona con el toggle', async () => {
    await renderAgenda();
    await screen.findByRole('heading', { name: /Vencidas/ });
    await userEvent.click(screen.getByLabelText('Zona'));
    expect(await screen.findByRole('heading', { name: /El Séptimo/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /La Costa/ })).toBeInTheDocument();
    // en modo zona no hay colapso: Potrero 4 (La Costa) es visible
    expect(screen.getByRole('link', { name: /Potrero 4/ })).toBeInTheDocument();
  });

  it('muestra estado vacío cuando no hay visitas agendadas', async () => {
    const zones = new Map([['z1', new Zone('z1', 'El Séptimo')]]);
    const clients = new Map([['c1', new Client('c1', 'La Querencia')]]);
    const fields = new InMemoryFieldRepository(zones, clients, [
      new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    ]);
    const visits = new InMemoryVisitRepository();
    const clock = new FixedClock(at('2026-07-28'));
    const container: Container = {
      searchFields: new SearchFields(fields),
      recordVisit: new RecordVisit(fields, visits, new InMemoryReminderRepository(), clock, new IncrementingIdGenerator()),
      listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    };
    render(
      <CampoProvider container={container}>
        <MemoryRouter><AgendaScreen /></MemoryRouter>
      </CampoProvider>,
    );
    expect(await screen.findByText('No hay visitas agendadas.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/agenda-screen.test.tsx`
Expected: FAIL — cannot find module `use-agenda`/`AgendaScreen`.

- [ ] **Step 3: Implement the hook**

```ts
// src/ui/hooks/use-agenda.ts
import { useCallback, useEffect, useState } from 'react';
import type { UpcomingVisit } from '@/application/use-cases/list-upcoming-visits';
import { useCampo } from '@/ui/CampoProvider';

export function useAgenda() {
  const { listUpcomingVisits } = useCampo();
  const [items, setItems] = useState<UpcomingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setItems(await listUpcomingVisits.execute());
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [listUpcomingVisits]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}
```

- [ ] **Step 4: Implement the screen**

```tsx
// src/ui/screens/AgendaScreen.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgenda } from '@/ui/hooks/use-agenda';
import { groupUpcoming, formatRelativeDays, type GroupBy } from '@/ui/agenda-presentation';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'time', label: 'Tiempo' },
  { value: 'zone', label: 'Zona' },
  { value: 'client', label: 'Cliente' },
];

export function AgendaScreen() {
  const { items, loading } = useAgenda();
  const [groupBy, setGroupBy] = useState<GroupBy>('time');
  const [showLater, setShowLater] = useState(false);

  const sections = groupUpcoming(items, groupBy);

  return (
    <main className="screen agenda">
      <header className="agenda-header">
        <h1 className="screen-title">Próximas visitas</h1>
        <div className="segmented" role="group" aria-label="Agrupar por">
          {GROUP_OPTIONS.map((opt) => (
            <label className="segment" key={opt.value}>
              <input
                type="radio"
                name="group-by"
                checked={groupBy === opt.value}
                onChange={() => setGroupBy(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </header>

      {loading && <p className="hint">Cargando…</p>}
      {!loading && items.length === 0 && <p className="empty">No hay visitas agendadas.</p>}

      {sections.map((section) => {
        const collapsed = section.bucket === 'LATER' && !showLater;
        return (
          <section className="agenda-section" key={section.key}>
            <h2 className={`agenda-section-title${section.bucket === 'OVERDUE' ? ' is-overdue' : ''}`}>
              {section.label} · {section.items.length}
            </h2>
            {collapsed ? (
              <button className="agenda-more" type="button" onClick={() => setShowLater(true)}>
                Ver {section.items.length} lote{section.items.length === 1 ? '' : 's'}
              </button>
            ) : (
              <ul className="agenda-list">
                {section.items.map((item) => (
                  <li key={item.field.id}>
                    <Link
                      className={`agenda-row${item.urgency.bucket === 'OVERDUE' ? ' is-overdue' : ''}`}
                      to={`/field/${item.field.id}/record`}
                    >
                      <span className="agenda-row-text">
                        <span className="agenda-row-name">{item.field.name}</span>
                        <span className="agenda-row-sub">{item.clientName} · {item.zoneName}</span>
                      </span>
                      <span className="agenda-row-when">{formatRelativeDays(item.urgency.daysUntil)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/agenda-screen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/ui/hooks/use-agenda.ts src/ui/screens/AgendaScreen.tsx tests/ui/agenda-screen.test.tsx
git commit -m "feat(ui): pantalla Inicio (agenda) con triage por horizonte y toggle de agrupamiento"
```

---

### Task 7: Shell — TabBar, routing, back-link, ícono lucide, ajuste de tests

**Files:**
- Create: `src/ui/components/TabBar.tsx`
- Create: `tests/ui/tab-bar.test.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/screens/RecordVisitScreen.tsx` (back-link `/` → `/buscar`)
- Modify: `src/ui/screens/SearchScreen.tsx` (SVG a mano → ícono lucide)
- Modify: `tests/ui/integration.test.tsx` (arranca en `/buscar`; tras registrar aterriza en Inicio)
- Modify: `tests/ui/record-visit-screen.test.tsx` (el back-link ahora apunta a `/buscar`)
- Modify: `package.json` (dependencia `lucide-react`)

**Interfaces:**
- Consumes: `AgendaScreen` (Task 6), `SearchScreen`, `RecordVisitScreen` existentes; `NavLink`, `Outlet`, `Routes`, `Route` de react-router-dom; íconos `Home`, `Search` de `lucide-react`.
- Produces: `TabBar` (nav con `NavLink` a `/` "Inicio" y `/buscar` "Buscar"); routing `/`→Inicio, `/buscar`→Buscar (ambas bajo un layout con TabBar), `/field/:fieldId/record`→Registrar (sin TabBar).

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`
Expected: se agrega a `dependencies` en `package.json`.

- [ ] **Step 2: Write the failing TabBar test**

```tsx
// tests/ui/tab-bar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabBar } from '@/ui/components/TabBar';

describe('TabBar', () => {
  it('renders Inicio and Buscar links to the right routes', () => {
    render(<MemoryRouter initialEntries={['/']}><TabBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Buscar/ })).toHaveAttribute('href', '/buscar');
  });

  it('marks the active route with aria-current', () => {
    render(<MemoryRouter initialEntries={['/buscar']}><TabBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Buscar/ })).toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/ui/tab-bar.test.tsx`
Expected: FAIL — cannot find module `TabBar`.

- [ ] **Step 4: Implement TabBar**

```tsx
// src/ui/components/TabBar.tsx
import { NavLink } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

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
    </nav>
  );
}
```

(`NavLink` agrega `aria-current="page"` y la clase `active` en la ruta activa automáticamente.)

- [ ] **Step 5: Run TabBar test to verify it passes**

Run: `npx vitest run tests/ui/tab-bar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Rewire the router**

```tsx
// src/ui/App.tsx
import { Routes, Route, Outlet } from 'react-router-dom';
import { AgendaScreen } from '@/ui/screens/AgendaScreen';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { TabBar } from '@/ui/components/TabBar';

function TabsLayout() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<TabsLayout />}>
        <Route path="/" element={<AgendaScreen />} />
        <Route path="/buscar" element={<SearchScreen />} />
      </Route>
      <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Point the record-visit back link to Buscar**

En `src/ui/screens/RecordVisitScreen.tsx`, cambiar solo el destino del back-link (el `navigate('/')` post-submit se mantiene: tras registrar se aterriza en Inicio):

```tsx
      <Link className="back-link" to="/buscar">‹ Buscar lote</Link>
```

- [ ] **Step 8: Swap the search SVG for a lucide icon**

En `src/ui/screens/SearchScreen.tsx`, reemplazar el bloque `<svg className="search-icon">…</svg>` por el ícono de lucide (agregar el import):

```tsx
import { Search } from 'lucide-react';
```

```tsx
          <Search className="search-icon" size={18} aria-hidden="true" />
```

- [ ] **Step 9: Update the integration test for the new routing**

En `tests/ui/integration.test.tsx`: arrancar en `/buscar` y, tras registrar, esperar la pantalla Inicio (el flujo usa "Sin próxima", así que Inicio queda vacío):

```tsx
    render(
      <CampoProvider container={container}>
        <MemoryRouter initialEntries={['/buscar']}>
          <App />
        </MemoryRouter>
      </CampoProvider>,
    );

    // Buscar y abrir el primer lote sembrado.
    const link = await screen.findByRole('link', { name: /^El Alto(?!\s*2)/ });
    await userEvent.click(link);

    // Registrar sin próxima visita.
    await screen.findByRole('heading', { name: 'Registrar visita' });
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    // Aterriza en Inicio y la visita quedó persistida.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Próximas visitas' })).toBeInTheDocument());
    await waitFor(async () => expect(await db.count('visits')).toBe(1));
    db.close();
```

- [ ] **Step 10: Update the back-link assertion**

En `tests/ui/record-visit-screen.test.tsx`, el test "renders a back link to the search list" afirma el href viejo. Actualizarlo:

```tsx
  it('renders a back link to the search list', async () => {
    renderScreen();
    const back = await screen.findByRole('link', { name: /Buscar lote/ });
    expect(back).toHaveAttribute('href', '/buscar');
  });
```

- [ ] **Step 11: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Los demás tests de `record-visit-screen.test.tsx` stubbean `path="/"` y hacen submit (que sigue navegando a `/`), así que quedan verdes; los que renderizan `SearchScreen`/`RecordVisitScreen` directos no dependen del router de `App`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(ui): tab bar Inicio·Buscar, routing nuevo, ícono lucide y ajuste de tests"
```

---

### Task 8: Estilos + verificación visual final

**Files:**
- Modify: `src/ui/styles.css`

**Interfaces:**
- Consumes: tokens existentes en `:root` (`--bg`, `--surface`, `--ink`, `--muted`, `--accent`, `--divider`, `--header-border`, `--danger`, `--danger-bg`, `--touch`, espaciados, radios). Reutiliza `.segmented`/`.segment`, `.hint`, `.empty` ya definidos (la agenda no los redefine).
- Produces: estilos para `.app-shell`, `.app-content`, `.tab-bar`, `.tab`, `.tab-icon` y el bloque `.agenda-*`. El nombre de lote usa `--ink` (contraste pleno — corrige el reparo de contraste del brainstorming).

- [ ] **Step 1: Append the styles**

Agregar al final de `src/ui/styles.css`:

```css
/* ---- shell con tab bar ---- */
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.app-content { flex: 1; padding-bottom: calc(var(--touch) + 12px); }

.tab-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  background: var(--surface);
  border-top: 1px solid var(--header-border);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0 10px;
  min-height: var(--touch);
  text-decoration: none;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.tab.active,
.tab[aria-current="page"] { color: var(--accent); }

.tab-icon { display: block; }

/* ---- Inicio / agenda ---- */
.agenda-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg);
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--header-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.agenda-section { margin: 0; padding: 0; }

.agenda-section-title {
  margin: 0;
  padding: var(--space-3) var(--space-4) var(--space-1);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.agenda-section-title.is-overdue { color: var(--danger); }

.agenda-list { list-style: none; margin: 0; padding: 0; }

.agenda-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--divider);
  text-decoration: none;
  color: inherit;
}

.agenda-row:active { background: var(--divider); }
.agenda-row.is-overdue { background: var(--danger-bg); }

.agenda-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.agenda-row-name { font-weight: 700; font-size: 15px; color: var(--ink); }
.agenda-row-sub { font-size: 12.5px; color: var(--muted); }
.agenda-row-when { font-size: 12.5px; font-weight: 700; color: var(--muted); flex: none; }
.agenda-row.is-overdue .agenda-row-when { color: var(--danger); }

.agenda-more {
  display: block;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  min-height: var(--touch);
}
```

- [ ] **Step 2: Full suite + typecheck (guard)**

Run: `npm test && npm run typecheck`
Expected: PASS (estilos no se testean unitariamente; esto confirma que no se rompió nada).

- [ ] **Step 3: Visual verification**

Run: `npm run build` y luego `npm run dev`. Abrir la app:
- Inicio arranca **vacío** ("No hay visitas agendadas.") porque el fixture sembrado no tiene visitas — es lo esperado.
- Ir a Buscar (tab), abrir un lote, registrar con "En N días" (ej. 3) → volver: Inicio ahora muestra el lote en "Esta semana" con "en 3 d". Registrar otro con 30 días → aparece en "Más adelante" colapsado.
- Verificar contraste del nombre de lote (pleno), del acento rojo de vencidas y del tab activo.

Sacar screenshot de Inicio con datos para confirmar el look.

- [ ] **Step 4: Commit**

```bash
git add src/ui/styles.css
git commit -m "style(ui): estilos de la pantalla Inicio y la tab bar"
```

---

## Cierre de la etapa (fuera de las tasks, con `finishing-a-development-branch`)

- Actualizar `docs/ROADMAP.md`: marcar Etapa 2 completa, reflejar los dos reencuadres (agrupamiento dinámico / urgencia absoluta), y anotar deuda nueva si surgió (ej. orden de grupos zona/cliente alfabético; posible "ordenar grupos por urgencia" a futuro).
- Merge de `etapa-2-panel-urgencia` a `main`.

## Notas de cobertura del spec

- Triage por horizonte (Vencidas/Esta semana/Más adelante colapsado) → Task 5 (`groupUpcoming` time) + Task 6 (colapso).
- Urgencia absoluta, umbral 7, VO sin `interval` → Task 1.
- Fuente "próxima visita" = última activa con followUp → Tasks 2/3.
- Join + orden por urgencia, agrupar en UI → Task 4 (caso de uso plano) + Task 5 (agrupar).
- Fila (nombre + cliente·zona + fecha relativa), color acento de vencida → Task 6 + Task 8.
- Toggle Tiempo/Zona/Cliente → Task 5 (modos) + Task 6 (control).
- Tab bar Inicio·Buscar, Buscar de `/` a `/buscar`, lucide-react → Task 7.
- Borde "solo lotes con próxima visita" → Tasks 2/3 (semántica) + Task 4 (excluye sin followUp) + Task 6 (estado vacío).
- 103 tests verdes salvo ajustes de routing → Task 7 (integration) + guardas en Tasks 4/7/8.
