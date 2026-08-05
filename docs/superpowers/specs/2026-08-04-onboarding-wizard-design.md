# Etapa 6 — Onboarding: mini wizard de primer uso (gateado por flag)

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-08-04.

## Contexto y alcance

Con **multitenant-keys** el primer arranque quedó así: sin clave → `ConfigGate` redirige a
`/configuracion` → el usuario pega su clave y cae en una agenda vacía. Para **un tercero** que
recibe la PWA ya armada esto es poco guiado: la etapa **camino único** le permite programar la
primera visita en una sola pantalla, pero nadie le dice qué hacer primero ni lo conduce paso a paso.

Esta etapa agrega un **mini wizard de primer uso en 3 pasos** (clave → primer lote → programar la
primera visita) para usuarios nuevos, **gateado por el feature flag de Vercel `onboardingNuevo`**:
se prende para pilotar con un tercero y se mide si completa el flujo; se apaga y todo vuelve a
comportarse como hoy. Es un knob de rollout honesto: la feature nueva (el wizard) nace detrás del flag.

Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones. Esta etapa no agrega campos de
ese tipo. Tocar `src/application` (agregar un orquestador nuevo) es la **intención explícita** del
usuario (regla 2 de AGENTS); `src/domain` no se toca.

## Decisiones tomadas (brainstorming)

1. **Estado del wizard derivable de los datos (sin marca "en curso").** El wizard se muestra cuando el
   flag `onboardingNuevo` está prendido **y** (no hay config **o** no hay ningún lote). Cada paso se
   **commitea al avanzar** (guardar la clave ya vale; crear el primer lote ya vale). Si el usuario
   abandona a mitad, al volver **retoma en el primer paso incompleto** — derivado de los datos, sin
   estado corrupto. **Completar = tener clave + tener ≥1 lote** (la visita del paso 3 no es condición;
   se puede saltar y el wizard igual desaparece).
2. **Tres pasos, cada uno con un CTA único:**
   - **Paso 1 · Clave de acceso** — bienvenida corta + el form de ConfigScreen (clave + URL, reusa
     `saveTenantConfig`). CTA "Continuar".
   - **Paso 2 · Primer lote** — form explícito con `PickOrCreate`: **Lote** (obligatorio), **Zona**
     (opcional, "nueva o existente") y **Cliente** (idem). Form explícito y no pick-or-create a secas
     a propósito: un tercero que no conoce el catálogo entiende mejor un formulario con pasos que un
     autocompletado + creación al vuelo. CTA "Continuar".
   - **Paso 3 · Programar la primera visita** — fecha **pre-cargada al próximo día hábil**, aviso por
     defecto, notas. CTA "Programar y listo" + link secundario "Lo hago después" (skip).
3. **Routing:** nueva ruta `/onboarding` fuera del `ConfigGate` (sin tab bar, como `/configuracion`).
   `ConfigGate` decide con el flag: prendido e incompleto → `/onboarding`; prendido y completo → pasa;
   apagado → comportamiento de hoy (`/configuracion` si no hay clave). Al completar el wizard →
   `navigate('/')`; el gate reevalúa (ya hay clave + lote) y deja pasar.
4. **Orquestación en `src/application`, no en la UI.** El paso 2 necesita "asegurar" zona/cliente
   (resolver o crear) y crear el lote. Se agrega el caso de uso `CreateFieldEnsuring` que **compone**
   `CreateZone`, `CreateClient` y `CreateField` (espejo del patrón de `ScheduleVisitEnsuringField`,
   sin agendar). Alternativa descartada: orquestar desde la UI con llamadas secuenciales (UI con
   lógica, no atómico — misma razón que en el spec de camino único).

## 1. Caso de uso: `CreateFieldEnsuring` (`src/application/use-cases/create-field-ensuring.ts`)

```ts
export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;

export interface CreateFieldEnsuringInput {
  name: string;
  zone?: OptionalRef;
  client?: OptionalRef;
}

export interface CreateFieldEnsuringResult {
  fieldId: string;
}
```

Dependencias inyectadas (composition root): `CreateZone`, `CreateClient`, `CreateField`. Flujo:

```
zoneId/clientId resueltos así:
  - ref ausente        → undefined
  - ref = {id}         → usar el id
  - ref = {name}       → createZone/createClient(name) y usar su id
fieldId = createField({ name, zoneId, clientId }).id
```

Sin validaciones propias: delega en los casos de uso existentes (los errores se propagan y se
muestran con `domainErrorMessage`). No toca `ScheduleVisit` ni reminders (crear un lote no cambia el
feed de programadas).

## 2. Pantalla: `OnboardingWizardScreen` (`src/ui/screens/OnboardingWizardScreen.tsx`)

- Shell con **indicador de progreso** "Paso X de 3" + puntos, `BackLink` ("‹ Atrás") entre pasos y
  `h1` por paso. Tokens existentes (`.screen.record`, `.field`, `.btn-primary`, `.btn-secondary`,
  `.alert`).
- **Paso 1:** texto de bienvenida ("Bienvenido a Campo") + form de clave (clave + URL). Al avanzar →
  `saveTenantConfig` y pasa al paso 2. Error inline si clave vacía (mismo mensaje que ConfigScreen).
- **Paso 2:** `PickOrCreate` de Lote + Zona (`allowNone`, "Sin zona") + Cliente ("Sin cliente"). Al
  avanzar → `createFieldEnsuring.execute({...})` (resuelve los `PickOrCreateValue` a `ExistingRef`/
  `NewRef`). Lote `none` → error "Ingresá el nombre del lote." Éxito → paso 3.
- **Paso 3:** fecha pre-cargada `nextBusinessDayIso()`, aviso por defecto (3), notas. CTA →
  `scheduleVisitEnsuringField.execute({ field: { id: fieldId }, ... })` (reusa el caso de uso y el
  hook existentes, que además dispara `syncPendingVisitsFeed`). Éxito → `navigate('/')`. Link
  secundario "Lo hago después" → `navigate('/')` sin programar.
- **Wizard completo:** si alguien cae en `/onboarding` con clave + lote ya existentes → `navigate('/')`
  directo (caso borde de re-entrada).

## 3. Gating: `ConfigGate` + `FlagsProvider` con estado de carga

- `App.tsx`: ruta nueva `/onboarding` (elemento `OnboardingWizardScreen`), fuera del `ConfigGate`.
- `ConfigGate`:
  ```
  si (loading config o loading flags o loading fields) → null
  si flag onboardingNuevo prendido y (sin config o sin lote) → <Navigate to="/onboarding" replace/>
  si sin config → <Navigate to="/configuracion" replace/>
  → <Outlet/>
  ```
- **`useHasAnyField`** (hook nuevo): `listCatalogFields.execute()` (ya existe en el container) →
  `{ hasAnyField, loading }`. A escala ~40 es `getAll` en memoria; fine.
- **`FlagsProvider`**: exponer `loading` (el fetch a `/api/flags` resuelve async; sin esto hay un
  flash de `/configuracion` antes de que llegue el flag). `ConfigGate` espera. Adicionalmente, prop
  opcional `initialFlags` para inyectar flags en tests (sin mockear fetch).

## 4. Wiring

- `Container` (`src/composition/container.ts`): agregar `createFieldEnsuring: CreateFieldEnsuring`.
  Build real idb + `makeInMemoryContainer` (`tests/support/in-memory-container.ts`).
- `date-utils.ts`: `nextBusinessDayIso()` — mañana local; si cae sábado/domingo, el próximo lunes
  (mínimo 1 día adelante).
- Hooks nuevos: `useHasAnyField`, `useCreateFieldEnsuring` (espejo de `useScheduleVisitEnsuringField`,
  sin sync del feed), `useOnboardingState` si hace falta derivar el paso actual (config + fields).

## Fuera de alcance (diferido)

- Wizard de etapas fenológicas / otros widgets (decisión explícita del usuario, queda en el backlog).
- Reusar el wizard como "nuevo lote" post-onboarding (es solo primer uso).
- Medición de completitud más fina que pageviews de Vercel (sin custom events en Hobby).
- El flag no controla variante A/B; es on/off simple.

## Plan de tests (TDD)

- `tests/application/create-field-ensuring.test.ts`: crea zona+cliente+lote desde repos vacíos; reusa
  zona/cliente existentes por id y por nombre (sin duplicado); lote sin zona ni cliente (opcionales);
  errores de `CreateZone`/`CreateField` se propagan; devuelve `fieldId`.
- `tests/ui/onboarding-wizard.test.tsx`:
  - install limpio: paso 1 → guardar clave → paso 2 → completar lote/zona/cliente → paso 3 con fecha
    pre-cargada al próximo día hábil → "Programar y listo" → navega a Inicio; existe config + lote +
    visita PENDING.
  - re-entrada con config pero sin lotes → arranca directo en paso 2.
  - skip del paso 3 ("Lo hago después") → navega a Inicio; config + lote existen, sin visita.
  - paso 2 con lote vacío → error inline.
  - re-entrada con config + lote → `/onboarding` redirige a Inicio.
- `tests/ui/config-gate.test.tsx` (ampliar): flag on + sin config → `/onboarding`; flag on + config +
  lote → Inicio; flag off + sin config → `/configuracion` (comportamiento de hoy).
- `tests/ui/date-utils.test.ts` (ampliar): `nextBusinessDayIso` salta sábado/domingo.
- `tests/ui/integration.test.tsx` (opcional): happy path real (idb) del primer uso completo vía wizard.
