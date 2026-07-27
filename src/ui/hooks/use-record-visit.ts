import { useCallback, useState } from 'react';
import type { RecordVisitInput, RecordVisitResult } from '@/application/use-cases/record-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useRecordVisit() {
  const { recordVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<RecordVisitResult | undefined>();

  const submit = useCallback(
    async (input: RecordVisitInput) => {
      setSubmitting(true);
      setError(undefined);
      try {
        setResult(await recordVisit.execute(input));
      } catch (e) {
        setError(e as Error);
      } finally {
        setSubmitting(false);
      }
    },
    [recordVisit],
  );

  return { submit, submitting, error, result };
}
