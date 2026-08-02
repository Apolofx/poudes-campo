import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { FollowUpInput } from '@/application/use-cases/record-visit';
import { useRecordVisit } from '@/ui/hooks/use-record-visit';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { useCancelScheduledVisit } from '@/ui/hooks/use-cancel-scheduled-visit';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { domainErrorMessage } from '@/ui/error-messages';
import { dateLabel, localFutureIso, localTodayIso, utcDate } from '@/ui/date-utils';

type FollowUpKind = 'interval' | 'date' | 'none';

interface BackNav {
  label: string;
  to: string;
}

const DEFAULT_BACK: BackNav = { label: 'Buscar lote', to: '/buscar' };

export function RecordVisitScreen() {
  const { fieldId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { submit, submitting, error, result } = useRecordVisit();
  const fieldHistory = useFieldHistory(fieldId);
  const cancelScheduled = useCancelScheduledVisit();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const activeScheduled = fieldHistory.view?.scheduledVisits.find((s) => s.status === 'ACTIVE') ?? null;

  const back = (location.state as { back?: BackNav } | null)?.back ?? DEFAULT_BACK;

  const [visitDate, setVisitDate] = useState(localTodayIso());
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('interval');
  const [intervalDays, setIntervalDays] = useState(14);
  const [nextDate, setNextDate] = useState(localFutureIso(14));
  const [leadDays, setLeadDays] = useState(3);

  useEffect(() => {
    if (result) navigate('/');
  }, [result, navigate]);

  useEffect(() => {
    if (cancelScheduled.done) navigate(back.to);
  }, [cancelScheduled.done, navigate, back]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeInterval = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 14;
    const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0;
    let followUp: FollowUpInput;
    if (kind === 'interval') {
      followUp = { kind: 'interval', days: safeInterval, reminderLeadDays: safeLead };
    } else if (kind === 'date') {
      followUp = { kind: 'date', date: utcDate(nextDate), reminderLeadDays: safeLead };
    } else {
      followUp = { kind: 'none' };
    }
    submit({
      fieldId,
      visitDate: utcDate(visitDate),
      notes: notes.trim() === '' ? undefined : notes,
      followUp,
    });
  };

  const leadMax =
    kind === 'interval'
      ? Math.max(1, intervalDays)
      : Math.max(1, Math.round((utcDate(nextDate).getTime() - utcDate(localTodayIso()).getTime()) / 86_400_000));

  return (
    <main className="screen record">
      <Link className="back-link" to={back.to}>‹ {back.label}</Link>
      <h1 className="screen-title">Registrar visita</h1>
      <form className="form" onSubmit={onSubmit}>
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
        {(error || cancelScheduled.error) && (
          <p className="alert" role="alert">{domainErrorMessage((error ?? cancelScheduled.error)!)}</p>
        )}
        <button className="btn-primary" type="submit" disabled={submitting}>
          Registrar
        </button>
      </form>
      {activeScheduled && (
        <>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setConfirmingCancel(true)}
            disabled={cancelScheduled.cancelling}
          >
            Cancelar visita programada
          </button>
          <ConfirmDialog
            open={confirmingCancel}
            title="Cancelar visita programada"
            message={`La visita programada para el ${dateLabel(activeScheduled.scheduledDate)} quedará cancelada y no aparecerá más en tus próximas visitas. ¿Confirmás?`}
            confirmLabel="Confirmar"
            cancelLabel="Volver"
            onCancel={() => setConfirmingCancel(false)}
            onConfirm={() => {
              setConfirmingCancel(false);
              cancelScheduled.cancel(activeScheduled.id);
            }}
          />
        </>
      )}
    </main>
  );
}
