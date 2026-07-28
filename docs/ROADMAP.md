# Campo — Roadmap y backlog

> **Fuente única de verdad del backlog.** Este archivo lo controlás vos (versionado en git). Se actualiza al cerrar cada etapa. La memoria del asistente solo apunta acá — no duplica este contenido.

**Qué es Campo:** PWA offline-first para un asesor agronómico que recorre ~40 lotes: registrar visitas y saber cuándo volver. Arquitectura hexagonal (TypeScript + Vitest, dominio puro sin infra). Regla dura: **ningún dato de dosis/agroquímicos/prescripciones entra jamás al sistema**.

Última actualización: 2026-07-28.

---

## Estado actual — qué se puede y qué no

### ✅ Se puede hacer hoy
- Ver la lista de todos los lotes (lote — cliente · zona).
- Buscar/filtrar lotes por nombre de lote, cliente o zona.
- Registrar una visita: fecha (no futura), notas, y próxima visita (en N días / en una fecha / sin próxima) con aviso X días antes.
- Todo offline y persistente en el dispositivo (IndexedDB). Instalable como PWA.

### ❌ Todavía no se puede
- Ver cuándo toca volver / semáforo de urgencia por zona → **Etapa 2**.
- Que la app avise al abrir que hay visitas por vencer → **Etapa 3**.
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
| **1c — pasada de diseño** *(propuesta)* | Estilo visual de las 2 pantallas existentes (mobile-first) | 🔜 Próxima — a brainstormear |
| **2 — panel de urgencia** | Semáforo/urgencia por zona calculado contra `nextVisitDate`, proporcional al intervalo del lote (VO `VisitUrgency` al vuelo, nunca persistido) | ⏳ Pendiente |
| **3 — aviso al abrir** | Cálculo idempotente al abrir la app (`DispatchDueReminders`, PENDING→SENT); backlog colapsado en un resumen por zona; `ReminderNotifier` agnóstico al protocolo | ⏳ Pendiente |
| **4 — cancelar/editar + catálogo** | Cancelar/editar visitas (baja lógica auditable) + ABM de Zone/Client/Field (alta/edición/archivado) | ⏳ Pendiente |
| **5 — sync + servidor** | Cola outbox en infra, LWW + tombstones terminales, `ConflictResolver` puro | ⏳ Pendiente |

---

## Decisiones diferidas / deuda anotada

Cosas conscientemente pospuestas, con el momento en que corresponde resolverlas:

- **Estilo visual** — la UI de Etapa 1b es HTML semántico sin CSS. No fue bug: el diseño visual nunca entró al alcance de 1b (foco fue plomería + comportamiento). → **Etapa 1c** (pasada de diseño). El markup semántico + `role="alert"` es buena base; la UI es adaptador reemplazable, así que estilar es aditivo (no toca dominio/aplicación/idb).
- **Íconos PWA placeholder** — `public/pwa-192.png` y `pwa-512.png` son placeholders 1×1. Reemplazar por arte real antes de un release. → junto con 1c o antes de release.
- **Borde de timezone (este de UTC)** — las fechas se construyen como medianoche-UTC (`new Date(`${iso}T00:00:00.000Z`)`) y se comparan contra el reloj real; para usuarios al **este** de UTC puede rechazar "hoy" como fecha futura. Usuario objetivo UTC-3 (oeste) **no afectado**. El arreglo va atado a revisar la comparación de día-calendario del dominio. → cuando se toque la lógica de fechas del dominio.
- **Validación de `reminderLeadDays`** — hoy `RecordVisit` no valida el lead; un lead negativo o mayor al intervalo pondría `remindAt` después del vencimiento o antes de `now`. Validar al construir el dispatch. → **Etapa 3**.
- **`interval.days` sub-cuenta <1 día** — para próxima-visita con fecha manual, `interval.days` se calcula por días-calendario (UTC) mientras `nextVisitDate` conserva la hora, así que el intervalo guardado puede sub-contar el gap real por <1 día. Es diseño documentado, no bug.
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
