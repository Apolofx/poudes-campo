import { Link, useParams } from 'react-router-dom';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { clientLabel, zoneLabel } from '@/ui/labels';
import { dateLabel } from '@/ui/date-utils';

export function FieldHistoryScreen() {
  const { fieldId = '' } = useParams();
  const { view, loading } = useFieldHistory(fieldId);

  if (loading) return <main className="screen"><p className="hint">Cargando…</p></main>;
  if (!view) return <main className="screen"><p className="empty">No se encontró el lote.</p></main>;

  const hasContent = view.visits.length > 0 || view.scheduledVisits.length > 0;

  return (
    <main className="screen">
      <header className="list-header">
        <Link className="back-link" to="/buscar">‹ Buscar lote</Link>
        <h1 className="screen-title">{view.field.name}</h1>
        <p className="field-sub">{clientLabel(view.clientName)} · {zoneLabel(view.zoneName)}</p>

        {hasContent && (
          <div className="list-actions">
            <Link className="btn-primary" to={`/field/${fieldId}/record`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Registrar visita</Link>
            <Link className="btn-secondary" to={`/field/${fieldId}/programar`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Programar visita</Link>
          </div>
        )}
      </header>

      {!hasContent ? (
        <>
          <p className="empty">Este lote no tiene visitas registradas.</p>
          <div className="empty-actions">
            <Link className="btn-primary" to={`/field/${fieldId}/record`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Registrar tu primera visita</Link>
            <Link className="btn-secondary" to={`/field/${fieldId}/programar`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Programar visita</Link>
          </div>
        </>
      ) : (
        <ul className="field-list">
          {[...view.visits.map((v) => ({
            key: `v-${v.id}`,
            date: v.visitDate,
            href: `/field/${fieldId}/visitas/${v.id}`,
            status: v.status,
            statusLabel: v.status === 'CANCELLED' ? 'Cancelada' : 'Activa',
            notes: v.notes,
          })), ...view.scheduledVisits.map((s) => ({
            key: `s-${s.id}`,
            date: s.scheduledDate,
            href: `/field/${fieldId}/programadas/${s.id}`,
            status: s.status,
            statusLabel: s.status === 'CANCELLED' ? 'Cancelada' : 'Programada',
            notes: s.notes,
          }))].sort((a, b) => b.date.getTime() - a.date.getTime()).map((row) => (
            <li key={row.key}>
              <Link className="field-row" to={row.href}>
                <span className="field-text">
                  <span className="field-name">{dateLabel(row.date)}</span>
                  <span className="field-sub">{row.notes ?? 'Sin notas'}</span>
                </span>
                <span className={`visit-badge ${row.status === 'CANCELLED' ? 'is-cancelled' : 'is-active'}`}>
                  {row.statusLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
