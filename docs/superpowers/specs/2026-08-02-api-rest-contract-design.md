# Etapa — Contrato REST para respaldo remoto (espejo CRUD)

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Entregable de la etapa: `docs/api/openapi.yaml` (OpenAPI 3.0.3).
> Fecha: 2026-08-02. Rama: `api-contract`.

## Contexto y alcance

Hoy la app es offline-first: el dominio vive en el cliente (hexagonal) y los datos en IndexedDB.
Se quiere que el front tenga la **posibilidad de cambiar el adapter de persistencia** para interactuar
con una memoria externa/remota vía API REST. El entregable de esta etapa es el **contrato** de esa API
(swagger), con todos los endpoints y sus contratos para que se cumplan todas las casuísticas. La
decisión de DB (relacional o no) queda diferida: el contrato debe ser DB-agnóstico.

Esta etapa **no toca `src/domain` ni `src/application`** (regla 2): solo documenta. El adapter remoto
es una etapa futura.

## Decisiones tomadas (brainstorming)

1. **Rol de la API: espejo CRUD.** La API es **almacenamiento remoto**, no lógica de negocio. El
   dominio sigue corriendo en el cliente; el adapter remoto implementa los puertos (`*Repository`)
   llamando a los endpoints. Rechazado: comandos por caso de uso (la lógica migra al servidor) e
   híbrido CRUD+comandos (dos estilos en un contrato que hoy es solo respaldo).
2. **Acceso: bearer API key.** Header `Authorization: Bearer <key>`. Un solo usuario = una clave;
   rotar la clave revoca el acceso. Declarado como `securitySchemes` http bearer (sin implicar JWT).
3. **Reminders: recurso propio (`/reminders`).** Espejo directo de `ReminderRepository`. El estado
   `SENT` debe persistirse para no re-notificar. Rechazado: derivar `remindAt` de las visitas
   PENDING + tabla de envíos (inventa un concepto que no existe en el dominio).
4. **Concurrencia: last-write-wins (LWW).** El servidor guarda la última escritura. Cada recurso
   lleva `updatedAt` (estampado por el servidor) como sello de auditoría, sin maquinaria de conflicto.
   `version`/ETag queda como cambio aditivo futuro si aparece el multi-dispositivo real.
5. **Upsert único: `PUT /v1/{colección}/{id}`.** El cliente genera los IDs (UUIDv7, offline-first) y
   el servidor los acepta: `PUT` crea si no existe (201) o reemplaza completo (200). No hay `POST`
   de creación ni `PATCH` parcial: `save()` del dominio es un reemplazo total del agregado.
   Rechazado: `DELETE` por recurso (el dominio archiva/cancela, no borra). El único borrado es
   `clear-all`.
6. **Filtros de listado = lecturas de los puertos.** Los repos consultan con filtros
   (`findPendingByField`, `findDoneByFieldOnDay`, `findDue`…); los listados los reflejan con query
   params. La búsqueda por texto, el join de nombres de padres y el cálculo de urgencia **siguen en
   el cliente** (el adapter tiene todas las entidades).
7. **Sin paginación.** Un solo usuario, ~40 lotes. YAGNI. Orden por defecto definido por colección.

## Casuísticas → endpoints

| Casuística (producto) | Cómo se cumple sobre el espejo CRUD (orquestación en cliente) |
|---|---|
| Crear/renombrar/archivar/restaurar Zona, Cliente, Lote | `PUT /v1/{zones\|clients\|fields}/{id}` con `archived` |
| Registrar visita (cumple PENDIENTE) | `PUT /v1/visits/{pendingId}` (→DONE) + opcional `PUT /v1/visits/{nuevoId}` (próxima PENDING) + `PUT /v1/reminders/{id}` (cancelar/crear). No-atómico (decisión 1) |
| Registrar con lote a crear | `PUT /v1/zones`? + `PUT /v1/clients`? + `PUT /v1/fields/{id}` + flujo registrar |
| Programar visita | `PUT /v1/visits/{reemplazada}` (→CANCELLED) + `PUT /v1/visits/{nuevoId}` (PENDING) + `PUT /v1/reminders/{nuevoId}` |
| Editar PENDIENTE/DONE | `PUT /v1/visits/{id}` (+ `PUT /v1/reminders/{id}` si se recrea el aviso) |
| Cancelar visita | `PUT /v1/visits/{id}` (status CANCELLED) + `PUT /v1/reminders/{id}` (CANCELLED) |
| Chequeo de duplicado del día | `GET /v1/visits?fieldId={id}&status=DONE&on={YYYY-MM-DD}` |
| Agenda (urgentes) | `GET /v1/visits?status=PENDING` + `GET /v1/fields` + padres; urgencia en cliente |
| Búsqueda de lotes | `GET /v1/fields` + padres; filtro de texto en cliente |
| Historial de un lote | `GET /v1/visits?fieldId={id}` + `GET /v1/fields/{id}` + padres |
| Reminders vencidos | `GET /v1/reminders?status=PENDING&dueBefore={now}` → `PUT /v1/reminders/{id}` (SENT) |
| Limpiar todo | `POST /v1/clear` (destructivo) |

## Mapeo de puertos → endpoints

| Puerto | Endpoint |
|---|---|
| `ZoneRepository.save` / `ClientRepository.save` | `PUT /v1/zones/{id}` / `PUT /v1/clients/{id}` |
| `ZoneRepository.findById` / `listAll` | `GET /v1/zones/{id}` / `GET /v1/zones` |
| `ClientRepository.findById` / `listAll` | `GET /v1/clients/{id}` / `GET /v1/clients` |
| `FieldRepository.save` | `PUT /v1/fields/{id}` |
| `FieldRepository.findById` | `GET /v1/fields/{id}` |
| `FieldRepository.listAllWithHierarchy` | `GET /v1/fields` (activos) + join de padres en cliente |
| `FieldRepository.listAllForCatalog` | `GET /v1/fields?includeArchived=true` + padres |
| `FieldRepository.findActiveByClientId` / `findActiveByZoneId` | `GET /v1/fields?clientId={id}` / `?zoneId={id}` |
| `VisitRepository.save` | `PUT /v1/visits/{id}` |
| `VisitRepository.findById` | `GET /v1/visits/{id}` |
| `VisitRepository.findDoneByFieldOnDay` | `GET /v1/visits?fieldId={id}&status=DONE&on={YYYY-MM-DD}` |
| `VisitRepository.listByField` | `GET /v1/visits?fieldId={id}` |
| `VisitRepository.findPendingByField` | `GET /v1/visits?fieldId={id}&status=PENDING` |
| `VisitRepository.findPendings` | `GET /v1/visits?status=PENDING` |
| `ReminderRepository.save` | `PUT /v1/reminders/{id}` |
| `ReminderRepository.findPendingByField` | `GET /v1/reminders?fieldId={id}&status=PENDING` |
| `ReminderRepository.findDue` | `GET /v1/reminders?status=PENDING&dueBefore={now}` |
| `DataReset.clearAll` | `POST /v1/clear` |
| `Clock`, `IdGenerator`, `ReminderNotifier`, `ReminderAvisoStore` | Sin endpoint (client-side) |

## Contrato (resumen)

- **Base path**: `/v1`. **Auth**: `Authorization: Bearer <key>` (401 si falta/inválida).
- **IDs**: UUIDv7, generados por el cliente, aceptados por el servidor (offline-first).
- **Tiempos**: ISO-8601 UTC. `updatedAt` lo estampa el servidor en cada escritura (LWW).
- **Upsert**: `PUT` full-replace; `id` y `updatedAt` son `readOnly` (el id va en la URL).
- **Invariantes de negocio**: el servidor valida solo tipos/formato (400/422). Las invariantes de
  dominio (PENDING exige `plannedFor`, DONE exige `visitedAt`, CANCELLED exige `cancelledAt`,
  `DuplicateVisitForDay`) las aplica el cliente; se documentan en el swagger como notas.
- **Errores**: envelope `{ error: { code, message, details? } }`.
- **`on` (visitas)**: filtra por día calendario UTC del campo `visitedAt`.

## Diferencias vs. Estado de hoy

- `docs/ROADMAP.md`: agregar la fila de etapa "Contrato REST (espejo CRUD)" con referencia al swagger.

## Diferidos (explícitos, YAGNI)

- Adapter remoto real (`Remote*Repository` por HTTP): etapa futura, este contrato es su base.
- Versionado/ETag y reintentos (multi-dispositivo real).
- Paginación de listados.
- Búsqueda y join de nombres en el servidor (vistas de lectura).
- Decisión de DB (relacional vs no-relacional).
