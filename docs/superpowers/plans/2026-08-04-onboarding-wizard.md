# Etapa 6 — Onboarding: mini wizard de primer uso (gateado por flag) — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-08-04-onboarding-wizard-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `onboarding-wizard`. Al cerrar: merge --no-ff a `main`.

## Tareas

### Tarea 1 — Use case `CreateFieldEnsuring` + wiring de containers

- [ ] Test rojo `tests/application/create-field-ensuring.test.ts`
- [ ] Implementación `src/application/use-cases/create-field-ensuring.ts`
- [ ] Wiring: `src/composition/container.ts` (interface + build) y `tests/support/in-memory-container.ts`
- [ ] Verde + typecheck → commit `feat(application): CreateFieldEnsuring orquesta crear zona/cliente/lote`

### Tarea 2 — `nextBusinessDayIso` en `date-utils`

- [ ] Test rojo: ampliar `tests/ui/date-utils.test.ts`
- [ ] Implementación en `src/ui/date-utils.ts`
- [ ] Verde + typecheck → commit `feat(ui): helper nextBusinessDayIso para el wizard`

### Tarea 3 — `FlagsProvider`: expone `loading` + prop `initialFlags`

- [ ] Test rojo: ampliar `tests/ui/flags-provider.test.tsx`
- [ ] Implementación en `src/ui/FlagsProvider.tsx` (context `{ values, loading }`, `useFlag` intacto, nuevo `useFlagsLoading`)
- [ ] Verde + typecheck → commit `feat(ui): FlagsProvider con estado de carga e initialFlags para tests`

### Tarea 4 — Hooks `useHasAnyField` + `useCreateFieldEnsuring`

- [ ] Implementación `src/ui/hooks/use-has-any-field.ts` y `src/ui/hooks/use-create-field-ensuring.ts`
- [ ] Cobertura vía tests de pantalla/gate (Tareas 5–7); typecheck
- [ ] Commit `feat(ui): hooks useHasAnyField y useCreateFieldEnsuring`

### Tarea 5 — Pantalla `OnboardingWizardScreen` + CSS del stepper

- [ ] Test rojo `tests/ui/onboarding-wizard.test.tsx` (flujo completo, re-entrada, skip, error lote vacío, re-entrada con datos)
- [ ] Implementación `src/ui/screens/OnboardingWizardScreen.tsx`
- [ ] CSS `.stepper`/`.stepper-dot` en `src/ui/styles.css`
- [ ] Verde + typecheck → commit `feat(ui): mini wizard de primer uso en 3 pasos`

### Tarea 6 — `ConfigGate` con flag + ruta `/onboarding`

- [ ] Test rojo: ampliar `tests/ui/config-gate.test.tsx` (harness con `FlagsProvider` + casos on/off)
- [ ] `src/ui/App.tsx`: `ConfigGate` + ruta `/onboarding`
- [ ] Verde + typecheck → commit `feat(ui): gate de onboarding con flag onboardingNuevo`

### Tarea 7 — Integration test del primer uso vía wizard (idb real)

- [ ] `tests/ui/integration.test.tsx`: wrap con `FlagsProvider` + happy path del wizard
- [ ] Suite completa + typecheck → commit `test(ui): integration primer uso vía wizard`

### Tarea 8 — Cierre

- [ ] Actualizar `docs/ROADMAP.md` (fila de etapa + nota del flag)
- [ ] Suite completa verde + typecheck
- [ ] Merge --no-ff a `main`, borrar rama

---

## Código de referencia (por tarea)

### Tarea 1

```ts
// src/application/use-cases/create-field-ensuring.ts
import type { CreateZone } from '@/application/use-cases/zone-catalog';
import type { CreateClient } from '@/application/use-cases/client-catalog';
import type { CreateField } from '@/application/use-cases/field-catalog';
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';

export type ExistingRef = { id: string };
export type NewRef = { name: string };
export type OptionalRef = ExistingRef | NewRef;

export interface CreateFieldEnsuringInput {
  name: string;
  zone?: OptionalRef;
  client?: OptionalRef;
}

export interface CreateFieldEnsuringResult {
  fieldId: FieldId;
}

export class CreateFieldEnsuring {
  constructor(
    private readonly createZone: CreateZone,
    private readonly createClient: CreateClient,
    private readonly createField: CreateField,
  ) {}

  async execute(input: CreateFieldEnsuringInput): Promise<CreateFieldEnsuringResult> {
    let zoneId: ZoneId | undefined;
    let clientId: ClientId | undefined;
    if (input.zone) {
      zoneId = 'id' in input.zone ? input.zone.id : (await this.createZone.execute(input.zone.name)).id;
    }
    if (input.client) {
      clientId = 'id' in input.client ? input.client.id : (await this.createClient.execute(input.client.name)).id;
    }
    const field = await this.createField.execute({ name: input.name, zoneId, clientId });
    return { fieldId: field.id };
  }
}
```

```ts
// src/composition/container.ts — interface (agregar) + build (agregar)
// import { CreateFieldEnsuring } from '@/application/use-cases/create-field-ensuring';
// interface Container { ... createFieldEnsuring: CreateFieldEnsuring; }
// build: createFieldEnsuring: new CreateFieldEnsuring(createZone, createClient, createField),
```

```ts
// tests/support/in-memory-container.ts — retorno de makeInMemoryContainer (agregar)
// import { CreateFieldEnsuring } from '@/application/use-cases/create-field-ensuring';
// createFieldEnsuring: new CreateFieldEnsuring(createZone, createClient, createField),
```

```ts
// tests/application/create-field-ensuring.test.ts
import { describe, it, expect } from 'vitest';
import { CreateFieldEnsuring } from '@/application/use-cases/create-field-ensuring';
import { CreateZone, ListZones } from '@/application/use-cases/zone-catalog';
import { CreateClient, ListClients } from '@/application/use-cases/client-catalog';
import { CreateField, ListCatalogFields } from '@/application/use-cases/field-catalog';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

function build() {
  const zoneMap = new Map<string, import('@/domain/entities/zone').Zone>();
  const clientMap = new Map<string, import('@/domain/entities/client').Client>();
  const fields = new InMemoryFieldRepository(zoneMap, clientMap, []);
  const zones = new InMemoryZoneRepository(zoneMap);
  const clients = new InMemoryClientRepository(clientMap);
  const ids = new IncrementingIdGenerator();
  const createZone = new CreateZone(zones, ids);
  const createClient = new CreateClient(clients, ids);
  const createField = new CreateField(fields, ids);
  const uc = new CreateFieldEnsuring(createZone, createClient, createField);
  return { uc, zones, clients, fields, createZone, createClient };
}

describe('CreateFieldEnsuring', () => {
  it('crea zona, cliente y lote desde nombres', async () => {
    const { uc, zones, clients, fields } = build();
    const result = await uc.execute({ name: 'Paso 9', zone: { name: 'La Costa' }, client: { name: 'Herrera' } });

    expect(await zones.listAll()).toHaveLength(1);
    expect((await zones.listAll())[0].name).toBe('La Costa');
    expect(await clients.listAll()).toHaveLength(1);
    expect((await clients.listAll())[0].name).toBe('Herrera');
    const field = await fields.findById(result.fieldId);
    expect(field?.name).toBe('Paso 9');
    expect(field?.zoneId).toBe((await zones.listAll())[0].id);
    expect(field?.clientId).toBe((await clients.listAll())[0].id);
  });

  it('crea el lote sin zona ni cliente cuando se omiten', async () => {
    const { uc, zones, clients, fields } = build();
    const result = await uc.execute({ name: 'Potrero 9' });

    expect(await zones.listAll()).toHaveLength(0);
    expect(await clients.listAll()).toHaveLength(0);
    const field = await fields.findById(result.fieldId);
    expect(field?.name).toBe('Potrero 9');
    expect(field?.zoneId).toBeUndefined();
    expect(field?.clientId).toBeUndefined();
  });

  it('reusa zona y cliente existentes por id sin duplicar', async () => {
    const { uc, zones, clients, createZone, createClient, fields } = build();
    const zone = await createZone.execute('La Costa');
    const client = await createClient.execute('Herrera');

    const result = await uc.execute({ name: 'Paso 9', zone: { id: zone.id }, client: { id: client.id } });

    expect(await zones.listAll()).toHaveLength(1);
    expect(await clients.listAll()).toHaveLength(1);
    const field = await fields.findById(result.fieldId);
    expect(field?.zoneId).toBe(zone.id);
    expect(field?.clientId).toBe(client.id);
  });

  it('reusa zona y cliente existentes por nombre (match sin duplicado)', async () => {
    const { uc, zones, clients, createZone, createClient } = build();
    await createZone.execute('La Costa');
    await createClient.execute('Herrera');

    await uc.execute({ name: 'Paso 9', zone: { name: 'La Costa' }, client: { name: 'Herrera' } });

    expect(await zones.listAll()).toHaveLength(1);
    expect(await clients.listAll()).toHaveLength(1);
  });
});
```

### Tarea 2

```ts
// src/ui/date-utils.ts — agregar
export function nextBusinessDayIso(): string {
  const d = new Date();
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

```ts
// tests/ui/date-utils.test.ts — ampliar
import { describe, it, expect, vi, afterEach } from 'vitest';
import { nextBusinessDayIso } from '@/ui/date-utils';

afterEach(() => {
  vi.useRealTimers();
});

function setLocalDate(year: number, month: number, day: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, 12, 0, 0));
}

describe('nextBusinessDayIso', () => {
  it('viernes salta al lunes', () => {
    setLocalDate(2026, 8, 7); // viernes
    expect(nextBusinessDayIso()).toBe('2026-08-10');
  });

  it('sábado salta al lunes', () => {
    setLocalDate(2026, 8, 8);
    expect(nextBusinessDayIso()).toBe('2026-08-10');
  });

  it('domingo salta al lunes', () => {
    setLocalDate(2026, 8, 9);
    expect(nextBusinessDayIso()).toBe('2026-08-10');
  });

  it('lunes devuelve el martes', () => {
    setLocalDate(2026, 8, 10);
    expect(nextBusinessDayIso()).toBe('2026-08-11');
  });
});
```

### Tarea 3

```tsx
// src/ui/FlagsProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FlagValues = Record<string, boolean>;

interface FlagsContextValue {
  values: FlagValues;
  loading: boolean;
}

const FlagsContext = createContext<FlagsContextValue>({ values: {}, loading: true });

export function FlagsProvider({ children, initialFlags }: { children: ReactNode; initialFlags?: FlagValues }) {
  const [flags, setFlags] = useState<FlagValues>(initialFlags ?? {});
  const [loading, setLoading] = useState(initialFlags === undefined);

  useEffect(() => {
    if (initialFlags !== undefined) return;
    let active = true;
    fetch('/api/flags')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (!active) return;
        setFlags(typeof data === 'object' && data !== null ? (data as FlagValues) : {});
      })
      .catch(() => {
        if (active) setFlags({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialFlags]);

  return <FlagsContext.Provider value={{ values: flags, loading }}>{children}</FlagsContext.Provider>;
}

export function useFlag(name: string): boolean {
  return useContext(FlagsContext).values[name] === true;
}

export function useFlagsLoading(): boolean {
  return useContext(FlagsContext).loading;
}
```

```tsx
// tests/ui/flags-provider.test.tsx — ampliar
function LoadingProbe() {
  return <div data-testid="loading">{String(useFlagsLoading())}</div>;
}

describe('FlagsProvider', () => {
  it('con initialFlags expone los flags sin esperar el fetch', () => {
    render(
      <FlagsProvider initialFlags={{ onboardingNuevo: true }}>
        <Probe name="onboardingNuevo" />
        <LoadingProbe />
      </FlagsProvider>,
    );
    expect(screen.getByTestId('flag-onboardingNuevo')).toHaveTextContent('true');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('loading true hasta que resuelve /api/flags', async () => {
    mockFlags({});
    render(
      <FlagsProvider>
        <LoadingProbe />
      </FlagsProvider>,
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  });
});
```

### Tarea 4

```ts
// src/ui/hooks/use-has-any-field.ts
import { useEffect, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useHasAnyField() {
  const { listCatalogFields } = useCampo();
  const [hasAnyField, setHasAnyField] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listCatalogFields.execute().then((rows) => {
      if (!active) return;
      setHasAnyField(rows.length > 0);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [listCatalogFields]);

  return { hasAnyField, loading };
}
```

```ts
// src/ui/hooks/use-create-field-ensuring.ts
import { useCallback, useState } from 'react';
import type {
  CreateFieldEnsuringInput,
  CreateFieldEnsuringResult,
} from '@/application/use-cases/create-field-ensuring';
import { useCampo } from '@/ui/CampoProvider';

export function useCreateFieldEnsuring() {
  const { createFieldEnsuring } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: CreateFieldEnsuringInput): Promise<CreateFieldEnsuringResult | undefined> => {
      setSubmitting(true);
      setError(undefined);
      try {
        return await createFieldEnsuring.execute(input);
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [createFieldEnsuring],
  );

  return { submit, submitting, error };
}
```

### Tarea 5

```tsx
// src/ui/screens/OnboardingWizardScreen.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampo } from '@/ui/CampoProvider';
import { useTenantConfig } from '@/ui/TenantConfigProvider';
import { useHasAnyField } from '@/ui/hooks/use-has-any-field';
import { useCreateFieldEnsuring } from '@/ui/hooks/use-create-field-ensuring';
import { useScheduleVisitEnsuringField } from '@/ui/hooks/use-schedule-visit-ensuring-field';
import { useSearchFields } from '@/ui/hooks/use-search-fields';
import { PickOrCreate, type PickOrCreateValue } from '@/ui/components/PickOrCreate';
import { BackLink } from '@/ui/components/BackLink';
import { catalogErrorMessage, domainErrorMessage } from '@/ui/error-messages';
import { localTodayIso, nextBusinessDayIso, utcDate } from '@/ui/date-utils';

const STEP_TITLES = ['Clave de acceso', 'Primer lote', 'Programar visita'];

export function OnboardingWizardScreen() {
  const navigate = useNavigate();
  const { config } = useTenantConfig();
  const { hasAnyField, loading } = useHasAnyField();
  const [step, setStep] = useState(0);
  const [fieldId, setFieldId] = useState<string | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || config === undefined) return;
    if (hasAnyField) {
      navigate('/', { replace: true });
      return;
    }
    setStep(config ? 1 : 0);
    setReady(true);
  }, [loading, config, hasAnyField, navigate]);

  if (!ready) return null;

  return (
    <main className="screen record">
      {step > 0 && <BackLink onClick={() => setStep(step - 1)}>Atrás</BackLink>}
      <h1 className="screen-title">
        {step === 0 ? 'Bienvenido a Campo' : step === 1 ? 'Tu primer lote' : 'Programá tu primera visita'}
      </h1>
      <p className="field-sub">
        Paso {step + 1} de 3 · {STEP_TITLES[step]}
      </p>
      <div className="stepper" aria-label="Progreso">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`stepper-dot${i <= step ? ' is-active' : ''}`} aria-hidden="true" />
        ))}
      </div>
      {step === 0 && <StepKey onNext={() => setStep(1)} />}
      {step === 1 && (
        <StepField
          onCreated={(id) => {
            setFieldId(id);
            setStep(2);
          }}
        />
      )}
      {step === 2 && fieldId && (
        <StepVisit fieldId={fieldId} onDone={() => navigate('/', { replace: true })} />
      )}
    </main>
  );
}

function StepKey({ onNext }: { onNext: () => void }) {
  const { save } = useTenantConfig();
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_REMINDERS_API_URL ?? '');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiUrl.trim()) {
      setError('Completá la clave de acceso y la URL de la API.');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await save({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim() });
      onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <p className="hint">Para recibir los recordatorios por email, pegá la clave de acceso que te pasaron.</p>
      <label className="field">
        <span className="field-label">Clave de acceso</span>
        <input className="control" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field-label">URL de la API</span>
        <input className="control" type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
      </label>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primary" type="submit" disabled={saving}>
        Continuar
      </button>
    </form>
  );
}

function StepField({ onCreated }: { onCreated: (fieldId: string) => void }) {
  const { listZones, listClients } = useCampo();
  const create = useCreateFieldEnsuring();
  const { results: lots, search } = useSearchFields();
  const [lot, setLot] = useState<PickOrCreateValue>({ type: 'none' });
  const [zone, setZone] = useState<PickOrCreateValue>({ type: 'none' });
  const [client, setClient] = useState<PickOrCreateValue>({ type: 'none' });
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [localError, setLocalError] = useState<string | undefined>();

  useEffect(() => {
    search('');
    listZones.execute().then((zs) => setZones(zs.filter((z) => !z.archived).map((z) => ({ id: z.id, name: z.name }))));
    listClients.execute().then((cs) => setClients(cs.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }))));
  }, [search, listZones, listClients]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(undefined);
    const zoneRef = zone.type === 'none' ? undefined : zone.type === 'existing' ? { id: zone.id } : { name: zone.name };
    const clientRef = client.type === 'none' ? undefined : client.type === 'existing' ? { id: client.id } : { name: client.name };
    if (lot.type === 'existing') {
      onCreated(lot.id);
      return;
    }
    if (lot.type === 'none') {
      setLocalError('Ingresá el nombre del lote.');
      return;
    }
    const result = await create.submit({ name: lot.name, zone: zoneRef, client: clientRef });
    if (result) onCreated(result.fieldId);
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <p className="hint">El primer lote: le ponés nombre y (si querés) la zona y el cliente al que pertenece.</p>
      <label className="field">
        <span className="field-label">Lote</span>
        <PickOrCreate label="Lote" items={lots.map((r) => ({ id: r.field.id, name: r.field.name }))} placeholder="Nombre del lote" onChange={setLot} />
      </label>
      <label className="field">
        <span className="field-label">Zona</span>
        <PickOrCreate label="Zona" items={zones} placeholder="Zona (opcional)" allowNone noneLabel="Sin zona" onChange={setZone} />
      </label>
      <label className="field">
        <span className="field-label">Cliente</span>
        <PickOrCreate label="Cliente" items={clients} placeholder="Cliente (opcional)" allowNone noneLabel="Sin cliente" onChange={setClient} />
      </label>
      {localError && (
        <p className="alert" role="alert">
          {localError}
        </p>
      )}
      {create.error && (
        <p className="alert" role="alert">
          {catalogErrorMessage(create.error)}
        </p>
      )}
      <button className="btn-primary" type="submit" disabled={create.submitting}>
        Continuar
      </button>
    </form>
  );
}

function StepVisit({ fieldId, onDone }: { fieldId: string; onDone: () => void }) {
  const schedule = useScheduleVisitEnsuringField();
  const [plannedDate, setPlannedDate] = useState(nextBusinessDayIso());
  const [leadDays, setLeadDays] = useState(3);
  const [notes, setNotes] = useState('');
  const gapMax = Math.max(
    1,
    Math.round((utcDate(plannedDate).getTime() - utcDate(localTodayIso()).getTime()) / 86_400_000),
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await schedule.submit({
      field: { id: fieldId },
      plannedFor: utcDate(plannedDate),
      reminderLeadDays: Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0,
      notes: notes.trim() === '' ? undefined : notes,
    });
    if (result) onDone();
  };

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <p className="hint">Tu primer lote ya quedó creado. Ahora agendá la primera visita.</p>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input className="control" type="date" min={nextBusinessDayIso()} value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Avisar días antes</span>
          <input className="control" type="number" min="0" max={gapMax} value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} />
        </label>
        <label className="field">
          <span className="field-label">Notas</span>
          <textarea className="control textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {schedule.error && (
          <p className="alert" role="alert">
            {domainErrorMessage(schedule.error)}
          </p>
        )}
        <button className="btn-primary" type="submit" disabled={schedule.submitting}>
          Programar y listo
        </button>
      </form>
      <div className="wizard-skip">
        <button className="btn-secondary" type="button" onClick={onDone}>
          Lo hago después
        </button>
      </div>
    </>
  );
}
```

```css
/* src/ui/styles.css — agregar */
.stepper { display: flex; gap: 6px; margin-bottom: var(--space-3); }
.stepper-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--divider); transition: background-color 150ms ease; }
.stepper-dot.is-active { background: var(--accent); }
.wizard-skip { margin-top: var(--space-2); }
```

```tsx
// tests/ui/onboarding-wizard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { OnboardingWizardScreen } from '@/ui/screens/OnboardingWizardScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

const CONFIG = { apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' };

function renderWizard(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/" element={<div>Inicio</div>} />
            <Route path="/onboarding" element={<OnboardingWizardScreen />} />
          </Routes>
        </MemoryRouter>
      </TenantConfigProvider>
    </CampoProvider>,
  );
}

async function completeStep1() {
  await screen.findByRole('heading', { name: 'Bienvenido a Campo' });
  await userEvent.type(screen.getByLabelText(/Clave de acceso/), 'tnt_t1_secret');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function completeStep2() {
  await screen.findByRole('heading', { name: 'Tu primer lote' });
  await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
  await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
  await userEvent.type(screen.getByLabelText('Cliente'), 'Herrera');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('OnboardingWizardScreen', () => {
  it('instalación limpia: completa los 3 pasos y persiste clave + lote + visita', async () => {
    const container = makeInMemoryContainer();
    await container.clearAllData.execute();
    renderWizard(container);

    await completeStep1();
    await completeStep2();

    await screen.findByRole('heading', { name: 'Programá tu primera visita' });
    await userEvent.click(screen.getByRole('button', { name: 'Programar y listo' }));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    await expect(container.getTenantConfig()).resolves.toEqual(CONFIG);
    const rows = await container.listCatalogFields.execute();
    expect(rows).toHaveLength(1);
    const upcoming = await container.listUpcomingVisits.execute();
    expect(upcoming).toHaveLength(1);
  });

  it('re-entrada con clave pero sin lotes retoma en el paso 2', async () => {
    const container = makeInMemoryContainer(undefined, CONFIG);
    await container.clearAllData.execute();
    renderWizard(container);

    await screen.findByRole('heading', { name: 'Tu primer lote' });
    expect(screen.queryByText('Bienvenido a Campo')).not.toBeInTheDocument();
  });

  it('skip del paso 3: navega a Inicio, quedan clave + lote sin visita', async () => {
    const container = makeInMemoryContainer();
    await container.clearAllData.execute();
    renderWizard(container);

    await completeStep1();
    await completeStep2();
    await screen.findByRole('heading', { name: 'Programá tu primera visita' });
    await userEvent.click(screen.getByRole('button', { name: 'Lo hago después' }));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    const rows = await container.listCatalogFields.execute();
    expect(rows).toHaveLength(1);
    const upcoming = await container.listUpcomingVisits.execute();
    expect(upcoming).toHaveLength(0);
  });

  it('paso 2 con lote vacío muestra error', async () => {
    const container = makeInMemoryContainer();
    await container.clearAllData.execute();
    renderWizard(container);

    await completeStep1();
    await screen.findByRole('heading', { name: 'Tu primer lote' });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá el nombre del lote.');
  });

  it('re-entrada con clave + lote redirige a Inicio', async () => {
    renderWizard(makeInMemoryContainer(undefined, CONFIG)); // siembra f1/f2

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
  });
});
```

### Tarea 6

```tsx
// src/ui/App.tsx — cambios
// imports nuevos:
import { OnboardingWizardScreen } from '@/ui/screens/OnboardingWizardScreen';
import { useHasAnyField } from '@/ui/hooks/use-has-any-field';
import { useFlag, useFlagsLoading } from '@/ui/FlagsProvider';

function ConfigGate() {
  const { config, loading } = useTenantConfig();
  const flagsLoading = useFlagsLoading();
  const onboarding = useFlag('onboardingNuevo');
  const fields = useHasAnyField();
  if (loading || flagsLoading || fields.loading) return null;
  if (onboarding && (!config || !fields.hasAnyField)) return <Navigate to="/onboarding" replace />;
  if (!config) return <Navigate to="/configuracion" replace />;
  return <Outlet />;
}

// rutas: junto a /configuracion, fuera del gate:
<Route path="/onboarding" element={<OnboardingWizardScreen />} />
```

```tsx
// tests/ui/config-gate.test.tsx — harness con FlagsProvider + casos nuevos
import { FlagsProvider, type FlagValues } from '@/ui/FlagsProvider';

function renderApp(container = makeInMemoryContainer(), flags: FlagValues = {}) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <FlagsProvider initialFlags={flags}>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </FlagsProvider>
      </TenantConfigProvider>
    </CampoProvider>,
  );
}

describe('ConfigGate', () => {
  it('sin config redirige a /configuracion', async () => {
    renderApp(makeInMemoryContainer());
    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
  });

  it('flag off + sin config redirige a /configuracion (comportamiento de hoy)', async () => {
    renderApp(makeInMemoryContainer(), { onboardingNuevo: false });
    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
  });

  it('flag on + sin config redirige al wizard', async () => {
    renderApp(makeInMemoryContainer(), { onboardingNuevo: true });
    expect(await screen.findByRole('heading', { name: 'Bienvenido a Campo' })).toBeInTheDocument();
  });

  it('flag on + config + sin lotes redirige al wizard', async () => {
    const container = makeInMemoryContainer(undefined, { apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' });
    await container.clearAllData.execute();
    renderApp(container, { onboardingNuevo: true });
    expect(await screen.findByRole('heading', { name: 'Tu primer lote' })).toBeInTheDocument();
  });

  it('flag on + config + lotes muestra las tabs (Inicio)', async () => {
    renderApp(
      makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'), { apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' }),
      { onboardingNuevo: true },
    );
    expect(await screen.findByRole('heading', { name: /Próximas visitas/ })).toBeInTheDocument();
  });
});
```

### Tarea 7

```tsx
// tests/ui/integration.test.tsx — wrap con FlagsProvider y happy path del wizard
import { FlagsProvider } from '@/ui/FlagsProvider';

function renderApp(container: ReturnType<typeof buildContainer>, initialEntries: string[], flags: Record<string, boolean> = {}) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <FlagsProvider initialFlags={flags}>
          <MemoryRouter initialEntries={initialEntries}>
            <App />
          </MemoryRouter>
        </FlagsProvider>
      </TenantConfigProvider>
    </CampoProvider>,
  );
}

it('primer uso vía wizard: completa los 3 pasos sobre IndexedDB real', async () => {
  const db = await openCampoDb(`t-${Math.random()}`);
  const container = buildContainer(db);

  renderApp(container, ['/onboarding'], { onboardingNuevo: true });

  await screen.findByRole('heading', { name: 'Bienvenido a Campo' });
  await userEvent.type(screen.getByLabelText(/Clave de acceso/), 'tnt_t1_secret');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  await screen.findByRole('heading', { name: 'Tu primer lote' });
  await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
  await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  await screen.findByRole('heading', { name: 'Programá tu primera visita' });
  await userEvent.click(screen.getByRole('button', { name: 'Programar y listo' }));

  await waitFor(async () => expect(await db.count('visits')).toBe(1));
  await waitFor(async () => expect(await db.count('fields')).toBe(1));
  db.close();
});
```

### Tarea 8

Actualizar `docs/ROADMAP.md`:
- Fila nueva en la tabla de etapas:
  `| **onboarding-wizard** | Mini wizard de primer uso para terceros gateado por flag de Vercel \`onboardingNuevo\`: 3 pasos (clave → primer lote → programar visita), estado derivable (retoma donde quedó), \`CreateFieldEnsuring\`, ruta \`/onboarding\` | ✅ Completa (XXX tests) |`
- En "Se puede hacer hoy", una línea bajo el bullet de recordatorios: el primer arranque guiado por wizard si el flag `onboardingNuevo` está prendido.
- Cerrar la rama: suite completa verde + typecheck → `merge --no-ff` a `main`, borrar la rama.
