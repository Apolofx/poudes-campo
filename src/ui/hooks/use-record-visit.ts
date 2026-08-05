import { useCallback, useState } from 'react';
import type { RecordVisitInput, RecordVisitResult } from '@/application/use-cases/record-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useRecordVisit() {
  const { recordVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<RecordVisitResult | undefined>();

  const submit = useCallback(
    async (input: RecordVisitInput): Promise<RecordVisitResult | undefined> => {
      setSubmitting(true);
      setError(undefined);
      try {
        const result = await recordVisit.execute(input);
        setResult(result);
        return result;
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [recordVisit],
  );

  return { submit, submitting, error, result };
}
