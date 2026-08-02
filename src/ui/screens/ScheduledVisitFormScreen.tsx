import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCampo } from '@/ui/CampoProvider';
import { useScheduleVisitEnsuringField } from '@/ui/hooks/use-schedule-visit-ensuring-field';
import { useEditVisit } from '@/ui/hooks/use-edit-visit';
import { useSearchFields } from '@/ui/hooks/use-search-fields';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { PickOrCreate, type PickOrCreateValue } from '@/ui/components/PickOrCreate';
import { domainErrorMessage } from '@/ui/error-messages';
import { isoDay, localFutureIso, localTodayIso, utcDate } from '@/ui/date-utils';

interface BackNav {
  label: string;
  to: string;
}

export function ScheduledVisitFormScreen() {
  const { fieldId = '', visitId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getVisit, listZones, listClients } = useCampo();
  const create = useScheduleVisitEnsuringField();
  const edit = useEditVisit();
  const { results: lots, search } = useSearchFields();
  const fieldHistory = useFieldHistory(fieldId);

  const isEditing = Boolean(visitId);
  const pickingLot = !isEditing && !fieldId;
  const defaultBack: BackNav = pickingLot
    ? { label: 'Inicio', to: '/' }
    : { label: 'Historial', to: `/field/${fieldId}/visitas` };
  const back = (location.state as { back?: BackNav } | null)?.back ?? defaultBack;

  const [lotValue, setLotValue] = useState<PickOrCreateValue>({ type: 'none' });
  const [zoneValue, setZoneValue] = useState<PickOrCreateValue>({ type: 'none' });
  const [clientValue, setClientValue] = useState<PickOrCreateValue>({ type: 'none' });
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [plannedDate, setPlannedDate] = useState(localFutureIso(14));
  const [leadDays, setLeadDays] = useState(3);
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<Error | undefined>();

  useEffect(() => {
    if (!pickingLot) return;
    search('');
    listZones.execute().then((zs) => setZones(zs.filter((z) => !z.archived).map((z) => ({ id: z.id, name: z.name }))));
    listClients.execute().then((cs) => setClients(cs.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }))));
  }, [pickingLot, search, listZones, listClients]);

  useEffect(() => {
    if (!visitId) return;
    getVisit.execute(visitId).then((v) => {
      if (!v || v.status !== 'PENDING') {
        setLoadError(Object.assign(new Error('VisitNotFound'), { name: 'VisitNotFound' }));
        return;
      }
      setPlannedDate(isoDay(v.plannedFor!));
      setLeadDays(v.reminderLeadDays ?? 0);
      setNotes(v.notes ?? '');
    });
  }, [visitId, getVisit]);

  useEffect(() => {
    if (edit.done) navigate(back.to);
  }, [edit.done, navigate, back]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(undefined);
    const safeLead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 0;
    const base = { plannedFor: utcDate(plannedDate), reminderLeadDays: safeLead, notes: notes.trim() === '' ? undefined : notes };

    if (isEditing && visitId) {
      edit.submit({ kind: 'pending', visitId, ...base });
      return;
    }

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
      const result = await create.submit({ ...base, field });
      if (result) navigate('/');
      return;
    }

    const result = await create.submit({ ...base, field: { id: fieldId } });
    if (result) navigate(`/field/${fieldId}/visitas`);
  };

  const fieldName = !isEditing && fieldId ? fieldHistory.view?.field.name : undefined;
  const domainError = loadError ?? edit.error ?? create.error;
  const submitting = isEditing ? edit.submitting : create.submitting;
  const gapMax = Math.max(
    1,
    Math.round((utcDate(plannedDate).getTime() - utcDate(localTodayIso()).getTime()) / 86_400_000),
  );

  return (
    <main className="screen record">
      <Link className="back-link" to={back.to}>‹ {back.label}</Link>
      <h1 className="screen-title">{isEditing ? 'Editar visita programada' : 'Programar visita'}</h1>
      {fieldName && <p className="field-sub">Lote: {fieldName}</p>}
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
            min={localFutureIso(1)}
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
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
        {localError && <p className="alert" role="alert">{localError}</p>}
        {domainError && <p className="alert" role="alert">{domainErrorMessage(domainError)}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {isEditing ? 'Guardar' : 'Programar'}
        </button>
      </form>
    </main>
  );
}
