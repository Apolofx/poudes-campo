import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { FollowUpInput } from '@/application/use-cases/follow-up';
import type { Visit } from '@/domain/entities/visit';
import { useCampo } from '@/ui/CampoProvider';
import { useEditVisit } from '@/ui/hooks/use-edit-visit';
import { useCancelVisit } from '@/ui/hooks/use-cancel-visit';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { domainErrorMessage } from '@/ui/error-messages';

type FollowUpKind = 'interval' | 'date' | 'none';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function futureIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function VisitDetailScreen() {
  const { fieldId = '', visitId = '' } = useParams();
  const navigate = useNavigate();
  const { getVisit } = useCampo();
  const edit = useEditVisit();
  const cancelHook = useCancelVisit();

  const [visit, setVisit] = useState<Visit | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  const [notes, setNotes] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('none');
  const [intervalDays, setIntervalDays] = useState(14);
  const [nextDate, setNextDate] = useState(futureIso(14));
  const [leadDays, setLeadDays] = useState(3);

  useEffect(() => {
    getVisit.execute(visitId).then((v) => {
      setVisit(v);
      if (v) {
        setNotes(v.notes ?? '');
        setVisitDate(isoDay(v.visitDate));
        if (v.followUp) {
          setKind('date');
          setNextDate(isoDay(v.followUp.nextVisitDate));
        }
      }
    });
  }, [getVisit, visitId]);

  const back = `/field/${fieldId}/visitas`;
  useEffect(() => { if (edit.done || cancelHook.done) navigate(back); }, [edit.done, cancelHook.done, navigate, back]);

  if (visit === undefined) return <main className="screen"><p className="hint">Cargando…</p></main>;
  if (visit === null) return <main className="screen"><p className="empty">No se encontró la visita.</p></main>;

  if (visit.status === 'CANCELLED') {
    return (
      <main className="screen record">
        <Link className="back-link" to={back}>‹ Historial</Link>
        <h1 className="screen-title">Visita del {isoDay(visit.visitDate)}</h1>
        <p className="visit-badge is-cancelled">Cancelada</p>
        {visit.notes && <p className="field-sub">{visit.notes}</p>}
      </main>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeInterval = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 14;
    const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0;
    let followUp: FollowUpInput;
    if (kind === 'interval') followUp = { kind: 'interval', days: safeInterval, reminderLeadDays: safeLead };
    else if (kind === 'date') followUp = { kind: 'date', date: utcDate(nextDate), reminderLeadDays: safeLead };
    else followUp = { kind: 'none' };
    edit.submit({ visitId, visitDate: utcDate(visitDate), notes: notes.trim() === '' ? undefined : notes, followUp });
  };

  return (
    <main className="screen record">
      <Link className="back-link" to={back}>‹ Historial</Link>
      <h1 className="screen-title">Editar visita</h1>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input className="control" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Notas</span>
          <textarea className="control textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <fieldset className="field fieldset">
          <legend className="field-label">Próxima visita</legend>
          <div className="segmented">
            <label className="segment"><input type="radio" name="kind" checked={kind === 'interval'} onChange={() => setKind('interval')} /><span>En N días</span></label>
            <label className="segment"><input type="radio" name="kind" checked={kind === 'date'} onChange={() => setKind('date')} /><span>En una fecha</span></label>
            <label className="segment"><input type="radio" name="kind" checked={kind === 'none'} onChange={() => setKind('none')} /><span>Sin próxima</span></label>
          </div>
          <div className="conditional-row">
            {kind === 'interval' && (
              <label className="field"><span className="field-label">Días</span>
                <input className="control" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} /></label>
            )}
            {kind === 'date' && (
              <label className="field"><span className="field-label">Fecha próxima</span>
                <input className="control" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></label>
            )}
            {kind !== 'none' && (
              <label className="field"><span className="field-label">Avisar días antes</span>
                <input className="control" type="number" min="0" value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} /></label>
            )}
          </div>
        </fieldset>
        {(edit.error || cancelHook.error) && (
          <p className="alert" role="alert">{domainErrorMessage((edit.error ?? cancelHook.error)!)}</p>
        )}
        <button className="btn-primary" type="submit" disabled={edit.submitting}>Guardar</button>
      </form>
      <button type="button" className="btn-danger" onClick={() => setConfirming(true)} disabled={cancelHook.cancelling}>
        Cancelar visita
      </button>
      <ConfirmDialog
        open={confirming}
        title="Cancelar visita"
        message="La visita quedará cancelada y no volverá a aparecer como activa. ¿Confirmás?"
        confirmLabel="Confirmar"
        cancelLabel="Volver"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); cancelHook.cancel(visitId); }}
      />
    </main>
  );
}
