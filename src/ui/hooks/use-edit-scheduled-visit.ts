import { useCallback, useState } from 'react';
import type { EditScheduledVisitInput } from '@/application/use-cases/edit-scheduled-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useEditScheduledVisit() {
  const { editScheduledVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (input: EditScheduledVisitInput) => {
      setSubmitting(true);
      setError(undefined);
      try {
        await editScheduledVisit.execute(input);
        setDone(true);
      } catch (e) {
        setError(e as Error);
      } finally {
        setSubmitting(false);
      }
    },
    [editScheduledVisit],
  );

  return { submit, submitting, error, done };
}
