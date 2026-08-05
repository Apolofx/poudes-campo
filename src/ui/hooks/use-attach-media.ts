import { useCallback, useState } from 'react';
import type { AttachMediaInput } from '@/application/use-cases/attach-media';
import { VisitMedia } from '@/domain/entities/visit-media';
import { useCampo } from '@/ui/CampoProvider';

export function useAttachMedia() {
  const { attachMediaToVisit } = useCampo();
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: AttachMediaInput): Promise<VisitMedia | undefined> => {
      setAttaching(true);
      setError(undefined);
      try {
        return await attachMediaToVisit.execute(input);
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setAttaching(false);
      }
    },
    [attachMediaToVisit],
  );

  return { submit, attaching, error };
}
