import { useCallback, useState } from 'react';
import type {
  RecordVisitEnsuringFieldInput,
  RecordVisitEnsuringFieldResult,
} from '@/application/use-cases/record-visit-ensuring-field';
import { useCampo } from '@/ui/CampoProvider';

export function useRecordVisitEnsuringField() {
  const { recordVisitEnsuringField } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: RecordVisitEnsuringFieldInput): Promise<RecordVisitEnsuringFieldResult | undefined> => {
      setSubmitting(true);
      setError(undefined);
      try {
        return await recordVisitEnsuringField.execute(input);
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [recordVisitEnsuringField],
  );

  return { submit, submitting, error };
}
