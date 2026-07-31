import { useCallback, useState } from 'react';
import type { EditVisitInput } from '@/application/use-cases/edit-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useEditVisit() {
  const { editVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (input: EditVisitInput) => {
      setSubmitting(true);
      setError(undefined);
      try {
        await editVisit.execute(input);
        setDone(true);
      } catch (e) {
        setError(e as Error);
      } finally {
        setSubmitting(false);
      }
    },
    [editVisit],
  );

  return { submit, submitting, error, done };
}
