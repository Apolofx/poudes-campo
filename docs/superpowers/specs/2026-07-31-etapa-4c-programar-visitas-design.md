# Etapa 4c — Programar visitas futuras

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-07-31.

## Contexto y alcance

Hoy el producto cubre **"visité un lote y quiero volver"**: la próxima visita nace solo como
`followUp` de una visita **registrada** (fecha no futura obligatoria en `RecordVisit`). El asesor
no puede decir **"tengo que ir a este lote el día X"** antes de haber visitado — ni siquiera en un
lote ya visitado (no hay forma de agendar sin registrar). Esta etapa agrega esa capacidad: una
**visita programada** (`ScheduledVisit`), intención futura e independiente de una visita registrada.

Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones. 4c no agrega campos de ese
tipo.

## Decisiones tomadas (brainstorming)

1. **Nueva entidad `ScheduledVisit`** (no reusa `Visit`). Separa dos mundos temporales distintos:
   **visita = hecho ocurrido** (fecha no-futura, invariante ya testeado de `RecordVisit`) vs
   **programada = plan a futuro**. No toca invariantes de `Visit`; el historial diferencia
   "Programada" de "Registrada". Descartadas: extender `Visit` con status `SCHEDULED` (corrompe la
   semántica de "registrar" y obliga a distinguir programadas vencidas de visitas registradas) y
   guardar el estado en `Field` (mezcla catálogo con eventos, que el roadmap separa a propósito).
2. **La programada tiene aviso propio y, al programar, se cancelan los reminders PENDING del lote.**
   Consistente con `RecordVisit` ("una sola voz" para cuándo volver). `remindAt = scheduledDate −
   lead`, con lead clampeado a `[0, días entre hoy y la programada]` (paridad con el clamp de
   `RecordVisit`). El banner y la agenda siguen funcionando sin reglas especiales.
3. **Una sola programada ACTIVE por lote; al registrar una visita real la programada se consume
   (baja lógica auditable).** Programar otra reemplaza la anterior (`cancelledAt`). Invariante
   simple, historial auditable, agenda sin ambigüedad.
4. **Entrada desde el historial del lote, para cualquier lote** (visitado o no): botón
   "Programar visita" junto a "Registrar visita". Restringir solo a lotes nunca visitados es
   arbitrario y se desanda después.
5. **Precedencia en la agenda:** la programada ACTIVE reemplaza al followUp derivado de la última
   visita (una sola voz). El followUp sigue en el historial como dato informativo, pero no agenda.
6. **La programada guarda `reminderLeadDays` en la entidad** (no solo implícito en el reminder).
   Corrige de raíz la deuda que dejó `Visit.followUp` en 4a ("el lead del aviso al editar"): al
   reprogramar, el formulario recupera el lead original.
7. **Cancelar programada no revive avisos viejos** (paridad con 4a): la agenda cae al followUp de
   la visita anterior, sin reminder PENDING nuevo. Aceptado, coherente con best-effort offline.
8. **Agenda: la fila de una programada lleva a `/record`** (consumir es la acción primaria).
   Editar/cancelar se gestionan desde el historial → detalle. Sin cambio de fila en la UI.

## 1. Modelo de datos (dominio)

Tocar `src/domain` y `src/application` es la **intención explícita** de 4c (regla 2 de AGENTS).

- **`ScheduledVisit`** (nueva entidad, `src/domain/entities/scheduled-visit.ts`), inmutable como
  `Visit` (las mutaciones reconstruyen):
  ```
  id: ScheduledVisitId
  fieldId: FieldId
  scheduledDate: Date        // fecha programada (futura respecto del momento de creación)
  reminderLeadDays: number   // lead guardado, clampeado a [0, gap]; corregir deuda de 4a
  createdAt: Date
  notes?: string
  status: 'ACTIVE' | 'CANCELLED'   // default 'ACTIVE'
  cancelledAt?: Date
  ```
  El constructor valida que `scheduledDate` y `reminderLeadDays >= 0` existan.

- **`Reminder`**: agregar `scheduledVisitId?: ScheduledVisitId` (el `visitId` existente queda
  requerido para los reminders de follow-up). Un reminder referencia **o** una visita **o** una
  programada; no se type-enforce (se documenta; a esta escala es aceptable). `findDue` y
  `findPendingByField` no cambian: el dispatch y la cancelación por field son agnósticos a la
  fuente.

- **IDs** (`src/domain/shared/ids.ts`): `ScheduledVisitId`.

- **Errores nuevos** (`src/domain/shared/errors.ts`):
  - `ScheduledDateNotFuture` — se intentó programar para hoy/pasado.
  - `ScheduledVisitNotFound` — el id no existe.
  - `ScheduledVisitAlreadyCancelled` — se intentó editar/cancelar una programada cancelada.

## 2. Puertos

- **Nuevo `ScheduledVisitRepository`** (`src/domain/ports/outbound/scheduled-visit-repository.ts`):
  - `save(s)` / `findById(id)` / `listByField(fieldId)` (todas, para el historial) /
    `findActiveByField(fieldId)` (una o null, para unicidad y precedencia) /
    `listActive()` (todas las ACTIVE, para la agenda).
- **`ReminderRepository` sin cambios**: la cancelación del reminder propio se hace con el patrón
  existente de `CancelVisit` (`findPendingByField` + filtro por `scheduledVisitId` en memoria).

## 3. Aplicación (casos de uso)

### `ScheduleVisit`
Entrada: `{ fieldId, scheduledDate, reminderLeadDays, notes? }`.
1. `fields.findById` → `FieldNotFound` si no existe.
2. `scheduledDate > now` (estricto) → `ScheduledDateNotFuture`.
3. Si hay programada ACTIVE del field → cancelarla (`cancelledAt = now`), reconstruyendo.
4. Cancelar todos los reminders PENDING del field (una sola voz, paridad con `RecordVisit`).
5. Clampear lead a `[0, daysBetween(now, scheduledDate)]`.
6. Crear `ScheduledVisit` + `Reminder` (`remindAt = scheduledDate − lead`, `scheduledVisitId`).
7. Devuelve `{ scheduledVisitId, reminderId? }`.

### `CancelScheduledVisit`
Entrada: `{ scheduledVisitId }`.
1. `findById` → `ScheduledVisitNotFound`; si ya `CANCELLED` → `ScheduledVisitAlreadyCancelled`.
2. Cancelar (baja lógica) y cancelar su reminder PENDING propio (filtro por `scheduledVisitId`).
3. No revive reminders de followUps anteriores (aceptado, ver Decisión 7).

### `EditScheduledVisit`
Entrada: `{ scheduledVisitId, scheduledDate, reminderLeadDays, notes? }`.
1. Existe y está ACTIVE (errores igual que arriba).
2. `scheduledDate` futura.
3. Reconstruir con los valores nuevos; re-clampear lead.
4. Cancelar y recrear el reminder propio (el invariante "una sola ACTIVE por lote" hace trivial la
   pertenencia). Paridad con `EditVisit` (solo toca reminders si es la fuente vigente del field).

### `GetScheduledVisit`
Entrada: `{ scheduledVisitId }` → `findById` (para el detalle, como `GetVisit`).

### `ListUpcomingVisits` (cambio)
1. Sumar `scheduledVisits.listActive()` a la consulta.
2. Precedencia (Decisión 5): para cada followUp de `findCurrentFollowUps`, si el field tiene
   programada ACTIVE → se omite (la programada gana). Las programadas se agregan con
   `nextVisitDate = scheduledDate`, urgencia con `VisitUrgency.of`.
3. Orden y shape de salida sin cambios (la fila de agenda no cambia).

### `GetFieldHistory` (cambio)
El view agrega `scheduledVisits` (todas, incluidas las canceladas, ordenadas por `scheduledDate`
desc) para que el historial muestre las programadas con su badge. Los `Visit` no cambian.

### `RecordVisit` (cambio mínimo)
Al registrar una visita real, **consumir** la programada ACTIVE del field (baja lógica, Decisión 3)
además de cancelar los reminders PENDING (ya lo hace). Inyecta `ScheduledVisitRepository`.

### Diferido: `DispatchDueReminders`
El DTO `DueReminder.nextVisitDate` sigue viniendo de `findCurrentFollowUps`; para un reminder de
programada puede llevar la fecha de un followUp viejo. **No se corrige**: el banner solo muestra
nombres de lote y zona (`ReminderAvisoBanner`), el campo no se visualiza. → cuando el canal de
notificación muestre fechas.

## 4. Infraestructura

- **idb**: nuevo object store `scheduled-visits` (keyPath `id`, índice `by-field`). **Bump de
  esquema 1 → 2** en `open-campo-db.ts` con migración por `oldVersion` (crear stores v1 si
  `oldVersion < 1`, crear `scheduled-visits` si `oldVersion < 2`).
- **`records.ts`**: `ScheduledVisitRecord` (`id, fieldId, scheduledDate, reminderLeadDays,
  createdAt, notes?, status, cancelledAt?`) + `toScheduledVisitRecord`/`fromScheduledVisitRecord`;
  `ReminderRecord` gana `scheduledVisitId?`.
- **Adaptadores**: `IdbScheduledVisitRepository` + `InMemoryScheduledVisitRepository` (con el
  mismo contrato). Ambos adaptadores de Reminder persisten el campo nuevo.

## 5. Composición

Cablear en `container.ts`: `scheduledVisits` repo (idb), casos de uso nuevos, `RecordVisit` con la
dependencia nueva. `in-memory-container.ts` (tests) espeja el grafo.

## 6. UI

- **`FieldHistoryScreen`**: segundo botón **"Programar visita"** (btn-secondary) bajo "Registrar
  visita". La lista mezcla `visits` y `scheduledVisits` ordenados por fecha desc; las programadas
  llevan badge **"Programada"** (o "Cancelada") y linkean al detalle
  (`/field/:fieldId/programadas/:id`). "Registrar visita" sigue yendo a `/record`.
- **`ScheduledVisitFormScreen`** (`/field/:fieldId/programar` para alta,
  `/field/:fieldId/programar/:scheduledVisitId` para edición): fecha (mín = mañana), "Avisar días
  antes" (número, min 0, max = gap, como `RecordVisit`), notas (opcional). Al guardar, vuelve al
  historial. Back dinámico (reusa el patrón de `RecordVisitScreen`).
- **`ScheduledVisitDetailScreen`** (`/field/:fieldId/programadas/:scheduledVisitId`): fecha, aviso,
  notas, badge; si ACTIVE → **Editar** (a la pantalla de edición) y **Cancelar** (ConfirmDialog).
  Espeja `VisitDetailScreen`.
- **Routing** en `App.tsx`: las 3 rutas nuevas. **Agenda sin cambios.**
- Hooks: `use-schedule-visit`, `use-cancel-scheduled-visit`, `use-edit-scheduled-visit`,
  `use-scheduled-visit`; `use-field-history` expone `scheduledVisits`.

## 7. Estrategia de tests (TDD, espejo del source)

- **Dominio**: `scheduled-visit.test.ts` (invariantes de la entidad); `reminder.test.ts` suma
  `scheduledVisitId`.
- **Aplicación**: `schedule-visit.test.ts` (fecha no futura, consume/reemplaza ACTIVE previa,
  cancela PENDING del field, clamp de lead), `cancel-scheduled-visit.test.ts`,
  `edit-scheduled-visit.test.ts` (reclamp + recreate reminder), `list-upcoming-visits.test.ts`
  (precedencia programada > followUp), `get-field-history.test.ts` (incluye programadas),
  `record-visit.test.ts` (consume la programada ACTIVE).
- **Infra**: repos idb e in-memory de `ScheduledVisit`; `open-campo-db.test.ts` (migración 1→2);
  `records` (roundtrip con el campo nuevo en Reminder).
- **UI**: `field-history-screen` (botón + badge + navegación), `scheduled-visit-form-screen`,
  `scheduled-visit-detail-screen` (editar/cancelar), `agenda-screen` (una sola voz).

## 8. Diferidos

- **`DispatchDueReminders` sin schedule-aware `nextVisitDate`** (DTO no visualizado hoy).
- **Unicidad no type-enforced en `Reminder`** (visitId ∨ scheduledVisitId).
- **Reprogramar directo desde la agenda**: hoy la fila de una programada lleva a `/record`; si el
  uso lo pide, agregar acceso al detalle desde la fila.
- **Motivo de cancelación** de programadas: no se pide (paridad con 4a).
