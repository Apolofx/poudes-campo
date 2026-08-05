import { useCallback, useState } from 'react';
import type { MediaId } from '@/domain/shared/ids';
import { useCampo } from '@/ui/CampoProvider';

export function useRemoveMedia() {
  const { removeMediaFromVisit } = useCampo();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (mediaId: MediaId): Promise<boolean> => {
      setRemoving(true);
      setError(undefined);
      try {
        await removeMediaFromVisit.execute(mediaId);
        return true;
      } catch (e) {
        setError(e as Error);
        return false;
      } finally {
        setRemoving(false);
      }
    },
    [removeMediaFromVisit],
  );

  return { submit, removing, error };
}
