import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useScheduledVisit } from '@/ui/hooks/use-scheduled-visit';
import { useCancelScheduledVisit } from '@/ui/hooks/use-cancel-scheduled-visit';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { domainErrorMessage } from '@/ui/error-messages';

function dateLabel(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ScheduledVisitDetailScreen() {
  const { fieldId = '', scheduledVisitId = '' } = useParams();
  const navigate = useNavigate();
  const scheduledVisit = useScheduledVisit(scheduledVisitId);
  const cancelHook = useCancelScheduledVisit();
  const [confirming, setConfirming] = useState(false);

  const back = `/field/${fieldId}/visitas`;
  useEffect(() => {
    if (cancelHook.done) navigate(back);
  }, [cancelHook.done, navigate, back]);

  if (scheduledVisit === undefined) {
    return <main className="screen"><p className="hint">Cargando…</p></main>;
  }
  if (scheduledVisit === null) {
    return <main className="screen"><p className="empty">No se encontró la visita programada.</p></main>;
  }

  const { scheduledDate, reminderLeadDays, notes, status } = scheduledVisit;

  return (
    <main className="screen record">
      <Link className="back-link" to={back}>‹ Historial</Link>
      <h1 className="screen-title">Visita del {dateLabel(scheduledDate)}</h1>
      <p className={`visit-badge ${status === 'CANCELLED' ? 'is-cancelled' : 'is-active'}`}>
        {status === 'CANCELLED' ? 'Cancelada' : 'Programada'}
      </p>
      {reminderLeadDays > 0 && (
        <p className="field-sub">Avisar {reminderLeadDays} día{reminderLeadDays > 1 ? 's' : ''} antes</p>
      )}
      {notes && <p className="field-sub">{notes}</p>}
      {cancelHook.error && <p className="alert" role="alert">{domainErrorMessage(cancelHook.error)}</p>}
      {status === 'ACTIVE' && (
        <div className="list-actions">
          <Link
            className="btn-secondary"
            to={`/field/${fieldId}/programar/${scheduledVisitId}`}
            state={{ back: { label: 'Historial', to: back } }}
          >
            Editar
          </Link>
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)} disabled={cancelHook.cancelling}>
            Cancelar visita
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title="Cancelar visita programada"
        message="La visita quedará cancelada y no se mostrará en el historial como activa. ¿Confirmás?"
        confirmLabel="Confirmar"
        cancelLabel="Volver"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); cancelHook.cancel(scheduledVisitId); }}
      />
    </main>
  );
}
