import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useCancelScheduledVisit() {
  const { cancelScheduledVisit } = useCampo();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [done, setDone] = useState(false);

  const cancel = useCallback(
    async (scheduledVisitId: string) => {
      setCancelling(true);
      setError(undefined);
      try {
        await cancelScheduledVisit.execute({ scheduledVisitId });
        setDone(true);
      } catch (e) {
        setError(e as Error);
      } finally {
        setCancelling(false);
      }
    },
    [cancelScheduledVisit],
  );

  return { cancel, cancelling, error, done };
}
