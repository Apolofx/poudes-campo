import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useCancelVisit() {
  const { cancelVisit, syncPendingVisitsFeed } = useCampo();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [done, setDone] = useState(false);

  const cancel = useCallback(
    async (visitId: string) => {
      setCancelling(true);
      setError(undefined);
      try {
        await cancelVisit.execute({ visitId });
        setDone(true);
        void syncPendingVisitsFeed();
      } catch (e) {
        setError(e as Error);
      } finally {
        setCancelling(false);
      }
    },
    [cancelVisit, syncPendingVisitsFeed],
  );

  return { cancel, cancelling, error, done };
}
