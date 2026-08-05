import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Visit } from '@/domain/entities/visit';
import { useCampo } from '@/ui/CampoProvider';
import { useEditVisit } from '@/ui/hooks/use-edit-visit';
import { useCancelVisit } from '@/ui/hooks/use-cancel-visit';
import { useAttachMedia } from '@/ui/hooks/use-attach-media';
import { useRemoveMedia } from '@/ui/hooks/use-remove-media';
import { useVisitMedia } from '@/ui/hooks/use-visit-media';
import { useFlag } from '@/ui/FlagsProvider';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { BackLink } from '@/ui/components/BackLink';
import { MediaGallery } from '@/ui/components/MediaGallery';
import { domainErrorMessage } from '@/ui/error-messages';
import { visitStatusLabel } from '@/ui/labels';
import { dateLabel, isoDay, utcDate } from '@/ui/date-utils';

export function VisitDetailScreen() {
  const { fieldId = '', visitId = '' } = useParams();
  const navigate = useNavigate();
  const { getVisit } = useCampo();
  const edit = useEditVisit();
  const cancelHook = useCancelVisit();

  const [visit, setVisit] = useState<Visit | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  const [notes, setNotes] = useState('');
  const [visitedAt, setVisitedAt] = useState('');

  const mediaVisitas = useFlag('mediaVisitas');
  const media = useVisitMedia(visitId);
  const attach = useAttachMedia();
  const removeMedia = useRemoveMedia();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const items = media.media.map((m) => ({ id: m.id, kind: m.kind, mimeType: m.mimeType, blob: m.blob }));

  useEffect(() => {
    getVisit.execute(visitId).then((v) => {
      setVisit(v);
      if (v && v.status === 'DONE') {
        setNotes(v.notes ?? '');
        setVisitedAt(isoDay(v.visitedAt!));
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
        <BackLink to={back}>Historial</BackLink>
        <h1 className="screen-title">Visita del {dateLabel(visit.visitedAt ?? visit.plannedFor!)}</h1>
        <p className={`visit-badge is-cancelled`}>{visitStatusLabel(visit.status)}</p>
        {visit.notes && <p className="field-sub">{visit.notes}</p>}
        {mediaVisitas && (
          <section className="media-section" aria-label="Adjuntos">
            <span className="field-label">Fotos y nota de voz</span>
            <MediaGallery readOnly items={items} onAdd={() => undefined} onRemove={() => undefined} />
          </section>
        )}
      </main>
    );
  }

  if (visit.status === 'PENDING') {
    return (
      <main className="screen record">
        <BackLink to={back}>Historial</BackLink>
        <h1 className="screen-title">Visita programada del {dateLabel(visit.plannedFor!)}</h1>
        <p className={`visit-badge is-active`}>{visitStatusLabel(visit.status)}</p>
        {visit.reminderLeadDays != null && visit.reminderLeadDays > 0 && (
          <p className="field-sub">Avisar {visit.reminderLeadDays} día{visit.reminderLeadDays > 1 ? 's' : ''} antes</p>
        )}
        {visit.notes && <p className="field-sub">{visit.notes}</p>}
        {cancelHook.error && <p className="alert" role="alert">{domainErrorMessage(cancelHook.error)}</p>}
        <div className="list-actions">
          <Link
            className="btn-secondary"
            to={`/field/${fieldId}/programar/${visitId}`}
            state={{ back: { label: 'Historial', to: back } }}
          >
            Editar
          </Link>
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)} disabled={cancelHook.cancelling}>
            Cancelar visita
          </button>
        </div>
        <ConfirmDialog
          open={confirming}
          title="Cancelar visita programada"
          message={`La visita del ${dateLabel(visit.plannedFor!)} quedará cancelada y no aparecerá más en tus próximas visitas. ¿Confirmás?`}
          confirmLabel="Confirmar"
          cancelLabel="Volver"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); cancelHook.cancel(visitId); }}
        />
      </main>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    edit.submit({
      kind: 'done',
      visitId,
      visitedAt: utcDate(visitedAt),
      notes: notes.trim() === '' ? undefined : notes,
    });
  };

  return (
    <main className="screen record">
      <BackLink to={back}>Historial</BackLink>
      <h1 className="screen-title">Editar visita</h1>
      <form id="edit-visit-form" className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input className="control" type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Notas</span>
          <textarea className="control textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {(edit.error || cancelHook.error) && (
          <p className="alert" role="alert">{domainErrorMessage((edit.error ?? cancelHook.error)!)}</p>
        )}
      </form>
      {mediaVisitas && (
        <section className="media-section" aria-label="Adjuntos">
          <span className="field-label">Fotos y nota de voz</span>
          <MediaGallery
            items={items}
            onAdd={async (added) => {
              for (const item of added) {
                await attach.submit({ visitId, kind: item.kind, mimeType: item.mimeType, blob: item.blob });
              }
              media.refresh();
            }}
            onRemove={(id) => setRemovingId(id)}
            busy={attach.attaching || removeMedia.removing}
          />
          {(attach.error || removeMedia.error) && (
            <p className="alert" role="alert">{domainErrorMessage((attach.error ?? removeMedia.error)!)}</p>
          )}
        </section>
      )}
      <div className="list-actions">
        <button className="btn-primary" type="submit" form="edit-visit-form" disabled={edit.submitting}>
          Guardar
        </button>
        <button type="button" className="btn-danger" onClick={() => setConfirming(true)} disabled={cancelHook.cancelling}>
          Eliminar visita
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Eliminar visita"
        message="La visita se eliminará y no volverá a aparecer como activa. ¿Confirmás?"
        confirmLabel="Confirmar"
        cancelLabel="Volver"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); cancelHook.cancel(visitId); }}
      />
      <ConfirmDialog
        open={removingId !== null}
        title="Quitar adjunto"
        message="El adjunto se borrará de forma permanente. ¿Confirmás?"
        confirmLabel="Quitar"
        cancelLabel="Volver"
        onCancel={() => setRemovingId(null)}
        onConfirm={() => {
          if (removingId) void removeMedia.submit(removingId);
          setRemovingId(null);
          media.refresh();
        }}
      />
    </main>
  );
}
