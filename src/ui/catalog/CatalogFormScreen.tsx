import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CatalogEntity, CatalogSection } from './catalog-section';
import { useCatalogEntity } from './use-catalog-entity';
import { BackLink } from '@/ui/components/BackLink';
import { catalogErrorMessage } from '@/ui/error-messages';

export function CatalogFormScreen<E extends CatalogEntity>({ useSection }: { useSection: () => CatalogSection<E> }) {
  const section = useSection();
  const { labels, basePath } = section;
  const { id } = useParams();
  const navigate = useNavigate();
  const { entities, create, rename } = useCatalogEntity(section);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Precarga el nombre en edición cuando la lista termina de cargar (sin sobrescribir lo que el usuario tipeó).
  useEffect(() => {
    if (!id || touched) return;
    const found = entities.find((e) => e.id === id);
    if (found) setName(found.name);
  }, [id, entities, touched]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      if (id) await rename(id, name);
      else await create(name);
      navigate(basePath);
    } catch (err) {
      setError(catalogErrorMessage(err as Error));
    }
  };

  return (
    <main className="screen record">
      <BackLink onClick={() => navigate(basePath)}>{labels.backToList}</BackLink>
      <h1 className="screen-title">{id ? labels.formTitleEdit : labels.formTitleNew}</h1>
      <form onSubmit={onSubmit} className="catalog-form">
        <label className="form-label">
          Nombre
          <input
            className="form-input"
            value={name}
            onChange={(e) => { setTouched(true); setName(e.target.value); }}
            autoFocus
          />
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn-primary">Guardar</button>
      </form>
    </main>
  );
}
