# Campo — Roadmap y backlog

> **Fuente única de verdad del backlog.** Este archivo lo controlás vos (versionado en git). Se actualiza al cerrar cada etapa. La memoria del asistente solo apunta acá — no duplica este contenido.

**Qué es Campo:** PWA offline-first para un asesor agronómico que recorre ~40 lotes: registrar visitas y saber cuándo volver. Arquitectura hexagonal (TypeScript + Vitest, dominio puro sin infra). Regla dura: **ningún dato de dosis/agroquímicos/prescripciones entra jamás al sistema**.

Última actualización: 2026-07-29.

---

## Estado actual — qué se puede y qué no

### ✅ Se puede hacer hoy
- Ver la lista de todos los lotes (lote — cliente · zona).
- Buscar/filtrar lotes por nombre de lote, cliente o zona.
- Registrar una visita: fecha (no futura), notas, y próxima visita (en N días / en una fecha / sin próxima) con aviso X días antes.
- **Pantalla Inicio (agenda):** ver las próximas visitas ordenadas por urgencia (triage por horizonte: Vencidas / Esta semana / Más adelante, esta última colapsada), con agrupamiento dinámico por Tiempo/Zona/Cliente. Barra de pestañas Inicio · Buscar.
- **Aviso al abrir la app:** un banner en Inicio resume, agrupados por zona, los lotes cuyo umbral de aviso (`remindAt = próxima − X días antes`) ya se cruzó. Cálculo idempotente al abrir (`PENDING→SENT`, no reaparece salvo que venzan nuevos); se puede cerrar.
- Todo offline y persistente en el dispositivo (IndexedDB). Instalable como PWA.

### ❌ Todavía no se puede
- Cancelar o editar una visita registrada → **Etapa 4**.
- Dar de alta / editar lotes, clientes y zonas reales (hoy son datos de ejemplo precargados) → **Etapa 4**.
- Sincronizar con un servidor / usar en varios dispositivos → **Etapa 5**.

### Datos
Los ~40 lotes actuales son un **fixture de ejemplo** (nombres inventados). Sirven para probar/demostrar el flujo buscar→registrar. Se descartan cuando llegue el ABM de catálogo (Etapa 4).

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
| **4 — cancelar/editar + catálogo** | Cancelar/editar visitas (baja lógica auditable) + ABM de Zone/Client/Field (alta/edición/archivado) | ⏳ Pendiente |
| **5 — sync + servidor** | Cola outbox en infra, LWW + tombstones terminales, `ConflictResolver` puro | ⏳ Pendiente |

---

## Decisiones diferidas / deuda anotada

Cosas conscientemente pospuestas, con el momento en que corresponde resolverlas:

- **Subtítulo con el nombre del lote en "Registrar visita"** — se diseñó en 1c (ej. "El Alto · Est. Pérez") pero se difirió: no es CSS, requiere que la pantalla cargue el field por id, y el container no expone esa lectura (haría falta un `GetField` / exponer `findById` → toca aplicación). → mejora funcional chica, pliega bien con Etapa 2 o tarea aparte.
- **`aria-live` en el estado vacío de "Buscar lote"** — hoy "No se encontró ningún lote." es un `<p>` sin anuncio para lectores de pantalla. → pulido a11y, junto con otras mejoras de accesibilidad.
- **Íconos PWA placeholder** — `public/pwa-192.png` y `pwa-512.png` son placeholders 1×1. Reemplazar por arte real antes de un release.
- **Borde de timezone (este de UTC)** — las fechas se construyen como medianoche-UTC (`new Date(`${iso}T00:00:00.000Z`)`) y se comparan contra el reloj real; para usuarios al **este** de UTC puede rechazar "hoy" como fecha futura. Usuario objetivo UTC-3 (oeste) **no afectado**. (En 1c se endureció el helper de tests para que sea date-relative — la bomba de tiempo de los tests ya no existe; el borde de dominio sigue diferido.) El arreglo va atado a revisar la comparación de día-calendario del dominio. → cuando se toque la lógica de fechas del dominio.
- ~~**Validación de `reminderLeadDays`**~~ — **resuelto en Etapa 3**: `RecordVisit` ahora clampa el lead a `[0, intervalo]` (lead negativo → 0, exceso → intervalo); la UI además topea el input con `max = intervalo`. Clampa, no rechaza: nunca se pierde el registro de la visita por un lead fuera de rango.
- **Índice idb `by-status` para `findDue`** — hoy `IdbReminderRepository.findDue` hace `getAll` + filtro en memoria (trivial a escala de un usuario). Si el volumen de reminders crece, agregar un índice `by-status` (implica bump de versión del esquema idb + migración). → cuando el volumen lo pida.
- **Fallback `nextVisitDate ?? remindAt` en `DispatchDueReminders` sin test** — la rama para un lote presente en la jerarquía pero sin follow-up vigente no está cubierta (raro: registrar visita cancela el reminder y fija el follow-up). No es load-bearing (el banner no muestra `nextVisitDate`). → follow-up test barato si se toca el dispatch.
- **Persistir `SENT` antes de notificar (dispatch)** — el dispatch marca `SENT` dentro del loop y notifica una sola vez al final; si un `save` idb fallara a mitad de loop, esos avisos quedan `SENT` sin haberse mostrado y no reaparecen. Aceptado como tradeoff del diseño best-effort offline (la alternativa notificar-antes-de-persistir arriesga doble-show). → revisar si se endurece el canal de notificación.
- **`interval.days` sub-cuenta <1 día** — para próxima-visita con fecha manual, `interval.days` se calcula por días-calendario (UTC) mientras `nextVisitDate` conserva la hora, así que el intervalo guardado puede sub-contar el gap real por <1 día. Es diseño documentado, no bug.
- **Etapa 2 reencuadró el roadmap (asentado):** la urgencia se mide **absoluta** (cuándo vence), no proporcional al intervalo del lote; y el agrupamiento es **dinámico** (toggle Tiempo/Zona/Cliente), no fijo por zona. El VO `VisitUrgency` ya no depende de `intervalDays`. Detalle en el spec/plan de Etapa 2.
- **Orden de grupos en Zona/Cliente = alfabético** (locale es). Posible mejora: ordenar los grupos por urgencia (el más apremiante primero). → cuando el uso lo pida.
- **Desempate de `createdAt` idéntico en `findCurrentFollowUps`** no está especificado (ambos adaptadores usan "primero en iterar gana", con orden distinto entre in-memory e idb). Improbable (mismo día + mismo lote); documentado en el contrato del puerto. → atado a revisar la lógica de fechas del dominio.
- **Estilos de Inicio/tab bar sin pasada de diseño dedicada:** la Etapa 2 trajo CSS funcional reutilizando los tokens de 1c (look con datos reales verificado en navegador: contraste, acento de vencidas y tab activo OK); una pasada visual fina (como fue 1c para las 2 primeras pantallas) queda para cuando se quiera subir el nivel.
- **Upgrades técnicos anotados (no construidos):** guardar fechas como ISO string (para el LWW de Etapa 5), HLC para conflictos (Etapa 5), TanStack Query y Playwright si el flujo de UI crece.

---

## Glosario / decisiones de arquitectura clave

- La entidad de terreno se llama **`Field`** (no `Plot`). `Zone`/`Client` son entidades con id propio.
- **Tres conceptos temporales separados**: `nextVisitDate` (vencimiento), `intervalDays` (largo de ventana del semáforo), `remindAt = nextVisitDate − reminderLeadDays` (cuándo dispara el aviso). La próxima visita se ancla al momento de registro, no a la fecha (retroactiva) de la visita.
- **Reminder** es agregado separado de Visit (referenciado por id). Registrar una visita cancela los reminders PENDING previos del field.
- **IDs**: UUIDv7 generados en cliente vía puerto `IdGenerator` (offline-first).
- **CRUD no uniforme**: catálogo (Zone/Client/Field) = alta/edición/archivado; eventos (Visit/Reminder) = no CRUD, se corrigen dentro de reglas o se cancelan (baja lógica).
- **UI** = React + Vite tratado como adaptador reemplazable.

Los detalles completos de cada decisión viven en los specs y planes bajo `docs/superpowers/`.
