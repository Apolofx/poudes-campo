import { Link, useParams } from 'react-router-dom';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { clientLabel, zoneLabel, visitStatusLabel } from '@/ui/labels';
import { dateLabel } from '@/ui/date-utils';

export function FieldHistoryScreen() {
  const { fieldId = '' } = useParams();
  const { view, loading } = useFieldHistory(fieldId);

  if (loading) return <main className="screen"><p className="hint">Cargando…</p></main>;
  if (!view) return <main className="screen"><p className="empty">No se encontró el lote.</p></main>;

  const hasContent = view.visits.length > 0;

  return (
    <main className="screen with-bottom-bar">
      <header className="list-header">
        <Link className="back-link" to="/buscar">‹ Buscar lote</Link>
        <h1 className="screen-title">{view.field.name}</h1>
        <p className="field-sub">{clientLabel(view.clientName)} · {zoneLabel(view.zoneName)}</p>
      </header>

      {!hasContent ? (
        <p className="empty">Este lote no tiene visitas registradas.</p>
      ) : (
        <ul className="field-list">
          {view.visits.map((v) => (
            <li key={v.id}>
              <Link className="field-row" to={`/field/${fieldId}/visitas/${v.id}`}>
                <span className="field-text">
                  <span className="field-name">{dateLabel(v.plannedFor ?? v.visitedAt!)}</span>
                  <span className="field-sub">{v.notes ?? 'Sin notas'}</span>
                </span>
                <span className={`visit-badge ${v.status === 'CANCELLED' ? 'is-cancelled' : 'is-active'}`}>
                  {visitStatusLabel(v.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="bottom-actions">
        <Link className="btn-primary" to={`/field/${fieldId}/record`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Registrar visita</Link>
        <Link className="btn-secondary" to={`/field/${fieldId}/programar`} state={{ back: { label: view.field.name, to: `/field/${fieldId}/visitas` } }}>Programar visita</Link>
      </div>
    </main>
  );
}
