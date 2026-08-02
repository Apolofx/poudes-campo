# Etapa — Unificar visitas: una sola entidad `Visit` con ciclo de vida — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-08-02-unificar-visitas-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `etapa-unificar-visitas`. Al cerrar: merge --no-ff a `main`.
>
> **Nota sobre el verde intermedio:** es un big-bang de dominio (la entidad `Visit` cambia y
> `ScheduledVisit`/`followUp` mueren), así que entre las Tareas 1 y 5 la suite puede estar roja en las
> capas aún no migradas. Cada tarea deja verdes **los tests de su capa**; la suite completa queda
> verde antes del merge.

## Tareas

### Tarea 1 — Dominio puro unificado (entidad, errores, ids, reminder)

- [ ] Rojo: `tests/domain/entities/visit.test.ts` reescrito (invariantes por estado: PENDING exige `plannedFor`+lead, DONE exige `visitedAt`, CANCELLED exige `cancelledAt`; PENDING→DONE conserva `plannedFor`); `tests/domain/entities/reminder.test.ts` sin `scheduledVisitId`.
- [ ] Implementación: `src/domain/entities/visit.ts` (estados + invariantes), `src/domain/entities/reminder.ts` (sin `scheduledVisitId`), `src/domain/shared/errors.ts` (nuevos `InvalidVisit`, `PlannedDateNotFuture`; fuera `InvalidScheduledVisit`, `IncompleteFollowUp`, `ScheduledDateNotFuture`, `ScheduledVisitNotFound`, `ScheduledVisitAlreadyCancelled`, `InvalidVisitInterval`), `src/domain/shared/ids.ts` (fuera `ScheduledVisitId`).
- [ ] Eliminar: `src/domain/entities/scheduled-visit.ts`, `src/domain/value-objects/visit-interval.ts`.
- [ ] Verde (tests de dominio) → commit `refactor(domain): Visit con ciclo de vida (PENDING|DONE|CANCELLED); muere ScheduledVisit y followUp`

### Tarea 2 — Puertos + adaptadores + records v3

- [ ] Rojo: `tests/domain/ports/visit-repository.test.ts` (nuevo; contrato: `findDoneByFieldOnDay`, `findPendingByField`, `findPendings`); `tests/infrastructure/idb/idb-visit-repository.test.ts` y `tests/infrastructure/in-memory-visit-followups.test.ts` actualizados.
- [ ] `src/domain/ports/outbound/visit-repository.ts` rework (fuera `CurrentFollowUp`/`findCurrentFollowUps`/`findActiveByFieldOnDay`; nuevos `findDoneByFieldOnDay`, `findPendingByField`, `findPendings`).
- [ ] `src/infrastructure/persistence/idb/records.ts`: `VisitRecord` con `status: 'PENDING'|'DONE'|'CANCELLED'` + `plannedFor?/visitedAt?/reminderLeadDays?`; fuera `ScheduledVisitRecord` y mappers; `ReminderRecord` sin `scheduledVisitId`.
- [ ] Adaptadores: `idb-visit-repository.ts`, `in-memory-visit-repository.ts`; eliminar `idb-scheduled-visit-repository.ts` + `in-memory-scheduled-visit-repository.ts`.
- [ ] Verde (tests de infra) → commit `refactor(infra): VisitRepository unificado; elimina ScheduledVisitRepository`

### Tarea 3 — Migración idb v2 → v3

- [ ] Rojo: `tests/infrastructure/idb/open-campo-db.test.ts` — casos de 6.2 del spec (ACTIVE→DONE, followUp ganadora→PENDING con lead recuperado del reminder, scheduled→PENDING mismo id, reconciliación de doble PENDIENTE, re-anejo de reminders, fresh-open crea schema v3 sin `scheduled-visits`).
- [ ] Implementación `src/infrastructure/persistence/idb/open-campo-db.ts` (versión 3; el bloque `<1` crea schema v3 directo; el bloque de migración corre solo si `oldVersion >= 1`; se elimina el bloque `<2`).
- [ ] Verde + typecheck → commit `feat(infra): migración idb v2→v3 unifica scheduled-visits en visits`

### Tarea 4 — Aplicación: casos de uso de escritura

- [ ] Rojo→verde por caso de uso (ver código en referencia):
  - `record-visit.test.ts` (+ `record-visit.happy.test.ts`): cumple PENDIENTE, cumple temprano, sin PENDIENTE crea DONE, duplicado solo entre DONE, "volver" crea PENDIENTE + reminder anclado a ella.
  - `schedule-visit.test.ts` + `schedule-visit-ensuring-field.test.ts`: reemplaza PENDIENTE previa, fecha no futura, clamp, reminder por `visitId`.
  - `cancel-visit.test.ts`: cancela PENDING y DONE, cancela reminder propio, idempotente.
  - `edit-visit.test.ts`: edición PENDING y DONE (ver spec §3).
  - Eliminar `cancel-scheduled-visit.test.ts`, `edit-scheduled-visit.test.ts`, `get-scheduled-visit.test.ts`, `follow-up.test.ts`.
- [ ] Implementación: `record-visit.ts`, `schedule-visit.ts`, `cancel-visit.ts`, `edit-visit.ts`; nuevo `next-visit.ts` (resuelve "volver"); eliminar `follow-up.ts`, `cancel-scheduled-visit.ts`, `edit-scheduled-visit.ts`, `get-scheduled-visit.ts`.
- [ ] Verde (tests de aplicación) + typecheck → commit `feat(application): registro/programación/cancelación/edición sobre Visit unificado`

### Tarea 5 — Aplicación: casos de uso de lectura + wiring

- [ ] Rojo→verde: `get-field-history.test.ts` (lista unificada), `list-upcoming-visits.test.ts` (agenda desde `findPendings`, una sola voz estructural), `dispatch-due-reminders.test.ts` (`nextVisitDate` desde la PENDIENTE).
- [ ] Implementación: `get-field-history.ts`, `list-upcoming-visits.ts`, `dispatch-due-reminders.ts`.
- [ ] Wiring: `src/composition/container.ts` y `tests/support/in-memory-container.ts` (sin `scheduled`; constructores nuevos). `tests/composition/container.test.ts` ajustado.
- [ ] Verde (suite completa de aplicación+infra+composición) + typecheck → commit `refactor(application): lecturas y container sobre modelo unificado`

### Tarea 6 — UI: hooks + pantallas

- [ ] Rojo→verde por pantalla:
  - `field-history-screen.test.tsx`: lista unificada + badges Programada/Realizada/Cancelada.
  - `record-visit-screen.test.tsx`: cumple PENDIENTE (precarga + hint "Estaba programada para el X"), botón cancelar dirigido a la PENDIENTE.
  - `visit-detail-screen.test.tsx`: render por estado (PENDING/DONE) + editar/cancelar.
  - `scheduled-visit-form-screen.test.tsx`: crea/edita PENDIENTE (ruta `/programar`).
  - Eliminar `scheduled-visit-detail-screen.test.tsx`.
- [ ] Implementación: hooks (`use-field-history` expone `visits`; eliminar `use-cancel-scheduled-visit`, `use-edit-scheduled-visit`, `use-scheduled-visit`), screens (`FieldHistoryScreen`, `RecordVisitScreen`, `VisitDetailScreen`, `ScheduledVisitFormScreen`; eliminar `ScheduledVisitDetailScreen`), rutas en `App.tsx`.
- [ ] Verde (suite completa) + typecheck → commit `feat(ui): detalle unificado y cumplimiento de la programada`

### Tarea 7 — Cierre

- [ ] Actualizar `docs/ROADMAP.md` (fila de etapa + "Se puede hacer hoy" + diferidos cerrados).
- [ ] Suite completa verde + typecheck + `npm run build`.
- [ ] Merge --no-ff a `main`, borrar rama.

---

## Código de referencia (por tarea)

### Tarea 1

```ts
// src/domain/entities/visit.ts
import type { VisitId, FieldId } from '@/domain/shared/ids';
import { InvalidVisit } from '@/domain/shared/errors';

export type VisitStatus = 'PENDING' | 'DONE' | 'CANCELLED';

export interface VisitProps {
  id: VisitId;
  fieldId: FieldId;
  status: VisitStatus;
  plannedFor?: Date;         // requerido en PENDING; se conserva al cumplir
  visitedAt?: Date;          // requerido en DONE
  reminderLeadDays?: number; // requerido en PENDING
  notes?: string;
  createdAt: Date;
  cancelledAt?: Date;
}

export class Visit {
  readonly id: VisitId;
  readonly fieldId: FieldId;
  readonly status: VisitStatus;
  readonly plannedFor?: Date;
  readonly visitedAt?: Date;
  readonly reminderLeadDays?: number;
  readonly notes?: string;
  readonly createdAt: Date;
  readonly cancelledAt?: Date;

  constructor(props: VisitProps) {
    if (props.status === 'PENDING' && !props.plannedFor) {
      throw new InvalidVisit('PENDING visit requires plannedFor');
    }
    if (props.status === 'PENDING' && (props.reminderLeadDays ?? 0) < 0) {
      throw new InvalidVisit('PENDING visit requires a non-negative reminderLeadDays');
    }
    if (props.status === 'DONE' && !props.visitedAt) {
      throw new InvalidVisit('DONE visit requires visitedAt');
    }
    if (props.status === 'CANCELLED' && !props.cancelledAt) {
      throw new InvalidVisit('CANCELLED visit requires cancelledAt');
    }
    this.id = props.id;
    this.fieldId = props.fieldId;
    this.status = props.status;
    this.plannedFor = props.plannedFor;
    this.visitedAt = props.visitedAt;
    this.reminderLeadDays = props.reminderLeadDays;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.cancelledAt = props.cancelledAt;
  }
}
```

`reminder.ts`: quitar `scheduledVisitId` (import, `ReminderProps`, `readonly`, asignación). `ids.ts`: quitar `ScheduledVisitId`. `errors.ts`: ver spec §1.

### Tarea 2

```ts
// src/domain/ports/outbound/visit-repository.ts
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';

export interface VisitRepository {
  save(visit: Visit): Promise<void>;
  findById(id: VisitId): Promise<Visit | null>;
  findDoneByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null>;
  listByField(fieldId: FieldId): Promise<Visit[]>;
  findPendingByField(fieldId: FieldId): Promise<Visit | null>;
  findPendings(): Promise<Visit[]>;
}
```

`VisitRecord` v3: `{ id, fieldId, status: VisitStatus, plannedFor?, visitedAt?, reminderLeadDays?, notes?, createdAt, cancelledAt? }`.
Adaptadores: mapeo mecánico; `findPendingByField` = primer `status === 'PENDING'` del field; `findPendings` = todos los PENDING; `findDoneByFieldOnDay` filtra `status === 'DONE'` + día-calendario (mismo criterio que el `findActiveByFieldOnDay` actual).

### Tarea 3 — migración (esqueleto)

```ts
// open-campo-db.ts — versión 3
export function openCampoDb(name = 'campo'): Promise<CampoDb> {
  return openDB<CampoSchema>(name, 3, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        // schema v3 directo: zones, clients, fields, visits (índice by-field), reminders (índice by-field)
        // SIN scheduled-visits
        return;
      }
      if (oldVersion >= 1) {
        // migración v1/v2 → v3 (async: el upgrade espera la promesa):
        // 1. leer tx.objectStore('visits').getAll(), reminders.getAll(), y (si oldVersion >= 2)
        //    scheduled-visits.getAll() ANTES de borrarla.
        // 2. por field: la ACTIVE más reciente con followUp → crear PENDING nueva (id nuevo),
        //    plannedFor = nextVisitDate, lead = round((nextVisitDate - remindAt)/86400000) del
        //    reminder que apuntaba a esa visita (clamp >= 0; default 0).
        // 3. reescribir cada visita vieja: ACTIVE→DONE (visitedAt=visitDate); CANCELLED→CANCELLED.
        //    Cada scheduled: ACTIVE→PENDING (mismo id, plannedFor=scheduledDate, lead guardado);
        //    CANCELLED→CANCELLED.
        // 4. reconciliar: por field, si hay >1 PENDING, gana createdAt más reciente; las demás → CANCELLED.
        // 5. reescribir reminders: sin scheduledVisitId; visitId = el id de la PENDING que corresponda.
        // 6. db.deleteObjectStore('scheduled-visits').
      }
    },
  });
}
```

El test de fresh-open debe cubrir que un DB nuevo (oldVersion 0) **no** intenta borrar `scheduled-visits` (no existe).

### Tarea 4 — casos de uso de escritura

```ts
// src/application/use-cases/next-visit.ts (reemplaza follow-up.ts)
import { addDays, daysBetween } from '@/domain/shared/date-utils';
import { clampLeadDays } from '@/application/use-cases/clamp'; // o mover clamp acá

export type NextVisitInput =
  | { kind: 'interval'; days: number; reminderLeadDays?: number }
  | { kind: 'date'; date: Date; reminderLeadDays?: number }
  | { kind: 'none' };

export function resolveNextPending(
  input: NextVisitInput,
  now: Date,
): { plannedFor: Date; reminderLeadDays: number } | undefined {
  if (input.kind === 'none') return undefined;
  if (input.kind === 'interval' && !(input.days >= 1)) throw new InvalidVisit('interval days must be positive');
  const plannedFor = input.kind === 'interval' ? addDays(now, input.days) : input.date;
  return {
    plannedFor,
    reminderLeadDays: clampLeadDays(input.reminderLeadDays ?? 0, daysBetween(now, plannedFor)),
  };
}
```

```ts
// src/application/use-cases/record-visit.ts — núcleo
export interface RecordVisitInput {
  fieldId: FieldId;
  visitedAt: Date;
  notes?: string;
  next?: NextVisitInput;   // el "volver": crea una PENDIENTE
}
export interface RecordVisitResult { visitId: VisitId; pendingId?: VisitId; reminderId?: ReminderId }

// 1. field existe; 2. visitedAt <= now (FutureVisitDate);
// 3. findDoneByFieldOnDay → DuplicateVisitForDay;
// 4. pending = findPendingByField:
//      existe → save Visit({ ...pending, status:'DONE', visitedAt, notes, sin reminderLeadDays })
//      no     → save Visit({ id: ids.next(), fieldId, status:'DONE', visitedAt, notes, createdAt: now })
// 5. cancelar todos los reminders PENDING del field (loop existente);
// 6. si resolveNextPending(input.next, now) → crear PENDING (plannedFor, lead, createdAt: now)
//    + Reminder({ id, visitId: pendingId, fieldId, remindAt: addDays(plannedFor, -lead) });
// 7. devolver { visitId, pendingId?, reminderId? }
```

`schedule-visit.ts`: `{ fieldId, plannedFor, reminderLeadDays, notes? }` → field existe; `plannedFor > now`
(`PlannedDateNotFuture`); si `findPendingByField` → cancelar (CANCELLED + `cancelledAt`); cancelar los
PENDING del field; clamp `[0, daysBetween(now, plannedFor)]`; crear PENDING + Reminder(`visitId` del
pending). Resultado `{ visitId, reminderId }`.

`cancel-visit.ts`: generaliza (PENDING o DONE); reconstruye con todas las props previas + `status:
'CANCELLED'`, `cancelledAt`; cancela el reminder propio (`rm.visitId === visit.id`).

`edit-visit.ts`: PENDING → `{ plannedFor, reminderLeadDays, notes? }` (fecha futura, reclamp, cancelar +
recrear reminder propio); DONE → `{ visitedAt, notes? }` (no futura, duplicado, **sin** follow-up).

### Tarea 5 — lecturas y wiring

`get-field-history.ts`: view `{ field, clientName?, zoneName?, visits }` con una sola lista ordenada desc
por `(visitedAt ?? plannedFor)` y desempate `createdAt`. `list-upcoming-visits.ts`:
`findPendings()` + join jerarquía, `nextVisitDate = plannedFor`, `VisitUrgency.of`. `dispatch-due-reminders.ts`:
`findPendings()` en vez de `findCurrentFollowUps` (`nextByField = plannedFor`), mismo fallback `?? remindAt`.

`container.ts` / `in-memory-container.ts`: sin `scheduled`; `RecordVisit(fields, visits, reminders, clock,
ids)`, `ScheduleVisit(fields, visits, reminders, clock, ids)`, `GetFieldHistory(fields, visits)`,
`ListUpcomingVisits(fields, visits, clock)`; eliminar `cancelScheduledVisit`, `editScheduledVisit`,
`getScheduledVisit` del interface.

### Tarea 6 — UI (claves)

- **Badges**: `PENDING` → "Programada", `DONE` → "Realizada", `CANCELLED` → "Cancelada".
- **`FieldHistoryScreen`**: una lista `view.visits`; fila → `/field/:fieldId/visitas/:visitId`.
- **`RecordVisitScreen`**: `pending = view.visits.find(v => v.status === 'PENDING')`; si hay → precargar
  notas + hint "Estaba programada para el X"; submit cumple (mismo `useRecordVisit`); botón
  "Cancelar visita programada" → `useCancelVisit(pending.id)`.
- **`VisitDetailScreen`**: render por estado; `EditVisit` según estado; `CancelVisit` para ambos.
- **`ScheduledVisitFormScreen`**: alta/edición de PENDIENTE vía `ScheduleVisit`/`EditVisit`; hook
  `useScheduleVisit` con resultado `{ visitId }`.
- Eliminar `ScheduledVisitDetailScreen` + ruta; rutas de detalle unificadas en `App.tsx`.
