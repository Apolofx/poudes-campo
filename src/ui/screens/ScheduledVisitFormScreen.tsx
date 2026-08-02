import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCampo } from '@/ui/CampoProvider';
import { useScheduleVisit } from '@/ui/hooks/use-schedule-visit';
import { useEditScheduledVisit } from '@/ui/hooks/use-edit-scheduled-visit';
import { domainErrorMessage } from '@/ui/error-messages';

interface BackNav {
  label: string;
  to: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function ScheduledVisitFormScreen() {
  const { fieldId = '', scheduledVisitId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getScheduledVisit } = useCampo();
  const create = useScheduleVisit();
  const edit = useEditScheduledVisit();

  const isEditing = Boolean(scheduledVisitId);
  const back =
    (location.state as { back?: BackNav } | null)?.back ??
    ({ label: 'Historial', to: `/field/${fieldId}/visitas` } satisfies BackNav);

  const [scheduledDate, setScheduledDate] = useState(futureIso(14));
  const [leadDays, setLeadDays] = useState(3);
  const [notes, setNotes] = useState('');
  const [loadError, setLoadError] = useState<Error | undefined>();

  useEffect(() => {
    if (!scheduledVisitId) return;
    getScheduledVisit.execute(scheduledVisitId).then((scheduled) => {
      if (!scheduled) {
        setLoadError(Object.assign(new Error('ScheduledVisitNotFound'), { name: 'ScheduledVisitNotFound' }));
        return;
      }
      setScheduledDate(scheduled.scheduledDate.toISOString().slice(0, 10));
      setLeadDays(scheduled.reminderLeadDays);
      setNotes(scheduled.notes ?? '');
    });
  }, [scheduledVisitId, getScheduledVisit]);

  useEffect(() => {
    if (create.result || edit.done) navigate(`/field/${fieldId}/visitas`);
  }, [create.result, edit.done, navigate, fieldId]);

  const error = loadError ?? create.error ?? edit.error;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0;
    const base = { reminderLeadDays: safeLead, notes: notes.trim() === '' ? undefined : notes };
    if (isEditing && scheduledVisitId) {
      edit.submit({ scheduledVisitId, scheduledDate: utcDate(scheduledDate), ...base });
    } else {
      create.submit({ fieldId, scheduledDate: utcDate(scheduledDate), ...base });
    }
  };

  const submitting = isEditing ? edit.submitting : create.submitting;
  const gapMax = Math.max(
    1,
    Math.round((utcDate(scheduledDate).getTime() - utcDate(todayIso()).getTime()) / 86_400_000),
  );

  return (
    <main className="screen record">
      <Link className="back-link" to={back.to}>‹ {back.label}</Link>
      <h1 className="screen-title">{isEditing ? 'Editar visita programada' : 'Programar visita'}</h1>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input
            className="control"
            type="date"
            min={futureIso(1)}
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Avisar días antes</span>
          <input
            className="control"
            type="number"
            min="0"
            max={gapMax}
            value={leadDays}
            onChange={(e) => setLeadDays(Number(e.target.value))}
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
        {error && <p className="alert" role="alert">{domainErrorMessage(error)}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {isEditing ? 'Guardar' : 'Programar'}
        </button>
      </form>
    </main>
  );
}
