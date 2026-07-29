import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogEntity, CatalogSection } from './catalog-section';
import { useCatalogEntity } from './use-catalog-entity';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

export function CatalogListScreen<E extends CatalogEntity>({ useSection }: { useSection: () => CatalogSection<E> }) {
  const section = useSection();
  const { labels, basePath, newPath } = section;
  const { entities, loading, archive, restore, countActiveFields } = useCatalogEntity(section);
  const [showArchived, setShowArchived] = useState(false);
  const [cascade, setCascade] = useState<{ id: string; name: string; count: number } | null>(null);

  const visible = entities.filter((e) => e.archived === showArchived);

  const onArchive = async (id: string, name: string) => {
    const count = await countActiveFields(id);
    if (count > 0) setCascade({ id, name, count });
    else await archive(id, false);
  };

  return (
    <main className="screen">
      <header className="list-header">
        <Link className="back-link" to="/catalogo">‹ Catálogo</Link>
        <h1 className="screen-title">{labels.listTitle}</h1>
        <Link className="btn-primary" to={newPath}>{labels.newAction}</Link>
      </header>

      <button type="button" className="toggle-archived" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Ver activos' : 'Ver archivados'}
      </button>

      {loading && <p className="hint">Cargando…</p>}
      {!loading && visible.length === 0 && <p className="empty">{labels.emptyMessage}</p>}

      <ul className="field-list">
        {visible.map((e) => (
          <li key={e.id} className="catalog-row">
            {showArchived ? (
              <>
                <span className="field-name">{e.name}</span>
                <button type="button" className="btn-secondary" aria-label={`Restaurar ${e.name}`} onClick={() => restore(e.id)}>Restaurar</button>
              </>
            ) : (
              <>
                <Link className="field-name" to={`${basePath}/${e.id}`}>{e.name}</Link>
                <button type="button" className="btn-secondary" aria-label={`Archivar ${e.name}`} onClick={() => onArchive(e.id, e.name)}>Archivar</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={cascade !== null}
        title={cascade ? labels.cascadeTitle(cascade.name) : ''}
        message={cascade ? labels.cascadeMessage(cascade.count) : ''}
        confirmLabel="Archivar también los lotes"
        cancelLabel="Mantener los lotes"
        onConfirm={async () => {
          const id = cascade?.id;
          setCascade(null);
          if (id) await archive(id, true);
        }}
        onCancel={async () => {
          const id = cascade?.id;
          setCascade(null);
          if (id) await archive(id, false);
        }}
      />
    </main>
  );
}
