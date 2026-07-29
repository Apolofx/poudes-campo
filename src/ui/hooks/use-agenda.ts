// src/ui/hooks/use-agenda.ts
import { useCallback, useEffect, useState } from 'react';
import type { UpcomingVisit } from '@/application/use-cases/list-upcoming-visits';
import { useCampo } from '@/ui/CampoProvider';

export function useAgenda() {
  const { listUpcomingVisits } = useCampo();
  const [items, setItems] = useState<UpcomingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setItems(await listUpcomingVisits.execute());
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [listUpcomingVisits]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}
