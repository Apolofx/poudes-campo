# Etapa 3 — Aviso al abrir · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al abrir la app, un dispatch idempotente detecta los reminders cuyo `remindAt` ya pasó, los marca `SENT`, y los muestra en un banner resumen agrupado por zona en Inicio; además se cierra la deuda de validación de `reminderLeadDays`.

**Architecture:** Hexagonal. Se agrega la transición de dominio `Reminder.markSent()`, un método de lectura `ReminderRepository.findDue(now)`, un puerto nuevo `ReminderNotifier` (con DTO `DueReminder` y un adaptador in-app que la UI lee), y el caso de uso `DispatchDueReminders`. El dispatch corre una vez en `main.tsx` (antes del render), poblando el notifier in-app que el banner de Inicio lee.

**Tech Stack:** TypeScript, Vitest, `@testing-library/react`, `fake-indexeddb`, React 18, `idb`, react-router-dom 6.

## Global Constraints

- Ningún dato de dosis / agroquímicos / prescripciones entra jamás al sistema (entidades, campos, UI, fixtures).
- No tocar `src/domain/**` ni `src/application/**` salvo intención explícita. Esta etapa **sí** toca `src/domain/entities/reminder.ts`, los puertos `src/domain/ports/outbound/*`, y `src/application/use-cases/{record-visit,dispatch-due-reminders}.ts` — es la intención explícita del spec aprobado.
- Conversación en español, código e identificadores en inglés. Texto visible al usuario (UI) en español.
- Regla de dependencias: todo apunta al dominio; el dominio no conoce infraestructura.
- IDs vía puerto `IdGenerator`; tiempo vía puerto `Clock` (`FixedClock` en tests).
- `npm test` y `npm run typecheck` deben quedar verdes antes de cada commit.
- Alias de import: `@/` → `src/`.
- Esquema idb permanece en **versión 1** (sin bump, sin migración) durante toda la etapa.

---

### Task 1: Transición de dominio `Reminder.markSent()`

**Files:**
- Modify: `src/domain/entities/reminder.ts`
- Test: `tests/domain/entities/reminder.test.ts`

**Interfaces:**
- Consumes: `Reminder` (existente), `ReminderStatus = 'PENDING' | 'SENT' | 'CANCELLED'`.
- Produces: `Reminder.markSent(): void` — mueve `PENDING→SENT`; no-op desde `SENT` o `CANCELLED`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar dentro del `describe('Reminder', ...)` en `tests/domain/entities/reminder.test.ts`:

```ts
  it('markSent moves PENDING to SENT', () => {
    const r = new Reminder({ ...base });
    r.markSent();
    expect(r.status).toBe('SENT');
  });
  it('markSent is idempotent', () => {
    const r = new Reminder({ ...base });
    r.markSent();
    r.markSent();
    expect(r.status).toBe('SENT');
  });
  it('markSent does not resurrect a CANCELLED reminder', () => {
    const r = new Reminder({ ...base, status: 'CANCELLED' });
    r.markSent();
    expect(r.status).toBe('CANCELLED');
  });
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/domain/entities/reminder.test.ts`
Expected: FAIL — `r.markSent is not a function`.

- [ ] **Step 3: Implementar `markSent`**

En `src/domain/entities/reminder.ts`, agregar el método debajo de `cancel()`:

```ts
  markSent(): void {
    if (this._status !== 'PENDING') return;
    this._status = 'SENT';
  }
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `npx vitest run tests/domain/entities/reminder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/reminder.ts tests/domain/entities/reminder.test.ts
git commit -m "feat(domain): Reminder.markSent transition (PENDING->SENT)"
```

---

### Task 2: `ReminderRepository.findDue` (puerto + adaptadores in-memory e idb)

**Files:**
- Modify: `src/domain/ports/outbound/reminder-repository.ts`
- Modify: `src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts`
- Modify: `src/infrastructure/persistence/idb/idb-reminder-repository.ts`
- Test: `tests/infrastructure/in-memory-repositories.test.ts`
- Test: `tests/infrastructure/idb/idb-reminder-repository.test.ts`

**Interfaces:**
- Consumes: `Reminder`, `ReminderRepository` (existente), `CampoDb`, `fromReminderRecord`.
- Produces: `ReminderRepository.findDue(now: Date): Promise<Reminder[]>` — devuelve los `PENDING` con `remindAt <= now`, across todos los lotes. Implementado en ambos adaptadores.

- [ ] **Step 1: Escribir el test in-memory que falla**

En `tests/infrastructure/in-memory-repositories.test.ts`, agregar (importá lo que falte: `InMemoryReminderRepository`, `Reminder`):

```ts
describe('InMemoryReminderRepository.findDue', () => {
  const mk = (id: string, remindAt: string, status: 'PENDING' | 'SENT' | 'CANCELLED') =>
    new Reminder({ id, visitId: `v-${id}`, fieldId: `f-${id}`, remindAt: new Date(remindAt), status });

  it('returns PENDING reminders with remindAt <= now, across fields', async () => {
    const repo = new InMemoryReminderRepository();
    await repo.save(mk('due', '2026-07-29T00:00:00Z', 'PENDING'));
    await repo.save(mk('future', '2026-08-10T00:00:00Z', 'PENDING'));
    await repo.save(mk('sent', '2026-07-20T00:00:00Z', 'SENT'));
    await repo.save(mk('cancelled', '2026-07-20T00:00:00Z', 'CANCELLED'));
    const now = new Date('2026-07-29T12:00:00Z');
    const due = await repo.findDue(now);
    expect(due.map((r) => r.id)).toEqual(['due']);
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/infrastructure/in-memory-repositories.test.ts`
Expected: FAIL — `repo.findDue is not a function`.

- [ ] **Step 3: Agregar el método al puerto y al adaptador in-memory**

En `src/domain/ports/outbound/reminder-repository.ts`, agregar a la interfaz:

```ts
  findDue(now: Date): Promise<Reminder[]>;
```

En `src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts`, agregar el método:

```ts
  async findDue(now: Date): Promise<Reminder[]> {
    return [...this.reminders.values()].filter(
      (reminder) => reminder.status === 'PENDING' && reminder.remindAt.getTime() <= now.getTime(),
    );
  }
```

- [ ] **Step 4: Correr el test in-memory para verlo pasar**

Run: `npx vitest run tests/infrastructure/in-memory-repositories.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir el test idb que falla**

En `tests/infrastructure/idb/idb-reminder-repository.test.ts`, agregar dentro del `describe`. Ojo: el helper `reminder(...)` existente fija `remindAt` a `2026-07-31`; para `findDue` necesitamos control de fecha, así que usamos un constructor local:

```ts
  it('findDue returns PENDING reminders with remindAt <= now', async () => {
    const { db, repo } = await freshRepo();
    const mk = (id: string, remindAt: string, status: 'PENDING' | 'SENT' | 'CANCELLED') =>
      new Reminder({ id, visitId: `v-${id}`, fieldId: `f-${id}`, remindAt: new Date(remindAt), status });
    await repo.save(mk('due', '2026-07-29T00:00:00Z', 'PENDING'));
    await repo.save(mk('future', '2026-08-10T00:00:00Z', 'PENDING'));
    await repo.save(mk('sent', '2026-07-20T00:00:00Z', 'SENT'));
    const due = await repo.findDue(new Date('2026-07-29T12:00:00Z'));
    expect(due.map((r) => r.id)).toEqual(['due']);
    db.close();
  });
```

- [ ] **Step 6: Correr el test idb para verlo fallar**

Run: `npx vitest run tests/infrastructure/idb/idb-reminder-repository.test.ts`
Expected: FAIL — `repo.findDue is not a function`.

- [ ] **Step 7: Implementar `findDue` en el adaptador idb**

En `src/infrastructure/persistence/idb/idb-reminder-repository.ts`, agregar el método (sin índice nuevo; `getAll` + filtro):

```ts
  async findDue(now: Date): Promise<Reminder[]> {
    const records = await this.db.getAll('reminders');
    return records
      .filter((r) => r.status === 'PENDING' && r.remindAt.getTime() <= now.getTime())
      .map(fromReminderRecord);
  }
```

- [ ] **Step 8: Correr los tests y el typecheck**

Run: `npx vitest run tests/infrastructure/idb/idb-reminder-repository.test.ts tests/infrastructure/in-memory-repositories.test.ts && npm run typecheck`
Expected: PASS y typecheck limpio.

- [ ] **Step 9: Commit**

```bash
git add src/domain/ports/outbound/reminder-repository.ts src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts src/infrastructure/persistence/idb/idb-reminder-repository.ts tests/infrastructure/in-memory-repositories.test.ts tests/infrastructure/idb/idb-reminder-repository.test.ts
git commit -m "feat(persistence): ReminderRepository.findDue (PENDING due reminders)"
```

---

### Task 3: Puerto `ReminderNotifier` + DTO `DueReminder` + adaptador `InAppReminderNotifier`

**Files:**
- Create: `src/domain/ports/outbound/reminder-notifier.ts`
- Create: `src/infrastructure/notification/in-app-reminder-notifier.ts`
- Test: `tests/infrastructure/in-app-reminder-notifier.test.ts`

**Interfaces:**
- Consumes: `ReminderId`, `FieldId` (de `@/domain/shared/ids`).
- Produces:
  - `interface DueReminder { reminderId: ReminderId; fieldId: FieldId; fieldName: string; clientName: string; zoneName: string; nextVisitDate: Date; remindAt: Date; }`
  - `interface ReminderNotifier { notify(batch: DueReminder[]): void | Promise<void>; }`
  - `interface ReminderAvisoStore { snapshot(): DueReminder[]; }`
  - `class InAppReminderNotifier implements ReminderNotifier, ReminderAvisoStore` — guarda el último batch; `snapshot()` lo devuelve; arranca vacío.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/infrastructure/in-app-reminder-notifier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import type { DueReminder } from '@/domain/ports/outbound/reminder-notifier';

const item: DueReminder = {
  reminderId: 'r1', fieldId: 'f1', fieldName: 'El Alto',
  clientName: 'Pérez', zoneName: 'Norte',
  nextVisitDate: new Date('2026-08-12T00:00:00Z'), remindAt: new Date('2026-08-09T00:00:00Z'),
};

describe('InAppReminderNotifier', () => {
  it('starts with an empty snapshot', () => {
    expect(new InAppReminderNotifier().snapshot()).toEqual([]);
  });
  it('notify stores the batch and snapshot returns it', async () => {
    const n = new InAppReminderNotifier();
    await n.notify([item]);
    expect(n.snapshot()).toEqual([item]);
  });
  it('notify replaces the previous batch', async () => {
    const n = new InAppReminderNotifier();
    await n.notify([item]);
    await n.notify([]);
    expect(n.snapshot()).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/infrastructure/in-app-reminder-notifier.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Crear el puerto**

Crear `src/domain/ports/outbound/reminder-notifier.ts`:

```ts
import type { ReminderId, FieldId } from '@/domain/shared/ids';

export interface DueReminder {
  reminderId: ReminderId;
  fieldId: FieldId;
  fieldName: string;
  clientName: string;
  zoneName: string;
  nextVisitDate: Date;
  remindAt: Date;
}

export interface ReminderNotifier {
  notify(batch: DueReminder[]): void | Promise<void>;
}

/** Lado de lectura para la UI: expone el último batch notificado. */
export interface ReminderAvisoStore {
  snapshot(): DueReminder[];
}
```

- [ ] **Step 4: Crear el adaptador in-app**

Crear `src/infrastructure/notification/in-app-reminder-notifier.ts`:

```ts
import type {
  DueReminder, ReminderNotifier, ReminderAvisoStore,
} from '@/domain/ports/outbound/reminder-notifier';

export class InAppReminderNotifier implements ReminderNotifier, ReminderAvisoStore {
  private last: DueReminder[] = [];

  notify(batch: DueReminder[]): void {
    this.last = batch;
  }

  snapshot(): DueReminder[] {
    return this.last;
  }
}
```

- [ ] **Step 5: Correr los tests para verlos pasar**

Run: `npx vitest run tests/infrastructure/in-app-reminder-notifier.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/ports/outbound/reminder-notifier.ts src/infrastructure/notification/in-app-reminder-notifier.ts tests/infrastructure/in-app-reminder-notifier.test.ts
git commit -m "feat: ReminderNotifier port + DueReminder DTO + in-app adapter"
```

---

### Task 4: Caso de uso `DispatchDueReminders`

**Files:**
- Create: `src/application/use-cases/dispatch-due-reminders.ts`
- Test: `tests/application/dispatch-due-reminders.test.ts`

**Interfaces:**
- Consumes: `ReminderRepository.findDue` (Task 2), `Reminder.markSent` (Task 1), `ReminderNotifier`/`DueReminder` (Task 3), `VisitRepository.findCurrentFollowUps(): Promise<CurrentFollowUp[]>` con `CurrentFollowUp { fieldId; nextVisitDate }`, `FieldRepository.listAllWithHierarchy(): Promise<FieldSearchResult[]>` con `FieldSearchResult { field; clientName; zoneName }`, `Clock.now()`.
- Produces: `class DispatchDueReminders` con `execute(): Promise<DueReminder[]>` — marca `SENT` los vencidos, arma el batch enriquecido, llama `notifier.notify(batch)` y devuelve el batch.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/application/dispatch-due-reminders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { FixedClock } from '../support/fixed-clock';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makeDispatch(now: Date) {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Loma', clientId: 'c1', zoneId: 'z2' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const notifier = new InAppReminderNotifier();
  const dispatch = new DispatchDueReminders(reminders, visits, fields, new FixedClock(now), notifier);
  return { visits, reminders, notifier, dispatch };
}

const withFollowUp = (id: string, fieldId: string, next: string) =>
  new Visit({
    id, fieldId, visitDate: at('2026-07-01'), createdAt: at('2026-07-01'),
    followUp: { nextVisitDate: at(next), interval: VisitInterval.ofDays(14) },
  });

const rem = (id: string, fieldId: string, remindAt: string) =>
  new Reminder({ id, visitId: `v-${id}`, fieldId, remindAt: at(remindAt) });

describe('DispatchDueReminders', () => {
  it('marks due reminders SENT, enriches them, and notifies', async () => {
    const now = at('2026-07-29');
    const { visits, reminders, notifier, dispatch } = makeDispatch(now);
    await visits.save(withFollowUp('v1', 'f1', '2026-08-01'));
    await reminders.save(rem('r1', 'f1', '2026-07-28')); // due
    await reminders.save(rem('r2', 'f2', '2026-08-15')); // future

    const batch = await dispatch.execute();

    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      reminderId: 'r1', fieldId: 'f1', fieldName: 'El Alto',
      clientName: 'Pérez', zoneName: 'Norte', nextVisitDate: at('2026-08-01'),
    });
    expect(notifier.snapshot()).toEqual(batch);
    expect(await reminders.findDue(now)).toEqual([]); // r1 ya no está PENDING
  });

  it('is idempotent: a second run finds nothing and notifies an empty batch', async () => {
    const now = at('2026-07-29');
    const { visits, reminders, notifier, dispatch } = makeDispatch(now);
    await visits.save(withFollowUp('v1', 'f1', '2026-08-01'));
    await reminders.save(rem('r1', 'f1', '2026-07-28'));

    await dispatch.execute();
    const second = await dispatch.execute();

    expect(second).toEqual([]);
    expect(notifier.snapshot()).toEqual([]);
  });

  it('marks a reminder SENT even when its field is missing from the hierarchy, but excludes it from the batch', async () => {
    const now = at('2026-07-29');
    const { reminders, dispatch } = makeDispatch(now);
    await reminders.save(rem('orphan', 'ghost', '2026-07-28'));

    const batch = await dispatch.execute();

    expect(batch).toEqual([]);
    expect(await reminders.findDue(now)).toEqual([]); // igual pasó a SENT
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/application/dispatch-due-reminders.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar el caso de uso**

Crear `src/application/use-cases/dispatch-due-reminders.ts`:

```ts
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { ReminderNotifier, DueReminder } from '@/domain/ports/outbound/reminder-notifier';

export class DispatchDueReminders {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly visits: VisitRepository,
    private readonly fields: FieldRepository,
    private readonly clock: Clock,
    private readonly notifier: ReminderNotifier,
  ) {}

  async execute(): Promise<DueReminder[]> {
    const now = this.clock.now();
    const [due, followUps, hierarchy] = await Promise.all([
      this.reminders.findDue(now),
      this.visits.findCurrentFollowUps(),
      this.fields.listAllWithHierarchy(),
    ]);

    const nextByField = new Map(followUps.map((fu) => [fu.fieldId, fu.nextVisitDate]));
    const hierByField = new Map(hierarchy.map((h) => [h.field.id, h]));

    const batch: DueReminder[] = [];
    for (const reminder of due) {
      reminder.markSent();
      await this.reminders.save(reminder);

      const h = hierByField.get(reminder.fieldId);
      if (!h) continue;
      batch.push({
        reminderId: reminder.id,
        fieldId: reminder.fieldId,
        fieldName: h.field.name,
        clientName: h.clientName,
        zoneName: h.zoneName,
        nextVisitDate: nextByField.get(reminder.fieldId) ?? reminder.remindAt,
        remindAt: reminder.remindAt,
      });
    }

    await this.notifier.notify(batch);
    return batch;
  }
}
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `npx vitest run tests/application/dispatch-due-reminders.test.ts && npm run typecheck`
Expected: PASS y typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/dispatch-due-reminders.ts tests/application/dispatch-due-reminders.test.ts
git commit -m "feat(application): DispatchDueReminders use case"
```

---

### Task 5: Clampar `reminderLeadDays` en `RecordVisit`

**Files:**
- Modify: `src/application/use-cases/record-visit.ts:71-80`
- Test: `tests/application/record-visit.rules.test.ts`

**Interfaces:**
- Consumes: `RecordVisit.execute` (existente), `addDays`, `followUp.interval.days`.
- Produces: comportamiento — el `remindAt` del reminder se calcula con el lead clampeado a `[0, followUp.interval.days]`. Sin cambios de firma.

- [ ] **Step 1: Escribir los tests que fallan**

Primero, mirá `tests/application/record-visit.rules.test.ts` para reusar su harness (`makeRecordVisit` / `tests/support/record-visit-harness.ts`) y el patrón de aserción sobre el reminder guardado. Agregá un bloque que verifique el `remindAt` resultante. Ejemplo con harness que expone `reminders` y `clock`:

```ts
describe('RecordVisit reminderLeadDays clamp', () => {
  it('clamps a lead greater than the interval down to the interval (remindAt = now)', async () => {
    const { recordVisit, reminders, clock } = makeRecordVisit(); // now = 2026-07-27
    await recordVisit.execute({
      fieldId: 'f1',
      visitDate: clock.now(),
      followUp: { kind: 'interval', days: 14, reminderLeadDays: 20 },
    });
    const [reminder] = await reminders.findDue(new Date('2100-01-01'));
    // nextVisitDate = now + 14; lead clampeado a 14 => remindAt = now
    expect(reminder.remindAt.getTime()).toBe(clock.now().getTime());
  });

  it('clamps a negative lead up to 0 (remindAt = nextVisitDate)', async () => {
    const { recordVisit, reminders, clock } = makeRecordVisit();
    await recordVisit.execute({
      fieldId: 'f1',
      visitDate: clock.now(),
      followUp: { kind: 'interval', days: 14, reminderLeadDays: -3 },
    });
    const [reminder] = await reminders.findDue(new Date('2100-01-01'));
    const expected = new Date(clock.now().getTime() + 14 * 86_400_000);
    expect(reminder.remindAt.getTime()).toBe(expected.getTime());
  });
});
```

> Nota para el implementador: adaptá los nombres (`makeRecordVisit`, `reminders`, `clock`) a lo que exponga el harness real en `tests/support/record-visit-harness.ts`. Si el harness no devuelve `reminders`/`clock`, ampliálo mínimamente para exponerlos (es test-support, no producción). Usá `reminders.findDue(new Date('2100-01-01'))` para recuperar el reminder guardado sin depender de su id.

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/application/record-visit.rules.test.ts`
Expected: FAIL — hoy `remindAt = nextVisitDate - 20` (no clampeado), así que las aserciones fallan.

- [ ] **Step 3: Implementar el clamp**

En `src/application/use-cases/record-visit.ts`, reemplazar el cálculo del lead (líneas ~73-79):

```ts
    const requestedLead = input.followUp.kind === 'none' ? 0 : input.followUp.reminderLeadDays ?? 0;
    const leadDays = Math.min(Math.max(requestedLead, 0), followUp.interval.days);
    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: visit.id,
      fieldId: input.fieldId,
      remindAt: addDays(followUp.nextVisitDate, -leadDays),
    });
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `npx vitest run tests/application/record-visit.rules.test.ts tests/application/record-visit.happy.test.ts && npm run typecheck`
Expected: PASS (verificá que los tests happy existentes siguen verdes).

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/record-visit.ts tests/application/record-visit.rules.test.ts tests/support/record-visit-harness.ts
git commit -m "fix(application): clamp reminderLeadDays to [0, interval] in RecordVisit"
```

---

### Task 6: Wiring — container + `main.tsx` + contenedores de test

**Files:**
- Modify: `src/composition/container.ts`
- Modify: `src/main.tsx`
- Modify: `tests/support/in-memory-container.ts`
- Modify: `tests/ui/agenda-screen.test.tsx` (los dos literales tipados `Container`: `makeContainer` y el test de estado vacío)
- Test: `tests/composition/container.test.ts`

**Interfaces:**
- Consumes: `DispatchDueReminders` (Task 4), `InAppReminderNotifier` (Task 3), `ReminderAvisoStore` (Task 3), repos idb/in-memory existentes.
- Produces: `Container` gana dos miembros:
  - `dispatchDueReminders: DispatchDueReminders`
  - `reminderAviso: ReminderAvisoStore`
  `buildContainer` crea un único `InAppReminderNotifier` y lo usa para ambos (inyectado en el dispatch y expuesto como `reminderAviso`).

- [ ] **Step 1: Escribir el test de composición que falla**

En `tests/composition/container.test.ts`, agregar:

```ts
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
```

> Nota: el `remindAt` queda en "ahora" (lead 1 = intervalo 1), que es `<= now` en el momento del dispatch, así que el dispatch lo agarra.

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/composition/container.test.ts`
Expected: FAIL — `container.dispatchDueReminders`/`reminderAviso` no existen.

- [ ] **Step 3: Ampliar el container**

Reescribir `src/composition/container.ts`:

```ts
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';
import type { ReminderAvisoStore } from '@/domain/ports/outbound/reminder-notifier';
import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
  listUpcomingVisits: ListUpcomingVisits;
  dispatchDueReminders: DispatchDueReminders;
  reminderAviso: ReminderAvisoStore;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  const clock = new SystemClock();
  const notifier = new InAppReminderNotifier();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, new Uuidv7IdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
  };
}
```

- [ ] **Step 4: Correr el test de composición para verlo pasar**

Run: `npx vitest run tests/composition/container.test.ts`
Expected: PASS.

- [ ] **Step 5: Actualizar los contenedores de test tipados**

En `tests/support/in-memory-container.ts`, importar y armar los dos miembros nuevos, reusando el mismo `clock`:

```ts
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
```

y dentro del objeto retornado (el `reminders` in-memory hoy es anónimo dentro de `RecordVisit`; para compartirlo, extraerlo a una variable):

```ts
  const reminders = new InMemoryReminderRepository();
  const notifier = new InAppReminderNotifier();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, new IncrementingIdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
  };
```

En `tests/ui/agenda-screen.test.tsx`, agregar los mismos imports arriba y, en los **dos** objetos tipados `Container` (el de `makeContainer`, ~líneas 43-47, y el del test de estado vacío, ~líneas 98-102), extraer `reminders` a variable y agregar:

```ts
    dispatchDueReminders: new DispatchDueReminders(fields, visits, ... ) // ver firma abajo
```

Firma exacta a usar en ambos: crear `const reminders = new InMemoryReminderRepository();` y `const notifier = new InAppReminderNotifier();`, pasar `reminders` a `RecordVisit`, y agregar:

```ts
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
```

> El test de error de `agenda-screen.test.tsx` usa `as unknown as Container` (no tipado) — **no** se toca en esta tarea; se ajusta en Task 7 cuando el banner empiece a leer `reminderAviso`.

- [ ] **Step 6: Actualizar `main.tsx` con el dispatch best-effort**

En `src/main.tsx`, dentro de `main()`, después de `const container = buildContainer(db);` y antes del `createRoot(...)`:

```ts
  try {
    await container.dispatchDueReminders.execute();
  } catch (error) {
    console.error('reminder dispatch failed', error);
  }
```

- [ ] **Step 7: Correr toda la suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS y typecheck limpio (todos los contenedores de test compilan con los miembros nuevos).

- [ ] **Step 8: Commit**

```bash
git add src/composition/container.ts src/main.tsx tests/support/in-memory-container.ts tests/ui/agenda-screen.test.tsx tests/composition/container.test.ts
git commit -m "feat(composition): wire DispatchDueReminders + reminderAviso store; dispatch on open"
```

---

### Task 7: Banner `ReminderAvisoBanner` en Inicio

**Files:**
- Create: `src/ui/components/ReminderAvisoBanner.tsx`
- Modify: `src/ui/screens/AgendaScreen.tsx`
- Modify: `src/ui/styles.css`
- Modify: `tests/ui/agenda-screen.test.tsx` (solo el contenedor `as unknown as Container` del test de error)
- Test: `tests/ui/reminder-aviso-banner.test.tsx`

**Interfaces:**
- Consumes: `useCampo().reminderAviso.snapshot(): DueReminder[]` (Task 6), `DueReminder` (Task 3).
- Produces: `ReminderAvisoBanner` (componente sin props) que lee el snapshot, agrupa por zona y se puede cerrar; render vacío cuando no hay avisos.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/ui/reminder-aviso-banner.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoProvider } from '@/ui/CampoProvider';
import { ReminderAvisoBanner } from '@/ui/components/ReminderAvisoBanner';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import type { DueReminder } from '@/domain/ports/outbound/reminder-notifier';
import type { Container } from '@/composition/container';

const due = (fieldName: string, zoneName: string): DueReminder => ({
  reminderId: `r-${fieldName}`, fieldId: `f-${fieldName}`, fieldName,
  clientName: 'Pérez', zoneName,
  nextVisitDate: new Date('2026-08-12T00:00:00Z'), remindAt: new Date('2026-08-09T00:00:00Z'),
});

function renderBanner(batch: DueReminder[]) {
  const notifier = new InAppReminderNotifier();
  notifier.notify(batch);
  const container = { reminderAviso: notifier } as unknown as Container;
  render(
    <CampoProvider container={container}>
      <ReminderAvisoBanner />
    </CampoProvider>,
  );
}

describe('ReminderAvisoBanner', () => {
  it('no renderiza nada cuando no hay avisos', () => {
    renderBanner([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lista los lotes agrupados por zona con el conteo', () => {
    renderBanner([due('El Alto', 'Norte'), due('La Loma', 'Norte'), due('Est. Sur', 'Sur')]);
    expect(screen.getByText(/3 lotes para visitar pronto/)).toBeInTheDocument();
    expect(screen.getByText('Norte')).toBeInTheDocument();
    expect(screen.getByText(/El Alto, La Loma/)).toBeInTheDocument();
    expect(screen.getByText('Sur')).toBeInTheDocument();
    expect(screen.getByText('Est. Sur')).toBeInTheDocument();
  });

  it('se oculta al tocar Cerrar', async () => {
    renderBanner([due('El Alto', 'Norte')]);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/ui/reminder-aviso-banner.test.tsx`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar el banner**

Crear `src/ui/components/ReminderAvisoBanner.tsx`:

```tsx
import { useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';
import type { DueReminder } from '@/domain/ports/outbound/reminder-notifier';

interface ZoneGroup {
  zoneName: string;
  fieldNames: string[];
}

function groupByZone(batch: DueReminder[]): ZoneGroup[] {
  const byZone = new Map<string, string[]>();
  for (const item of batch) {
    const names = byZone.get(item.zoneName) ?? [];
    names.push(item.fieldName);
    byZone.set(item.zoneName, names);
  }
  return [...byZone.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([zoneName, fieldNames]) => ({ zoneName, fieldNames }));
}

export function ReminderAvisoBanner() {
  const { reminderAviso } = useCampo();
  const [dismissed, setDismissed] = useState(false);

  const batch = reminderAviso.snapshot();
  if (dismissed || batch.length === 0) return null;

  const groups = groupByZone(batch);
  const plural = batch.length === 1 ? 'lote' : 'lotes';

  return (
    <aside className="reminder-aviso" role="status">
      <div className="reminder-aviso-head">
        <span className="reminder-aviso-title">🔔 {batch.length} {plural} para visitar pronto</span>
        <button
          className="reminder-aviso-close"
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>
      </div>
      <ul className="reminder-aviso-list">
        {groups.map((group) => (
          <li key={group.zoneName}>
            <span className="reminder-aviso-zone">{group.zoneName}</span>
            {' — '}
            <span className="reminder-aviso-fields">{group.fieldNames.join(', ')}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 4: Correr el test del banner para verlo pasar**

Run: `npx vitest run tests/ui/reminder-aviso-banner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Montar el banner en `AgendaScreen` y arreglar el test de error**

En `src/ui/screens/AgendaScreen.tsx`, importar y renderizar el banner como primer hijo del `<main>`:

```tsx
import { ReminderAvisoBanner } from '@/ui/components/ReminderAvisoBanner';
```

```tsx
    <main className="screen agenda">
      <ReminderAvisoBanner />
      <header className="agenda-header">
```

En `tests/ui/agenda-screen.test.tsx`, el test "muestra un error…" usa `{ listUpcomingVisits: {...} } as unknown as Container`. Como ahora `AgendaScreen` monta el banner y este lee `reminderAviso.snapshot()`, agregar un `reminderAviso` que devuelva vacío a ese contenedor:

```ts
    const container = {
      listUpcomingVisits: { execute: () => Promise.reject(new Error('boom')) },
      reminderAviso: { snapshot: () => [] },
    } as unknown as Container;
```

- [ ] **Step 6: Agregar estilos**

En `src/ui/styles.css`, agregar (reusando los tokens/paleta existentes; el borde usa el acento de "vencidas" ya definido — buscá la variable/valor que usa `.is-overdue` y reusala):

```css
.reminder-aviso {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--color-border, #e4e2da);
  border-left: 4px solid var(--color-overdue, #c0392b);
}
.reminder-aviso-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.reminder-aviso-title {
  font-weight: 600;
}
.reminder-aviso-close {
  border: 0;
  background: transparent;
  font-size: 1rem;
  line-height: 1;
  padding: 0.25rem;
  cursor: pointer;
  color: inherit;
}
.reminder-aviso-list {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}
.reminder-aviso-list li { margin-top: 0.25rem; }
.reminder-aviso-zone { font-weight: 600; }
```

> Nota: si `--color-border` / `--color-overdue` no son los nombres reales de las custom properties, sustituilos por los que ya define `styles.css` para el acento de vencidas y los bordes (mirá el `:root` y `.is-overdue` existentes).

- [ ] **Step 7: Correr toda la suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS y typecheck limpio (incluidos los tests de `AgendaScreen`, que ahora montan el banner con snapshot vacío).

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/ReminderAvisoBanner.tsx src/ui/screens/AgendaScreen.tsx src/ui/styles.css tests/ui/reminder-aviso-banner.test.tsx tests/ui/agenda-screen.test.tsx
git commit -m "feat(ui): ReminderAvisoBanner (resumen de avisos por zona en Inicio)"
```

---

### Task 8: Tope del input "Avisar días antes" en `RecordVisitScreen`

**Files:**
- Modify: `src/ui/screens/RecordVisitScreen.tsx`
- Test: `tests/ui/record-visit-screen.test.tsx`

**Interfaces:**
- Consumes: estado `intervalDays`, `nextDate`, `kind`, helper `utcDate` (existentes en la pantalla).
- Produces: el input de lead recibe un `max` igual al intervalo vigente (para `kind: 'interval'`, `intervalDays`; para `kind: 'date'`, la cantidad de días entre hoy y `nextDate`). Guía visual; el dominio ya clampa (Task 5).

- [ ] **Step 1: Escribir el test que falla**

Primero mirá `tests/ui/record-visit-screen.test.tsx` para reusar su render helper. Agregá un test que, en modo "En N días" con intervalo 14, el input de lead tenga `max="14"`. Ejemplo:

```tsx
  it('limita el aviso al intervalo (max en el input de lead)', async () => {
    renderRecordVisit(); // helper existente que monta la pantalla
    // El modo por defecto es "interval" con intervalDays=14.
    const lead = screen.getByLabelText('Avisar días antes');
    expect(lead).toHaveAttribute('max', '14');
  });
```

> Nota: adaptá `renderRecordVisit` / la query al patrón real del archivo (puede requerir envolver en `MemoryRouter` con la ruta `/field/:fieldId/record`). Si el label no es accesible por `getByLabelText`, usá el mismo selector que usan los tests existentes de esa pantalla.

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run tests/ui/record-visit-screen.test.tsx`
Expected: FAIL — hoy el input de lead no tiene `max`.

- [ ] **Step 3: Calcular y aplicar el `max`**

En `src/ui/screens/RecordVisitScreen.tsx`, calcular el tope según el modo. Agregar, antes del `return`:

```tsx
  const leadMax =
    kind === 'interval'
      ? Math.max(1, intervalDays)
      : Math.max(1, Math.round((utcDate(nextDate).getTime() - utcDate(todayIso()).getTime()) / 86_400_000));
```

y en el input de lead, agregar el atributo `max`:

```tsx
                <input
                  className="control"
                  type="number"
                  min="0"
                  max={leadMax}
                  value={leadDays}
                  onChange={(e) => setLeadDays(Number(e.target.value))}
                />
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `npx vitest run tests/ui/record-visit-screen.test.tsx && npm run typecheck`
Expected: PASS y typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/RecordVisitScreen.tsx tests/ui/record-visit-screen.test.tsx
git commit -m "feat(ui): cap 'avisar dias antes' input to the follow-up interval"
```

---

## Cierre de la etapa (fuera de tareas TDD, al final)

- [ ] Correr `npm test`, `npm run typecheck` y `npm run build` — todo verde.
- [ ] Actualizar `docs/ROADMAP.md`: mover Etapa 3 a ✅ Completa (con nº de tests), pasar a "Se puede hacer hoy" el aviso al abrir, y quitar de "Todavía no se puede" la línea del aviso. Cerrar en "Decisiones diferidas" la validación de `reminderLeadDays`; anotar el índice idb `by-status` como optimización pendiente.
- [ ] Merge de `etapa-3-avisos` a `main` (usar `superpowers:finishing-a-development-branch`).

---

## Self-Review (hecho al escribir el plan)

**Cobertura del spec:**
- `Reminder.markSent()` → Task 1. ✓
- `ReminderRepository.findDue` (in-memory + idb, sin bump) → Task 2. ✓
- Puerto `ReminderNotifier` + `DueReminder` + `InAppReminderNotifier` (con `snapshot`) → Task 3. ✓
- `DispatchDueReminders` (join, marca SENT, idempotencia, edge sin jerarquía, payload rico) → Task 4. ✓
- Clamp de `reminderLeadDays` en `RecordVisit` → Task 5. ✓
- Wiring container + `main.tsx` best-effort → Task 6. ✓
- Banner autosuficiente agrupado por zona + cerrar + vacío → Task 7. ✓
- Tope del input de lead en la UI → Task 8. ✓
- Dispatch en `main.tsx` antes del render → Task 6. ✓

**Tipos consistentes:** `DueReminder` (Task 3) se consume idéntico en Tasks 4/6/7; `ReminderAvisoStore.snapshot()` (Task 3) se expone en `Container.reminderAviso` (Task 6) y se lee en el banner (Task 7); `DispatchDueReminders(reminders, visits, fields, clock, notifier)` mismo orden en Tasks 4 y 6. ✓

**Sin placeholders:** todo el código es concreto; las notas al implementador son sobre reusar helpers de test reales, no sobre lógica de producción faltante. ✓
