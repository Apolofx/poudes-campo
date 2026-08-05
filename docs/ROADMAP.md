# Campo — Roadmap y backlog

> **Fuente única de verdad del backlog.** Este archivo lo controlás vos (versionado en git). Se actualiza al cerrar cada etapa. La memoria del asistente solo apunta acá — no duplica este contenido.

**Qué es Campo:** PWA offline-first para un asesor agronómico que recorre ~40 lotes: registrar visitas y saber cuándo volver. Arquitectura hexagonal (TypeScript + Vitest, dominio puro sin infra). Regla dura: **ningún dato de dosis/agroquímicos/prescripciones entra jamás al sistema**.

Última actualización: 2026-08-04.

---

## Estado actual — qué se puede y qué no

### ✅ Se puede hacer hoy
- Ver la lista de todos los lotes (lote — cliente · zona).
- Buscar/filtrar lotes por nombre de lote, cliente o zona.
- Registrar una visita: fecha (no futura), notas, y próxima visita (en N días / en una fecha / sin próxima) con aviso X días antes.
- **Pantalla Inicio (agenda):** ver las próximas visitas ordenadas por urgencia (triage por horizonte: Vencidas / Esta semana / Más adelante, esta última colapsada), con agrupamiento dinámico por Tiempo/Zona/Cliente. Barra de pestañas Inicio · Buscar.
- **Aviso al abrir la app:** un banner en Inicio resume, agrupados por zona, los lotes cuyo umbral de aviso (`remindAt = próxima − X días antes`) ya se cruzó. Cálculo idempotente al abrir (`PENDING→SENT`, no reaparece salvo que venzan nuevos); se puede cerrar.
- **Catálogo (ABM):** tercer tab "Catálogo" con alta/edición/archivado (baja lógica reversible) de Zonas, Clientes y Lotes. Archivar un padre con lotes activos pregunta si cascadear (archivar los lotes) o mantenerlos (quedan huérfanos "Sin cliente"/"Sin zona", reasignables al editar el lote). "Ver archivados" + restaurar. Acción "Borrar todos los datos". Buscar/agenda/avisos ocultan lo archivado y muestran "Sin cliente/Sin zona" para huérfanos.
- **Historial de visitas por lote:** desde Buscar, tocar un lote lleva a su historial (la fila de Agenda sigue yendo directo a Registrar). Una sola lista unificada (realizadas, programadas y canceladas) con badges **Realizada / Programada / Cancelada**; cada fila abre su detalle.
- **Editar y cancelar una visita:** desde el detalle de una visita, **Editar** permite corregir fecha y notas de una **realizada**; en una **programada** permite cambiar fecha, aviso (preservando el lead original al reabrir) y notas. **Cancelar** es una baja lógica auditable (`cancelledAt`), no un borrado. Una visita cancelada se muestra read-only.
- **Programar visitas futuras:** desde el historial de un lote (o el FAB de Inicio, que crea lote/zona/cliente si hace falta), "Programar visita" agenda una visita futura (fecha mín. mañana, aviso X días antes y notas). La programada vive en la **misma entidad `Visit`** (estado `PENDING`) y aparece en el historial y en la agenda. **Una sola programada activa por lote** (programar de nuevo reemplaza: la anterior queda cancelada). Al registrar la visita real, la programada se **cumple** (`PENDING→DONE`, conservando la fecha programada como referencia) y su aviso se cancela; el aviso queda anclado a la programada (`reminderLeadDays`).
- Todo offline y persistente en el dispositivo (IndexedDB). Instalable como PWA.
- **Recordatorios por email:** cada día a las 07:00 un digest avisa las visitas cuyo umbral (`remindAt`) venció. La app sube el feed de programadas vigentes en cada arranque y tras registrar/editar/programar/cancelar (`PUT /v1/pending-visits`); el backend (`campo-poudes-backend`, AWS dev) calcula vencidos con watermark idempotente y manda el digest por **Resend** (`avisos@navlogvfr.app`) al **email de cada tenant**. Auth por **API key por tenant** (`tnt_<id>_<secreto>`, sha256 en DynamoDB, comparación timing-safe); la app guarda la key en `localStorage` (pantalla de Configuración) con compat del env legacy. Nota: por reputación de remitente (dominio nuevo) Gmail puede derivarlo a spam hasta calentar; ver diferido.

### ❌ Todavía no se puede
- Sincronizar con un servidor / usar en varios dispositivos → **Etapa 5**.
- **Vista semanal de la agenda** — alternar la pantalla Inicio a una vista de calendario semanal con las visitas por día, para planificar la recorrida. Gateada por **feature flag de Vercel** (`agendaSemanal`), como `darkMode`.

### Datos
El seed de ~40 lotes de ejemplo quedó **gateado a modo dev** (`import.meta.env.DEV`); **producción arranca vacía**. Se cargan los lotes reales a mano por el ABM. Para limpiar un install que ya tiene el fixture: acción "Borrar todos los datos" en Catálogo.

---

## Etapas

MVP real = Etapas 1–3. Cada etapa se hace en su propia rama, con brainstorming → plan → ejecución TDD → merge a `main`.

| Etapa | Qué entrega | Estado |
|---|---|---|
| **1 — núcleo lógico** | Dominio + aplicación puros: buscar lotes (HU5) + registrar visita con follow-up (HU1/HU2) | ✅ Completa (merge en `main`, 57 tests) |
| **1b — IndexedDB + UI + PWA** | Persistencia real, UI React (2 pantallas), PWA instalable offline | ✅ Completa (merge `46d23ed`, 100 tests) |
| **1c — pasada de diseño** | Estilo visual de las 2 pantallas (paleta "Campo" verde, fuente del sistema, mobile-first): buscador sticky, filas táctiles, control segmentado, back link, estado vacío | ✅ Completa (103 tests) |
| **2 — panel de urgencia** | Pantalla Inicio: próximas visitas por urgencia **absoluta** (VO `VisitUrgency` al vuelo, nunca persistido), triage por horizonte temporal, agrupamiento dinámico (toggle Tiempo/Zona/Cliente), tab bar Inicio·Buscar | ✅ Completa (126 tests) |
| **3 — aviso al abrir** | Cálculo idempotente al abrir la app (`DispatchDueReminders`, PENDING→SENT); backlog colapsado en un resumen por zona; `ReminderNotifier` agnóstico al protocolo con adaptador in-app; clamp de `reminderLeadDays` en `RecordVisit` | ✅ Completa (145 tests) |
| **4 — cancelar/editar + catálogo** | Partida en 4a + 4b (dos subsistemas independientes) | — |
| **4b — catálogo (ABM)** | ABM de Zone/Client/Field: `archived` (baja lógica reversible) + refs opcionales (huérfanos), cascada/nulificado al archivar padre, reset, tab "Catálogo" (ABM genérico Zonas/Clientes + Lotes con pickers), seed gateado a dev | ✅ Completa (209 tests) |
| **4a — cancelar/editar visitas** | Cancelar/editar visitas registradas (baja lógica auditable sobre eventos), historial por lote | ✅ Completa (244 tests) |
| **4c — programar visitas** | Programar/editar/cancelar visitas futuras por lote (aviso propio, baja lógica, consumo al registrar la visita real) | ✅ Completa (283 tests) |
| **4c-pulido-ux** | Pulido UX/UI (evaluación): `max` fecha futura en Registrar, CTA en agenda/historial vacíos, sugerencia + `aria-live` en búsqueda, íconos SVG en aviso, label "Cancelar visita" unificado, `ConfirmDialog` con ESC + foco inicial | ✅ Completa (289 tests) |
| **onboarding — camino único** | Primera visita programada en un solo camino: FAB "Programar visita" en Inicio, empty state que promete a programar, `ScheduleVisitEnsuringField` (orquesta crear zona/cliente/lote + agendar), combobox `PickOrCreate` (elegir o crear, match por nombre sin duplicar), `ScheduledVisitFormScreen` unificada con `/programar` | ✅ Completa (306 tests) |
| **unificar-visitas** | Una sola entidad `Visit` con ciclo de vida (`PENDING|DONE|CANCELLED`, `plannedFor`/`visitedAt`/`cancelledAt`); mueren `ScheduledVisit` y `followUp`. Registrar cumple la programada; una sola PENDIENTE activa por lote; el aviso vive en la PENDIENTE (`reminderLeadDays`, sin `scheduledVisitId`); historial unificado con badges Realizada/Programada/Cancelada; migración idb v2→v3 unifica `scheduled-visits` en `visits` | ✅ Completa (302 tests) |
| **api-contract — contrato REST** | Swagger (`docs/api/openapi.yaml`, OpenAPI 3.0.3, válido con redocly): espejo CRUD para respaldo remoto — `zones`/`clients`/`fields`/`visits`/`reminders` con `PUT` upsert (ids UUIDv7 de cliente), filtros de listado que reflejan los puertos, bearer API key, LWW con `updatedAt` de servidor, `POST /v1/clear`. Sin código: base para el adapter remoto futuro. Spec en `docs/superpowers/specs/2026-08-02-api-rest-contract-design.md` | ✅ Completa (0 tests de código; contrato lint-eado) |
| **recordatorios-remotos** | Contrato para notificar por email sin replicar el dominio: el cliente sube un **snapshot reemplazable** de programadas vigentes (`PUT /v1/pending-visits`, denormalizado) y una lambda diaria (EventBridge + SES) notifica con log idempotente keyed `(visitId, remindAt)`; `POST /v1/notify` con `dryRun` para probar. Sin código de producto: base para la implementación futura. Spec en `docs/superpowers/specs/2026-08-02-recordatorios-remotos-design.md` | ✅ Completa (0 tests de código; contrato lint-eado) |
| **recordatorios-remotos-mvp** | Implementación del MVP (plan `docs/superpowers/plans/2026-08-02-recordatorios-remotos-mvp.md`): **backend `campo-poudes-backend`** (proyecto hermano, molde `hexagonal-serverless-ts`: DynamoDB 2 items `FEED#SNAPSHOT`/`FEED#LAST_RUN` con watermark CAS — reemplaza al log `(visitId, remindAt)` del spec —, SES digest, cron UTC, bearer in-handler; endpoints `PUT /v1/pending-visits` + `POST /v1/notify`; **42 tests jest**) + **push del feed desde la app** (puerto `ReminderFeedRepository` + `SyncPendingVisitsFeed` + adapter HTTP + triggers boot/mutaciones; **321 tests**) | ✅ Completa (backend 42 tests, app 321; **deployada en AWS dev**) |
| **multitenant-keys** | Instancias aisladas por owner: **API keys por tenant** (`tnt_<id>_<secreto>`, solo sha256 en DynamoDB, auth timing-safe por `GetItem` directo), digest al **email del tenant** (no lo manda el cliente), envío por **Resend** (reemplaza SES, dominio `navlogvfr.app`, `FROM_EMAIL=avisos@navlogvfr.app`); cron y endpoints particionados por tenant (`scan` de perfiles), script `create-tenant`. En la app: puerto `TenantConfigRepository` + adapter `localStorage`, **pantalla de Configuración** + gate de primer uso, config efectiva en runtime con compat env legacy. Plan `docs/superpowers/plans/2026-08-04-multitenant-keys.md`, spec `docs/superpowers/specs/2026-08-04-multitenant-keys-design.md` | ⏳ Código completo (backend 60 tests, app 343); **deploy del backend pendiente** de verificar `navlogvfr.app` en Resend |
| **5 — sync + servidor** | Cola outbox en infra, LWW + tombstones terminales, `ConflictResolver` puro | ⏳ Pendiente |

---

## Decisiones diferidas / deuda anotada

Cosas conscientemente pospuestas, con el momento en que corresponde resolverlas:

- **Subtítulo con el nombre del lote en "Registrar visita"** — se diseñó en 1c (ej. "El Alto · Est. Pérez") pero se difirió: no es CSS, requiere que la pantalla cargue el field por id, y el container no expone esa lectura (haría falta un `GetField` / exponer `findById` → toca aplicación). → mejora funcional chica, pliega bien con Etapa 2 o tarea aparte.
- ~~**`aria-live` en el estado vacío de "Buscar lote"**~~ — **resuelto en 4c-pulido-ux**: la lista de resultados y el empty llevan anuncio (el empty suma sugerencia accionable).
- **Íconos PWA placeholder** — `public/pwa-192.png` y `pwa-512.png` son placeholders 1×1. Reemplazar por arte real antes de un release.
- ~~**Borde de timezone (este de UTC)**~~ — **resuelto en "unificar-visitas"**: el dominio ya no compara instantes; `Clock` gana `today()` (día-calendario local) y todas las comprobaciones de fecha futura/pasada se hacen contra el día-ISO local (`isoDay`/`daysBetweenIso`). Ahora programar/registrar/editar "hoy/mañana" funciona sin importar a qué hora del día ni en qué huso: un 23:25 ART "mañana" ya no se ve como pasado-UTC. Contrato: las fechas entran al dominio codificadas como medianoche-UTC del día local (así las construye la UI; los tests de integración usan `utcDate(localTodayIso())`, no instantes crudos).
- ~~**Validación de `reminderLeadDays`**~~ — **resuelto en Etapa 3**: `RecordVisit` ahora clampa el lead a `[0, intervalo]` (lead negativo → 0, exceso → intervalo); la UI además topea el input con `max = intervalo`. Clampa, no rechaza: nunca se pierde el registro de la visita por un lead fuera de rango.
- **Índice idb `by-status` para `findDue`** — hoy `IdbReminderRepository.findDue` hace `getAll` + filtro en memoria (trivial a escala de un usuario). Si el volumen de reminders crece, agregar un índice `by-status` (implica bump de versión del esquema idb + migración). → cuando el volumen lo pida.
- **Fallback `nextVisitDate ?? remindAt` en `DispatchDueReminders` sin test** — la rama para un lote presente en la jerarquía pero sin PENDIENTE vigente no está cubierta (raro: registrar visita crea la PENDIENTE y el reminder juntos). No es load-bearing (el banner no muestra `nextVisitDate`). → follow-up test barato si se toca el dispatch.
- **Persistir `SENT` antes de notificar (dispatch)** — el dispatch marca `SENT` dentro del loop y notifica una sola vez al final; si un `save` idb fallara a mitad de loop, esos avisos quedan `SENT` sin haberse mostrado y no reaparecen. Aceptado como tradeoff del diseño best-effort offline (la alternativa notificar-antes-de-persistir arriesga doble-show). → revisar si se endurece el canal de notificación.
- **`interval.days` sub-cuenta <1 día** — para próxima-visita con fecha manual, `interval.days` se calcula por días-calendario (UTC) mientras `plannedFor` conserva la hora, así que el intervalo guardado puede sub-contar el gap real por <1 día. Es diseño documentado, no bug.
- **Etapa 2 reencuadró el roadmap (asentado):** la urgencia se mide **absoluta** (cuándo vence), no proporcional al intervalo del lote; y el agrupamiento es **dinámico** (toggle Tiempo/Zona/Cliente), no fijo por zona. El VO `VisitUrgency` ya no depende de `intervalDays`. Detalle en el spec/plan de Etapa 2.
- **Orden de grupos en Zona/Cliente = alfabético** (locale es). Posible mejora: ordenar los grupos por urgencia (el más apremiante primero). → cuando el uso lo pida.
- **Estilos de Inicio/tab bar sin pasada de diseño dedicada:** la Etapa 2 trajo CSS funcional reutilizando los tokens de 1c (look con datos reales verificado en navegador: contraste, acento de vencidas y tab activo OK); una pasada visual fina (como fue 1c para las 2 primeras pantallas) queda para cuando se quiera subir el nivel.
- **Upgrades técnicos anotados (no construidos):** guardar fechas como ISO string (para el LWW de Etapa 5), HLC para conflictos (Etapa 5), TanStack Query y Playwright si el flujo de UI crece.
- **Etapa 4 se partió en 4a + 4b (asentado):** eran dos subsistemas independientes (cancelar/editar visitas vs ABM de catálogo) que peleaban por el foco de un solo spec. Se hizo **4b primero** (tener datos reales le da sentido al resto), después 4a.
- **Diferidos nuevos de 4b (en el spec, sección Diferidos):** campos `crop`/`hectares`/`coordinates` en el form de Lote (la entidad los conserva, el form no los expone); import/CSV de lotes; unicidad de nombres; índices idb por `archived`/por padre (hoy `getAll`+filtro a escala ~40); **cancelar reminders PENDING al archivar un lote** (hoy el aviso se filtra por la jerarquía, no se cancela el reminder); focus-trap en `ConfirmDialog` (a11y; **parcial en 4c-pulido-ux**: ya cierra con ESC y enfoca el primer botón; falta encerrar el foco en el diálogo); orden de grupos por urgencia en Agenda (sigue alfabético + "Sin X" al final).
- **Diferidos nuevos de 4a:**
  - ~~**Lead del aviso al editar un follow-up**~~ — **resuelto en "unificar-visitas"**: el lead vive en la PENDIENTE (`reminderLeadDays`), así que editar una programada recupera el aviso original y no lo resetea.
  - **Historial pre-edición**: editar es corrección in-place; no se guarda el valor anterior. Traza de cambios queda para el modelo de eventos de Etapa 5.
  - **Motivo de cancelación**: no se pide (solo `cancelledAt`); fácil de agregar si el uso lo pide.
  - **Revivir el aviso de la visita anterior al cancelar**: diferido; se aceptó el desfase (la agenda cae al follow-up anterior pero sin aviso PENDING).
  - **Editar una visita que no es la última** con cambio de follow-up: actualiza datos pero no toca reminders (mantiene el invariante). Documentado como comportamiento, no bug.
  - **Índices idb** por `visitId` en reminders / por `status` en visitas: hoy getAll+filtro a escala ~40; cuando el volumen lo pida.
  - **Diferidos de "unificar-visitas":**
  - **Doble PENDIENTE imposible por regla de negocio, no por schema** — el invariante de una sola PENDIENTE activa por lote se mantiene en los casos de uso y en la migración; el schema idb v3 no lo hace cumplir a nivel de índice (implica índice único parcial o agregado a escala ~40; cuando el volumen lo pida).
  - **`next-visit.ts` expuesto en la API de aplicación** — `resolveNextPending` (intervalo/fecha/ninguna + clamp) vive como helper exportado en `src/application/use-cases/next-visit.ts` (no es un caso de uso con puerto propio); documentado como diseño, no como deuda.
- **Diferidos de onboarding (camino único):** reusar `PickOrCreate` en el form de Lote de Catálogo (decisión explícita: solo el camino único en la etapa); búsqueda diferida para muchos lotes (>40 no es un caso real); FAB solo en Inicio.
- **Diferidos de recordatorios-remotos-mvp (en el plan, sección Diferidos):**
  - **SES at-most-once** — `claimRun` avanza el watermark **antes** de enviar; si el envío falla, el batch se pierde (solo re-dispara lo que venza después). Aceptado para MVP: el banner in-app y la agenda cubren el caso. → log `(visitId, remindAt)` del spec si se quiere red-trigger por edición.
  - ~~**API key embebida en el bundle de la PWA**~~ — **resuelto en "multitenant-keys"**: la app lee la key del tenant en runtime (`localStorage`, pantalla de Configuración) con compat del env legacy; la key por tenant sale del bundle. En el backend, rotar una key solo revoca ese tenant.
  - **Cron UTC fijo** — `cron(0 10 * * ? *)` (07:00 ART). La marca de agua hace la hora poco crítica (at-most-once + catch-up). El cron itera los tenants (`scan` de perfiles) y envía el digest al email de cada uno.
  - **Freshness best-effort** — si no se abre la app durante días, el feed queda viejo → aviso tarde o para una visita ya realizada. Mitigación parcial: `plannedFor > now` en la lambda (una visita cumplida deja de estar en el snapshot al subir el cambio).
  - **Reputación del remitente** — `navlogvfr.app` es dominio nuevo (IP compartida de SES antes, ahora Resend); Gmail lo puede derivar a spam a pesar de `dkim/spf/dmarc=pass`. Se calienta con envíos reales + "No es spam" en Gmail (el digest diario ayuda). → revisar en 1–2 semanas; si persiste, DMARC `p=quarantine` o IP dedicada si el volumen lo pide.
  - **Multitenant sin UI de gestión** — el alta de tenants es por script (`npm run create-tenant`), a demanda; no hay panel de admin ni auto-provisioning. → cuando haya más de un owner.
  - **Scan de perfiles en el cron** — `listProfiles` usa `scan begins_with(pk, TENANT#)` + `sk=PROFILE`; a escala de pocos tenants es gratis, pero si crece conviene un GSI o tabla de índices. → cuando haya decenas de tenants.

---

## Glosario / decisiones de arquitectura clave

- La entidad de terreno se llama **`Field`** (no `Plot`). `Zone`/`Client` son entidades con id propio.
- **Una sola entidad `Visit` con ciclo de vida** (`PENDING → DONE → CANCELLED`): `ScheduledVisit` y `followUp` murieron. Una "visita programada" es una `Visit` PENDING y la próxima visita de un registro también (PENDING con `plannedFor`); registrar la visita real **cumple** la PENDIENTE del lote (`PENDING→DONE` conservando `plannedFor`). Una sola PENDIENTE activa por lote.
- **Tres conceptos temporales**: `plannedFor` (cuándo debería ocurrir), `visitedAt` (cuándo ocurrió, solo DONE), `remindAt = plannedFor − reminderLeadDays` (cuándo dispara el aviso). El lead vive en la PENDIENTE.
- **Reminder** es agregado separado de Visit (referenciado por `visitId`, sin `scheduledVisitId`). Registrar/programar cancela los reminders PENDING previos del field.
- **IDs**: UUIDv7 generados en cliente vía puerto `IdGenerator` (offline-first).
- **CRUD no uniforme**: catálogo (Zone/Client/Field) = alta/edición/archivado; eventos (Visit/Reminder) = no CRUD, se corrigen dentro de reglas o se cancelan (baja lógica).
- **UI** = React + Vite tratado como adaptador reemplazable.

Los detalles completos de cada decisión viven en los specs y planes bajo `docs/superpowers/`.
