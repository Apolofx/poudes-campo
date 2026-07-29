import { useCallback, useEffect, useState } from 'react';
import type { CatalogEntity, CatalogSection } from './catalog-section';

export function useCatalogEntity<E extends CatalogEntity>(section: CatalogSection<E>) {
  const { actions } = section;
  const [entities, setEntities] = useState<E[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEntities(await actions.list());
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => { void reload(); }, [reload]);

  const archive = useCallback(
    async (id: string, cascadeFields: boolean) => { await actions.archive(id, cascadeFields); await reload(); },
    [actions, reload],
  );
  const restore = useCallback(
    async (id: string) => { await actions.restore(id); await reload(); },
    [actions, reload],
  );

  return {
    entities,
    loading,
    reload,
    create: actions.create,
    rename: actions.rename,
    archive,
    restore,
    countActiveFields: actions.countActiveFields,
  };
}
