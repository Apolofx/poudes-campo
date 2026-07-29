# Etapa 3 — Aviso al abrir · Diseño

Fecha: 2026-07-29
Estado: aprobado (brainstorming), pendiente de plan.
Rama: `etapa-3-avisos`.

## Propósito

Al abrir la app, detectar los reminders cuyo umbral de aviso (`remindAt`) ya se
cruzó y sacarlos a la superficie en un banner resumen arriba de Inicio. Es un
**cálculo cliente idempotente** que sustituye —mientras no haya backend— al
esquema futuro donde un scheduler (AWS Scheduler) dispara en `remindAt` y un
handler notifica por un canal real (WhatsApp/SMS/SNS/mail).

**Por qué agrega valor sobre el panel de la Etapa 2.** El panel razona sobre
`nextVisitDate` (el vencimiento). El reminder dispara en
`remindAt = nextVisitDate − reminderLeadDays` (el "avisame X días antes"). El
aviso puede así surfacer un lote que el panel todavía tiene **colapsado en "Más
adelante"**: no vence aún, pero su umbral de anticipación ya pasó.

## Decisiones (con su porqué)

- **Sin push real / sin service worker.** Sin servidor, una notificación web con
  la app cerrada exige Push API + VAPID (un server que empuje); la Notification
  Triggers API nunca se estandarizó. "Notificación real" quedaría funcionando
  solo con la app abierta, que es justo cuando el aviso in-app ya resuelve.
  Esfuerzo (permisos, SW) para un valor que se cae solo → fuera de alcance.
- **El backend engancha en la Etapa 5 (sync), no acá.** En el mundo con server,
  el reminder + metadata se sincroniza en su creación y el scheduler lo agenda;
  el "dispatch al abrir" ni existe. Por eso `DispatchDueReminders` es un
  sustituto cliente deliberadamente descartable y **no se gold-platea** pensando
  en el backend.
- **`ReminderNotifier` es un puerto real y usado** (no especulativo): el
  adaptador in-app es la implementación productiva de hoy. Mañana se cambia el
  adaptador (Notification local, SNS, log) sin tocar el caso de uso.
- **Payload rico como value-add barato.** El `DueReminder` que recibe el notifier
  carga la metadata que el handler futuro necesitará (lote, cliente, zona,
  `nextVisitDate`, `remindAt`). Se arma en el dispatch por join; **no** se
  persiste en la entidad `Reminder` (YAGNI: la Etapa 5 enriquece al embarcar).
- **Banner autosuficiente, agrupado por zona.** Como los reminders disparados
  pueden estar en "Más adelante" (colapsado), el resumen lista los lotes él
  mismo en vez de depender del panel. Interacción v1: informativo + "cerrar";
  sin acción de tap por lote (registrar la visita ocurre al volver al lote).
- **Dispatch en `main.tsx`, antes del render** (junto a `seedIfEmpty`). Semántica
  "una vez por apertura" limpia, sin carreras de `useEffect`, inmune al
  doble-invoke de `StrictMode`. La persistencia `SENT` lo hace idempotente igual.
- **`reminderLeadDays` se clampa a `[0, intervalo]`** en `RecordVisit` (deuda
  diferida a esta etapa). Clampar (no rechazar): registrar la visita es lo
  importante; el lead es secundario y no se pierde el evento por un detalle de
  timing. La UI además limita el input.

## Alcance

Dentro:
- Transición de dominio `Reminder.markSent()` (`PENDING→SENT`).
- Puerto `ReminderRepository.findDue(now)`.
- Puerto nuevo `ReminderNotifier` + DTO `DueReminder`.
- Caso de uso `DispatchDueReminders`.
- Adaptador `InAppReminderNotifier` (store de lectura para la UI).
- `findDue` en repos in-memory e idb (`getAll` + filtro, sin bump de esquema).
- Wiring en container + `main.tsx` (dispatch best-effort).
- Banner `ReminderAvisoBanner` en Inicio.
- Clamp de `reminderLeadDays` en `RecordVisit` + tope en el input de la UI.

Fuera:
- Notificaciones del SO / service worker / Push API.
- Backend / AWS Scheduler / sincronización (Etapa 5).
- Índice idb `by-status` (optimización futura anotada).
- Acción de tap por lote en el banner.

## Diseño por capa

### Dominio

`Reminder.markSent()` — complemento de `cancel()`:

```ts
markSent(): void {
  if (this._status !== 'PENDING') return; // idempotente; no toca SENT/CANCELLED
  this._status = 'SENT';
}
```

El dispatch solo agarra reminders `PENDING`, así que `markSent()` nunca se
invoca sobre un `CANCELLED`; la guarda es defensa en profundidad.

### Puertos

```ts
// domain/ports/outbound/reminder-repository.ts (se agrega)
findDue(now: Date): Promise<Reminder[]>; // PENDING con remindAt <= now, todos los lotes

// domain/ports/outbound/reminder-notifier.ts (nuevo)
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
```

### Aplicación — `DispatchDueReminders`

Constructor: `(reminders, visits, fields, clock, notifier)`.

```
execute():
  now = clock.now()
  due = reminders.findDue(now)
  followUps = visits.findCurrentFollowUps()        // fieldId -> nextVisitDate
  hierarchy = fields.listAllWithHierarchy()         // fieldId -> {field, clientName, zoneName}
  batch: DueReminder[] = []
  for r of due:
    r.markSent(); reminders.save(r)                 // siempre se marca SENT
    h = hierarchy[r.fieldId]; fu = followUps[r.fieldId]
    if (!h) continue                                // lote archivado/edge: SENT pero fuera del batch
    batch.push({ ...metadata..., nextVisitDate: fu?.nextVisitDate ?? r.remindAt })
  notifier.notify(batch)
  return batch
```

- **Idempotencia:** persistir `SENT` garantiza que una segunda corrida
  (misma apertura o reapertura del día) devuelva `[]`.
- Si `due` está vacío: `notifier.notify([])` y retorna `[]`.
- `nextVisitDate` sale del follow-up vigente; si no hubiera (edge), cae a
  `remindAt` como aproximación para el texto.

### Deuda de lead en `RecordVisit`

Al construir el `remindAt`, clampar el lead:

```
effectiveLead = min(max(reminderLeadDays ?? 0, 0), followUp.interval.days)
remindAt = addDays(followUp.nextVisitDate, -effectiveLead)
```

UI: el input "Avisar días antes" toma `max = intervalo` (y para `kind: 'date'`,
`max = daysBetween(now, fecha)`), con texto de ayuda.

### Infra + composición

- `InAppReminderNotifier implements ReminderNotifier`: guarda el último batch en
  memoria y lo expone con `snapshot(): DueReminder[]`.
- `IdbReminderRepository.findDue`: `getAll('reminders')` + filtro
  `status === 'PENDING' && remindAt <= now`. Sin índice nuevo, sin bump de
  versión (esquema sigue en 1).
- `InMemoryReminderRepository.findDue`: filtro directo sobre el `Map`.
- `Container`: expone `dispatchDueReminders` y el notifier in-app como store de
  lectura para la UI.
- `main.tsx`:

```
db = openCampoDb()
seedIfEmpty(db)
container = buildContainer(db)
try { await container.dispatchDueReminders.execute() }
catch (e) { console.error('reminder dispatch failed', e) } // best-effort
render(...)
```

### UI

`ReminderAvisoBanner` en `AgendaScreen`:
- Lee `snapshot()` una vez (ya poblado antes del render). Estado local
  `dismissed` para "cerrar". Snapshot vacío → no renderiza nada.
- Agrupa por zona; por zona lista los nombres de lote.

```
🔔 4 lotes para visitar pronto
Norte — El Alto, La Loma
Sur — Est. Pérez
Este — El Bajo
[cerrar]
```

Estilo funcional reusando tokens de 1c (acento de "vencidas"); sin pasada
visual dedicada.

## Testing (TDD)

- **Dominio:** `markSent` — `PENDING→SENT`, idempotente, no toca `CANCELLED`.
- **Aplicación — `DispatchDueReminders`** (in-memory repos + fake notifier):
  encuentra/marca/notifica los vencidos; segunda corrida → `[]` (idempotencia);
  batch vacío no rompe; enriquecimiento correcto (lote/cliente/zona/fechas);
  reminder sin lote en jerarquía se marca `SENT` pero se excluye del batch.
- **Aplicación — `RecordVisit`:** clamp de lead (negativo→0; exceso→intervalo)
  para `kind: 'interval'` y `kind: 'date'`.
- **Infra — `findDue`** (in-memory e idb): incluye PENDING vencidos; excluye
  `SENT`/`CANCELLED` y `remindAt > now`.
- **UI:** el banner renderiza del snapshot, agrupa por zona; "cerrar" lo oculta;
  snapshot vacío → sin banner.

## Deuda / diferidos que toca o crea

- Cierra: validación de `reminderLeadDays` (estaba diferida a Etapa 3).
- Anota: índice idb `by-status` para `findDue` (hoy `getAll`+filtro).
- No toca el borde de timezone (medianoche-UTC vs reloj real): atado a revisar
  la comparación de día-calendario del dominio, sigue diferido.
