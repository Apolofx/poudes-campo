import { useCallback, useState } from 'react';
import type {
  ScheduleVisitEnsuringFieldInput,
  ScheduleVisitEnsuringFieldResult,
} from '@/application/use-cases/schedule-visit-ensuring-field';
import { useCampo } from '@/ui/CampoProvider';

export function useScheduleVisitEnsuringField() {
  const { scheduleVisitEnsuringField } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: ScheduleVisitEnsuringFieldInput): Promise<ScheduleVisitEnsuringFieldResult | undefined> => {
      setSubmitting(true);
      setError(undefined);
      try {
        return await scheduleVisitEnsuringField.execute(input);
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [scheduleVisitEnsuringField],
  );

  return { submit, submitting, error };
}
