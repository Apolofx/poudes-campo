# Etapa — Unificar visitas: una sola entidad `Visit` con ciclo de vida

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-08-02.

## Contexto y alcance

Hoy el dominio tiene **dos entidades paralelas** para el mismo concepto ("ir a un lote"):

- `Visit`: hecho **ocurrido** (fecha no-futura, `visitDate`), con `followUp` anclado ("volver en X").
- `ScheduledVisit`: plan **futuro** (`scheduledDate`, aviso propio), consumido al registrar la visita real.

El usuario percibe esta separación como un bug: al registrar, la programada se convierte en una fila
fantasma "Programada — Cancelada" que se lee como error al lado de la "Realizada" del mismo hecho, y los
estados ("Activa", "Programada") confunden. La regla "una sola voz" se implementa como precedencia
ad-hoc entre fuentes distintas.

Esta etapa unifica todo en **una sola entidad `Visit` con ciclo de vida**: `PENDING → DONE → CANCELLED`,
con dos fechas explícitas (`plannedFor` y `visitedAt`). Muerte de `ScheduledVisit`, `Visit.followUp` y
`Reminder.scheduledVisitId`.

Tocar `src/domain` y `src/application` es la **intención explícita** del usuario para esta etapa
(regla 2 de AGENTS). Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones.

## Decisiones tomadas (brainstorming)

1. **Modelo de ciclo de vida.** Una fila por visita que cambia de estado. La "visita" es la unidad
   natural que responde tanto "¿a qué lote voy y cuándo?" (compromisos futuros) como "¿qué hice?"
   (hechos registrados); el follow-up y lo "programado" son lo mismo (un compromiso de volver) vistos
   desde momentos distintos.
   - **Dos fechas explícitas**: `plannedFor` (solo PENDING; se conserva al cumplir) y `visitedAt`
     (solo DONE). Rechazado: una fecha única cuyo significado dependa del `status` (esquema oscuro:
     cumplir temprano corrompería la fecha única o forzaría a mentir). El sistema ya persiste dos
     fechas para las registradas (`visitDate` + `createdAt`), así que el campo no es invención.
2. **Registrar cumple la PENDIENTE.** La acción "Registrar" sobre un lote con PENDIENTE activa dispara
   esa misma visita: `PENDING → DONE` (conserva `plannedFor`, `visitedAt` = fecha cargada, se cancela
   su aviso). El form se precarga (notas + hint "Estaba programada para el X"). Si queda una cita en
   pie, se reprograma en el mismo gesto. Rechazado: "Registrar crea otra fila" (duplica filas y agrega
   un fork de decisión en el form).
3. **Una sola PENDIENTE activa por lote.** "Programar" sobre una PENDIENTE existente la **reemplaza**
   (cancela + crea). El feed queda con una fila por lote y la Decisión 2 es inequívoca. La migración
   hereda la regla (ver 6.2). Multi-agenda futura = cambio aditivo, no rewrite.
4. **Terminología visible:** `PENDING` → **"Programada"**, `DONE` → **"Realizada"**, `CANCELLED` →
   **"Cancelada"**. Acciones: **Registrar** y **Programar**. El feed agrupa por tiempo sin badges.
5. **El aviso vive en la PENDIENTE** (`reminderLeadDays` en la entidad); el `Reminder` apunta a la
   visita unificada. Muere `scheduledVisitId`. Un `Reminder` de "volver en X" apunta a la **PENDIENTE**
   creada (no a la DONE), así cumplir/cancelar/reemplazar la cancela con el filtro por `visitId`
   existente.
6. **Un solo detalle y una sola edición que renderizan según estado** (fusión de las pantallas de
   visita y programada). Una DONE **no edita "su próxima"**: la próxima es una PENDIENTE propia en el
   historial y se edita tocándola. Cierra la deuda de 4a ("lead del aviso al editar"): el lead ahora
   vive en la entidad.
7. **"Vencida" es derivada** (`plannedFor < now`), igual que hoy la urgencia absoluta. No se persiste.
8. **Migración idb v2→v3 determinista** (ver 6.2).

## 1. Modelo de datos (dominio)

### `Visit` (rework, `src/domain/entities/visit.ts`)

```
export type VisitStatus = 'PENDING' | 'DONE' | 'CANCELLED';

export interface VisitProps {
  id: VisitId;
  fieldId: FieldId;
  status?: VisitStatus;
  plannedFor?: Date;         // requerido para PENDING; se conserva al cumplir
  visitedAt?: Date;          // requerido para DONE
  reminderLeadDays?: number; // requerido para PENDING (el aviso propio)
  notes?: string;
  createdAt: Date;
  cancelledAt?: Date;
}
```

El constructor valida invariantes por estado y lanza `InvalidVisit`:
- `PENDING`: exige `plannedFor` y `reminderLeadDays >= 0`; prohíbe `visitedAt`.
- `DONE`: exige `visitedAt`.
- `CANCELLED`: exige `cancelledAt`; conserva las fechas del estado previo.
- `reminderLeadDays` solo tiene sentido en PENDING (no se type-enforce; documentado).

### Muere

- Entidad `ScheduledVisit` y `ScheduledVisitStatus`.
- `Visit.followUp` / interfaz `FollowUp` / `VisitInterval` (VO) — la urgencia es absoluta desde Etapa 2;
  el intervalo no se usa para el semáforo.
- `Reminder.scheduledVisitId` (queda solo `visitId`).
- `ScheduledVisitId` en `ids.ts`.
- Errores: `InvalidScheduledVisit`, `IncompleteFollowUp`, `ScheduledDateNotFuture`,
  `ScheduledVisitNotFound`, `ScheduledVisitAlreadyCancelled`, `InvalidVisitInterval`.
- Nuevos errores: `InvalidVisit` (reemplaza a los de entidad) y `PlannedDateNotFuture` (reemplaza
  `ScheduledDateNotFuture`). Quedan `VisitNotFound`, `VisitAlreadyCancelled`, `FutureVisitDate`,
  `DuplicateVisitForDay`.

## 2. Puertos

### `VisitRepository` (rework)

- Se mantienen: `save`, `findById`, `listByField`.
- `findActiveByFieldOnDay` → **`findDoneByFieldOnDay`** (chequeo de duplicado solo entre DONE).
- **`findPendingByField(fieldId)`** → la PENDIENTE del lote o `null` (cumplimiento + unicidad).
- **`findPendings()`** → todas las PENDING (agenda; reemplaza `findCurrentFollowUps`).
- Se elimina `CurrentFollowUp` / `findCurrentFollowUps`.

### Se elimina `ScheduledVisitRepository`

Los tres consumidores se reexpresan sobre `VisitRepository` (`findPendingByField`, `findPendings`).
`ReminderRepository` **sin cambios**.

## 3. Aplicación (casos de uso)

### `RecordVisit` (rework)
Entrada: `{ fieldId, visitedAt, notes?, followUp? }` donde `followUp` es el input actual de
`FollowUpInput` (En N días / En una fecha / Sin próxima) — ahora significa "crear PENDIENTE al volver".
1. `fields.findById` → `FieldNotFound`.
2. `visitedAt <= now` → `FutureVisitDate`.
3. `findDoneByFieldOnDay` → `DuplicateVisitForDay` (solo entre DONE).
4. `findPendingByField`:
   - existe → **cumplirla**: `status: DONE`, `visitedAt`, conserva `plannedFor` y `createdAt`, notas
     del form; cancelar su reminder propio (filtro `visitId`).
   - no existe → crear `Visit` DONE nueva.
5. Cancelar todos los reminders PENDING del field (una sola voz, paridad actual).
6. Si `followUp != none` → crear PENDIENTE (`plannedFor` resuelto, lead clampeado a `[0, intervalo]`)
   + `Reminder(visitId = pending.id, remindAt = plannedFor − lead)`.
7. Devuelve `{ visitId, reminderId? }`.

### `ScheduleVisit` (rework — "Programar")
Entrada: `{ fieldId, plannedFor, reminderLeadDays, notes? }`.
1. `fields.findById` → `FieldNotFound`.
2. `plannedFor > now` (estricto) → `PlannedDateNotFuture`.
3. Cancelar la PENDIENTE activa del field si existe (Decisión 3).
4. Cancelar los reminders PENDING del field (una sola voz).
5. Clampear lead a `[0, daysBetween(now, plannedFor)]`.
6. Crear `Visit` PENDING (`plannedFor`, `reminderLeadDays`, notas) + `Reminder(visitId = pending.id,
   remindAt = plannedFor − lead)`.
7. Devuelve `{ visitId, reminderId }`.

`ScheduleVisitEnsuringField` **sin cambios** (sigue orquestando crear lote/zona/cliente + ScheduleVisit).

### `CancelVisit` (generalizado)
Cualquier visita no cancelada (PENDING o DONE): baja lógica (`cancelledAt`) y cancela su reminder
propio por `visitId` (filtro existente). Errores: `VisitNotFound`, `VisitAlreadyCancelled` (la
cancelación ya-idempotente hoy se mantiene). No revive avisos viejos (paridad con 4a/4c).

### `EditVisit` (rework — un solo form según estado)
- **PENDING**: `{ visitId, plannedFor, reminderLeadDays, notes? }` — fecha futura, reclamp del lead,
  recrear reminder propio.
- **DONE**: `{ visitId, visitedAt, notes? }` — fecha no futura, chequeo de duplicado, **sin follow-up**
  (la próxima es una PENDIENTE aparte).

### `GetVisit`
Sin cambios; ahora sirve cualquier estado (el detalle unificado).

### `GetFieldHistory` (cambio)
El view devuelve una **única lista `visits`** (todas, incluidas las canceladas) ordenada desc por fecha
efectiva (`plannedFor` si PENDING, `visitedAt` si DONE). Desaparece `scheduledVisits`.

### `ListUpcomingVisits` (simplificación)
1. `findPendings()` (todas las PENDING).
2. Join con la jerarquía; `nextVisitDate = plannedFor`, urgencia con `VisitUrgency.of`.
3. **La precedencia "programada > followUp" desaparece**: con una sola PENDIENTE por lote la "una sola
   voz" es estructural, no una regla de merge. Orden y shape de salida sin cambios.

### `DispatchDueReminders` (cambio mínimo)
El DTO `DueReminder.nextVisitDate` se deriva de `findPendings()` (el `plannedFor` de la PENDIENTE del
field) en vez de `findCurrentFollowUps`. El banner no muestra la fecha (campo no visualizado), se
conserva el fallback `?? remindAt`.

## 4. Composición

- `container.ts`: quitar `IdbScheduledVisitRepository` y los casos de uso `CancelScheduledVisit`,
  `EditScheduledVisit`, `GetScheduledVisit`. `RecordVisit` / `ScheduleVisit` / `ListUpcomingVisits`
  sin dependencia a `scheduled`. `in-memory-container.ts` (tests) espeja el grafo.

## 5. UI

- **Badges** (Decisión 4): PENDING → "Programada", DONE → "Realizada", CANCELLED → "Cancelada".
- **`FieldHistoryScreen`**: una única lista de `Visit` ordenada desc; badge por estado; cada fila →
  detalle `/field/:fieldId/visitas/:visitId`. Botones "Registrar visita" y "Programar visita".
- **`RecordVisitScreen`**: si el lote tiene PENDIENTE, precarga notas y muestra "Estaba programada para
  el X"; guardar cumple la PENDIENTE. Se mantiene la sección "Próxima visita" (crea PENDIENTE). Se
  conserva el botón "Cancelar visita programada" (hoy dirigido a la PENDIENTE) como vía para *no*
  cumplir.
- **`VisitDetailScreen`** (detalle unificado): PENDING → "Programada para el X", "Avisar N días antes",
  notas, **Editar / Cancelar**; DONE → "Realizada el X" (+ "Estaba programada para el Y" si conserva
  `plannedFor`), notas, **Editar / Cancelar**. **Desaparece `ScheduledVisitDetailScreen`.**
- **`ScheduledVisitFormScreen`** (ruta `/programar` se mantiene): crea/edita una PENDIENTE (fecha mín.
  mañana, "Avisar días antes", notas). La edición de una DONE es un form chico (fecha + notas).
- **Routing** en `App.tsx`: la ruta de detalle única reemplaza las dos de visitas/programadas.
- **Hooks**: mueren `use-cancel-scheduled-visit`, `use-edit-scheduled-visit`, `use-scheduled-visit`;
  `use-field-history` expone la lista unificada. `use-agenda` sin cambios de contrato.

## 6. Infraestructura

### 6.1 `records.ts` y adaptadores

- `VisitRecord` pasa a: `{ id, fieldId, status, plannedFor?, visitedAt?, reminderLeadDays?, notes?,
  createdAt, cancelledAt? }`. Mappers `toVisitRecord`/`fromVisitRecord` actualizados.
- Se eliminan `ScheduledVisitRecord` y sus mappers; `ReminderRecord` sin `scheduledVisitId`.
- `IdbVisitRepository` / `InMemoryVisitRepository` actualizados a los métodos nuevos del puerto.
- Se eliminan `IdbScheduledVisitRepository` / `InMemoryScheduledVisitRepository`.

### 6.2 Migración idb v2 → v3 (`open-campo-db.ts`)

Se elimina el store `scheduled-visits`; el índice `by-field` de `visits` sigue sirviendo.

Reglas de mapeo (deterministas, en el upgrade por `oldVersion < 3`):

1. **`visits` viejos** (`VisitStatus` ACTIVE|CANCELLED):
   - `ACTIVE` → `DONE` con `visitedAt = visitDate`.
   - `CANCELLED` → `CANCELLED` con `visitedAt = visitDate` y `cancelledAt`.
2. **followUp** del registro NO se migra sobre la visita (muere). Por field, la visita `ACTIVE` más
   reciente (por `createdAt`) **con followUp** crea una **PENDIENTE nueva** (`plannedFor =
   nextVisitDate`). El lead se recupera del reminder que apuntaba a esa visita (`daysBetween(remindAt,
   nextVisitDate)`, clamp ≥ 0; default 0 si no hay reminder). El resto de los followUp del registro se
   descartan (eran datos dormidos; no eran "la voz").
3. **`scheduled-visits` viejos**: `ACTIVE` → `PENDING` con `plannedFor = scheduledDate`,
   `reminderLeadDays` guardado y **el mismo id** (los id viven en stores distintos, no colisionan);
   `CANCELLED` → `CANCELLED` con `plannedFor` y `cancelledAt`.
4. **Reconciliación (una sola PENDIENTE por lote, Decisión 3):** si un field queda con más de una
   PENDIENTE (p. ej. la followUp ganadora + una scheduled), gana la de `createdAt` más reciente; las
   demás → `CANCELLED` con `cancelledAt = now`.
5. **`reminders`**: se elimina `scheduledVisitId`. Re-anejar `visitId`: los que apuntaban a una
   scheduled → su id (ya es el mismo de la PENDIENTE migrada); los que apuntaban a la visita ganadora
   con followUp → el id de la PENDIENTE creada en (2); el resto queda como está (apuntan a la DONE).
   Los PENDING de una PENDIENTE cancelada en (4) se cancelan.

## 7. Estrategia de tests (TDD, espejo del source)

- **Dominio**: `visit.test.ts` reescrito (invariantes por estado: PENDING exige `plannedFor`+lead,
  DONE exige `visitedAt`, CANCELLED exige `cancelledAt`, transición PENDING→DONE conserva
  `plannedFor`). `reminder.test.ts` sin `scheduledVisitId`. `visit-interval.test.ts` se elimina.
- **Aplicación**:
  - `record-visit.test.ts`: cumple la PENDIENTE (conserva `plannedFor`, cancela su reminder, `visitedAt`
    = fecha cargada), cumple temprano (fecha cargada ≠ `plannedFor`), sin PENDIENTE crea DONE,
    `DuplicateVisitForDay` solo entre DONE, "volver en X" crea PENDIENTE + reminder anclado a ella.
  - `schedule-visit.test.ts`: fecha no futura, reemplaza la PENDIENTE previa (cancelada), cancela
    PENDING del field, clamp de lead, reminder por `visitId`.
  - `cancel-visit.test.ts`: cancela PENDING y DONE, cancela el reminder propio, idempotente.
  - `edit-visit.test.ts`: edición PENDING (fecha futura, reclamp, recrear reminder) y DONE (fecha no
    futura, duplicado, sin follow-up).
  - `list-upcoming-visits.test.ts`: agenda desde `findPendings`, una sola fila por lote.
  - `get-field-history.test.ts`: lista unificada ordenada; `dispatch-due-reminders.test.ts`:
    `nextVisitDate` desde la PENDIENTE.
  - Mueren los tests de `scheduled-visit` y `follow-up` (el VO de intervalo).
- **Infra**: `open-campo-db.test.ts` (migración 2→3 con los casos de 6.2: followUp→PENDING, scheduled
  →PENDING con mismo id, reconciliación de doble PENDIENTE, re-anejo de reminders); `records` (roundtrip
  del shape nuevo); repos idb e in-memory.
- **UI**: `field-history-screen` (lista unificada + badges), `record-visit-screen` (cumple PENDIENTE,
  precarga + hint, botón cancelar dirigido a la PENDIENTE), `visit-detail-screen` (ambos estados),
  `scheduled-visit-form-screen` (crea/edita PENDIENTE), `agenda-screen` (una sola voz estructural).
  Mueren los de `scheduled-visit-detail-screen`.

## 8. Diferidos

- **DispatchDueReminders**: el fallback `nextVisitDate ?? remindAt` sin test dedicado queda (ver
  ROADMAP); con `findPendings` la rama sin follow-up/pending se vuelve menos común.
- **Borde de timezone (este de UTC)** del ROADMAP: se mantiene diferido; las comparaciones siguen
  siendo medianoche-UTC y el usuario objetivo es UTC-3 (oeste, no afectado).
- **Multi-agenda por lote** (varias PENDIENTES): cambio aditivo si el uso lo pide (Decisión 3).
- **Motivo de cancelación**: no se pide (paridad con 4a/4c).

## 9. ROADMAP

Al cerrar: reescribir "Se puede hacer hoy" (una entidad, estados Programada/Realizada/Cancelada,
cumplimiento), sumar la fila de etapa (con el conteo de tests), y cerrar/archivar los diferidos que
esta etapa resuelve: exclusividad `visitId∨scheduledVisitId` (4c), reminder de programada re-anclado
(4c) y lead del aviso al editar (4a).
