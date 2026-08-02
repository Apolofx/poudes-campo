import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { NextVisitInput } from '@/application/use-cases/next-visit';
import { useRecordVisit } from '@/ui/hooks/use-record-visit';
import { useRecordVisitEnsuringField } from '@/ui/hooks/use-record-visit-ensuring-field';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { useSearchFields } from '@/ui/hooks/use-search-fields';
import { useCancelVisit } from '@/ui/hooks/use-cancel-visit';
import { useCampo } from '@/ui/CampoProvider';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { PickOrCreate, type PickOrCreateValue } from '@/ui/components/PickOrCreate';
import { domainErrorMessage } from '@/ui/error-messages';
import { dateLabel, localFutureIso, localTodayIso, utcDate } from '@/ui/date-utils';

type NextKind = 'interval' | 'date' | 'none';

interface BackNav {
  label: string;
  to: string;
}

const DEFAULT_BACK: BackNav = { label: 'Buscar lote', to: '/buscar' };

export function RecordVisitScreen() {
  const { fieldId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { listZones, listClients } = useCampo();
  const { submit, submitting, error, result } = useRecordVisit();
  const ensuring = useRecordVisitEnsuringField();
  const fieldHistory = useFieldHistory(fieldId);
  const cancelHook = useCancelVisit();
  const { results: lots, search } = useSearchFields();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const pickingLot = !fieldId;

  const [lotValue, setLotValue] = useState<PickOrCreateValue>({ type: 'none' });
  const [zoneValue, setZoneValue] = useState<PickOrCreateValue>({ type: 'none' });
  const [clientValue, setClientValue] = useState<PickOrCreateValue>({ type: 'none' });
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [localError, setLocalError] = useState<string | undefined>();

  const pending = fieldHistory.view?.visits.find((v) => v.status === 'PENDING') ?? null;

  const defaultBack: BackNav = pickingLot ? { label: 'Inicio', to: '/' } : DEFAULT_BACK;
  const back = (location.state as { back?: BackNav } | null)?.back ?? defaultBack;

  const [visitDate, setVisitDate] = useState(localTodayIso());
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<NextKind>('interval');
  const [intervalDays, setIntervalDays] = useState(14);
  const [nextDate, setNextDate] = useState(localFutureIso(14));
  const [leadDays, setLeadDays] = useState(3);

  useEffect(() => {
    if (!pickingLot) return;
    search('');
    listZones.execute().then((zs) => setZones(zs.filter((z) => !z.archived).map((z) => ({ id: z.id, name: z.name }))));
    listClients.execute().then((cs) => setClients(cs.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }))));
  }, [pickingLot, search, listZones, listClients]);

  useEffect(() => {
    if (pending) setNotes(pending.notes ?? '');
  }, [pending?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) navigate('/');
  }, [result, navigate]);

  useEffect(() => {
    if (cancelHook.done) navigate(back.to);
  }, [cancelHook.done, navigate, back]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(undefined);
    const safeInterval = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 14;
    const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0;
    let next: NextVisitInput;
    if (kind === 'interval') {
      next = { kind: 'interval', days: safeInterval, reminderLeadDays: safeLead };
    } else if (kind === 'date') {
      next = { kind: 'date', date: utcDate(nextDate), reminderLeadDays: safeLead };
    } else {
      next = { kind: 'none' };
    }
    const base = { visitedAt: utcDate(visitDate), notes: notes.trim() === '' ? undefined : notes, next };

    if (pickingLot) {
      if (lotValue.type === 'none') {
        setLocalError('Ingresá el nombre del lote.');
        return;
      }
      const field = lotValue.type === 'existing'
        ? { id: lotValue.id }
        : {
            name: lotValue.name,
            zone: zoneValue.type === 'none' ? undefined
              : zoneValue.type === 'existing' ? { id: zoneValue.id } : { name: zoneValue.name },
            client: clientValue.type === 'none' ? undefined
              : clientValue.type === 'existing' ? { id: clientValue.id } : { name: clientValue.name },
          };
      const ensuringResult = await ensuring.submit({ ...base, field });
      if (ensuringResult) navigate('/');
      return;
    }

    submit({ fieldId, ...base });
  };

  const leadMax =
    kind === 'interval'
      ? Math.max(1, intervalDays)
      : Math.max(1, Math.round((utcDate(nextDate).getTime() - utcDate(localTodayIso()).getTime()) / 86_400_000));

  const domainError = error ?? cancelHook.error ?? ensuring.error;
  const isSubmitting = submitting || ensuring.submitting;

  return (
    <main className="screen record">
      <Link className="back-link" to={back.to}>‹ {back.label}</Link>
      <h1 className="screen-title">Registrar visita</h1>
      {pending && (
        <p className="field-sub">Estaba programada para el {dateLabel(pending.plannedFor!)}.</p>
      )}
      <form className="form" onSubmit={onSubmit}>
        {pickingLot && (
          <label className="field">
            <span className="field-label">Lote</span>
            <PickOrCreate
              label="Lote"
              items={lots.map((r) => ({ id: r.field.id, name: r.field.name }))}
              placeholder="Nombre del lote"
              onChange={setLotValue}
            />
          </label>
        )}
        {pickingLot && lotValue.type !== 'existing' && (
          <>
            <label className="field">
              <span className="field-label">Zona</span>
              <PickOrCreate
                label="Zona"
                items={zones}
                placeholder="Zona (opcional)"
                allowNone
                noneLabel="Sin zona"
                onChange={setZoneValue}
              />
            </label>
            <label className="field">
              <span className="field-label">Cliente</span>
              <PickOrCreate
                label="Cliente"
                items={clients}
                placeholder="Cliente (opcional)"
                allowNone
                noneLabel="Sin cliente"
                onChange={setClientValue}
              />
            </label>
          </>
        )}
        <label className="field">
          <span className="field-label">Fecha</span>
          <input
            className="control"
            type="date"
            max={localTodayIso()}
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Notas</span>
          <textarea
            className="control textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <fieldset className="field fieldset">
          <legend className="field-label">Próxima visita</legend>
          <div className="segmented">
            <label className="segment">
              <input type="radio" name="kind" checked={kind === 'interval'} onChange={() => setKind('interval')} />
              <span>En N días</span>
            </label>
            <label className="segment">
              <input type="radio" name="kind" checked={kind === 'date'} onChange={() => setKind('date')} />
              <span>En una fecha</span>
            </label>
            <label className="segment">
              <input type="radio" name="kind" checked={kind === 'none'} onChange={() => setKind('none')} />
              <span>Sin próxima</span>
            </label>
          </div>
          <div className="conditional-row">
            {kind === 'interval' && (
              <label className="field">
                <span className="field-label">Días</span>
                <input
                  className="control"
                  type="number"
                  min="1"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                />
              </label>
            )}
            {kind === 'date' && (
              <label className="field">
                <span className="field-label">Fecha próxima</span>
                <input
                  className="control"
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </label>
            )}
            {kind !== 'none' && (
              <label className="field">
                <span className="field-label">Avisar días antes</span>
                <input
                  className="control"
                  type="number"
                  min="0"
                  max={leadMax}
                  value={leadDays}
                  onChange={(e) => setLeadDays(Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </fieldset>
        {domainError && (
          <p className="alert" role="alert">{domainErrorMessage(domainError)}</p>
        )}
        {localError && <p className="alert" role="alert">{localError}</p>}
        <button className="btn-primary" type="submit" disabled={isSubmitting}>
          Registrar
        </button>
      </form>
      {!pickingLot && pending && (
        <>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setConfirmingCancel(true)}
            disabled={cancelHook.cancelling}
          >
            Cancelar visita
          </button>
          <ConfirmDialog
            open={confirmingCancel}
            title="Cancelar visita programada"
            message={`La visita programada para el ${dateLabel(pending.plannedFor!)} quedará cancelada y no aparecerá más en tus próximas visitas. ¿Confirmás?`}
            confirmLabel="Confirmar"
            cancelLabel="Volver"
            onCancel={() => setConfirmingCancel(false)}
            onConfirm={() => {
              setConfirmingCancel(false);
              cancelHook.cancel(pending.id);
            }}
          />
        </>
      )}
    </main>
  );
}
