import { useEffect, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useHasAnyField() {
  const { listCatalogFields } = useCampo();
  const [hasAnyField, setHasAnyField] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listCatalogFields.execute().then((rows) => {
      if (!active) return;
      setHasAnyField(rows.length > 0);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [listCatalogFields]);

  return { hasAnyField, loading };
}
