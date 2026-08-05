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
    if (config && hasAnyField) {
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
  const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? Math.min(leadDays, gapMax) : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await schedule.submit({
      field: { id: fieldId },
      plannedFor: utcDate(plannedDate),
      reminderLeadDays: safeLead,
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
          <input className="control" type="number" min="0" max={gapMax} value={safeLead} onChange={(e) => setLeadDays(Number(e.target.value))} />
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
