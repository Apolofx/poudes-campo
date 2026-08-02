# Etapa 5 — Onboarding: camino único para la primera visita programada

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-08-02.

## Contexto y alcance

En una instalación limpia (el seed solo corre en dev, `main.tsx:13`), el usuario entra a una app
vacía: cero zonas, clientes, lotes y visitas. El camino actual para lograr la **primera visita
programada** es largo (~8 taps) y obliga a conocer el flujo: Catálogo → Lotes → Nuevo lote →
Guardar → abrir el lote → Programar visita → fecha/aviso/notas → Programar. Y si el usuario quiere
que la agenda muestre zona/cliente, debe crear ambas entidades antes, por separado, en Catálogo.

Además, **no existe ningún punto de entrada a "Programar visita" que elija el lote primero**:
`ScheduledVisitFormScreen` toma `fieldId` de la URL (App.tsx:43) y `ScheduleVisit` lanza
`FieldNotFound` si el lote no existe (schedule-visit.ts:37). Programar presupone un lote ya creado.

Esta etapa agrega el **camino único de onboarding**: un solo flujo que crea (si hace falta) la
zona, el cliente y el lote de paso y agenda la primera visita en un mismo submit.

Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones. Esta etapa no agrega campos
de ese tipo. Tocar `src/application` es la **intención explícita** del usuario (regla 2 de AGENTS);
`src/domain` no se toca.

## Decisiones tomadas (brainstorming)

1. **Camino único integrado (orquestación, no dominio).** Un caso de uso nuevo en `src/application`,
   `ScheduleVisitEnsuringField`, **compone los casos de uso existentes** `CreateZone`, `CreateClient`,
   `CreateField` y `ScheduleVisit`. No se toca el dominio: `ScheduleVisit` conserva sus invariantes
   (lote existente, fecha futura, reemplazo de programada previa, clamp del lead). El orquestador
   solo **asegura** la jerarquía (resuelve o crea zona/cliente/lote) y delega el agendado.
   Alternativa descartada: hacer que `ScheduleVisit` acepte un lote nuevo inline (corrompe el caso de
   uso de dominio) o orquestar desde la UI con 4 llamadas secuenciales (no atómico, UI con lógica).
2. **"Tipear crea, confirmado" para zona/cliente/lote.** Un combobox `PickOrCreate` donde tipear
   filtra los existentes y, si el texto no coincide con ninguno, muestra la opción seleccionable
   `Crear «X»`. Al enviar, un texto que matchea (case-insensitive) una entidad existente → se asocia;
   si no matchea → se crea. La elección de "Crear «X»" es la confirmación visible de intención.
   Descartada la auto-creación silenciosa total: un typo dejaría una entidad fantasma persistida sin
   que el usuario lo vea.
3. **FAB único "Programar visita" en Inicio (Agenda), sobre la tab bar.** Acción primaria de un
   pulgar; zona/cliente/lote se crean de paso dentro del flujo. Descartados: menú FAB de 4 acciones
   (agrega un paso de decisión; el Catálogo ya cubre el alta individual) y no-FAB (sin acceso directo).
4. **Un solo formulario, una sola pantalla.** La `ScheduledVisitFormScreen` unificada:
   - Sin `fieldId` (`/programar`): el campo **Lote** es un `PickOrCreate` (si hay lotes, lista y
     filtra; si no, directamente escribe el nombre). Zona y Cliente debajo (opcionales, `PickOrCreate`
     o "Sin zona"/"Sin cliente"), y el bloque Fecha/Aviso/Notas actual.
   - Con `fieldId` (`/field/:fieldId/programar`, entrada desde el historial): el lote se muestra como
     chip fijo (no editable), resto igual. **Sin cambio de comportamiento** respecto de hoy.
   - Edición (`/field/:fieldId/programar/:scheduledVisitId`): lote congelado, solo fecha/aviso/notas.
     Sin cambios.
5. **Nueva ruta `/programar`** (fuera del layout con tab bar, como las demás pantallas de form).
6. **El empty state de Inicio promete "Programar visita"** (no "Buscar un lote") hacia `/programar`,
   y el FAB queda como acceso permanente en esa pantalla. "Buscar un lote" se conserva como secundario.

## 1. Caso de uso: `ScheduleVisitEnsuringField` (`src/application/use-cases/`)

```ts
export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;   // zona / cliente son opcionales

export interface ScheduleVisitEnsuringFieldInput {
  scheduledDate: Date;
  reminderLeadDays: number;
  notes?: string;
  field: { id: string } | { name: string; zone?: OptionalRef; client?: OptionalRef };
}

export interface ScheduleVisitEnsuringFieldResult {
  scheduledVisitId: string;
  reminderId: string;
  fieldId: string;    // útil para navegar de vuelta al historial del lote creado
}
```

Dependencias inyectadas (composition root): `CreateZone`, `CreateClient`, `CreateField`,
`ScheduleVisit`. Flujo:

```
si field = {id}            → fieldId = id
si no                      → zoneId/clientId resueltos así:
                              - ref = {id}          → usar el id
                              - ref = {name}        → createZone/createClient(name) y usar su id
                            fieldId = createField({ name, zoneId, clientId }).id
resultado = scheduleVisit({ fieldId, scheduledDate, reminderLeadDays, notes })
```

Sin validaciones propias: `ScheduleVisit` ya valida lote existente y fecha futura, reemplaza la
programada previa y clampa el lead. Error: si el usuario manda `{id}` de un lote inexistente, se
propaga `FieldNotFound` (mismo mensaje en español que hoy).

## 2. Componente UI: `PickOrCreate` (`src/ui/components/`)

Props: `label`, `value` (texto tipeado), `items: { id, name }[]`, `placeholder`,
`allowNone` (para zona/cliente: mostrar la opción "Sin zona"/"Sin cliente"), `onChange`.

Comportamiento:
- Input de texto con `aria-label = label`; tipear filtra `items` por nombre (case-insensitive,
  normalizando acentos).
- Dropdown: opciones de existentes matcheadas + opción `Crear «X»` (solo si el texto no matchea
  exactamente ningún item) + opción "Sin zona/cliente" si `allowNone`.
- Al elegir un existente → `onChange({ type: 'existing', id })`; al elegir `Crear «X»` →
  `onChange({ type: 'create', name })`; al elegir ninguno → `onChange(undefined)`.
- Al enviar el form, el texto que matchea exactamente un item existente se resuelve como existente
  (evita duplicados por typo de capitalización); si no, como creación.

## 3. Pantalla: `ScheduledVisitFormScreen` unificada

- `useParams`: `fieldId?`, `scheduledVisitId?` → tres modos:
  - **crear con lote nuevo / a elegir** (`/programar`): bloque Lote = `PickOrCreate` (items =
    lotes activos vía `searchFields('')`), bloque Zona = `PickOrCreate` con `allowNone`, bloque
    Cliente = idem.
  - **crear con lote conocido** (`/field/:fieldId/programar`): chip "Lote: {nombre}" fijo
    (nombre vía `getFieldHistory`).
  - **editar** (`/field/:fieldId/programar/:scheduledVisitId`): igual a hoy.
- Submit: en crear → `scheduleVisitEnsuringField.execute({ ... })`; en editar → `editScheduledVisit`.
  Aterriza en `/` (Inicio) al crear desde `/programar` (la visita quedó en la agenda), y en
  `/field/:fieldId/visitas` al crear desde el historial (como hoy). `fieldId` del resultado permite
  ese destino.
- Back: desde `/programar` → `/` ("‹ Inicio"); los demás, como hoy.

## 4. FAB + empty state de Inicio

- `AgendaScreen`: `<Link className="fab" to="/programar" aria-label="Programar visita">` con ícono
  `CalendarPlus` de lucide (o `Plus`), `position: fixed`, abajo a la derecha, por encima de la tab
  bar (`bottom: calc(var(--touch) + 20px)`), círculo de 56px con sombra, `--accent` de fondo y
  contraste blanco verificado. Solo en Inicio.
- Empty state: `empty-actions` pasa a tener primario `Programar visita` (→ `/programar`) y
  secundario `Buscar un lote` (→ `/buscar`).

## 5. Wiring

- `Container` (`src/composition/container.ts`): agregar `scheduleVisitEnsuringField`. Build real
  idb + `makeInMemoryContainer` (`tests/support/in-memory-container.ts`). `useCampo` ya expone el
  container completo, no hay cambio en `CampoProvider`.

## Fuera de alcance (diferido)

- Reusar `PickOrCreate` en el form de Lote de Catálogo (decisión explícita del usuario: solo el
  camino único en esta etapa). Queda anotado como mejora.
- PickOrCreate con búsqueda diferida por teclado a muchos lotes (>40 no es un caso real).
- FAB en otras pantallas.

## Plan de tests (TDD)

- `tests/application/schedule-visit-ensuring-field.test.ts`: crea zona+cliente+lote y agenda desde
  repos vacíos; reusa zona/cliente existentes por nombre (sin duplicado); usa lote existente por id;
  `FieldNotFound` con id inexistente; `ScheduledDateNotFuture` se propaga; devuelve `fieldId`.
- `tests/ui/scheduled-visit-form-screen.test.tsx` (ampliar): `/programar` sin lotes crea lote+zona+
  cliente y agenda y vuelve a Inicio; con lotes existentes permite elegir y agenda para ese lote;
  chip de lote fijo en `/field/:id/programar`; edición sin cambios.
- `tests/ui/agenda-screen.test.tsx`: empty state con CTA "Programar visita" → `/programar`; FAB con
  `aria-label` "Programar visita" → `/programar`.
- `tests/ui/integration.test.tsx`: happy path real (idb) de primer uso: Inicio → FAB → crear lote/
  zona/cliente → Programar → la visita aparece en la agenda.
