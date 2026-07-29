import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useCancelVisit() {
  const { cancelVisit } = useCampo();
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
      } catch (e) {
        setError(e as Error);
      } finally {
        setCancelling(false);
      }
    },
    [cancelVisit],
  );

  return { cancel, cancelling, error, done };
}
