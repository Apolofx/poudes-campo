# Etapa 4c — Programar visitas futuras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir agendar una visita futura a un lote (visitado o no) con aviso propio, que aparece en la agenda y se consume al registrar la visita real.

**Architecture:** Hexagonal. Nueva entidad de dominio `ScheduledVisit` (intención futura) + `Reminder.scheduledVisitId` (un reminder referencia una visita **o** una programada). Nuevo puerto `ScheduledVisitRepository` con adaptadores idb e in-memory. Casos de uso: `ScheduleVisit`, `CancelScheduledVisit`, `EditScheduledVisit`, `GetScheduledVisit`; cambios en `ListUpcomingVisits` (precedencia programada > followUp), `GetFieldHistory` (incluye programadas) y `RecordVisit` (consume la programada ACTIVE). Bump de esquema idb 1→2 (nuevo store `scheduled-visits`). UI: botón "Programar visita" en el historial, form de alta/edición, detalle con editar/cancelar.

**Tech Stack:** TypeScript, Vitest (+ @testing-library/react, jsdom), React + React Router, idb (IndexedDB). Alias de imports: `@/…` → `src/…`.

## Global Constraints

- **Regla dura:** ningún dato de dosis/agroquímicos/prescripciones. 4c no agrega campos de ese tipo.
- **Conversación en español, código e identificadores en inglés.** Texto visible al usuario (UI) en español.
- **Núcleo puro:** tocar `src/domain/**` y `src/application/**` es la intención explícita de esta etapa (regla 2 de AGENTS).
- **TDD estricto:** test que falla → verlo fallar → implementación mínima → verde → commit. Un commit por tarea como mínimo.
- **Comandos:** `npm test` (Vitest), `npm run typecheck` (`tsc --noEmit`), test puntual `npx vitest run <ruta>`. Ambos verdes antes de cerrar cada tarea.
- **Invariantes que se preservan:** (1) una sola `ScheduledVisit` ACTIVE por field; (2) un solo reminder PENDING por field (la programada cancela los PENDING al programarse, como `RecordVisit`); (3) la programada reemplaza al followUp en la agenda.
- **Anclaje:** la fecha programada debe ser estrictamente futura respecto de `clock.now()`.

---

### Task 1: Dominio — entidad `ScheduledVisit` + `ScheduledVisitId` + errores

**Files:**
- Create: `src/domain/entities/scheduled-visit.ts`
- Modify: `src/domain/shared/ids.ts`
- Modify: `src/domain/shared/errors.ts`
- Test: `tests/domain/entities/scheduled-visit.test.ts` (crear)

**Interfaces:**
- Produces: `ScheduledVisit` (inmutable, igual estilo que `Visit`), tipo `ScheduledVisitId`, errores `InvalidScheduledVisit`, `ScheduledDateNotFuture`, `ScheduledVisitNotFound`, `ScheduledVisitAlreadyCancelled`.

- [ ] **Step 1: Escribir el test que falla**

En `tests/domain/entities/scheduled-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { InvalidScheduledVisit } from '@/domain/shared/errors';

const base = {
  id: 's1',
  fieldId: 'f1',
  scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
  reminderLeadDays: 3,
  createdAt: new Date('2026-07-31T12:00:00.000Z'),
};

describe('ScheduledVisit', () => {
  it('defaults status to ACTIVE', () => {
    expect(new ScheduledVisit({ ...base }).status).toBe('ACTIVE');
  });

  it('stores optional notes and cancelledAt', () => {
    const s = new ScheduledVisit({ ...base, notes: 'revisar', status: 'CANCELLED', cancelledAt: base.createdAt });
    expect(s.notes).toBe('revisar');
    expect(s.status).toBe('CANCELLED');
    expect(s.cancelledAt?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
  });

  it('rejects a negative reminderLeadDays', () => {
    expect(() => new ScheduledVisit({ ...base, reminderLeadDays: -1 })).toThrow(InvalidScheduledVisit);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/domain/entities/scheduled-visit.test.ts`
Expected: FAIL — no se encuentra el módulo / la clase.

- [ ] **Step 3: Implementación mínima**

`src/domain/shared/ids.ts`:

```ts
export type ScheduledVisitId = string;
```

`src/domain/shared/errors.ts`, agregar al final:

```ts
export class InvalidScheduledVisit extends DomainError {}
export class ScheduledDateNotFuture extends DomainError {}
export class ScheduledVisitNotFound extends DomainError {}
export class ScheduledVisitAlreadyCancelled extends DomainError {}
```

`src/domain/entities/scheduled-visit.ts`:

```ts
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';
import { InvalidScheduledVisit } from '@/domain/shared/errors';

export type ScheduledVisitStatus = 'ACTIVE' | 'CANCELLED';

export interface ScheduledVisitProps {
  id: ScheduledVisitId;
  fieldId: FieldId;
  scheduledDate: Date;
  reminderLeadDays: number;
  createdAt: Date;
  notes?: string;
  status?: ScheduledVisitStatus;
  cancelledAt?: Date;
}

export class ScheduledVisit {
  readonly id: ScheduledVisitId;
  readonly fieldId: FieldId;
  readonly scheduledDate: Date;
  readonly reminderLeadDays: number;
  readonly createdAt: Date;
  readonly notes?: string;
  readonly status: ScheduledVisitStatus;
  readonly cancelledAt?: Date;

  constructor(props: ScheduledVisitProps) {
    if (!props.scheduledDate || props.reminderLeadDays < 0) {
      throw new InvalidScheduledVisit('scheduled visit requires a future date and a non-negative lead');
    }
    this.id = props.id;
    this.fieldId = props.fieldId;
    this.scheduledDate = props.scheduledDate;
    this.reminderLeadDays = props.reminderLeadDays;
    this.createdAt = props.createdAt;
    this.notes = props.notes;
    this.status = props.status ?? 'ACTIVE';
    this.cancelledAt = props.cancelledAt;
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/domain/entities/scheduled-visit.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/scheduled-visit.ts src/domain/shared/ids.ts src/domain/shared/errors.ts tests/domain/entities/scheduled-visit.test.ts
git commit -m "feat(domain): entidad ScheduledVisit + ids + errores"
```

---

### Task 2: Dominio — `Reminder.scheduledVisitId`

**Files:**
- Modify: `src/domain/entities/reminder.ts`
- Test: `tests/domain/entities/reminder.test.ts`

**Interfaces:**
- Produces: `ReminderProps.scheduledVisitId?: ScheduledVisitId` y `Reminder.scheduledVisitId?: ScheduledVisitId`. `visitId` sigue requerido (los reminders de follow-up lo usan). No se type-enforce la exclusividad (documentado en el spec).

- [ ] **Step 1: Escribir el test que falla**

En `tests/domain/entities/reminder.test.ts`, agregar:

```ts
  it('stores an optional scheduledVisitId', () => {
    const r = new Reminder({ id: 'r1', scheduledVisitId: 's1', fieldId: 'f1', remindAt: new Date('2026-08-01T00:00:00Z') });
    expect(r.scheduledVisitId).toBe('s1');
    expect(r.visitId).toBeDefined();
  });
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/domain/entities/reminder.test.ts`
Expected: FAIL — `scheduledVisitId` no existe en `ReminderProps`.

- [ ] **Step 3: Implementación mínima**

`src/domain/entities/reminder.ts`:

```ts
import type { ReminderId, VisitId, FieldId, ScheduledVisitId } from '@/domain/shared/ids';
```

agregar a `ReminderProps` y a la clase:

```ts
  scheduledVisitId?: ScheduledVisitId;
```

y en el constructor, después de `this.visitId`:

```ts
    this.scheduledVisitId = props.scheduledVisitId;
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/domain/entities/reminder.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/reminder.ts tests/domain/entities/reminder.test.ts
git commit -m "feat(domain): Reminder.scheduledVisitId opcional"
```

---

### Task 3: Puerto — `ScheduledVisitRepository`

**Files:**
- Create: `src/domain/ports/outbound/scheduled-visit-repository.ts`

**Interfaces:**
- Produces: contrato con `save`, `findById`, `listByField`, `findActiveByField`, `listActive`.

- [ ] **Step 1: Escribir el test que falla**

No hay test de puerto puro (patrón del repo: el contrato se valida en los adaptadores). Verificar que el archivo no existe:

Run: `ls src/domain/ports/outbound/scheduled-visit-repository.ts`
Expected: no existe (el import de Task 4 fallará).

- [ ] **Step 2: Implementación mínima**

`src/domain/ports/outbound/scheduled-visit-repository.ts`:

```ts
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';

export interface ScheduledVisitRepository {
  save(item: ScheduledVisit): Promise<void>;
  findById(id: ScheduledVisitId): Promise<ScheduledVisit | null>;
  listByField(fieldId: FieldId): Promise<ScheduledVisit[]>;
  findActiveByField(fieldId: FieldId): Promise<ScheduledVisit | null>;
  listActive(): Promise<ScheduledVisit[]>;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: sin errores (aún no consumido).

- [ ] **Step 4: Commit**

```bash
git add src/domain/ports/outbound/scheduled-visit-repository.ts
git commit -m "feat(domain): puerto ScheduledVisitRepository"
```

---

### Task 4: Aplicación — `ScheduleVisit`

**Files:**
- Create: `src/application/use-cases/schedule-visit.ts`
- Test: `tests/application/schedule-visit.test.ts` (crear)

**Interfaces:**
- Consumes: `FieldRepository`, `ScheduledVisitRepository`, `ReminderRepository`, `Clock`, `IdGenerator`, `daysBetween`/`addDays`, `ScheduledVisit`, `Reminder`.
- Produces: `ScheduleVisit` con reglas: field existe; fecha estrictamente futura; reemplaza programada ACTIVE previa (baja lógica); cancela PENDING del field; clamp de lead a `[0, daysBetween(now, scheduledDate)]`; crea `ScheduledVisit` + `Reminder` (remindAt = scheduledDate − lead). Devuelve `{ scheduledVisitId, reminderId }`.

- [ ] **Step 1: Escribir el test que falla**

`tests/application/schedule-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ScheduleVisit } from '@/application/use-cases/schedule-visit';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { FieldNotFound, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

const now = new Date('2026-07-31T12:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function build() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const scheduled = new InMemoryScheduledVisitRepository();
  const reminders = new InMemoryReminderRepository();
  return { fields, scheduled, reminders };
}

describe('ScheduleVisit', () => {
  it('schedules a visit with a clamped reminder lead', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    const result = await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 });

    const item = await scheduled.findById(result.scheduledVisitId);
    expect(item?.scheduledDate.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(item?.reminderLeadDays).toBe(3);
    const [reminder] = await reminders.findPendingByField('f1');
    expect(reminder.scheduledVisitId).toBe(result.scheduledVisitId);
    expect(reminder.remindAt.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });

  it('clamps a lead longer than the gap to the gap itself', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    // 2 días de gap, lead 5 → clamp a 2 → remindAt = hoy
    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-02'), reminderLeadDays: 5 });

    const item = await scheduled.findActiveByField('f1');
    expect(item?.reminderLeadDays).toBe(2);
    const [reminder] = await reminders.findPendingByField('f1');
    expect(reminder.remindAt.getTime()).toBe(now.getTime());
  });

  it('rejects a scheduled date that is not in the future', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await expect(uc.execute({ fieldId: 'f1', scheduledDate: now, reminderLeadDays: 3 })).rejects.toThrow(ScheduledDateNotFuture);
  });

  it('rejects an unknown field', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await expect(uc.execute({ fieldId: 'nope', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 })).rejects.toThrow(FieldNotFound);
  });

  it('replaces an existing ACTIVE scheduled visit for the field', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 });

    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-20'), reminderLeadDays: 0 });

    const active = await scheduled.findActiveByField('f1');
    expect(active?.scheduledDate.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    const all = await scheduled.listByField('f1');
    expect(all.filter((s) => s.status === 'CANCELLED')).toHaveLength(1);
    // una sola voz: un solo PENDING, el de la nueva programada
    expect(await reminders.findPendingByField('f1')).toHaveLength(1);
  });

  it('cancels prior PENDING reminders for the field', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await scheduled.save(new ScheduledVisit({
      id: 's0', fieldId: 'f1', scheduledDate: at('2026-08-05'), reminderLeadDays: 1, createdAt: now,
    }));
    await reminders.save(new Reminder({ id: 'r0', scheduledVisitId: 's0', fieldId: 'f1', remindAt: at('2026-08-04') }));

    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 });

    const pending = await reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].scheduledVisitId).not.toBe('s0');
  });
});
```

> Nota: el test de "cancela PENDING previos" referencia `InMemoryScheduledVisitRepository` y `Reminder`, que se crean en Tasks 11/12. Si se ejecuta el plan en orden estricto, correr este test fallará por módulo inexistente — es esperado; el test queda escrito y la suite pasa recién cuando Task 12 existe. Alternativa (recomendada): en Task 4 implementar también un repo in-memory mínimo ad-hoc en el test (patrón de `tests/support`), o posponer los dos últimos tests de esta tarea a Task 12. La ejecución debe dejar la suite verde al cierre de cada tarea → **posponer los tests de "reemplaza" y "cancela PENDING" a Task 12** (los primeros cuatro tests corren ya con un `InMemoryScheduledVisitRepository` mínimo provisto en el propio test, ver nota en Step 3).

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/schedule-visit.test.ts`
Expected: FAIL — no se encuentra el módulo `schedule-visit`.

- [ ] **Step 3: Implementación mínima**

Como `InMemoryScheduledVisitRepository` se crea en Task 12, el test de esta tarea puede proveer una implementación mínima inline (mismo contrato). Para no duplicar lógica, se recomienda **crear el repo in-memory en Task 12** y en esta tarea correr solo los 4 primeros tests con un stub inline; los 2 últimos se agregan en Task 12. Dejar constancia en el commit.

`src/application/use-cases/schedule-visit.ts`:

```ts
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, ScheduledVisitId, ReminderId } from '@/domain/shared/ids';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { addDays, daysBetween } from '@/domain/shared/date-utils';

export interface ScheduleVisitInput {
  fieldId: FieldId;
  scheduledDate: Date;
  reminderLeadDays: number;
  notes?: string;
}

export interface ScheduleVisitResult {
  scheduledVisitId: ScheduledVisitId;
  reminderId: ReminderId;
}

export class ScheduleVisit {
  constructor(
    private readonly fields: FieldRepository,
    private readonly scheduled: ScheduledVisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ScheduleVisitInput): Promise<ScheduleVisitResult> {
    const now = this.clock.now();

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new FieldNotFound(`unknown field ${input.fieldId}`);

    if (input.scheduledDate.getTime() <= now.getTime()) {
      throw new ScheduledDateNotFuture('scheduled date must be in the future');
    }

    const active = await this.scheduled.findActiveByField(input.fieldId);
    if (active) {
      await this.scheduled.save(
        new ScheduledVisit({
          id: active.id,
          fieldId: active.fieldId,
          scheduledDate: active.scheduledDate,
          reminderLeadDays: active.reminderLeadDays,
          createdAt: active.createdAt,
          notes: active.notes,
          status: 'CANCELLED',
          cancelledAt: now,
        }),
      );
    }

    const pending = await this.reminders.findPendingByField(input.fieldId);
    for (const reminder of pending) {
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    const lead = Math.min(
      Math.max(input.reminderLeadDays, 0),
      daysBetween(now, input.scheduledDate),
    );

    const scheduledVisit = new ScheduledVisit({
      id: this.ids.next(),
      fieldId: input.fieldId,
      scheduledDate: input.scheduledDate,
      reminderLeadDays: lead,
      createdAt: now,
      notes: input.notes,
    });
    await this.scheduled.save(scheduledVisit);

    const reminder = new Reminder({
      id: this.ids.next(),
      scheduledVisitId: scheduledVisit.id,
      fieldId: input.fieldId,
      remindAt: addDays(input.scheduledDate, -lead),
    });
    await this.reminders.save(reminder);

    return { scheduledVisitId: scheduledVisit.id, reminderId: reminder.id };
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/schedule-visit.test.ts`
Expected: PASS (4 primeros tests; el resto se agrega en Task 12).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/schedule-visit.ts tests/application/schedule-visit.test.ts
git commit -m "feat(app): ScheduleVisit — fecha futura, reemplaza ACTIVE, clamp de lead, aviso propio"
```

---

### Task 5: Aplicación — `CancelScheduledVisit`

**Files:**
- Create: `src/application/use-cases/cancel-scheduled-visit.ts`
- Test: `tests/application/cancel-scheduled-visit.test.ts` (crear)

**Interfaces:**
- Consumes: `ScheduledVisitRepository`, `ReminderRepository`, `Clock`.
- Produces: `CancelScheduledVisit` — baja lógica (`cancelledAt = now`), idempotente sobre ya-cancelada (paridad con `CancelVisit`), cancela su propio reminder PENDING (filtro por `scheduledVisitId`).

- [ ] **Step 1: Escribir el test que falla**

`tests/application/cancel-scheduled-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CancelScheduledVisit } from '@/application/use-cases/cancel-scheduled-visit';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { ScheduledVisitNotFound } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';

const now = new Date('2026-07-31T12:00:00Z');

describe('CancelScheduledVisit', () => {
  it('cancels the scheduled visit and its own PENDING reminder', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: now }));
    await reminders.save(new Reminder({ id: 'r1', scheduledVisitId: 's1', fieldId: 'f1', remindAt: new Date('2026-08-07T00:00:00Z') }));

    const uc = new CancelScheduledVisit(scheduled, reminders, new FixedClock(now));
    await uc.execute({ scheduledVisitId: 's1' });

    const item = await scheduled.findById('s1');
    expect(item?.status).toBe('CANCELLED');
    expect(item?.cancelledAt?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
    expect(await reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('is idempotent on an already cancelled visit', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: now, status: 'CANCELLED', cancelledAt: now }));

    const uc = new CancelScheduledVisit(scheduled, reminders, new FixedClock(now));
    await expect(uc.execute({ scheduledVisitId: 's1' })).resolves.toBeUndefined();
  });

  it('throws ScheduledVisitNotFound for an unknown id', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    const uc = new CancelScheduledVisit(scheduled, reminders, new FixedClock(now));
    await expect(uc.execute({ scheduledVisitId: 'nope' })).rejects.toThrow(ScheduledVisitNotFound);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/cancel-scheduled-visit.test.ts`
Expected: FAIL — no se encuentra el módulo `cancel-scheduled-visit` (y `in-memory-scheduled-visit-repository`, que llega en Task 12).

> Esta tarea depende de `InMemoryScheduledVisitRepository` (Task 12). **Ejecución: reordenar Task 12 (repo in-memory) antes que Tasks 4–7**, o proveer el repo inline en los tests. Recomendado: adelantar Task 12 a Task 4.5 y luego Tasks 4–7. El orden del plan asume que el repo in-memory existe para Tasks 5–7; se ejecuta tras Task 12 en ese caso.

- [ ] **Step 3: Implementación mínima**

`src/application/use-cases/cancel-scheduled-visit.ts`:

```ts
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { ScheduledVisitId } from '@/domain/shared/ids';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { ScheduledVisitNotFound } from '@/domain/shared/errors';

export interface CancelScheduledVisitInput {
  scheduledVisitId: ScheduledVisitId;
}

export class CancelScheduledVisit {
  constructor(
    private readonly scheduled: ScheduledVisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelScheduledVisitInput): Promise<void> {
    const item = await this.scheduled.findById(input.scheduledVisitId);
    if (!item) throw new ScheduledVisitNotFound(`unknown scheduled visit ${input.scheduledVisitId}`);
    if (item.status === 'CANCELLED') return;

    await this.scheduled.save(
      new ScheduledVisit({
        id: item.id,
        fieldId: item.fieldId,
        scheduledDate: item.scheduledDate,
        reminderLeadDays: item.reminderLeadDays,
        createdAt: item.createdAt,
        notes: item.notes,
        status: 'CANCELLED',
        cancelledAt: this.clock.now(),
      }),
    );

    const pending = await this.reminders.findPendingByField(item.fieldId);
    for (const reminder of pending) {
      if (reminder.scheduledVisitId !== item.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/cancel-scheduled-visit.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/cancel-scheduled-visit.ts tests/application/cancel-scheduled-visit.test.ts
git commit -m "feat(app): CancelScheduledVisit — baja lógica + cancela su reminder"
```

---

### Task 6: Aplicación — `EditScheduledVisit`

**Files:**
- Create: `src/application/use-cases/edit-scheduled-visit.ts`
- Test: `tests/application/edit-scheduled-visit.test.ts` (crear)

**Interfaces:**
- Consumes: `ScheduledVisitRepository`, `ReminderRepository`, `Clock`, `IdGenerator`, `addDays`/`daysBetween`.
- Produces: `EditScheduledVisit` — existe y ACTIVE; fecha futura; re-clamp de lead; recrea su reminder (el invariante "una sola ACTIVE por field" hace trivial la pertenencia).

- [ ] **Step 1: Escribir el test que falla**

`tests/application/edit-scheduled-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EditScheduledVisit } from '@/application/use-cases/edit-scheduled-visit';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { ScheduledVisitNotFound, ScheduledVisitAlreadyCancelled, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

const now = new Date('2026-07-31T12:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('EditScheduledVisit', () => {
  it('updates date/lead/notes and recreates its own reminder', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now }));
    await reminders.save(new Reminder({ id: 'r1', scheduledVisitId: 's1', fieldId: 'f1', remindAt: at('2026-08-07') }));

    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await uc.execute({ scheduledVisitId: 's1', scheduledDate: at('2026-08-20'), reminderLeadDays: 1, notes: 'revisar' });

    const item = await scheduled.findById('s1');
    expect(item?.scheduledDate.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(item?.reminderLeadDays).toBe(1);
    expect(item?.notes).toBe('revisar');
    const pending = await reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });

  it('re-clamps the lead to the new gap', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now }));

    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await uc.execute({ scheduledVisitId: 's1', scheduledDate: at('2026-08-02'), reminderLeadDays: 9 });

    const item = await scheduled.findById('s1');
    expect(item?.reminderLeadDays).toBe(2);
  });

  it('rejects a non-future date', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now }));

    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await expect(uc.execute({ scheduledVisitId: 's1', scheduledDate: now, reminderLeadDays: 3 })).rejects.toThrow(ScheduledDateNotFuture);
  });

  it('throws for unknown or already cancelled visits', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await expect(uc.execute({ scheduledVisitId: 'nope', scheduledDate: at('2026-08-20'), reminderLeadDays: 3 })).rejects.toThrow(ScheduledVisitNotFound);

    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now, status: 'CANCELLED', cancelledAt: now }));
    await expect(uc.execute({ scheduledVisitId: 's1', scheduledDate: at('2026-08-20'), reminderLeadDays: 3 })).rejects.toThrow(ScheduledVisitAlreadyCancelled);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/edit-scheduled-visit.test.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementación mínima**

`src/application/use-cases/edit-scheduled-visit.ts`:

```ts
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { ScheduledVisitId } from '@/domain/shared/ids';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { ScheduledVisitNotFound, ScheduledVisitAlreadyCancelled, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { addDays, daysBetween } from '@/domain/shared/date-utils';

export interface EditScheduledVisitInput {
  scheduledVisitId: ScheduledVisitId;
  scheduledDate: Date;
  reminderLeadDays: number;
  notes?: string;
}

export class EditScheduledVisit {
  constructor(
    private readonly scheduled: ScheduledVisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditScheduledVisitInput): Promise<void> {
    const now = this.clock.now();

    const existing = await this.scheduled.findById(input.scheduledVisitId);
    if (!existing) throw new ScheduledVisitNotFound(`unknown scheduled visit ${input.scheduledVisitId}`);
    if (existing.status === 'CANCELLED') {
      throw new ScheduledVisitAlreadyCancelled(`scheduled visit ${input.scheduledVisitId} is cancelled`);
    }
    if (input.scheduledDate.getTime() <= now.getTime()) {
      throw new ScheduledDateNotFuture('scheduled date must be in the future');
    }

    const lead = Math.min(
      Math.max(input.reminderLeadDays, 0),
      daysBetween(now, input.scheduledDate),
    );

    await this.scheduled.save(
      new ScheduledVisit({
        id: existing.id,
        fieldId: existing.fieldId,
        scheduledDate: input.scheduledDate,
        reminderLeadDays: lead,
        createdAt: existing.createdAt,
        notes: input.notes,
        status: 'ACTIVE',
      }),
    );

    const pending = await this.reminders.findPendingByField(existing.fieldId);
    for (const reminder of pending) {
      if (reminder.scheduledVisitId !== existing.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    await this.reminders.save(
      new Reminder({
        id: this.ids.next(),
        scheduledVisitId: existing.id,
        fieldId: existing.fieldId,
        remindAt: addDays(input.scheduledDate, -lead),
      }),
    );
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/edit-scheduled-visit.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/edit-scheduled-visit.ts tests/application/edit-scheduled-visit.test.ts
git commit -m "feat(app): EditScheduledVisit — reprograma fecha/lead/notas y recrea el reminder"
```

---

### Task 7: Aplicación — `GetScheduledVisit`

**Files:**
- Create: `src/application/use-cases/get-scheduled-visit.ts`
- Test: `tests/application/get-scheduled-visit.test.ts` (crear)

**Interfaces:**
- Consumes: `ScheduledVisitRepository`.
- Produces: `GetScheduledVisit.execute(id)` → `ScheduledVisit | null` (passthrough, como `GetVisit`).

- [ ] **Step 1: Escribir el test que falla**

`tests/application/get-scheduled-visit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GetScheduledVisit } from '@/application/use-cases/get-scheduled-visit';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

describe('GetScheduledVisit', () => {
  it('returns the scheduled visit by id', async () => {
    const repo = new InMemoryScheduledVisitRepository();
    await repo.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: new Date('2026-07-31T12:00:00Z') }));
    const uc = new GetScheduledVisit(repo);
    expect((await uc.execute('s1'))?.id).toBe('s1');
    expect(await uc.execute('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/get-scheduled-visit.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementación mínima**

`src/application/use-cases/get-scheduled-visit.ts`:

```ts
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId } from '@/domain/shared/ids';

export class GetScheduledVisit {
  constructor(private readonly scheduled: ScheduledVisitRepository) {}

  execute(id: ScheduledVisitId): Promise<ScheduledVisit | null> {
    return this.scheduled.findById(id);
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/get-scheduled-visit.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/get-scheduled-visit.ts tests/application/get-scheduled-visit.test.ts
git commit -m "feat(app): GetScheduledVisit"
```

---

### Task 8: Aplicación — `ListUpcomingVisits` con precedencia

**Files:**
- Modify: `src/application/use-cases/list-upcoming-visits.ts`
- Test: `tests/application/list-upcoming-visits.test.ts`

**Interfaces:**
- Consumes: `ScheduledVisitRepository` (nuevo dep en el constructor).
- Produces: si un field tiene programada ACTIVE, su fila se genera desde la programada y el followUp derivado se omite (Decisión 5). Mismo shape de salida, orden y urgencia.

- [ ] **Step 1: Escribir el test que falla**

En `tests/application/list-upcoming-visits.test.ts`, agregar:

```ts
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

// dentro del describe, nuevo test:
  it('gives precedence to an ACTIVE scheduled visit over the follow-up', async () => {
    const { fields, visits, save } = build();
    await save('v1', 'f1', '2026-08-30'); // followUp viejo, más lejano
    const scheduled = new InMemoryScheduledVisitRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-07-30'), reminderLeadDays: 3, createdAt: at('2026-07-29') }));
    await save('v2', 'f2', '2026-07-30');
    const uc = new ListUpcomingVisits(fields, visits, scheduled, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    // f1 aparece UNA vez y con la fecha de la programada (en 2 d, no en 33)
    expect(result.map((r) => r.field.id)).toEqual(['f2', 'f1']);
    const f1 = result.find((r) => r.field.id === 'f1');
    expect(f1?.nextVisitDate.toISOString()).toBe('2026-07-30T00:00:00.000Z');
    expect(f1?.urgency.daysUntil).toBe(2);
  });

  it('shows a scheduled visit for a field with no visits at all', async () => {
    const { fields, visits } = build();
    const scheduled = new InMemoryScheduledVisitRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f3', scheduledDate: at('2026-08-05'), reminderLeadDays: 3, createdAt: at('2026-07-28') }));
    const uc = new ListUpcomingVisits(fields, visits, scheduled, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f3']);
  });
```

Ajustar los 3 tests existentes: el constructor ahora recibe `scheduled` (4º argumento → agregar `new InMemoryScheduledVisitRepository()`).

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/list-upcoming-visits.test.ts`
Expected: FAIL — error de tipos (constructor) y los tests nuevos.

- [ ] **Step 3: Implementación mínima**

`src/application/use-cases/list-upcoming-visits.ts`:

```ts
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { Field } from '@/domain/entities/field';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';

export interface UpcomingVisit {
  field: Field;
  clientName?: string;
  zoneName?: string;
  nextVisitDate: Date;
  urgency: VisitUrgency;
}

export class ListUpcomingVisits {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly scheduled: ScheduledVisitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<UpcomingVisit[]> {
    const [followUps, hierarchy, schedules] = await Promise.all([
      this.visits.findCurrentFollowUps(),
      this.fields.listAllWithHierarchy(),
      this.scheduled.listActive(),
    ]);
    const byId = new Map(hierarchy.map((h) => [h.field.id, h]));
    const scheduledByField = new Map(schedules.map((s) => [s.fieldId, s]));
    const now = this.clock.now();

    const items: UpcomingVisit[] = [];
    for (const fu of followUps) {
      if (scheduledByField.has(fu.fieldId)) continue;
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
    for (const s of schedules) {
      const h = byId.get(s.fieldId);
      if (!h) continue;
      items.push({
        field: h.field,
        clientName: h.clientName,
        zoneName: h.zoneName,
        nextVisitDate: s.scheduledDate,
        urgency: VisitUrgency.of(s.scheduledDate, now),
      });
    }
    items.sort((a, b) => a.urgency.daysUntil - b.urgency.daysUntil);
    return items;
  }
}
```

> Los lotes archivados ya quedan fuera por el patrón existente: `listAllWithHierarchy` no los incluye y `byId.get` devuelve `undefined` → `continue`.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/list-upcoming-visits.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores. (Los callers `container.ts` y `in-memory-container.ts` rompen — se arreglan en Task 12.)

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/list-upcoming-visits.ts tests/application/list-upcoming-visits.test.ts
git commit -m "feat(app): ListUpcomingVisits da precedencia a la programada ACTIVE sobre el followUp"
```

---

### Task 9: Aplicación — `GetFieldHistory` incluye programadas

**Files:**
- Modify: `src/application/use-cases/get-field-history.ts`
- Test: `tests/application/get-field-history.test.ts`

**Interfaces:**
- Consumes: `ScheduledVisitRepository` (nuevo dep).
- Produces: `FieldHistoryView.scheduledVisits: ScheduledVisit[]` (todas, ordenadas por `scheduledDate` desc).

- [ ] **Step 1: Escribir el test que falla**

En `tests/application/get-field-history.test.ts`, agregar:

```ts
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

// nuevo test:
  it('includes scheduled visits sorted by scheduledDate desc', async () => {
    // repos: fields, visits + scheduled
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: new Date('2026-07-31T12:00:00Z') }));
    await scheduled.save(new ScheduledVisit({ id: 's2', fieldId: 'f1', scheduledDate: new Date('2026-09-01T00:00:00Z'), reminderLeadDays: 0, createdAt: new Date('2026-08-01T12:00:00Z'), status: 'CANCELLED', cancelledAt: new Date('2026-08-02T00:00:00Z') }));

    const view = await uc.execute('f1');

    expect(view?.scheduledVisits.map((s) => s.id)).toEqual(['s2', 's1']);
  });
```

> Ajustar el harness existente: el constructor de `GetFieldHistory` gana el 3º argumento (`scheduled`).

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/get-field-history.test.ts`
Expected: FAIL — error de tipos y test nuevo.

- [ ] **Step 3: Implementación mínima**

`src/application/use-cases/get-field-history.ts`:

```ts
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { FieldId } from '@/domain/shared/ids';
import type { Field } from '@/domain/entities/field';
import type { Visit } from '@/domain/entities/visit';
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';

export interface FieldHistoryView {
  field: Field;
  clientName?: string;
  zoneName?: string;
  visits: Visit[];
  scheduledVisits: ScheduledVisit[];
}

export class GetFieldHistory {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly scheduled: ScheduledVisitRepository,
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
    const scheduledVisits = [...(await this.scheduled.listByField(fieldId))].sort(
      (a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime(),
    );

    return { field, clientName: row?.clientName, zoneName: row?.zoneName, visits, scheduledVisits };
  }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/get-field-history.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores (los callers rompen hasta Task 12).

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/get-field-history.ts tests/application/get-field-history.test.ts
git commit -m "feat(app): GetFieldHistory incluye programadas ordenadas"
```

---

### Task 10: Aplicación — `RecordVisit` consume la programada ACTIVE

**Files:**
- Modify: `src/application/use-cases/record-visit.ts`
- Modify: `tests/support/record-visit-harness.ts`
- Test: `tests/application/record-visit.rules.test.ts` (agregar test de consumo)

**Interfaces:**
- Consumes: `ScheduledVisitRepository` (nuevo dep en el constructor).
- Produces: al registrar una visita real se cancela la programada ACTIVE del field (Decisión 3), además del comportamiento existente (cancelar PENDING, crear visit + followUp + reminder).

- [ ] **Step 1: Escribir el test que falla**

En `tests/application/record-visit.rules.test.ts`, agregar (adaptando el harness del archivo):

```ts
  it('consumes the ACTIVE scheduled visit when a real visit is recorded', async () => {
    // seed: field f1 con una programada ACTIVE (repo in-memory) + reminders
    const result = await uc.execute({ fieldId: 'f1', visitDate: <hoy>, followUp: { kind: 'none' } });

    const active = await scheduled.findActiveByField('f1');
    expect(active).toBeNull();
    const all = await scheduled.listByField('f1');
    expect(all.find((s) => s.id === <id programada>)?.status).toBe('CANCELLED');
  });
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/application/record-visit.rules.test.ts`
Expected: FAIL — error de tipos (constructor de `RecordVisit`) y test nuevo.

- [ ] **Step 3: Implementación mínima**

`src/application/use-cases/record-visit.ts` — importar `ScheduledVisitRepository` y `ScheduledVisit`; agregar `private readonly scheduled: ScheduledVisitRepository` al constructor; después de guardar la visita (o antes de cancelar reminders), consumir:

```ts
    const activeScheduled = await this.scheduled.findActiveByField(input.fieldId);
    if (activeScheduled) {
      await this.scheduled.save(
        new ScheduledVisit({
          id: activeScheduled.id,
          fieldId: activeScheduled.fieldId,
          scheduledDate: activeScheduled.scheduledDate,
          reminderLeadDays: activeScheduled.reminderLeadDays,
          createdAt: activeScheduled.createdAt,
          notes: activeScheduled.notes,
          status: 'CANCELLED',
          cancelledAt: now,
        }),
      );
    }
```

`tests/support/record-visit-harness.ts` — agregar `scheduled` al constructor y pasarlo a `RecordVisit`.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/application/record-visit.rules.test.ts tests/application/record-visit.happy.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores (container rompe hasta Task 12).

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/record-visit.ts tests/support/record-visit-harness.ts tests/application/record-visit.rules.test.ts
git commit -m "feat(app): RecordVisit consume la programada ACTIVE del field"
```

---

### Task 11: Infraestructura idb — schema v2, records, repo, reset

**Files:**
- Modify: `src/infrastructure/persistence/idb/open-campo-db.ts`
- Modify: `src/infrastructure/persistence/idb/records.ts`
- Create: `src/infrastructure/persistence/idb/idb-scheduled-visit-repository.ts`
- Modify: `src/infrastructure/persistence/idb/idb-data-reset.ts`
- Test: `tests/infrastructure/idb/open-campo-db.test.ts`, `tests/infrastructure/idb/records.test.ts`, `tests/infrastructure/idb/idb-scheduled-visit-repository.test.ts` (crear)

**Interfaces:**
- Produces: store `scheduled-visits` (keyPath `id`, índice `by-field`), bump 1→2 con migración por `oldVersion`; `ScheduledVisitRecord` + to/from; `ReminderRecord.scheduledVisitId?`; `IdbScheduledVisitRepository`; reset incluye el store nuevo.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/infrastructure/idb/open-campo-db.test.ts`:

```ts
  it('creates the scheduled-visits store (schema v2)', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    expect([...db.objectStoreNames]).toContain('scheduled-visits');
    const tx = db.transaction('scheduled-visits');
    expect([...tx.objectStore('scheduled-visits').indexNames]).toContain('by-field');
    await tx.done;
    db.close();
  });

  it('migrates an existing v1 database to v2 keeping old data', async () => {
    // abrir en v1 no es expuesto; en su lugar: abrir v2 sobre una db existente creada con la versión previa
    // (fake-indexeddb persiste por nombre) → escribir en visits con la api v2 y verificar roundtrip
    const name = `mig-${Math.random()}`;
    const db1 = await openCampoDb(name);
    await db1.put('zones', { id: 'z1', name: 'Norte' });
    db1.close();
    const db2 = await openCampoDb(name);
    expect((await db2.get('zones', 'z1'))?.name).toBe('Norte');
    expect([...db2.objectStoreNames]).toContain('scheduled-visits');
    db2.close();
  });
```

En `tests/infrastructure/idb/records.test.ts`, agregar roundtrip de `ScheduledVisitRecord` y de `ReminderRecord` con `scheduledVisitId`.

Crear `tests/infrastructure/idb/idb-scheduled-visit-repository.test.ts` cubriendo `save/findById/listByField/findActiveByField/listActive` (mismo patrón que `idb-visit-repository` / `idb-catalog-repositories`).

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npx vitest run tests/infrastructure/idb/open-campo-db.test.ts tests/infrastructure/idb/records.test.ts tests/infrastructure/idb/idb-scheduled-visit-repository.test.ts`
Expected: FAIL — store/registro no existen.

- [ ] **Step 3: Implementación mínima**

`open-campo-db.ts`:

```ts
export interface CampoSchema extends DBSchema {
  zones: { key: string; value: ZoneRecord };
  clients: { key: string; value: ClientRecord };
  fields: { key: string; value: FieldRecord };
  visits: { key: string; value: VisitRecord; indexes: { 'by-field': string } };
  reminders: { key: string; value: ReminderRecord; indexes: { 'by-field': string } };
  scheduledVisits: { key: string; value: ScheduledVisitRecord; indexes: { 'by-field': string } };
}

export function openCampoDb(name = 'campo'): Promise<CampoDb> {
  return openDB<CampoSchema>(name, 2, {
    upgrade(db, oldVersion, _newVersion, _tx) {
      if (oldVersion < 1) {
        db.createObjectStore('zones', { keyPath: 'id' });
        db.createObjectStore('clients', { keyPath: 'id' });
        db.createObjectStore('fields', { keyPath: 'id' });
        const visits = db.createObjectStore('visits', { keyPath: 'id' });
        visits.createIndex('by-field', 'fieldId');
        const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
        reminders.createIndex('by-field', 'fieldId');
      }
      if (oldVersion < 2) {
        const scheduled = db.createObjectStore('scheduledVisits', { keyPath: 'id' });
        scheduled.createIndex('by-field', 'fieldId');
      }
    },
  });
}
```

`records.ts`:

```ts
export interface ScheduledVisitRecord {
  id: string;
  fieldId: string;
  scheduledDate: Date;
  reminderLeadDays: number;
  createdAt: Date;
  notes?: string;
  status: ScheduledVisitStatus;
  cancelledAt?: Date;
}
```

`ReminderRecord` gana `scheduledVisitId?: string;` y `toReminderRecord`/`fromReminderRecord` lo propagan. Agregar `toScheduledVisitRecord`/`fromScheduledVisitRecord` (mismo patrón que `Visit`).

`idb-scheduled-visit-repository.ts`:

```ts
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toScheduledVisitRecord, fromScheduledVisitRecord } from './records';

export class IdbScheduledVisitRepository implements ScheduledVisitRepository {
  constructor(private readonly db: CampoDb) {}

  async save(item: ScheduledVisit): Promise<void> {
    await this.db.put('scheduledVisits', toScheduledVisitRecord(item));
  }

  async findById(id: ScheduledVisitId): Promise<ScheduledVisit | null> {
    const record = await this.db.get('scheduledVisits', id);
    return record ? fromScheduledVisitRecord(record) : null;
  }

  async listByField(fieldId: FieldId): Promise<ScheduledVisit[]> {
    const records = await this.db.getAllFromIndex('scheduledVisits', 'by-field', fieldId);
    return records.map(fromScheduledVisitRecord);
  }

  async findActiveByField(fieldId: FieldId): Promise<ScheduledVisit | null> {
    const records = await this.db.getAllFromIndex('scheduledVisits', 'by-field', fieldId);
    const match = records.find((r) => r.status === 'ACTIVE');
    return match ? fromScheduledVisitRecord(match) : null;
  }

  async listActive(): Promise<ScheduledVisit[]> {
    const records = await this.db.getAll('scheduledVisits');
    return records.filter((r) => r.status === 'ACTIVE').map(fromScheduledVisitRecord);
  }
}
```

`idb-data-reset.ts`:

```ts
const STORES = ['zones', 'clients', 'fields', 'visits', 'reminders', 'scheduledVisits'] as const;
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run tests/infrastructure/idb/open-campo-db.test.ts tests/infrastructure/idb/records.test.ts tests/infrastructure/idb/idb-scheduled-visit-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/idb/open-campo-db.ts src/infrastructure/persistence/idb/records.ts src/infrastructure/persistence/idb/idb-scheduled-visit-repository.ts src/infrastructure/persistence/idb/idb-data-reset.ts tests/infrastructure/idb/
git commit -m "feat(idb): schema v2 con store scheduled-visits + repo + reset"
```

---

### Task 12: Infraestructura in-memory + composition

**Files:**
- Create: `src/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository.ts`
- Modify: `src/composition/container.ts`
- Modify: `tests/support/in-memory-container.ts`
- Modify: `tests/infrastructure/in-memory/in-memory-scheduled-visit-repository.test.ts` (crear)
- Modify: `tests/ui/agenda-screen.test.tsx` (callers de `wireCatalogUseCases`)
- Modify: `tests/application/schedule-visit.test.ts` (agregar los 2 tests pospuestos de Task 4)

**Interfaces:**
- Produces: repo in-memory (con `clear()`), `wireCatalogUseCases` gana `scheduledVisits` (y el reset lo incluye), `makeInMemoryContainer` cablea `ScheduleVisit`, `CancelScheduledVisit`, `EditScheduledVisit`, `GetScheduledVisit` y actualiza los constructores de `RecordVisit`, `ListUpcomingVisits`, `GetFieldHistory`. `container.ts` (idb) cablea lo mismo con `IdbScheduledVisitRepository`.

- [ ] **Step 1: Escribir el test que falla**

`tests/infrastructure/in-memory/in-memory-scheduled-visit-repository.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

const base = {
  id: 's1',
  fieldId: 'f1',
  scheduledDate: new Date('2026-08-10T00:00:00Z'),
  reminderLeadDays: 3,
  createdAt: new Date('2026-07-31T12:00:00Z'),
};

describe('InMemoryScheduledVisitRepository', () => {
  it('implements the full contract', async () => {
    const repo = new InMemoryScheduledVisitRepository();
    await repo.save(new ScheduledVisit({ ...base }));
    await repo.save(new ScheduledVisit({ ...base, id: 's2', status: 'CANCELLED', cancelledAt: base.createdAt }));

    expect((await repo.findById('s1'))?.id).toBe('s1');
    expect(await repo.findById('nope')).toBeNull();
    expect((await repo.listByField('f1')).map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect((await repo.findActiveByField('f1'))?.id).toBe('s1');
    expect((await repo.listActive()).map((s) => s.id)).toEqual(['s1']);
    repo.clear();
    expect(await repo.listActive()).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/infrastructure/in-memory/in-memory-scheduled-visit-repository.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementación mínima**

`in-memory-scheduled-visit-repository.ts`:

```ts
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';

export class InMemoryScheduledVisitRepository implements ScheduledVisitRepository {
  private readonly items = new Map<ScheduledVisitId, ScheduledVisit>();

  async save(item: ScheduledVisit): Promise<void> {
    this.items.set(item.id, item);
  }

  async findById(id: ScheduledVisitId): Promise<ScheduledVisit | null> {
    return this.items.get(id) ?? null;
  }

  async listByField(fieldId: FieldId): Promise<ScheduledVisit[]> {
    return [...this.items.values()].filter((item) => item.fieldId === fieldId);
  }

  async findActiveByField(fieldId: FieldId): Promise<ScheduledVisit | null> {
    for (const item of this.items.values()) {
      if (item.fieldId === fieldId && item.status === 'ACTIVE') return item;
    }
    return null;
  }

  async listActive(): Promise<ScheduledVisit[]> {
    return [...this.items.values()].filter((item) => item.status === 'ACTIVE');
  }

  clear(): void {
    this.items.clear();
  }
}
```

`tests/support/in-memory-container.ts`:
- `wireCatalogUseCases` gana parámetro `scheduledVisits: InMemoryScheduledVisitRepository`; el `InMemoryDataReset` suma `() => scheduledVisits.clear()`.
- `makeInMemoryContainer` crea `const scheduledVisits = new InMemoryScheduledVisitRepository();` y cablea:
  - `recordVisit: new RecordVisit(fields, visits, reminders, scheduledVisits, clock, ids)`
  - `getFieldHistory: new GetFieldHistory(fields, visits, scheduledVisits)`
  - `listUpcomingVisits: new ListUpcomingVisits(fields, visits, scheduledVisits, clock)`
  - `scheduleVisit`, `cancelScheduledVisit`, `editScheduledVisit`, `getScheduledVisit` (nuevos use cases).
- Actualizar `wireCatalogUseCases(zones, clients, fields, visits, reminders, scheduledVisits, ids)` en los 3 callers (`in-memory-container.ts` y 2 de `agenda-screen.test.tsx`).

`src/composition/container.ts`:
- import `IdbScheduledVisitRepository` y los 4 use cases nuevos; `Container` interface gana `scheduleVisit`, `cancelScheduledVisit`, `editScheduledVisit`, `getScheduledVisit`.
- `buildContainer`: `const scheduled = new IdbScheduledVisitRepository(db);` y cablear igual que el in-memory (constructor de `RecordVisit`, `GetFieldHistory`, `ListUpcomingVisits`).

`tests/application/schedule-visit.test.ts`: agregar los 2 tests pospuestos ("reemplaza ACTIVE" y "cancela PENDING") que quedaron pendientes en Task 4.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run tests/infrastructure/in-memory/in-memory-scheduled-visit-repository.test.ts tests/application/schedule-visit.test.ts tests/application/record-visit.rules.test.ts tests/application/cancel-scheduled-visit.test.ts tests/application/edit-scheduled-visit.test.ts tests/application/get-scheduled-visit.test.ts tests/application/list-upcoming-visits.test.ts tests/application/get-field-history.test.ts tests/ui/agenda-screen.test.tsx tests/composition/container.test.ts`
Expected: PASS. Luego `npm test` completo + `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository.ts src/composition/container.ts tests/support/in-memory-container.ts tests/infrastructure/in-memory/ tests/application/schedule-visit.test.ts tests/ui/agenda-screen.test.tsx tests/composition/container.test.ts
git commit -m "feat(composition): cablear ScheduledVisit en container idb e in-memory"
```

---

### Task 13: UI — `FieldHistoryScreen` (botón Programar + lista de programadas)

**Files:**
- Modify: `src/ui/screens/FieldHistoryScreen.tsx`
- Modify: `src/ui/styles.css` (`.list-actions`)
- Test: `tests/ui/field-history-screen.test.tsx`

**Interfaces:**
- Produces: botón "Programar visita" (btn-secondary) bajo "Registrar visita"; la lista mezcla visitas y programadas ordenadas por fecha desc; las programadas muestran nombre = fecha, sub = notas, badge "Programada"/"Cancelada" y linkean al detalle.

- [ ] **Step 1: Escribir el test que falla**

En `tests/ui/field-history-screen.test.tsx`, agregar (seed con programada ACTIVE vía `makeInMemoryContainer` + `c.scheduleVisit`):

```tsx
  it('shows scheduled visits with a badge and a Programar button', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    await c.scheduleVisit.execute({ fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3 });
    renderScreen(c);

    const link = await screen.findByRole('link', { name: /Programar visita/i });
    expect(link).toHaveAttribute('href', '/field/f1/programar');
    const row = await screen.findByRole('link', { name: /10 ago/i });
    expect(row).toHaveTextContent(/Programada/);
  });
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/ui/field-history-screen.test.tsx`
Expected: FAIL — sin botón/fila de programada.

- [ ] **Step 3: Implementación mínima**

`FieldHistoryScreen.tsx` — dentro del `.list-header` (tras "Registrar visita"):

```tsx
        <div className="list-actions">
          <Link className="btn-primary" to={`/field/${fieldId}/record`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Registrar visita</Link>
          <Link className="btn-secondary" to={`/field/${fieldId}/programar`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Programar visita</Link>
        </div>
```

Y la lista: combinar `view.visits` + `view.scheduledVisits` en un array ordenado por fecha desc. Renderizar las programadas con badge:

```tsx
          {view.scheduledVisits.map((s) => (
            <li key={s.id}>
              <Link className="field-row" to={`/field/${fieldId}/programadas/${s.id}`}>
                <span className="field-text">
                  <span className="field-name">{dateLabel(s.scheduledDate)}</span>
                  <span className="field-sub">{s.notes ?? 'Sin notas'}</span>
                </span>
                <span className={`visit-badge ${s.status === 'CANCELLED' ? 'is-cancelled' : 'is-scheduled'}`}>
                  {s.status === 'CANCELLED' ? 'Cancelada' : 'Programada'}
                </span>
              </Link>
            </li>
          ))}
```

`styles.css`:

```css
.list-actions { display: flex; gap: var(--space-2); }
.list-actions > .btn-primary, .list-actions > .btn-secondary { flex: 1; }
.visit-badge.is-scheduled { background: var(--segment-bg); color: var(--accent); }
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/ui/field-history-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + suite**

Run: `npm run typecheck` y `npx vitest run tests/ui/field-history-screen.test.tsx`
Expected: verdes.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/FieldHistoryScreen.tsx src/ui/styles.css tests/ui/field-history-screen.test.tsx
git commit -m "feat(ui): historial con botón Programar visita y filas de programadas"
```

---

### Task 14: UI — `ScheduledVisitFormScreen` (alta/edición)

**Files:**
- Create: `src/ui/screens/ScheduledVisitFormScreen.tsx`
- Create: `src/ui/hooks/use-schedule-visit.ts`
- Create: `src/ui/hooks/use-edit-scheduled-visit.ts`
- Test: `tests/ui/scheduled-visit-form-screen.test.tsx` (crear)

**Interfaces:**
- Produces: form de programación (fecha mín mañana, aviso días antes con max = gap, notas) para alta y edición; `ScheduledVisitFormScreen` para `/field/:fieldId/programar` y `/field/:fieldId/programar/:scheduledVisitId`; back dinámico reusando el patrón de `RecordVisitScreen`.

- [ ] **Step 1: Escribir el test que falla**

`tests/ui/scheduled-visit-form-screen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ScheduledVisitFormScreen } from '@/ui/screens/ScheduledVisitFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderForm(path = '/field/f1/programar') {
  return render(
    <CampoProvider container={makeInMemoryContainer()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/field/:fieldId/programar" element={<ScheduledVisitFormScreen />} />
          <Route path="/field/:fieldId/programar/:scheduledVisitId" element={<ScheduledVisitFormScreen />} />
          <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('ScheduledVisitFormScreen', () => {
  it('schedules a visit and navigates back to the history', async () => {
    renderForm();
    const date = isoInDays(10);
    await userEvent.type(screen.getByLabelText('Fecha'), date);
    await userEvent.click(screen.getByRole('button', { name: /Programar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });

  it('minimiza la fecha a mañana', () => {
    renderForm();
    const input = screen.getByLabelText('Fecha') as HTMLInputElement;
    expect(input).toHaveAttribute('min', isoInDays(1));
  });

  it('edits an existing scheduled visit', async () => {
    const c = makeInMemoryContainer();
    const { scheduledVisitId } = await c.scheduleVisit.execute({
      fieldId: 'f1',
      scheduledDate: new Date(`${isoInDays(10)}T00:00:00.000Z`),
      reminderLeadDays: 3,
    });
    renderForm(`/field/f1/programar/${scheduledVisitId}`);
    await userEvent.clear(screen.getByLabelText('Notas'));
    await userEvent.type(screen.getByLabelText('Notas'), 'revisar siembra');
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/ui/scheduled-visit-form-screen.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementación mínima**

Hooks (mismo patrón que `use-record-visit` / `use-edit-visit`):

`use-schedule-visit.ts` → `submit(input)` devuelve `{ submitting, error, result }`.
`use-edit-scheduled-visit.ts` → `submit(input)` devuelve `{ submitting, error, done }`.

`ScheduledVisitFormScreen.tsx` — patrón de `RecordVisitScreen`:
- `const { fieldId = '', scheduledVisitId } = useParams();`
- Si `scheduledVisitId` → cargar con `getScheduledVisit.execute(id)` y prefill (`scheduledDate`, `reminderLeadDays`, `notes`).
- Estado local: `scheduledDate` (default `futureIso(14)`), `leadDays` (default 3), `notes`.
- `gapMax = Math.max(1, daysBetween(today, scheduledDate))`.
- Submit: alta → `scheduleVisit.execute({ fieldId, scheduledDate: utcDate(scheduledDate), reminderLeadDays: leadDays, notes })`; edición → `editScheduledVisit.execute({ scheduledVisitId, ... })`.
- Al `result`/`done` → `navigate('/field/${fieldId}/visitas')`.
- Back dinámico: `location.state?.back ?? { label: 'Historial', to: '/field/' + fieldId + '/visitas' }`.
- Error con `domainErrorMessage` (agregar casos en Task 16).
- Botón submit: "Programar" (alta) / "Guardar" (edición).

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/ui/scheduled-visit-form-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/ScheduledVisitFormScreen.tsx src/ui/hooks/use-schedule-visit.ts src/ui/hooks/use-edit-scheduled-visit.ts tests/ui/scheduled-visit-form-screen.test.tsx
git commit -m "feat(ui): pantalla de programar/editar visita futura"
```

---

### Task 15: UI — `ScheduledVisitDetailScreen` (detalle + cancelar)

**Files:**
- Create: `src/ui/screens/ScheduledVisitDetailScreen.tsx`
- Create: `src/ui/hooks/use-scheduled-visit.ts`
- Create: `src/ui/hooks/use-cancel-scheduled-visit.ts`
- Test: `tests/ui/scheduled-visit-detail-screen.test.tsx` (crear)

**Interfaces:**
- Produces: detalle de una programada (fecha, aviso, notas, badge); si ACTIVE → Editar (a la pantalla de edición) y Cancelar (ConfirmDialog); al cancelar navega al historial.

- [ ] **Step 1: Escribir el test que falla**

`tests/ui/scheduled-visit-detail-screen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ScheduledVisitDetailScreen } from '@/ui/screens/ScheduledVisitDetailScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

describe('ScheduledVisitDetailScreen', () => {
  it('shows the scheduled visit and cancels it', async () => {
    const c = makeInMemoryContainer();
    const { scheduledVisitId } = await c.scheduleVisit.execute({
      fieldId: 'f1',
      scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
      reminderLeadDays: 3,
      notes: 'revisar',
    });
    render(
      <CampoProvider container={c}>
        <MemoryRouter initialEntries={[`/field/f1/programadas/${scheduledVisitId}`]}>
          <Routes>
            <Route path="/field/:fieldId/programadas/:scheduledVisitId" element={<ScheduledVisitDetailScreen />} />
            <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
            <Route path="/field/:fieldId/programar/:scheduledVisitId" element={<div>Editar</div>} />
          </Routes>
        </MemoryRouter>
      </CampoProvider>,
    );

    expect(await screen.findByText(/10 ago/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/ui/scheduled-visit-detail-screen.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementación mínima**

Hooks: `use-scheduled-visit.ts` (carga vía `getScheduledVisit`), `use-cancel-scheduled-visit.ts` (patrón `use-cancel-visit`).

`ScheduledVisitDetailScreen.tsx`:
- Cargar con `useScheduledVisit(id)`; estados: cargando / no encontrado / cancelada (vista informativa).
- Header `.record` con back dinámico al historial.
- Si ACTIVE: botón Editar (Link a `/field/:fieldId/programar/:id` con state back al historial) + botón Cancelar (ConfirmDialog). Al `done` → `navigate('/field/' + fieldId + '/visitas')`.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/ui/scheduled-visit-detail-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/ScheduledVisitDetailScreen.tsx src/ui/hooks/use-scheduled-visit.ts src/ui/hooks/use-cancel-scheduled-visit.ts tests/ui/scheduled-visit-detail-screen.test.tsx
git commit -m "feat(ui): detalle de programada con editar/cancelar"
```

---

### Task 16: UI — routing + error messages

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/error-messages.ts`
- Test: `tests/ui/error-messages.test.ts`

**Interfaces:**
- Produces: rutas `/field/:fieldId/programar`, `/field/:fieldId/programar/:scheduledVisitId`, `/field/:fieldId/programadas/:scheduledVisitId`; mensajes en español para los errores nuevos.

- [ ] **Step 1: Escribir el test que falla**

En `tests/ui/error-messages.test.ts`, agregar:

```ts
  it('maps the new scheduled-visit errors', () => {
    expect(domainErrorMessage(new ScheduledDateNotFuture(''))).toContain('futura');
    expect(domainErrorMessage(new ScheduledVisitNotFound(''))).toContain('programada');
    expect(domainErrorMessage(new ScheduledVisitAlreadyCancelled(''))).toContain('cancelada');
  });
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/ui/error-messages.test.ts`
Expected: FAIL — casos sin mapear (cae al default).

- [ ] **Step 3: Implementación mínima**

`src/ui/error-messages.ts` — agregar al switch de `domainErrorMessage`:

```ts
    case 'ScheduledDateNotFuture':
      return 'La fecha programada debe ser futura.';
    case 'ScheduledVisitNotFound':
      return 'No se encontró la visita programada.';
    case 'ScheduledVisitAlreadyCancelled':
      return 'La visita programada ya fue cancelada.';
```

`src/ui/App.tsx` — agregar rutas (fuera del layout con tabs):

```tsx
      <Route path="/field/:fieldId/programar" element={<ScheduledVisitFormScreen />} />
      <Route path="/field/:fieldId/programar/:scheduledVisitId" element={<ScheduledVisitFormScreen />} />
      <Route path="/field/:fieldId/programadas/:scheduledVisitId" element={<ScheduledVisitDetailScreen />} />
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/ui/error-messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + suite**

Run: `npm run typecheck` y `npm test`
Expected: verdes.

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.tsx src/ui/error-messages.ts tests/ui/error-messages.test.ts
git commit -m "feat(ui): rutas de programadas + mensajes de error en español"
```

---

### Task 17: Docs — cerrar la etapa en ROADMAP

**Files:**
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Produces: Etapa 4c como ✅ completa, fecha de actualización, fila de backlog, y diferidos nuevos (si aplica).

- [ ] **Step 1: Actualizar**

En `docs/ROADMAP.md`:
- Nueva fila en la tabla de etapas: `| **4c — programar visitas** | Agendar una visita futura a un lote (visitado o no) con aviso propio; reemplaza la programada previa; `RecordVisit` la consume; precedencia en la agenda | ✅ Completa |`
- `Última actualización: 2026-07-31.`
- Sumar al "Se puede hacer hoy": programar/editar/cancelar visitas futuras con aviso, visibles en agenda e historial.
- Diferidos de 4c (del spec, sección Diferidos).

- [ ] **Step 2: Verificar suite completa**

Run: `npm test` y `npm run typecheck`
Expected: verdes.

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(etapa-4c): cerrar la etapa en el ROADMAP"
```

---

### Task 18: Verificación final

- [ ] **Step 1: Suite completa + typecheck**

Run: `npm test` y `npm run typecheck`
Expected: todos los tests verdes, sin errores de tipos.

- [ ] **Step 2: Revisar diffs**

`git status` y `git log --oneline main..HEAD` — cada commit debe ser coherente (un tema por commit).

- [ ] **Step 3: Merge a main**

```bash
git checkout main && git merge --no-ff etapa-4c-programar-visitas -m "merge: Etapa 4c — programar visitas futuras"
```
