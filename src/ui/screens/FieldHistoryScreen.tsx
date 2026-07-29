import { Link, useParams } from 'react-router-dom';
import { useFieldHistory } from '@/ui/hooks/use-field-history';
import { clientLabel, zoneLabel } from '@/ui/labels';

function dateLabel(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function FieldHistoryScreen() {
  const { fieldId = '' } = useParams();
  const { view, loading } = useFieldHistory(fieldId);

  if (loading) return <main className="screen"><p className="hint">Cargando…</p></main>;
  if (!view) return <main className="screen"><p className="empty">No se encontró el lote.</p></main>;

  return (
    <main className="screen">
      <Link className="back-link" to="/buscar">‹ Buscar lote</Link>
      <h1 className="screen-title">{view.field.name}</h1>
      <p className="field-sub">{clientLabel(view.clientName)} · {zoneLabel(view.zoneName)}</p>

      <Link className="btn-primary" to={`/field/${fieldId}/record`}>Registrar visita</Link>

      {view.visits.length === 0 ? (
        <p className="empty">Este lote no tiene visitas registradas.</p>
      ) : (
        <ul className="field-list">
          {view.visits.map((v) => (
            <li key={v.id}>
              <Link className="field-row" to={`/field/${fieldId}/visitas/${v.id}`}>
                <span className="field-text">
                  <span className="field-name">{dateLabel(v.visitDate)}</span>
                  <span className="field-sub">{v.notes ?? 'Sin notas'}</span>
                </span>
                <span className={`visit-badge ${v.status === 'CANCELLED' ? 'is-cancelled' : 'is-active'}`}>
                  {v.status === 'CANCELLED' ? 'Cancelada' : 'Activa'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
