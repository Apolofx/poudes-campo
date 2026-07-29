# Etapa 4a — Cancelar / editar visitas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir corregir una visita ya registrada — editar (notas/fecha/follow-up) y cancelar (baja lógica auditable) — a través de un historial por lote con detalle.

**Architecture:** Hexagonal. Se agrega `cancelledAt` a la entidad `Visit` (inmutable, se reconstruye), dos casos de uso de escritura (`CancelVisit`, `EditVisit`) y dos de lectura (`GetFieldHistory`, `GetVisit`) sobre los puertos existentes (sin cambios de puerto). La UI agrega dos pantallas (historial + detalle/edición) reusando el formulario de `RecordVisitScreen` y el `ConfirmDialog`. La resolución de follow-up se extrae a un helper compartido por `RecordVisit` y `EditVisit`.

**Tech Stack:** TypeScript, Vitest (+ @testing-library/react, jsdom), React + React Router, idb (IndexedDB). Alias de imports: `@/…` → `src/…`.

## Global Constraints

- **Regla dura:** ningún dato de dosis/agroquímicos/prescripciones. 4a no agrega campos de visita salvo `cancelledAt`.
- **Conversación en español, código e identificadores en inglés.** Texto visible al usuario (UI) en español.
- **Núcleo puro:** tocar `src/domain/**` y `src/application/**` es la intención explícita de esta etapa (regla 2 de AGENTS).
- **TDD estricto:** test que falla → verlo fallar → implementación mínima → verde → commit. Un commit por tarea como mínimo.
- **Comandos:** `npm test` (Vitest, toda la suite), `npm run typecheck` (`tsc --noEmit`), test puntual `npx vitest run <ruta>`. Ambos deben quedar verdes antes de cerrar cada tarea.
- **Invariante que se preserva:** solo la última visita ACTIVE de un field (máximo `createdAt`, con o sin follow-up) tiene un reminder PENDING.
- **Anclaje:** el follow-up se ancla a `clock.now()` (momento de editar), no a la fecha retroactiva de la visita.

---

### Task 1: Dominio — `Visit.cancelledAt` + errores nuevos

**Files:**
- Modify: `src/domain/entities/visit.ts`
- Modify: `src/domain/shared/errors.ts`
- Test: `tests/domain/entities/visit.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `VisitProps.cancelledAt?: Date` y `Visit.cancelledAt?: Date` (readonly). Errores `VisitNotFound`, `VisitAlreadyCancelled` (subclases de `DomainError`).

- [ ] **Step 1: Escribir el test que falla**

En `tests/domain/entities/visit.test.ts`, agregar dentro del `describe('Visit', …)`:

```ts
  it('defaults cancelledAt to undefined', () => {
    expect(new Visit({ ...base }).cancelledAt).toBeUndefined();
  });
  it('stores an optional cancelledAt', () => {
    const at = new Date('2026-07-28T09:00:00Z');
    const v = new Visit({ ...base, status: 'CANCELLED', cancelledAt: at });
    expect(v.status).toBe('CANCELLED');
    expect(v.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/domain/entities/visit.test.ts`
Expected: FAIL — `cancelledAt` no existe en `VisitProps`/`Visit` (error de tipo/propiedad `undefined`).

- [ ] **Step 3: Implementación mínima**

En `src/domain/entities/visit.ts`, agregar a `VisitProps` y a la clase:

```ts
export interface VisitProps {
  id: VisitId;
  fieldId: FieldId;
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: FollowUp;
  status?: VisitStatus;
  cancelledAt?: Date;
}
```

```ts
  readonly cancelledAt?: Date;
```

y en el constructor, después de asignar `status`:

```ts
    this.cancelledAt = props.cancelledAt;
```

En `src/domain/shared/errors.ts`, agregar al final:

```ts
export class VisitNotFound extends DomainError {}
export class VisitAlreadyCancelled extends DomainError {}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/domain/entities/visit.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/visit.ts src/domain/shared/errors.ts tests/domain/entities/visit.test.ts
git commit -m "feat(domain): Visit.cancelledAt + errores VisitNotFound/VisitAlreadyCancelled"
```

---

### Task 2: Persistencia idb — mapear `cancelledAt` en `VisitRecord`

**Files:**
- Modify: `src/infrastructure/persistence/idb/records.ts:33-41` (`VisitRecord`), `:97-123` (`toVisitRecord`/`fromVisitRecord`)
- Test: `tests/infrastructure/idb/records-visit.test.ts` (crear)

**Interfaces:**
- Consumes: `Visit.cancelledAt` (Task 1).
- Produces: `VisitRecord.cancelledAt?: Date`; round-trip `toVisitRecord`/`fromVisitRecord` conserva `status` y `cancelledAt`.

No requiere bump de versión del esquema idb: es un campo opcional nuevo en el store `visits`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/infrastructure/idb/records-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toVisitRecord, fromVisitRecord } from '@/infrastructure/persistence/idb/records';
import { Visit } from '@/domain/entities/visit';

describe('VisitRecord mapping', () => {
  it('round-trips a cancelled visit preserving status and cancelledAt', () => {
    const visit = new Visit({
      id: 'v1',
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      createdAt: new Date('2026-07-27T10:00:00Z'),
      status: 'CANCELLED',
      cancelledAt: new Date('2026-07-28T09:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('CANCELLED');
    expect(back.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });

  it('round-trips an active visit with cancelledAt undefined', () => {
    const visit = new Visit({
      id: 'v2',
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      createdAt: new Date('2026-07-27T10:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('ACTIVE');
    expect(back.cancelledAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/infrastructure/idb/records-visit.test.ts`
Expected: FAIL — `back.cancelledAt` es `undefined` en el primer caso (no se mapea).

- [ ] **Step 3: Implementación mínima**

En `src/infrastructure/persistence/idb/records.ts`, agregar a `VisitRecord`:

```ts
  status: VisitStatus;
  cancelledAt?: Date;
```

En `toVisitRecord`, agregar tras `status: v.status,`:

```ts
    cancelledAt: v.cancelledAt,
```

En `fromVisitRecord`, dentro del `new Visit({ … })`, agregar tras `status: r.status,`:

```ts
    cancelledAt: r.cancelledAt,
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/infrastructure/idb/records-visit.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: verde (los tests idb existentes siguen pasando).

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/idb/records.ts tests/infrastructure/idb/records-visit.test.ts
git commit -m "feat(idb): persistir Visit.cancelledAt en VisitRecord"
```

---

### Task 3: Helper de follow-up compartido + refactor de `RecordVisit`

**Files:**
- Create: `src/application/use-cases/follow-up.ts`
- Modify: `src/application/use-cases/record-visit.ts`
- Test: `tests/application/follow-up.test.ts` (crear)

**Interfaces:**
- Consumes: `VisitInterval` (`@/domain/value-objects/visit-interval`), `addDays`, `daysBetween` (`@/domain/shared/date-utils`), `FollowUp` (`@/domain/entities/visit`).
- Produces:
  - `type FollowUpInput = { kind: 'interval'; days: number; reminderLeadDays?: number } | { kind: 'date'; date: Date; reminderLeadDays?: number } | { kind: 'none' }`
  - `resolveFollowUp(input: FollowUpInput, now: Date): FollowUp | undefined`
  - `clampLeadDays(requested: number, intervalDays: number): number` — clamp a `[0, intervalDays]`.
  - `remindAtFor(followUp: FollowUp, requestedLeadDays: number): Date` — `addDays(nextVisitDate, -clampLeadDays(requested, interval.days))`.

`record-visit.ts` re-exporta `FollowUpInput` para no romper imports existentes (`RecordVisitScreen`, harness).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/application/follow-up.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveFollowUp, clampLeadDays, remindAtFor } from '@/application/use-cases/follow-up';

const now = new Date('2026-07-27T10:00:00Z');

describe('resolveFollowUp', () => {
  it('anchors an interval follow-up to now', () => {
    const fu = resolveFollowUp({ kind: 'interval', days: 7 }, now);
    expect(fu?.interval.days).toBe(7);
    expect(fu?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });
  it('uses an explicit date and derives the interval from now', () => {
    const fu = resolveFollowUp({ kind: 'date', date: new Date('2026-08-10T10:00:00Z') }, now);
    expect(fu?.nextVisitDate.toISOString()).toBe('2026-08-10T10:00:00.000Z');
    expect(fu?.interval.days).toBe(14);
  });
  it('returns undefined for kind none', () => {
    expect(resolveFollowUp({ kind: 'none' }, now)).toBeUndefined();
  });
});

describe('clampLeadDays', () => {
  it('clamps negative to 0 and excess to the interval', () => {
    expect(clampLeadDays(-3, 10)).toBe(0);
    expect(clampLeadDays(30, 10)).toBe(10);
    expect(clampLeadDays(3, 10)).toBe(3);
  });
});

describe('remindAtFor', () => {
  it('subtracts the clamped lead from nextVisitDate', () => {
    const fu = resolveFollowUp({ kind: 'interval', days: 7 }, now)!;
    expect(remindAtFor(fu, 3).toISOString()).toBe('2026-07-31T10:00:00.000Z');
    expect(remindAtFor(fu, 30).toISOString()).toBe('2026-07-27T10:00:00.000Z'); // clamp a 7
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/follow-up.test.ts`
Expected: FAIL — módulo `follow-up` no existe.

- [ ] **Step 3: Implementación mínima**

Crear `src/application/use-cases/follow-up.ts`:

```ts
import type { FollowUp } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { addDays, daysBetween } from '@/domain/shared/date-utils';

export type FollowUpInput =
  | { kind: 'interval'; days: number; reminderLeadDays?: number }
  | { kind: 'date'; date: Date; reminderLeadDays?: number }
  | { kind: 'none' };

export function resolveFollowUp(input: FollowUpInput, now: Date): FollowUp | undefined {
  if (input.kind === 'interval') {
    return { nextVisitDate: addDays(now, input.days), interval: VisitInterval.ofDays(input.days) };
  }
  if (input.kind === 'date') {
    return { nextVisitDate: input.date, interval: VisitInterval.ofDays(daysBetween(now, input.date)) };
  }
  return undefined;
}

export function clampLeadDays(requested: number, intervalDays: number): number {
  return Math.min(Math.max(requested, 0), intervalDays);
}

export function remindAtFor(followUp: FollowUp, requestedLeadDays: number): Date {
  return addDays(followUp.nextVisitDate, -clampLeadDays(requestedLeadDays, followUp.interval.days));
}
```

- [ ] **Step 4: Refactor de `RecordVisit` para usar el helper**

En `src/application/use-cases/record-visit.ts`:
- Reemplazar la definición local de `FollowUpInput` por un re-export:
  ```ts
  import { resolveFollowUp, remindAtFor, type FollowUpInput } from '@/application/use-cases/follow-up';
  export type { FollowUpInput };
  ```
- Borrar el método privado `resolveFollowUp` y sus imports ahora sin uso (`VisitInterval`, `daysBetween`; conservar `addDays` solo si queda algún uso — tras el refactor **no** queda, quitarlo).
- En `execute`, reemplazar `const followUp = this.resolveFollowUp(input.followUp, now);` por `const followUp = resolveFollowUp(input.followUp, now);`.
- Reemplazar el bloque que calcula `requestedLead`/`leadDays`/`remindAt` por:
  ```ts
    const requestedLead = input.followUp.kind === 'none' ? 0 : input.followUp.reminderLeadDays ?? 0;
    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: visit.id,
      fieldId: input.fieldId,
      remindAt: remindAtFor(followUp, requestedLead),
    });
  ```

- [ ] **Step 5: Correr los tests y verlos pasar**

Run: `npx vitest run tests/application/follow-up.test.ts tests/application/record-visit.happy.test.ts tests/application/record-visit.rules.test.ts && npm run typecheck`
Expected: PASS en todo (el comportamiento de `RecordVisit` no cambia).

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/follow-up.ts src/application/use-cases/record-visit.ts tests/application/follow-up.test.ts
git commit -m "refactor(app): extraer resolveFollowUp/remindAtFor a helper compartido"
```

---

### Task 4: Caso de uso — `CancelVisit`

**Files:**
- Create: `src/application/use-cases/cancel-visit.ts`
- Create: `tests/support/edit-cancel-harness.ts`
- Test: `tests/application/cancel-visit.test.ts`

**Interfaces:**
- Consumes: `VisitRepository`, `ReminderRepository`, `Clock` (puertos existentes); `VisitNotFound` (Task 1).
- Produces:
  - `class CancelVisit { constructor(visits: VisitRepository, reminders: ReminderRepository, clock: Clock); execute(input: { visitId: VisitId }): Promise<void> }`
  - `tests/support/edit-cancel-harness.ts` exportando `makeEditCancelHarness(now?: Date)` → `{ cancel: CancelVisit, edit: EditVisit, visits, reminders, fields, clock, ids }` (la parte `edit` se agrega en Task 5; en Task 4 puede construirse solo `cancel` y agregar `edit` luego).

- [ ] **Step 1: Escribir el harness compartido**

Crear `tests/support/edit-cancel-harness.ts` (en Task 4 solo `CancelVisit`; Task 5 agrega `EditVisit`):

```ts
import { CancelVisit } from '@/application/use-cases/cancel-visit';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';

export function makeEditCancelHarness(now = new Date('2026-07-27T10:00:00Z')) {
  const zones = new Map([['z1', new Zone('z1', 'Quiroga')]]);
  const clients = new Map([['c1', new Client('c1', 'Martinez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const clock = new FixedClock(now);
  const ids = new IncrementingIdGenerator('id');
  const cancel = new CancelVisit(visits, reminders, clock);
  return { cancel, visits, reminders, fields, clock, ids };
}
```

- [ ] **Step 2: Escribir el test que falla**

Crear `tests/application/cancel-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeEditCancelHarness } from '../support/edit-cancel-harness';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { VisitNotFound } from '@/domain/shared/errors';

function seedVisitWithReminder(h: ReturnType<typeof makeEditCancelHarness>) {
  const visit = new Visit({
    id: 'v1', fieldId: 'f1',
    visitDate: new Date('2026-07-27T10:00:00Z'),
    createdAt: new Date('2026-07-27T10:00:00Z'),
    followUp: { nextVisitDate: new Date('2026-08-03T10:00:00Z'), interval: VisitInterval.ofDays(7) },
  });
  const reminder = new Reminder({ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-08-03T10:00:00Z') });
  return { visit, reminder };
}

describe('CancelVisit', () => {
  it('marks the visit CANCELLED and sets cancelledAt to now', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-28T09:00:00Z'));
    const { visit } = seedVisitWithReminder(h);
    await h.visits.save(visit);
    await h.cancel.execute({ visitId: 'v1' });
    const saved = await h.visits.findById('v1');
    expect(saved?.status).toBe('CANCELLED');
    expect(saved?.cancelledAt?.toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });

  it("cancels the visit's own pending reminder", async () => {
    const h = makeEditCancelHarness();
    const { visit, reminder } = seedVisitWithReminder(h);
    await h.visits.save(visit);
    await h.reminders.save(reminder);
    await h.cancel.execute({ visitId: 'v1' });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('is idempotent — cancelling twice does not throw', async () => {
    const h = makeEditCancelHarness();
    const { visit } = seedVisitWithReminder(h);
    await h.visits.save(visit);
    await h.cancel.execute({ visitId: 'v1' });
    await expect(h.cancel.execute({ visitId: 'v1' })).resolves.toBeUndefined();
    expect((await h.visits.findById('v1'))?.status).toBe('CANCELLED');
  });

  it('throws VisitNotFound for an unknown id', async () => {
    const h = makeEditCancelHarness();
    await expect(h.cancel.execute({ visitId: 'nope' })).rejects.toBeInstanceOf(VisitNotFound);
  });
});
```

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/cancel-visit.test.ts`
Expected: FAIL — `cancel-visit` no existe.

- [ ] **Step 4: Implementación mínima**

Crear `src/application/use-cases/cancel-visit.ts`:

```ts
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { VisitId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { VisitNotFound } from '@/domain/shared/errors';

export interface CancelVisitInput {
  visitId: VisitId;
}

export class CancelVisit {
  constructor(
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelVisitInput): Promise<void> {
    const visit = await this.visits.findById(input.visitId);
    if (!visit) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (visit.status === 'CANCELLED') return;

    await this.visits.save(
      new Visit({
        id: visit.id,
        fieldId: visit.fieldId,
        visitDate: visit.visitDate,
        createdAt: visit.createdAt,
        notes: visit.notes,
        followUp: visit.followUp,
        status: 'CANCELLED',
        cancelledAt: this.clock.now(),
      }),
    );

    const pending = await this.reminders.findPendingByField(visit.fieldId);
    for (const reminder of pending) {
      if (reminder.visitId !== visit.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }
  }
}
```

- [ ] **Step 5: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/cancel-visit.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/cancel-visit.ts tests/support/edit-cancel-harness.ts tests/application/cancel-visit.test.ts
git commit -m "feat(app): CancelVisit — baja lógica auditable + cancela su reminder"
```

---

### Task 5: Caso de uso — `EditVisit`

**Files:**
- Create: `src/application/use-cases/edit-visit.ts`
- Modify: `tests/support/edit-cancel-harness.ts` (agregar `EditVisit` al harness)
- Test: `tests/application/edit-visit.test.ts`

**Interfaces:**
- Consumes: `VisitRepository`, `ReminderRepository`, `Clock`, `IdGenerator`; `resolveFollowUp`, `remindAtFor`, `FollowUpInput` (Task 3); errores `VisitNotFound`, `VisitAlreadyCancelled`, `FutureVisitDate`, `DuplicateVisitForDay`.
- Produces:
  - `class EditVisit { constructor(visits, reminders, clock, ids); execute(input: EditVisitInput): Promise<void> }`
  - `interface EditVisitInput { visitId: VisitId; visitDate: Date; notes?: string; followUp: FollowUpInput }`

- [ ] **Step 1: Agregar `EditVisit` al harness**

En `tests/support/edit-cancel-harness.ts`: importar `EditVisit`, construirlo y devolverlo:

```ts
import { EditVisit } from '@/application/use-cases/edit-visit';
// … dentro de makeEditCancelHarness, tras crear `cancel`:
  const edit = new EditVisit(visits, reminders, clock, ids);
  return { cancel, edit, visits, reminders, fields, clock, ids };
```

- [ ] **Step 2: Escribir el test que falla**

Crear `tests/application/edit-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeEditCancelHarness } from '../support/edit-cancel-harness';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { VisitNotFound, VisitAlreadyCancelled, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';

const D = (iso: string) => new Date(iso);

function activeVisit(id: string, createdAtIso: string, opts: { followUp?: boolean } = {}) {
  return new Visit({
    id, fieldId: 'f1',
    visitDate: D(createdAtIso),
    createdAt: D(createdAtIso),
    notes: 'orig',
    followUp: opts.followUp
      ? { nextVisitDate: D('2026-08-03T10:00:00Z'), interval: VisitInterval.ofDays(7) }
      : undefined,
  });
}

describe('EditVisit', () => {
  it('edits notes in place', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z'));
    await h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T10:00:00Z'), notes: 'corregido', followUp: { kind: 'none' } });
    expect((await h.visits.findById('v1'))?.notes).toBe('corregido');
  });

  it('rejects a future visit date', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-30T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(FutureVisitDate);
  });

  it('allows keeping the same day (excludes self from the duplicate guard)', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T08:00:00Z'), notes: 'x', followUp: { kind: 'none' } }),
    ).resolves.toBeUndefined();
  });

  it('rejects a day already taken by another active visit', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(activeVisit('v1', '2026-07-25T10:00:00Z'));
    await h.visits.save(activeVisit('v2', '2026-07-27T10:00:00Z'));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T09:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(DuplicateVisitForDay);
  });

  it('recomputes the reminder from now when it is the latest visit', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('v1', '2026-07-27T10:00:00Z', { followUp: true }));
    await h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T10:00:00Z'), followUp: { kind: 'interval', days: 10, reminderLeadDays: 2 } });
    const saved = await h.visits.findById('v1');
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-06T10:00:00.000Z'); // now + 10
    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].visitId).toBe('v1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-04T10:00:00.000Z'); // due - 2
  });

  it('does not create a reminder when editing a non-latest visit', async () => {
    const h = makeEditCancelHarness(new Date('2026-07-27T10:00:00Z'));
    await h.visits.save(activeVisit('vOld', '2026-07-20T10:00:00Z'));
    await h.visits.save(activeVisit('vNew', '2026-07-25T10:00:00Z'));
    await h.edit.execute({ visitId: 'vOld', visitDate: D('2026-07-20T10:00:00Z'), followUp: { kind: 'interval', days: 5 } });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('rejects editing a cancelled visit', async () => {
    const h = makeEditCancelHarness();
    await h.visits.save(new Visit({
      id: 'v1', fieldId: 'f1', visitDate: D('2026-07-27T10:00:00Z'), createdAt: D('2026-07-27T10:00:00Z'),
      status: 'CANCELLED', cancelledAt: D('2026-07-28T09:00:00Z'),
    }));
    await expect(
      h.edit.execute({ visitId: 'v1', visitDate: D('2026-07-27T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(VisitAlreadyCancelled);
  });

  it('throws VisitNotFound for an unknown id', async () => {
    const h = makeEditCancelHarness();
    await expect(
      h.edit.execute({ visitId: 'nope', visitDate: D('2026-07-27T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toBeInstanceOf(VisitNotFound);
  });
});
```

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/edit-visit.test.ts`
Expected: FAIL — `edit-visit` no existe.

- [ ] **Step 4: Implementación mínima**

Crear `src/application/use-cases/edit-visit.ts`:

```ts
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { VisitId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { resolveFollowUp, remindAtFor, type FollowUpInput } from '@/application/use-cases/follow-up';
import { VisitNotFound, VisitAlreadyCancelled, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';

export interface EditVisitInput {
  visitId: VisitId;
  visitDate: Date;
  notes?: string;
  followUp: FollowUpInput;
}

export class EditVisit {
  constructor(
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditVisitInput): Promise<void> {
    const now = this.clock.now();

    const existing = await this.visits.findById(input.visitId);
    if (!existing) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (existing.status === 'CANCELLED') throw new VisitAlreadyCancelled(`visit ${input.visitId} is cancelled`);

    if (input.visitDate.getTime() > now.getTime()) {
      throw new FutureVisitDate('visit date cannot be in the future');
    }

    const clash = await this.visits.findActiveByFieldOnDay(existing.fieldId, input.visitDate);
    if (clash && clash.id !== existing.id) {
      throw new DuplicateVisitForDay(`field ${existing.fieldId} already has a visit that day`);
    }

    const followUp = resolveFollowUp(input.followUp, now);

    await this.visits.save(
      new Visit({
        id: existing.id,
        fieldId: existing.fieldId,
        visitDate: input.visitDate,
        createdAt: existing.createdAt,
        notes: input.notes,
        followUp,
        status: 'ACTIVE',
      }),
    );

    // Cancelar el reminder PENDING propio (si lo hubiera).
    const pending = await this.reminders.findPendingByField(existing.fieldId);
    for (const reminder of pending) {
      if (reminder.visitId !== existing.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    if (!followUp) return;
    if (!(await this.isLatestActive(existing.fieldId, existing.id))) return;

    const requestedLead = input.followUp.kind === 'none' ? 0 : input.followUp.reminderLeadDays ?? 0;
    await this.reminders.save(
      new Reminder({
        id: this.ids.next(),
        visitId: existing.id,
        fieldId: existing.fieldId,
        remindAt: remindAtFor(followUp, requestedLead),
      }),
    );
  }

  private async isLatestActive(fieldId: string, visitId: VisitId): Promise<boolean> {
    const all = await this.visits.listByField(fieldId);
    let latest: { id: VisitId; createdAt: Date } | undefined;
    for (const v of all) {
      if (v.status !== 'ACTIVE') continue;
      if (!latest || v.createdAt.getTime() > latest.createdAt.getTime()) {
        latest = { id: v.id, createdAt: v.createdAt };
      }
    }
    return latest?.id === visitId;
  }
}
```

- [ ] **Step 5: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/edit-visit.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/edit-visit.ts tests/support/edit-cancel-harness.ts tests/application/edit-visit.test.ts
git commit -m "feat(app): EditVisit — corrige notas/fecha/follow-up manteniendo el invariante de reminder"
```

---

### Task 6: Casos de uso de lectura — `GetFieldHistory` + `GetVisit`

**Files:**
- Create: `src/application/use-cases/get-field-history.ts`
- Create: `src/application/use-cases/get-visit.ts`
- Test: `tests/application/get-field-history.test.ts`

**Interfaces:**
- Consumes: `FieldRepository` (`listAllWithHierarchy`, `findById`), `VisitRepository` (`listByField`, `findById`).
- Produces:
  - `interface FieldHistoryView { field: Field; clientName?: string; zoneName?: string; visits: Visit[] }` — `visits` ordenadas más nueva primero (por `visitDate` desc; desempate `createdAt` desc).
  - `class GetFieldHistory { constructor(fields, visits); execute(fieldId: FieldId): Promise<FieldHistoryView | null> }` (null si el field no existe).
  - `class GetVisit { constructor(visits); execute(visitId: VisitId): Promise<Visit | null> }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/application/get-field-history.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GetFieldHistory } from '@/application/use-cases/get-field-history';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';

function setup() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  return { uc: new GetFieldHistory(fields, visits), visits };
}

const D = (iso: string) => new Date(iso);
const visitOn = (id: string, iso: string) =>
  new Visit({ id, fieldId: 'f1', visitDate: D(iso), createdAt: D(iso) });

describe('GetFieldHistory', () => {
  it('resolves the field label and returns visits newest-first', async () => {
    const { uc, visits } = setup();
    await visits.save(visitOn('v1', '2026-07-20T10:00:00Z'));
    await visits.save(visitOn('v2', '2026-07-27T10:00:00Z'));
    const view = await uc.execute('f1');
    expect(view?.field.name).toBe('El Alto');
    expect(view?.clientName).toBe('Pérez');
    expect(view?.zoneName).toBe('Norte');
    expect(view?.visits.map((v) => v.id)).toEqual(['v2', 'v1']);
  });

  it('includes cancelled visits in the history', async () => {
    const { uc, visits } = setup();
    await visits.save(new Visit({ id: 'v1', fieldId: 'f1', visitDate: D('2026-07-20T10:00:00Z'), createdAt: D('2026-07-20T10:00:00Z'), status: 'CANCELLED', cancelledAt: D('2026-07-21T10:00:00Z') }));
    const view = await uc.execute('f1');
    expect(view?.visits).toHaveLength(1);
    expect(view?.visits[0].status).toBe('CANCELLED');
  });

  it('returns null for an unknown field', async () => {
    const { uc } = setup();
    expect(await uc.execute('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/get-field-history.test.ts`
Expected: FAIL — `get-field-history` no existe.

- [ ] **Step 3: Implementación mínima**

Crear `src/application/use-cases/get-field-history.ts`:

```ts
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { FieldId } from '@/domain/shared/ids';
import type { Field } from '@/domain/entities/field';
import type { Visit } from '@/domain/entities/visit';

export interface FieldHistoryView {
  field: Field;
  clientName?: string;
  zoneName?: string;
  visits: Visit[];
}

export class GetFieldHistory {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
  ) {}

  async execute(fieldId: FieldId): Promise<FieldHistoryView | null> {
    const rows = await this.fields.listAllWithHierarchy();
    const row = rows.find((r) => r.field.id === fieldId);

    let field = row?.field ?? null;
    if (!field) field = await this.fields.findById(fieldId);
    if (!field) return null;

    const visits = [...(await this.visits.listByField(fieldId))].sort((a, b) => {
      const byDate = b.visitDate.getTime() - a.visitDate.getTime();
      return byDate !== 0 ? byDate : b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { field, clientName: row?.clientName, zoneName: row?.zoneName, visits };
  }
}
```

Crear `src/application/use-cases/get-visit.ts`:

```ts
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Visit } from '@/domain/entities/visit';
import type { VisitId } from '@/domain/shared/ids';

export class GetVisit {
  constructor(private readonly visits: VisitRepository) {}

  execute(visitId: VisitId): Promise<Visit | null> {
    return this.visits.findById(visitId);
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/get-field-history.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/get-field-history.ts src/application/use-cases/get-visit.ts tests/application/get-field-history.test.ts
git commit -m "feat(app): GetFieldHistory + GetVisit (lectura para el historial y el detalle)"
```

---

### Task 7: Cablear el `Container` (real + in-memory)

**Files:**
- Modify: `src/composition/container.ts`
- Modify: `tests/support/in-memory-container.ts`
- Test: `tests/support/in-memory-container.test.ts` (crear)

**Interfaces:**
- Consumes: `CancelVisit`, `EditVisit`, `GetFieldHistory`, `GetVisit` (Tasks 4–6).
- Produces: `Container` con cuatro campos nuevos: `cancelVisit: CancelVisit`, `editVisit: EditVisit`, `getFieldHistory: GetFieldHistory`, `getVisit: GetVisit`. Ambos builders (`buildContainer`, `makeInMemoryContainer`) los proveen con las mismas dependencias que ya construyen (`visits`, `reminders`, `fields`, `clock`, `ids`).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/support/in-memory-container.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeInMemoryContainer } from './in-memory-container';

describe('in-memory container — etapa 4a wiring', () => {
  it('records a visit then cancels it through the container', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const { visitId } = await c.recordVisit.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 7 },
    });
    await c.cancelVisit.execute({ visitId });
    const view = await c.getFieldHistory.execute('f1');
    expect(view?.visits[0].status).toBe('CANCELLED');
    const visit = await c.getVisit.execute(visitId);
    expect(visit?.status).toBe('CANCELLED');
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/support/in-memory-container.test.ts`
Expected: FAIL — `cancelVisit`/`getFieldHistory`/`getVisit` no existen en `Container`.

- [ ] **Step 3: Implementación — `container.ts`**

En `src/composition/container.ts`:
- Imports:
  ```ts
  import { CancelVisit } from '@/application/use-cases/cancel-visit';
  import { EditVisit } from '@/application/use-cases/edit-visit';
  import { GetFieldHistory } from '@/application/use-cases/get-field-history';
  import { GetVisit } from '@/application/use-cases/get-visit';
  ```
- En `interface Container`, tras `recordVisit: RecordVisit;`:
  ```ts
  cancelVisit: CancelVisit;
  editVisit: EditVisit;
  getFieldHistory: GetFieldHistory;
  getVisit: GetVisit;
  ```
- En `buildContainer`, dentro del objeto devuelto, tras `recordVisit: …`:
  ```ts
  cancelVisit: new CancelVisit(visits, reminders, clock),
  editVisit: new EditVisit(visits, reminders, clock, ids),
  getFieldHistory: new GetFieldHistory(fields, visits),
  getVisit: new GetVisit(visits),
  ```

- [ ] **Step 4: Implementación — `in-memory-container.ts`**

En `tests/support/in-memory-container.ts`:
- Imports:
  ```ts
  import { CancelVisit } from '@/application/use-cases/cancel-visit';
  import { EditVisit } from '@/application/use-cases/edit-visit';
  import { GetFieldHistory } from '@/application/use-cases/get-field-history';
  import { GetVisit } from '@/application/use-cases/get-visit';
  ```
- En el objeto devuelto por `makeInMemoryContainer`, tras `recordVisit: …`:
  ```ts
  cancelVisit: new CancelVisit(visits, reminders, clock),
  editVisit: new EditVisit(visits, reminders, clock, ids),
  getFieldHistory: new GetFieldHistory(fields, visits),
  getVisit: new GetVisit(visits),
  ```

- [ ] **Step 5: Correr el test + suite completa + typecheck**

Run: `npx vitest run tests/support/in-memory-container.test.ts && npm test && npm run typecheck`
Expected: PASS (todos los consumidores de `Container` compilan).

- [ ] **Step 6: Commit**

```bash
git add src/composition/container.ts tests/support/in-memory-container.ts tests/support/in-memory-container.test.ts
git commit -m "feat(composition): cablear CancelVisit/EditVisit/GetFieldHistory/GetVisit"
```

---

### Task 8: UI — Historial del lote (`FieldHistoryScreen`) + navegación desde Buscar

**Files:**
- Create: `src/ui/hooks/use-field-history.ts`
- Create: `src/ui/screens/FieldHistoryScreen.tsx`
- Modify: `src/ui/App.tsx` (agregar ruta)
- Modify: `src/ui/screens/SearchScreen.tsx:44` (link `→ /field/:id/visitas`)
- Test: `tests/ui/field-history-screen.test.tsx`, `tests/ui/search-screen.test.tsx` (agregar/ajustar el caso de navegación)

**Interfaces:**
- Consumes: `getFieldHistory` del `Container`; `FieldHistoryView` (Task 6); `clientLabel`/`zoneLabel` (`@/ui/labels`).
- Produces:
  - `useFieldHistory(fieldId): { view: FieldHistoryView | null; loading: boolean; reload: () => void }`.
  - Ruta `GET /field/:fieldId/visitas` → `FieldHistoryScreen`.
  - Filas de visita como `Link` a `/field/:fieldId/visitas/:visitId`; badge con texto `Activa` / `Cancelada`.

- [ ] **Step 1: Escribir el hook (sin test propio; se cubre vía pantalla)**

Crear `src/ui/hooks/use-field-history.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { FieldHistoryView } from '@/application/use-cases/get-field-history';
import { useCampo } from '@/ui/CampoProvider';

export function useFieldHistory(fieldId: string) {
  const { getFieldHistory } = useCampo();
  const [view, setView] = useState<FieldHistoryView | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    getFieldHistory.execute(fieldId).then((v) => {
      setView(v);
      setLoading(false);
    });
  }, [getFieldHistory, fieldId]);

  useEffect(() => { reload(); }, [reload]);

  return { view, loading, reload };
}
```

- [ ] **Step 2: Escribir el test de pantalla que falla**

Crear `tests/ui/field-history-screen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { FieldHistoryScreen } from '@/ui/screens/FieldHistoryScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';
import type { Container } from '@/composition/container';

async function seed(c: Container) {
  await c.recordVisit.execute({ fieldId: 'f1', visitDate: new Date('2026-07-20T10:00:00Z'), notes: 'primera', followUp: { kind: 'none' } });
  const r = await c.recordVisit.execute({ fieldId: 'f1', visitDate: new Date('2026-07-25T10:00:00Z'), notes: 'segunda', followUp: { kind: 'none' } });
  await c.cancelVisit.execute({ visitId: r.visitId });
}

function renderScreen(c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'))) {
  return render(
    <CampoProvider container={c}>
      <MemoryRouter initialEntries={['/field/f1/visitas']}>
        <Routes>
          <Route path="/field/:fieldId/visitas" element={<FieldHistoryScreen />} />
          <Route path="/field/:fieldId/visitas/:visitId" element={<div>Detalle</div>} />
          <Route path="/field/:fieldId/record" element={<div>Registrar</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('FieldHistoryScreen', () => {
  it('lists visits newest-first with a status badge', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    await seed(c);
    renderScreen(c);
    const rows = await screen.findAllByRole('link', { name: /jul/i });
    // la segunda (25 jul, cancelada) va primero
    expect(rows[0]).toHaveTextContent(/segunda/);
    expect(rows[0]).toHaveTextContent(/Cancelada/);
    expect(rows[1]).toHaveTextContent(/Activa/);
  });

  it('shows an empty state when the field has no visits', async () => {
    renderScreen();
    expect(await screen.findByText(/no tiene visitas/i)).toBeInTheDocument();
  });

  it('links to the record screen', async () => {
    renderScreen();
    const link = await screen.findByRole('link', { name: /Registrar visita/i });
    expect(link).toHaveAttribute('href', '/field/f1/record');
  });
});
```

> Nota: `toHaveTextContent` es el matcher de jest-dom (ya configurado en el setup de tests del repo, igual que en `record-visit-screen.test.tsx`).

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npx vitest run tests/ui/field-history-screen.test.tsx`
Expected: FAIL — `FieldHistoryScreen` no existe.

- [ ] **Step 4: Implementar la pantalla**

Crear `src/ui/screens/FieldHistoryScreen.tsx`:

```tsx
import { Link, useParams } from 'react-router-dom';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { clientLabel, zoneLabel } from '@/ui/labels';

function dateLabel(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function FieldHistoryScreen() {
  const { fieldId = '' } = useParams();
  const { view, loading } = useFieldHistory(fieldId);

  if (loading) return <main className="screen"><p className="hint">Cargando…</p></main>;
  if (!view) return <main className="screen"><p className="empty">No se encontró el lote.</p></main>;

  return (
    <main className="screen">
      <Link className="back-link" to="/buscar">‹ Buscar lote</Link>
      <h1 className="screen-title">{view.field.name}</h1>
      <p className="field-sub">{clientLabel(view.clientName)} · {zoneLabel(view.zoneName)}</p>

      <Link className="btn-primary" to={`/field/${fieldId}/record`}>Registrar visita</Link>

      {view.visits.length === 0 ? (
        <p className="empty">Este lote no tiene visitas registradas.</p>
      ) : (
        <ul className="field-list">
          {view.visits.map((v) => (
            <li key={v.id}>
              <Link className="field-row" to={`/field/${fieldId}/visitas/${v.id}`}>
                <span className="field-text">
                  <span className="field-name">{dateLabel(v.visitDate)}</span>
                  <span className="field-sub">{v.notes ?? 'Sin notas'}</span>
                </span>
                <span className={`visit-badge ${v.status === 'CANCELLED' ? 'is-cancelled' : 'is-active'}`}>
                  {v.status === 'CANCELLED' ? 'Cancelada' : 'Activa'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

Agregar estilos mínimos en `src/ui/styles.css` (badge):

```css
.visit-badge { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; align-self: center; }
.visit-badge.is-active { background: var(--campo-green-soft, #e6f2e6); color: var(--campo-green, #2e6b2e); }
.visit-badge.is-cancelled { background: #eee; color: #777; text-decoration: line-through; }
```

- [ ] **Step 5: Agregar la ruta en `App.tsx`**

En `src/ui/App.tsx`, junto a la ruta de `record` (fuera del layout con tab bar, como `/field/:fieldId/record`):

```tsx
import { FieldHistoryScreen } from '@/ui/screens/FieldHistoryScreen';
// …
<Route path="/field/:fieldId/visitas" element={<FieldHistoryScreen />} />
```

- [ ] **Step 6: Cambiar el link de `SearchScreen`**

En `src/ui/screens/SearchScreen.tsx`, cambiar `to={`/field/${r.field.id}/record`}` por `to={`/field/${r.field.id}/visitas`}`.

- [ ] **Step 7: Ajustar el test de `SearchScreen`**

En `tests/ui/search-screen.test.tsx`, el caso que verifica el destino de la fila debe esperar `/field/f1/visitas` (antes `/record`). Si no existe tal aserción, agregar:

```tsx
  it('links each field row to its history', async () => {
    // …render SearchScreen…
    const row = await screen.findByRole('link', { name: /El Alto/ });
    expect(row).toHaveAttribute('href', '/field/f1/visitas');
  });
```

(Verificar el nombre exacto del lote del fixture del test — `Lote El Alto` en `makeInMemoryContainer`.)

- [ ] **Step 8: Correr los tests y verlos pasar**

Run: `npx vitest run tests/ui/field-history-screen.test.tsx tests/ui/search-screen.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/hooks/use-field-history.ts src/ui/screens/FieldHistoryScreen.tsx src/ui/App.tsx src/ui/screens/SearchScreen.tsx src/ui/styles.css tests/ui/field-history-screen.test.tsx tests/ui/search-screen.test.tsx
git commit -m "feat(ui): Historial del lote + Buscar navega al historial"
```

---

### Task 9: UI — Detalle / edición de visita (`VisitDetailScreen`)

**Files:**
- Create: `src/ui/hooks/use-edit-visit.ts`, `src/ui/hooks/use-cancel-visit.ts`
- Create: `src/ui/screens/VisitDetailScreen.tsx`
- Modify: `src/ui/App.tsx` (ruta), `src/ui/error-messages.ts` (mensajes nuevos)
- Test: `tests/ui/visit-detail-screen.test.tsx`

**Interfaces:**
- Consumes: `editVisit`, `cancelVisit`, `getVisit` del `Container`; `FollowUpInput` (`@/application/use-cases/follow-up`); `ConfirmDialog`; `domainErrorMessage`.
- Produces:
  - `useEditVisit()` → `{ submit(input: EditVisitInput), submitting, error, done }` (patrón `useRecordVisit`).
  - `useCancelVisit()` → `{ cancel(visitId: string), cancelling, error, done }`.
  - Ruta `GET /field/:fieldId/visitas/:visitId` → `VisitDetailScreen`.

- [ ] **Step 1: Escribir los hooks**

Crear `src/ui/hooks/use-edit-visit.ts`:

```ts
import { useCallback, useState } from 'react';
import type { EditVisitInput } from '@/application/use-cases/edit-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useEditVisit() {
  const { editVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (input: EditVisitInput) => {
      setSubmitting(true);
      setError(undefined);
      try {
        await editVisit.execute(input);
        setDone(true);
      } catch (e) {
        setError(e as Error);
      } finally {
        setSubmitting(false);
      }
    },
    [editVisit],
  );

  return { submit, submitting, error, done };
}
```

Crear `src/ui/hooks/use-cancel-visit.ts`:

```ts
import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useCancelVisit() {
  const { cancelVisit } = useCampo();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [done, setDone] = useState(false);

  const cancel = useCallback(
    async (visitId: string) => {
      setCancelling(true);
      setError(undefined);
      try {
        await cancelVisit.execute({ visitId });
        setDone(true);
      } catch (e) {
        setError(e as Error);
      } finally {
        setCancelling(false);
      }
    },
    [cancelVisit],
  );

  return { cancel, cancelling, error, done };
}
```

- [ ] **Step 2: Escribir el test de pantalla que falla**

Crear `tests/ui/visit-detail-screen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { VisitDetailScreen } from '@/ui/screens/VisitDetailScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';
import type { Container } from '@/composition/container';

async function seedActive(c: Container): Promise<string> {
  const r = await c.recordVisit.execute({ fieldId: 'f1', visitDate: new Date('2026-07-25T10:00:00Z'), notes: 'orig', followUp: { kind: 'none' } });
  return r.visitId;
}

function renderAt(c: Container, visitId: string) {
  return render(
    <CampoProvider container={c}>
      <MemoryRouter initialEntries={[`/field/f1/visitas/${visitId}`]}>
        <Routes>
          <Route path="/field/:fieldId/visitas/:visitId" element={<VisitDetailScreen />} />
          <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('VisitDetailScreen', () => {
  it('prefills the form with the visit notes', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    const notes = (await screen.findByLabelText('Notas')) as HTMLTextAreaElement;
    expect(notes.value).toBe('orig');
  });

  it('saves an edit and navigates back to the history', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    const notes = await screen.findByLabelText('Notas');
    await userEvent.clear(notes);
    await userEvent.type(notes, 'corregido');
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
    expect((await c.getVisit.execute(id))?.notes).toBe('corregido');
  });

  it('cancels the visit after confirming and navigates back', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    await userEvent.click(await screen.findByRole('button', { name: /Cancelar visita/ }));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
    expect((await c.getVisit.execute(id))?.status).toBe('CANCELLED');
  });

  it('shows a cancelled visit read-only', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    await c.cancelVisit.execute({ visitId: id });
    renderAt(c, id);
    expect(await screen.findByText(/Cancelada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npx vitest run tests/ui/visit-detail-screen.test.tsx`
Expected: FAIL — `VisitDetailScreen` no existe.

- [ ] **Step 4: Implementar la pantalla**

Crear `src/ui/screens/VisitDetailScreen.tsx` (reusa la estructura del form de `RecordVisitScreen`, prellenando desde `getVisit`):

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { FollowUpInput } from '@/application/use-cases/follow-up';
import type { Visit } from '@/domain/entities/visit';
import { useCampo } from '@/ui/CampoProvider';
import { useEditVisit } from '@/ui/hooks/use-edit-visit';
import { useCancelVisit } from '@/ui/hooks/use-cancel-visit';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { domainErrorMessage } from '@/ui/error-messages';

type FollowUpKind = 'interval' | 'date' | 'none';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function futureIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function VisitDetailScreen() {
  const { fieldId = '', visitId = '' } = useParams();
  const navigate = useNavigate();
  const { getVisit } = useCampo();
  const edit = useEditVisit();
  const cancelHook = useCancelVisit();

  const [visit, setVisit] = useState<Visit | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  const [notes, setNotes] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('none');
  const [intervalDays, setIntervalDays] = useState(14);
  const [nextDate, setNextDate] = useState(futureIso(14));
  const [leadDays, setLeadDays] = useState(3);

  useEffect(() => {
    getVisit.execute(visitId).then((v) => {
      setVisit(v);
      if (v) {
        setNotes(v.notes ?? '');
        setVisitDate(isoDay(v.visitDate));
        if (v.followUp) {
          setKind('date');
          setNextDate(isoDay(v.followUp.nextVisitDate));
        }
      }
    });
  }, [getVisit, visitId]);

  const back = `/field/${fieldId}/visitas`;
  useEffect(() => { if (edit.done || cancelHook.done) navigate(back); }, [edit.done, cancelHook.done, navigate, back]);

  if (visit === undefined) return <main className="screen"><p className="hint">Cargando…</p></main>;
  if (visit === null) return <main className="screen"><p className="empty">No se encontró la visita.</p></main>;

  if (visit.status === 'CANCELLED') {
    return (
      <main className="screen record">
        <Link className="back-link" to={back}>‹ Historial</Link>
        <h1 className="screen-title">Visita del {isoDay(visit.visitDate)}</h1>
        <p className="visit-badge is-cancelled">Cancelada</p>
        {visit.notes && <p className="field-sub">{visit.notes}</p>}
      </main>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeInterval = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 14;
    const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0;
    let followUp: FollowUpInput;
    if (kind === 'interval') followUp = { kind: 'interval', days: safeInterval, reminderLeadDays: safeLead };
    else if (kind === 'date') followUp = { kind: 'date', date: utcDate(nextDate), reminderLeadDays: safeLead };
    else followUp = { kind: 'none' };
    edit.submit({ visitId, visitDate: utcDate(visitDate), notes: notes.trim() === '' ? undefined : notes, followUp });
  };

  return (
    <main className="screen record">
      <Link className="back-link" to={back}>‹ Historial</Link>
      <h1 className="screen-title">Editar visita</h1>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input className="control" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Notas</span>
          <textarea className="control textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <fieldset className="field fieldset">
          <legend className="field-label">Próxima visita</legend>
          <div className="segmented">
            <label className="segment"><input type="radio" name="kind" checked={kind === 'interval'} onChange={() => setKind('interval')} /><span>En N días</span></label>
            <label className="segment"><input type="radio" name="kind" checked={kind === 'date'} onChange={() => setKind('date')} /><span>En una fecha</span></label>
            <label className="segment"><input type="radio" name="kind" checked={kind === 'none'} onChange={() => setKind('none')} /><span>Sin próxima</span></label>
          </div>
          <div className="conditional-row">
            {kind === 'interval' && (
              <label className="field"><span className="field-label">Días</span>
                <input className="control" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} /></label>
            )}
            {kind === 'date' && (
              <label className="field"><span className="field-label">Fecha próxima</span>
                <input className="control" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></label>
            )}
            {kind !== 'none' && (
              <label className="field"><span className="field-label">Avisar días antes</span>
                <input className="control" type="number" min="0" value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} /></label>
            )}
          </div>
        </fieldset>
        {(edit.error || cancelHook.error) && (
          <p className="alert" role="alert">{domainErrorMessage((edit.error ?? cancelHook.error)!)}</p>
        )}
        <button className="btn-primary" type="submit" disabled={edit.submitting}>Guardar</button>
      </form>
      <button type="button" className="btn-danger" onClick={() => setConfirming(true)} disabled={cancelHook.cancelling}>
        Cancelar visita
      </button>
      <ConfirmDialog
        open={confirming}
        title="Cancelar visita"
        message="La visita quedará cancelada y no volverá a aparecer como activa. ¿Confirmás?"
        confirmLabel="Confirmar"
        cancelLabel="Volver"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); cancelHook.cancel(visitId); }}
      />
    </main>
  );
}
```

> Nota de diseño: al prellenar el follow-up existente se usa `kind: 'date'` con la `nextVisitDate` guardada (representación absoluta fiel). "En N días" queda como opción para recalcular desde hoy, coherente con la decisión de anclaje.

- [ ] **Step 5: Mensajes de error en español**

En `src/ui/error-messages.ts`, agregar dentro del `switch` de `domainErrorMessage`:

```ts
    case 'VisitNotFound':
      return 'No se encontró la visita.';
    case 'VisitAlreadyCancelled':
      return 'La visita ya fue cancelada.';
```

- [ ] **Step 6: Agregar la ruta en `App.tsx`**

```tsx
import { VisitDetailScreen } from '@/ui/screens/VisitDetailScreen';
// …
<Route path="/field/:fieldId/visitas/:visitId" element={<VisitDetailScreen />} />
```

- [ ] **Step 7: Correr los tests y verlos pasar**

Run: `npx vitest run tests/ui/visit-detail-screen.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Suite completa + commit**

Run: `npm test && npm run typecheck`
Expected: verde toda la suite.

```bash
git add src/ui/hooks/use-edit-visit.ts src/ui/hooks/use-cancel-visit.ts src/ui/screens/VisitDetailScreen.tsx src/ui/App.tsx src/ui/error-messages.ts tests/ui/visit-detail-screen.test.tsx
git commit -m "feat(ui): detalle de visita con editar y cancelar"
```

---

### Task 10: Cierre — ROADMAP + verificación final

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Verificación completa**

Run: `npm test && npm run typecheck && npm run build`
Expected: suite verde, sin errores de tipos, build de producción OK (PWA).

- [ ] **Step 2: Actualizar el ROADMAP**

En `docs/ROADMAP.md`:
- Tabla de etapas: marcar **4a** como ✅ Completa (con el conteo de tests final).
- Sección "✅ Se puede hacer hoy": agregar historial por lote + editar/cancelar visitas; ajustar "❌ Todavía no se puede" (quitar cancelar/editar).
- Sección "Decisiones diferidas": agregar los diferidos nuevos de 4a (historial pre-edición; motivo de cancelación; revivir aviso al cancelar; editar visita no-última no toca reminders; índices idb por `visitId`/`status`).
- Actualizar "Última actualización".

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(etapa-4a): cerrar Etapa 4a en el ROADMAP"
```

- [ ] **Step 4: Merge de la rama**

Seguir `superpowers:finishing-a-development-branch` (verificar limpio + merge a `main`).

---

## Self-Review (checklist del autor)

**Cobertura del spec:**
- §1 Modelo (`cancelledAt` + errores) → Task 1. ✅
- §2 Puertos (sin cambios) → nada que hacer. ✅
- §3 `CancelVisit` → Task 4; `EditVisit` → Task 5; helper compartido → Task 3. ✅
- §4 UI (historial + detalle, cambio de nav) → Tasks 8–9. ✅
- §5 Tests → distribuidos en cada task. ✅
- §6 Diferidos → Task 10 (ROADMAP). ✅
- §7 Invariantes → cubiertos por tests de `EditVisit`/`CancelVisit` (Tasks 4–5). ✅
- Persistencia idb de `cancelledAt` (implícita en §1/§4) → Task 2. ✅
- Cableado del container (implícito) → Task 7. ✅

**Consistencia de tipos:** `FollowUpInput` se centraliza en `follow-up.ts` y se re-exporta desde `record-visit.ts` (Task 3); `EditVisitInput`/`CancelVisitInput` consistentes entre use case, container y hooks. `getFieldHistory.execute` devuelve `FieldHistoryView | null`, consumido igual en el hook. `getVisit.execute` → `Visit | null`. Nombres de campos del container (`cancelVisit`, `editVisit`, `getFieldHistory`, `getVisit`) idénticos en interfaz, ambos builders y hooks.

**Placeholders:** ninguno — todo el código a tipear está en los steps. (Ojo al tipear el test de Task 8: usar `toHaveTextContent` de jest-dom, no variantes.)
