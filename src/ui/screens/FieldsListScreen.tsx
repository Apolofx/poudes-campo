import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { BackLink } from '@/ui/components/BackLink';
import { useCatalogFields } from '@/ui/hooks/use-catalog-fields';
import { clientLabel, zoneLabel } from '@/ui/labels';

export function FieldsListScreen() {
  const { rows, loading, archive, restore } = useCatalogFields();
  const [showArchived, setShowArchived] = useState(false);
  const visible = rows.filter((r) => r.field.archived === showArchived);

  return (
    <main className="screen">
      <header className="list-header">
        <BackLink to="/catalogo">Catálogo</BackLink>
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
            {showArchived ? (
              <>
                <span className="field-text">
                  <span className="field-name">{r.field.name}</span>
                  <span className="field-sub">{clientLabel(r.clientName)} · {zoneLabel(r.zoneName)}</span>
                </span>
                <span className="row-actions">
                  <button type="button" className="icon-btn is-accent" aria-label={`Restaurar ${r.field.name}`} onClick={() => restore(r.field.id)}>
                    <RotateCcw size={18} aria-hidden="true" />
                  </button>
                </span>
              </>
            ) : (
              <>
                <Link className="row-link" to={`/catalogo/lotes/${r.field.id}`}>
                  <span className="field-text">
                    <span className="field-name">{r.field.name}</span>
                    <span className="field-sub">{clientLabel(r.clientName)} · {zoneLabel(r.zoneName)}</span>
                  </span>
                </Link>
                <span className="row-actions">
                  <Link className="icon-btn is-accent" to={`/catalogo/lotes/${r.field.id}`} aria-label={`Editar ${r.field.name}`}>
                    <Pencil size={18} aria-hidden="true" />
                  </Link>
                  <button type="button" className="icon-btn is-danger" aria-label={`Archivar ${r.field.name}`} onClick={() => archive(r.field.id)}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
