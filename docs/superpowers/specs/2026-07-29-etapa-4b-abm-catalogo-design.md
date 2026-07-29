# Etapa 4b — ABM de catálogo (Zona / Cliente / Lote)

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-07-29. Rama: `etapa-4b-abm-catalogo`.

## Contexto y alcance

El ROADMAP tenía la Etapa 4 como un bundle de dos subsistemas independientes:
cancelar/editar visitas + ABM de catálogo. Se decidió **partirla**:

- **4a** — cancelar/editar visitas (baja lógica auditable sobre eventos). *Pendiente, no es este spec.*
- **4b** — ABM de catálogo (Zone/Client/Field: alta/edición/archivado). **Este spec.**

Se construye **4b primero**: tener datos reales le da sentido al resto.

Hoy `Zone`/`Client` tienen record + store idb (`zones`, `clients`) pero **no** tienen
puerto de repositorio ni adaptador de escritura: solo los escribe el seed, y
`IdbFieldRepository.listAllWithHierarchy` los lee para armar la jerarquía. Las tres
entidades son inmutables y **no** tienen estado `archived`. 4b crea la capa de escritura
(puertos + adaptadores + casos de uso) de las tres entidades casi de cero.

**Carga de datos**: a mano, con formularios. Sin import/CSV (diferido).

### Regla dura vigente

Ningún dato de dosis/agroquímicos/prescripciones. El form de Lote **no** incluye esos
campos. `crop` (cultivo) está permitido pero queda **diferido** igual (ver §5).

## Decisiones tomadas (brainstorming)

1. **Partir Etapa 4** en 4a/4b; hacer 4b primero.
2. **Carga a mano** con formularios (sin import).
3. **Quitar = archivar** (baja lógica, nunca borrado físico → listo para tombstones de Etapa 5).
4. **Archivado reversible**: cada lista tiene toggle "ver archivados" + restaurar.
5. **Archivar un padre (Zona/Cliente) con lotes activos** → la UI pregunta
   "¿archivar también los lotes?": **Sí** = cascada (archiva los lotes),
   **No** = **nulifica** la ref de esos lotes (quedan huérfanos).
6. **Referencia huérfana = null** (no "apunta a archivado"). `Field.clientId`/`zoneId`
   pasan a opcionales. Consecuencia elegida: **archivado = realmente oculto**, ningún
   camino de lectura resucita un padre archivado.
7. **Reasignar** un lote = parte de **editar el Field** (cliente/zona editables); rellena la ref null.
8. **Zona y Cliente son ejes independientes**: un Field referencia `clientId` **y**
   `zoneId` por separado; la zona no es propiedad del cliente. Se archivan por separado.
9. **Seed gateado a `import.meta.env.DEV`**; producción arranca vacía. Acción in-app
   **"Borrar todos los datos"** para limpiar el install actual (que tiene los 40 fixtures).
10. **Navegación**: tercer tab **"Catálogo"** como hub; Inicio y Buscar intactos.
11. **Form de Lote**: nombre (req) + cliente + zona (opcionales, solo activos). Zona/Cliente: solo nombre.
    Hectáreas/cultivo/coordenadas **diferidos** (la entidad los conserva; el form no los expone).

## 1. Modelo de datos (dominio)

### `archived` en las tres entidades

`Zone`, `Client`, `Field` suman `archived: boolean` (default `false`), `readonly`.
Como son inmutables, **archivar/restaurar/editar producen una instancia nueva** (no
mutación in-place, a diferencia de `Reminder.markSent()`). Cada entidad expone:

- `archive(): T` → copia con `archived = true` (idempotente: si ya archivado, devuelve equivalente).
- `restore(): T` → copia con `archived = false`.

La edición (renombrar, reasignar) también reconstruye la entidad en el caso de uso.

### Refs opcionales en `Field`

`Field.clientId?: ClientId`, `Field.zoneId?: ZoneId`. Se relaja la validación:
`MissingFieldReference` deja de exigir ambas; si una ref está **presente**, no puede ser
vacía (`''`), pero **puede faltar** (huérfano). Un lote puede quedar sin cliente **y/o**
sin zona. `name` sigue requerido (no vacío).

### Errores

Nuevos: `ZoneNotFound`, `ClientNotFound` (`FieldNotFound` ya existe). Sin unicidad de
nombres (YAGNI — los IDs distinguen; nombres duplicados permitidos).

## 2. Puertos y casos de uso (aplicación)

### Puertos nuevos (`domain/ports/outbound`)

```ts
export interface ZoneRepository {
  save(zone: Zone): Promise<void>;
  findById(id: ZoneId): Promise<Zone | null>;
  listAll(): Promise<Zone[]>; // incluye archivados; la UI filtra
}
// ClientRepository: idéntico con Client/ClientId.

export interface DataReset {
  clearAll(): Promise<void>; // vacía todos los stores
}
```

### `FieldRepository` crece

```ts
export interface FieldRepository {
  save(field: Field): Promise<void>;
  findById(id: FieldId): Promise<Field | null>;
  // Cambia: SOLO activos, clientName/zoneName opcionales.
  listAllWithHierarchy(): Promise<FieldSearchResult[]>;
  // Nuevo: catálogo (incluye archivados + flag), para la pantalla Lotes.
  listAllForCatalog(): Promise<CatalogFieldRow[]>;
  // Nuevo: para cascada / nulificado (solo activos que referencian al padre).
  findActiveByClientId(id: ClientId): Promise<Field[]>;
  findActiveByZoneId(id: ZoneId): Promise<Field[]>;
}
```

`FieldSearchResult.clientName`/`zoneName` pasan a `string | undefined`. `CatalogFieldRow`
= `{ field: Field; clientName?: string; zoneName?: string }` (los nombres resuelven solo
contra padres **activos**; huérfano o padre archivado → `undefined` → "Sin X").

### Casos de uso (`application/use-cases`)

Por entidad de catálogo:

| Entidad | Casos de uso |
|---|---|
| Zone | `CreateZone`, `EditZone` (renombrar), `ArchiveZone(id, cascadeFields)`, `RestoreZone`, `ListZones` |
| Client | `CreateClient`, `EditClient`, `ArchiveClient(id, cascadeFields)`, `RestoreClient`, `ListClients` |
| Field | `CreateField`, `EditField` (nombre + reasignar cliente/zona), `ArchiveField`, `RestoreField`, `ListCatalogFields` |
| — | `ClearAllData` (usa `DataReset`) |

`Create*`/`Edit*` usan `IdGenerator` (alta) y validan vía el constructor de la entidad
(errores de dominio capturados en la UI como texto en español, nunca lanzados al usuario).

**`ArchiveZone` / `ArchiveClient`** reciben `cascadeFields: boolean`:

- `cascadeFields = true`: además de archivar el padre, archiva cada lote activo que lo
  referencia (`findActiveBy*Id` → `archive()` → `save`).
- `cascadeFields = false`: **nulifica** esa ref en cada lote activo (reconstruye el Field
  con `clientId`/`zoneId` = `undefined` → `save`). Los lotes quedan huérfanos, activos,
  esperando reasignación.

Es el **único** write en cascada del sistema. `ArchiveField`/`RestoreField` no tocan
otras entidades (visits/reminders quedan como historia; ver §3 sobre reminders).

## 3. Adaptadores + ripple en lecturas existentes (infra)

### Adaptadores nuevos

- `IdbZoneRepository`, `IdbClientRepository` (+ in-memory para tests). Contrato paralelo.
- `records.ts`: `ZoneRecord`/`ClientRecord`/`FieldRecord` suman `archived: boolean`.
  Retro-compatible: record viejo sin `archived` → `false` al mapear
  (`fromXRecord`: `archived: r.archived ?? false`). **No** requiere bump de esquema idb
  (los object stores no cambian; `archived` es un campo más del value).
- `FieldRecord.clientId`/`zoneId` pasan a opcionales en el record + mappers.
- `IdbFieldRepository`/in-memory: filtro de archivados en `listAllWithHierarchy`;
  nuevos `listAllForCatalog`, `findActiveByClientId`, `findActiveByZoneId`
  (idb: `getAll` + filtro en memoria — trivial a escala ~40; sin índices nuevos).
- `IdbDataReset` (o método en un adaptador de mantenimiento): `clearAll` vacía los 5
  stores. In-memory equivalente para tests.

### Ripple contenido (esto es lo que evita tocar Buscar/Agenda pantalla por pantalla)

`listAllWithHierarchy` es el choke point compartido por `SearchFields`,
`ListUpcomingVisits` y `DispatchDueReminders`. Al filtrar archivados ahí, las tres heredan:

- **Buscar**: `field-search.fieldMatchesQuery` tolera `clientName`/`zoneName` `undefined`;
  la fila pinta "Sin cliente"/"Sin zona". Archivados no aparecen.
- **Agenda**: `agenda-presentation.groupUpcoming` agrupa `undefined` en un bucket
  **"Sin zona"/"Sin cliente"**, ordenado **al final** (después del alfabético). `UpcomingVisit.clientName`/`zoneName` → opcionales.
- **Avisos**: un lote archivado sale del join → sus reminders quedan `PENDING` inertes
  (nunca `SENT`). Si el lote se **restaura**, reaparecen (posiblemente vencidos) —
  comportamiento correcto (vuelve a la rotación). **No** se agrega cancelación
  cross-agregado al archivar (se evita el write extra).

## 4. UI / navegación

### TabBar y rutas

`TabBar` → **Inicio · Buscar · Catálogo**. Rutas nuevas:

```
/catalogo                     (hub: enlaces Zonas/Clientes/Lotes + "Borrar todos los datos")
/catalogo/zonas               (lista)      /catalogo/zonas/nueva      /catalogo/zonas/:id (editar)
/catalogo/clientes            (lista)      /catalogo/clientes/nuevo   /catalogo/clientes/:id
/catalogo/lotes               (lista)      /catalogo/lotes/nuevo      /catalogo/lotes/:id
```

El hub y las listas van dentro de `TabsLayout` (con tab bar). Los forms van a pantalla
completa con back link (estilo `RecordVisitScreen`, fuera del layout de tabs).

### Pantallas de lista (Zonas / Clientes / Lotes)

- Ítems **activos** por defecto, "+" para crear, tap para editar, acción **archivar**.
- Toggle **"ver archivados"** que muestra los archivados con acción **restaurar**.
- Lotes: cada fila muestra cliente/zona (o "Sin cliente"/"Sin zona").

### Forms

- **Zona / Cliente**: un input (nombre). Validación de vacío → error en español.
- **Lote**: nombre (req) + picker de **cliente** + picker de **zona** (opcionales, listan
  **solo activos**). Editar Lote = mismo form (incluye reasignar cliente/zona → rellena refs null).

### Flujo cascada al archivar padre

Al archivar Zona/Cliente, el hook consulta si tiene lotes activos
(`findActiveBy*Id`). Si los tiene, **modal in-app** (NO `window.confirm` — bloquea el
runtime y no es testeable): *"Esta zona/cliente tiene N lotes activos. ¿Archivar también
los lotes?"* → **Sí** llama `Archive*(id, cascadeFields=true)`, **No** llama
`Archive*(id, cascadeFields=false)`. Sin lotes activos → archiva directo.

### Borrar todos los datos

En el hub, acción destructiva con **confirmación de dos pasos** (modal in-app). Llama
`ClearAllData`. Nuke total (incluye datos reales ya cargados) — su propósito es la
transición fixture→real y el reset general.

### Composición

`buildContainer` suma: `zones`/`clients` repos, `dataReset`, y los casos de uso nuevos.
Seed (`composition/seed`) gateado a `import.meta.env.DEV` en `main.tsx`; producción arranca
vacía. Los tests de UI/composición montan datos explícitos (no dependen del seed).

## 5. Testing (TDD estricto por capa)

- **Dominio**: `archived` + `archive()/restore()` (idempotencia); `Field` con refs
  opcionales (ausente OK, presente-vacía falla); errores nuevos.
- **Aplicación**: cada caso de uso; foco en `ArchiveZone/ArchiveClient` con
  `cascadeFields` Sí (archiva lotes) / No (nulifica refs); `Restore*`; `EditField`
  reasigna; `ClearAllData`.
- **Infra**: `IdbZoneRepository`/`IdbClientRepository` e in-memory con el **mismo** set de
  tests de contrato; `Field` nuevos métodos + filtro de archivados; `DataReset`.
- **UI (jsdom)**: listas (activos/archivados, restaurar), forms (validación, alta/edición),
  flujo cascada (modal Sí/No), "Sin cliente"/"Sin zona" en Buscar/Agenda, "Borrar datos".
- Seed gateado; helpers de test montan datos explícitos.

## Diferidos anotados (van al ROADMAP al cerrar)

- `crop`, `hectares`, `coordinates` en el form de Lote (la entidad los conserva).
- Import/CSV de lotes.
- Unicidad de nombres (Zona/Cliente/Lote).
- Índices idb por `archived` / por padre (hoy `getAll`+filtro alcanza a escala ~40).
- Cancelar reminders PENDING al archivar un lote (hoy se filtran, no se cancelan).
- Orden de grupos por urgencia en Agenda (sigue alfabético + "Sin X" al final).

## No incluido (fuera de 4b)

- Cancelar/editar visitas → **Etapa 4a**.
- Sync/servidor → **Etapa 5**.
