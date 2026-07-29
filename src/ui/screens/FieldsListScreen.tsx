import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogFields } from '@/ui/hooks/use-catalog-fields';
import { clientLabel, zoneLabel } from '@/ui/labels';

export function FieldsListScreen() {
  const { rows, loading, archive, restore } = useCatalogFields();
  const [showArchived, setShowArchived] = useState(false);
  const visible = rows.filter((r) => r.field.archived === showArchived);

  return (
    <main className="screen">
      <header className="list-header">
        <Link className="back-link" to="/catalogo">‹ Catálogo</Link>
        <h1 className="screen-title">Lotes</h1>
        <Link className="btn-primary" to="/catalogo/lotes/nuevo">Nuevo lote</Link>
      </header>

      <button type="button" className="toggle-archived" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Ver activos' : 'Ver archivados'}
      </button>

      {loading && <p className="hint">Cargando…</p>}
      {!loading && visible.length === 0 && <p className="empty">No hay lotes.</p>}

      <ul className="field-list">
        {visible.map((r) => (
          <li key={r.field.id} className="catalog-row">
            <span className="field-text">
              {showArchived
                ? <span className="field-name">{r.field.name}</span>
                : <Link className="field-name" to={`/catalogo/lotes/${r.field.id}`}>{r.field.name}</Link>}
              <span className="field-sub">{clientLabel(r.clientName)} · {zoneLabel(r.zoneName)}</span>
            </span>
            {showArchived
              ? <button type="button" className="btn-secondary" aria-label={`Restaurar ${r.field.name}`} onClick={() => restore(r.field.id)}>Restaurar</button>
              : <button type="button" className="btn-secondary" aria-label={`Archivar ${r.field.name}`} onClick={() => archive(r.field.id)}>Archivar</button>}
          </li>
        ))}
      </ul>
    </main>
  );
}
