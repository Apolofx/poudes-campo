# Etapa 4a — Cancelar / editar visitas

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-07-29. Rama: `etapa-4a-cancelar-editar-visitas`.

## Contexto y alcance

La Etapa 4 se partió en 4a/4b (dos subsistemas independientes). **4b** (ABM de catálogo) ya
está cerrado. Este spec es **4a**: corregir visitas ya registradas — **editar** (notas, fecha,
follow-up) y **cancelar** (baja lógica auditable sobre eventos).

**Hallazgo de partida:** hoy no existe ninguna superficie donde el asesor vea una visita ya
registrada. `VisitRepository.listByField` está en el puerto y en los dos adaptadores, pero
**nadie lo consume**: no hay pantalla de historial ni de detalle de visita. Los dos únicos
accesos (fila de Agenda y fila de Buscar) van directo a `/field/:id/record` para registrar una
visita **nueva**. Por eso 4a incluye construir la superficie que hace alcanzable la feature.

El modelo ya viene preparado: `Visit.status` es `'ACTIVE' | 'CANCELLED'`, y `RecordVisit` ya
cancela los reminders PENDING previos del field al registrar.

### Regla dura vigente

Ningún dato de dosis/agroquímicos/prescripciones. 4a no agrega campos de visita nuevos salvo
`cancelledAt` (traza de auditoría).

## Decisiones tomadas (brainstorming)

1. **Alcance = historial por lote + acciones.** 4a construye una pantalla de historial de
   visitas del lote (accesible desde Buscar) y un detalle donde viven Editar y Cancelar. Sin
   esto la feature es inalcanzable; es el MVP honesto.
2. **Editar cubre todo:** notas, fecha y follow-up. Un solo camino para toda corrección
   (paridad con Registrar). Cancelar es el camino aparte para "esta visita no debería existir".
3. **Cancelar acepta el desfase de aviso (documentado).** Cancelar cancela la visita y **su
   propio** reminder. La agenda cae sola al follow-up de la visita anterior (deriva de la última
   visita ACTIVE), pero ese follow-up ya no tiene un aviso PENDING (se canceló cuando se registró
   la visita más nueva). Se acepta: la agenda muestra el follow-up anterior como informativo, sin
   aviso; si el asesor quiere aviso, re-registra. Coherente con el diseño best-effort offline.
4. **Al editar "en N días", los N días se cuentan desde hoy** (momento de editar), no desde el
   `createdAt` original. Recalcula desde cero; nunca cae en el pasado. Consecuencia elegida: la
   resolución de follow-up de `EditVisit` **reusa tal cual** la de `RecordVisit` (ancla = `now`).
5. **Navegación:** la fila de **Buscar** pasa a ir al **Historial del lote** (Buscar = "gestionar
   el lote"); la fila de **Agenda se queda yendo a `/record`** (Agenda = "hacé la visita que
   vence", camino rápido). Editar/cancelar se llega por Buscar.
6. **Auditoría = `cancelledAt`, sin motivo.** Se guarda cuándo se canceló; no se pide un motivo
   (YAGNI para un usuario). Editar es corrección in-place: no se guarda historial pre-edición.
7. **Reminder al editar:** se recrea el reminder **solo si la visita editada es la última activa
   del lote**. Editar una visita que no es la última actualiza sus datos pero no toca reminders
   (mantiene el invariante "solo la última visita tiene reminder PENDING").
8. **Sin cambios de puerto.** Cancelar/editar solo necesitan cancelar el reminder PENDING de la
   visita, y eso sale de `findPendingByField(fieldId)` filtrado por `visitId`. Los reminders SENT
   (ya mostrados) se dejan como están: no re-disparan (`findDue` solo devuelve PENDING).

## 1. Modelo de datos (dominio)

Tocar `src/domain` y `src/application` es la **intención explícita** de 4a (regla 2 de AGENTS:
el núcleo puro se toca solo con intención del usuario — acá la hay).

- **`Visit`**: agregar `cancelledAt?: Date` a `VisitProps` y a la entidad (campo `readonly`).
  `status` ya existe (`'ACTIVE' | 'CANCELLED'`, default `'ACTIVE'`). La entidad sigue **inmutable**:
  cancelar/editar **reconstruyen** un `Visit` nuevo conservando `id`, `fieldId` y `createdAt`.
  Invariante existente que se conserva: `followUp` requiere `nextVisitDate` **e** `interval`
  (`IncompleteFollowUp`).

- **Errores nuevos** (`src/domain/shared/errors.ts`):
  - `VisitNotFound` — el `visitId` no existe.
  - `VisitAlreadyCancelled` — se intentó editar una visita ya cancelada.

## 2. Puertos

**Sin cambios.** `VisitRepository` ya tiene `save`, `findById`, `findActiveByFieldOnDay`,
`listByField`, `findCurrentFollowUps`. `ReminderRepository` ya tiene `save`, `findPendingByField`,
`findDue`. Todo lo que 4a necesita está.

## 3. Aplicación (casos de uso)

### `CancelVisit`

Entrada: `{ visitId }`.

1. `visit = visits.findById(visitId)`; si no existe → `VisitNotFound`.
2. Si `visit.status === 'CANCELLED'` → **no-op idempotente** (return sin error).
3. Reconstruir `Visit` con `status = 'CANCELLED'`, `cancelledAt = clock.now()` (resto igual);
   `visits.save(...)`.
4. `pending = reminders.findPendingByField(visit.fieldId)`; para cada uno con
   `reminder.visitId === visitId`: `reminder.cancel()` + `reminders.save(reminder)`.

La agenda cae sola al follow-up de la visita ACTIVE anterior (deriva de `findCurrentFollowUps`);
el desfase de aviso queda aceptado (decisión 3). Guardas de `RecordVisit` no afectadas: el guarda
de duplicado-en-el-día ya filtra por ACTIVE, así que una visita cancelada no bloquea re-registrar
el mismo día.

### `EditVisit`

Entrada: `{ visitId, visitDate, notes, followUp }` (`followUp: FollowUpInput`, mismo tipo que
`RecordVisit`).

1. `visit = visits.findById(visitId)`; si no existe → `VisitNotFound`.
2. Si `visit.status === 'CANCELLED'` → `VisitAlreadyCancelled`.
3. `now = clock.now()`. Revalidar guardas (mismas reglas que `RecordVisit`):
   - `visitDate > now` → `FutureVisitDate`.
   - `clash = visits.findActiveByFieldOnDay(fieldId, visitDate)`; si `clash && clash.id !== visitId`
     → `DuplicateVisitForDay` (**excluir la propia visita**).
4. Resolver follow-up **reusando la lógica de `RecordVisit`** (ancla = `now`; decisión 4). Para no
   duplicar, extraer la resolución a un helper compartido (p. ej. `resolveFollowUp(input, now)` y
   el clamp de `reminderLeadDays` a `[0, interval.days]`) reutilizable por ambos casos de uso.
5. Reconstruir `Visit` conservando `id`, `fieldId`, `createdAt` y `status = 'ACTIVE'`, con los
   nuevos `visitDate`/`notes`/`followUp`; `visits.save(...)`.
6. **Reminder:**
   - Cancelar el reminder PENDING de esta visita: `reminders.findPendingByField(fieldId)`
     filtrado por `visitId`, `cancel()` + `save()`.
   - Recrear un reminder **solo si**: `followUp` presente **y** la visita editada es la **última
     activa del lote** (predicado vía `visits.listByField(fieldId)`: máximo `createdAt` entre las
     ACTIVE, con o sin follow-up → es esta). Es la misma noción de "actual" que usa
     `findCurrentFollowUps` (última ACTIVE por `createdAt`), así que agenda y reminder quedan
     alineados. En ese caso crear `Reminder` con `remindAt = nextVisitDate − leadDays`.
   - Si no es la última, o no hay follow-up: no crear reminder (se mantiene el invariante).

### Helper compartido

`RecordVisit` y `EditVisit` comparten: (a) resolución de `FollowUpInput → FollowUp | undefined`
con ancla `now`, y (b) clamp de `reminderLeadDays` a `[0, interval.days]`. Extraer a una función
pura reutilizable (dominio/aplicación) para no duplicar. `RecordVisit` se refactoriza para usarla
(comportamiento idéntico, tests existentes verdes).

## 4. UI (adaptador React)

### Rutas nuevas

- `GET /field/:fieldId/visitas` → **Historial del lote** (`FieldHistoryScreen`).
- `GET /field/:fieldId/visitas/:visitId` → **Detalle/edición de visita** (`VisitDetailScreen`).

### Historial del lote (`FieldHistoryScreen`)

- Título con el nombre del lote (`lote — cliente · zona`, como en Buscar).
- Botón **"Registrar visita"** → `/field/:fieldId/record` (pantalla actual, intacta).
- Lista de visitas (`listByField`, **más nueva primero** por `visitDate`/`createdAt`): cada fila
  muestra fecha · preview de notas · **badge de estado** (`Activa` / `Cancelada`, la cancelada en
  gris). Las canceladas se muestran (son la traza de auditoría). Fila → detalle de esa visita.
- Estado vacío: "Este lote no tiene visitas registradas."

### Detalle / edición (`VisitDetailScreen`)

- Reusa el **formulario de `RecordVisitScreen`** (fecha, notas, control segmentado de próxima
  visita, avisar-días-antes), **prellenado** con los datos de la visita.
- Botón **Guardar** → `EditVisit`; al éxito, volver al historial.
- Botón **Cancelar visita** → `ConfirmDialog` (ya existe) → `CancelVisit`; al éxito, volver al
  historial.
- Si la visita está **CANCELLED**: se muestra **read-only** (sin editar ni volver a cancelar);
  badge "Cancelada".
- Errores de dominio → texto en español vía `domainErrorMessage` (nunca se lanzan al usuario).

### Cambio de navegación

- **Buscar** (`SearchScreen`): la fila del lote pasa de `→ /field/:id/record` a
  `→ /field/:id/visitas` (historial).
- **Agenda** (`AgendaScreen`): **sin cambios**, la fila sigue yendo a `/field/:id/record`.

### Hooks

- `useCancelVisit` / `useEditVisit` (finos, sobre los casos de uso vía `CampoProvider`, como
  `useRecordVisit`).
- Lectura del historial: un hook `useFieldHistory(fieldId)` que envuelve `listByField` (+ nombre
  del lote). Considerar exponer un caso de uso de lectura si el container no expone `listByField`
  directamente (mismo patrón que el resto).

## 5. Tests (TDD, espejando `tests/`)

**Dominio:**
- `Visit` acepta y conserva `cancelledAt`; sigue rechazando follow-up incompleto.

**Aplicación:**
- `CancelVisit`: happy path (status → CANCELLED, `cancelledAt` seteado); idempotente (cancelar dos
  veces no rompe); cancela el reminder PENDING de la visita; deja SENT/otros reminders intactos;
  `VisitNotFound`.
- `EditVisit`: edita notas; edita fecha (revalida no-futura y no-duplicado **excluyendo self**);
  edita follow-up (recomputa reminder, ancla = now); recrea reminder **solo si es la última
  activa**; editar visita no-última no crea reminder; rechaza editar visita CANCELLED
  (`VisitAlreadyCancelled`); `VisitNotFound`.
- `RecordVisit`: los tests existentes siguen verdes tras extraer el helper compartido.

**UI (jsdom):**
- Historial: lista y ordena (más nueva primero); badge Activa/Cancelada; estado vacío; botón
  Registrar navega a `/record`; fila navega al detalle.
- Detalle: form prellenado; Guardar llama `EditVisit` y vuelve; Cancelar abre `ConfirmDialog`,
  confirma y vuelve; visita cancelada se ve read-only.
- Buscar: la fila navega al historial (no al record).

## 6. Diferidos / deuda anotada (nuevos de 4a)

- **Historial pre-edición** (auditoría fuerte de ediciones): editar es corrección in-place, no se
  guarda el valor anterior. Si en el futuro se quiere traza de cambios, va atado al modelo de
  eventos de Etapa 5.
- **Motivo de cancelación**: no se pide (solo `cancelledAt`). Fácil de agregar si el uso lo pide.
- **Revivir el aviso de la visita anterior al cancelar** (decisión 3): diferido; se aceptó el
  desfase. Revisar si se endurece el canal de avisos.
- **Editar una visita que no es la última** con cambio de follow-up: actualiza datos pero no
  reminders. Caso raro; documentado como comportamiento, no bug.
- **Índice idb por `visitId` en reminders / por `status` en visitas**: hoy `getAll`+filtro a
  escala ~40. Cuando el volumen lo pida (mismo criterio que el resto).

## 7. Glosario / invariantes que 4a preserva

- La próxima visita se ancla al **momento de registro/edición** (`now`), no a la fecha retroactiva
  de la visita.
- **Solo la última visita ACTIVE de un field tiene un reminder PENDING.** `RecordVisit` lo
  mantiene (cancela previos); `EditVisit` lo mantiene (recrea solo si es la última); `CancelVisit`
  lo respeta (solo cancela el propio).
- La agenda deriva el "próximo a visitar" de la **última visita ACTIVE con follow-up**
  (`findCurrentFollowUps`); cancelar una visita hace caer la agenda a la anterior sin trabajo extra.
- CRUD no uniforme: los **eventos** (Visit/Reminder) se **corrigen dentro de reglas o se cancelan**
  (baja lógica), no se borran físicamente.
