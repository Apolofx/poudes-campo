# Etapa 5 — Onboarding: camino único para la primera visita programada — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-08-02-onboarding-camino-unico-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `onboarding-camino-unico`. Al cerrar: merge --no-ff a `main`.

## Tareas

### Tarea 1 — Use case `ScheduleVisitEnsuringField` + wiring de containers

- [x] Test rojo `tests/application/schedule-visit-ensuring-field.test.ts`
- [x] Implementación `src/application/use-cases/schedule-visit-ensuring-field.ts`
- [x] Wiring: `src/composition/container.ts` (interface + build) y `tests/support/in-memory-container.ts`
- [x] Verde + typecheck → commit `feat(application): ScheduleVisitEnsuringField orquesta crear lote/zona/cliente y agendar`

### Tarea 2 — Componente `PickOrCreate`

- [x] Test rojo `tests/ui/pick-or-create.test.tsx`
- [x] Implementación `src/ui/components/PickOrCreate.tsx`
- [x] CSS `.pickorcreate-*` en `src/ui/styles.css`
- [x] Verde + typecheck → commit `feat(ui): componente PickOrCreate (elegir o crear entidad)`

### Tarea 3 — `ScheduledVisitFormScreen` unificada (tres modos)

- [x] Test rojo: ampliar `tests/ui/scheduled-visit-form-screen.test.tsx`
- [x] Hook `useScheduleVisitEnsuringField` (`src/ui/hooks/`)
- [x] Refactor de `src/ui/screens/ScheduledVisitFormScreen.tsx`
- [x] Ruta `/programar` en `src/ui/App.tsx`
- [x] Verde + typecheck → commit `feat(ui): programar visita con lote a elegir o crear (camino único)`

### Tarea 4 — FAB + empty state de Inicio

- [x] Test rojo: `tests/ui/agenda-screen.test.tsx` (FAB + CTA "Programar visita")
- [x] `AgendaScreen.tsx`: FAB + empty-actions
- [x] CSS `.fab`
- [x] Verde + typecheck → commit `feat(ui): FAB "Programar visita" y empty state que promete a programar`

### Tarea 5 — Integration test del happy path real (idb)

- [x] Test verde `tests/ui/integration.test.tsx`: primer uso crea lote/zona/cliente y agenda
- [x] Suite completa + typecheck → commit `test(ui): integration happy path de primer uso`

### Tarea 6 — Cierre

- [x] Actualizar `docs/ROADMAP.md` (fila de etapa + diferidos)
- [x] Suite completa verde + typecheck
- [x] Merge --no-ff a `main`, borrar rama

---

## Código de referencia (por tarea)

### Tarea 1

```ts
// src/application/use-cases/schedule-visit-ensuring-field.ts
import type { CreateZone } from '@/application/use-cases/zone-catalog';
import type { CreateClient } from '@/application/use-cases/client-catalog';
import type { CreateField } from '@/application/use-cases/field-catalog';
import type { ScheduleVisit, ScheduleVisitResult } from '@/application/use-cases/schedule-visit';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';

export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;

export interface ScheduleVisitEnsuringFieldInput {
  scheduledDate: Date;
  reminderLeadDays: number;
  notes?: string;
  field: { id: string } | { name: string; zone?: OptionalRef; client?: OptionalRef };
}

export interface ScheduleVisitEnsuringFieldResult extends ScheduleVisitResult {
  fieldId: FieldId;
}

export class ScheduleVisitEnsuringField {
  constructor(
    private readonly createZone: CreateZone,
    private readonly createClient: CreateClient,
    private readonly createField: CreateField,
    private readonly scheduleVisit: ScheduleVisit,
  ) {}

  async execute(input: ScheduleVisitEnsuringFieldInput): Promise<ScheduleVisitEnsuringFieldResult> {
    let fieldId: FieldId;

    if ('id' in input.field) {
      fieldId = input.field.id;
    } else {
      let zoneId: ZoneId | undefined;
      let clientId: ClientId | undefined;
      if (input.field.zone) {
        zoneId = 'id' in input.field.zone
          ? input.field.zone.id
          : (await this.createZone.execute(input.field.zone.name)).id;
      }
      if (input.field.client) {
        clientId = 'id' in input.field.client
          ? input.field.client.id
          : (await this.createClient.execute(input.field.client.name)).id;
      }
      fieldId = (await this.createField.execute({ name: input.field.name, zoneId, clientId })).id;
    }

    const result = await this.scheduleVisit.execute({
      fieldId,
      scheduledDate: input.scheduledDate,
      reminderLeadDays: input.reminderLeadDays,
      notes: input.notes,
    });
    return { ...result, fieldId };
  }
}
```

Wiring (ambos containers): agregar al interface `scheduleVisitEnsuringField: ScheduleVisitEnsuringField` y
`scheduleVisitEnsuringField: new ScheduleVisitEnsuringField(createZone, createClient, createField, scheduleVisit)`.

Tests (selección):
- desde repos vacíos crea zona+cliente+lote y agenda → `listZones/listClients/listCatalogFields` reflejan la creación, hay una `ScheduledVisit` ACTIVE y reminder para el field.
- por nombre que matchea un existente → no duplica (mismo id).
- `field: { id }` de lote inexistente → `FieldNotFound`; fecha no futura → `ScheduledDateNotFuture`.
- devuelve `fieldId` nuevo.

### Tarea 2

```tsx
// src/ui/components/PickOrCreate.tsx
export type PickOrCreateValue =
  | { type: 'none' }
  | { type: 'existing'; id: string }
  | { type: 'create'; name: string };

export interface PickOrCreateOption {
  id: string;
  name: string;
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface PickOrCreateProps {
  label: string;
  value: PickOrCreateValue;
  items: PickOrCreateOption[];
  placeholder: string;
  allowNone?: boolean;
  noneLabel?: string;
  onChange: (value: PickOrCreateValue) => void;
}
```

- Input con `aria-label={label}`, `autoComplete="off"`.
- Estado local `text`; al tipear → dropdown: items filtrados (normalized includes) + (si `text` no vacío y sin match exacto) `Crear «{text}»` + (si `allowNone`) `noneLabel`.
- `onChange` resuelto en cada tipeo: exact-match de item → `existing`; texto no vacío → `create`; vacío → `none`.
- Seleccionar item → setea `text = name` y `onChange({type:'existing', id})`. `Crear «X»` cierra el dropdown. `noneLabel` → limpia texto y `onChange({type:'none'})`.

### Tarea 3

`ScheduledVisitFormScreen`:
- `const isEditing = Boolean(scheduledVisitId); const knownField = !isEditing && Boolean(fieldId);`
- Modo `/programar` (sin fieldId): bloque **Lote** = `PickOrCreate` con `items = lots` (`searchFields('')` en mount); bloque **Zona** y **Cliente** = `PickOrCreate` con `allowNone` (`noneLabel="Sin zona"/"Sin cliente"`); al final el submit construye `field = {name, zone?, client?}` o `field = {id}`.
- Modo conocido: chip `Lote: {view.field.name}` vía `useFieldHistory(fieldId)`.
- Submit crear → `create.submit(...)`; resultado devuelve `fieldId`; `navigate('/')` si venía de `/programar`, si no `/field/${fieldId}/visitas`.
- Edición: igual a hoy (`editScheduledVisit`, navega a historial).

`src/ui/App.tsx`: `<Route path="/programar" element={<ScheduledVisitFormScreen />} />`.

### Tarea 4

`AgendaScreen`:
```tsx
import { CalendarPlus } from 'lucide-react';
// FAB al final del <main>:
<Link className="fab" to="/programar" aria-label="Programar visita">
  <CalendarPlus size={26} aria-hidden="true" />
</Link>
// empty-actions:
<Link className="btn-primary" to="/programar">Programar visita</Link>
<Link className="btn-secondary" to="/buscar">Buscar un lote</Link>
```

CSS:
```css
.fab {
  position: fixed;
  right: var(--space-4);
  bottom: calc(var(--touch) + 24px);
  width: 56px; height: 56px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--accent-ink);
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.25);
  z-index: 20;
}
```

### Tarea 5

Integration (idb): container real, navegar Inicio → click FAB (`/programar`) → tipear lote "Paso 9", zona "Nueva 4", cliente "Herrera" → fecha → Programar → la agenda muestra "Paso 9".
