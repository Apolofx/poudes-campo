# Etapa 1b — IndexedDB + UI React + PWA (diseño)

**Fecha:** 2026-07-27
**Estado:** aprobado, listo para plan de implementación
**Etapa previa:** Etapa 1 núcleo (dominio + aplicación) — completa y mergeada a `main` (57 tests verdes).

## Objetivo

Cerrar la Etapa 1 con una **rebanada vertical demostrable a Nacho**, enteramente offline/local:

- Persistencia real en **IndexedDB** detrás de los puertos existentes (`FieldRepository`, `VisitRepository`, `ReminderRepository`).
- **UI React + Vite**: buscar un lote (HU5/HU1) → registrar una visita con follow-up (HU2).
- **PWA instalable** con app-shell offline (sin sync — eso es Etapa 5).

El **dominio y la aplicación no se tocan**. Todo el trabajo es infraestructura (adaptador IndexedDB, clock/ids reales) + adaptador de UI + composición.

**Regla dura del proyecto:** ningún dato de dosis/agroquímicos/prescripciones entra jamás al sistema. La UI no tiene esos campos.

## Decisiones de diseño (cerradas una por una con Nacho)

1. **Datos semilla — seed embebido.** El ABM de catálogo recién es Etapa 4. Para Etapa 1b los lotes/zonas/clientes entran vía un fixture bundleado que se carga a IndexedDB en el primer arranque (idempotente). Cero UI de alta. Se descarta cuando llegue el ABM.
2. **Acceso a IndexedDB — `idb`** (wrapper fino de ~1KB, promesas sobre IDB nativo). Definimos object stores + índices a mano. Sin modelo de query propio: toda la query ya vive detrás de los puertos. Descartados: Dexie (sobre-ingeniería, ata a su modelo), IDB nativo (API por eventos, TDD-hostil).
3. **Navegación — Vite + react-router en modo librería** (rutas declarativas client-side). **Next.js descartado**: su valor es server-side (SSR/RSC/API routes) y Campo es offline-first con datos 100% en el dispositivo; Next pelea contra el PWA offline, es un adaptador más pesado/lock-in (contra "React+Vite reemplazable") y necesitaría runtime de servidor. `react-router` se usa en modo librería, **no** framework mode (ex-Remix, que reintroduciría SSR). Next.js solo se justificaría si el producto se volviera online-first/server-authoritative — otro producto, no este.
4. **Wiring React — Context + hooks finos.** Un composition root arma el grafo una vez; se provee vía React Context; hooks finos (`useSearchFields`, `useRecordVisit`) llaman `.execute()` y manejan loading/error. El router queda tonto. DI explícita e inyectable en tests. Descartados: loaders/actions de react-router (acopla orquestación al adaptador), TanStack Query (YAGNI para 2 vistas con datos locales; anotado como upgrade).
5. **PWA — `vite-plugin-pwa` + `registerType: 'autoUpdate'`.** SW precachea solo el app-shell (JS/CSS/HTML/íconos). Sin runtime caching (no hay servidor todavía). Actualización silenciosa: no hay trabajo en vuelo que un reload rompa (todo se commitea a IndexedDB).
6. **Tests — seams + 1 integración.** Los tests van donde vive la lógica; los componentes quedan tontos. Descartados: TDD full DOM de cada componente (lento/frágil), Playwright E2E (YAGNI ahora; upgrade).

## Estructura de carpetas nueva

```
src/
  infrastructure/
    persistence/idb/
      open-campo-db.ts          # idb: openDB + upgrade (crea stores/índices)
      records.ts                # tipos de registro plano + mappers entidad↔record
      idb-field-repository.ts
      idb-visit-repository.ts
      idb-reminder-repository.ts
    id/uuidv7-id-generator.ts   # IdGenerator real
    clock/system-clock.ts       # Clock real
  composition/
    container.ts                # arma el grafo (repos idb + clock + ids + use cases)
    seed-data.ts                # fixture ~40 lotes/zonas/clientes (se descarta en Etapa 4)
    seed.ts                     # carga idempotente a IndexedDB en 1er arranque
  ui/
    CampoProvider.tsx           # React Context con el container
    hooks/use-search-fields.ts
    hooks/use-record-visit.ts
    screens/SearchScreen.tsx
    screens/RecordVisitScreen.tsx
    components/…                # tontos (presentacionales)
    routes.tsx                  # react-router (modo librería)
  main.tsx                      # entry: seed → container → render
index.html · vite.config.ts · public/ (íconos PWA, manifest)
```

## Schema IndexedDB (`campo` db, v1)

Cinco object stores, todos `keyPath: 'id'`:

- `zones` — `{ id, name }`. Llenado por el seed.
- `clients` — `{ id, name }`. Llenado por el seed.
- `fields` — registro plano de Field. Llenado por el seed.
- `visits` — registro plano de Visit. Índice `by-field` sobre `fieldId`.
- `reminders` — registro plano de Reminder. Índice `by-field` sobre `fieldId`.

Los repos idb replican **exactamente** el contrato de los repos in-memory:

- `IdbFieldRepository.save/findById`; `listAllWithHierarchy()` lee todos los `fields` y hace join con `zones`/`clients` para producir `FieldSearchResult { field, clientName, zoneName }` (nombre `''` si falta la referencia, igual que el in-memory).
- `IdbVisitRepository.save/findById`; `findActiveByFieldOnDay(fieldId, day)` lee por índice `by-field` y filtra `status==='ACTIVE'` + `isSameCalendarDay(visitDate, day)`; `listByField(fieldId)` usa el índice.
- `IdbReminderRepository.save`; `findPendingByField(fieldId)` lee por índice `by-field` y filtra `status==='PENDING'`.

## Mapeo entidad ↔ registro (`records.ts`)

IndexedDB usa *structured clone*: guarda `Date` nativo pero **no** instancias de clase ni value objects con métodos. Los repos idb guardan registros planos y reconstruyen entidades al leer, vía constructores/factories del dominio.

- **Field** → `{ id, name, clientId, zoneId, coordinates?: { latitude, longitude }, hectares?: number, crop? }`.
  Al leer: `Coordinates.of(latitude, longitude)`, `Hectares.of(value)`.
- **Visit** → `{ id, fieldId, visitDate: Date, createdAt: Date, notes?, followUp?: { nextVisitDate: Date, intervalDays: number }, status: 'ACTIVE'|'CANCELLED' }`.
  Al leer: `VisitInterval.ofDays(intervalDays)` para reconstruir `followUp.interval`.
- **Reminder** → `{ id, visitId, fieldId, remindAt: Date, status: 'PENDING'|'SENT'|'CANCELLED' }`.
  Al leer: `new Reminder({ …, status })` (status expuesto por getter).

Las fechas se guardan como `Date` nativo (structured-clone lo soporta). Guardar ISO strings queda anotado como posible upgrade para el LWW de la Etapa 5.

## Seed idempotente

`seed.ts` corre en `main.tsx` antes de renderizar:

- Si el store `fields` está vacío → escribe zonas/clientes/lotes del fixture (`seed-data.ts`) en una transacción.
- Si ya hay datos → no hace nada (reabrir la app no duplica).

`seed-data.ts` contiene ~40 lotes con sus zonas/clientes, valores realistas pero ficticios, **sin ningún dato de agroquímicos**. Todo el mecanismo de seed se elimina cuando llegue el ABM (Etapa 4).

## Composition root + wiring React

`container.ts`:

```ts
const db = await openCampoDb();                 // idb
const fields = new IdbFieldRepository(db);
const visits = new IdbVisitRepository(db);
const reminders = new IdbReminderRepository(db);
const clock: Clock = new SystemClock();         // () => new Date()
const ids: IdGenerator = new Uuidv7IdGenerator(); // uuidv7()
return {
  searchFields: new SearchFields(fields),
  recordVisit: new RecordVisit(fields, visits, reminders, clock, ids),
};
```

`CampoProvider` mete el container en React Context. Hooks finos:

```ts
useSearchFields(): { results: FieldSearchResult[]; loading: boolean; error?: Error; search(query: string): void }
useRecordVisit(): { submit(input: RecordVisitInput): void; submitting: boolean; error?: Error; result?: RecordVisitResult }
```

El router solo cambia vistas; la orquestación vive en los hooks → el adaptador de UI es reemplazable.

## UI — 2 vistas (react-router, modo librería)

- `/` **SearchScreen**: caja de búsqueda + lista de resultados mostrando `field.name`, `clientName`, `zoneName`. Query vacío lista todo (comportamiento de `fieldMatchesQuery`). Tocar un ítem navega a `/field/:id/record`.
- `/field/:id/record` **RecordVisitScreen**: formulario con:
  - Fecha de visita (default: hoy; no puede ser futura).
  - Notas (texto libre, opcional).
  - Follow-up: `interval` (días + `reminderLeadDays`) / `date` (fecha próxima + `reminderLeadDays`) / `none`.
  - Submit → `recordVisit.execute()`, muestra confirmación y vuelve a `/`.
  - Errores de dominio mapeados a mensajes en español: `FutureVisitDate`, `DuplicateVisitForDay`, `FieldNotFound`.
  - **Cero campos de dosis/agroquímicos.**

## PWA

`vite-plugin-pwa` con:

- `registerType: 'autoUpdate'`.
- Manifest instalable: nombre "Campo", íconos (192/512), `display: standalone`, theme/background color.
- Workbox precacheando el app-shell generado por el build. Sin runtime caching.

## Tests (seams + 1 integración)

- **Contrato de repos idb** contra `fake-indexeddb`: mismos casos que los in-memory (save/find/índices) + round-trip de mapeo (entidad → record → entidad conserva VOs, fechas, status, followUp).
- **Seed**: idempotencia (correr dos veces no duplica; sobre db con datos no re-escribe).
- **Hooks** con Testing Library sobre casos de uso reales + repos **in-memory** (rápidos): `useSearchFields.search` filtra; `useRecordVisit.submit` registra y expone el error de dominio en `error`.
- **1 test de integración** en jsdom: render con el container real (idb sobre `fake-indexeddb`) del flujo completo buscar → tocar lote → completar form → registrar → confirmación → vuelta a la lista.
- Componentes presentacionales → render tests livianos.
- Playwright anotado como upgrade futuro.

Configuración Vitest: entorno `node` por defecto (dominio + adaptadores con `fake-indexeddb`), `jsdom` para los tests de React (por glob `src/ui/**` / `tests/ui/**` o directiva `// @vitest-environment jsdom` por archivo).

## Dependencias nuevas

- **Runtime:** `react`, `react-dom`, `react-router-dom`, `idb`, `uuidv7`.
- **Dev:** `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `fake-indexeddb`.

## Fuera de alcance (etapas posteriores)

- Panel de urgencia por zona / semáforo (Etapa 2).
- Aviso al abrir la app / `DispatchDueReminders` (Etapa 3).
- Cancelar/editar visitas + ABM de catálogo (Etapa 4).
- Sync + servidor + resolución de conflictos (Etapa 5).
- Validación de `reminderLeadDays` (se hace al construir el dispatch, Etapa 3).

## Notas de arrastre para etapas futuras

- El seed completo (`seed-data.ts`, `seed.ts`) se elimina al construir el ABM de Etapa 4.
- Guardar fechas como ISO string (en vez de `Date` nativo) es un upgrade candidato para el LWW de Etapa 5.
- TanStack Query y Playwright quedan como upgrades si el flujo crece.
