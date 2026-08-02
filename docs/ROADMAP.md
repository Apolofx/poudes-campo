# Campo — Roadmap y backlog

> **Fuente única de verdad del backlog.** Este archivo lo controlás vos (versionado en git). Se actualiza al cerrar cada etapa. La memoria del asistente solo apunta acá — no duplica este contenido.

**Qué es Campo:** PWA offline-first para un asesor agronómico que recorre ~40 lotes: registrar visitas y saber cuándo volver. Arquitectura hexagonal (TypeScript + Vitest, dominio puro sin infra). Regla dura: **ningún dato de dosis/agroquímicos/prescripciones entra jamás al sistema**.

Última actualización: 2026-08-02.

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

### ❌ Todavía no se puede
- Sincronizar con un servidor / usar en varios dispositivos → **Etapa 5**.

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
| **5 — sync + servidor** | Cola outbox en infra, LWW + tombstones terminales, `ConflictResolver` puro | ⏳ Pendiente |

---

## Decisiones diferidas / deuda anotada

Cosas conscientemente pospuestas, con el momento en que corresponde resolverlas:

- **Subtítulo con el nombre del lote en "Registrar visita"** — se diseñó en 1c (ej. "El Alto · Est. Pérez") pero se difirió: no es CSS, requiere que la pantalla cargue el field por id, y el container no expone esa lectura (haría falta un `GetField` / exponer `findById` → toca aplicación). → mejora funcional chica, pliega bien con Etapa 2 o tarea aparte.
- ~~**`aria-live` en el estado vacío de "Buscar lote"**~~ — **resuelto en 4c-pulido-ux**: la lista de resultados y el empty llevan anuncio (el empty suma sugerencia accionable).
- **Íconos PWA placeholder** — `public/pwa-192.png` y `pwa-512.png` son placeholders 1×1. Reemplazar por arte real antes de un release.
- **Borde de timezone (este de UTC)** — las fechas se construyen como medianoche-UTC (`new Date(`${iso}T00:00:00.000Z`)`) y se comparan contra el reloj real; para usuarios al **este** de UTC puede rechazar "hoy" como fecha futura. Usuario objetivo UTC-3 (oeste) **no afectado**. (En 1c se endureció el helper de tests para que sea date-relative — la bomba de tiempo de los tests ya no existe; el borde de dominio sigue diferido.) El arreglo va atado a revisar la comparación de día-calendario del dominio. → cuando se toque la lógica de fechas del dominio.
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
