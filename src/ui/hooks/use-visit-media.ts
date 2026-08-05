import { useCallback, useEffect, useState } from 'react';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { VisitId } from '@/domain/shared/ids';
import { useCampo } from '@/ui/CampoProvider';

export function useVisitMedia(visitId: VisitId) {
  const { listVisitMedia } = useCampo();
  const [media, setMedia] = useState<VisitMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listVisitMedia
      .execute(visitId)
      .then((items) => { if (active) setMedia(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listVisitMedia, visitId, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { media, loading, refresh };
}
