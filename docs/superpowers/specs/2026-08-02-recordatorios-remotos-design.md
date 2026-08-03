# Etapa — Recordatorios remotos (notificador por email vía Lambda)

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Contrato: [`docs/api/openapi.yaml`](../../api/openapi.yaml) (secciones `ReminderFeed` y `POST /v1/notify`).
> Fecha: 2026-08-02. Rama: `reminder-remote`.

## Contexto y alcance

La app es offline-first: los datos viven en el dispositivo. Hoy el aviso de recordatorios es
**in-app** (banner al abrir la app, `DispatchDueReminders`). El usuario quiere que los recordatorios
lleguen también **sin abrir la app**: una lambda diaria que detecte qué visitas programadas disparan
aviso ese día y notifique por email (canal SES elegido; el canal se abstrae para poder sumar
WhatsApp después).

**Decisión fundacional**: NO se replica el dominio ni el CRUD espejo completo. El servidor necesita
solo una **proyección** de lo que va a notificar, denormalizada, y un log de envíos. Esto mantiene el
servidor como un tonto notificador, no como una copia de la base de datos.

Esta etapa es **documental**: no toca `src/domain`, `src/application` ni `src/ui` (regla 2).
Entrega el contrato (`pending-visits` + `notify` en el swagger) y este spec. La implementación
(cliente que sube el feed, lambda, SES) es etapa futura.

## Decisiones tomadas (brainstorming)

1. **Canal: email (Amazon SES) primero.** Casi gratis a este volumen, sin aprobaciones, funciona
   hoy. El aviso puede llegar tarde (el asesor lee el correo cuando vuelve del campo). El canal se
   implementa detrás de un puerto (mismo patrón `ReminderNotifier` del dominio) para poder sumar
   WhatsApp (Meta Cloud API o agregador Twilio/360dialog/Umnico) sin tocar la lambda.
2. **Contrato del feed: snapshot reemplazable `PUT /v1/pending-visits`.** El cliente sube la lista
   completa de programadas vigentes denormalizadas; el servidor reemplaza el set entero. No hay
   DELETE por ítem (lo que no está en la lista, no existe) → sin reconciliación de borrados ni
   "notificaciones fantasma" por un DELETE olvidado. Payload chico (~una docena de items).
3. **Cuándo sube el cliente:** al abrir la app y después de cada cambio de programadas (cumplir,
   programar, editar, cancelar). Best-effort: si no se abre la app durante días, el feed queda viejo.
4. **Idempotencia sin estado de dominio: log keyed por `(visitId, remindAt)`.** La lambda notifica
   a las programadas con `remindAt ≤ now` y `plannedFor > now` cuyo par no esté en el log, y las
   registra. Editar una programada (mismo `visitId`, nuevo `remindAt`) genera un key nuevo → vuelve
   a notificar. Auto-recupera días perdidos (la próxima corrida alcanza lo vencido; no depende de
   una "ventana del día").
5. **Disparo: EventBridge cron diario (10:00 UTC ≈ 07:00 AR).** La cadencia exacta no es crítica
   gracias al log; el email matutino alcanza para el "recordá visitar hoy/mañana".
6. **`POST /v1/notify` manual (testing).** Ejecuta el mismo recorrido de la lambda; `dryRun: true`
   calcula sin enviar ni escribir en el log. Permite probar el pipeline y el email sin esperar el cron.
7. **Auth: misma bearer key** del resto de la API (un solo usuario = una clave).

## Arquitectura

```
Cliente (app)                      Servidor remoto
──────────────                     ────────────────
abre / cambia una programada
  → PUT /v1/pending-visits          Snapshot "programadas vigentes"
      (array de PendingVisit,       (denormalizado: fieldName/clientName/zoneName)
       reemplaza todo)              + log de envíos keyed por (visitId, remindAt)
                                    (S3 JSON o DynamoDB — DB no-relacional/relacional: diferido)

                                    EventBridge cron 10:00 UTC
                                       → Lambda reminder-notifier
                                           1. lee el snapshot
                                           2. para cada item:
                                              remindAt = plannedFor − reminderLeadDays
                                              notifica si remindAt ≤ now ∧ plannedFor > now
                                                ∧ (visitId, remindAt) ∉ log
                                           3. email digest (SES) con los que disparan
                                           4. appendea (visitId, remindAt) al log
```

**El servidor solo conoce dos cosas**: la proyección actual de programadas y qué ya se envió. No
entiende el dominio (no valida transiciones, no calcula urgencia, no conoce clientes/zonas como
entidades — los nombres llegan denormalizados).

### Formato del email digest (propuesta)

- **Asunto**: `Campo — recordatorio: N visitas`.
- **Cuerpo** (una línea por item, ordenadas por `plannedFor`):
  `Lote {fieldName} · {clientName} · {zoneName} — {plannedFor}` + nota entre paréntesis si hay.
- Se envía **un solo email por corrida** (digest), no uno por visita.

## Contrato (cambios al swagger)

- `PUT /v1/pending-visits` (tag `ReminderFeed`): cuerpo = array de `PendingVisit`; responde `204`.
  `PendingVisit`: `{ visitId, fieldId, fieldName, clientName?, zoneName?, plannedFor,
  reminderLeadDays, notes? }` (el cliente arma los nombres; el servidor no hace joins).
- `POST /v1/notify` (tag `Maintenance`): cuerpo opcional `{ dryRun?: boolean }`; responde `200` con
  `{ sent, items }`.
- Validación estructural por parte del servidor (`422`): `fieldName` no vacío, `plannedFor`
  date-time, `reminderLeadDays ≥ 0`. Sin invariantes de negocio (responsabilidad del cliente).

## Costos y límites (explícitos)

- **Freshness best-effort**: si no abrís la app, el feed queda viejo → aviso tarde, o para una
  visita ya realizada. Mitigación parcial: `plannedFor > now` en la lambda (una visita cumplida
  deja de estar en el snapshot al subir el cambio).
- **Aditivo al banner in-app**: no reemplaza `DispatchDueReminders`; cubre el caso "no abrí la app".
- **Un solo email por día** si se pierde una corrida se acumula la próxima (aceptado).
- El log crece un renglón por envío (trivial a esta escala; poda opcional a futuro).

## Diferidos (YAGNI)

- Implementación del cliente (use case que arma el snapshot + puerto `RemoteReminderFeed`) y de la
  lambda/SES: etapa futura sobre este contrato.
- Decisión de DB del lado servidor (S3 JSON vs DynamoDB) y la tabla/objeto del log.
- Canal WhatsApp (Meta Cloud API o agregador): detrás del mismo puerto de notificación.
- `DELETE /v1/pending-visits` y per-item: no se necesitan (snapshot reemplaza).
- Poda del log de envíos.

## ROADMAP

Al cerrar: agregar la fila de etapa "recordatorios-remotos" (contrato + spec, sin código de
producto) y una nota en "Todavía no se puede" (la notificación por email fuera de la app queda
pendiente de implementación).
